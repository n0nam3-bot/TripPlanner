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

- Editorial homepage and responsive trip-search UI are implemented.
- Server-side search validation and a curated destination-matching/itinerary engine are implemented.
- SerpApi Google Flights and Google Hotels search adapters are implemented behind server API routes. The round-trip flow is staged: outbound search, `departure_token` return-leg lookup, then `booking_token` seller lookup.
- Neon is used for a persistent one-hour search cache, a 60-second cached SerpApi Account API quota snapshot, and atomic shared hourly/monthly/per-connection counters. The required tables are created automatically on first provider request.
- Live search requires server-side `SERPAPI_API_KEY` and `DATABASE_URL` in Vercel. `SERPAPI_MONTHLY_SEARCH_CAP` defaults to 200 (hard-clamped to 230), `SERPAPI_HOURLY_SEARCH_CAP` defaults to 30 (hard-clamped to 45), and `SERPAPI_PROVIDER_QUOTA_RESERVE` defaults to 75, and `SERPAPI_PROVIDER_HOURLY_RESERVE` defaults to 10.
- Results are not sample fares. Without credentials the site remains in planning-only mode; with credentials it can query current provider snapshots.
- The curated destination catalog and itinerary templates are not worldwide live discovery. Attraction hours, transit times, entry rules, flexible-date alternatives, multi-room hotels and exact child-age flight fares are not verified yet.
- Neon does not yet store user accounts, saved trip records or synchronized trip histories.
- No affiliate tracking, checkout, reservation or payment processing is implemented.

## Live-data and provider safeguards

- The free SerpApi plan is for controlled development/testing until its data-display, caching, public/commercial-use and liability terms have been reviewed and appropriate authorization is confirmed.
- Do not treat Google Flights initial round-trip results as a complete round-trip itinerary. Retrieve the return choices with the selected outbound's `departure_token`; only then retrieve seller options with a return-stage `booking_token`.
- SerpApi's stops filter means `0=any`, `1=nonstop`, `2=one stop or fewer`, `3=two stops or fewer`. Do not describe this as exact one-stop/two-stop matching.
- Google Hotels search has no room-count parameter in this adapter. Withhold offers for multi-room requests.
- Google Flights accepts the child count, not the individual child ages in this implementation. Hotel search accepts the exact ages.
- Every provider query must pass through the Neon cache, actual SerpApi Account API monthly and hourly quota check and shared monthly/hourly/per-client counters. Do not add a direct SerpApi search call that bypasses `querySerpApi`. Account API calls do not consume search credits and are cached for 60 seconds.
- Cache by all search parameters except the secret API key. Keep secrets out of cache keys, client props, logs and API responses.
- Never raise the provider request cap above 230 without changing the documented free-plan assumptions and reviewing account billing.
- Provider links and booking tokens are opaque supplier data. Validate outbound URLs as HTTPS, allowlist Google hostnames for Google booking-form POSTs, preserve the provider-supplied `post_data` fields, and never manufacture tokens or seller URLs. Seller lookups must preserve the original route, passenger count, cabin and localization context. Per the current provider documentation, omit dates and advanced filters from booking-token lookups because they do not alter the token-selected itinerary.
- Do not claim the provider snapshot is guaranteed or that a seller link reserves a trip.
