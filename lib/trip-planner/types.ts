export type TripStyle =
  | "any"
  | "beach"
  | "city"
  | "food"
  | "nature"
  | "romantic"
  | "family"
  | "adventure"
  | "culture";

export type CabinClass = "economy" | "premium_economy" | "business" | "first";
export type StopPreference = "any" | "nonstop" | "one_stop" | "two_stops";
export type TripComponent = "flights" | "stays" | "activities";
export type StayType = "hotels" | "vacation_rentals";

export type TripSearchInput = {
  origin: string;
  originAirportCode: string;
  destination: string;
  destinationAirportCode: string;
  components: TripComponent[];
  stayTypes: StayType[];
  departureDate: string;
  returnDate: string;
  adults: number;
  childrenAges: number[];
  rooms: number;
  budget: number;
  budgetMode: "total" | "per_person";
  currency: string;
  style: TripStyle;
  flexible: boolean;
  flexibleDays: number;
  cabinClass: CabinClass;
  stops: StopPreference;
  minimumHotelRating: 0 | 3 | 4 | 5;
  freeCancellation: boolean;
  temperatureMin: number | null;
  temperatureMax: number | null;
  temperatureUnit: "F" | "C";
};

export type ItineraryActivity = {
  period: "Morning" | "Afternoon" | "Evening";
  title: string;
  description: string;
  category: string;
};

export type ItineraryDay = {
  date: string;
  label: string;
  activities: ItineraryActivity[];
  paceNote: string;
};

export type Destination = {
  id: string;
  city: string;
  country: string;
  airportCode: string;
  airportLabel: string;
  image: string;
  summary: string;
  bestFor: string[];
  styles: TripStyle[];
  costLevel: 1 | 2 | 3 | 4;
  suggestedNights: [number, number];
  goodMonths: number[];
  highlights: string[];
  itinerary: Omit<ItineraryActivity, "period">[][];
  sourceNote: string;
};

export type TripRecommendation = {
  destination: Destination;
  itinerary: ItineraryDay[];
  liveSearchSupported: boolean;
  flightSearchUrl: string;
  hotelSearchUrl: string;
  vacationRentalSearchUrl: string;
  activitySearchUrl: string;
  /** Historical monthly climate normal; not a weather forecast. */
  typicalDaytimeHighF: number | null;
};
