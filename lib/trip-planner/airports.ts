const CITY_CODES: Record<string, string> = {
  "new york": "NYC", "new york city": "NYC", "new york ny": "NYC", nyc: "NYC", "nyc metro": "NYC",
  "newark": "EWR", "newark nj": "EWR", "newark new jersey": "EWR",
  "manhattan": "NYC", "queens": "NYC", "john f kennedy": "JFK", "jfk airport": "JFK", "la guardia": "LGA",
  boston: "BOS", philadelphia: "PHL", philly: "PHL", "washington dc": "WAS", washington: "WAS", dc: "WAS",
  baltimore: "BWI", atlanta: "ATL", miami: "MIA", orlando: "MCO", tampa: "TPA", chicago: "CHI", "los angeles": "LAX",
  lax: "LAX", "san francisco": "SFO", seattle: "SEA", denver: "DEN", dallas: "DFW", houston: "IAH", phoenix: "PHX",
  charlotte: "CLT", detroit: "DTW", minneapolis: "MSP", "san diego": "SAN", austin: "AUS", nashville: "BNA",
  toronto: "YTO", montreal: "YUL", vancouver: "YVR", london: "LON", paris: "PAR", rome: "ROM", tokyo: "TYO",
  "las vegas": "LAS", "san juan": "SJU", cancun: "CUN", "mexico city": "MEX", "las terrenas": "AZS", samana: "AZS",
};

export function resolveAirportCode(input: string): string | null {
  const clean = input.trim();
  if (/^[a-zA-Z]{3}$/.test(clean)) return clean.toUpperCase();
  const normalized = clean.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/\s*\([^)]*\)\s*/g, " ").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return CITY_CODES[normalized] ?? null;
}
