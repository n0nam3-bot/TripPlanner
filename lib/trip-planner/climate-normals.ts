/**
 * Historical monthly average daytime highs (°F), used only for destination
 * matching. These are climate normals / multi-year monthly averages, not
 * forecasts. Coverage is intentionally explicit; unknown destinations are
 * never assigned an invented temperature.
 *
 * Sources and reference periods:
 * - Lisbon: IPMA 1991–2020 monthly mean daily maxima.
 * - Cancún: published 2010s monthly average highs.
 * - San Juan: published 2010–2019 monthly average highs.
 * - Mexico City: 2016–2025 monthly average highs.
 * - Punta Cana: monthly day-high ranges published from climate-normal sources.
 * - Orlando: NOAA 1991–2020 station normals.
 * - New Orleans: NWS 1991–2020 New Orleans Lakefront normals.
 * - Barcelona: 1991–2020 Barcelona/Aeropuerto normals.
 * - Paris: Météo-France 1991–2020 Paris-Montsouris normals.
 * - London: Met Office 1991–2020 Heathrow normals.
 * - Rome: WMO 1991–2020 Ciampino normals.
 * - Tokyo: Japan Meteorological Agency 1991–2020 normals.
 * - Kyoto: JMA 1991–2020 Kyoto station normals.
 * - Reykjavík: WMO 1991–2020 Reykjavík station normals.
 * - Vancouver and Montréal: Environment and Climate Change Canada 1991–2020 normals.
 * - Aruba: NOAA GSOD 1991–2020 Queen Beatrix Airport normals.
 * - Amalfi Coast uses Naples airport normals as a nearby regional proxy.
 */
const MONTHLY_DAYTIME_HIGH_F: Record<string, readonly number[]> = {
  lisbon: [59, 61, 66, 69, 74, 79, 83, 84, 80, 73, 65, 60],
  cancun: [83, 85, 87, 90, 92, 93, 94, 95, 93, 89, 86, 84],
  "san-juan": [84, 84, 85, 87, 87, 89, 89, 89, 89, 89, 86, 85],
  "mexico-city": [72, 76, 80, 82, 82, 77, 73, 73, 72, 73, 74, 72],
  "punta-cana": [82, 82, 84, 84, 86, 88, 88, 88, 88, 86, 86, 84],
  orlando: [72, 75, 79, 84, 88, 91, 92, 92, 90, 85, 78, 74],
  "new-orleans": [61, 65, 71, 78, 85, 89, 91, 91, 87, 79, 70, 63],
  barcelona: [58, 58, 62, 66, 72, 79, 84, 85, 80, 73, 64, 58],
  paris: [46, 48, 55, 62, 68, 74, 78, 78, 71, 62, 52, 46],
  london: [47, 48, 53, 59, 65, 71, 75, 74, 68, 60, 53, 48],
  rome: [54, 55, 60, 66, 74, 83, 88, 89, 80, 72, 62, 55],
  naples: [56, 57, 62, 67, 75, 82, 87, 88, 80, 73, 65, 58],
  tokyo: [50, 52, 58, 67, 74, 79, 86, 88, 82, 72, 62, 54],
  kyoto: [48, 50, 57, 68, 77, 83, 90, 93, 85, 74, 63, 53],
  reykjavik: [38, 38, 40, 44, 50, 55, 59, 57, 53, 46, 41, 38],
  vancouver: [44, 46, 50, 56, 62, 67, 72, 72, 66, 56, 49, 44],
  montreal: [23, 26, 36, 52, 67, 76, 80, 78, 70, 56, 43, 30],
  aruba: [87, 87, 89, 90, 91, 91, 91, 92, 92, 91, 89, 87],
};

const CITY_KEYS: Record<string, string> = {
  "san juan": "san-juan",
  "mexico city": "mexico-city",
  "punta cana": "punta-cana",
  "new orleans": "new-orleans",
  "amalfi coast": "naples",
  "naples": "naples",
  "barcelona": "barcelona",
  "paris": "paris",
  "london": "london",
  "rome": "rome",
  "tokyo": "tokyo",
  "kyoto": "kyoto",
  "reykjavik": "reykjavik",
  "vancouver": "vancouver",
  "montreal": "montreal",
  "montréal": "montreal",
  "aruba": "aruba",
  "cancun": "cancun",
  "cancún": "cancun",
  lisbon: "lisbon",
  orlando: "orlando",
};

function normalize(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function profileKey(city: string, destinationId?: string): string | null {
  if (destinationId && MONTHLY_DAYTIME_HIGH_F[destinationId]) return destinationId;
  const cityKey = CITY_KEYS[normalize(city)];
  return cityKey && MONTHLY_DAYTIME_HIGH_F[cityKey] ? cityKey : null;
}

/** Average daily high across the trip dates, weighted by days in each month. */
export function getTypicalDaytimeHighF(city: string, startDate: string, endDate: string, destinationId?: string): number | null {
  const key = profileKey(city, destinationId);
  if (!key) return null;
  const profile = MONTHLY_DAYTIME_HIGH_F[key];
  const cursor = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) return null;
  let total = 0;
  let count = 0;
  while (cursor < end) {
    total += profile[cursor.getUTCMonth()];
    count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (count > 370) return null;
  }
  return count ? Math.round(total / count) : profile[new Date(`${startDate}T12:00:00Z`).getUTCMonth()];
}

export function toFahrenheit(value: number, unit: "F" | "C"): number {
  return unit === "C" ? (value * 9) / 5 + 32 : value;
}

