# Tripfinder product roadmap

**Status key:** [x] implemented in the current source; [ ] still open, awaiting credentials, or pending a separate production/operator verification. A completed code change is not automatically production-verified.

## Roadmap execution strategy

Tripfinder development is split into four tracks so that partner approvals do not block product improvements and legal readiness is treated as its own workstream:

**Track A — Product readiness (active):** search accuracy, location relevance, editable trip planning, itinerary utility, traveler feedback and production confidence. These items can proceed with the current providers and infrastructure.

**Track B — Supplier readiness (partner-gated):** sandbox/production credentials, supplier inventory and pricing verification, commercial display rights, and additional direct inventory. Work may resume when the relevant provider grants access.

**Track C — Monetization (approval-gated):** affiliate applications, program-specific disclosures and partner-attributed conversion reporting. Existing outbound-click and redirect-health telemetry is already implemented; approval is only needed for network-specific attribution and commissions.

**Track D — Legal, privacy and trust readiness (cross-cutting):** accurate public-facing policies, clear user disclosures, privacy requests, retention/deletion controls, secure access to saved trips, vendor/data-use review and independent legal review. This work does not require affiliate approval and should be completed before materially expanding public use or activating monetization.

**Execution rules:** do not hold up Track A for affiliate, airline/NDC, package or accommodation-partner approval. Do not simulate supplier inventory, checkout totals, booking confirmation, affiliate approval or commission attribution. Do not publish legal documents with unresolved operator/contact placeholders or claims that have not been verified against the deployed system. Legal documents reduce ambiguity and risk; they do not guarantee immunity from claims or replace legal advice.

**Recommended product sequence:** Release 7 (search/location reliability), Release 8 (post-search editing and cost clarity), Release 9 (itinerary utility), then Release 10 (quality signals and production verification). Release 6 supplier/monetization work proceeds independently when access is available. Release 11 legal/privacy work may proceed in parallel, with publication and public-launch gates applied as described below.


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
- [x] Add a safe "Make my own copy" action that opens a temporary editable draft from a read-only shared trip, preserves selected flights, stays, activities, restaurants and schedule notes, and restores only unique matches against refreshed provider results. Create new share/owner tokens only when the traveler explicitly saves the copy. Never copy supplier booking tokens; flag unavailable or ambiguous selections for review.
- [x] Keep shared-trip copies as temporary browser drafts until the traveler explicitly presses Save trip; abandoned copies do not consume saved-trip quota, and legacy unmodified copies can be safely discarded with their original daily slot refunded.
- [x] Allow travelers to change departure/check-in and return/check-out dates from the frozen "Your Trip" overview. Refresh results for the new range, carry the copied itinerary and saved-trip owner access forward, shift activities by their original day offset, and flag flights or activities that require re-selection/rescheduling.
- [x] Add invite-only traveler feedback links with separate hashed invitation tokens; collaborators can submit bounded suggestions but cannot change the trip or view owner credentials.
- [x] Add an owner-only feedback inbox with reviewed/dismissed states, invitation expiry/submission limits, and optimistic revision checks to prevent stale concurrent review writes.
- [x] Let owners prepare a suggested activity/dining change, preview the exact itinerary impact, and explicitly confirm the edit. Apply the saved-snapshot patch and mark the feedback as applied in one revision-checked operation; free-form feedback never changes the itinerary automatically. Re-match the updated selection against current provider results.
- [x] Use a persistent anonymous browser identity for the five-new-saved-trips-per-UTC-day allowance. Store only a hash of a random 256-bit visitor ID; keep the raw ID in a one-year HttpOnly, Secure-in-production, SameSite=Lax cookie. Retain a higher 25-per-IP daily secondary abuse guard with hashed network identifiers.
- [x] Reserve visitor/IP quotas and create a new saved-trip record in one atomic SQL statement under transaction-scoped advisory locks. Failed inserts roll back both reservations; updates to existing saved trips and temporary copies do not consume new-save quota.
- [ ] Optional user accounts only if needed; the first saved-trip version does not require accounts.
- [x] Extend the authenticated admin dashboard with 7-day provider outcome rates, last-success/last-error timestamps, stale-cache and fallback counts, plus anonymous saved-trip activity and quota totals.
- [x] Add a browser-local **My trips** library that discovers saved owner records, opens the matching read-only itinerary, and routes the original owner directly to the editable workspace and feedback inbox without exposing owner tokens in URLs.
- [x] Detect the owner on their own shared-trip page when the matching browser credential is present, with a direct **Manage trip & feedback** action; keep the shared link read-only for everyone else.
- [x] Collapse traveler-feedback controls into a compact disclosure row and keep invitation links truncated with a separate copy action so the fixed results quick-navigation rail remains visible.
- [x] Add privacy-preserving outbound-link click/redirect-health monitoring and end-to-end trip-search funnel tracking. Only an ephemeral tab journey UUID (stored as a SHA-256 hash), provider/category enums, numeric result counts and the internal Google Flights redirect outcome are recorded; never store full provider URLs, booking tokens, search text, destination names, prices or personal data. External provider page loads and completed bookings remain unverified.

