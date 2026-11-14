/** Category checks shared by provider normalization and deterministic assistant answers. */
export function isRestaurantCategory(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[·/;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // A provider may combine unrelated map features with a food category
  // (for example "building / catering · restaurant"). Reject those mixed
  // records instead of letting a positive word override an infrastructure type.
  if (/\b(?:building|street|road|highway|residential|house|address|postcode|administrative area|boundary|route|parking lot|parking garage)\b/i.test(normalized)) return false;
  // Do not accept a bare "catering" or generic place category. Restaurant,
  // cafe and prepared-food categories are explicit enough to show.
  return /\b(?:restaurant|cafe|cafeteria|bistro|pizzeria|pizza restaurant|diner|eatery|tapas|seafood restaurant|grill|brasserie|gastropub|food court|fast food|bakery|sandwich shop|bar and grill)\b/i.test(normalized);
}

export function isUsefulActivityCategory(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[·/;,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Reject map infrastructure/address features, but keep broad, legitimate
  // attraction types such as parks, museums, landmarks and tourist sights.
  if (/\b(?:building|street|road|highway|residential|house|address|postcode|administrative area|boundary|route|parking lot|parking garage)\b/i.test(normalized)) return false;
  return true;
}

export function localPlaceDedupeKey(input: {
  name: string;
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  const name = input.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const address = (input.address ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (typeof input.latitude === "number" && Number.isFinite(input.latitude)
    && typeof input.longitude === "number" && Number.isFinite(input.longitude)) {
    return `${name}|${input.latitude.toFixed(4)},${input.longitude.toFixed(4)}`;
  }
  return `${name}|${address}`;
}

export function sortByStraightLineProximity<T extends { latitude?: number | null; longitude?: number | null }>(
  items: readonly T[],
  origin?: { latitude: number; longitude: number } | null,
): T[] {
  if (!origin || !Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)) return [...items];
  const rad = (value: number) => value * Math.PI / 180;
  const miles = (item: T): number | null => {
    if (typeof item.latitude !== "number" || !Number.isFinite(item.latitude)
      || typeof item.longitude !== "number" || !Number.isFinite(item.longitude)) return null;
    const dLat = rad(item.latitude - origin.latitude);
    const dLon = rad(item.longitude - origin.longitude);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(rad(origin.latitude)) * Math.cos(rad(item.latitude)) * Math.sin(dLon / 2) ** 2;
    return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  return items.map((item, index) => ({ item, index, distance: miles(item) }))
    .sort((a, b) => {
      if (a.distance === null && b.distance === null) return a.index - b.index;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance || a.index - b.index;
    })
    .map(({ item }) => item);
}
