# Tripfinder product roadmap

## Release 0 — polished interface (complete)
- Editorial-style responsive homepage and motion system.
- Structured trip-search form.
- Mobile-first results workspace.
- GitHub Actions ZIP overlay importer for mobile uploads.

## Release 1 — planning core (implemented, needs regression tests)
- Server-side trip input validation.
- Curated airport/city resolver.
- Curated destination catalog and explainable preference scoring.
- Date-specific itinerary outline builder.
- Direct external search links.

## Release 2 — live travel search (implemented; requires user credentials)
- SerpApi Google Flights adapter.
- Correct round-trip token flow: outbound selection, return search, then seller options.
- SerpApi Google Hotels adapter.
- Neon persistent response cache.
- Shared monthly and hourly uncached-query counters, per-connection limits, and real SerpApi Account API monthly and hourly balance checks with safety reserves.
- Provider timestamps, source labels, partial-result warnings and no-results handling.
- Explicit limitations for children age matching, multi-room occupancy, flexible dates and airport resolution.

## Release 2.5 — operations and API monitoring (implemented; pending deployment verification)
- Private `/admin` dashboard protected by a server-signed 12-hour HttpOnly session.
- Persistent five-failure/15-minute admin-login lockout using hashed client identifiers.
- Actual SerpApi account quota, app-level monthly/hourly reservations and warnings.
- Provider request, cache-hit, failure and blocked-request telemetry by category.
- WeatherAPI one-hour Neon cache with explicit call/cache telemetry.
- Recent sanitized request log, response timing, provider breakdown, 24-hour trend and Neon cache health.
- Telemetry retention cleanup after 90 days; logs omit search text, keys, booking tokens and raw addresses.

## Release 3 — AI-assisted planning and search efficiency (implemented; pending production verification)
- Optional OpenRouter free-model router with data-collection denial and zero-data-retention endpoint requirements.
- Optional Gemini 3.8 Flash free-tier fallback; only called after an explicit visitor opt-in because Google's unpaid service may use prompts and responses to improve its products.
- Result-aware assistant answers questions using only already-loaded provider results; it does not trigger live travel searches or invent availability, prices, amenities or booking terms.
- Six-hour Neon cache for identical assistant questions against the same result snapshot.
- Separate AI provider daily/minute and per-visitor limits, isolated from SerpApi's travel-search counters.
- AI calls, cache hits, provider errors and blocked requests appear in the existing `/admin` provider breakdown.
- Added explicit natural-language preference parsing on the initial search form. Visitors review an allowlisted draft and apply it before any travel-provider search runs.
- Parser supports destinations/areas, dates, travelers, rooms, budgets, trip components, hotel/rental type, entire-place/private/shared room, amenities, cabin, stops, hotel rating, cancellation and temperature preferences.
- Model output is parsed as JSON, allowlisted server-side, and cannot write directly to URLs or invoke travel providers. Unknown or unsupported values are ignored; current form values are changed only after visitor confirmation.
- Parser calls are cached in Neon for 24 hours, share existing AI daily/minute controls, and are logged as a separate `/admin` category without storing prompt text.
- Gemini fallback remains opt-in per parsing request. No Vercel AI Gateway integration.

## Release 4 — verified trip assembly (in progress)
- [x] Add an in-results trip cost ledger separating provider-displayed stay totals, reference-only flight quotes, user-entered ground transport/activity/dining estimates and a transparent contingency allowance. The displayed planning amount is explicitly partial; unknown amounts and ambiguous flight price bases are excluded.
- [x] Replace the dense trip-selection text block with compact flight, accommodation, activity and dining cards, including direct links to the exact selected result and clearly separate provider links.
- [x] Extend the travel timeline with selected flight departure/arrival times, links to selected results, editable property check-in/check-out time notes, and exact user-entered activity/restaurant times. Provider-unsupplied times remain visibly unconfirmed; editing a time does not create a reservation.
- Add real activity/point-of-interest provider with licensing and display-rights review.
- Add distance and travel-time estimates for activities, using a permitted maps/routing provider.
- Enforce hard budget constraints only when each relevant cost component is sourced and appropriately complete.
- Add flexible-date searches in a controlled way that respects provider quotas.
- Improve airport autocomplete and multi-airport coverage.
- Add test fixtures for round-trip token stages, hotel occupancy, currencies, time zones and supplier links.

## Release 5 — persistence and trip workspace
- Neon persistence for anonymous shareable trip drafts and saved searches.
- Optional user accounts only if needed.
- Shareable itinerary links, traveler edits and feedback capture.
- Extend admin quality dashboard with provider availability history, stale-result detection, outbound-link monitoring and trip-search outcomes.

## Release 6 — supplier depth and monetization
- Initial Booking.com Demand API v3.3 accommodation adapter implemented as an optional, server-side supplier. Activation requires approved Managed Affiliate Partner access and Partner Centre credentials.
- Booking.com adapter supports destination resolution, date/guest/room-specific accommodation search, property details/photos, redirect links, Neon caching, stale fallback and `/admin` request telemetry. Google Hotels remains a parallel fallback; Airbnb remains an external search link until authorized inventory access is available.
- Next: configure approved sandbox credentials and `BOOKING_COM_API_BASE=https://demandapi-sandbox.booking.com/3.3`, validate accommodation types, price/redirect data and cache telemetry, then switch to production credentials and the production base URL. Confirm public display, caching and commercial data rights for each source.
- Obtain approved live supplier access for broader airline and official package inventory.
- Confirm public display, caching and commercial data rights for each source.
- Add supplier price/availability revalidation.
- Add a direct airline/NDC source (evaluate Duffel) alongside Google Flights, without removing broad Google Flights discovery.
- Add affiliate network integrations after approval.
- Add compliant disclosures and click/conversion reporting.
- Add provider fallback and outbound-link health monitoring.
