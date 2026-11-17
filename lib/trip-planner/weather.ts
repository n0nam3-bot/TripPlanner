export type WeatherForecastType = "forecast" | "seasonal_estimate";

export type NormalizedWeatherDay = {
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
  forecastType: WeatherForecastType;
  source: "WeatherAPI" | "Visual Crossing";
};

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Visual Crossing supplies model forecasts through Today+15 and statistical
 * climate-based outlooks after that. Classification is intentionally date-based
 * and displayed to travelers; long-range values are never called forecasts. */
export function classifyWeatherDate(date: string, today = new Date()): WeatherForecastType {
  const [year, month, day] = date.split("-").map(Number);
  const requested = Date.UTC(year, month - 1, day);
  const current = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const offset = Math.floor((requested - current) / 86400000);
  return offset <= 15 ? "forecast" : "seasonal_estimate";
}

/** Normalize one Visual Crossing `days[]` item (unitGroup=us). */
export function normalizeVisualCrossingDay(
  raw: unknown,
  requestedDate: string,
  today = new Date(),
): NormalizedWeatherDay | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const date = typeof item.datetime === "string" ? item.datetime : requestedDate;
  const highF = finiteNumber(item.tempmax);
  const lowF = finiteNumber(item.tempmin);
  const windMph = finiteNumber(item.windspeed);
  const condition = typeof item.conditions === "string" && item.conditions.trim()
    ? item.conditions.trim()
    : typeof item.description === "string" && item.description.trim()
      ? item.description.trim()
      : "Conditions unavailable";
  if (highF === null && lowF === null && condition === "Conditions unavailable") return null;

  return {
    date,
    condition,
    // Visual Crossing returns icon identifiers rather than WeatherAPI image URLs.
    // Leave this empty; the UI renders condition text and the forecast label.
    icon: "",
    highC: highF === null ? null : (highF - 32) * 5 / 9,
    lowC: lowF === null ? null : (lowF - 32) * 5 / 9,
    highF,
    lowF,
    rainChance: finiteNumber(item.precipprob),
    maxWindKph: windMph === null ? null : windMph * 1.609344,
    uv: finiteNumber(item.uvindex),
    forecastType: classifyWeatherDate(date, today),
    source: "Visual Crossing",
  };
}

export function normalizeVisualCrossingRange(
  rawDays: unknown,
  requestedDates: string[],
  today = new Date(),
): NormalizedWeatherDay[] {
  if (!Array.isArray(rawDays)) return [];
  const byDate = new Map<string, NormalizedWeatherDay>();
  for (const raw of rawDays) {
    const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const date = typeof item.datetime === "string" ? item.datetime : typeof item.date === "string" ? item.date : "";
    if (!date || !requestedDates.includes(date)) continue;
    // Neon stores normalized days, while live Visual Crossing responses use
    // `datetime`; support both shapes so the 12-hour cache is reusable.
    const normalized = item.source === "Visual Crossing" && typeof item.condition === "string"
      ? { ...(item as unknown as NormalizedWeatherDay), forecastType: classifyWeatherDate(date, today), source: "Visual Crossing" as const }
      : normalizeVisualCrossingDay(raw, date, today);
    if (normalized) byDate.set(date, normalized);
  }
  return requestedDates.flatMap((date) => {
    const day = byDate.get(date);
    return day ? [day] : [];
  });
}
