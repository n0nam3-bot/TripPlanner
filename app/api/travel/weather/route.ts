import { NextResponse } from "next/server";
import { getProviderCache, getProviderCacheFallback, providerCacheKey, recordProviderEvent, setProviderCache } from "@/lib/db/travel-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WeatherSource = "WeatherAPI" | "Visual Crossing";
type WeatherDay = {
  date: string;
  condition: string;
  icon: string;
  highC: number | null;
  lowC: number | null;
  highF: number | null;
  lowF: number | null;
  rainChance: number | null;
  maxWindKph: number | null;
  uv: number | null;
  source: WeatherSource;
  basis: "forecast" | "seasonal";
};
type WeatherAttribution = { label: string; url: string };
type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const asNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const asString = (value: unknown): string => typeof value === "string" ? value : "";
const WEATHERAPI_ATTRIBUTION: WeatherAttribution = { label: "Weather data by WeatherAPI.com", url: "https://www.weatherapi.com/" };
const VISUAL_CROSSING_ATTRIBUTION: WeatherAttribution = { label: "Weather data provided by Visual Crossing Weather", url: "https://www.visualcrossing.com/" };

function utcDayOffset(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((target - today) / 86400000);
}

function addUtcDays(date: string, offset: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function normalizeWeatherApiDay(raw: unknown, requestedDate: string): WeatherDay | null {
  const item = asObject(raw);
  const day = asObject(item.day);
  const condition = asObject(day.condition);
  if (!Object.keys(day).length) return null;
  return {
    date: asString(item.date) || requestedDate,
    condition: asString(condition.text) || "Conditions unavailable",
    icon: asString(condition.icon),
    highC: asNumber(day.maxtemp_c),
    lowC: asNumber(day.mintemp_c),
    highF: asNumber(day.maxtemp_f),
    lowF: asNumber(day.mintemp_f),
    rainChance: asNumber(day.daily_chance_of_rain),
    maxWindKph: asNumber(day.maxwind_kph),
    uv: asNumber(day.uv),
    source: "WeatherAPI",
    basis: "forecast",
  };
}

function normalizeVisualCrossingDay(raw: unknown, requestedDate: string): WeatherDay | null {
  const item = asObject(raw);
  if (!Object.keys(item).length) return null;
  const highF = asNumber(item.tempmax);
  const lowF = asNumber(item.tempmin);
  const toCelsius = (fahrenheit: number | null) => fahrenheit === null ? null : Math.round(((fahrenheit - 32) * 5 / 9) * 10) / 10;
  const windMph = asNumber(item.windspeed);
  return {
    date: asString(item.datetime) || requestedDate,
    condition: asString(item.conditions) || asString(item.description) || "Conditions unavailable",
    // Visual Crossing icon names are not image URLs; the UI deliberately uses
    // text/fallback iconography instead of building an invalid remote image URL.
    icon: "",
    highC: toCelsius(highF),
    lowC: toCelsius(lowF),
    highF,
    lowF,
    rainChance: asNumber(item.precipprob),
    maxWindKph: windMph === null ? null : Math.round(windMph * 1.609344 * 10) / 10,
    uv: asNumber(item.uvindex),
    source: "Visual Crossing",
    // Visual Crossing provides model forecasts through 15 days. Beyond that,
    // its Timeline service returns a statistical outlook from historical patterns.
    basis: utcDayOffset(asString(item.datetime) || requestedDate) <= 15 ? "forecast" : "seasonal",
  };
}

function weatherApiError(payload: JsonObject): { code: number; message: string } | null {
  const error = asObject(payload.error);
  return typeof error.code === "number" ? { code: error.code, message: asString(error.message) } : null;
}

async function readCachedDay(provider: "weatherapi-v2" | "visualcrossing-v1", location: string, date: string, endpoint: string, forceRefresh: boolean): Promise<WeatherDay | null> {
  if (forceRefresh) return null;
  const key = providerCacheKey({ provider, location: location.toLocaleLowerCase("en-US"), date, endpoint });
  try {
    const cached = await getProviderCache(key);
    const value = cached?.payload.normalizedDay;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const day = value as unknown as WeatherDay;
    return day.date === date && typeof day.condition === "string" ? day : null;
  } catch {
    // Weather cache is an optimization, not a dependency. Keep the provider
    // fallback usable if Neon is temporarily unavailable.
    return null;
  }
}

async function writeCachedDay(provider: "weatherapi-v2" | "visualcrossing-v1", location: string, day: WeatherDay, endpoint: string, ttlSeconds: number): Promise<void> {
  const key = providerCacheKey({ provider, location: location.toLocaleLowerCase("en-US"), date: day.date, endpoint });
  try {
    await setProviderCache(key, { normalizedDay: day as unknown as JsonObject }, ttlSeconds);
  } catch {
    // Cache writes are best-effort. A successful provider response must remain visible.
  }
}

async function fetchWeatherApiDay(location: string, date: string, key: string): Promise<{ day: WeatherDay | null; failure?: string }> {
  const offset = utcDayOffset(date);
  if (offset > 300) return { day: null, failure: "WeatherAPI's configured plan does not cover this date." };
  const endpoint = offset <= 14 ? "forecast.json" : "future.json";
  const url = new URL(`https://api.weatherapi.com/v1/${endpoint}`);
  url.searchParams.set("key", key);
  url.searchParams.set("q", location);
  url.searchParams.set("dt", date);
  if (endpoint === "forecast.json") url.searchParams.set("days", "1");
  url.searchParams.set("aqi", "no");
  url.searchParams.set("alerts", "no");
  const startedAt = Date.now();
  try {
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const text = await response.text();
    let payload: JsonObject;
    try { payload = asObject(JSON.parse(text)); } catch {
      await recordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      return { day: null, failure: "WeatherAPI returned an unreadable response." };
    }
    const providerError = weatherApiError(payload);
    if (!response.ok || providerError) {
      await recordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      return { day: null, failure: providerError?.message || `WeatherAPI returned HTTP ${response.status}.` };
    }
    const forecast = asObject(payload.forecast);
    const forecastDays = Array.isArray(forecast.forecastday) ? forecast.forecastday : [];
    const normalized = normalizeWeatherApiDay(forecastDays[0], date);
    await recordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "provider_request", outcome: normalized ? "success" : "empty", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
    return { day: normalized };
  } catch {
    await recordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "provider_error", outcome: "error", cacheStatus: "miss", durationMs: Date.now() - startedAt });
    return { day: null, failure: "WeatherAPI could not be reached." };
  }
}