**Release 5 collaboration and persistence focus completed:** feedback-only invite links are separate from public read-only share links; the owner can preview and confirm supported activity/dining schedule changes, while stale revisions are rejected and suggestions never apply automatically. Saved-trip creation now uses a persistent anonymous browser identity with a secondary IP abuse guard and atomic quota reservation. Temporary copies, searches, and updates to existing trips remain outside the new-save allowance. Optional account support remains deferred until cross-device synchronization or demonstrated user demand justifies it. The admin dashboard now separates provider API health from the privacy-preserving trip funnel and outbound click/Google Flights redirect outcomes. These completed capabilities should be reused rather than reimplemented in later releases.


## Release 6 — supplier access and monetization (parallel, partner-gated)

This is an independent track, not a prerequisite for the product-readiness releases below. Keep it open without blocking ordinary Tripfinder development.

- [x] Initial Booking.com Demand API v3.3 accommodation adapter implemented as an optional, server-side supplier. Activation requires approved Managed Affiliate Partner access and Partner Centre credentials.
- [x] Booking.com adapter supports destination resolution, date/guest/room-specific accommodation search, property details/photos, redirect links, Neon caching, stale fallback and `/admin` request telemetry. Google Hotels remains a parallel fallback; Airbnb remains an external search link until authorized inventory access is available.
- [ ] Configure approved Booking.com sandbox credentials and `BOOKING_COM_API_BASE=https://demandapi-sandbox.booking.com/3.3`; validate accommodation types, price/redirect data and cache telemetry, then switch to production credentials and the production base URL. Confirm public display, caching and commercial data rights for each source.
- [ ] Obtain approved live supplier access for broader airline and official package inventory.
- [ ] Confirm public display, caching, refresh, attribution and commercial data rights for every enabled supplier/source before production use.
- [x] Add user-triggered supplier quote revalidation with freshness labels and short cache windows; this does not independently confirm inventory, checkout totals or booking holds.
- [ ] Evaluate and, only after access and commercial terms are confirmed, integrate a direct airline/NDC source (for example, Duffel) alongside Google Flights; retain broad Google Flights discovery.
- [ ] Apply for affiliate network programs and advertiser approvals when eligible; record each network's actual approval state rather than treating application or account creation as approval.
- [ ] Publish program-specific affiliate disclosures before enabling monetized links, consistent with each program's requirements and applicable law. Clearly distinguish organic results from sponsored placements.
- [ ] Add partner-attributed conversion reporting only where the approved network supplies permitted reporting/postback data. Do not infer bookings or commissions from outbound clicks.
- [x] Maintain provider-specific fallback behavior, admin provider outcome/fallback telemetry, and privacy-preserving outbound-click / internal redirect-health monitoring. External provider page loads and completed bookings remain unverified.

