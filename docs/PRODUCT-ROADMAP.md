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
- [x] Add user-triggered supplier-offer revalidation for exact flight seller tokens and selected property tokens. Explicit rechecks bypass Tripfinder's cache, keep SerpApi quota protections, and expose lookup time, provider-data time, cache state and stale-fallback state.
- [x] Add an optional traveler starting point for activity and dining searches, independent of flight airports or hotel selection. Resolve typed addresses, hotels, Airbnbs, colleges and venues through Geoapify geocoding with a seven-day cache and existing shared/per-visitor credit controls; use it for straight-line distance, on-demand road routes and local assistant proximity ranking. Keep the private starting point in the originating browser only and exclude it from public saved-trip links.
- [x] Shorten the cache lifetime for volatile flight seller options (5 minutes) and property rate options (10 minutes), while retaining bounded stale fallback and explicit refresh controls.
- [x] Preserve hotel offer price basis (total stay, per night, or unknown) rather than presenting an unclassified provider amount as a stay total.
- [ ] Verify supplier-declared inventory/availability and complete passenger/room basis with approved supplier responses; a refreshed quote is not a booking hold or a checkout guarantee.

**Release 4 partner-dependent items:** supplier-declared inventory confirmation, verified passenger/room basis, and complete all-in checkout totals require approved supplier responses. Keep hard budget enforcement advisory until each requested cost component has comparable, current, all-in totals. These items are intentionally deferred rather than simulated. Exact-date search remains the default; flexible date comparison is opt-in and consumes one cached calendar request only when the traveler asks to compare.


## Release 5 — persistence and trip workspace
- [x] Add Neon persistence for anonymous saved trip drafts and saved searches. Create short, random share tokens and store only SHA-256 token hashes; share pages are read-only, expire after 180 days, and exclude provider booking tokens and private API data.
- [x] Add a Save trip action to persist the validated search criteria and a selected-item snapshot; allow the original browser to update its saved draft using a separate owner token that is not placed in the URL.
- [x] Keep saved-trip items in the same chronological order as the live trip schedule, including flight airport-local departure times, check-in/check-out milestones, and activity/restaurant slot or exact times.
- [x] Move Save trip, Copy share link, and Open share link controls into the frozen trip overview above left-side quick navigation; restore the existing share link from the original browser's owner record.
- [x] Enrich public share and print views with selected-property/place photos, ratings, review counts, provider/source labels, Google Maps and official/listing links; sanitize all saved URLs and provide print-specific styling.
- [x] Display a round-trip flight reference or seller quote once in the saved itinerary; do not repeat the provider price on both outbound and return events. Separate-ticket outbound/return amounts remain distinct only when the seller explicitly supplies them.
- [ ] Add a safe "Make my own copy" action that forks a read-only shared trip into a new independently owned draft, issues new tokens, and restores only selections that can be matched unambiguously to refreshed provider results.
- [ ] Add traveler edits and feedback capture with explicit edit permissions and conflict-safe updates; public share links remain read-only in the current release.
- [ ] Optional user accounts only if needed; the first saved-trip version does not require accounts.
- [ ] Extend admin quality dashboard with provider availability history, stale-result detection, outbound-link monitoring and trip-search outcomes.

**Next Release 5 focus:** safe trip duplication/forking from a read-only share link, followed by invite-only traveler feedback and suggested edits with explicit permissions, owner approval, and conflict-safe saved-trip revisions. Never let a public share token mutate the original trip; new copies receive new share/owner tokens, and supplier booking credentials remain excluded.


## Release 6 — supplier depth and monetization
- [x] Initial Booking.com Demand API v3.3 accommodation adapter implemented as an optional, server-side supplier. Activation requires approved Managed Affiliate Partner access and Partner Centre credentials.
- [x] Booking.com adapter supports destination resolution, date/guest/room-specific accommodation search, property details/photos, redirect links, Neon caching, stale fallback and `/admin` request telemetry. Google Hotels remains a parallel fallback; Airbnb remains an external search link until authorized inventory access is available.
- [ ] Next: configure approved sandbox credentials and `BOOKING_COM_API_BASE=https://demandapi-sandbox.booking.com/3.3`, validate accommodation types, price/redirect data and cache telemetry, then switch to production credentials and the production base URL. Confirm public display, caching and commercial data rights for each source.
- [ ] Obtain approved live supplier access for broader airline and official package inventory.
- [ ] Confirm public display, caching and commercial data rights for each source.
- [x] Add user-triggered supplier quote revalidation with freshness labels and short cache windows; this does not independently confirm inventory, checkout totals or booking holds.
- [ ] Add a direct airline/NDC source (evaluate Duffel) alongside Google Flights, without removing broad Google Flights discovery.
- [ ] Add affiliate network integrations after approval.
- [ ] Add compliant disclosures and click/conversion reporting.
- [ ] Add provider fallback and outbound-link health monitoring.
