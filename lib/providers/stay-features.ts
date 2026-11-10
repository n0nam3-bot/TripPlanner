import type { LiveHotel } from "@/lib/providers/serpapi";
import type { StayAmenity, StaySpaceType, StayType, TripSearchInput } from "@/lib/trip-planner/types";

const GOOGLE_HOTEL_AMENITY_IDS: Partial<Record<StayAmenity, string>> = {
  private_pool: "6",
  shared_pool: "6",
  pool: "6",
  indoor_pool: "4",
  heated_pool: "6",
  outdoor_pool: "5",
  free_parking: "1",
  pet_friendly: "19",
  beach_access: "11",
  gym: "7",
  wifi: "35",
  air_conditioning: "40",
};

const GOOGLE_RENTAL_AMENITY_IDS: Partial<Record<StayAmenity, string>> = {
  private_pool: "32",
  shared_pool: "32",
  pool: "32",
  indoor_pool: "32",
  heated_pool: "32",
  outdoor_pool: "32",
  hot_tub: "2",
  outdoor_grill: "6",
  kitchen: "15",
  fireplace: "10",
  balcony_terrace: "12",
  pet_friendly: "24",
  beach_access: "20",
  gym: "16",
  wifi: "29",
  air_conditioning: "4",
};


export const STAY_AMENITY_LABELS: Record<StayAmenity, string> = {
  private_pool: "Private pool",
  shared_pool: "Shared / community pool",
  pool: "Pool",
  indoor_pool: "Indoor pool",
  heated_pool: "Heated pool",
  outdoor_pool: "Outdoor pool",
  hot_tub: "Hot tub / Jacuzzi",
  sauna: "Sauna",
  outdoor_grill: "Outdoor grill / BBQ",
  kitchen: "Full kitchen",
  kitchenette: "Kitchenette",
  fireplace: "Fireplace",
  washer_dryer: "Washer and dryer",
  balcony_terrace: "Balcony / terrace",
  free_parking: "Free parking",
  pet_friendly: "Pet-friendly",
  beach_access: "Beach access",
  gym: "Gym / fitness center",
  wifi: "Wi-Fi",
  air_conditioning: "Air conditioning",
};

export function googleAmenityFilterIds(stayType: StayType, selected: StayAmenity[]): string[] {
  const source = stayType === "vacation_rentals" ? GOOGLE_RENTAL_AMENITY_IDS : GOOGLE_HOTEL_AMENITY_IDS;
  return [...new Set(selected.map((amenity) => source[amenity]).filter((id): id is string => Boolean(id)))];
}