**Partner-gate rule:** an adapter in source code is not an activated supplier. Keep disabled integrations disabled until credentials, technical approval, display rights, caching rules and commercial terms are confirmed. Do not make an application, redirect, outbound click or quote refresh look like a completed booking.


## Release 7 — search reliability and local relevance (active product track)

**Goal:** make the results match the traveler's actual request, especially when a prompt combines multiple constraints and asks for nearby places. This release can proceed with current providers and cached data.

- [ ] Add end-to-end natural-language search regression scenarios that verify destination/country, origin and destination airports, dates, trip duration, traveler count, total/per-person budget, accommodation type, entire-place/private-room requirements, nonstop/stop limits, and requested trip components survive parsing, confirmation and initial search.
- [ ] Normalize destination geography before provider calls. Prevent airport codes, street names, regions or similarly named places from silently replacing the traveler's intended city, island or country. Ask for a correction when a material location ambiguity cannot be resolved safely.
- [x] Improve local place-result relevance across Google Maps/SerpApi and Geoapify: normalize food and attraction categories, reject mixed map records containing irrelevant infrastructure/address features, and deduplicate repeated businesses/POIs across provider IDs using normalized names and coordinates. Preserve provider/source attribution and do not invent ratings or hours.
- [x] Rank loaded activities and restaurants nearest-first by straight-line proximity when the traveler has a resolved custom starting point or selected stay. A custom starting point takes precedence; the selected stay is the default; flight airports remain independent.
- [ ] Enforce explicit proximity requests as hard filters or clearly separated in-range/out-of-range groups. Until a matching route is available, do not label a result as satisfying a requested driving/walking time limit.
- [ ] Apply the requested travel mode and measurement consistently: driving/walking time when requested, route distance when appropriate, and clearly labeled straight-line distance only as a geographic estimate. Do not claim a result is within a time limit until a comparable route has been obtained.
- [ ] Improve ranking and filtering for neighborhood proximity and explicit distance/time limits. Reuse loaded result data first; calculate road routes only for relevant candidates and only when requested/needed.
- [x] Improve assistant answers to rank already-loaded stays against a named beach or landmark using matching loaded place coordinates, and to compare provider-listed nearby-place route durations only within comparable travel modes. The assistant distinguishes straight-line estimates from road/walking routes and does not trigger an unrelated provider search.
- [x] Add regression coverage for category errors, duplicate results, origin precedence, nearest properties to named beaches/landmarks, unknown landmarks, and no false travel-time claims from straight-line coordinates.
- [ ] Add end-to-end route-limit regression cases for restaurants within a specified driving-time limit, out-of-range alternatives, and no qualifying nearby results.
- [x] Verify that ordinary result sorting and local assistant proximity answers operate on loaded data without new provider calls or additional route-credit consumption.

**Implementation slice completed in source:** provider category cleanup and local deduplication; nearest-first result ordering from the resolved custom origin or selected stay; named-landmark-to-stay comparison in the local assistant; and regression coverage for those behaviors. These changes use loaded coordinates and provider-supplied nearby routes only. They do not yet enforce a requested minute limit by routing every candidate, and they have not yet been deployment-verified.

**Acceptance criteria:** a mixed natural-language prompt produces the same confirmed destination, date range, traveler count, trip components and constraints in the final search; nearby results identify the correct origin and only label a result as within a requested travel-time limit when comparable route evidence supports it.


## Release 8 — post-search editing and cost clarity (active product track)

**Goal:** let travelers refine a trip after results load without restarting unnecessarily or losing valid selections.

