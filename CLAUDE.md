# Tripfinder project instructions

You are continuing development of Tripfinder, a travel discovery, planning, and provider-comparison platform. The application is not a travel agency and must not process payments or make reservations. It should help a traveler define a trip, compare suitable travel options, assemble an itinerary, understand the estimated total cost, and continue to the relevant external booking provider.

## Product principles

1. Accuracy outranks result count. Never invent flights, fares, hotels, room availability, taxes, opening hours, provider URLs, or booking packages.
2. Clearly distinguish live verified data, cached provider data, indicative estimates, curated editorial information, and demo fixtures.
3. Every price must carry currency, source/provider, retrieval timestamp, passenger/room assumptions, and a status describing whether it has been revalidated.
4. Do not label a collection of independent bookings as an official vacation package. Use `official package` only when a provider sells that package as one product. Otherwise label it `build-your-own trip`.
5. Hard constraints must be enforced before ranking. A result that violates a maximum budget, date, traveler, nonstop-only or other mandatory requirement must not appear as a match.
6. AI may interpret natural-language preferences and help draft itinerary suggestions. Deterministic application code must validate dates, passenger counts, room occupancy, arithmetic, time zones, inventory and URLs.
7. Do not claim 100% live-price accuracy. Prices and availability can change before checkout. Revalidate where the provider supports it and explain any limitations.
8. Do not scrape travel websites or bypass provider terms. Use documented APIs, approved deep links, permitted widgets or user-facing search URLs.

## Visual design requirements

- Maintain the existing editorial travel aesthetic: warm neutral backgrounds, deep forest green, muted sage, restrained clay accents, large photography, thin dividers and considered serif/sans-serif typography.
- Avoid generic AI aesthetics: no purple/blue gradient blobs, giant rounded dashboard cards, excessive pill badges, excessive shadows, fake testimonial counts, fake review ratings, or decorative icons everywhere.
- Motion should be subtle and purposeful: short reveal transitions, gentle image zoom on hover, restrained floating details. Respect `prefers-reduced-motion`.
- Keep the mobile search experience usable: stacked fields, large tap targets, accessible labels and clear errors.
- Images must have meaningful alt text when informative; purely decorative images should not be announced.
- Maintain accessible contrast, keyboard navigation, visible focus states and semantic HTML.

## Engineering requirements

- Use Next.js App Router, TypeScript and strict type checking.
- Keep travel providers behind `lib/providers` adapters. Provider-specific response schemas must be normalized into internal types before reaching ranking or UI code.
- Keep API secrets server-side only. Never put API keys in client components or `NEXT_PUBLIC_*` variables.
- Validate all user input server-side as well as client-side.
- Store timestamps in UTC, but render flight and local activity times in the relevant IANA time zone.
- Currency conversions must record the exchange-rate source and timestamp. Never silently mix currencies.
- Avoid treating a city name as an airport code. Resolve airports explicitly and keep alternatives visible.
- Handle provider timeouts, rate limits, partial results, no-results responses and stale cache entries gracefully.
- Use deterministic fixtures for tests. The current `MockTravelProvider` intentionally returns no inventory rather than inventing live offers.
- Keep demo-mode disclaimers until live integrations and tests are in place.
- Do not add paid services or dependencies without first explaining why they are needed and whether a free option exists.

## Before declaring a feature complete

- Run TypeScript/build checks.
- Test mobile and desktop layouts.
- Test empty, invalid, partial and contradictory search inputs.
- Verify date ranges, child ages, room occupancy, totals and outbound URL parameters.
- Confirm no sample data is represented as live inventory.
- Confirm reduced-motion and keyboard behavior.

## Current implementation state

The current starter includes a landing page, interactive search form, sample results page, expandable cost breakdowns, provider interface placeholder and health endpoint. Live flight/hotel provider integrations, Neon persistence, authentication, and affiliate tracking are not implemented yet.
