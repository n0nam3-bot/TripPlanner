import { DESTINATIONS, findDestination, normalizeDestinationQuery, styleLabel } from "./destinations";
import { resolveAirportCode } from "./airports";
import type { Destination, ItineraryDay, TripRecommendation, TripSearchInput, TripStyle } from "./types";

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

function scoreDestination(destination: Destination, input: TripSearchInput): { score: number; reasons: string[] } {
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

function activityPeriod(index: number): "Morning" | "Afternoon" | "Evening" {
  return (["Morning", "Afternoon", "Evening"] as const)[index] ?? "Morning";
}

function buildItinerary(destination: Destination, input: TripSearchInput): ItineraryDay[] {
  const nights = Math.max(1, daysBetween(input.departureDate, input.returnDate));
  const days = Math.max(2, Math.min(15, nights + 1));
  return Array.from({ length: days }, (_, index) => {
    const template = destination.itinerary[index % destination.itinerary.length] ?? destination.itinerary[0];
    const arrivalDay = index === 0;
    const lastDay = index === days - 1;
    const activities = template.map((item, activityIndex) => ({ ...item, period: activityPeriod(activityIndex) }));
    if (arrivalDay) {
      activities[0] = { period: "Morning", title: "Arrival and check-in", description: "Confirm transfer, luggage and hotel check-in arrangements. The rest of the day is intentionally flexible.", category: "Arrival" };
    }
    if (lastDay) {
      activities[2] = { period: "Evening", title: "Departure buffer", description: "Confirm checkout, airport transfer and airline check-in times. Do not rely on estimated travel times on departure day.", category: "Departure" };
    }
    const d = new Date(`${input.departureDate}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + index);
    return {
      date: d.toISOString().slice(0, 10),
      label: arrivalDay ? "Arrival day" : lastDay ? "Departure day" : DAY_NAMES[Math.min(index, DAY_NAMES.length - 1)],
      activities,
      paceNote: arrivalDay || lastDay ? "Light schedule — allow for travel and check-in time." : "Suggested pacing only. Verify opening hours, tickets, transport and local conditions before booking.",
    };
  });
}

function makeCustomDestination(query: string): Destination {
  return {
    id: `custom-${query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`, city: query, country: "Custom destination", airportCode: resolveAirportCode(query) ?? "", airportLabel: resolveAirportCode(query) ?? "Airport needs confirmation",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1400&q=88",
    summary: `A flexible planning outline for ${query}. Add a matching airport code to enable live search for flights.`,
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
  const originQuery = origin.trim();
  const destinationQuery = `${destination.city}, ${destination.country}`;
  const flightQuery = `Flights from ${originQuery} to ${destinationQuery} on ${input.departureDate} returning ${input.returnDate} for ${input.adults + input.childrenAges.length} travelers`;
  const hotelQuery = `Hotels in ${destinationQuery} from ${input.departureDate} to ${input.returnDate} for ${input.adults + input.childrenAges.length} guests`;
  const activityQuery = `Things to do in ${destinationQuery}`;
  const googleFlights = new URL("https://www.google.com/travel/flights");
  googleFlights.searchParams.set("q", flightQuery);
  const googleHotels = new URL("https://www.google.com/travel/hotels");
  googleHotels.searchParams.set("q", hotelQuery);
  const viator = new URL("https://www.viator.com/searchResults/all");
  viator.searchParams.set("text", activityQuery);
  return { flightSearchUrl: googleFlights.toString(), hotelSearchUrl: googleHotels.toString(), activitySearchUrl: viator.toString() };
}

export function buildTripRecommendations(input: TripSearchInput): TripRecommendation[] {
  const exact = findDestination(input.destination);
  const candidates = exact ? [exact] : input.destination.trim() && !["anywhere", "surprise me", "open to ideas"].includes(normalizeDestinationQuery(input.destination))
    ? [makeCustomDestination(input.destination.trim())]
    : [...DESTINATIONS];
  return candidates
    .map((destination) => {
      const scored = scoreDestination(destination, input);
      return {
        destination,
        score: scored.score,
        reasons: scored.reasons.slice(0, 3),
        itinerary: buildItinerary(destination, input),
        liveSearchSupported: Boolean(destination.airportCode),
        ...buildProviderLinks(input.origin, destination, input),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, exact || (input.destination.trim() && !["anywhere", "surprise me", "open to ideas"].includes(normalizeDestinationQuery(input.destination))) ? 1 : 6);
}

export function tripLength(input: TripSearchInput): number {
  return Math.max(1, daysBetween(input.departureDate, input.returnDate));
}
