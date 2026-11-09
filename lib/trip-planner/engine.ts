import { DESTINATIONS, findDestination, formatDestinationLabel, normalizeDestinationQuery, styleLabel } from "./destinations";
import { resolveAirportCode } from "./airports";
import { destinationMetadata, getDestinationGateways, getUSStateRegion } from "./location-suggestions";
import type { Destination, ItineraryDay, TripRecommendation, TripSearchInput, TripStyle } from "./types";
import { getTypicalDaytimeHighF, toFahrenheit } from "./climate-normals";

const DAY_NAMES = ["Arrival and getting oriented", "A full day to explore", "A slower local day", "A day for a signature experience", "Room for a favourite repeat", "A final easy day"];

function monthFromDate(value: string): number {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? new Date().getUTCMonth() + 1 : date.getUTCMonth() + 1;
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function styleScore(destination: Destination, style: TripStyle): number {
  if (style === "any") return 70;
  if (destination.styles.includes(style)) return 100;
  const adjacent: Partial<Record<TripStyle, TripStyle[]>> = {
    beach: ["romantic", "family", "adventure"], city: ["food", "culture"], food: ["city", "culture"], nature: ["adventure", "romantic"],
    romantic: ["beach", "food", "culture"], family: ["beach", "adventure"], adventure: ["nature", "beach"], culture: ["city", "food"],
  };
  return destination.styles.some((item) => adjacent[style]?.includes(item)) ? 58 : 25;
}

function scoreDestination(destination: Destination, input: TripSearchInput, typicalHighF: number | null): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = styleScore(destination, input.style);
  if (input.style !== "any" && destination.styles.includes(input.style)) reasons.push(`Strong match for ${styleLabel(input.style).toLowerCase()}`);
  const month = monthFromDate(input.departureDate);
  if (destination.goodMonths.includes(month)) {
    score += 14;
    reasons.push("Your travel month is within a commonly recommended visit window");
  } else {
    score -= 3;
    reasons.push("Check seasonal weather and local conditions for these dates");
  }
  const nights = Math.max(1, daysBetween(input.departureDate, input.returnDate));
  if (nights >= destination.suggestedNights[0] && nights <= destination.suggestedNights[1]) {
    score += 10;
    reasons.push("Your trip length suits this destination well");
  } else if (nights < destination.suggestedNights[0]) {
    score -= 9;
    reasons.push(`This destination is usually better with at least ${destination.suggestedNights[0]} nights`);
  } else {
    score += 2;
    reasons.push("There is enough time to explore beyond the main highlights");
  }
  const hasTemperaturePreference = input.temperatureMin !== null || input.temperatureMax !== null;
  if (hasTemperaturePreference && typicalHighF !== null) {
    score += 18;
    reasons.push(`Typical daytime high is about ${Math.round(typicalHighF)}°F for these dates`);
  } else if (hasTemperaturePreference) {
    reasons.push("Monthly climate data is not available for this destination, so the temperature preference could not be checked");
  }
  const people = input.adults + input.childrenAges.length;
  const dailyTarget = input.budgetMode === "per_person" ? input.budget / Math.max(1, nights) : input.budget / Math.max(1, people * nights);
  const costWords = ["lower-cost", "moderate-cost", "higher-cost", "premium-cost"];
  const targetBand = dailyTarget < 85 ? 1 : dailyTarget < 160 ? 2 : dailyTarget < 280 ? 3 : 4;
  if (destination.costLevel <= targetBand) {
    score += 4;
    reasons.push(`Destination cost profile (${costWords[destination.costLevel - 1]}) is more compatible with your daily budget target`);
  } else {
    score -= 4;
    reasons.push(`This destination may put more pressure on your daily budget; verify live travel and stay prices`);
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

function buildItinerary(destination: Destination, input: TripSearchInput): ItineraryDay[] {
  const nights = Math.max(1, daysBetween(input.departureDate, input.returnDate));
  const days = Math.max(2, Math.min(15, nights + 1));
  return Array.from({ length: days }, (_, index) => {
    const arrivalDay = index === 0;
    const lastDay = index === days - 1;
    const template = destination.itinerary[index] ?? [
      { title: `Choose one local experience for day ${index + 1}`, description: "Use the live places list to pick an attraction or tour that is open on this date. Check ticket availability and travel time before adding it.", category: "Choose an experience" },
      { title: "Explore the area around your stay", description: "Keep time for nearby beaches, parks, shops or neighbourhoods, and allow for transport.", category: "Explore nearby" },
      { title: "Leave the evening flexible", description: "Choose dinner or entertainment near your base after confirming current hours and transport.", category: "Flexible" },
    ];

    const morning = arrivalDay
      ? { title: "Arrival and check-in", description: "Confirm transfer, luggage and accommodation check-in arrangements. Keep the morning flexible around your arrival time.", category: "Arrival" }
      : lastDay
        ? { title: "Pack and prepare for departure", description: "Confirm checkout, luggage storage and airport transfer timing before leaving your accommodation.", category: "Departure" }
        : template[0];
    const afternoon = lastDay
      ? { title: "Departure transfer and airport check-in", description: "Allow enough time to reach the airport, return a rental car if needed, and complete airline check-in.", category: "Departure" }
      : template[1];
    const evening = lastDay
      ? { title: "Travel home", description: "Follow the confirmed flight schedule. Keep this period clear of sightseeing or other reservations.", category: "Departure" }
      : template[2];

    const activities = [
      { ...morning, period: "Morning" as const },
      { period: "Lunch" as const, title: "Plan lunch", description: "Choose a restaurant or casual dining option near the day's activities. Add a restaurant from the live results to place it here.", category: "Meal" },
      { ...afternoon, period: "Afternoon" as const },
      { period: "Dinner" as const, title: "Plan dinner", description: "Choose a restaurant near your accommodation or evening plans. Add a restaurant from the live results to place it here.", category: "Meal" },
      { ...evening, period: "Evening" as const },
    ];

    const d = new Date(`${input.departureDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + index);
    return {
      date: d.toISOString().slice(0, 10),
      label: arrivalDay ? "Arrival day" : lastDay ? "Departure day" : DAY_NAMES[Math.min(index, DAY_NAMES.length - 1)],
      activities,
      paceNote: arrivalDay || lastDay
        ? "Light schedule — allow for airport transfers, check-in or checkout, and meal breaks."
        : "Suggested pacing only. Leave time for lunch and dinner, and verify opening hours, tickets, transport and local conditions before booking.",
    };
  });
}

const CUSTOM_DESTINATION_IMAGES: Record<string, string> = {
  "amalfi coast": "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?auto=format&fit=crop&w=1400&q=88",
  kyoto: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=88",
  tulum: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=1400&q=88",
  // Pexels free-to-use destination photographs, selected for the actual city/region.
  santiago: "https://images.pexels.com/photos/35874451/pexels-photo-35874451/free-photo-of-historic-architecture-in-santiago-de-los-caballeros.jpeg?auto=compress&cs=tinysrgb&w=1400",
  "santiago de los caballeros": "https://images.pexels.com/photos/35874451/pexels-photo-35874451/free-photo-of-historic-architecture-in-santiago-de-los-caballeros.jpeg?auto=compress&cs=tinysrgb&w=1400",
  "punta cana": "https://images.pexels.com/photos/34623077/pexels-photo-34623077/free-photo-of-sunny-beach-in-punta-cana-dominican-republic.jpeg?auto=compress&cs=tinysrgb&w=1400",
  "dominican republic": "https://images.pexels.com/photos/34623077/pexels-photo-34623077/free-photo-of-sunny-beach-in-punta-cana-dominican-republic.jpeg?auto=compress&cs=tinysrgb&w=1400",
};

function makeCustomDestination(query: string, selectedAirportCode = ""): Destination {
  const metadata = destinationMetadata(query);
  const gateway = getDestinationGateways(query).find((item) => item.code === selectedAirportCode);
  const isUSState = Boolean(getUSStateRegion(query));
  // Keep a state as the searched area even when a gateway airport is selected.
  // The airport code is only used for the flight route.
  const city = isUSState ? metadata.city : gateway?.city || metadata.city || query;
  const country = metadata.country || (gateway ? query : "");
  const airportCode = gateway?.code || metadata.airportCode || resolveAirportCode(query) || "";
  const destinationLabel = formatDestinationLabel(city, country);
  return {
    id: `custom-${query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, city, country, airportCode, airportLabel: airportCode || "Choose an arrival airport for flights",
    // Prefer a verified image for the resolved city, then the search region.
    // Unknown destinations stay image-neutral rather than showing unrelated stock travel art.
    image: CUSTOM_DESTINATION_IMAGES[normalizeDestinationQuery(city)] || (!gateway ? CUSTOM_DESTINATION_IMAGES[normalizeDestinationQuery(query)] : "") || "",
    summary: `Live travel options and local places for ${destinationLabel}. Check the details against your selected dates and traveler count.`,
    bestFor: ["Custom destination"], styles: ["any", "city", "food", "culture"], costLevel: 2, suggestedNights: [3, 6], goodMonths: [],
    highlights: ["Confirm the right airport", "Choose a neighbourhood", "Verify attractions and transport"],
    itinerary: [
      [{title:"Arrive and get oriented",description:"Confirm the airport, transfer options and accommodation check-in details.",category:"Arrival"},{title:"Explore the immediate area",description:"Use a locally verified guide to choose nearby places of interest.",category:"Explore"},{title:"Keep the first evening flexible",description:"Allow time to recover from travel.",category:"Leisure"}],
      [{title:"Plan one signature attraction",description:"Choose a major attraction based on your interests and verify ticket availability.",category:"Sightseeing"},{title:"Local food experience",description:"Look for current local recommendations and check hours.",category:"Food"},{title:"Explore a second neighbourhood",description:"Check transport and safety guidance before setting out.",category:"Explore"}],
      [{title:"Flexible experience day",description:"Add a day trip, museum, outdoor activity or relaxed day according to your travel style.",category:"Flexible"},{title:"Leave a rest window",description:"Avoid scheduling every hour.",category:"Leisure"},{title:"Confirm departure logistics",description:"Check checkout, airport transfer and departure time.",category:"Departure"}],
    ],
    sourceNote: "Custom itinerary template. No local attractions, live inventory, opening hours or transportation details have been verified for this destination yet.",
  };
}

function buildProviderLinks(origin: string, destination: Destination, input: TripSearchInput) {
  const destinationQuery = formatDestinationLabel(destination.city, destination.country);
  const destinationAirportCode = input.destinationAirportCode || destination.airportCode;
  const originQuery = input.originAirportCode || resolveAirportCode(origin) || origin.trim();
  const childText = input.childrenAges.length ? `, ${input.childrenAges.length} children ages ${input.childrenAges.join(", ")}` : "";
  const travelers = `${input.adults} adult${input.adults === 1 ? "" : "s"}${childText}`;
  const cabin = input.cabinClass.replaceAll("_", " ");
  const stopText = input.stops === "any" ? "any number of stops" : input.stops === "nonstop" ? "nonstop only" : input.stops === "one_stop" ? "up to one stop" : "up to two stops";

  const flightQuery = `Flights from ${originQuery} to ${destinationAirportCode || destinationQuery} on ${input.departureDate} through ${input.returnDate}, ${travelers}, ${cabin} class, ${stopText}`;
  const googleFlights = new URL("https://www.google.com/travel/flights/search");
  googleFlights.searchParams.set("q", flightQuery);
  googleFlights.searchParams.set("curr", input.currency);
  googleFlights.searchParams.set("hl", "en");
  googleFlights.searchParams.set("gl", "us");

  // Booking.com accepts structured dates, occupancy and room-count parameters.
  const booking = new URL("https://www.booking.com/searchresults.html");
  booking.searchParams.set("ss", destinationQuery);
  booking.searchParams.set("checkin", input.departureDate);
  booking.searchParams.set("checkout", input.returnDate);
  booking.searchParams.set("group_adults", String(input.adults));
  booking.searchParams.set("group_children", String(input.childrenAges.length));
  booking.searchParams.set("no_rooms", String(input.rooms));
  booking.searchParams.set("selected_currency", input.currency);
  booking.searchParams.set("lang", "en-us");
  for (const age of input.childrenAges) booking.searchParams.append("age", String(age));

  // Airbnb supports dates and guest counts in its public search URL.
  const airbnb = new URL(`https://www.airbnb.com/s/${encodeURIComponent(destinationQuery)}/homes`);
  airbnb.searchParams.set("checkin", input.departureDate);
  airbnb.searchParams.set("checkout", input.returnDate);
  airbnb.searchParams.set("adults", String(input.adults));
  airbnb.searchParams.set("query", destinationQuery);
  if (input.childrenAges.length) airbnb.searchParams.set("children", String(input.childrenAges.length));

  const activityQuery = `Things to do and tours in ${destinationQuery}, visit dates ${input.departureDate} to ${input.returnDate}, ${travelers}`;
  const viator = new URL("https://www.viator.com/searchResults/all");
  viator.searchParams.set("text", activityQuery);
  return {
    flightSearchUrl: googleFlights.toString(),
    hotelSearchUrl: booking.toString(),
    vacationRentalSearchUrl: airbnb.toString(),
    activitySearchUrl: viator.toString(),
  };
}

export function buildTripRecommendations(input: TripSearchInput): TripRecommendation[] {
  // Country/region searches must not silently resolve to the first city in
  // that country. Keep the whole region for stays/activities-only searches;
  // when flights are included, use the user's chosen gateway to set the base.
  const isRegionSearch = getDestinationGateways(input.destination).length > 0;
  const exact = isRegionSearch ? undefined : findDestination(input.destination);
  const candidates = exact ? [exact] : input.destination.trim() && !["anywhere", "surprise me", "open to ideas"].includes(normalizeDestinationQuery(input.destination))
    ? [makeCustomDestination(input.destination.trim(), input.destinationAirportCode)]
    : [...DESTINATIONS];
  const hasTemperaturePreference = input.temperatureMin !== null || input.temperatureMax !== null;
  const minF = input.temperatureMin === null ? null : toFahrenheit(input.temperatureMin, input.temperatureUnit);
  const maxF = input.temperatureMax === null ? null : toFahrenheit(input.temperatureMax, input.temperatureUnit);
  const isAnywhere = !input.destination.trim() || ["anywhere", "surprise me", "open to ideas"].includes(normalizeDestinationQuery(input.destination));

  return candidates
    .map((destination) => {
      const typicalDaytimeHighF = getTypicalDaytimeHighF(destination.city, input.departureDate, input.returnDate, destination.id);
      return { destination, typicalDaytimeHighF };
    })
    .filter(({ typicalDaytimeHighF }) => {
      if (!hasTemperaturePreference) return true;
      // For broad discovery, only include destinations with a documented
      // climate profile inside the requested range. For an explicitly named
      // place, retain the place when climate normals are unavailable and
      // clearly disclose that the preference could not be verified.
      if (typicalDaytimeHighF === null) return !isAnywhere;
      return (minF === null || typicalDaytimeHighF >= minF) && (maxF === null || typicalDaytimeHighF <= maxF);
    })
    .map(({ destination, typicalDaytimeHighF }) => {
      const ranking = scoreDestination(destination, input, typicalDaytimeHighF).score;
      return {
        destination,
        ranking,
        typicalDaytimeHighF,
        itinerary: buildItinerary(destination, input),
        liveSearchSupported: !input.components.includes("flights") || Boolean(destination.airportCode),
        ...buildProviderLinks(input.origin, destination, input),
      };
    })
    .sort((a, b) => b.ranking - a.ranking)
    .slice(0, exact || !isAnywhere ? 1 : 6)
    .map(({ ranking: _ranking, ...recommendation }) => recommendation);
}

export function tripLength(input: TripSearchInput): number {
  return Math.max(1, daysBetween(input.departureDate, input.returnDate));
}
