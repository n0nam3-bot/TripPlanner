import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const providerKeyConfigured = Boolean(process.env.SERPAPI_API_KEY);
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const liveSearchConfigured = providerKeyConfigured && databaseConfigured;
  const configuredCap = Number(process.env.SERPAPI_MONTHLY_SEARCH_CAP ?? "200");
  const monthlyCap = Number.isInteger(configuredCap) ? Math.max(1, Math.min(230, configuredCap)) : 200;
  const configuredHourlyCap = Number(process.env.SERPAPI_HOURLY_SEARCH_CAP ?? "30");
  const hourlyCap = Number.isInteger(configuredHourlyCap) ? Math.max(1, Math.min(45, configuredHourlyCap)) : 30;
  const configuredReserve = Number(process.env.SERPAPI_PROVIDER_QUOTA_RESERVE ?? "75");
  const providerQuotaReserve = Number.isInteger(configuredReserve) ? Math.max(10, Math.min(200, configuredReserve)) : 75;
  const configuredProviderHourlyReserve = Number(process.env.SERPAPI_PROVIDER_HOURLY_RESERVE ?? "10");
  const providerHourlyReserve = Number.isInteger(configuredProviderHourlyReserve) ? Math.max(1, Math.min(45, configuredProviderHourlyReserve)) : 10;
  return NextResponse.json({
    status: "ok",
    app: "tripfinder",
    mode: liveSearchConfigured ? "live_search_configured" : "planning_only",
    providerKeyConfigured,
    databaseConfigured,
    persistentProviderCacheConfigured: liveSearchConfigured,
    monthlyProviderSearchSafetyCap: monthlyCap,
    hourlyProviderSearchSafetyCap: hourlyCap,
    providerAccountSearchReserve: providerQuotaReserve,
    providerAccountHourlyReserve: providerHourlyReserve,
    providerQuotaCheckedBeforeUncachedSearches: liveSearchConfigured,
    perClientLimits: { uncachedRequestsPerHour: 15, uncachedRequestsPerDay: 45 },
    affiliateTrackingEnabled: false,
    timestamp: new Date().toISOString(),
    note: "Configuration presence is checked here; live provider credentials and database connectivity are validated when a travel search is made.",
  });
}
