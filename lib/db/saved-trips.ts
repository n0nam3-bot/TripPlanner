import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { serializeTripSearchInput, normalizeSavedTripSnapshot, buildSavedTripForkDraft, type SavedTripDraft } from "@/lib/trip-planner/saved-trips";
import { validateTripSearchInput } from "@/lib/trip-planner/validation";
import { normalizeTripFeedbackSubmission, type TripFeedbackStatus } from "@/lib/trip-planner/trip-feedback";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,48}$/;
const SAVE_LIMIT_PER_CLIENT_PER_UTC_DAY = 5;
const LINK_TTL_DAYS = 180;

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  return neon(connectionString);
}

let schemaReady: Promise<void> | null = null;
async function ensureSavedTripTables(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_saved_trips (
        id uuid PRIMARY KEY,
        share_token_hash text NOT NULL UNIQUE,
        owner_token_hash text NOT NULL,
        search jsonb NOT NULL,
        snapshot jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS tripfinder_saved_trips_expiry_idx ON tripfinder_saved_trips (expires_at)`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_saved_trip_daily_usage (
        client_key text NOT NULL,
        usage_date date NOT NULL,
        save_count integer NOT NULL DEFAULT 0 CHECK (save_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (client_key, usage_date)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_trip_feedback_invites (
        id uuid PRIMARY KEY,
        saved_trip_id uuid NOT NULL REFERENCES tripfinder_saved_trips(id) ON DELETE CASCADE,
        invite_token_hash text NOT NULL UNIQUE,
        base_updated_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        submission_count integer NOT NULL DEFAULT 0 CHECK (submission_count >= 0),
        revoked_at timestamptz
      )`;
      await sql`CREATE INDEX IF NOT EXISTS tripfinder_feedback_invites_trip_idx ON tripfinder_trip_feedback_invites (saved_trip_id, expires_at)`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_trip_feedback (
        id uuid PRIMARY KEY,
        saved_trip_id uuid NOT NULL REFERENCES tripfinder_saved_trips(id) ON DELETE CASCADE,
        invite_id uuid NOT NULL REFERENCES tripfinder_trip_feedback_invites(id) ON DELETE CASCADE,
        submitter_name text NOT NULL DEFAULT '',
        category text NOT NULL,
        item_title text NOT NULL DEFAULT '',
        message text NOT NULL,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
        base_updated_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz,
        reviewed_by_owner_hash text
      )`;
      await sql`CREATE INDEX IF NOT EXISTS tripfinder_feedback_trip_created_idx ON tripfinder_trip_feedback (saved_trip_id, created_at DESC)`;
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function tokenHash(value: string, purpose: "share" | "owner" | "feedback"): string {
  return createHash("sha256").update(`tripfinder-saved-trip-${purpose}-v1:`).update(value).digest("hex");
}

function makeToken(): string {
  return randomBytes(32).toString("base64url");
}

function readJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try { return JSON.parse(value) as unknown; } catch { return null; }
}

export type SavedTripRecord = {
  search: SavedTripDraft["search"];
  searchQuery: string;
  snapshot: SavedTripDraft["snapshot"];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export async function saveAnonymousTripDraft(
  draft: SavedTripDraft,
  options: { shareToken?: string; ownerToken?: string; clientAddress: string },
): Promise<{ shareToken: string; ownerToken?: string; createdAt: string; updatedAt: string; expiresAt: string }> {
  await ensureSavedTripTables();
  const sql = getSql();
  const payloadBytes = new TextEncoder().encode(JSON.stringify(draft)).length;
  if (payloadBytes > 120 * 1024) throw new Error("SAVED_TRIP_TOO_LARGE");

  if (options.shareToken || options.ownerToken) {
    if (!options.shareToken || !options.ownerToken || !TOKEN_PATTERN.test(options.shareToken) || !TOKEN_PATTERN.test(options.ownerToken)) {
      throw new Error("SAVED_TRIP_OWNER_TOKEN_REQUIRED");
    }
    const updated = await sql`UPDATE tripfinder_saved_trips SET
        search = ${JSON.stringify(draft.search)}::jsonb,
        snapshot = ${JSON.stringify(draft.snapshot)}::jsonb,
        updated_at = now(),
        expires_at = now() + (${LINK_TTL_DAYS} * interval '1 day')
      WHERE share_token_hash = ${tokenHash(options.shareToken, "share")}
        AND owner_token_hash = ${tokenHash(options.ownerToken, "owner")}
        AND expires_at > now()
      RETURNING created_at::text AS created_at, updated_at::text AS updated_at, expires_at::text AS expires_at`;
    const row = updated[0] as unknown as { created_at: string; updated_at: string; expires_at: string } | undefined;
    if (!row) throw new Error("SAVED_TRIP_NOT_FOUND_OR_NOT_OWNER");
    return { shareToken: options.shareToken, createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at };
  }

  const clientKey = hashClientAddress(options.clientAddress || "unknown-client");
  const reserved = await sql`INSERT INTO tripfinder_saved_trip_daily_usage (client_key, usage_date, save_count, updated_at)
    VALUES (${clientKey}, (now() AT TIME ZONE 'UTC')::date, 1, now())
    ON CONFLICT (client_key, usage_date) DO UPDATE SET
      save_count = tripfinder_saved_trip_daily_usage.save_count + 1,
      updated_at = now()
    WHERE tripfinder_saved_trip_daily_usage.save_count < ${SAVE_LIMIT_PER_CLIENT_PER_UTC_DAY}
    RETURNING save_count`;
  if (!reserved.length) throw new Error("SAVED_TRIP_DAILY_LIMIT");

  const shareToken = makeToken();
  const ownerToken = makeToken();
  const rows = await sql`INSERT INTO tripfinder_saved_trips (
      id, share_token_hash, owner_token_hash, search, snapshot, created_at, updated_at, expires_at
    ) VALUES (
      ${randomUUID()}, ${tokenHash(shareToken, "share")}, ${tokenHash(ownerToken, "owner")},
      ${JSON.stringify(draft.search)}::jsonb, ${JSON.stringify(draft.snapshot)}::jsonb,
      now(), now(), now() + (${LINK_TTL_DAYS} * interval '1 day')
    )
    RETURNING created_at::text AS created_at, updated_at::text AS updated_at, expires_at::text AS expires_at`;
  const row = rows[0] as unknown as { created_at: string; updated_at: string; expires_at: string } | undefined;
  if (!row) throw new Error("SAVED_TRIP_SAVE_FAILED");
  await sql`DELETE FROM tripfinder_saved_trips WHERE expires_at < now()`;
  await sql`DELETE FROM tripfinder_saved_trip_daily_usage WHERE usage_date < (now() AT TIME ZONE 'UTC')::date - interval '30 days'`;
  return { shareToken, ownerToken, createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at };
}

export async function getSavedTripByShareToken(token: string): Promise<SavedTripRecord | null> {
  if (!TOKEN_PATTERN.test(token) || !process.env.DATABASE_URL) return null;
  await ensureSavedTripTables();
  const sql = getSql();
  const rows = await sql`SELECT search, snapshot, created_at::text AS created_at, updated_at::text AS updated_at, expires_at::text AS expires_at
    FROM tripfinder_saved_trips
    WHERE share_token_hash = ${tokenHash(token, "share")} AND expires_at > now()
    LIMIT 1`;
  const row = rows[0] as unknown as { search: unknown; snapshot: unknown; created_at: string; updated_at: string; expires_at: string } | undefined;
  if (!row) return null;
  const searchResult = validateTripSearchInput(readJson(row.search));
  const snapshot = normalizeSavedTripSnapshot(readJson(row.snapshot));
  if (!searchResult.input || !snapshot) return null;
  return {
    search: searchResult.input,
    searchQuery: serializeTripSearchInput(searchResult.input),
    snapshot,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}


/** Create a fully independent owner/share record from a public read-only trip. */
export async function forkSavedTripFromShareToken(
  sourceShareToken: string,
  options: { clientAddress: string },
): Promise<{ shareToken: string; ownerToken?: string; createdAt: string; updatedAt: string; expiresAt: string }> {
  const source = await getSavedTripByShareToken(sourceShareToken);
  if (!source) throw new Error("SAVED_TRIP_SOURCE_NOT_FOUND");
  const draft = buildSavedTripForkDraft({ search: source.search, snapshot: source.snapshot });
  return saveAnonymousTripDraft(draft, options);
}


export type TripFeedbackInviteInfo = { title: string; destination: string; expiresAt: string };
export type TripFeedbackEntry = {
  id: string; name: string; category: string; itemTitle: string; message: string;
  status: "pending" | "reviewed" | "dismissed"; createdAt: string; stale: boolean;
};

/** Create a feedback-only invitation. It cannot read owner credentials or edit the trip. */
export async function createTripFeedbackInvite(
  shareToken: string, ownerToken: string,
): Promise<{ inviteToken: string; expiresAt: string }> {
  if (!TOKEN_PATTERN.test(shareToken) || !TOKEN_PATTERN.test(ownerToken)) throw new Error("TRIP_FEEDBACK_OWNER_REQUIRED");
  await ensureSavedTripTables();
  const sql = getSql();
  const owners = await sql`SELECT id, updated_at::text AS updated_at FROM tripfinder_saved_trips
    WHERE share_token_hash = ${tokenHash(shareToken, "share")}
      AND owner_token_hash = ${tokenHash(ownerToken, "owner")} AND expires_at > now() LIMIT 1`;
  const owner = owners[0] as unknown as { id: string; updated_at: string } | undefined;
  if (!owner) throw new Error("TRIP_FEEDBACK_OWNER_REQUIRED");
  const inviteToken = makeToken();
  const rows = await sql`INSERT INTO tripfinder_trip_feedback_invites (
      id, saved_trip_id, invite_token_hash, base_updated_at, created_at, expires_at
    ) VALUES (
      ${randomUUID()}, ${owner.id}, ${tokenHash(inviteToken, "feedback")}, ${owner.updated_at}::timestamptz, now(), now() + interval '14 days'
    ) RETURNING expires_at::text AS expires_at`;
  const row = rows[0] as unknown as { expires_at: string } | undefined;
  if (!row) throw new Error("TRIP_FEEDBACK_INVITE_FAILED");
  return { inviteToken, expiresAt: row.expires_at };
}

/** Read only the trip title and destination needed to explain the invitation. */
export async function getTripFeedbackInvite(token: string): Promise<TripFeedbackInviteInfo | null> {
  if (!TOKEN_PATTERN.test(token) || !process.env.DATABASE_URL) return null;
  await ensureSavedTripTables();
  const sql = getSql();
  const rows = await sql`SELECT
      COALESCE(NULLIF(s.snapshot->>'title',''), 'Shared Tripfinder trip') AS title,
      COALESCE(NULLIF(s.search->>'destinationArea',''), s.search->>'destination', 'trip destination') AS destination,
      i.expires_at::text AS expires_at
    FROM tripfinder_trip_feedback_invites i
    JOIN tripfinder_saved_trips s ON s.id = i.saved_trip_id
    WHERE i.invite_token_hash = ${tokenHash(token, "feedback")}
      AND i.expires_at > now() AND i.revoked_at IS NULL AND i.submission_count < 20
      AND s.expires_at > now() LIMIT 1`;
  const row = rows[0] as unknown as { title: string; destination: string; expires_at: string } | undefined;
  return row ? { title: row.title, destination: row.destination, expiresAt: row.expires_at } : null;
}

/** Submit bounded feedback through a feedback-only invitation (maximum 20 entries per invite). */
export async function submitTripFeedback(
  inviteToken: string, input: unknown,
): Promise<{ id: string; createdAt: string }> {
  if (!TOKEN_PATTERN.test(inviteToken)) throw new Error("TRIP_FEEDBACK_INVITE_NOT_FOUND");
  const submission = normalizeTripFeedbackSubmission(input);
  if (!submission) throw new Error("TRIP_FEEDBACK_INVALID");
  await ensureSavedTripTables();
  const sql = getSql();
  const reservations = await sql`UPDATE tripfinder_trip_feedback_invites AS invite
    SET submission_count = invite.submission_count + 1
    WHERE invite.invite_token_hash = ${tokenHash(inviteToken, "feedback")}
      AND invite.expires_at > now() AND invite.revoked_at IS NULL AND invite.submission_count < 20
      AND EXISTS (SELECT 1 FROM tripfinder_saved_trips s WHERE s.id = invite.saved_trip_id AND s.expires_at > now())
    RETURNING invite.id, invite.saved_trip_id, invite.base_updated_at::text AS base_updated_at`;
  const invite = reservations[0] as unknown as { id: string; saved_trip_id: string; base_updated_at: string } | undefined;
  if (!invite) throw new Error("TRIP_FEEDBACK_INVITE_NOT_FOUND");
  const rows = await sql`INSERT INTO tripfinder_trip_feedback (
      id, saved_trip_id, invite_id, submitter_name, category, item_title, message, status, base_updated_at
    ) VALUES (
      ${randomUUID()}, ${invite.saved_trip_id}, ${invite.id}, ${submission.name}, ${submission.category},
      ${submission.itemTitle}, ${submission.message}, 'pending', ${invite.base_updated_at}::timestamptz
    ) RETURNING id, created_at::text AS created_at`;
  const row = rows[0] as unknown as { id: string; created_at: string } | undefined;
  if (!row) throw new Error("TRIP_FEEDBACK_SAVE_FAILED");
  return { id: row.id, createdAt: row.created_at };
}

/** Owner-only inbox. `stale` warns when the trip changed after the invitation was issued. */
export async function listTripFeedback(
  shareToken: string, ownerToken: string,
): Promise<{ entries: TripFeedbackEntry[]; updatedAt: string }> {
  if (!TOKEN_PATTERN.test(shareToken) || !TOKEN_PATTERN.test(ownerToken)) throw new Error("TRIP_FEEDBACK_OWNER_REQUIRED");
  await ensureSavedTripTables();
  const sql = getSql();
  const trips = await sql`SELECT id, updated_at::text AS updated_at FROM tripfinder_saved_trips
    WHERE share_token_hash = ${tokenHash(shareToken, "share")}
      AND owner_token_hash = ${tokenHash(ownerToken, "owner")} AND expires_at > now() LIMIT 1`;
  const trip = trips[0] as unknown as { id: string; updated_at: string } | undefined;
  if (!trip) throw new Error("TRIP_FEEDBACK_OWNER_REQUIRED");
  const rows = await sql`SELECT id, submitter_name, category, item_title, message, status,
      created_at::text AS created_at, base_updated_at::text AS base_updated_at
    FROM tripfinder_trip_feedback WHERE saved_trip_id = ${trip.id}
    ORDER BY created_at DESC LIMIT 100`;
  const entries = (rows as unknown as Array<Record<string, string>>).map((row) => ({
    id: row.id, name: row.submitter_name, category: row.category, itemTitle: row.item_title,
    message: row.message, status: row.status as TripFeedbackEntry["status"], createdAt: row.created_at,
    stale: new Date(row.base_updated_at).getTime() !== new Date(trip.updated_at).getTime(),
  }));
  return { entries, updatedAt: trip.updated_at };
}

/** Update inbox status only when the owner is acting on the current saved-trip revision. */
export async function reviewTripFeedback(
  shareToken: string, ownerToken: string, feedbackId: string, status: Exclude<TripFeedbackStatus, "pending">, expectedUpdatedAt: string,
): Promise<{ updatedAt: string }> {
  if (!TOKEN_PATTERN.test(shareToken) || !TOKEN_PATTERN.test(ownerToken)) throw new Error("TRIP_FEEDBACK_OWNER_REQUIRED");
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(feedbackId) || !Number.isFinite(Date.parse(expectedUpdatedAt))) throw new Error("TRIP_FEEDBACK_INVALID");
  await ensureSavedTripTables();
  const sql = getSql();
  const rows = await sql`UPDATE tripfinder_trip_feedback f SET
      status = ${status}, reviewed_at = now(), reviewed_by_owner_hash = ${tokenHash(ownerToken, "owner")}
    FROM tripfinder_saved_trips s
    WHERE f.id = ${feedbackId}::uuid AND f.saved_trip_id = s.id
      AND s.share_token_hash = ${tokenHash(shareToken, "share")}
      AND s.owner_token_hash = ${tokenHash(ownerToken, "owner")}
      AND s.expires_at > now() AND s.updated_at = ${expectedUpdatedAt}::timestamptz
      AND f.status = 'pending'
    RETURNING s.updated_at::text AS updated_at`;
  const row = rows[0] as unknown as { updated_at: string } | undefined;
  if (!row) throw new Error("TRIP_FEEDBACK_CONFLICT");
  return { updatedAt: row.updated_at };
}
