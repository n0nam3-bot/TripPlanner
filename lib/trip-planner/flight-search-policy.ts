import { airportCountry } from "./flight-routing";

type FlightWithSegments = {
  stops: number;
  segments: Array<{ toAirportCode?: string }>;
};

type LayoverPreferences = {
  preferredLayoverCountries: string[];
  avoidLayoverCountries: string[];
};

/**
 * Apply country preferences using connection airports only. Unknown connection
 * countries are withheld only when the traveler has an explicit avoid list.
 */
export function applyLayoverPreferences<T extends FlightWithSegments>(
  flights: T[],
  preferences: LayoverPreferences,
): { flights: T[]; warnings: string[] } {
  const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const preferred = new Set(preferences.preferredLayoverCountries.map(normalize));
  const avoided = new Set(preferences.avoidLayoverCountries.map(normalize));
  if (!preferred.size && !avoided.size) return { flights, warnings: [] };

  let removedForAvoid = 0;
  let removedAsUnverified = 0;
  const ranked = flights.map((flight) => {
    // The final arrival airport is not a layover. Each earlier segment's arrival is.
    const connectionCodes = flight.segments.slice(0, -1).map((segment) => segment.toAirportCode);
    const connectionCountries = connectionCodes.map((code) => airportCountry(code));
    const hasUnverifiedConnection = connectionCodes.some((code, index) => !code || !connectionCountries[index]);
    const hasAvoidedCountry = connectionCountries.some((country) => country && avoided.has(normalize(country)));
    if (hasAvoidedCountry) removedForAvoid += 1;
    else if (avoided.size > 0 && hasUnverifiedConnection) removedAsUnverified += 1;
    const preferredMatches = connectionCountries.filter((country) => country && preferred.has(normalize(country))).length;
    return { flight, excluded: hasAvoidedCountry || (avoided.size > 0 && hasUnverifiedConnection), preferredMatches };
  });
  const kept = ranked.filter((entry) => !entry.excluded)
    .sort((a, b) => b.preferredMatches - a.preferredMatches)
    .map((entry) => entry.flight);
  const warnings: string[] = [
    "Connection preferences are checked only against stopover airports included in the returned flight options. They do not assess overflight airspace or replace official travel advisories, and the provider may not return every possible route.",
  ];
  if (removedForAvoid) warnings.push(`${removedForAvoid} flight option${removedForAvoid === 1 ? " was" : "s were"} removed because a connection airport is in a country on the avoid list.`);
  if (removedAsUnverified) warnings.push(`${removedAsUnverified} flight option${removedAsUnverified === 1 ? " was" : "s were"} withheld because Tripfinder could not verify the country for at least one connection airport. This avoids presenting an unverified route when you selected countries to avoid.`);
  if (preferred.size && kept.some((flight) => flight.stops > 0) && !kept.some((flight) => flight.segments.slice(0, -1).some((segment) => {
    const country = segment.toAirportCode ? airportCountry(segment.toAirportCode) : undefined;
    return country ? preferred.has(normalize(country)) : false;
  }))) warnings.push("No returned connection matched the preferred country. Other eligible routes are still shown; try another date or stop limit to compare more options.");
  return { flights: kept, warnings };
}
