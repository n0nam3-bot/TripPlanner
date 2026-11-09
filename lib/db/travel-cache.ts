import { neon } from "@neondatabase/serverless";
import { createHash } from "node:crypto";

type JsonRecord = Record<string, unknown>;
type CacheRow = { payload: JsonRecord | string; created_at: string };

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
    to_regclass('public.tripfinder_client_usage') IS NOT NULL AS client_usage_ready`;
  const row = rows[0] as unknown as Record<string, boolean> | undefined;
  if (!row || !row.cache_ready || !row.monthly_usage_ready || !row.hourly_usage_ready || !row.client_usage_ready) {
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

  // Per-client guard runs first so a rate-limited browser does not consume the
  // global monthly provider budget. Stored identifiers are hashed, not IPs.
  const clientRows = await sql`INSERT INTO tripfinder_client_usage
      (client_key, usage_date, hour_bucket, hour_count, day_count, updated_at)
    VALUES (${clientKey}, ${usageDate}, ${hourBucket}, 1, 1, now())
    ON CONFLICT (client_key, usage_date) DO UPDATE SET
      hour_count = CASE WHEN tripfinder_client_usage.hour_bucket = EXCLUDED.hour_bucket
        THEN tripfinder_client_usage.hour_count + 1 ELSE 1 END,
      hour_bucket = EXCLUDED.hour_bucket,
      day_count = tripfinder_client_usage.day_count + 1,
      updated_at = now()
    WHERE tripfinder_client_usage.day_count < 45
      AND CASE WHEN tripfinder_client_usage.hour_bucket = EXCLUDED.hour_bucket
        THEN tripfinder_client_usage.hour_count < 15 ELSE true END
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
