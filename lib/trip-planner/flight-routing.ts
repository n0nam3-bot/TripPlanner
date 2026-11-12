/**
 * Shared airport metadata for connection preferences and destination-local
 * flight-time display. Unknown airports are deliberately left unclassified;
 * the UI must not claim an avoid-country filter was fully verified for them.
 */
export const LAYOVER_COUNTRY_OPTIONS = [
  "United States", "Canada", "Mexico", "Panama", "Colombia", "Brazil", "United Kingdom", "Ireland",
  "France", "Netherlands", "Belgium", "Germany", "Switzerland", "Austria", "Italy", "Spain", "Portugal",
  "Greece", "Turkey", "Iran", "Iraq", "Kuwait", "Bahrain", "Lebanon", "Syria", "Afghanistan", "Yemen", "Serbia", "Poland", "Czechia", "Hungary", "Romania", "Bulgaria", "Iceland", "Denmark",
  "Sweden", "Norway", "Finland", "United Arab Emirates", "Qatar", "Saudi Arabia", "Jordan", "Israel", "Egypt",
  "Morocco", "Ethiopia", "Kenya", "South Africa", "India", "Singapore", "Malaysia", "Thailand", "Hong Kong",
  "China", "Japan", "South Korea", "Taiwan", "Russia", "Belarus", "Ukraine", "Albania", "North Macedonia",
  "Montenegro", "Bosnia and Herzegovina", "Croatia", "Slovenia", "Latvia", "Lithuania", "Estonia", "Moldova",
  "Cyprus", "Luxembourg", "Slovakia", "Australia", "New Zealand", "Argentina", "Chile", "Peru", "Puerto Rico",
  "Dominican Republic", "Aruba", "Venezuela", "Ecuador", "Uruguay", "Costa Rica", "Jamaica", "Bahamas",
  "Barbados", "Curaçao", "Guyana", "El Salvador", "Guatemala", "Algeria", "Tunisia", "Ghana", "Nigeria", "Tanzania", "Mauritius", "Oman",
  "Georgia", "Armenia", "Uzbekistan", "Sri Lanka", "Philippines", "Indonesia", "Pakistan",
] as const;

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const AIRPORT_COUNTRIES: Record<string, string> = {
  // Caribbean and existing Tripfinder gateways
  PUJ: "Dominican Republic", SDQ: "Dominican Republic", POP: "Dominican Republic", STI: "Dominican Republic", LRM: "Dominican Republic", AZS: "Dominican Republic", CUN: "Mexico", MEX: "Mexico", SJU: "Puerto Rico", MBJ: "Jamaica", AUA: "Aruba", KEF: "Iceland", LIS: "Portugal", BCN: "Spain", PAR: "France", ROM: "Italy", TYO: "Japan",
  // United States and Canada
  NYC: "United States", JFK: "United States", LGA: "United States", EWR: "United States", BOS: "United States", PHL: "United States", BWI: "United States", IAD: "United States", DCA: "United States", ATL: "United States", MIA: "United States", MCO: "United States", TPA: "United States", ORD: "United States", MDW: "United States", LAX: "United States", SFO: "United States", SEA: "United States", DEN: "United States", DFW: "United States", IAH: "United States", PHX: "United States", CLT: "United States", DTW: "United States", MSP: "United States", SAN: "United States", AUS: "United States", BNA: "United States", LAS: "United States", MSY: "United States", SLC: "United States", PIT: "United States", RDU: "United States", ANC: "United States", HNL: "United States",
  YYZ: "Canada", YUL: "Canada", YVR: "Canada", YHZ: "Canada", YOW: "Canada",
  // Europe
  LHR: "United Kingdom", LGW: "United Kingdom", STN: "United Kingdom", MAN: "United Kingdom", EDI: "United Kingdom", BHX: "United Kingdom", DUB: "Ireland",
  CDG: "France", ORY: "France", NCE: "France", AMS: "Netherlands", BRU: "Belgium", FRA: "Germany", MUC: "Germany", BER: "Germany", DUS: "Germany", ZRH: "Switzerland", GVA: "Switzerland", VIE: "Austria", FCO: "Italy", MXP: "Italy", VCE: "Italy", MAD: "Spain", AGP: "Spain", OPO: "Portugal", ATH: "Greece", HER: "Greece", IST: "Turkey", SAW: "Turkey", AYT: "Turkey", ESB: "Turkey", BEG: "Serbia", WAW: "Poland", KRK: "Poland", PRG: "Czechia", BUD: "Hungary", OTP: "Romania", SOF: "Bulgaria", CPH: "Denmark", ARN: "Sweden", OSL: "Norway", HEL: "Finland", TIA: "Albania", SKP: "North Macedonia", TGD: "Montenegro", SJJ: "Bosnia and Herzegovina", ZAG: "Croatia", LJU: "Slovenia", RIX: "Latvia", VNO: "Lithuania", TLL: "Estonia", KIV: "Moldova", SVO: "Russia", DME: "Russia", LED: "Russia", MSQ: "Belarus", KBP: "Ukraine",
  // Middle East and Africa
  IKA: "Iran", MHD: "Iran", BGW: "Iraq", EBL: "Iraq", KWI: "Kuwait", BAH: "Bahrain", BEY: "Lebanon", DAM: "Syria", KBL: "Afghanistan", SAH: "Yemen",
  DXB: "United Arab Emirates", AUH: "United Arab Emirates", DOH: "Qatar", RUH: "Saudi Arabia", JED: "Saudi Arabia", DMM: "Saudi Arabia", AMM: "Jordan", TLV: "Israel", CAI: "Egypt", CMN: "Morocco", RAK: "Morocco", ADD: "Ethiopia", NBO: "Kenya", JNB: "South Africa", CPT: "South Africa",
  // Asia-Pacific
  DEL: "India", BOM: "India", BLR: "India", SIN: "Singapore", KUL: "Malaysia", BKK: "Thailand", HKT: "Thailand", HKG: "Hong Kong", PEK: "China", PVG: "China", CAN: "China", TPE: "Taiwan", NRT: "Japan", HND: "Japan", KIX: "Japan", ICN: "South Korea", GMP: "South Korea", SYD: "Australia", MEL: "Australia", AKL: "New Zealand",
  // Central and South America
  PTY: "Panama", BOG: "Colombia", MDE: "Colombia", GRU: "Brazil", GIG: "Brazil", EZE: "Argentina", SCL: "Chile", LIM: "Peru",
  // Additional common North American gateways
  FLL: "United States", PBI: "United States", JAX: "United States", SAV: "United States", BHM: "United States", BUF: "United States", CLE: "United States", CMH: "United States", IND: "United States", STL: "United States", MCI: "United States", MKE: "United States", SDF: "United States", RIC: "United States", ORF: "United States", BDL: "United States", SAT: "United States", SMF: "United States", TUS: "United States", FAI: "United States", OGG: "United States", KOA: "United States", YYC: "Canada",
  // Additional international connection airports
  GDN: "Poland", LUX: "Luxembourg", LCA: "Cyprus", SKG: "Greece", TBS: "Georgia", EVN: "Armenia", TAS: "Uzbekistan", CMB: "Sri Lanka", MNL: "Philippines", DPS: "Indonesia", KHI: "Pakistan", KTW: "Poland", SPU: "Croatia", DBV: "Croatia", TIV: "Montenegro", OHD: "North Macedonia", MCT: "Oman", ALG: "Algeria", TUN: "Tunisia", LOS: "Nigeria", ACC: "Ghana", DAR: "Tanzania", MRU: "Mauritius", BGI: "Barbados", NAS: "Bahamas", CUR: "Curaçao", GEO: "Guyana", UIO: "Ecuador", MVD: "Uruguay", SJO: "Costa Rica", SAL: "El Salvador", GUA: "Guatemala",
};

