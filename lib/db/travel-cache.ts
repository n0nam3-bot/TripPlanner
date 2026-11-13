import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";
import { classifyGeoapifyReservationFailure, resolveGeoapifyCreditCaps } from "../trip-planner/geoapify-format";

type JsonRecord = Record<string, unknown>;
type CacheRow = { payload: JsonRecord | string; created_at: string };

export type ProviderEventInput = {
  provider: string;
  category: string;
  eventType: "provider_request" | "cache_hit" | "provider_error" | "request_blocked" | "account_check" | "local_parse" | "provider_fallback";
  outcome: "success" | "error" | "blocked";
  cacheStatus?: "hit" | "miss" | "stale" | "bypass" | "none";
  httpStatus?: number | null;
  durationMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

let schemaReady: Promise<void> | null = null;

function getSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  return neon(connectionString);
}

async function ensureTravelTables() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_provider_cache (
        cache_key text PRIMARY KEY,
        payload jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS tripfinder_provider_cache_expiry_idx ON tripfinder_provider_cache (expires_at)`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_provider_usage (
        month_key text PRIMARY KEY,
        search_count integer NOT NULL DEFAULT 0 CHECK (search_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_provider_hourly_usage (
        hour_bucket timestamptz PRIMARY KEY,
        search_count integer NOT NULL DEFAULT 0 CHECK (search_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_client_usage (
        client_key text NOT NULL,
        usage_date date NOT NULL,
        hour_bucket timestamptz NOT NULL,
        hour_count integer NOT NULL DEFAULT 0 CHECK (hour_count >= 0),
        day_count integer NOT NULL DEFAULT 0 CHECK (day_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (client_key, usage_date)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_api_event_log (
        id bigserial PRIMARY KEY,
        provider text NOT NULL,
        category text NOT NULL,
        event_type text NOT NULL,
        outcome text NOT NULL,
        cache_status text NOT NULL DEFAULT 'none',
        http_status integer,
        duration_ms integer,
        prompt_tokens integer,
        completion_tokens integer,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`ALTER TABLE tripfinder_api_event_log ADD COLUMN IF NOT EXISTS prompt_tokens integer`;
      await sql`ALTER TABLE tripfinder_api_event_log ADD COLUMN IF NOT EXISTS completion_tokens integer`;
      await sql`CREATE INDEX IF NOT EXISTS tripfinder_api_event_log_created_idx ON tripfinder_api_event_log (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS tripfinder_api_event_log_provider_idx ON tripfinder_api_event_log (provider, category, created_at DESC)`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_admin_login_attempts (
        client_key text PRIMARY KEY,
        attempts integer NOT NULL DEFAULT 0,
        window_started_at timestamptz NOT NULL DEFAULT now(),
        locked_until timestamptz
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_ai_provider_daily_usage (
        provider_key text NOT NULL,
        usage_date date NOT NULL,
        request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (provider_key, usage_date)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_ai_provider_minute_usage (
        provider_key text NOT NULL,
        minute_bucket timestamptz NOT NULL,
        request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (provider_key, minute_bucket)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_ai_client_daily_usage (
        client_key text NOT NULL,
        usage_date date NOT NULL,
        request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (client_key, usage_date)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_geoapify_daily_usage (
        usage_date date PRIMARY KEY,
        credit_count integer NOT NULL DEFAULT 0 CHECK (credit_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_geoapify_client_daily_usage (
        client_key text NOT NULL,
        usage_date date NOT NULL,
        credit_count integer NOT NULL DEFAULT 0 CHECK (credit_count >= 0),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (client_key, usage_date)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tripfinder_geoapify_request_gate (
        gate_key text PRIMARY KEY,
        next_allowed_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
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

/** Ensure the persistent cache and shared request-limit tables exist. Safe to call on startup/health checks. */
export async function initializeTravelDatabase(): Promise<void> {
  await ensureTravelTables();
  const sql = getSql();
  const rows = await sql`SELECT
    to_regclass('public.tripfinder_provider_cache') IS NOT NULL AS cache_ready,
    to_regclass('public.tripfinder_provider_usage') IS NOT NULL AS monthly_usage_ready,
    to_regclass('public.tripfinder_provider_hourly_usage') IS NOT NULL AS hourly_usage_ready,
    to_regclass('public.tripfinder_client_usage') IS NOT NULL AS client_usage_ready,
    to_regclass('public.tripfinder_api_event_log') IS NOT NULL AS event_log_ready,
    to_regclass('public.tripfinder_admin_login_attempts') IS NOT NULL AS admin_auth_ready,
    to_regclass('public.tripfinder_ai_provider_daily_usage') IS NOT NULL AS ai_provider_daily_ready,
    to_regclass('public.tripfinder_ai_provider_minute_usage') IS NOT NULL AS ai_provider_minute_ready,
    to_regclass('public.tripfinder_ai_client_daily_usage') IS NOT NULL AS ai_client_daily_ready,
    to_regclass('public.tripfinder_geoapify_daily_usage') IS NOT NULL AS geoapify_daily_ready,
    to_regclass('public.tripfinder_geoapify_client_daily_usage') IS NOT NULL AS geoapify_client_daily_ready,
    to_regclass('public.tripfinder_geoapify_request_gate') IS NOT NULL AS geoapify_gate_ready,
    to_regclass('public.tripfinder_saved_trips') IS NOT NULL AS saved_trips_ready,
    to_regclass('public.tripfinder_saved_trip_daily_usage') IS NOT NULL AS saved_trip_usage_ready`;
  const row = rows[0] as unknown as Record<string, boolean> | undefined;
  if (!row || !row.cache_ready || !row.monthly_usage_ready || !row.hourly_usage_ready || !row.client_usage_ready || !row.event_log_ready || !row.admin_auth_ready || !row.ai_provider_daily_ready || !row.ai_provider_minute_ready || !row.ai_client_daily_ready || !row.geoapify_daily_ready || !row.geoapify_client_daily_ready || !row.geoapify_gate_ready || !row.saved_trips_ready || !row.saved_trip_usage_ready) {
    throw new Error("DATABASE_SCHEMA_UNAVAILABLE");
  }
}

export function providerCacheKey(params: Record<string, string>): string {
  const stable = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export async function getProviderCache(cacheKey: string): Promise<{ payload: JsonRecord; fetchedAt: string } | null> {
  await ensureTravelTables();
  const sql = getSql();
  const rows = await sql`SELECT payload, created_at::text AS created_at
    FROM tripfinder_provider_cache
    WHERE cache_key = ${cacheKey} AND expires_at > now()
    LIMIT 1`;
  const row = rows[0] as unknown as CacheRow | undefined;
  if (!row) return null;
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) as JsonRecord : row.payload;
  return { payload, fetchedAt: row.created_at };
}

/** Return a recent cache entry even when its TTL has elapsed, for controlled stale fallback. */
export async function getProviderCacheFallback(
  cacheKey: string,
  maxAgeSeconds: number,
): Promise<{ payload: JsonRecord; fetchedAt: string; ageSeconds: number } | null> {
  await ensureTravelTables();
  const sql = getSql();
  const safeMaxAge = Math.max(60, Math.min(604800, Math.floor(maxAgeSeconds)));
  const rows = await sql`SELECT payload, created_at::text AS created_at
    FROM tripfinder_provider_cache
    WHERE cache_key = ${cacheKey}
      AND created_at >= now() - (${safeMaxAge} * interval '1 second')
    ORDER BY created_at DESC
    LIMIT 1`;
  const row = rows[0] as unknown as CacheRow | undefined;
  if (!row) return null;
  const payload = typeof row.payload === "string" ? JSON.parse(row.payload) as JsonRecord : row.payload;
  const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(row.created_at).getTime()) / 1000));
  if (!Number.isFinite(ageSeconds) || ageSeconds > safeMaxAge) return null;
  return { payload, fetchedAt: row.created_at, ageSeconds };
}

export async function setProviderCache(cacheKey: string, payload: JsonRecord, ttlSeconds: number): Promise<void> {
  await ensureTravelTables();
  const sql = getSql();
  const safeTtl = Math.max(60, Math.min(86400, Math.floor(ttlSeconds)));
  await sql`INSERT INTO tripfinder_provider_cache (cache_key, payload, created_at, expires_at)
    VALUES (${cacheKey}, ${JSON.stringify(payload)}::jsonb, now(), now() + (${safeTtl} * interval '1 second'))
    ON CONFLICT (cache_key) DO UPDATE SET
      payload = EXCLUDED.payload,
      created_at = now(),
      expires_at = EXCLUDED.expires_at`;
  // Keep the free database tidy without deleting any still-valid cached data.
  await sql`DELETE FROM tripfinder_provider_cache WHERE expires_at < now() - interval '7 days'`;
  await sql`DELETE FROM tripfinder_client_usage WHERE usage_date < current_date - interval '30 days'`;
  await sql`DELETE FROM tripfinder_provider_hourly_usage WHERE hour_bucket < now() - interval '3 days'`;
}

/**
 * Allocate one shared request slot across all Vercel instances.
 * A 400 ms interval keeps Tripfinder below the Geoapify Free plan's five requests/second limit,
 * even when several visitors search at once. Cache hits do not call this function.
 */
export async function waitForGeoapifyRequestSlot(): Promise<void> {
  await ensureTravelTables();
  const sql = getSql();
  const rows = await sql`INSERT INTO tripfinder_geoapify_request_gate (gate_key, next_allowed_at, updated_at)
    VALUES ('global', now() + interval '400 milliseconds', now())
    ON CONFLICT (gate_key) DO UPDATE SET
      next_allowed_at = GREATEST(tripfinder_geoapify_request_gate.next_allowed_at, now()) + interval '400 milliseconds',
      updated_at = now()
    WHERE GREATEST(tripfinder_geoapify_request_gate.next_allowed_at, now()) + interval '400 milliseconds' <= now() + interval '3 seconds'
    RETURNING (next_allowed_at - interval '400 milliseconds')::text AS slot_at`;
  const slotAt = rows[0] as unknown as { slot_at?: string } | undefined;
  if (!slotAt?.slot_at) throw new Error("GEOAPIFY_REQUEST_RATE_LIMITED");
  const slotMs = new Date(slotAt.slot_at).getTime();
  const delayMs = Math.max(0, slotMs - Date.now());
  if (delayMs > 0) await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

/** Read the exact UTC-day counters used by the Geoapify reservation gate. */
export async function getGeoapifyCreditUsageSnapshot(clientKey = "shared"): Promise<{
  sharedUsed: number;
  sharedCap: number;
  clientUsed: number;
  clientCap: number;
  utcDate: string;
}> {
  await ensureTravelTables();
  const usageDate = new Date().toISOString().slice(0, 10);
  const sql = getSql();
  const rows = await sql`SELECT
    COALESCE((SELECT credit_count FROM tripfinder_geoapify_daily_usage WHERE usage_date = ${usageDate} LIMIT 1), 0)::int AS shared_used,
    COALESCE((SELECT credit_count FROM tripfinder_geoapify_client_daily_usage WHERE client_key = ${clientKey} AND usage_date = ${usageDate} LIMIT 1), 0)::int AS client_used`;
  const row = rows[0] as unknown as { shared_used?: number; client_used?: number } | undefined;
  const caps = resolveGeoapifyCreditCaps({
    dailyCap: process.env.GEOAPIFY_DAILY_CREDIT_CAP,
    clientDailyCap: process.env.GEOAPIFY_CLIENT_DAILY_CREDIT_CAP,
  });
  return {
    sharedUsed: Math.max(0, Number(row?.shared_used ?? 0) || 0),
    sharedCap: caps.dailyCap,
    clientUsed: Math.max(0, Number(row?.client_used ?? 0) || 0),
    clientCap: caps.clientDailyCap,
    utcDate: usageDate,
  };
}

/** Reserve Geoapify credits against Tripfinder's shared and per-visitor UTC-day safety caps.
 *
 * Each counter uses one atomic INSERT .. ON CONFLICT DO UPDATE operation. This
 * handles both first-use rows and existing rows in the same statement, while
 * retaining the conditional cap check under the row lock. The per-visitor
 * reservation is compensated if the shared reservation cannot be completed.
 */
export async function reserveGeoapifyCredits(clientKey = "shared", credits = 1): Promise<number> {
  await ensureTravelTables();
  const safeCredits = Number.isFinite(credits) ? Math.max(1, Math.min(100, Math.ceil(credits))) : 1;
  const { dailyCap: globalCap, clientDailyCap: clientCap } = resolveGeoapifyCreditCaps({
    dailyCap: process.env.GEOAPIFY_DAILY_CREDIT_CAP,
    clientDailyCap: process.env.GEOAPIFY_CLIENT_DAILY_CREDIT_CAP,
  });
  const usageDate = new Date().toISOString().slice(0, 10);
  const sql = getSql();

  if (safeCredits > clientCap) throw new Error("GEOAPIFY_CLIENT_DAILY_CAP_REACHED");
  if (safeCredits > globalCap) throw new Error("GEOAPIFY_DAILY_CAP_REACHED");

  const clientRows = await sql`INSERT INTO tripfinder_geoapify_client_daily_usage
      (client_key, usage_date, credit_count, updated_at)
    VALUES (${clientKey}, ${usageDate}::date, ${safeCredits}, now())
    ON CONFLICT (client_key, usage_date) DO UPDATE
      SET credit_count = tripfinder_geoapify_client_daily_usage.credit_count + EXCLUDED.credit_count,
          updated_at = now()
      WHERE tripfinder_geoapify_client_daily_usage.credit_count + EXCLUDED.credit_count <= ${clientCap}
    RETURNING credit_count`;
  if (!clientRows.length) {
    const currentRows = await sql`SELECT credit_count FROM tripfinder_geoapify_client_daily_usage
      WHERE client_key = ${clientKey} AND usage_date = ${usageDate}::date LIMIT 1`;
    const used = Math.max(0, Number((currentRows[0] as unknown as { credit_count?: number } | undefined)?.credit_count ?? 0) || 0);
    const failure = classifyGeoapifyReservationFailure(used, clientCap, safeCredits);
    if (failure === "cap-reached") throw new Error("GEOAPIFY_CLIENT_DAILY_CAP_REACHED");
    throw new Error("GEOAPIFY_CLIENT_GATE_INCONSISTENT");
  }

  let globalRows: unknown[];
  try {
    globalRows = await sql`INSERT INTO tripfinder_geoapify_daily_usage
        (usage_date, credit_count, updated_at)
      VALUES (${usageDate}::date, ${safeCredits}, now())
      ON CONFLICT (usage_date) DO UPDATE
        SET credit_count = tripfinder_geoapify_daily_usage.credit_count + EXCLUDED.credit_count,
            updated_at = now()
        WHERE tripfinder_geoapify_daily_usage.credit_count + EXCLUDED.credit_count <= ${globalCap}
      RETURNING credit_count`;
  } catch (error) {
    await sql`UPDATE tripfinder_geoapify_client_daily_usage
      SET credit_count = GREATEST(0, credit_count - ${safeCredits}), updated_at = now()
      WHERE client_key = ${clientKey} AND usage_date = ${usageDate}::date`.catch(() => undefined);
    throw error;
  }
  if (!globalRows.length) {
    // Roll back the visitor reservation because the shared allowance did not reserve.
    await sql`UPDATE tripfinder_geoapify_client_daily_usage
      SET credit_count = GREATEST(0, credit_count - ${safeCredits}), updated_at = now()
      WHERE client_key = ${clientKey} AND usage_date = ${usageDate}::date`;
    const currentRows = await sql`SELECT credit_count FROM tripfinder_geoapify_daily_usage
      WHERE usage_date = ${usageDate}::date LIMIT 1`;
    const used = Math.max(0, Number((currentRows[0] as unknown as { credit_count?: number } | undefined)?.credit_count ?? 0) || 0);
    const failure = classifyGeoapifyReservationFailure(used, globalCap, safeCredits);
    if (failure === "cap-reached") throw new Error("GEOAPIFY_DAILY_CAP_REACHED");
    throw new Error("GEOAPIFY_DAILY_GATE_INCONSISTENT");
  }

  await sql`DELETE FROM tripfinder_geoapify_client_daily_usage WHERE usage_date < current_date - interval '30 days'`;
  await sql`DELETE FROM tripfinder_geoapify_daily_usage WHERE usage_date < current_date - interval '30 days'`;
  return Number((globalRows[0] as unknown as { credit_count: number }).credit_count);
}

export async function reserveProviderSearch(clientKey = "shared"): Promise<number> {
  await ensureTravelTables();
  const rawCap = Number(process.env.SERPAPI_MONTHLY_SEARCH_CAP ?? "200");
  // Default to 200 of SerpApi's currently advertised 250 monthly free searches,
  // keeping a reserve for manual diagnostics and provider retries.
  const cap = Number.isInteger(rawCap) ? Math.max(1, Math.min(230, rawCap)) : 200;
  const rawHourlyCap = Number(process.env.SERPAPI_HOURLY_SEARCH_CAP ?? "30");
  // The SerpApi Free plan advertises 50 searches/hour; keep a global buffer.
  const hourlyCap = Number.isInteger(rawHourlyCap) ? Math.max(1, Math.min(45, rawHourlyCap)) : 30;
  const now = new Date();
  const usageDate = now.toISOString().slice(0, 10);
  const hourBucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours())).toISOString();
  const sql = getSql();

  // This counter records individual provider subrequests, not user-facing trip
  // searches. A single combined search may fan out to flights, hotels, rentals,
  // activities and dining in parallel, so the old 15/hour per-client limit could
  // block the final category mid-search. Keep per-client protection no tighter
  // than the shared hourly cap; the global monthly/hourly caps remain authoritative.
  const rawClientDailyCap = Number(process.env.SERPAPI_CLIENT_DAILY_SEARCH_CAP ?? "120");
  const clientDailyCap = Number.isInteger(rawClientDailyCap) ? Math.max(30, Math.min(180, rawClientDailyCap)) : 120;
  const rawClientHourlyCap = Number(process.env.SERPAPI_CLIENT_HOURLY_SEARCH_CAP ?? "30");
  const clientHourlyCap = Number.isInteger(rawClientHourlyCap) ? Math.max(5, Math.min(45, rawClientHourlyCap)) : 30;
  const clientRows = await sql`INSERT INTO tripfinder_client_usage
      (client_key, usage_date, hour_bucket, hour_count, day_count, updated_at)
    VALUES (${clientKey}, ${usageDate}, ${hourBucket}, 1, 1, now())
    ON CONFLICT (client_key, usage_date) DO UPDATE SET
      hour_count = CASE WHEN tripfinder_client_usage.hour_bucket = EXCLUDED.hour_bucket
        THEN tripfinder_client_usage.hour_count + 1 ELSE 1 END,
      hour_bucket = EXCLUDED.hour_bucket,
      day_count = tripfinder_client_usage.day_count + 1,
      updated_at = now()
    WHERE tripfinder_client_usage.day_count < ${clientDailyCap}
      AND CASE WHEN tripfinder_client_usage.hour_bucket = EXCLUDED.hour_bucket
        THEN tripfinder_client_usage.hour_count < ${clientHourlyCap} ELSE true END
    RETURNING hour_count, day_count`;
  if (!clientRows.length) throw new Error("SERPAPI_CLIENT_RATE_LIMITED");

  const hourlyRows = await sql`INSERT INTO tripfinder_provider_hourly_usage (hour_bucket, search_count, updated_at)
    VALUES (${hourBucket}, 1, now())
    ON CONFLICT (hour_bucket) DO UPDATE SET
      search_count = tripfinder_provider_hourly_usage.search_count + 1,
      updated_at = now()
    WHERE tripfinder_provider_hourly_usage.search_count < ${hourlyCap}
    RETURNING search_count`;
  if (!hourlyRows.length) throw new Error("SERPAPI_HOURLY_CAP_REACHED");

  const monthKey = now.toISOString().slice(0, 7);
  const rows = await sql`INSERT INTO tripfinder_provider_usage (month_key, search_count, updated_at)
    VALUES (${monthKey}, 1, now())
    ON CONFLICT (month_key) DO UPDATE SET
      search_count = tripfinder_provider_usage.search_count + 1,
      updated_at = now()
    WHERE tripfinder_provider_usage.search_count < ${cap}
    RETURNING search_count`;
  if (!rows.length) throw new Error("SERPAPI_MONTHLY_CAP_REACHED");
  return Number((rows[0] as unknown as { search_count: number }).search_count);
}

/** Count one visitor question, regardless of whether provider failover is needed. */
export async function reserveAIClientRequest(clientKey: string): Promise<void> {
  await ensureTravelTables();
  const sql = getSql();
  const usageDate = new Date().toISOString().slice(0, 10);
  const rawClientCap = Number(process.env.AI_CLIENT_DAILY_CAP ?? "5");
  const clientDailyCap = Number.isInteger(rawClientCap) ? Math.max(1, Math.min(20, rawClientCap)) : 5;
  const rows = await sql`INSERT INTO tripfinder_ai_client_daily_usage (client_key, usage_date, request_count, updated_at)
    VALUES (${clientKey}, ${usageDate}, 1, now())
    ON CONFLICT (client_key, usage_date) DO UPDATE SET
      request_count = tripfinder_ai_client_daily_usage.request_count + 1,
      updated_at = now()
    WHERE tripfinder_ai_client_daily_usage.request_count < ${clientDailyCap}
    RETURNING request_count`;
  if (!rows.length) throw new Error("AI_CLIENT_DAILY_LIMIT");
}

/** Reserve a bounded AI provider attempt without touching SerpApi travel-search counters. */
export async function reserveAIProviderRequest(provider: "Gemini" | "OpenRouter"): Promise<void> {
  await ensureTravelTables();
  const sql = getSql();
  const now = new Date();
  const usageDate = now.toISOString().slice(0, 10);
  const minuteBucket = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes())).toISOString();
  const providerKey = provider.toLowerCase();
  const envCap = provider === "OpenRouter" ? process.env.AI_OPENROUTER_DAILY_CAP : process.env.AI_GEMINI_DAILY_CAP;
  const defaultDailyCap = provider === "OpenRouter" ? 40 : 30;
  const parsedDailyCap = Number(envCap ?? defaultDailyCap);
  const dailyCap = Number.isInteger(parsedDailyCap) ? Math.max(1, Math.min(provider === "OpenRouter" ? 49 : 200, parsedDailyCap)) : defaultDailyCap;
  const minuteCap = provider === "OpenRouter" ? 15 : 10;

  const dailyRows = await sql`INSERT INTO tripfinder_ai_provider_daily_usage (provider_key, usage_date, request_count, updated_at)
    VALUES (${providerKey}, ${usageDate}, 1, now())
    ON CONFLICT (provider_key, usage_date) DO UPDATE SET
      request_count = tripfinder_ai_provider_daily_usage.request_count + 1,
      updated_at = now()
    WHERE tripfinder_ai_provider_daily_usage.request_count < ${dailyCap}
    RETURNING request_count`;
  if (!dailyRows.length) throw new Error("AI_PROVIDER_DAILY_LIMIT");

  const minuteRows = await sql`INSERT INTO tripfinder_ai_provider_minute_usage (provider_key, minute_bucket, request_count, updated_at)
    VALUES (${providerKey}, ${minuteBucket}, 1, now())
    ON CONFLICT (provider_key, minute_bucket) DO UPDATE SET
      request_count = tripfinder_ai_provider_minute_usage.request_count + 1,
      updated_at = now()
    WHERE tripfinder_ai_provider_minute_usage.request_count < ${minuteCap}
    RETURNING request_count`;
  if (!minuteRows.length) throw new Error("AI_PROVIDER_MINUTE_LIMIT");
}

export async function getProviderUsage(): Promise<{ month: string; used: number; cap: number; remaining: number }> {
  await ensureTravelTables();
  const rawCap = Number(process.env.SERPAPI_MONTHLY_SEARCH_CAP ?? "200");
  const cap = Number.isInteger(rawCap) ? Math.max(1, Math.min(230, rawCap)) : 200;
  const month = new Date().toISOString().slice(0, 7);
  const sql = getSql();
  const rows = await sql`SELECT search_count FROM tripfinder_provider_usage WHERE month_key = ${month} LIMIT 1`;
  const used = rows[0] ? Number((rows[0] as unknown as { search_count: number }).search_count) : 0;
  return { month, used, cap, remaining: Math.max(0, cap - used) };
}

/** Hash a requester's address before persisting it for coarse API abuse control. */
export function hashClientAddress(address: string): string {
  return createHash("sha256").update("tripfinder-client-v1:").update(address.trim().slice(0, 120)).digest("hex");
}


/** Store sanitized provider telemetry. No search text, tokens, API keys or raw IP addresses are persisted. */
export async function recordProviderEvent(event: ProviderEventInput): Promise<void> {
  try {
    await ensureTravelTables();
    const sql = getSql();
    const duration = event.durationMs === undefined || event.durationMs === null
      ? null
      : Math.max(0, Math.min(300000, Math.floor(event.durationMs)));
    const status = event.httpStatus === undefined || event.httpStatus === null
      ? null
      : Math.max(100, Math.min(599, Math.floor(event.httpStatus)));
    const promptTokens = event.promptTokens === undefined || event.promptTokens === null ? null : Math.max(0, Math.min(10000000, Math.floor(event.promptTokens)));
    const completionTokens = event.completionTokens === undefined || event.completionTokens === null ? null : Math.max(0, Math.min(10000000, Math.floor(event.completionTokens)));
    const inserted = await sql`INSERT INTO tripfinder_api_event_log
      (provider, category, event_type, outcome, cache_status, http_status, duration_ms, prompt_tokens, completion_tokens)
      VALUES (
        ${event.provider.slice(0, 40)}, ${event.category.slice(0, 60)},
        ${event.eventType}, ${event.outcome}, ${event.cacheStatus ?? "none"},
        ${status}, ${duration}, ${promptTokens}, ${completionTokens}
      ) RETURNING id`;
    const insertedId = Number((inserted[0] as unknown as { id?: number } | undefined)?.id ?? 0);
    // Keep the event history bounded without running a cleanup query on every request.
    if (insertedId > 0 && insertedId % 250 === 0) {
      await sql`DELETE FROM tripfinder_api_event_log WHERE created_at < now() - interval '90 days'`;
      await sql`DELETE FROM tripfinder_admin_login_attempts WHERE COALESCE(locked_until, window_started_at) < now() - interval '1 day'`;
      await sql`DELETE FROM tripfinder_ai_provider_daily_usage WHERE usage_date < current_date - interval '30 days'`;
      await sql`DELETE FROM tripfinder_ai_provider_minute_usage WHERE minute_bucket < now() - interval '1 day'`;
      await sql`DELETE FROM tripfinder_ai_client_daily_usage WHERE usage_date < current_date - interval '30 days'`;
    }
  } catch (error) {
    // Telemetry is best-effort and must never take down a real provider response.
    console.error("Tripfinder could not write provider telemetry.", error instanceof Error ? error.message : "unknown error");
  }
}

export async function isAdminLoginLocked(clientKey: string): Promise<boolean> {
  await ensureTravelTables();
  const sql = getSql();
  const rows = await sql`SELECT locked_until > now() AS locked
    FROM tripfinder_admin_login_attempts WHERE client_key = ${clientKey} LIMIT 1`;
  return Boolean((rows[0] as unknown as { locked?: boolean } | undefined)?.locked);
}

export async function recordAdminLoginFailure(clientKey: string): Promise<void> {
  await ensureTravelTables();
  const sql = getSql();
  await sql`INSERT INTO tripfinder_admin_login_attempts (client_key, attempts, window_started_at, locked_until)
    VALUES (${clientKey}, 1, now(), NULL)
    ON CONFLICT (client_key) DO UPDATE SET
      attempts = CASE WHEN tripfinder_admin_login_attempts.window_started_at < now() - interval '15 minutes' THEN 1 ELSE tripfinder_admin_login_attempts.attempts + 1 END,
      window_started_at = CASE WHEN tripfinder_admin_login_attempts.window_started_at < now() - interval '15 minutes' THEN now() ELSE tripfinder_admin_login_attempts.window_started_at END,
      locked_until = CASE
        WHEN tripfinder_admin_login_attempts.window_started_at < now() - interval '15 minutes' THEN NULL
        WHEN tripfinder_admin_login_attempts.attempts + 1 >= 5 THEN now() + interval '15 minutes'
        ELSE tripfinder_admin_login_attempts.locked_until END`;
}

export async function clearAdminLoginFailures(clientKey: string): Promise<void> {
  await ensureTravelTables();
  const sql = getSql();
  await sql`DELETE FROM tripfinder_admin_login_attempts WHERE client_key = ${clientKey}`;
}

export type AdminDashboardSnapshot = {
  generatedAt: string;
  appUsage: { month: string; monthlyUsed: number; monthlyCap: number; monthlyRemaining: number; hourlyUsed: number; hourlyCap: number; todayReservedSearches: number };
  periodTotals: { events24h: number; apiCalls24h: number; accountChecks24h: number; cacheHits24h: number; staleCacheHits24h: number; failures24h: number; blocked24h: number; averageProviderMs: number | null; promptTokens24h: number; completionTokens24h: number; totalTokens24h: number };
  providerBreakdown: Array<{ provider: string; category: string; apiCalls: number; accountChecks: number; cacheHits: number; staleCacheHits: number; failures: number; blocked: number; averageMs: number | null; promptTokens: number; completionTokens: number; totalTokens: number }>;
  dailyTrend: Array<{ hour: string; apiCalls: number; cacheHits: number; failures: number }>;
  recentEvents: Array<{ id: number; provider: string; category: string; eventType: string; outcome: string; cacheStatus: string; httpStatus: number | null; durationMs: number | null; promptTokens: number | null; completionTokens: number | null; createdAt: string }>;
  geoapifyUsage: { configured: boolean; usedToday: number; dailyCap: number; remainingToday: number; visitorCreditsToday: number; activeVisitorsToday: number; clientDailyCap: number };
  aiUsage: {
    openRouter: { configured: boolean; usedToday: number; dailyCap: number; remainingToday: number; usedThisMinute: number; minuteCap: number };
    gemini: { configured: boolean; usedToday: number; dailyCap: number; remainingToday: number; usedThisMinute: number; minuteCap: number };
    clientDailyCap: number;
  };
  cache: { totalEntries: number; validEntries: number; expiredEntries: number; lastUpdatedAt: string | null };
  clientUsage: { activeClientsToday: number; reservedSearchesToday: number };
};

/** Read-only operational overview for the authenticated /admin dashboard. */
export async function getAdminDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
  await ensureTravelTables();
  const sql = getSql();
  const rawCap = Number(process.env.SERPAPI_MONTHLY_SEARCH_CAP ?? "200");
  const monthlyCap = Number.isInteger(rawCap) ? Math.max(1, Math.min(230, rawCap)) : 200;
  const rawHourlyCap = Number(process.env.SERPAPI_HOURLY_SEARCH_CAP ?? "30");
  const hourlyCap = Number.isInteger(rawHourlyCap) ? Math.max(1, Math.min(45, rawHourlyCap)) : 30;
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const usageDate = now.toISOString().slice(0, 10);
  const [usageRows, hourlyRows, clientRows, totalsRows, breakdownRows, trendRows, recentRows, cacheRows, aiDailyRows, aiMinuteRows, geoapifyRows] = await Promise.all([
    sql`SELECT search_count FROM tripfinder_provider_usage WHERE month_key = ${month} LIMIT 1`,
    sql`SELECT search_count FROM tripfinder_provider_hourly_usage WHERE hour_bucket = date_trunc('hour', now()) LIMIT 1`,
    sql`SELECT count(*)::int AS active_clients, COALESCE(sum(day_count), 0)::int AS reserved_today
      FROM tripfinder_client_usage WHERE usage_date = current_date`,
    sql`SELECT
        count(*)::int AS events,
        count(*) FILTER (WHERE event_type IN ('provider_request', 'provider_error') AND category <> 'Account quota')::int AS api_calls,
        count(*) FILTER (WHERE category = 'Account quota' AND event_type IN ('account_check', 'provider_error'))::int AS account_checks,
        count(*) FILTER (WHERE event_type = 'cache_hit' AND category <> 'Account quota')::int AS cache_hits,
        count(*) FILTER (WHERE event_type = 'cache_hit' AND cache_status = 'stale' AND category <> 'Account quota')::int AS stale_cache_hits,
        count(*) FILTER (WHERE outcome = 'error')::int AS failures,
        count(*) FILTER (WHERE outcome = 'blocked')::int AS blocked,
        round(avg(duration_ms) FILTER (WHERE event_type IN ('provider_request', 'provider_error') AND category <> 'Account quota'))::int AS avg_ms,
        COALESCE(sum(prompt_tokens), 0)::int AS prompt_tokens,
        COALESCE(sum(completion_tokens), 0)::int AS completion_tokens
      FROM tripfinder_api_event_log WHERE created_at >= now() - interval '24 hours'`,
    sql`SELECT provider, category,
        count(*) FILTER (WHERE event_type IN ('provider_request', 'provider_error') AND category <> 'Account quota')::int AS api_calls,
        count(*) FILTER (WHERE category = 'Account quota' AND event_type IN ('account_check', 'provider_error'))::int AS account_checks,
        count(*) FILTER (WHERE event_type = 'cache_hit' AND category <> 'Account quota')::int AS cache_hits,
        count(*) FILTER (WHERE event_type = 'cache_hit' AND cache_status = 'stale' AND category <> 'Account quota')::int AS stale_cache_hits,
        count(*) FILTER (WHERE outcome = 'error')::int AS failures,
        count(*) FILTER (WHERE outcome = 'blocked')::int AS blocked,
        round(avg(duration_ms) FILTER (WHERE event_type IN ('provider_request', 'provider_error') AND category <> 'Account quota'))::int AS avg_ms,
        COALESCE(sum(prompt_tokens), 0)::int AS prompt_tokens,
        COALESCE(sum(completion_tokens), 0)::int AS completion_tokens
      FROM tripfinder_api_event_log WHERE created_at >= now() - interval '30 days'
      GROUP BY provider, category ORDER BY api_calls DESC, cache_hits DESC LIMIT 24`,
    sql`SELECT to_char(date_trunc('hour', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD"T"HH24:00:00"Z"') AS hour,
        count(*) FILTER (WHERE event_type IN ('provider_request', 'provider_error') AND category <> 'Account quota')::int AS api_calls,
        count(*) FILTER (WHERE event_type = 'cache_hit' AND category <> 'Account quota')::int AS cache_hits,
        count(*) FILTER (WHERE outcome = 'error')::int AS failures
      FROM tripfinder_api_event_log WHERE created_at >= now() - interval '24 hours'
      GROUP BY date_trunc('hour', created_at AT TIME ZONE 'UTC') ORDER BY date_trunc('hour', created_at AT TIME ZONE 'UTC') ASC`,
    sql`SELECT id, provider, category, event_type, outcome, cache_status, http_status, duration_ms, prompt_tokens, completion_tokens, created_at::text AS created_at
      FROM tripfinder_api_event_log ORDER BY created_at DESC LIMIT 60`,
    sql`SELECT count(*)::int AS total_entries,
        count(*) FILTER (WHERE expires_at > now())::int AS valid_entries,
        count(*) FILTER (WHERE expires_at <= now())::int AS expired_entries,
        max(created_at)::text AS last_updated_at
      FROM tripfinder_provider_cache`,
    sql`SELECT provider_key, request_count FROM tripfinder_ai_provider_daily_usage WHERE usage_date = ${now.toISOString().slice(0, 10)}`,
    sql`SELECT provider_key, request_count FROM tripfinder_ai_provider_minute_usage WHERE minute_bucket = ${new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes())).toISOString()}`,
    sql`SELECT
        COALESCE((SELECT credit_count FROM tripfinder_geoapify_daily_usage WHERE usage_date = ${usageDate} LIMIT 1), 0)::int AS shared_credits,
        COALESCE((SELECT sum(credit_count) FROM tripfinder_geoapify_client_daily_usage WHERE usage_date = ${usageDate}), 0)::int AS visitor_credits,
        (SELECT count(*) FROM tripfinder_geoapify_client_daily_usage WHERE usage_date = ${usageDate} AND credit_count > 0)::int AS active_visitors`,
  ]);
  const usage = usageRows[0] as unknown as { search_count?: number } | undefined;
  const hourly = hourlyRows[0] as unknown as { search_count?: number } | undefined;
  const clients = clientRows[0] as unknown as { active_clients?: number; reserved_today?: number } | undefined;
  const totals = totalsRows[0] as unknown as Record<string, number | null> | undefined;
  const cache = cacheRows[0] as unknown as Record<string, number | string | null> | undefined;
  const asNumber = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const aiDaily = aiDailyRows as unknown as Array<{ provider_key: string; request_count: number }>;
  const aiMinute = aiMinuteRows as unknown as Array<{ provider_key: string; request_count: number }>;
  const geoapifyRow = geoapifyRows[0] as unknown as Record<string, number | null> | undefined;
  const { dailyCap: geoapifyDailyCap, clientDailyCap: geoapifyClientDailyCap } = resolveGeoapifyCreditCaps({
    dailyCap: process.env.GEOAPIFY_DAILY_CREDIT_CAP,
    clientDailyCap: process.env.GEOAPIFY_CLIENT_DAILY_CREDIT_CAP,
  });
  const geoapifyUsed = asNumber(geoapifyRow?.shared_credits);
  const aiUsed = (rows: Array<{ provider_key: string; request_count: number }>, key: string) => asNumber(rows.find((row) => row.provider_key === key)?.request_count);
  const openRouterCapRaw = Number(process.env.AI_OPENROUTER_DAILY_CAP ?? "40");
  const openRouterCap = Number.isInteger(openRouterCapRaw) ? Math.max(1, Math.min(49, openRouterCapRaw)) : 40;
  const geminiCapRaw = Number(process.env.AI_GEMINI_DAILY_CAP ?? "30");
  const geminiCap = Number.isInteger(geminiCapRaw) ? Math.max(1, Math.min(200, geminiCapRaw)) : 30;
  const clientCapRaw = Number(process.env.AI_CLIENT_DAILY_CAP ?? "5");
  const aiClientCap = Number.isInteger(clientCapRaw) ? Math.max(1, Math.min(20, clientCapRaw)) : 5;
  return {
    generatedAt: new Date().toISOString(),
    appUsage: {
      month,
      monthlyUsed: asNumber(usage?.search_count),
      monthlyCap,
      monthlyRemaining: Math.max(0, monthlyCap - asNumber(usage?.search_count)),
      hourlyUsed: asNumber(hourly?.search_count),
      hourlyCap,
      todayReservedSearches: asNumber(clients?.reserved_today),
    },
    periodTotals: {
      events24h: asNumber(totals?.events),
      apiCalls24h: asNumber(totals?.api_calls),
      accountChecks24h: asNumber(totals?.account_checks),
      cacheHits24h: asNumber(totals?.cache_hits),
      staleCacheHits24h: asNumber(totals?.stale_cache_hits),
      failures24h: asNumber(totals?.failures),
      blocked24h: asNumber(totals?.blocked),
      averageProviderMs: totals?.avg_ms === null || totals?.avg_ms === undefined ? null : asNumber(totals.avg_ms),
      promptTokens24h: asNumber(totals?.prompt_tokens),
      completionTokens24h: asNumber(totals?.completion_tokens),
      totalTokens24h: asNumber(totals?.prompt_tokens) + asNumber(totals?.completion_tokens),
    },
    providerBreakdown: (breakdownRows as unknown as Array<Record<string, unknown>>).map((row) => ({
      provider: String(row.provider), category: String(row.category), apiCalls: asNumber(row.api_calls),
      accountChecks: asNumber(row.account_checks), cacheHits: asNumber(row.cache_hits), staleCacheHits: asNumber(row.stale_cache_hits), failures: asNumber(row.failures), blocked: asNumber(row.blocked), averageMs: row.avg_ms === null ? null : asNumber(row.avg_ms),
      promptTokens: asNumber(row.prompt_tokens), completionTokens: asNumber(row.completion_tokens), totalTokens: asNumber(row.prompt_tokens) + asNumber(row.completion_tokens),
    })),
    dailyTrend: (trendRows as unknown as Array<Record<string, unknown>>).map((row) => ({
      hour: String(row.hour), apiCalls: asNumber(row.api_calls), cacheHits: asNumber(row.cache_hits), failures: asNumber(row.failures),
    })),
    recentEvents: (recentRows as unknown as Array<Record<string, unknown>>).map((row) => ({
      id: asNumber(row.id), provider: String(row.provider), category: String(row.category),
      eventType: String(row.event_type), outcome: String(row.outcome), cacheStatus: String(row.cache_status),
      httpStatus: row.http_status === null ? null : asNumber(row.http_status),
      durationMs: row.duration_ms === null ? null : asNumber(row.duration_ms),
      promptTokens: row.prompt_tokens === null ? null : asNumber(row.prompt_tokens),
      completionTokens: row.completion_tokens === null ? null : asNumber(row.completion_tokens),
      createdAt: String(row.created_at),
    })),
    geoapifyUsage: {
      configured: Boolean(process.env.GEOAPIFY_API_KEY?.trim()),
      usedToday: geoapifyUsed,
      dailyCap: geoapifyDailyCap,
      remainingToday: Math.max(0, geoapifyDailyCap - geoapifyUsed),
      visitorCreditsToday: asNumber(geoapifyRow?.visitor_credits),
      activeVisitorsToday: asNumber(geoapifyRow?.active_visitors),
      clientDailyCap: geoapifyClientDailyCap,
    },
    aiUsage: {
      openRouter: { configured: Boolean(process.env.OPENROUTER_API_KEY?.trim()), usedToday: aiUsed(aiDaily, "openrouter"), dailyCap: openRouterCap, remainingToday: Math.max(0, openRouterCap - aiUsed(aiDaily, "openrouter")), usedThisMinute: aiUsed(aiMinute, "openrouter"), minuteCap: 15 },
      gemini: { configured: Boolean(process.env.GEMINI_API_KEY?.trim()), usedToday: aiUsed(aiDaily, "gemini"), dailyCap: geminiCap, remainingToday: Math.max(0, geminiCap - aiUsed(aiDaily, "gemini")), usedThisMinute: aiUsed(aiMinute, "gemini"), minuteCap: 10 },
      clientDailyCap: aiClientCap,
    },
    cache: {
      totalEntries: asNumber(cache?.total_entries), validEntries: asNumber(cache?.valid_entries),
      expiredEntries: asNumber(cache?.expired_entries), lastUpdatedAt: cache?.last_updated_at ? String(cache.last_updated_at) : null,
    },
    clientUsage: { activeClientsToday: asNumber(clients?.active_clients), reservedSearchesToday: asNumber(clients?.reserved_today) },
  };
}
