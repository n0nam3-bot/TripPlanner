import { NextResponse } from "next/server";
import { initializeTravelDatabase } from "@/lib/db/travel-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providerKeyConfigured = Boolean(process.env.SERPAPI_API_KEY);
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const configuredCap = Number(process.env.SERPAPI_MONTHLY_SEARCH_CAP ?? "200");
  const monthlyCap = Number.isInteger(configuredCap) ? Math.max(1, Math.min(230, configuredCap)) : 200;
  const configuredHourlyCap = Number(process.env.SERPAPI_HOURLY_SEARCH_CAP ?? "30");
  const hourlyCap = Number.isInteger(configuredHourlyCap) ? Math.max(1, Math.min(45, configuredHourlyCap)) : 30;
  const configuredReserve = Number(process.env.SERPAPI_PROVIDER_QUOTA_RESERVE ?? "75");
  const providerQuotaReserve = Number.isInteger(configuredReserve) ? Math.max(10, Math.min(200, configuredReserve)) : 75;
  const configuredProviderHourlyReserve = Number(process.env.SERPAPI_PROVIDER_HOURLY_RESERVE ?? "10");
  const providerHourlyReserve = Number.isInteger(configuredProviderHourlyReserve) ? Math.max(1, Math.min(45, configuredProviderHourlyReserve)) : 10;

  let databaseConnected = false;
  let databaseSchemaReady = false;
  let databaseError: string | null = null;

  if (databaseConfigured) {
    try {
      // This creates the cache, usage, telemetry and admin-auth tables when absent, then verifies them.
      await initializeTravelDatabase();
      databaseConnected = true;
      databaseSchemaReady = true;
    } catch (error) {
      databaseError = error instanceof Error && error.message === "DATABASE_SCHEMA_UNAVAILABLE"
        ? "DATABASE_SCHEMA_UNAVAILABLE"
        : "DATABASE_CONNECTION_OR_SCHEMA_ERROR";
      console.error("Tripfinder health check could not initialize the Neon database.", databaseError);
    }
  }

  const liveSearchReadyToTest = providerKeyConfigured && databaseConnected && databaseSchemaReady;
  return NextResponse.json({
    status: liveSearchReadyToTest ? "ok" : databaseConfigured && !databaseConnected ? "degraded" : "ok",
    app: "tripfinder",
    mode: liveSearchReadyToTest ? "live_search_ready_to_test" : "planning_only_or_setup_incomplete",
    providerKeyConfigured,
    providerCredentialValidation: "validated on the first uncached live search through the provider account endpoint",
    databaseConfigured,
    databaseConnected,
    databaseSchemaReady,
    databaseError,
    databaseTables: databaseSchemaReady ? [
      "tripfinder_provider_cache",
      "tripfinder_provider_usage",
      "tripfinder_provider_hourly_usage",
      "tripfinder_client_usage",
      "tripfinder_api_event_log",
      "tripfinder_admin_login_attempts",
    ] : [],
    persistentProviderCacheConfigured: databaseSchemaReady,
    monthlyProviderSearchSafetyCap: monthlyCap,
    hourlyProviderSearchSafetyCap: hourlyCap,
    providerAccountSearchReserve: providerQuotaReserve,
    providerAccountHourlyReserve: providerHourlyReserve,
    providerQuotaCheckedBeforeUncachedSearches: liveSearchReadyToTest,
    perClientLimits: { uncachedRequestsPerHour: 15, uncachedRequestsPerDay: 45 },
    affiliateTrackingEnabled: false,
    timestamp: new Date().toISOString(),
    adminDashboardConfigured: Boolean(process.env.ADMIN_DASHBOARD_SECRET && process.env.ADMIN_DASHBOARD_SECRET.length >= 32),
    note: "Opening this endpoint initializes and verifies Tripfinder's Neon cache, usage, telemetry and admin-auth tables. SerpApi credentials are validated on the first uncached live search; no flight or hotel search is performed by this health check.",
  }, { headers: { "Cache-Control": "no-store" } });
}