function cleanLine(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function positiveLines(hotel: LiveHotel): string[] {
  return [
    ...hotel.amenities,
    ...hotel.essentialInfo,
    hotel.description ?? "",
  ].map(cleanLine).filter(Boolean);
}

function negativeLines(hotel: LiveHotel): string[] {
  return hotel.excludedAmenities.map(cleanLine).filter(Boolean);
}

function anyLine(lines: string[], pattern: RegExp): boolean {
  return lines.some((line) => pattern.test(line));
}

export function hasExplicitPrivatePool(hotel: LiveHotel): boolean {
  const negative = [...negativeLines(hotel), ...positiveLines(hotel)].some((line) =>
    /\bno\s+(?:private\s+)?(?:swimming\s+)?pool\b|\bno\s+private\s+pool\b|\bprivate\s+pool\s+(?:not\s+available|not\s+included|unavailable)\b|\bnot\s+a\s+private\s+pool\b/.test(line),
  );
  if (negative) return false;
  return positiveLines(hotel).some((line) => {
    const explicitlyPrivate = /\bprivate\s+(?:(?:indoor|outdoor|heated)\s+)?(?:swimming\s+)?pool\b|\bpool\s+for\s+private\s+use\b/.test(line);
    const sameMentionIsShared = /\b(?:shared|community|communal|common)\s+(?:(?:indoor|outdoor|heated)\s+)?(?:swimming\s+)?pool\b/.test(line)
      || /\bpool\b.{0,35}\b(?:shared|community|communal|common)\b/.test(line);
    return explicitlyPrivate && !sameMentionIsShared;
  });
}

export function hasExplicitSharedPool(hotel: LiveHotel): boolean {
  const negative = [...negativeLines(hotel), ...positiveLines(hotel)].some((line) => /\bno\s+(?:shared|community|communal|common)\s+(?:(?:indoor|outdoor|heated)\s+)?(?:swimming\s+)?pool\b/.test(line));
  if (negative) return false;
  return anyLine(positiveLines(hotel), /\b(?:shared|community|communal|common)\s+(?:(?:indoor|outdoor|heated)\s+)?(?:swimming\s+)?pool\b/);
}

export function poolAccessLabel(hotel: LiveHotel): string | null {
  const positive = positiveLines(hotel);
  const negative = [...negativeLines(hotel), ...positive];
  if (anyLine(negative, /\bno\s+(?:private\s+|shared\s+|community\s+|communal\s+)?(?:swimming\s+)?pool\b|\bpool\s+(?:not\s+available|unavailable)\b/)) return null;
  if (hasExplicitPrivatePool(hotel) && hasExplicitSharedPool(hotel)) return "Private pool listed · shared pool also listed";
  if (hasExplicitPrivatePool(hotel)) return "Private pool · explicitly listed";
  if (hasExplicitSharedPool(hotel)) return "Shared / community pool";
  if (anyLine(positive, /\b(indoor|outdoor|heated|swimming)?\s*pool\b/)) return "Pool listed · access type not specified";
  return null;
}

export function inferStaySpaceType(hotel: Pick<LiveHotel, "propertyType" | "essentialInfo" | "description" | "amenities">): Exclude<StaySpaceType, "any"> | "unknown" {
  const lines = [...hotel.essentialInfo, ...hotel.amenities, hotel.propertyType, hotel.description ?? ""].map(cleanLine);
  if (anyLine(lines, /\b(shared\s+room|shared\s+bedroom|shared\s+dorm(?:\s+room|itory)?|bed\s+in\s+(?:a\s+)?(?:shared\s+)?dorm(?:itory)?|dormitory\s+bed)\b/)) return "shared_room";
  if (anyLine(lines, /\b(private\s+room|room\s+in\s+(?:a\s+)?(?:home|apartment|house)|private\s+bedroom)\b/)) return "private_room";
  if (anyLine(lines, /\b(entire|whole)\s+(?:place|property|home|house|apartment|rental\s+unit|villa|condo|cottage|cabin|chalet|bungalow|townhouse|loft|guesthouse|guest\s+suite|vacation\s+home|serviced\s+apartment)\b/)) return "entire_place";
  return "unknown";
}

function isRentalOrUnclassifiedProperty(hotel: LiveHotel): boolean {
  if (hotel.inventoryTypes?.includes("vacation_rentals")) return true;
  if (hotel.inventoryTypes?.includes("hotels")) return false;
  // Defensive fallback for older cached rows that predate inventoryTypes.
  const type = cleanLine(hotel.propertyType);
  if (/\b(hotel|resort|inn|motel|hostel)\b/.test(type)) return false;
  return true;
}

export function stayAmenityConfirmed(hotel: LiveHotel, amenity: StayAmenity): boolean {
  const positive = positiveLines(hotel);
  const negative = negativeLines(hotel);
  const has = (pattern: RegExp) => anyLine(positive, pattern);
  const excluded = (pattern: RegExp) => anyLine([...negative, ...positive], pattern);
  switch (amenity) {
    case "private_pool": return hasExplicitPrivatePool(hotel);
    case "shared_pool": return hasExplicitSharedPool(hotel);
    case "pool": return !excluded(/\bno\s+(?:private\s+|shared\s+|community\s+|communal\s+)?(?:swimming\s+)?pool\b/) && has(/\bpool\b/);
    case "indoor_pool": return !excluded(/\bno\s+indoor\s+pool\b/) && has(/\bindoor\s+(?:swimming\s+)?pool\b/);
    case "heated_pool": return !excluded(/\bno\s+heated\s+pool\b/) && has(/\bheated\s+(?:swimming\s+)?pool\b/);
    case "outdoor_pool": return !excluded(/\bno\s+outdoor\s+pool\b/) && has(/\boutdoor\s+(?:swimming\s+)?pool\b/);
    case "hot_tub": return !excluded(/\bno\s+(?:hot\s+tub|jacuzzi|whirlpool)\b/) && has(/\bhot\s*tub\b|\bjacuzzi\b|\bwhirlpool\b/);
    case "sauna": return !excluded(/\bno\s+sauna\b/) && has(/\bsauna\b/);
    case "outdoor_grill": return !excluded(/\bno\s+(?:outdoor\s+)?(?:grill|barbecue|barbeque|bbq)\b/) && has(/\b(outdoor\s+)?grill\b|\bbarbecue\b|\bbarbeque\b|\bbbq\b/);
    case "kitchen": return !excluded(/\bno\s+(?:full\s+)?kitchen\b/) && has(/\b(full\s+)?kitchen\b/);
    case "kitchenette": return !excluded(/\bno\s+kitchenette\b/) && has(/\bkitchenette\b/);
    case "fireplace": return !excluded(/\bno\s+fireplace\b/) && has(/\bfireplace\b|\bwood[- ]burning stove\b/);
    case "washer_dryer": return !excluded(/\bno\s+(?:washer|washing machine|dryer)\b/) && has(/\bwasher\b|\bwashing machine\b/) && has(/\bdryer\b|\btumble dryer\b/);
    case "balcony_terrace": return !excluded(/\bno\s+(?:balcony|terrace|patio|deck)\b/) && has(/\bbalcony\b|\bterrace\b|\bpatio\b|\bdeck\b/);
    case "free_parking": return !excluded(/\bno\s+free parking\b/) && has(/\bfree parking\b|\bcomplimentary parking\b/);
    case "pet_friendly": return !excluded(/\bnot pet[- ]friendly\b|\bno pets\b|\bpets not allowed\b/) && has(/\bpet[- ]friendly\b|\bpets allowed\b|\bpets welcome\b/);
    case "beach_access": return !excluded(/\bno beach access\b/) && has(/\bbeach access\b|\bprivate beach access\b/);
    case "gym": return !excluded(/\bno (?:gym|fitness center|fitness centre)\b/) && has(/\bgym\b|\bfitness cent(?:er|re)\b/);
    case "wifi": return !excluded(/\bno (?:free )?wi[- ]?fi\b/) && has(/\bwi[- ]?fi\b|\bwireless internet\b/);
    case "air_conditioning": return !excluded(/\bno air[- ]conditioning\b/) && has(/\bair[- ]condition(?:ing|ed)\b|\ba\/c\b/);
  }
}

export function filterAndRankStays(
  hotels: LiveHotel[],
  input: Pick<TripSearchInput, "staySpaceType" | "stayMustHaveAmenities" | "stayPreferredAmenities">,
): { hotels: LiveHotel[]; excludedCount: number } {
  const ranked = hotels.map((hotel, index) => ({ hotel, index })).filter(({ hotel }) => {
    if (input.staySpaceType !== "any") {
      if (!isRentalOrUnclassifiedProperty(hotel)) return false;
      if (inferStaySpaceType(hotel) !== input.staySpaceType) return false;
    }
    return input.stayMustHaveAmenities.every((amenity) => stayAmenityConfirmed(hotel, amenity));
  }).map(({ hotel, index }) => ({
    hotel,
    index,
    preferenceScore: input.stayPreferredAmenities.reduce((score, amenity) => score + (stayAmenityConfirmed(hotel, amenity) ? 1 : 0), 0),
  }));
  ranked.sort((left, right) => right.preferenceScore - left.preferenceScore || left.index - right.index);
  return { hotels: ranked.map((entry) => entry.hotel), excludedCount: hotels.length - ranked.length };
}
