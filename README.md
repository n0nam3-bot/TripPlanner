# Tripfinder — travel planning and comparison platform

Tripfinder is a travel-planning and provider-comparison application. It helps travelers define trip requirements, discover destinations from a curated catalog, create a first-pass itinerary, and request current flight and hotel search results from a server-side provider adapter. It does not sell tickets, make reservations, process payments, or guarantee supplier prices.

## Mobile ZIP updates with GitHub Actions

The repository includes `.github/workflows/import-project-zip.yml`. After the one-time workflow setup, upload future project ZIP files directly into the **repository root** from your phone and commit them. GitHub Actions safely unpacks the archive into the repository's normal folder structure, overwrites matching files, adds new files, removes the ZIP from the current working tree, and commits the extracted update. If the repository is connected to Vercel, that extracted commit should trigger a deployment.

The importer is overlay-only: matching files are replaced and new files are added, but files absent from a ZIP are not deleted. It protects `.github/`, build folders, real `.env` files and private-key files. The ZIP remains in Git history after its removal from the current file tree. See [`docs/MOBILE-ZIP-UPDATES.md`](docs/MOBILE-ZIP-UPDATES.md).

## Current functional scope

- Responsive editorial-style homepage and structured trip-search form.
- Server-side validation for date ranges, traveler counts, child ages, rooms, budget, cabin class, stop preference, hotel class and currency.
- Seven explicit search combinations: flights, stays (hotels and vacation rentals), activities, or any combination of those categories.
- Destination autocomplete groups countries/regions, gateway airports, cities and attractions. Selecting a country-wide destination preserves the region for stays/activities and stores a chosen gateway separately when flights are requested.
- Destination matching against a curated planning catalog. Internal ranking orders candidate ideas, but the UI does not display invented precision scores.
- Date-specific itinerary outline generation without repeating the same template day. It is planning guidance, not verified attraction inventory or opening hours.
- Live Google Flights, Google Hotels/vacation-rental and local place/attraction search through server-side SerpApi adapters, plus optional Booking.com Demand API accommodation search for approved Managed Affiliate Partners.
- Round-trip flight selection is staged correctly: outbound options first, then return options for the chosen outbound, then seller/booking options when supplied by the provider.
- Booking.com Demand API searches include the selected room count and child ages when partner access is configured. Google Hotels does not accept the requested room count through its current SerpApi search endpoint, so those Google rates must be reconfirmed with the seller.
- Google Hotels receives children's ages. Google Flights currently receives the child count but not individual child ages, so age-specific fares need seller confirmation.
- Provider responses are cached in Neon. Before each uncached search, Tripfinder checks the SerpApi Account API (which does not consume search credits) and enforces shared monthly, hourly and per-connection request limits.
- Hotel cards always include a property/details or Google Hotels fallback link; seller-rate links are shown only when the provider returns them. Flight cards show outbound offers first, followed by return-leg and seller lookups.
- Selected flights, stays, activities and restaurants are summarized in compact trip cards with links back to their exact result cards and separate provider/listing links. The travel timeline shows provider-displayed flight times; property check-in/check-out and activity/restaurant times can be entered from booking confirmations, and are labelled as user notes rather than provider-confirmed reservations.
- Activity and restaurant results can use Geoapify Places backed by OpenStreetMap when `GEOAPIFY_API_KEY` is configured. Every such listing carries Geoapify and OpenStreetMap attribution and opens its mapped OSM location. Without that key, the existing SerpApi Google Maps/Local path remains active.
- Coordinate-based driving checks can use Geoapify Routing when configured. Requests are user-triggered, Neon-cached, and labeled as estimates without live traffic; the existing SerpApi directions path remains available for address-only requests or when Geoapify is not configured.
- Hotel/activity proximity uses coordinates and clearly labels straight-line distances. Driving directions are looked up only when the user requests them and consume an additional provider request.
- General outbound Google Flights, Google Hotels, Google Maps, Viator and GetYourGuide search links work without affiliate accounts.
- `/api/health` reports whether provider and database environment variables are present. This is a configuration check only; the first live query verifies provider credentials and database connectivity.

## Live search setup (required to search current flight/hotel data)

The site can still run in planning-only mode without credentials. To enable provider search, create these two accounts/values:

