import { NextRequest, NextResponse } from "next/server";
import { hasValidAdminSession } from "@/lib/admin/auth";
import { getAdminDashboardSnapshot, getProviderCache, providerCacheKey, recordProviderEvent, setProviderCache } from "@/lib/db/travel-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSerpApiAccountSummary() {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return { configured: false, connected: false, remaining: null, monthlyLimit: null, renewalDate: null, hourlyUsed: null, hourlyLimit: null, error: "SERPAPI_API_KEY is not configured." };
  const cacheKey = providerCacheKey({ internal: "serpapi-account-quota-v1" });
  try {
    const cached = await getProviderCache(cacheKey);
    const cachedPayload = cached?.payload;
    if (cachedPayload && typeof cachedPayload.remaining === "number") {
      await recordProviderEvent({ provider: "SerpApi", category: "Account quota", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
      return {
        configured: true,
        connected: true,
        remaining: cachedPayload.remaining,
        monthlyLimit: typeof cachedPayload.monthlyLimit === "number" ? cachedPayload.monthlyLimit : null,
        renewalDate: typeof cachedPayload.renewalDate === "string" ? cachedPayload.renewalDate : null,
        hourlyUsed: typeof cachedPayload.hourlyUsed === "number" ? cachedPayload.hourlyUsed : null,
        hourlyLimit: typeof cachedPayload.hourlyLimit === "number" ? cachedPayload.hourlyLimit : null,
        error: null,
      };
    }
  } catch {
    // The main metrics query below will report the database availability problem.
  }
  const startedAt = Date.now();
  let httpStatus: number | null = null;
  try {
    const url = new URL("https://serpapi.com/account.json");
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString(), { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    httpStatus = response.status;
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || data.error) throw new Error("SerpApi account endpoint rejected the request.");
    const asNumber = (value: unknown): number | null => {
      const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
      return Number.isFinite(parsed) ? parsed : null;
    };
    const monthlyLimit = asNumber(data.searches_per_month);
    const remaining = asNumber(data.plan_searches_left) ?? asNumber(data.total_searches_left);
    const hourlyLimit = asNumber(data.account_rate_limit_per_hour);
    const hourlyUsed = asNumber(data.this_hour_searches);
    const renewalDate = typeof data.plan_renewal_date === "string" ? data.plan_renewal_date : null;
    const hourlyRemaining = hourlyLimit !== null && hourlyUsed !== null ? Math.max(0, hourlyLimit - hourlyUsed) : null;
    const summary = { configured: true, connected: true, remaining, monthlyLimit, renewalDate, hourlyUsed, hourlyLimit, error: null };
    await setProviderCache(cacheKey, { remaining, monthlyLimit, renewalDate, hourlyRemaining, hourlyLimit, hourlyUsed }, 60);
    await recordProviderEvent({ provider: "SerpApi", category: "Account quota", eventType: "account_check", outcome: "success", cacheStatus: "miss", httpStatus, durationMs: Date.now() - startedAt });
    return summary;
  } catch {
    await recordProviderEvent({ provider: "SerpApi", category: "Account quota", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus, durationMs: Date.now() - startedAt });
    return { configured: true, connected: false, remaining: null, monthlyLimit: null, renewalDate: null, hourlyUsed: null, hourlyLimit: null, error: "Could not read the SerpApi account status. Existing Tripfinder request logs are still available." };
  }
}

export async function GET(request: NextRequest) {
  if (!hasValidAdminSession(request)) return NextResponse.json({ error: "Admin authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const [snapshot, serpApiAccount] = await Promise.all([getAdminDashboardSnapshot(), getSerpApiAccountSummary()]);
    const warnings: string[] = [];
    if (!serpApiAccount.configured) warnings.push("SerpApi is not configured.");
    if (serpApiAccount.configured && !serpApiAccount.connected) warnings.push("The SerpApi account endpoint could not be reached.");
    const configuredReserve = Number(process.env.SERPAPI_PROVIDER_QUOTA_RESERVE ?? "75");
    const quotaReserve = Number.isInteger(configuredReserve) ? Math.max(10, Math.min(200, configuredReserve)) : 75;
    if (serpApiAccount.remaining !== null && serpApiAccount.remaining <= quotaReserve) warnings.push(`SerpApi has ${quotaReserve} or fewer searches remaining. Tripfinder may pause new searches to protect the reserve.`);
    if (snapshot.appUsage.monthlyRemaining <= 20) warnings.push("Tripfinder is within 20 searches of its app-level monthly safety cap.");
    if (snapshot.periodTotals.failures24h > 0) warnings.push(`${snapshot.periodTotals.failures24h} provider error(s) were recorded in the last 24 hours.`);
    return NextResponse.json({ ...snapshot, serpApiAccount, warnings }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The admin dashboard could not load its Neon usage data. Check DATABASE_URL and the database connection." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
