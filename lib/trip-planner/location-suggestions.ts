export type LocationSuggestion = {
  value: string;
  label: string;
  detail: string;
  kind: "city" | "airport" | "region" | "attraction";
  airportCode: string;
  country: string;
};

const DESTINATION_LOCATIONS: LocationSuggestion[] = [
  { value: "Lisbon, Portugal", label: "Lisbon", detail: "Portugal · Humberto Delgado Airport", kind: "city", airportCode: "LIS", country: "Portugal" },
  { value: "Cancún, Mexico", label: "Cancún", detail: "Mexico · Cancún International Airport", kind: "city", airportCode: "CUN", country: "Mexico" },
  { value: "Mexico City, Mexico", label: "Mexico City", detail: "Mexico · Mexico City International Airport", kind: "city", airportCode: "MEX", country: "Mexico" },
  { value: "Punta Cana, Dominican Republic", label: "Punta Cana", detail: "Dominican Republic · Punta Cana International Airport", kind: "city", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Santo Domingo, Dominican Republic", label: "Santo Domingo", detail: "Dominican Republic · Las Américas International Airport", kind: "city", airportCode: "SDQ", country: "Dominican Republic" },
  { value: "Puerto Plata, Dominican Republic", label: "Puerto Plata", detail: "Dominican Republic · Gregorio Luperón International Airport", kind: "city", airportCode: "POP", country: "Dominican Republic" },
  { value: "Santiago de los Caballeros, Dominican Republic", label: "Santiago de los Caballeros", detail: "Dominican Republic · Cibao International Airport", kind: "city", airportCode: "STI", country: "Dominican Republic" },
  { value: "La Romana, Dominican Republic", label: "La Romana", detail: "Dominican Republic · La Romana International Airport", kind: "city", airportCode: "LRM", country: "Dominican Republic" },
  { value: "Las Terrenas, Dominican Republic", label: "Las Terrenas", detail: "Samaná Peninsula · Samaná El Catey International Airport (AZS)", kind: "city", airportCode: "AZS", country: "Dominican Republic" },
  { value: "San Juan, Puerto Rico", label: "San Juan", detail: "Puerto Rico · Luis Muñoz Marín International Airport", kind: "city", airportCode: "SJU", country: "Puerto Rico" },
  { value: "Montego Bay, Jamaica", label: "Montego Bay", detail: "Jamaica · Sangster International Airport", kind: "city", airportCode: "MBJ", country: "Jamaica" },
  { value: "Orlando, United States", label: "Orlando", detail: "United States · Orlando International Airport", kind: "city", airportCode: "MCO", country: "United States" },
  { value: "New Orleans, United States", label: "New Orleans", detail: "United States · Louis Armstrong International Airport", kind: "city", airportCode: "MSY", country: "United States" },
  { value: "Barcelona, Spain", label: "Barcelona", detail: "Spain · Barcelona–El Prat Airport", kind: "city", airportCode: "BCN", country: "Spain" },
  { value: "Paris, France", label: "Paris", detail: "France · Charles de Gaulle / Orly airports", kind: "city", airportCode: "PAR", country: "France" },
  { value: "Rome, Italy", label: "Rome", detail: "Italy · Fiumicino / Ciampino airports", kind: "city", airportCode: "ROM", country: "Italy" },
  { value: "London, United Kingdom", label: "London", detail: "United Kingdom · Multiple airports", kind: "city", airportCode: "LON", country: "United Kingdom" },
  { value: "Tokyo, Japan", label: "Tokyo", detail: "Japan · Haneda / Narita airports", kind: "city", airportCode: "TYO", country: "Japan" },
  { value: "Reykjavík, Iceland", label: "Reykjavík", detail: "Iceland · Keflavík International Airport", kind: "city", airportCode: "KEF", country: "Iceland" },
  { value: "Aruba", label: "Aruba", detail: "Queen Beatrix International Airport", kind: "city", airportCode: "AUA", country: "Aruba" },
  { value: "Vancouver, Canada", label: "Vancouver", detail: "Canada · Vancouver International Airport", kind: "city", airportCode: "YVR", country: "Canada" },
  { value: "Montréal, Canada", label: "Montréal", detail: "Canada · Montréal–Trudeau Airport", kind: "city", airportCode: "YUL", country: "Canada" },
  { value: "Boston, United States", label: "Boston", detail: "United States · Logan International Airport", kind: "city", airportCode: "BOS", country: "United States" },
  { value: "Philadelphia, United States", label: "Philadelphia", detail: "United States · Philadelphia International Airport", kind: "city", airportCode: "PHL", country: "United States" },
  { value: "Miami, United States", label: "Miami", detail: "United States · Miami International Airport", kind: "city", airportCode: "MIA", country: "United States" },
  { value: "Los Angeles, United States", label: "Los Angeles", detail: "United States · Los Angeles International Airport", kind: "city", airportCode: "LAX", country: "United States" },
  { value: "Chicago, United States", label: "Chicago", detail: "United States · O’Hare / Midway airports", kind: "city", airportCode: "CHI", country: "United States" },
  { value: "San Francisco, United States", label: "San Francisco", detail: "United States · San Francisco International Airport", kind: "city", airportCode: "SFO", country: "United States" },
  { value: "Atlanta, United States", label: "Atlanta", detail: "United States · Hartsfield–Jackson Airport", kind: "city", airportCode: "ATL", country: "United States" },
  { value: "Washington, United States", label: "Washington", detail: "United States · DCA / IAD / BWI", kind: "city", airportCode: "WAS", country: "United States" },
];

const DESTINATION_REGIONS: LocationSuggestion[] = [
  { value: "Dominican Republic", label: "Dominican Republic", detail: "Country · choose a gateway airport if searching flights", kind: "region", airportCode: "", country: "Dominican Republic" },
  { value: "Mexico", label: "Mexico", detail: "Country · choose a city for flights, or search stays and places country-wide", kind: "region", airportCode: "", country: "Mexico" },
  { value: "Portugal", label: "Portugal", detail: "Country · choose a gateway airport if searching flights", kind: "region", airportCode: "", country: "Portugal" },
  { value: "Puerto Rico", label: "Puerto Rico", detail: "Island territory · San Juan is the main flight gateway", kind: "region", airportCode: "", country: "Puerto Rico" },
  { value: "Jamaica", label: "Jamaica", detail: "Country · choose an arrival airport for flights", kind: "region", airportCode: "", country: "Jamaica" },
  { value: "United States", label: "United States", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "United States" },
  { value: "Canada", label: "Canada", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "Canada" },
  { value: "France", label: "France", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "France" },
  { value: "Italy", label: "Italy", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "Italy" },
  { value: "Spain", label: "Spain", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "Spain" },
  { value: "Japan", label: "Japan", detail: "Country · choose a city or airport for flights", kind: "region", airportCode: "", country: "Japan" },
];


const DESTINATION_ATTRACTIONS: LocationSuggestion[] = [
  { value: "Bávaro Beach, Punta Cana, Dominican Republic", label: "Bávaro Beach", detail: "Beach · Punta Cana · Punta Cana Airport (PUJ)", kind: "attraction", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Saona Island, Dominican Republic", label: "Saona Island", detail: "Island excursion · Dominican Republic · Punta Cana (PUJ)", kind: "attraction", airportCode: "PUJ", country: "Dominican Republic" },
  { value: "Altos de Chavón, La Romana, Dominican Republic", label: "Altos de Chavón", detail: "Historic village · La Romana · LRM", kind: "attraction", airportCode: "LRM", country: "Dominican Republic" },
  { value: "Colonial Zone, Santo Domingo, Dominican Republic", label: "Colonial Zone", detail: "Historic district · Santo Domingo · SDQ", kind: "attraction", airportCode: "SDQ", country: "Dominican Republic" },
  { value: "27 Waterfalls of Damajagua, Puerto Plata, Dominican Republic", label: "27 Waterfalls of Damajagua", detail: "Outdoor attraction · Puerto Plata · POP", kind: "attraction", airportCode: "POP", country: "Dominican Republic" },
  { value: "Isla Mujeres, Quintana Roo, Mexico", label: "Isla Mujeres", detail: "Island · Cancún area · CUN", kind: "attraction", airportCode: "CUN", country: "Mexico" },
  { value: "Tulum Archaeological Zone, Mexico", label: "Tulum Ruins", detail: "Archaeological site · Riviera Maya · CUN", kind: "attraction", airportCode: "CUN", country: "Mexico" },
  { value: "Chichén Itzá, Yucatán, Mexico", label: "Chichén Itzá", detail: "Archaeological site · Yucatán · CUN", kind: "attraction", airportCode: "CUN", country: "Mexico" },
  { value: "Playa del Carmen, Quintana Roo, Mexico", label: "Playa del Carmen", detail: "Beach town · Riviera Maya · CUN", kind: "attraction", airportCode: "CUN", country: "Mexico" },
  { value: "Dunn's River Falls, Ocho Rios, Jamaica", label: "Dunn’s River Falls", detail: "Waterfall attraction · Ocho Rios · MBJ", kind: "attraction", airportCode: "MBJ", country: "Jamaica" },
  { value: "Seven Mile Beach, Negril, Jamaica", label: "Seven Mile Beach", detail: "Beach · Negril · MBJ", kind: "attraction", airportCode: "MBJ", country: "Jamaica" },
  { value: "Old San Juan, Puerto Rico", label: "Old San Juan", detail: "Historic district · San Juan · SJU", kind: "attraction", airportCode: "SJU", country: "Puerto Rico" },
  { value: "El Yunque National Forest, Puerto Rico", label: "El Yunque National Forest", detail: "National forest · Puerto Rico · SJU", kind: "attraction", airportCode: "SJU", country: "Puerto Rico" },
  { value: "Sintra, Portugal", label: "Sintra", detail: "Historic town and palaces · Lisbon area · LIS", kind: "attraction", airportCode: "LIS", country: "Portugal" },
  { value: "Belém, Lisbon, Portugal", label: "Belém", detail: "Historic waterfront · Lisbon · LIS", kind: "attraction", airportCode: "LIS", country: "Portugal" },
  { value: "Sagrada Família, Barcelona, Spain", label: "Sagrada Família", detail: "Landmark · Barcelona · BCN", kind: "attraction", airportCode: "BCN", country: "Spain" },
];

export type DestinationGateway = { code: string; label: string; city: string };

const REGION_GATEWAYS: Record<string, DestinationGateway[]> = {
  "dominican republic": [
    { code: "PUJ", city: "Punta Cana", label: "Punta Cana · PUJ" },
    { code: "SDQ", city: "Santo Domingo", label: "Santo Domingo · SDQ" },
    { code: "POP", city: "Puerto Plata", label: "Puerto Plata · POP" },
    { code: "STI", city: "Santiago", label: "Santiago · STI" },
    { code: "LRM", city: "La Romana", label: "La Romana · LRM" },
    { code: "AZS", city: "Las Terrenas / Samaná", label: "Samaná El Catey · AZS" },
  ],
  mexico: [
    { code: "CUN", city: "Cancún", label: "Cancún · CUN" },
    { code: "MEX", city: "Mexico City", label: "Mexico City · MEX" },
  ],
  portugal: [{ code: "LIS", city: "Lisbon", label: "Lisbon · LIS" }],
  "puerto rico": [{ code: "SJU", city: "San Juan", label: "San Juan · SJU" }],
  jamaica: [{ code: "MBJ", city: "Montego Bay", label: "Montego Bay · MBJ" }],
  spain: [{ code: "BCN", city: "Barcelona", label: "Barcelona · BCN" }],
  france: [{ code: "PAR", city: "Paris", label: "Paris · PAR" }],
  italy: [{ code: "ROM", city: "Rome", label: "Rome · ROM" }],
  japan: [{ code: "TYO", city: "Tokyo", label: "Tokyo · TYO" }],
  "united states": [
    { code: "MCO", city: "Orlando", label: "Orlando · MCO" },
    { code: "MSY", city: "New Orleans", label: "New Orleans · MSY" },
  ],
  canada: [
    { code: "YVR", city: "Vancouver", label: "Vancouver · YVR" },
    { code: "YUL", city: "Montréal", label: "Montréal · YUL" },
  ],
};

const ORIGIN_AIRPORTS: LocationSuggestion[] = [
  { value: "New York (NYC)", label: "New York · All airports", detail: "New York metro · JFK, LaGuardia and Newark", kind: "city", airportCode: "NYC", country: "United States" },
  { value: "John F. Kennedy International Airport (JFK)", label: "John F. Kennedy International", detail: "Queens, New York · JFK", kind: "airport", airportCode: "JFK", country: "United States" },
  { value: "LaGuardia Airport (LGA)", label: "LaGuardia Airport", detail: "Queens, New York · LGA", kind: "airport", airportCode: "LGA", country: "United States" },
  { value: "Newark Liberty International Airport (EWR)", label: "Newark Liberty International", detail: "Newark, New Jersey · EWR", kind: "airport", airportCode: "EWR", country: "United States" },
  { value: "Boston Logan International (BOS)", label: "Boston Logan International", detail: "Boston, Massachusetts · BOS", kind: "airport", airportCode: "BOS", country: "United States" },
  { value: "Philadelphia International (PHL)", label: "Philadelphia International", detail: "Philadelphia, Pennsylvania · PHL", kind: "airport", airportCode: "PHL", country: "United States" },
  { value: "Baltimore/Washington International (BWI)", label: "Baltimore/Washington International", detail: "Baltimore, Maryland · BWI", kind: "airport", airportCode: "BWI", country: "United States" },
  { value: "Washington Dulles International (IAD)", label: "Washington Dulles International", detail: "Dulles, Virginia · IAD", kind: "airport", airportCode: "IAD", country: "United States" },
  { value: "Ronald Reagan Washington National (DCA)", label: "Ronald Reagan Washington National", detail: "Arlington, Virginia · DCA", kind: "airport", airportCode: "DCA", country: "United States" },
  { value: "Hartsfield–Jackson Atlanta (ATL)", label: "Hartsfield–Jackson Atlanta", detail: "Atlanta, Georgia · ATL", kind: "airport", airportCode: "ATL", country: "United States" },
  { value: "Miami International (MIA)", label: "Miami International", detail: "Miami, Florida · MIA", kind: "airport", airportCode: "MIA", country: "United States" },
  { value: "Orlando International (MCO)", label: "Orlando International", detail: "Orlando, Florida · MCO", kind: "airport", airportCode: "MCO", country: "United States" },
  { value: "Chicago O’Hare (ORD)", label: "Chicago O’Hare", detail: "Chicago, Illinois · ORD", kind: "airport", airportCode: "ORD", country: "United States" },
  { value: "Los Angeles International (LAX)", label: "Los Angeles International", detail: "Los Angeles, California · LAX", kind: "airport", airportCode: "LAX", country: "United States" },
  { value: "San Francisco International (SFO)", label: "San Francisco International", detail: "San Francisco, California · SFO", kind: "airport", airportCode: "SFO", country: "United States" },
];

function norm(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const AIRPORT_NAMES: Record<string, string> = {
  PUJ: "Punta Cana International Airport", SDQ: "Las Américas International Airport",
  POP: "Gregorio Luperón International Airport", STI: "Cibao International Airport",
  LRM: "La Romana International Airport", AZS: "Samaná El Catey International Airport", CUN: "Cancún International Airport",
  MEX: "Mexico City International Airport", LIS: "Humberto Delgado Airport",
  SJU: "Luis Muñoz Marín International Airport", MBJ: "Sangster International Airport",
  BCN: "Barcelona–El Prat Airport", PAR: "Paris Charles de Gaulle Airport",
  ROM: "Rome Fiumicino Airport", TYO: "Tokyo Haneda Airport", MCO: "Orlando International Airport",
  MSY: "Louis Armstrong New Orleans International Airport", YVR: "Vancouver International Airport",
  YUL: "Montréal–Trudeau International Airport",
};

export function getLocationSuggestions(
  query: string,
  field: "origin" | "destination",
  includeAttractions = false,
  includeAirports = false,
): LocationSuggestion[] {
  const q = norm(query);
  if (field === "origin") {
    const matches = q.length < 2
      ? ORIGIN_AIRPORTS.slice(0, 7)
      : ORIGIN_AIRPORTS.filter((item) => [item.value, item.label, item.detail, item.country, item.airportCode].some((value) => norm(value).includes(q)));
    return matches.slice(0, 10);
  }

  const matchingRegions = DESTINATION_REGIONS.filter((item) => q.length >= 2 && [item.value, item.label, item.country].some((value) => norm(value).includes(q)));
  const airportSuggestions: LocationSuggestion[] = includeAirports
    ? matchingRegions.flatMap((region) => getDestinationGateways(region.value).map((gateway) => ({
      // Keep the country-wide search area while storing the selected gateway
      // airport separately for flight lookup.
      value: region.value,
      label: AIRPORT_NAMES[gateway.code] ?? `${gateway.city} Airport`,
      detail: `${gateway.city} · ${gateway.code} · ${region.value}`,
      kind: "airport" as const,
      airportCode: gateway.code,
      country: region.value,
    })))
    : [];

  const source = [...DESTINATION_REGIONS, ...airportSuggestions, ...DESTINATION_LOCATIONS, ...(includeAttractions ? DESTINATION_ATTRACTIONS : [])];
  if (q.length < 2) return source.slice(0, 8);
  const matching = source.filter((item) => [item.value, item.label, item.detail, item.country, item.airportCode].some((value) => norm(value).includes(q)));
  return matching.sort((a, b) => {
    const rank = (item: LocationSuggestion) => item.kind === "region" ? 0 : item.kind === "airport" ? 1 : item.kind === "city" ? 2 : 3;
    const aCountry = norm(a.country) === q || norm(a.value) === q ? 0 : 1;
    const bCountry = norm(b.country) === q || norm(b.value) === q ? 0 : 1;
    // Preserve the curated gateway and attraction order inside each group so
    // the most relevant local choices stay first instead of alphabetically.
    return aCountry - bCountry || rank(a) - rank(b);
  }).slice(0, 20);
}

export function destinationMetadata(value: string): { city: string; country: string; airportCode: string } {
  const q = norm(value);
  const item = [...DESTINATION_LOCATIONS, ...DESTINATION_ATTRACTIONS].find((entry) => norm(entry.value) === q || norm(entry.label) === q || norm(entry.airportCode) === q);
  if (item) return { city: item.label, country: item.country, airportCode: item.airportCode };
  const region = DESTINATION_REGIONS.find((entry) => norm(entry.value) === q || norm(entry.label) === q);
  if (region) return { city: region.label, country: "", airportCode: "" };
  return { city: value.trim(), country: "", airportCode: "" };
}

export function countryForDestination(value: string): string | undefined {
  return destinationMetadata(value).country || undefined;
}

export const AIRPORT_COORDINATES: Record<string, { latitude: number; longitude: number; name: string }> = {
  CUN: { latitude: 21.0365, longitude: -86.8771, name: "Cancún International Airport" },
  PUJ: { latitude: 18.5674, longitude: -68.3634, name: "Punta Cana International Airport" },
  SDQ: { latitude: 18.4297, longitude: -69.6689, name: "Las Américas International Airport" },
  POP: { latitude: 19.7579, longitude: -70.5700, name: "Gregorio Luperón International Airport" },
  STI: { latitude: 19.4061, longitude: -70.6047, name: "Cibao International Airport" },
  LRM: { latitude: 18.4507, longitude: -68.9118, name: "La Romana International Airport" },
  AZS: { latitude: 19.2670, longitude: -69.7420, name: "Samaná El Catey International Airport" },
  SJU: { latitude: 18.4394, longitude: -66.0018, name: "Luis Muñoz Marín International Airport" },
  MBJ: { latitude: 18.5037, longitude: -77.9134, name: "Sangster International Airport" },
  LIS: { latitude: 38.7742, longitude: -9.1342, name: "Lisbon Airport" },
  MEX: { latitude: 19.4361, longitude: -99.0719, name: "Mexico City International Airport" },
  MCO: { latitude: 28.4312, longitude: -81.3081, name: "Orlando International Airport" },
  MSY: { latitude: 29.9934, longitude: -90.2580, name: "Louis Armstrong New Orleans International Airport" },
  BCN: { latitude: 41.2974, longitude: 2.0833, name: "Barcelona–El Prat Airport" },
  PAR: { latitude: 49.0097, longitude: 2.5479, name: "Paris Charles de Gaulle Airport" },
  ROM: { latitude: 41.8003, longitude: 12.2389, name: "Rome Fiumicino Airport" },
  LON: { latitude: 51.4700, longitude: -0.4543, name: "London Heathrow Airport" },
  TYO: { latitude: 35.5494, longitude: 139.7798, name: "Tokyo Haneda Airport" },
  KEF: { latitude: 63.9850, longitude: -22.6056, name: "Keflavík International Airport" },
  AUA: { latitude: 12.5014, longitude: -70.0152, name: "Queen Beatrix International Airport" },
  YVR: { latitude: 49.1967, longitude: -123.1815, name: "Vancouver International Airport" },
  YUL: { latitude: 45.4706, longitude: -73.7408, name: "Montréal–Trudeau International Airport" },
};
export function getDestinationGateways(value: string): DestinationGateway[] {
  return REGION_GATEWAYS[norm(value)] ?? [];
}

