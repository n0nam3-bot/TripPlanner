import { MockTravelProvider } from "./mock-provider";
import type { TravelProvider } from "./types";

/**
 * Provider selection is intentionally centralized. Future Amadeus, Expedia,
 * Booking.com or other adapters should implement TravelProvider and be selected here.
 */
export function getTravelProvider(): TravelProvider {
  const mode = process.env.TRAVEL_PROVIDER ?? "mock";

  if (mode === "mock") return new MockTravelProvider();

  throw new Error(
    `Travel provider "${mode}" is not implemented. Keep TRAVEL_PROVIDER=mock until a provider adapter is built and tested.`,
  );
}