export const AIRPORT_TIMEZONES: Record<string, string> = {
  // Caribbean and existing Tripfinder gateways
  PUJ: "America/Santo_Domingo", SDQ: "America/Santo_Domingo", POP: "America/Santo_Domingo", STI: "America/Santo_Domingo", LRM: "America/Santo_Domingo", AZS: "America/Santo_Domingo", CUN: "America/Cancun", MEX: "America/Mexico_City", SJU: "America/Puerto_Rico", MBJ: "America/Jamaica", AUA: "America/Aruba", KEF: "Atlantic/Reykjavik", LIS: "Europe/Lisbon", BCN: "Europe/Madrid", PAR: "Europe/Paris", ROM: "Europe/Rome", TYO: "Asia/Tokyo",
  // North America
  NYC: "America/New_York", JFK: "America/New_York", LGA: "America/New_York", EWR: "America/New_York", BOS: "America/New_York", PHL: "America/New_York", BWI: "America/New_York", IAD: "America/New_York", DCA: "America/New_York", ATL: "America/New_York", CLT: "America/New_York", DTW: "America/Detroit", PIT: "America/New_York", RDU: "America/New_York", MIA: "America/New_York", MCO: "America/New_York", TPA: "America/New_York", ORD: "America/Chicago", MDW: "America/Chicago", DFW: "America/Chicago", IAH: "America/Chicago", MSY: "America/Chicago", AUS: "America/Chicago", BNA: "America/Chicago", MSP: "America/Chicago", DEN: "America/Denver", SLC: "America/Denver", PHX: "America/Phoenix", LAX: "America/Los_Angeles", SFO: "America/Los_Angeles", SEA: "America/Los_Angeles", SAN: "America/Los_Angeles", LAS: "America/Los_Angeles", ANC: "America/Anchorage", HNL: "Pacific/Honolulu",
  YYZ: "America/Toronto", YUL: "America/Toronto", YVR: "America/Vancouver", YYC: "America/Edmonton",
  // Europe
  LHR: "Europe/London", LGW: "Europe/London", STN: "Europe/London", MAN: "Europe/London", EDI: "Europe/London", DUB: "Europe/Dublin", BHX: "Europe/London", CDG: "Europe/Paris", ORY: "Europe/Paris", NCE: "Europe/Paris", AMS: "Europe/Amsterdam", BRU: "Europe/Brussels", FRA: "Europe/Berlin", MUC: "Europe/Berlin", BER: "Europe/Berlin", DUS: "Europe/Berlin", ZRH: "Europe/Zurich", GVA: "Europe/Zurich", VIE: "Europe/Vienna", FCO: "Europe/Rome", MXP: "Europe/Rome", VCE: "Europe/Rome", MAD: "Europe/Madrid", AGP: "Europe/Madrid", OPO: "Europe/Lisbon", ATH: "Europe/Athens", HER: "Europe/Athens", IST: "Europe/Istanbul", SAW: "Europe/Istanbul", AYT: "Europe/Istanbul", ESB: "Europe/Istanbul", BEG: "Europe/Belgrade", WAW: "Europe/Warsaw", KRK: "Europe/Warsaw", PRG: "Europe/Prague", BUD: "Europe/Budapest", OTP: "Europe/Bucharest", SOF: "Europe/Sofia", CPH: "Europe/Copenhagen", ARN: "Europe/Stockholm", OSL: "Europe/Oslo", HEL: "Europe/Helsinki", TIA: "Europe/Tirane", SKP: "Europe/Skopje", TGD: "Europe/Podgorica", SJJ: "Europe/Sarajevo", ZAG: "Europe/Zagreb", LJU: "Europe/Ljubljana", RIX: "Europe/Riga", VNO: "Europe/Vilnius", TLL: "Europe/Tallinn", KIV: "Europe/Chisinau", SVO: "Europe/Moscow", DME: "Europe/Moscow", LED: "Europe/Moscow", MSQ: "Europe/Minsk", KBP: "Europe/Kyiv",
  // Middle East and Africa
  IKA: "Asia/Tehran", MHD: "Asia/Tehran", BGW: "Asia/Baghdad", EBL: "Asia/Baghdad", KWI: "Asia/Kuwait", BAH: "Asia/Bahrain", BEY: "Asia/Beirut", DAM: "Asia/Damascus", KBL: "Asia/Kabul", SAH: "Asia/Aden",
  DXB: "Asia/Dubai", AUH: "Asia/Dubai", DOH: "Asia/Qatar", RUH: "Asia/Riyadh", JED: "Asia/Riyadh", DMM: "Asia/Riyadh", AMM: "Asia/Amman", TLV: "Asia/Jerusalem", CAI: "Africa/Cairo", CMN: "Africa/Casablanca", RAK: "Africa/Casablanca", ADD: "Africa/Addis_Ababa", NBO: "Africa/Nairobi", JNB: "Africa/Johannesburg", CPT: "Africa/Johannesburg",
  // Asia-Pacific
  DEL: "Asia/Kolkata", BOM: "Asia/Kolkata", BLR: "Asia/Kolkata", SIN: "Asia/Singapore", KUL: "Asia/Kuala_Lumpur", BKK: "Asia/Bangkok", HKT: "Asia/Bangkok", HKG: "Asia/Hong_Kong", PEK: "Asia/Shanghai", PVG: "Asia/Shanghai", CAN: "Asia/Shanghai", TPE: "Asia/Taipei", NRT: "Asia/Tokyo", HND: "Asia/Tokyo", KIX: "Asia/Tokyo", ICN: "Asia/Seoul", GMP: "Asia/Seoul", SYD: "Australia/Sydney", MEL: "Australia/Melbourne", AKL: "Pacific/Auckland",
  // Central and South America
  PTY: "America/Panama", BOG: "America/Bogota", MDE: "America/Bogota", GRU: "America/Sao_Paulo", GIG: "America/Sao_Paulo", EZE: "America/Argentina/Buenos_Aires", SCL: "America/Santiago", LIM: "America/Lima",
  // Additional common North American gateways
  FLL: "America/New_York", PBI: "America/New_York", JAX: "America/New_York", SAV: "America/New_York", BHM: "America/Chicago", BUF: "America/New_York", CLE: "America/New_York", CMH: "America/New_York", IND: "America/Indiana/Indianapolis", STL: "America/Chicago", MCI: "America/Chicago", MKE: "America/Chicago", SDF: "America/Kentucky/Louisville", RIC: "America/New_York", ORF: "America/New_York", BDL: "America/New_York", SAT: "America/Chicago", SMF: "America/Los_Angeles", TUS: "America/Phoenix", FAI: "America/Anchorage", OGG: "Pacific/Honolulu", KOA: "Pacific/Honolulu", YOW: "America/Toronto", YHZ: "America/Halifax",
  // Additional international connection airports
  GDN: "Europe/Warsaw", LUX: "Europe/Luxembourg", LCA: "Asia/Nicosia", SKG: "Europe/Athens", TBS: "Asia/Tbilisi", EVN: "Asia/Yerevan", TAS: "Asia/Tashkent", CMB: "Asia/Colombo", MNL: "Asia/Manila", DPS: "Asia/Makassar", KHI: "Asia/Karachi", KTW: "Europe/Warsaw", SPU: "Europe/Zagreb", DBV: "Europe/Zagreb", TIV: "Europe/Podgorica", OHD: "Europe/Skopje", MCT: "Asia/Muscat", ALG: "Africa/Algiers", TUN: "Africa/Tunis", LOS: "Africa/Lagos", ACC: "Africa/Accra", DAR: "Africa/Dar_es_Salaam", MRU: "Indian/Mauritius", BGI: "America/Barbados", NAS: "America/Nassau", CUR: "America/Curacao", GEO: "America/Guyana", UIO: "America/Guayaquil", MVD: "America/Montevideo", SJO: "America/Costa_Rica", SAL: "America/El_Salvador", GUA: "America/Guatemala",
};

