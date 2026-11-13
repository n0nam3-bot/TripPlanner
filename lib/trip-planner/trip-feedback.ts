import type { SavedTripDraft, SavedTripSnapshot, SavedTripItem } from "./saved-trips";

export const TRIP_FEEDBACK_CATEGORIES = ["dates", "flights", "stay", "activities", "dining", "budget", "other"] as const;
export type TripFeedbackCategory = typeof TRIP_FEEDBACK_CATEGORIES[number];
export type TripFeedbackSubmission = {
  name: string;
  category: TripFeedbackCategory;
  itemTitle: string;
  message: string;
};

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
function clean(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

/** Validate and bound invite-only feedback before it reaches persistent storage. */
export function normalizeTripFeedbackSubmission(value: unknown): TripFeedbackSubmission | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const category = typeof record.category === "string" && TRIP_FEEDBACK_CATEGORIES.includes(record.category as TripFeedbackCategory)
    ? record.category as TripFeedbackCategory
    : null;
  const message = clean(record.message, 2000);
  if (!category || message.length < 8) return null;
  return {
    name: clean(record.name, 60),
    category,
    itemTitle: clean(record.itemTitle, 140),
    message,
  };
}

export type TripFeedbackStatus = "pending" | "reviewed" | "dismissed";
export function isTripFeedbackStatus(value: unknown): value is Exclude<TripFeedbackStatus, "pending"> {
  return value === "reviewed" || value === "dismissed";
}

export type TripFeedbackApplyPatch =
  | { action: "reschedule-place"; destinationIndex: number; itemIndex: number; date: string; time?: string }
  | { action: "remove-place"; destinationIndex: number; itemIndex: number };

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Only allow explicit owner-authored edits to selected activities or restaurants. */
export function normalizeTripFeedbackApplyPatch(value: unknown): TripFeedbackApplyPatch | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const destinationIndex = record.destinationIndex;
  const itemIndex = record.itemIndex;
  if (!Number.isInteger(destinationIndex) || !Number.isInteger(itemIndex)
    || (destinationIndex as number) < 0 || (destinationIndex as number) > 7
    || (itemIndex as number) < 0 || (itemIndex as number) > 49) return null;
  if (record.action === "remove-place") return { action: "remove-place", destinationIndex: destinationIndex as number, itemIndex: itemIndex as number };
  if (record.action !== "reschedule-place" || typeof record.date !== "string" || !validIsoDate(record.date)) return null;
  const time = typeof record.time === "string" ? record.time.trim() : "";
  if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  return {
    action: "reschedule-place", destinationIndex: destinationIndex as number, itemIndex: itemIndex as number,
    date: record.date, ...(time ? { time } : {}),
  };
}

/** Apply a previewed owner edit to the saved snapshot; never infer edits from free-form feedback text. */
export function applyTripFeedbackPatchToSnapshot(
  snapshot: SavedTripSnapshot,
  search: SavedTripDraft["search"],
  patch: TripFeedbackApplyPatch,
): { snapshot: SavedTripSnapshot; summary: string } {
  const destination = snapshot.destinations[patch.destinationIndex];
  const target = destination?.items[patch.itemIndex];
  if (!destination || !target || !["activity", "restaurant"].includes(target.kind)) throw new Error("TRIP_FEEDBACK_TARGET_INVALID");
  if (!target.selectionRef || target.selectionRef.type !== "experience") throw new Error("TRIP_FEEDBACK_TARGET_INVALID");

  if (patch.action === "remove-place") {
    const items = destination.items.filter((_, index) => index !== patch.itemIndex);
    const destinations = snapshot.destinations.map((group, index) => index === patch.destinationIndex ? { ...group, items } : group);
    return { snapshot: { ...snapshot, destinations }, summary: `Removed ${target.title} from the saved itinerary.` };
  }

  if (patch.date < search.departureDate || patch.date > search.returnDate) throw new Error("TRIP_FEEDBACK_DATE_OUTSIDE_TRIP");
  const previousDate = target.date || "an unspecified date";
  const previousTime = target.time || "an unspecified time";
  const updatedItems: SavedTripItem[] = destination.items.map((item, index) => {
    if (index !== patch.itemIndex) return item;
    const reference = item.selectionRef;
    if (!reference || reference.type !== "experience") throw new Error("TRIP_FEEDBACK_TARGET_INVALID");
    const nextReference = { ...reference, date: patch.date, ...(patch.time ? { time: patch.time } : {}) };
    const { sortTimestamp: _discardOldSort, ...withoutOldSort } = item;
    return {
      ...withoutOldSort,
      date: patch.date,
      ...(patch.time ? { time: patch.time } : {}),
      selectionRef: nextReference,
      dateNeedsReview: undefined,
    };
  });
  const destinations = snapshot.destinations.map((group, index) => index === patch.destinationIndex ? { ...group, items: updatedItems } : group);
  const timeSummary = patch.time ? ` at ${patch.time}` : ` (time remains ${previousTime})`;
  return {
    snapshot: { ...snapshot, destinations },
    summary: `Moved ${target.title} from ${previousDate} ${previousTime} to ${patch.date}${timeSummary}.`,
  };
}
