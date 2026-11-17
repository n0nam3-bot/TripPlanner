import { NextResponse } from "next/server";
import {
  getProviderCache,
  getProviderCacheFallback,
  providerCacheKey,
  recordProviderEvent,
  setProviderCache,
} from "@/lib/db/travel-cache";
import {
  normalizeVisualCrossingRange,
  type NormalizedWeatherDay,
} from "@/lib/trip-planner/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonObject = Record<string, unknown>;
type WeatherDay = NormalizedWeatherDay;
type WeatherAttribution = { label: string; url: string };
const asObject = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const asNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const asString = (value: unknown): string => typeof value === "string" ? value : "";

function utcDayOffset(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((target - today) / 86400000);
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
    forecastType: "forecast",
    source: "WeatherAPI",
  };
}

function weatherApiError(payload: JsonObject): { code: number; message: string } | null {
  const error = asObject(payload.error);
  return typeof error.code === "number" ? { code: error.code, message: asString(error.message) } : null;
}

async function safeRecordProviderEvent(event: Parameters<typeof recordProviderEvent>[0]): Promise<void> {
  try { await recordProviderEvent(event); } catch { /* Telemetry must not block weather results. */ }
}

function weatherAttributions(days: WeatherDay[]): WeatherAttribution[] {
  const sources = new Set(days.map((day) => day.source));
  const result: WeatherAttribution[] = [];
  if (sources.has("WeatherAPI")) result.push({ label: "WeatherAPI.com", url: "https://www.weatherapi.com/" });
  if (sources.has("Visual Crossing")) result.push({ label: "Visual Crossing Weather", url: "https://www.visualcrossing.com/" });
  return result;
}

