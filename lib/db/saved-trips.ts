import { neon } from "@neondatabase/serverless";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashClientAddress } from "@/lib/db/travel-cache";
import { serializeTripSearchInput, normalizeSavedTripSnapshot, type SavedTripDraft } from "@/lib/trip-planner/saved-trips";
import { validateTripSearchInput } from "@/lib/trip-planner/validation";

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
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  await schemaReady;
}

function tokenHash(value: string, purpose: "share" | "owner"): string {
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