- [ ] Add an editable post-search total-trip budget in the frozen trip overview. Clearly label whether the amount is for the whole trip or per traveler; preserve the selected currency and display the conversion/source basis when currency conversion is introduced.
- [ ] Recalculate budget readiness, remaining budget and over-budget status immediately when the budget changes, without silently changing selected flights, stays or places.
- [ ] Keep unknown, indicative, per-night, partial and user-entered amounts separate. Do not sum incompatible currencies or mix per-person and total-trip amounts.
- [ ] Improve the cost ledger to show selected flight seller quote basis, full-stay accommodation total, known taxes/fees when supplied, and traveler-entered estimates for transport, activities, dining and other expenses. Clearly identify missing or unconfirmed costs.
- [ ] Allow travelers to edit supported search criteria after the initial search (at minimum budget and traveler count). Explain which result categories need refreshing before applying changes.
- [ ] When refreshed results are required, preserve selections that still match exactly; flag selections that become invalid, stale or ambiguous. Never silently substitute a different flight, property, room type or activity.
- [ ] Keep a clear distinction between a planning estimate, provider-displayed quote, revalidated offer and confirmed booking. A refreshed offer is not a hold or checkout guarantee.
- [ ] Add regression coverage for budget edits, budget currency/price-basis handling, traveler-count changes, selection preservation, invalidation warnings and no silent substitution.

**Hard-budget enforcement remains conditional:** only enforce a hard ceiling when every required cost component is current, comparable, in the same currency and sufficiently complete (including relevant taxes/fees and passenger/room basis). Until then, keep the limit advisory and show exactly what is excluded or unknown. This completes the existing open Release 4 budget item only when those data requirements are genuinely met.


## Release 9 — itinerary utility and trip management (active product track)

**Goal:** keep Tripfinder useful before, during and after travel, including for trips booked directly with external providers.

- [ ] Allow travelers to add manual itinerary entries for transportation, lodging, activities, dining and other trip events when no provider result exists or a booking was made elsewhere. Manual entries must not trigger provider API calls.
- [ ] Support clear item states such as planned, booked, completed and canceled. These are traveler-maintained notes, not supplier-confirmed booking statuses.
- [ ] Track estimated versus actual trip spending and show the difference from the original budget without overwriting the original estimate.
- [ ] Add a downloadable calendar export (ICS) for selected flights, accommodation milestones and scheduled activities/dining. Preserve local time zones where known; label unknown or date-only times rather than inventing times.
- [ ] Improve the printable itinerary as a practical travel document, with day-by-day schedule, addresses, selected links, important notes and estimated/actual cost summaries. Reuse the existing print/share view rather than creating duplicate itinerary storage.
- [ ] Add an optional travel-preparation checklist (for example documents, transport arrangements and items the traveler chooses to track). Keep entries user-controlled and avoid collecting passport numbers, payment details or other unnecessary sensitive data.
- [ ] Ensure manual entries and actual-cost notes have clearly defined privacy behavior for owner-only, shared and exported views. Do not expose private notes in public shared links by default.
- [ ] Add regression tests for manual entries, time-zone-safe calendar exports, status transitions, actual-versus-estimated totals and share/print privacy boundaries.


## Release 10 — traveler feedback, quality signals and production confidence

**Goal:** measure result quality and verify the deployed experience rather than treating code completion as proof of production readiness.