export function airportCountry(code?: string): string | undefined {
  return code ? AIRPORT_COUNTRIES[code.toUpperCase()] : undefined;
}

export function airportTimeZone(code?: string): string | undefined {
  return code ? AIRPORT_TIMEZONES[code.toUpperCase()] : undefined;
}

function parseWallTime(value?: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] || 0) };
}

function airportWallTimeToInstant(value: string, zone: string): Date | null {
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())) {
    const instant = new Date(value);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }
  const parts = parseWallTime(value);
  if (!parts) return null;
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let guess = wallAsUtc;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const inZone = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const representedAsUtc = Date.UTC(inZone.year, inZone.month - 1, inZone.day, inZone.hour, inZone.minute, inZone.second);
    const adjusted = wallAsUtc - (representedAsUtc - guess);
    if (adjusted === guess) break;
    guess = adjusted;
  }
  const instant = new Date(guess);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function formatAirportLocalFallback(value: string, sourceCode?: string): string {
  const parts = parseWallTime(value);
  if (!parts) {
    if (!value) return "Time not listed";
    return sourceCode && value !== "Time not listed" ? `${value} (local at ${sourceCode.toUpperCase()})` : value;
  }
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
  const time = `${parts.hour % 12 || 12}:${String(parts.minute).padStart(2, "0")} ${parts.hour >= 12 ? "PM" : "AM"}`;
  return `${day} · ${time}${sourceCode ? ` (local at ${sourceCode.toUpperCase()})` : " (airport local)"}`;
}

