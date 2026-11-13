# Tripfinder product roadmap

**Status key:** [x] implemented in the current source; [ ] still open, awaiting credentials, or pending a separate production/operator verification.


## Release 0 — polished interface (complete)
- [x] Editorial-style responsive homepage and motion system.
- [x] Structured trip-search form.
- [x] Mobile-first results workspace.
- [x] GitHub Actions ZIP overlay importer for mobile uploads.

## Release 1 — planning core (implemented; regression suite added)
- [x] Server-side trip input validation.
- [x] Curated airport/city resolver.
- [x] Curated destination catalog and explainable preference scoring.
- [x] Date-specific itinerary outline builder.
- [x] Direct external search links.

## Release 2 — live travel search (implemented; requires user credentials)
- [x] SerpApi Google Flights adapter.
- [x] Correct round-trip token flow: outbound selection, return search, then seller options.
- [x] SerpApi Google Hotels adapter.
- [x] Neon persistent response cache.
- [x] Shared monthly and hourly uncached-query counters, per-connection limits, and real SerpApi Account API monthly and hourly balance checks with safety reserves.
- [x] Provider timestamps, source labels, partial-result warnings and no-results handling.
- [x] Explicit limitations for child age matching, multi-room occupancy and airport resolution.

## Release 2.5 — operations and API monitoring (implemented; pending deployment verification)
- [x] Private `/admin` dashboard protected by a server-signed 12-hour HttpOnly session.
- [x] Persistent five-failure/15-minute admin-login lockout using hashed client identifiers.
- [x] Actual SerpApi account quota, app-level monthly/hourly reservations and warnings.
- [x] Provider request, cache-hit, failure and blocked-request telemetry by category.
- [x] WeatherAPI one-hour Neon cache with explicit call/cache telemetry.
- [x] Recent sanitized request log, response timing, provider breakdown, 24-hour trend and Neon cache health.
- [x] Telemetry retention cleanup after 90 days; logs omit search text, keys, booking tokens and raw addresses.
- [x] Integrate Vercel Web Analytics for page/referrer trends and Speed Insights for field performance. Exclude `/admin` and `/api`, strip all query strings/fragments to avoid recording trip-search parameters, and sample Speed Insights at 25%. Dashboard activation and production data verification remain operator steps.

## Release 3 — AI-assisted planning and search efficiency (implemented; pending production verification)
- [x] Optional OpenRouter free-model router with data-collection denial and zero-data-retention endpoint requirements.
- [x] Optional Gemini 3.8 Flash free-tier fallback; only called after an explicit visitor opt-in because Google's unpaid service may use prompts and responses to improve its products.
- [x] Result-aware assistant answers questions using only already-loaded provider results; it does not trigger live travel searches or invent availability, prices, amenities or booking terms.
- [x] Six-hour Neon cache for identical assistant questions against the same result snapshot.
- [x] Separate AI provider daily/minute and per-visitor limits, isolated from SerpApi's travel-search counters.
- [x] AI calls, cache hits, provider errors and blocked requests appear in the existing `/admin` provider breakdown.
- [x] Added explicit natural-language preference parsing on the initial search form. Visitors review an allowlisted draft and apply it before any travel-provider search runs.
- [x] Parser supports destinations/areas, dates, travelers, rooms, budgets, trip components, hotel/rental type, entire-place/private/shared room, amenities, cabin, stops, hotel rating, cancellation and temperature preferences.
- [x] Model output is parsed as JSON, allowlisted server-side, and cannot write directly to URLs or invoke travel providers. Unknown or unsupported values are ignored; current form values are changed only after visitor confirmation.
- [x] Parser calls are cached in Neon for 24 hours, share existing AI daily/minute controls, and are logged as a separate `/admin` category without storing prompt text.
- [x] Gemini fallback remains opt-in per parsing request. No Vercel AI Gateway integration.