async function fetchVisualCrossingRange(location: string, startDate: string, endDate: string): Promise<{ days: WeatherDay[]; failure?: string }> {
  const url = new URL(`https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/${startDate}/${endDate}`);
  url.searchParams.set("unitGroup", "us");
  // Ask for both daily summaries and the provider's extended statistical
  // forecast layer used beyond the model-based forecast window.
  url.searchParams.set("include", "days,statsfcst");
  url.searchParams.set("elements", "datetime,tempmax,tempmin,conditions,icon,precipprob,windspeed,uvindex,description");
  url.searchParams.set("contentType", "json");
  const optionalKey = process.env.VISUALCROSSING_API_KEY?.trim();
  if (optionalKey) url.searchParams.set("key", optionalKey);
  const startedAt = Date.now();
  try {
    const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(18000) });
    const text = await response.text();
    if (!response.ok) {
      await recordProviderEvent({ provider: "Visual Crossing", category: "Trip weather fallback", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      return { days: [], failure: response.status === 429 ? "The backup weather source is temporarily rate-limited. Cached weather remains available." : "The backup weather source is temporarily unavailable." };
    }
    let payload: JsonObject;
    try { payload = asObject(JSON.parse(text)); } catch {
      await recordProviderEvent({ provider: "Visual Crossing", category: "Trip weather fallback", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      return { days: [], failure: "The backup weather source returned an unreadable response." };
    }
    const rawDays = Array.isArray(payload.days) ? payload.days : [];
    const normalized = rawDays.map((item) => normalizeVisualCrossingDay(item, "")).filter((day): day is WeatherDay => Boolean(day));
    await recordProviderEvent({ provider: "Visual Crossing", category: "Trip weather fallback", eventType: "provider_request", outcome: normalized.length ? "success" : "empty", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
    return { days: normalized };
  } catch {
    await recordProviderEvent({ provider: "Visual Crossing", category: "Trip weather fallback", eventType: "provider_error", outcome: "error", cacheStatus: "miss", durationMs: Date.now() - startedAt });
    return { days: [], failure: "The backup weather source could not be reached." };
  }
}

export async function POST(request: Request) {
  try {
    const body = asObject(await request.json());
    const location = typeof body.location === "string" ? body.location.trim().slice(0, 160) : "";
    const startDate = typeof body.startDate === "string" ? body.startDate : "";
    const endDate = typeof body.endDate === "string" ? body.endDate : "";
    const forceRefresh = body.forceRefresh === true;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const startTimestamp = Date.parse(`${startDate}T00:00:00Z`);
    const endTimestamp = Date.parse(`${endDate}T00:00:00Z`);
    if (!location || !datePattern.test(startDate) || !datePattern.test(endDate) || !Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || new Date(startTimestamp).toISOString().slice(0, 10) !== startDate || new Date(endTimestamp).toISOString().slice(0, 10) !== endDate || endTimestamp < startTimestamp) {
      return NextResponse.json({ status: "error", days: [], message: "A valid destination and travel date range are required." }, { status: 400 });
    }
    const dayCount = Math.floor((endTimestamp - startTimestamp) / 86400000) + 1;
    if (dayCount < 1 || dayCount > 31) return NextResponse.json({ status: "error", days: [], message: "Weather requests are limited to trips of 31 days or fewer." }, { status: 400 });
    if (utcDayOffset(startDate) < 0) return NextResponse.json({ status: "unavailable", days: [], message: "Weather is not available for dates that have already passed." });
    if (Number(endDate.slice(0, 4)) > 2049) return NextResponse.json({ status: "unavailable", days: [], message: "Weather outlook data is currently supported through 2049." });

    const requestedDates = Array.from({ length: dayCount }, (_, index) => addUtcDays(startDate, index));
    const results = new Map<string, WeatherDay>();
    const key = process.env.WEATHERAPI_API_KEY?.trim() || "";
    let primaryFailure = "";
    const staleDates: string[] = [];

    // WeatherAPI remains the preferred source when its configured plan supports
    // the requested date. A plan-limit or provider failure no longer ends the
    // entire weather panel; missing dates are resolved by Visual Crossing.
    for (const date of requestedDates) {
      if (key) {
        const offset = utcDayOffset(date);
        const endpoint = offset <= 14 ? "forecast.json" : "future.json";
        const cached = await readCachedDay("weatherapi-v2", location, date, endpoint, forceRefresh);
        if (cached) {
          results.set(date, cached);
          await recordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
          continue;
        }
        const fetched = await fetchWeatherApiDay(location, date, key);
        if (fetched.day) {
          results.set(date, fetched.day);
          await writeCachedDay("weatherapi-v2", location, fetched.day, endpoint, 3600);
          continue;
        }
        primaryFailure = fetched.failure || "WeatherAPI did not return a forecast for the requested date.";
        const cacheKey = providerCacheKey({ provider: "weatherapi-v2", location: location.toLocaleLowerCase("en-US"), date, endpoint });
        if (!forceRefresh) {
          try {
            const stale = await getProviderCacheFallback(cacheKey, 6 * 3600);
            const rawDay = stale?.payload.normalizedDay;
            if (rawDay && typeof rawDay === "object" && !Array.isArray(rawDay)) {
              const staleDay = rawDay as unknown as WeatherDay;
              if (staleDay.date === date && typeof staleDay.condition === "string") {
                results.set(date, staleDay);
                staleDates.push(date);
                await recordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "cache_hit", outcome: "success", cacheStatus: "stale" });
              }
            }
          } catch {
            // A stale-cache read failure must not prevent the backup provider.
          }
        }
        // One account-plan/network failure is enough to start fallback for
        // remaining dates; avoid repeating calls that are likely to fail.
        break;
      }
      primaryFailure = "WeatherAPI is not configured; using the backup weather source.";
      break;
    }

    // Restore any cached backup days first. This keeps anonymous/no-key use
    // inside Visual Crossing's fair-use controls and reduces duplicate pulls.
    const missingDates: string[] = [];
    for (const date of requestedDates) {
      if (results.has(date)) continue;
      const cached = await readCachedDay("visualcrossing-v1", location, date, "timeline-days", forceRefresh);
      if (cached) {
        results.set(date, cached);
        await recordProviderEvent({ provider: "Visual Crossing", category: "Trip weather fallback", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
      } else {
        missingDates.push(date);
      }
    }

    let fallbackFailure = "";
    if (missingDates.length) {
      // One inclusive request for the whole missing range, not one API call per
      // travel day. Results already sourced from WeatherAPI are ignored.
      const fallback = await fetchVisualCrossingRange(location, missingDates[0], missingDates[missingDates.length - 1]);
      fallbackFailure = fallback.failure || "";
      const returned = new Map(fallback.days.map((day) => [day.date, day]));
      for (const date of missingDates) {
        const day = returned.get(date);
        if (!day) continue;
        results.set(date, day);
        await writeCachedDay("visualcrossing-v1", location, day, "timeline-days", 12 * 3600);
      }
    }

    const days = requestedDates.flatMap((date) => results.has(date) ? [results.get(date)!] : []);
    const usedSources = [...new Set(days.map((day) => day.source))];
    const attributions = usedSources.map((source) => source === "WeatherAPI" ? WEATHERAPI_ATTRIBUTION : VISUAL_CROSSING_ATTRIBUTION);
    const hasSeasonalDays = days.some((day) => day.basis === "seasonal");
    const hasMissingDays = days.length !== requestedDates.length;
    const messages: string[] = [];
    if (usedSources.includes("Visual Crossing") && primaryFailure) messages.push("WeatherAPI could not cover all selected dates, so Tripfinder used its backup weather source.");
    if (hasSeasonalDays) messages.push("Dates beyond the 15-day forecast window are statistical seasonal outlooks based on historical weather patterns, not precise day-specific forecasts.");
    if (staleDates.length) messages.push(`Some saved WeatherAPI data may be outdated: ${staleDates.join(", ")}.`);
    if (hasMissingDays) messages.push(fallbackFailure || "Weather data is available for only part of this trip's date range.");

    if (days.length === requestedDates.length) {
      return NextResponse.json({ status: messages.length ? "partial" : "ok", days, message: messages.join(" ") || undefined, attributions }, { headers: { "Cache-Control": "private, max-age=1800" } });
    }
    if (days.length > 0) return NextResponse.json({ status: "partial", days, message: messages.join(" ") || "Some weather dates could not be retrieved.", attributions });
    return NextResponse.json({ status: "unavailable", days: [], message: fallbackFailure || primaryFailure || "No weather data was returned for these dates.", attributions: [] });
  } catch {
    return NextResponse.json({ status: "error", days: [], message: "Weather lookup failed. Please try again later.", attributions: [] }, { status: 502 });
  }
}