export function formatFlightTimeInDestination(value: string, sourceAirportCode: string | undefined, destinationAirportCode: string): string {
  const targetZone = airportTimeZone(destinationAirportCode);
  const sourceZone = airportTimeZone(sourceAirportCode);
  if (!targetZone || !sourceZone) return formatAirportLocalFallback(value, sourceAirportCode);
  const instant = airportWallTimeToInstant(value, sourceZone);
  if (!instant) return formatAirportLocalFallback(value, sourceAirportCode);
  return new Intl.DateTimeFormat("en-US", { timeZone: targetZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(instant);
}

export function destinationTimezoneNotice(destinationName: string, destinationAirportCode: string, referenceDate: string): string {
  const zone = airportTimeZone(destinationAirportCode);
  if (!zone) return `Destination timezone for ${destinationName} is not mapped yet. Any unconverted times are labeled with the airport they belong to.`;
  const reference = new Date(`${referenceDate}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(reference);
  const abbreviation = parts.find((part) => part.type === "timeZoneName")?.value || zone;
  return `All flight times are shown in ${destinationName} local time. Time zone: ${zone} (${abbreviation} on ${referenceDate}). Times that cannot be converted are labeled with their source airport.`;
}

function wallTimeToMillis(value: string, airportCode?: string): number | null {
  const zone = airportTimeZone(airportCode);
  if (!zone) return null;
  return airportWallTimeToInstant(value, zone)?.getTime() ?? null;
}

export function flightLayoverDuration(arrival: string, nextDeparture: string, connectingAirportCode?: string): string | null {
  const arrivalMs = wallTimeToMillis(arrival, connectingAirportCode);
  const departureMs = wallTimeToMillis(nextDeparture, connectingAirportCode);
  if (arrivalMs === null || departureMs === null) return null;
  const minutes = Math.round((departureMs - arrivalMs) / 60000);
  if (minutes < 0 || minutes > 36 * 60) return null;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
