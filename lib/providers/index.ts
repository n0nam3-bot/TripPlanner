import { MockTravelProvider } from "./mock-provider";
import type { TravelProvider } from "./types";

/**
 * Generic provider contract retained for deterministic unit tests and future
 * supplier adapters. Live Google Travel search is implemented separately in
 * `serpapi.ts` because its round-trip flow uses provider selection tokens.
 */
export function getTravelProvider(): TravelProvider {
  const mode = process.env.TRAVEL_PROVIDER ?? "mock";
  if (mode === "mock") return new MockTravelProvider();
  throw new Error(`Travel provider "${mode}" is not implemented through the generic provider contract.`);
}
