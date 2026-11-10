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
- Activity results use Google Maps search with a Google Local fallback. Each place links to Maps and, where available, its official website; Viator and GetYourGuide search links are also provided.
- Hotel/activity proximity uses coordinates and clearly labels straight-line distances. Driving directions are looked up only when the user requests them and consume an additional provider request.
- General outbound Google Flights, Google Hotels, Google Maps, Viator and GetYourGuide search links work without affiliate accounts.
- `/api/health` reports whether provider and database environment variables are present. This is a configuration check only; the first live query verifies provider credentials and database connectivity.

## Live search setup (required to search current flight/hotel data)

The site can still run in planning-only mode without credentials. To enable provider search, create these two accounts/values:

1. **SerpApi API key** — register at [SerpApi](https://serpapi.com/) and copy the private API key from the dashboard. The current free plan advertises 250 searches per month. Review current plan details and provider terms before enabling search on a public or commercial site.
2. **Neon PostgreSQL** — create a database at [Neon](https://neon.tech/) and copy its pooled connection string. Once `DATABASE_URL` is configured and deployed, opening `/api/health` automatically creates and verifies the provider-cache, usage-control, admin-auth and telemetry tables. No SQL editor step is required. An auditable, repeatable manual schema is also included at `db/schema.sql`.

In Vercel, open **TripPlanner → Settings → Environment Variables** and add:

| Name | Value | Environments |
|---|---|---|
| `SERPAPI_API_KEY` | Your private SerpApi key | Preview and Production |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string | Preview and Production |
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
- A destination check uses one provider request for each selected provider category: one flight query, one query per selected stay type, and one activity query. If the first activity query returns no usable places, a separately cached Google Local fallback may use one additional request. Selecting an outbound flight for return options, opening airline seller options, retrieving hotel rate options, and requesting driving directions each use additional provider requests.
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
- Itinerary schedules are structured suggestions. Attraction opening hours, ticket inventory, transfer times, entry rules and current local conditions are not guaranteed. Google Maps/Local place results may be incomplete for some destination/category combinations; the UI offers external discovery links when no local results are returned.
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
| SerpApi | Google Flights, Google Hotels/vacation rentals, Google Maps/Local places and directions | Requires `SERPAPI_API_KEY` |
| Booking.com Demand API v3.3 | Partner accommodation search, property details and redirect links | Optional; requires approved `BOOKING_COM_API_TOKEN` and `BOOKING_COM_AFFILIATE_ID` |
| Neon PostgreSQL | Persistent provider cache and shared request counter | Requires `DATABASE_URL` |
| Affiliate networks | Commission attribution and affiliate links | Not connected |
| AI provider | Optional natural-language intent extraction | Not connected; not required for deterministic search validation |
| WeatherAPI | Short-range destination forecasts | Optional `WEATHERAPI_API_KEY`; Free plan has a 3-day forecast |

Neon currently stores provider cache and monthly usage counters. It does **not** yet store traveler accounts, saved trips, or synchronized search history. Those are separate later features.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without environment variables the site remains in planning-only mode. To test live search locally, copy `.env.example` to `.env.local` and enter the two server-side credentials.

## Deploy to Vercel

1. Push the project to GitHub.
2. Import or connect the repository in Vercel using the Next.js framework preset.
3. Add `SERPAPI_API_KEY` and `DATABASE_URL` under Vercel project environment variables to enable live search.
4. Redeploy after changing environment variables.
5. Open `/api/health` on the production website. This performs a real Neon connectivity check, creates the required cache, usage, telemetry and admin-auth tables if missing, and reports whether the schema is ready. It does not consume a SerpApi flight/hotel search credit.

### One public website address

Vercel automatically generates unique deployment URLs for build records and previews. Tripfinder now redirects alternate deployment/domain hosts to Vercel's stable production domain (`VERCEL_PROJECT_PRODUCTION_URL`). The production branch is `main`; commits from that branch update the same public address. If you later attach a custom domain, Vercel's production-domain variable selects the primary production domain. You can optionally set `SITE_URL` in Vercel to force a specific canonical domain. Preview links intentionally redirect to production so visitors see one public website rather than separate versions.

**Commercial hosting note:** Vercel Hobby is restricted to personal, non-commercial use. Before earning affiliate revenue or otherwise operating the site commercially, review current Vercel terms and move to an eligible plan or another host. See [Vercel plans](https://vercel.com/docs/plans/hobby).

## Product quality rules

- Never invent a flight, hotel, fare, room availability, total price, attraction opening time, provider URL or vacation package.
- Distinguish provider snapshots, cached provider data, curated destination guidance and estimates.
- A price snapshot is not a guaranteed quote; the seller must confirm final price and availability.
- Do not call combined independent bookings an official vacation package.
- Keep credentials server-side only.
- Do not scrape travel sites directly or bypass provider terms. Use documented APIs, permitted widgets and outbound search links.
