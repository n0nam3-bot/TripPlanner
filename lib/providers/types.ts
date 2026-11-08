export type ProviderEnvironment = "mock" | "sandbox" | "production";

export type FlightSegment = {
  departureAirport: string;
  arrivalAirport: string;
  departureAt: string;
  arrivalAt: string;
  carrier?: string;
  flightNumber?: string;
};

export type FlightOffer = {
  id: string;
  provider: string;
  currency: string;
  totalAmount: number;
  travelers: number;
  segments: FlightSegment[];
  lastCheckedAt: string;
  isLive: boolean;
  bookingUrl?: string;
  limitations?: string[];
};

export type HotelOffer = {
  id: string;
  provider: string;
  propertyName: string;
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  currency: string;
  totalAmount: number;
  lastCheckedAt: string;
  isLive: boolean;
  bookingUrl?: string;
  limitations?: string[];
};

export type FlightSearchInput = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  childrenAges: number[];
  cabin?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  maxStops?: number;
};

export type HotelSearchInput = {
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  childrenAges: number[];
};

export interface TravelProvider {
  readonly name: string;
  readonly environment: ProviderEnvironment;
  searchFlights(input: FlightSearchInput): Promise<FlightOffer[]>;
  searchHotels(input: HotelSearchInput): Promise<HotelOffer[]>;
}
