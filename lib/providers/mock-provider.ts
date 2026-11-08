import type {
  FlightOffer,
  FlightSearchInput,
  HotelOffer,
  HotelSearchInput,
  TravelProvider,
} from "./types";

/**
 * Safe development adapter. It deliberately returns no fabricated inventory.
 * Replace with deterministic fixtures for automated tests, then add live provider adapters.
 */
export class MockTravelProvider implements TravelProvider {
  readonly name = "Mock provider (no inventory)";
  readonly environment = "mock" as const;

  async searchFlights(_input: FlightSearchInput): Promise<FlightOffer[]> {
    return [];
  }

  async searchHotels(_input: HotelSearchInput): Promise<HotelOffer[]> {
    return [];
  }
}