## Release 4 — verified trip assembly (in progress)
- [x] Add an in-results trip cost ledger separating provider-displayed stay totals, reference-only flight quotes, user-entered ground transport/activity/dining estimates and a transparent contingency allowance. The displayed planning amount is explicitly partial; unknown amounts and ambiguous flight price bases are excluded.
- [x] Replace the dense trip-selection text block with compact flight, accommodation, activity and dining cards, including direct links to the exact selected result and clearly separate provider links.
- [x] Extend the travel timeline with selected flight departure/arrival times, links to selected results, editable property check-in/check-out time notes, and exact user-entered activity/restaurant times. Provider-unsupplied times remain visibly unconfirmed; editing a time does not create a reservation.
- [x] Add an optional Geoapify Places provider backed by OpenStreetMap, with visible Geoapify/OSM attribution, source labels, no invented ratings, and a SerpApi Maps/Local fallback when the Geoapify key is absent. Free-plan commercial-production limitations are documented for operator review.
- [x] Add coordinate-based Geoapify driving estimates for accommodation-to-activity/restaurant/airport checks. Requests remain user-triggered, are cached for 12 hours, and disclose that the estimates exclude live traffic. Address-only lookups retain the SerpApi directions path.
- [x] Add Geoapify credit reservations in Neon: shared daily cap, per-visitor daily cap, shared 400 ms request gate with bounded queue, 12-hour places and route cache, and `/api/health` reporting. No provider requests are made during health checks.
- [x] Show Geoapify key status, shared and per-visitor credit usage, remaining daily app budget and low-budget warnings in `/admin`.
- [ ] Enforce hard budget constraints only when each relevant cost component is sourced and appropriately complete.
- [x] Add controlled flexible-date comparisons (±1 to ±3 days) through one cached Google Flights Calendar request; preserve the same trip duration and re-run exact itineraries only after the traveler selects a date pair. Existing SerpApi shared quotas and per-client limits apply.
- [x] Add a fixed desktop results quick-navigation rail with active-section tracking, jump controls, independent expand/collapse controls, and a compact horizontally scrollable responsive layout. Includes Flights, Places to stay, Activities & attractions, Restaurants & dining, Weather, Your plan, Cost breakdown, and Your trip schedule.
- [x] Add a compact fixed trip overview above the left navigation with origin, destination, dates, travelers and budget; keep it responsive as a horizontal summary on narrower screens.
- [x] Dock the Tripfinder assistant as a full-height right workspace on desktop; minimizing it releases the right column so the center results area expands. Tablet and mobile layouts use an overlay rather than compressing results.
- [x] Add a budget-completeness readiness assessment: blank estimates stay unpriced, explicit $0 estimates are recorded as user-entered, and hard limits remain advisory while any requested component is a provider quote or lacks an all-in total.
- [x] Expand local airport autocomplete and city/country gateway coverage across major international passenger airports; resolve airport names, aliases and IATA codes locally; expand metro selections into physical airports for exact and flexible searches while bounding the origin/destination matrix to four combinations for provider responsiveness. Selecting an individual airport remains available for exact control.
- [x] Add a no-API-credit regression suite for parser examples, inclusive date/duration handling, outbound/return/seller token stages, connection-country filtering, airport-local time zones/DST, round-trip price basis, currency-safe cost totals, room/guest validation, and Google booking redirect URL validation.

**Next Release 4 focus:** complete hard budget enforcement only after providers expose comparable all-in totals for the requested components; until then, keep the completeness gate advisory. Then proceed to supplier-data quality, price/availability revalidation and search-outcome monitoring. Exact-date search remains the default; flexible date comparison is opt-in and consumes one cached calendar request only when the traveler asks to compare.


## Release 5 — persistence and trip workspace
- [ ] Neon persistence for anonymous shareable trip drafts and saved searches.
- [ ] Optional user accounts only if needed.
- [ ] Shareable itinerary links, traveler edits and feedback capture.
- [ ] Extend admin quality dashboard with provider availability history, stale-result detection, outbound-link monitoring and trip-search outcomes.


## Release 6 — supplier depth and monetization
- [x] Initial Booking.com Demand API v3.3 accommodation adapter implemented as an optional, server-side supplier. Activation requires approved Managed Affiliate Partner access and Partner Centre credentials.
- [x] Booking.com adapter supports destination resolution, date/guest/room-specific accommodation search, property details/photos, redirect links, Neon caching, stale fallback and `/admin` request telemetry. Google Hotels remains a parallel fallback; Airbnb remains an external search link until authorized inventory access is available.
- [ ] Next: configure approved sandbox credentials and `BOOKING_COM_API_BASE=https://demandapi-sandbox.booking.com/3.3`, validate accommodation types, price/redirect data and cache telemetry, then switch to production credentials and the production base URL. Confirm public display, caching and commercial data rights for each source.
- [ ] Obtain approved live supplier access for broader airline and official package inventory.
- [ ] Confirm public display, caching and commercial data rights for each source.
- [ ] Add supplier price/availability revalidation.
- [ ] Add a direct airline/NDC source (evaluate Duffel) alongside Google Flights, without removing broad Google Flights discovery.
- [ ] Add affiliate network integrations after approval.
- [ ] Add compliant disclosures and click/conversion reporting.
- [ ] Add provider fallback and outbound-link health monitoring.
