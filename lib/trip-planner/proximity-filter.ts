export type ProximityFilterKind = "restaurant" | "activity";
export type ProximityRequirement =
  | { kind: "distance"; amount: number; unit: "mi" | "km"; raw: string }
  | { kind: "time"; amount: number; unit: "minutes"; mode: "drive" | "walk"; raw: string };

/** Read an explicit, already-approved planning note. This does not infer a limit from vague words such as "nearby". */
export function parseProximityRequirement(
  notes: readonly string[] | null | undefined,
  kind: ProximityFilterKind,
): ProximityRequirement | null {
  if (!Array.isArray(notes)) return null;
  const prefix = kind === "restaurant" ? /^restaurant\s+proximity\s*:/i : /^(?:activity|attraction)s?\s+proximity\s*:/i;
  for (const note of notes) {
    if (typeof note !== "string" || !prefix.test(note.trim())) continue;
    const raw = note.trim().slice(note.trim().indexOf(":") + 1).trim();
    if (!raw) continue;
    const distance = raw.match(/\b(?:within|under|up to|no more than|at most|less than)\s+(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|kilometres?|km)\b/i)
      ?? raw.match(/\b(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|kilometres?|km)\b/i);
    if (distance) {
      const amount = Number(distance[1]);
      if (Number.isFinite(amount) && amount > 0 && amount <= 100) {
        const unit = /^(?:km|kilometer|kilometers|kilometre|kilometres)$/i.test(distance[2]) ? "km" : "mi";
        return { kind: "distance", amount, unit, raw };
      }
    }
    const time = raw.match(/\b(?:within|under|up to|no more than|at most|less than)\s+(\d{1,2})\s*(?:-\s*)?(?:mins?|minutes?)\b/i)
      ?? raw.match(/\b(\d{1,2})\s*(?:-\s*)?(?:mins?|minutes?)\b/i);
    if (time) {
      const amount = Number(time[1]);
      if (Number.isInteger(amount) && amount > 0 && amount <= 180) {
        const mode = /\b(?:walk|walking|on foot|by foot)\b/i.test(raw) ? "walk" : "drive";
        return { kind: "time", amount, unit: "minutes", mode, raw };
      }
    }
  }
  return null;
}

/** Convert route duration values to whole minutes, rounding up so a 5m01s route does not pass a 5-minute limit. */
export function parseRouteDurationMinutes(value: unknown, durationSeconds?: unknown): number | null {
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds >= 0) {
    return Math.ceil(durationSeconds / 60);
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.toLowerCase().replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const hours = normalized.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  const minutes = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  const seconds = normalized.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds)\b/);
  if (!hours && !minutes && !seconds) return null;
  const totalSeconds = (hours ? Number(hours[1]) * 3600 : 0)
    + (minutes ? Number(minutes[1]) * 60 : 0)
    + (seconds ? Number(seconds[1]) : 0);
  return Number.isFinite(totalSeconds) ? Math.ceil(totalSeconds / 60) : null;
}

export function milesForProximityLimit(amount: number, unit: "mi" | "km"): number {
  return unit === "km" ? amount / 1.609344 : amount;
}