- [ ] Add optional structured result feedback (for example wrong location, incorrect category, outdated price, unmet property requirement, unavailable result, or incorrect distance/time). Do not require free-form search text or personal information.
- [ ] Aggregate result-quality signals by provider, category and issue type in `/admin`. Use minimum aggregation thresholds where needed; do not expose individual traveler feedback or private trip contents in operational dashboards.
- [ ] Connect funnel metrics to useful quality questions: search completion, no-result rates, selection rates, refresh outcomes, stale-cache use and outbound clicks by provider/category. Keep the distinction between internal redirect handling, external page load and actual booking explicit.
- [ ] Add a repeatable production release checklist covering full Vercel build/typecheck, regression suite, Neon persistence and atomic quota behavior, provider credentials and live responses, caching/stale fallback, provider-credit guardrails, mobile/desktop layouts, saved/shared-trip permissions, and privacy checks.
- [ ] Verify every enabled provider's source labels, timestamps, error/fallback states and user-facing limitations in production.
- [ ] Confirm that secrets remain server-side, private starting points and owner credentials are not exposed in public links, telemetry excludes search text and sensitive trip data, and admin routes remain protected.
- [ ] Record the exact deployment/version and validation evidence for each production release; distinguish automated tests, staging verification and live-provider verification.
- [ ] Reassess optional user accounts only if travelers need cross-device trip synchronization, account recovery or other features that cannot be safely delivered through the current anonymous saved-trip model.

**Completion rule:** a feature is “implemented” when its code and automated checks are complete; it is “production-verified” only after the corresponding deployed, database and provider checks have actually passed.

## Release 11 — legal, privacy and trust readiness (cross-cutting; pre-expansion gate)

**Goal:** give travelers clear, accurate information about who operates Tripfinder, how their information is handled, what the service does and does not provide, and how third-party travel providers fit into the experience. Reduce avoidable legal and operational risk without implying that disclaimers eliminate liability.

**Brand and operator approach:** use **Tripfinder** as the public-facing service name. The legal operator is not yet settled and must be identified before publication. Do not invent a company, imply that Tripfinder is a registered entity, or publish placeholder names/emails. Keep policy drafts separate from public-facing pages until the operator, contact channel, effective date and counsel review are complete. Preserve flexibility for a future sale or change of control, subject to applicable privacy and contract requirements.

### 11.1 — data inventory and privacy policy
- [ ] Create and maintain a data inventory and flow map based on the deployed application, covering search inputs, trip details, saved and shared itineraries, feedback submissions, anonymous visitor identifiers, hashed abuse-prevention identifiers, analytics/telemetry, browser storage and support communications.
- [ ] Document each data category's purpose, source, storage location, access roles, service-provider recipients, retention period and deletion mechanism. Distinguish raw identifiers from hashed/pseudonymous identifiers; do not describe hashing as anonymization where re-identification or linkage remains possible.
- [ ] Draft a Tripfinder Privacy Policy that accurately describes actual practices, including the anonymous visitor cookie, saved-trip and share-link behavior, AI assistant processing, optional Gemini use/consent, analytics, third-party links, retention, security practices and privacy request procedures.
- [ ] Verify current OpenRouter, Google/Gemini, Vercel, Neon, Geoapify, SerpApi and any other enabled provider terms/data practices. Update the data-flow map and policy whenever a provider or data use changes.
- [ ] Decide and document the intended age requirements and whether any child-directed functionality or collection is prohibited. Implement the corresponding age-related safeguards; do not claim child-safety compliance without validation.
- [ ] Review applicability of New Jersey, other U.S. state, federal and non-U.S. privacy requirements based on actual users, processing and business thresholds. Do not assume that a law applies or does not apply solely because the operator is located in New Jersey.

### 11.2 — terms of service and user-facing disclosures
- [ ] Draft Tripfinder Terms of Service identifying the actual legal operator and contact route, describing permitted use, user responsibilities, accounts/anonymous saved trips, shared-link risks, user submissions, intellectual property, suspension/termination, third-party services, disclaimers and dispute/contact procedures.
- [ ] Have qualified counsel determine appropriate governing-law, venue, warranty, limitation-of-liability, indemnification and dispute-resolution language. Do not insert an arbitration waiver, class-action waiver or other potentially unenforceable term without counsel's advice and any legally required assent process.
- [ ] Clearly state that Tripfinder is a planning/comparison service and that external providers control their own inventory, prices, booking, payments, cancellations, refunds and fulfillment unless a future integration expressly changes that arrangement.
- [ ] Keep price, availability, maps, route, weather, AI-output and booking disclaimers close to the relevant results or actions, not only in the Terms. Distinguish estimates, straight-line distances, routed estimates, cached provider snapshots, revalidated offers and confirmed transactions.
- [ ] Add a dedicated affiliate/sponsored-content disclosure standard before any paid placement or affiliate link is activated. Disclosures must be clear, conspicuous and close to the recommendation/link; preserve the distinction between organic ranking and paid placement.
- [ ] Publish a clear Contact / Privacy Requests method and identify the actual operator. Do not publish policies with unresolved placeholders or a nonfunctional email address.

