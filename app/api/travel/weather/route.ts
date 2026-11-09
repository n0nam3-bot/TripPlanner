import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
};

type JsonObject = Record<string, unknown>;
const asObject = (value: unknown): JsonObject => value && typeof value === "object" ? value as JsonObject : {};
const asNumber = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const asString = (value: unknown): string => typeof value === "string" ? value : "";

function utcDayOffset(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((target - today) / 86400000);
}

function normalizeDay(raw: unknown, requestedDate: string): WeatherDay | null {
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
  };
}

function weatherApiError(payload: JsonObject): { code: number; message: string } | null {
  const error = asObject(payload.error);
  return typeof error.code === "number" ? { code: error.code, message: asString(error.message) } : null;
}

export async function POST(request: Request) {
  try {
    const key = process.env.WEATHERAPI_API_KEY;
    if (!key) return NextResponse.json({ status: "unavailable", days: [], message: "Weather is not connected. Add WEATHERAPI_API_KEY in Vercel to enable forecasts." }, { status: 503 });
    const raw: unknown = await request.json();
    const body = asObject(raw);
    const location = typeof body.location === "string" ? body.location.trim().slice(0, 160) : "";
    const startDate = typeof body.startDate === "string" ? body.startDate : "";
    const endDate = typeof body.endDate === "string" ? body.endDate : "";
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    const startTimestamp = Date.parse(`${startDate}T00:00:00Z`);
    const endTimestamp = Date.parse(`${endDate}T00:00:00Z`);
    if (!location || !datePattern.test(startDate) || !datePattern.test(endDate) || !Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || endTimestamp < startTimestamp) {
      return NextResponse.json({ status: "error", days: [], message: "A valid destination and travel date range are required." }, { status: 400 });
    }
    const dayCount = Math.floor((endTimestamp - startTimestamp) / 86400000) + 1;
    if (dayCount < 1 || dayCount > 31) return NextResponse.json({ status: "error", days: [], message: "Weather requests are limited to trips of 31 days or fewer." }, { status: 400 });
    const firstOffset = utcDayOffset(startDate);
    if (firstOffset < 0) return NextResponse.json({ status: "unavailable", days: [], message: "A forecast is not available for dates that have already passed." });
    if (utcDayOffset(endDate) > 300) return NextResponse.json({ status: "unavailable", days: [], message: "WeatherAPI supports future trip weather up to 300 days ahead on eligible plans." });

    const requestedDates = Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(`${startDate}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
    const days: WeatherDay[] = [];
    let planMessage = "";

    // Use the standard forecast for dates up to 14 days away; use Future API beyond 14 days.
    // Each date request is cached by Next.js for one hour at the fetch layer.
    for (const date of requestedDates) {
      const offset = utcDayOffset(date);
      const endpoint = offset <= 14 ? "forecast.json" : "future.json";
      const url = new URL(`https://api.weatherapi.com/v1/${endpoint}`);
      url.searchParams.set("key", key);
      url.searchParams.set("q", location);
      url.searchParams.set("dt", date);
      if (endpoint === "forecast.json") url.searchParams.set("days", "1");
      url.searchParams.set("aqi", "no");
      url.searchParams.set("alerts", "no");
      const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, next: { revalidate: 3600 } });
      const text = await response.text();
      let payload: JsonObject;
      try { payload = asObject(JSON.parse(text)); } catch { return NextResponse.json({ status: "error", days, message: "The weather provider returned an unreadable response. Try again later." }, { status: 502 }); }
      const providerError = weatherApiError(payload);
      if (!response.ok || providerError) {
        if (providerError?.code === 2009) {
          planMessage = endpoint === "future.json"
            ? "Your WeatherAPI plan does not include future weather for these dates. The Free plan provides a 3-day forecast; Pro+ is required for dates 14–300 days ahead."
            : "Your WeatherAPI plan does not cover the selected forecast dates. The Free plan provides 3 days, Starter provides 7 days, and Pro+ supports longer-range trip forecasts.";
        } else if (providerError?.code === 2006) {
          planMessage = "WeatherAPI rejected the key. Check WEATHERAPI_API_KEY in Vercel and redeploy.";
        } else if (providerError?.code === 2007) {
          planMessage = "The WeatherAPI monthly request allowance has been reached.";
        } else {
          planMessage = providerError?.message || `Weather provider returned HTTP ${response.status}.`;
        }
        break;
      }
      const forecast = asObject(payload.forecast);
      const forecastDays = Array.isArray(forecast.forecastday) ? forecast.forecastday : [];
      const normalized = normalizeDay(forecastDays[0], date);
      if (normalized) days.push(normalized);
    }

    if (days.length === requestedDates.length) {
      return NextResponse.json({ status: "ok", days, attribution: "Weather data by WeatherAPI.com" }, { headers: { "Cache-Control": "private, max-age=1800" } });
    }
    if (days.length > 0) {
      return NextResponse.json({ status: "partial", days, message: planMessage || "Weather is available for only part of the selected date range on the current plan.", attribution: "Weather data by WeatherAPI.com" });
    }
    return NextResponse.json({ status: "unavailable", days: [], message: planMessage || "No forecast data was returned for these dates." });
  } catch {
    return NextResponse.json({ status: "error", days: [], message: "Weather lookup failed. Check the WeatherAPI connection and try again." }, { status: 502 });
  }
}
