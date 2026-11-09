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

## Release 3 — verified trip assembly (next)
- Build a structured itinerary cost ledger separating flight, stay, ground transport, activities, food and contingency.
- Add real activity/point-of-interest provider with licensing and display-rights review.
- Add distance and travel-time estimates for activities, using a permitted maps/routing provider.
- Enforce hard budget constraints only when each relevant cost component is sourced and appropriately complete.
- Add flexible-date searches in a controlled way that respects provider quotas.
- Improve airport autocomplete and multi-airport coverage.
- Add test fixtures for round-trip token stages, hotel occupancy, currencies, time zones and supplier links.

## Release 4 — persistence and trip workspace
- Neon persistence for anonymous shareable trip drafts and saved searches.
- Optional user accounts only if needed.
- Shareable itinerary links, traveler edits and feedback capture.
- Admin quality dashboard: provider quota, cache hit rate, stale results, errors and search outcomes.

## Release 5 — supplier depth and monetization
- Obtain approved live supplier access for broader airline, hotel and official package inventory.
- Confirm public display, caching and commercial data rights for each source.
- Add supplier price/availability revalidation.
- Add affiliate network integrations after approval.
- Add compliant disclosures and click/conversion reporting.
- Add provider fallback and outbound-link health monitoring.