1. **SerpApi API key** — register at [SerpApi](https://serpapi.com/) and copy the private API key from the dashboard. The current free plan advertises 250 searches per month. Review current plan details and provider terms before enabling search on a public or commercial site.
2. **Neon PostgreSQL** — create a database at [Neon](https://neon.tech/) and copy its pooled connection string. Once `DATABASE_URL` is configured and deployed, opening `/api/health` automatically creates and verifies the provider-cache, usage-control, admin-auth and telemetry tables. No SQL editor step is required. An auditable, repeatable manual schema is also included at `db/schema.sql`; it includes the Geoapify daily counters and shared request gate.

In Vercel, open **TripPlanner → Settings → Environment Variables** and add:

| Name | Value | Environments |
|---|---|---|
| `SERPAPI_API_KEY` | Your private SerpApi key | Preview and Production |
| `GEOAPIFY_API_KEY` | Optional private Geoapify project key for OSM-based places and coordinate routing | Preview and Production (optional) |
| `GEOAPIFY_DAILY_CREDIT_CAP` | `2400` shared credits per UTC day | Preview and Production (optional; default 2400; hard max 2800) |
| `GEOAPIFY_CLIENT_DAILY_CREDIT_CAP` | `80` credits per visitor per UTC day | Preview and Production (optional; default 80; hard max 300) |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string | Preview and Production |
| `SUPPORT_TIP_URL` | Public HTTPS tip page; defaults to the supplied Streamlabs page | Production (optional) |
| `SERPAPI_MONTHLY_SEARCH_CAP` | `200` | Preview and Production (optional; default is 200) |
| `SERPAPI_HOURLY_SEARCH_CAP` | `30` | Preview and Production (optional; default is 30) |
| `SERPAPI_PROVIDER_QUOTA_RESERVE` | `75` | Preview and Production (optional; default is 75) |
| `SERPAPI_PROVIDER_HOURLY_RESERVE` | `10` | Preview and Production (optional; default is 10) |
| `WEATHERAPI_API_KEY` | Optional WeatherAPI key | Preview and Production (optional) |
| `ADMIN_DASHBOARD_SECRET` | Random secret of at least 32 characters; also used as the `/admin` login password | Production (optional; required for admin access) |
| `BOOKING_COM_API_BASE` | `https://demandapi.booking.com/3.3` (or the official sandbox URL when using sandbox credentials) | Preview and Production (optional; defaults to production) |
| `BOOKING_COM_API_TOKEN` | Booking.com Demand API token from Partner Centre | Preview and Production (optional; requires approved Managed Affiliate Partner access) |
| `BOOKING_COM_AFFILIATE_ID` | Booking.com `X-Affiliate-Id` from Partner Centre | Preview and Production (optional; required with the API token) |
| `BOOKING_COM_BOOKER_COUNTRY` | ISO-2 booker country, e.g. `us` | Preview and Production (optional; defaults to `us`) |

Save the variables and redeploy the latest deployment. For `ADMIN_DASHBOARD_SECRET`, generate a long random password (at least 32 characters), save it as a server-side Vercel environment variable, and enter that same value on `/admin`. Do not use `NEXT_PUBLIC_` prefixes, and never put credentials in GitHub, ZIP files, browser code, or screenshots. Keep secrets in Vercel's server-side environment settings only.

### Optional Geoapify / OpenStreetMap place and routing provider

To enable the alternative place-data source, create a project and server-side API key at [Geoapify MyProjects](https://myprojects.geoapify.com/), then set `GEOAPIFY_API_KEY` in Vercel and redeploy. Do not add it to browser code or prefix it with `NEXT_PUBLIC_`. When the key is absent, Tripfinder continues to use the existing SerpApi Google Maps/Local place path. Geoapify is only used for categories and destination anchors with coordinates in Tripfinder's maintained location catalog.

The current Geoapify documentation advertises 3,000 free credits per day; Places API usage is charged per results returned (one credit for up to 20 places), while Routing credits depend on waypoint pairs, route distance and optional features. Tripfinder requests up to 40 places per category, reserves two credits before an uncached Places request, and reserves a conservative route estimate before coordinate-based directions. Neon tracks a shared default cap of 2,400 credits/day and a visitor cap of 80 credits/day. A shared database-backed request gate spaces uncached calls by 400 ms (about 2.5 requests/second), below the Free plan's currently listed limit of 5 requests/second. To avoid long serverless waits during a burst, requests queued more than three seconds are rejected for a retry rather than being sent in an uncontrolled burst. Those are Tripfinder reservations, not a live read of all activity on a Geoapify account; failed calls and the conservative route estimate may cause the reserved count to exceed billed usage, and other applications using the same key are not included. Monitor the Geoapify dashboard as well.

Geoapify requires OpenStreetMap attribution and a follow-link to Geoapify on the Free plan. Its current pricing FAQ says the Free plan may be used for commercial websites and apps in production while staying within credit, rate and feature limits and providing the required attribution. The Terms page separately describes commercial Free-package use in production as subject to limitations and invites customers to contact Geoapify for details. Before public launch, confirm that Tripfinder's exact use, caching, data display and attribution are covered by the plan and terms. Attribution links are shown with Geoapify-backed listings. OpenStreetMap-derived place data does not include Google-style ratings or review counts, so Tripfinder does not fabricate them. Routing times are estimates without live traffic. See the [Places API pricing](https://apidocs.geoapify.com/docs/places/places/), [Routing API pricing](https://apidocs.geoapify.com/docs/routing/routing/), [Geoapify pricing FAQ](https://www.geoapify.com/pricing/), and [Geoapify terms](https://www.geoapify.com/terms-and-conditions/).

### Optional Tripfinder support tips

The homepage and search-results footer include a voluntary **Support Tripfinder** link. It opens the configured tip page in a new tab; the default is `https://streamlabs.com/artofreyes/tip`. To change providers later, update `SUPPORT_TIP_URL` in Vercel → Project → Settings → Environment Variables and redeploy. This is a public destination URL, not a secret. Tripfinder does not collect payment details, process tips, store tip transactions in Neon, or receive payment webhooks; Streamlabs and its payment processor handle the transaction.

### Optional Booking.com accommodation supplier

Tripfinder includes an optional Booking.com Demand API v3.3 accommodation adapter. It activates only when both `BOOKING_COM_API_TOKEN` and `BOOKING_COM_AFFILIATE_ID` are configured. Booking.com requires Managed Affiliate Partner registration, Partner Centre access and credentials issued under an approved agreement; the API key and affiliate ID must remain server-side. The adapter resolves city/region destinations, searches date- and guest-specific availability, retrieves property details/photos, and stores provider responses in the shared Neon cache. Its API calls appear separately in `/admin` under Booking.com. Google Hotels remains active as a parallel source and fallback. Booking.com inventory and website inventory may differ, and displayed rates must be rechecked with the seller.

The Booking.com adapter supports the search-and-redirect flow only; it does not create bookings or process payments. `/api/health` reports whether partner credentials are present and whether the production or sandbox endpoint is selected. Its availability depends on the user's partner permissions. `BOOKING_COM_API_BASE` accepts only the official v3.3 production or sandbox endpoint, and the endpoint is part of the cache key so sandbox data cannot be reused in production. Airbnb remains a direct search link; this integration does not access Airbnb's private inventory.

### Private operations dashboard

Open `https://your-production-domain/admin` after setting `ADMIN_DASHBOARD_SECRET`. The dashboard requires a signed, 12-hour HttpOnly session and rate-limits failed logins. It reports the live SerpApi account quota, Tripfinder's own monthly/hourly reservations, provider API calls, cache hits, errors, category-level usage, Neon cache health and recent sanitized request events. Data refreshes every 30 seconds. SerpApi search events and WeatherAPI forecasts are instrumented; WeatherAPI daily responses use a one-hour Neon cache. Event logs omit search terms, API keys, booking tokens and raw IP addresses, and are pruned after 90 days. The initial dashboard will show only events recorded after this update is deployed; historical requests cannot be reconstructed retroactively.

### Request budget and caching

- Exact matching flight, return-flight and seller-option queries are cached in Neon for one hour; hotel queries are cached for one hour. This aligns with the provider's documented one-hour response cache and reduces repeat requests.
- Tripfinder checks the real SerpApi account balance before any uncached provider search. The Account API does not use a search credit; its normalized monthly and hourly quota response is cached for 60 seconds.
- Repeated exact queries served from Tripfinder's cache do not call SerpApi again.
- The app's default global limit is **200 uncached provider requests per UTC calendar month**, leaving a reserve against SerpApi's currently advertised 250-search free quota. The configured limit is hard-clamped to 230. SerpApi's account check also protects the provider's own billing-cycle balance, including searches made elsewhere with the same key.
- The default shared hourly cap is **30 uncached provider requests per UTC hour**, below the currently advertised Free-plan 50-per-hour throughput. It is hard-clamped to 45. The account-level hourly check also considers calls made with the same SerpApi key outside Tripfinder. The per-connection caps remain 15 per hour and 45 per day.
- New uncached searches pause when the SerpApi Account API reports **75 or fewer monthly searches remaining** or **10 or fewer account-level hourly requests remaining** by default. Both reserves are configurable and hard-clamped. If the account quota cannot be checked, Tripfinder fails closed rather than risk spending beyond the balance.
- A destination check uses one provider request for each selected provider category: one flight query, one query per selected stay type, and one activity query per POI category. With Geoapify enabled, the activities and restaurants requests are separate Places calls, each requests up to 40 places (two credits if 40 are returned) and is cached for 12 hours. Without Geoapify, the existing Google Maps query and separately cached Google Local fallback remain active. Selecting an outbound flight for return options, opening airline seller options, retrieving hotel rate options, and requesting driving directions each use additional provider requests.
- Coordinate-based Geoapify driving checks are on-demand only and cached for 12 hours; the interface identifies them as estimated road time without live traffic. No route calls run just because a results page is opened. The Geoapify counter reserves credits before requests, and a blocked cap request does not call the provider.
- The app reserves a counter slot before each external call. Failed calls count in Tripfinder's own usage counter conservatively, even if the provider does not count them. This avoids spending beyond the intended safety ceiling.
- The cap is shared across all visitors and deployments that use the same Neon database. It is not per user.
- Uncached requests are also limited by a hashed requester address to 15 per hour and 45 per day. Cached hits do not consume this provider-request allowance.

### Current provider limitations

- SerpApi's Google Flights integration is a search-data source, not an airline reservation system. Round trips require choosing an outbound flight and then requesting return options with the provider token. Seller options may be available after that selection. A booking link is not a reservation.
- Flight search currently resolves airports from the built-in city/airport map or a three-letter IATA code. It does not yet have a live airport-autocomplete service.
- Google Flights receives child count but not each child's age; sellers must confirm age-specific fares.
- Google Hotels does not accept the requested room count through the current SerpApi search endpoint. The optional Booking.com Demand API adapter does send room count and child ages; when Booking.com access is unavailable, Google Hotels rates still need room allocation reconfirmed with the seller.
- The provider's hotel-class filter is a hotel category filter, not a guest-review score filter.
- Flexible date selections are stored and disclosed, but live flight/hotel checks currently use the exact dates entered.
- Destination autocomplete and destination matching are based on a maintained internal catalog, not a global live places/autocomplete feed. Unlisted destinations can be typed and searched, but country-to-airport resolution requires a known gateway or a valid three-letter airport code.
- Itinerary schedules are structured suggestions. Attraction opening hours, ticket inventory, transfer times, entry rules and current local conditions are not guaranteed. OpenStreetMap place records may omit websites, hours, coordinates or categories and do not supply authoritative review ratings. Geoapify results are limited to 40 places per category in the initial request and may be incomplete; the UI offers external discovery links when no local results are returned. Coordinate-based Geoapify routes are estimates without live traffic.
- WeatherAPI's Free plan provides a three-day forecast. Tripfinder does not present a day-by-day forecast for dates outside the provider's reliable forecast window. Longer-range forecasts require a plan that supports them; climate averages are not represented as daily forecasts.
- The free SerpApi plan is intended for controlled development/testing here. Before public commercial use, review SerpApi's terms, data-use/display rights and liability coverage, and obtain suitable supplier/API partnerships. Do not assume an API key or search response grants unrestricted resale or public redistribution rights.

## Technology and services

| Component | Purpose | Status |
|---|---|---|
| GitHub | Source code and version history | Active |
| GitHub Actions | Mobile ZIP extraction and commit automation | Active |
| Vercel | Next.js hosting and deployment | Active if repository connected |
| Next.js, React, TypeScript | Application and server routes | Active |
| Framer Motion, Lucide React | Motion and icon library | Active |
| SerpApi | Google Flights, Google Hotels/vacation rentals, and fallback Google Maps/Local places and address-based directions | Requires `SERPAPI_API_KEY` |
| Geoapify | Optional OpenStreetMap-based activity/restaurant discovery and coordinate-based driving estimates | Optional; requires `GEOAPIFY_API_KEY`, Neon usage caps and visible attribution |
| Booking.com Demand API v3.3 | Partner accommodation search, property details and redirect links | Optional; requires approved `BOOKING_COM_API_TOKEN` and `BOOKING_COM_AFFILIATE_ID` |
| Neon PostgreSQL | Provider cache, shared request counters, anonymous saved trips, and collaboration state | Requires `DATABASE_URL` |
| Affiliate networks | Commission attribution and affiliate links | Not connected |
| AI provider | Optional natural-language intent extraction | Not connected; not required for deterministic search validation |
| WeatherAPI | Short-range destination forecasts | Optional `WEATHERAPI_API_KEY`; Free plan has a 3-day forecast |

Neon stores provider cache and usage counters, anonymous saved trips, share-token hashes, and owner-only collaboration data. Tripfinder does not require traveler accounts; synchronized cross-device search history is not currently provided.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without environment variables the site remains in planning-only mode. To test live search locally, copy `.env.example` to `.env.local` and enter the two server-side credentials.

### Run regression tests

The regression suite uses Node's built-in test runner and the project's existing TypeScript compiler; it does not require travel-provider credentials, call external APIs, or consume search credits. Run it with:

```bash
npm run test:regression
```

The suite compiles only the pure planning modules into a temporary `.test-build` directory, runs the fixtures, and removes the temporary output. It covers natural-language parsing, inclusive trip-day calculations, all three round-trip flight request stages, connection-country filtering, airport-local time zones and DST, cost-ledger price/currency handling, traveler/room validation, and Google flight-booking redirect URL validation.

## Deploy to Vercel

1. Push the project to GitHub.
2. Import or connect the repository in Vercel using the Next.js framework preset.
3. Add `SERPAPI_API_KEY` and `DATABASE_URL` under Vercel project environment variables to enable live search.
4. Redeploy after changing environment variables.
5. Open `/api/health` on the production website. This performs a real Neon connectivity check, creates the required cache, usage, telemetry and admin-auth tables if missing, and reports whether the schema is ready. It does not consume a SerpApi flight/hotel search credit.

### One public website address

Vercel automatically generates unique deployment URLs for build records and previews. Tripfinder now redirects alternate deployment/domain hosts to Vercel's stable production domain (`VERCEL_PROJECT_PRODUCTION_URL`). The production branch is `main`; commits from that branch update the same public address. If you later attach a custom domain, Vercel's production-domain variable selects the primary production domain. You can optionally set `SITE_URL` in Vercel to force a specific canonical domain. Preview links intentionally redirect to production so visitors see one public website rather than separate versions.

**Hosting note:** Vercel's current [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines) explicitly state that asking for donations does not fall under commercial usage. That exception applies to voluntary tips; affiliate links, advertising, or other financial-gain uses may be treated as commercial and require an eligible plan. Review the current policy before enabling other monetization. The Streamlabs tip link is external and does not use Neon to process or store payments.

## Product quality rules

- Never invent a flight, hotel, fare, room availability, total price, attraction opening time, provider URL or vacation package.
- Distinguish provider snapshots, cached provider data, curated destination guidance and estimates.
- A price snapshot is not a guaranteed quote; the seller must confirm final price and availability.
- Do not call combined independent bookings an official vacation package.
- Keep credentials server-side only.
- Do not scrape travel sites directly or bypass provider terms. Use documented APIs, permitted widgets and outbound search links.

## Saved trips and anonymous visitor limits

Tripfinder does not require accounts to save or share an itinerary. A new saved trip uses one of **five daily saves per persistent anonymous browser identity**. The browser receives a random 256-bit visitor ID in a one-year HttpOnly cookie; Neon stores only its one-way SHA-256 hash. A separate **25-new-saves-per-IP/network-per-UTC-day** safety guard helps prevent abuse across shared or recreated browser identities. Searches, shared-trip views, temporary "Make my own copy" drafts, and updates to an existing saved trip do not use a new-save slot. The save counter and new saved-trip row are reserved together atomically, so a failed insert does not consume the allowance. Clearing browser cookies or using another browser/device creates a different anonymous identity; the network guard still applies. These are browser/network limits, not verified human-account limits.