async function loadVisualCrossingRange(
  location: string,
  startDate: string,
  endDate: string,
  requestedDates: string[],
  forceRefresh: boolean,
): Promise<{ days: WeatherDay[]; stale: boolean; message?: string }> {
  const cacheKey = providerCacheKey({
    provider: "visualcrossing-timeline",
    location: location.toLocaleLowerCase("en-US"),
    startDate,
    endDate,
    unitGroup: "us",
    include: "days",
  });

  let freshCachedDays: WeatherDay[] = [];
  let fallbackCache: Awaited<ReturnType<typeof getProviderCacheFallback>> = null;
  let cacheWarning = "";
  try {
    if (!forceRefresh) {
      const cached = await getProviderCache(cacheKey);
      freshCachedDays = normalizeVisualCrossingRange(cached?.payload.days, requestedDates);
      if (freshCachedDays.length === requestedDates.length) {
        await safeRecordProviderEvent({ provider: "Visual Crossing", category: "Daily weather range", eventType: "cache_hit", outcome: "success", cacheStatus: "hit" });
        return { days: freshCachedDays, stale: false };
      }
    }
    fallbackCache = await getProviderCacheFallback(cacheKey, 12 * 3600);
  } catch {
    // Neon improves efficiency but must not prevent a live weather lookup.
    cacheWarning = "Neon weather caching is temporarily unavailable; this response will not be cached.";
  }
  const staleDays = normalizeVisualCrossingRange(fallbackCache?.payload.days, requestedDates);
  const startedAt = Date.now();
  const url = new URL(
    `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${encodeURIComponent(location)}/${startDate}/${endDate}`,
  );
  url.searchParams.set("unitGroup", "us");
  url.searchParams.set("include", "days");
  url.searchParams.set("contentType", "json");
  url.searchParams.set("elements", "datetime,conditions,description,tempmax,tempmin,precipprob,windspeed,uvindex,icon");
  const registeredKey = process.env.VISUALCROSSING_API_KEY?.trim();
  if (registeredKey) url.searchParams.set("key", registeredKey);

  let failureMessage = "Visual Crossing could not refresh the requested weather range.";
  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      failureMessage = response.status === 429
        ? "Visual Crossing is temporarily rate-limiting anonymous or registered requests. Recent saved weather may still be available; try refreshing later."
        : `Visual Crossing returned HTTP ${response.status}. Recent saved weather may still be available.`;
      await safeRecordProviderEvent({ provider: "Visual Crossing", category: "Daily weather range", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
    } else {
      const payload = asObject(await response.json());
      const normalized = normalizeVisualCrossingRange(payload.days, requestedDates);
      await safeRecordProviderEvent({ provider: "Visual Crossing", category: "Daily weather range", eventType: "provider_request", outcome: normalized.length ? "success" : "empty", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - startedAt });
      if (normalized.length || freshCachedDays.length || staleDays.length) {
        const merged = new Map<string, WeatherDay>();
        for (const day of freshCachedDays) merged.set(day.date, day);
        const liveDates = new Set(normalized.map((day) => day.date));
        for (const day of staleDays) if (!merged.has(day.date) && !liveDates.has(day.date)) merged.set(day.date, day);
        for (const day of normalized) merged.set(day.date, day);
        const mergedDays = requestedDates.flatMap((date) => merged.has(date) ? [merged.get(date)!] : []);
        const usedStale = staleDays.some((day) => !freshCachedDays.some((fresh) => fresh.date === day.date) && !liveDates.has(day.date));
        // Cache only a complete fresh Visual Crossing response. Do not extend
        // the TTL of older/partial cache entries by rewriting them as new data.
        if (normalized.length === requestedDates.length) {
          try {
            await setProviderCache(cacheKey, { days: normalized }, 12 * 3600);
          } catch { cacheWarning = "Neon weather caching is temporarily unavailable; this response will not be cached."; }
        }
        return {
          days: mergedDays,
          stale: usedStale,
          message: usedStale
            ? "Visual Crossing returned only part of the range, so Tripfinder filled remaining dates from a saved range less than 12 hours old. Those values may have changed."
            : cacheWarning || undefined,
        };
      }
      failureMessage = "Visual Crossing did not return daily weather for the requested destination and dates.";
    }
  } catch {
    failureMessage = "Visual Crossing could not be reached. Recent saved weather may still be available.";
    await safeRecordProviderEvent({ provider: "Visual Crossing", category: "Daily weather range", eventType: "provider_error", outcome: "error", cacheStatus: "miss", durationMs: Date.now() - startedAt });
  }

  if (staleDays.length || freshCachedDays.length) {
    const merged = new Map<string, WeatherDay>();
    for (const day of freshCachedDays) merged.set(day.date, day);
    for (const day of staleDays) if (!merged.has(day.date)) merged.set(day.date, day);
    const mergedDays = requestedDates.flatMap((date) => merged.has(date) ? [merged.get(date)!] : []);
    if (staleDays.length) await safeRecordProviderEvent({ provider: "Visual Crossing", category: "Daily weather range", eventType: "cache_hit", outcome: "success", cacheStatus: "stale", durationMs: Date.now() - startedAt });
    return { days: mergedDays, stale: Boolean(staleDays.length), message: `${failureMessage} Tripfinder is showing saved Visual Crossing data from within the last 12 hours; conditions and seasonal estimates may have changed.` };
  }
  return { days: [], stale: false, message: failureMessage };
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const record = asObject(body);
    const location = typeof record.location === "string" ? record.location.trim().slice(0, 160) : "";
    const startDate = typeof record.startDate === "string" ? record.startDate : "";
    const endDate = typeof record.endDate === "string" ? record.endDate : "";
    const forceRefresh = record.forceRefresh === true;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const startTimestamp = Date.parse(`${startDate}T00:00:00Z`);
    const endTimestamp = Date.parse(`${endDate}T00:00:00Z`);
    if (!location || !datePattern.test(startDate) || !datePattern.test(endDate) || !Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || endTimestamp < startTimestamp) {
      return NextResponse.json({ status: "error", days: [], message: "A valid destination and travel date range are required." }, { status: 400 });
    }
    const dayCount = Math.floor((endTimestamp - startTimestamp) / 86400000) + 1;
    if (dayCount < 1 || dayCount > 31) return NextResponse.json({ status: "error", days: [], message: "Weather requests are limited to trips of 31 days or fewer." }, { status: 400 });
    if (Number(endDate.slice(0, 4)) > 2049) {
      return NextResponse.json({ status: "unavailable", days: [], message: "Visual Crossing's published long-range climate-based data currently extends through 2049." });
    }
    const firstOffset = utcDayOffset(startDate);
    if (firstOffset < 0) return NextResponse.json({ status: "unavailable", days: [], message: "Weather lookup is available for current and future trip dates, not dates that have already passed." });

    const requestedDates = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(`${startDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
    const daysByDate = new Map<string, WeatherDay>();
    const staleWeatherApiDates: string[] = [];
    let weatherApiMessage = "";
    const weatherApiKey = process.env.WEATHERAPI_API_KEY?.trim();

    // Keep WeatherAPI as the primary short-range source. Dates beyond its
    // standard 14-day forecast endpoint are deliberately sent to Visual
    // Crossing, which identifies dates after Today+15 as seasonal estimates.
    if (weatherApiKey) {
      for (const date of requestedDates) {
        const offset = utcDayOffset(date);
        if (offset > 14) {
          weatherApiMessage = "Dates beyond WeatherAPI's standard forecast window are being checked with Visual Crossing.";
          continue;
        }
        const cacheKey = providerCacheKey({ provider: "weatherapi", location: location.toLocaleLowerCase("en-US"), date, endpoint: "forecast.json" });
        const cacheStartedAt = Date.now();
        try {
          const cached = !forceRefresh ? await getProviderCache(cacheKey) : null;
          const cachedDay = cached?.payload.normalizedDay;
          if (cachedDay && typeof cachedDay === "object" && !Array.isArray(cachedDay)) {
            const cachedRecord = cachedDay as unknown as Partial<WeatherDay>;
            const normalized = { ...cachedRecord, source: "WeatherAPI", forecastType: "forecast" } as WeatherDay;
            if (normalized.date === date && typeof normalized.condition === "string") {
              daysByDate.set(date, normalized);
              await safeRecordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "cache_hit", outcome: "success", cacheStatus: "hit", durationMs: Date.now() - cacheStartedAt });
              continue;
            }
          }

          const staleEntry = await getProviderCacheFallback(cacheKey, 6 * 3600);
          const url = new URL("https://api.weatherapi.com/v1/forecast.json");
          url.searchParams.set("key", weatherApiKey);
          url.searchParams.set("q", location);
          url.searchParams.set("dt", date);
          url.searchParams.set("days", "1");
          url.searchParams.set("aqi", "no");
          url.searchParams.set("alerts", "no");
          const providerStartedAt = Date.now();
          let response: Response | null = null;
          try {
            response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
          } catch {
            weatherApiMessage = "WeatherAPI could not be reached; Tripfinder is trying its backup weather source.";
          }

          let providerError: { code: number; message: string } | null = null;
          let payload: JsonObject = {};
          if (response) {
            try { payload = asObject(await response.json()); }
            catch { weatherApiMessage = "WeatherAPI returned an unreadable response; Tripfinder is trying its backup weather source."; }
            providerError = weatherApiError(payload);
            if (!response.ok || providerError) {
              weatherApiMessage = providerError?.code === 2009
                ? "The current WeatherAPI plan does not cover every selected date; Tripfinder is using Visual Crossing for missing days."
                : providerError?.code === 2007 || response.status === 429
                  ? "WeatherAPI reached a request allowance or rate limit; Tripfinder is using Visual Crossing for missing days."
                  : providerError?.code === 2006
                    ? "WeatherAPI rejected its configured key; Tripfinder is trying Visual Crossing instead."
                    : providerError?.message || `WeatherAPI returned HTTP ${response.status}; Tripfinder is trying its backup source.`;
              await safeRecordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "provider_error", outcome: "error", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - providerStartedAt });
            } else {
              const forecast = asObject(payload.forecast);
              const forecastDays = Array.isArray(forecast.forecastday) ? forecast.forecastday : [];
              const normalized = normalizeWeatherApiDay(forecastDays[0], date);
              await safeRecordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "provider_request", outcome: normalized ? "success" : "empty", cacheStatus: "miss", httpStatus: response.status, durationMs: Date.now() - providerStartedAt });
              if (normalized) {
                daysByDate.set(date, normalized);
                try { await setProviderCache(cacheKey, { normalizedDay: normalized as unknown as JsonObject }, 3600); }
                catch { /* A successful live forecast is still returned without cache persistence. */ }
              }
            }
          }

          if (!daysByDate.has(date) && staleEntry?.payload.normalizedDay && typeof staleEntry.payload.normalizedDay === "object") {
            const staleRecord = staleEntry.payload.normalizedDay as unknown as Partial<WeatherDay>;
            const staleDay = { ...staleRecord, source: "WeatherAPI", forecastType: "forecast" } as WeatherDay;
            if (staleDay.date === date && typeof staleDay.condition === "string") {
              daysByDate.set(date, staleDay);
              staleWeatherApiDates.push(date);
              await safeRecordProviderEvent({ provider: "WeatherAPI", category: "Daily forecast", eventType: "cache_hit", outcome: "success", cacheStatus: "stale", durationMs: Date.now() - cacheStartedAt });
            }
          }
          if (!daysByDate.has(date) && (weatherApiMessage || !response)) break;
        } catch {
          weatherApiMessage = "WeatherAPI cache or provider lookup failed; Tripfinder is trying Visual Crossing instead.";
          break;
        }
      }
    } else {
      weatherApiMessage = "WeatherAPI is not configured; Tripfinder is using its no-key Visual Crossing backup.";
    }

    const missingDates = requestedDates.filter((date) => !daysByDate.has(date));
    let visualCrossingMessage = "";
    let usedVisualCrossing = false;
    let visualCrossingStale = false;
    if (missingDates.length) {
      const visualCrossing = await loadVisualCrossingRange(location, startDate, endDate, requestedDates, forceRefresh);
      visualCrossingMessage = visualCrossing.message || "";
      visualCrossingStale = visualCrossing.stale;
      if (visualCrossing.days.length) {
        usedVisualCrossing = true;
        for (const day of visualCrossing.days) {
          // Preserve days supplied by WeatherAPI; use Visual Crossing only to
          // fill missing dates from the requested single range response.
          if (!daysByDate.has(day.date)) daysByDate.set(day.date, day);
        }
      }
    }

    const days = requestedDates.flatMap((date) => {
      const day = daysByDate.get(date);
      return day ? [day] : [];
    });
    const remaining = requestedDates.filter((date) => !daysByDate.has(date));
    const containsSeasonal = days.some((day) => day.forecastType === "seasonal_estimate");
    const messageParts = [
      weatherApiMessage && usedVisualCrossing ? weatherApiMessage : "",
      visualCrossingMessage,
      staleWeatherApiDates.length ? `Showing saved WeatherAPI data for ${staleWeatherApiDates.join(", ")}; its conditions may have changed.` : "",
      containsSeasonal ? "Dates beyond the 15-day model forecast window are statistical seasonal estimates based on historical climate patterns, not precise day-specific forecasts." : "",
      remaining.length ? `Weather is unavailable for ${remaining.join(", ")} because neither provider returned data for those dates.` : "",
    ].filter(Boolean);

    const attributions = weatherAttributions(days);
    if (days.length === requestedDates.length) {
      return NextResponse.json({
        status: staleWeatherApiDates.length || visualCrossingStale ? "partial" : "ok",
        days,
        message: messageParts.join(" ") || undefined,
        attributions,
      }, { headers: { "Cache-Control": "private, max-age=1800" } });
    }
    if (days.length) {
      return NextResponse.json({ status: "partial", days, message: messageParts.join(" ") || "Some requested weather days were unavailable.", attributions });
    }
    return NextResponse.json({ status: "unavailable", days: [], message: messageParts.join(" ") || "No weather data was returned for these dates.", attributions: [] });
  } catch {
    return NextResponse.json({ status: "error", days: [], message: "Weather lookup failed. Tripfinder tried its configured weather sources; please try again later.", attributions: [] }, { status: 502 });
  }
}
