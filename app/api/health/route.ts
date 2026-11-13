import { NextResponse } from "next/server";
import { initializeTravelDatabase } from "@/lib/db/travel-cache";
import { resolveGeoapifyCreditCaps } from "@/lib/trip-planner/geoapify-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providerKeyConfigured = Boolean(process.env.SERPAPI_API_KEY);
  const geoapifyKeyConfigured = Boolean(process.env.GEOAPIFY_API_KEY?.trim());
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const bookingComConfigured = Boolean(
    process.env.BOOKING_COM_API_TOKEN?.trim() && /^\d+$/.test(process.env.BOOKING_COM_AFFILIATE_ID?.trim() || ""),
  );
  const bookingComApiBase = (process.env.BOOKING_COM_API_BASE?.trim() || "https://demandapi.booking.com/3.3").replace(/\/+$/, "");
  const bookingComEndpoint = bookingComApiBase === "https://demandapi.booking.com/3.3" ? "production" : bookingComApiBase === "https://demandapi-sandbox.booking.com/3.3" ? "sandbox" : "invalid";
  const configuredCap = Number(process.env.SERPAPI_MONTHLY_SEARCH_CAP ?? "200");
  const monthlyCap = Number.isInteger(configuredCap) ? Math.max(1, Math.min(230, configuredCap)) : 200;
  const configuredHourlyCap = Number(process.env.SERPAPI_HOURLY_SEARCH_CAP ?? "30");
  const hourlyCap = Number.isInteger(configuredHourlyCap) ? Math.max(1, Math.min(45, configuredHourlyCap)) : 30;
  const configuredReserve = Number(process.env.SERPAPI_PROVIDER_QUOTA_RESERVE ?? "75");
  const providerQuotaReserve = Number.isInteger(configuredReserve) ? Math.max(10, Math.min(200, configuredReserve)) : 75;
  const configuredProviderHourlyReserve = Number(process.env.SERPAPI_PROVIDER_HOURLY_RESERVE ?? "10");
  const providerHourlyReserve = Number.isInteger(configuredProviderHourlyReserve) ? Math.max(1, Math.min(45, configuredProviderHourlyReserve)) : 10;
  const configuredClientHourlyCap = Number(process.env.SERPAPI_CLIENT_HOURLY_SEARCH_CAP ?? "30");
  const clientHourlyCap = Number.isInteger(configuredClientHourlyCap) ? Math.max(5, Math.min(45, configuredClientHourlyCap)) : 30;
  const configuredClientDailyCap = Number(process.env.SERPAPI_CLIENT_DAILY_SEARCH_CAP ?? "120");
  const clientDailyCap = Number.isInteger(configuredClientDailyCap) ? Math.max(30, Math.min(180, configuredClientDailyCap)) : 120;
  const geoapifyCaps = resolveGeoapifyCreditCaps({
    dailyCap: process.env.GEOAPIFY_DAILY_CREDIT_CAP,
    clientDailyCap: process.env.GEOAPIFY_CLIENT_DAILY_CREDIT_CAP,
  });

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
  const aiProviders = {
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    openRouterModel: process.env.OPENROUTER_MODEL?.trim() || "openrouter/free",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash",
    geminiRequiresVisitorOptIn: true,
    providerUsageTrackedInAdmin: true,
  };
  return NextResponse.json({
    status: liveSearchReadyToTest ? "ok" : databaseConfigured && !databaseConnected ? "degraded" : "ok",
    app: "tripfinder",
    mode: liveSearchReadyToTest ? "live_search_ready_to_test" : "planning_only_or_setup_incomplete",
    providerKeyConfigured,
    geoapifyKeyConfigured,
    geoapifyDailyCreditSafetyCap: geoapifyCaps.dailyCap,
    geoapifyClientDailyCreditCap: geoapifyCaps.clientDailyCap,
    geoapifySharedRequestGateEnabled: databaseSchemaReady,
    geoapifyCreditUsageTrackedInNeon: databaseSchemaReady,
    bookingComConfigured,
    bookingComEndpoint,
    aiProviders,
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
      "tripfinder_ai_provider_daily_usage",
      "tripfinder_ai_provider_minute_usage",
      "tripfinder_ai_client_daily_usage",
      "tripfinder_geoapify_daily_usage",
      "tripfinder_geoapify_client_daily_usage",
      "tripfinder_geoapify_request_gate",
      "tripfinder_saved_trips",
      "tripfinder_saved_trip_daily_usage",
      "tripfinder_saved_trip_ip_daily_usage",
    ] : [],
    persistentProviderCacheConfigured: databaseSchemaReady,
    monthlyProviderSearchSafetyCap: monthlyCap,
    hourlyProviderSearchSafetyCap: hourlyCap,
    providerAccountSearchReserve: providerQuotaReserve,
    providerAccountHourlyReserve: providerHourlyReserve,
    providerQuotaCheckedBeforeUncachedSearches: liveSearchReadyToTest,
    perClientLimits: { uncachedRequestsPerHour: clientHourlyCap, uncachedRequestsPerDay: clientDailyCap },
    affiliateTrackingEnabled: false,
    timestamp: new Date().toISOString(),
    adminDashboardConfigured: Boolean(process.env.ADMIN_DASHBOARD_SECRET && process.env.ADMIN_DASHBOARD_SECRET.length >= 32),
    note: "Opening this endpoint initializes and verifies Tripfinder's Neon cache, usage, telemetry and admin-auth tables. SerpApi and Geoapify credentials are used only by their relevant provider actions; Geoapify uncached calls are shared-rate-limited and no flight, hotel, places or directions search is performed by this health check.",
  }, { headers: { "Cache-Control": "no-store" } });
}
