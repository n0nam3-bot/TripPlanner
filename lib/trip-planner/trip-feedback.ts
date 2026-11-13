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
