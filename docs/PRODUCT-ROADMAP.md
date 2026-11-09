# Tripfinder product roadmap and delivery status

**Status reviewed: November 9, 2026**

Tripfinder is currently in **Release 3 — verified trip assembly**. The project has moved beyond a destination-search prototype: users can search live provider inventory, select outbound and return flights, compare sellers, select lodging, add attractions and restaurants, and assign places to itinerary days and meal/activity slots. It is not yet a booking engine: reservations, payment, and supplier-side price confirmation still happen on external provider websites.

## Release 0 — polished interface (complete)
- Editorial-style responsive homepage and motion system.
- Structured trip-search form.
- Mobile-first results workspace.
- GitHub Actions ZIP overlay importer for mobile updates.

## Release 1 — planning core (implemented; regression coverage remains)
- Server-side trip input validation and date/traveler/budget preferences.
- Airport/city resolver and expanded destination selection for countries, U.S. states, cities and regional areas.
- State-to-city/area selection and regional searches (for example, the Poconos and nearby towns).
- Curated destination suggestions and date-specific itinerary outline builder.
- Direct external search links when live inventory is not requested or not supported.

## Release 2 — live travel search (implemented; operational hardening ongoing)
- SerpApi Google Flights adapter with outbound selection, return-flight lookup and round-trip seller comparison.
- SerpApi Google Hotels and vacation-rental adapter.
- Activities, attractions and restaurant search through Google Maps/Local results.
- Neon persistent response cache and shared monthly/hourly/per-connection request controls.
- SerpApi account quota checks and safety reserves before uncached requests.
- Provider timestamps, source labels, partial-result warnings and explicit no-results handling.
- Booking handoff for Google Flights seller requests is being hardened. Opaque Google booking POSTs do not always resolve to a seller deep link; the app must fall back to the exact route/date search instead of failing.
- Known provider limitations remain for child-age fares, multiple-room occupancy, supplier taxes/fees, and availability changes between search and checkout.

## Release 3 — verified trip assembly (in progress; current focus)
**Implemented:**
- Selection of outbound and return flight legs and preferred seller offers.
- Selection of one hotel or vacation rental.
- Multiple activity and restaurant selections, assigned to specific dates and time slots.
- Daily lunch and dinner itinerary slots, with selected restaurants inserted into the plan.
- Regional destination handling for state/country/city/area searches.

**Remaining work, in priority order:**
1. **Booking handoff reliability:** validate airline/OTA deep links, use exact Google Flights fallback when a provider booking token cannot resolve, and monitor outbound-link failures.
2. **Trip cost ledger:** calculate a sourced estimated total for airfare, stay, activities, meals, ground transport and contingency. Clearly distinguish quoted totals from estimates and avoid treating unknown taxes/fees as zero.
3. **Itinerary verification and routing:** use a permitted routing provider for drive/transit/walk times, cluster nearby activities, respect opening hours and avoid scheduling closed venues or impossible transfers.
4. **Search quality:** improve place category diversity, locality/radius matching, airport autocomplete, multi-airport coverage, and destination-specific no-result fallbacks.
5. **Automated regression tests:** cover round-trip token transitions, seller options and link fallbacks, city/state/country matching, currencies, time zones, hotel occupancy, provider cache behavior, and malformed/empty provider responses.
6. **Traveler preference controls:** add sorting and filters for airline, stops, baggage, cancellation, hotel type, rating, meal preference and activity category without unnecessary extra provider calls.

## Release 4 — persistence and trip workspace (not started)
- Neon persistence for anonymous saved trip drafts and saved searches.
- Shareable itinerary links and traveler edits.
- Optional accounts only if they provide meaningful value beyond shareable anonymous trips.
- Admin quality dashboard for provider quota, cache hit rate, data age, errors, outbound-link health and search outcomes.

## Release 5 — supplier depth and monetization (not started)
- Obtain approved supplier access for broader airline, hotel and package inventory.
- Confirm public display, caching and commercial data rights for each source.
- Add supplier price/availability revalidation before checkout.
- Add affiliate network integrations after approval, followed by clear disclosures and click/conversion reporting.
- Do not rely on affiliate revenue until advertiser approval and tracked conversion are verified.

## Release gates
- A search result is not a reservation or a guaranteed price.
- A booking action must open a valid external supplier destination or a usable exact search fallback; it must never strand the user on an API endpoint or an opaque Google redirect URL.
- A total trip budget should only be marked as within budget when each included cost is sourced or the unknown components are explicitly estimated and disclosed.
- New provider calls must remain behind Neon caching, account-quota checks and global/per-connection request limits.