### 11.3 — privacy rights, retention and deletion
- [ ] Provide a privacy-request workflow appropriate to applicable law, including access, correction, deletion and appeal/opt-out handling where legally required. Define identity verification and response ownership without collecting excessive additional personal data.
- [ ] Implement dependable scheduled cleanup for expired saved trips, feedback invitations, feedback submissions and telemetry according to documented retention periods. Do not promise a deletion deadline until the operational job and backup behavior are verified.
- [ ] Define backup, log, cache and vendor-retention treatment for deletion requests; document any legally permitted retention exceptions and when deleted records age out of backups.
- [ ] Provide a process for users to report exposed shared links or request revocation. Explain that anyone with a valid share link may be able to view the shared itinerary until it expires or is revoked.
- [ ] Document how browser-local saved-trip credentials and data are cleared, and clarify what cannot be synchronized or recovered across devices under the anonymous-trip model.

### 11.4 — security and operational risk controls
- [ ] Review owner-token storage and access controls. Prefer HttpOnly, appropriately scoped secure cookies or another server-controlled mechanism over exposing long-lived owner credentials to JavaScript-accessible local storage, while preserving the anonymous saved-trip workflow.
- [ ] Verify least-privilege access to Neon, Vercel environment variables, provider dashboards, admin routes, logs and production deployments. Maintain a credential-rotation process and never expose provider secrets to the browser.
- [ ] Create a written security incident and privacy breach response procedure covering triage, containment, evidence preservation, vendor coordination, legal notification assessment and user communications.
- [ ] Establish a documented security review for shared links, invite tokens, admin authentication, rate limits, CSRF/origin protections, input validation, dependency updates and exports.
- [ ] Review accessibility and consumer-facing claims for clarity; ensure the interface does not imply a provider relationship, endorsement, guaranteed result or completed booking where none exists.
- [ ] Assess appropriate business structure, intellectual-property ownership, contractor/maintainer agreements and insurance (including technology errors-and-omissions and cyber coverage) with qualified professionals. These are business decisions, not substitutes for secure implementation.

### 11.5 — publication, consent and ongoing governance
- [ ] Add persistent footer links to Privacy, Terms, Disclosures and Contact pages, with accessible mobile layouts and stable URLs.
- [ ] Implement an affirmative Terms acceptance flow where appropriate to the feature and legal advice; record the policy version and timestamp with the minimum necessary evidence. Do not treat passive browsing or a pre-checked box as affirmative acceptance.
- [ ] Add a policy-version/change log and an operational review trigger whenever data collection, AI providers, analytics, retention, sharing, commercial relationships or material product behavior changes.
- [ ] Ensure consent choices for optional processing (including the Gemini fallback) are specific, informed, revocable where applicable and reflected in the actual request path.
- [ ] Obtain independent U.S. technology/privacy counsel review of the Privacy Policy, Terms, disclosures, data flows, retention controls and any proposed dispute-resolution terms before public publication.
- [ ] Complete a final operator/contact/effective-date check, deploy the public documents, and verify every footer and in-context legal link on mobile and desktop.

**Release 11 completion criteria:** the legal operator and working contact route are identified; policies match verified production data flows; required request/retention/security workflows operate as described; disclosures are visible at the relevant decision points; attorney review is documented; and deployed links are tested. Draft documents alone do not complete this release.

