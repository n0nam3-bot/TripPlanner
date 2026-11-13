export type ProximityStartingPoint = {
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  confidence: number;
  resultType?: string;
};

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

function cleanLocationText(value: string): string {
  return value.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().replace(/[.,;!?]+$/g, "").trim().slice(0, 180);
}

/** Recognize a traveler statement that sets their local base without requiring a hotel booking. */
export function extractStartingPointStatement(question: string): string | null {
  const value = cleanLocationText(question);
  const patterns = [
    /^(?:i['’]?m|i am|we['’]?re|we are|we will be|i will be)\s+(?:staying|based|located)\s+(?:at|in|near|around|by|are)\s+(.+)$/i,
    /^(?:my|our)\s+(?:starting point|base|hotel|airbnb|accommodation|place|venue)\s+(?:is|will be)\s+(.+)$/i,
    /^(?:use|set)\s+(.+?)\s+as\s+(?:my|our)\s+(?:starting point|base|origin)$/i,
    /^(?:i['’]?m|i am|we['’]?re|we are)\s+at\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    const location = match?.[1] ? cleanLocationText(match[1]) : "";
    if (location.length >= 4 && !/^(?:the hotel|my hotel|the stay|my stay|there|the destination)$/i.test(location)) return location;
  }
  return null;
}

/** Extract an explicitly named landmark from a proximity question when no base has been set yet. */
export function extractProximityAnchorQuestion(question: string): string | null {
  const value = cleanLocationText(question);
  const patterns = [
    /\b(?:closest|nearest|near|close)\s+(?:to|around|by)\s+(.+)$/i,
    /\b(?:restaurants?|dining|caf(?:e|es)?|activities|attractions|things to do)\b.{0,70}\b(?:near|around|close to)\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    const location = match?.[1] ? cleanLocationText(match[1]) : "";
    if (!location || location.length < 4) continue;
    if (/^(?:my|the)\s+(?:selected\s+)?(?:stay|hotel|property|rental|accommodation)$/i.test(location)) continue;
    if (/^(?:here|there|this place|that place|my location)$/i.test(location)) continue;
    return location;
  }
  return null;
}

export function isValidProximityStartingPoint(value: unknown): value is ProximityStartingPoint {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.label === "string" && row.label.trim().length >= 2
    && typeof row.address === "string" && row.address.trim().length >= 2
    && typeof row.latitude === "number" && Number.isFinite(row.latitude) && row.latitude >= -90 && row.latitude <= 90
    && typeof row.longitude === "number" && Number.isFinite(row.longitude) && row.longitude >= -180 && row.longitude <= 180
    && typeof row.confidence === "number" && Number.isFinite(row.confidence) && row.confidence >= 0 && row.confidence <= 1;
}
