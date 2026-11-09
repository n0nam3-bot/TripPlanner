# Tripfinder — travel planning and comparison platform

Tripfinder is a travel-planning and provider-comparison application. It helps travelers define trip requirements, discover destinations from a curated catalog, create a first-pass itinerary, and request current flight and hotel search results from a server-side provider adapter. It does not sell tickets, make reservations, process payments, or guarantee supplier prices.

## Mobile ZIP updates with GitHub Actions

The repository includes `.github/workflows/import-project-zip.yml`. After the one-time workflow setup, upload future project ZIP files directly into the **repository root** from your phone and commit them. GitHub Actions safely unpacks the archive into the repository's normal folder structure, overwrites matching files, adds new files, removes the ZIP from the current working tree, and commits the extracted update. If the repository is connected to Vercel, that extracted commit should trigger a deployment.

The importer is overlay-only: matching files are replaced and new files are added, but files absent from a ZIP are not deleted. It protects `.github/`, build folders, real `.env` files and private-key files. The ZIP remains in Git history after its removal from the current file tree. See [`docs/MOBILE-ZIP-UPDATES.md`](docs/MOBILE-ZIP-UPDATES.md).

## Current functional scope

- Responsive editorial-style homepage and structured trip-search form.
- Server-side validation for date ranges, traveler counts, child ages, rooms, budget, cabin class, stop preference, hotel class and currency.
- Destination matching against a curated destination catalog, with explainable preference scoring.
- Date-specific itinerary outline generation. It is planning guidance, not verified attraction inventory or opening hours.
- Live Google Flights and Google Hotels search through a server-side SerpApi adapter, once both provider and database credentials are configured.
- Round-trip flight selection is staged correctly: outbound options first, then return options for the chosen outbound, then seller/booking options when supplied by the provider.
- Hotel offers are withheld for multi-room requests because the current provider integration cannot verify the requested room count.
- Google Hotels receives children's ages. Google Flights currently receives the child count but not individual child ages, so age-specific fares need seller confirmation.
- Provider responses are cached in Neon. Before each uncached search, Tripfinder checks the SerpApi Account API (which does not consume search credits) and enforces shared monthly, hourly and per-connection request limits.
- General outbound Google Flights, Google Hotels and Viator search links work without affiliate accounts.
- `/api/health` reports whether provider and database environment variables are present. This is a configuration check only; the first live query verifies provider credentials and database connectivity.

## Live search setup (required to search current flight/hotel data)

The site can still run in planning-only mode without credentials. To enable provider search, create these two accounts/values:

1. **SerpApi API key** — register at [SerpApi](https://serpapi.com/) and copy the private API key from the dashboard. The current free plan advertises 250 searches per month. Review current plan details and provider terms before enabling search on a public or commercial site.
2. **Neon PostgreSQL** — create a database at [Neon](https://neon.tech/) and copy its pooled connection string. The application creates its provider-cache and usage-control tables automatically on its first live search.

In Vercel, open **TripPlanner → Settings → Environment Variables** and add:

| Name | Value | Environments |
|---|---|---|
| `SERPAPI_API_KEY` | Your private SerpApi key | Preview and Production |
| `DATABASE_URL` | Neon pooled PostgreSQL connection string | Preview and Production |
| `SERPAPI_MONTHLY_SEARCH_CAP` | `200` | Preview and Production (optional; default is 200) |
| `SERPAPI_HOURLY_SEARCH_CAP` | `30` | Preview and Production (optional; default is 30) |
| `SERPAPI_PROVIDER_QUOTA_RESERVE` | `75` | Preview and Production (optional; default is 75) |
| `SERPAPI_PROVIDER_HOURLY_RESERVE` | `10` | Preview and Production (optional; default is 10) |

Save the variables and redeploy the latest deployment. Do not use `NEXT_PUBLIC_` prefixes, and never put credentials in GitHub, ZIP files, browser code, or screenshots. Keep the key in Vercel's server-side environment settings only.

### Request budget and caching

- Exact matching flight, return-flight and seller-option queries are cached in Neon for one hour; hotel queries are cached for one hour. This aligns with the provider's documented one-hour response cache and reduces repeat requests.
- Tripfinder checks the real SerpApi account balance before any uncached provider search. The Account API does not use a search credit; its normalized monthly and hourly quota response is cached for 60 seconds.
- Repeated exact queries served from Tripfinder's cache do not call SerpApi again.
- The app's default global limit is **200 uncached provider requests per UTC calendar month**, leaving a reserve against SerpApi's currently advertised 250-search free quota. The configured limit is hard-clamped to 230. SerpApi's account check also protects the provider's own billing-cycle balance, including searches made elsewhere with the same key.
- The default shared hourly cap is **30 uncached provider requests per UTC hour**, below the currently advertised Free-plan 50-per-hour throughput. It is hard-clamped to 45. The account-level hourly check also considers calls made with the same SerpApi key outside Tripfinder. The per-connection caps remain 15 per hour and 45 per day.
- New uncached searches pause when the SerpApi Account API reports **75 or fewer monthly searches remaining** or **10 or fewer account-level hourly requests remaining** by default. Both reserves are configurable and hard-clamped. If the account quota cannot be checked, Tripfinder fails closed rather than risk spending beyond the balance.
- A normal one-destination check can use up to two provider searches (one flight query and one hotel query). Selecting an outbound flight for return options can use one more; opening seller options can use another. SerpApi documents the selection-token stages and states that retrieving seller options does not reserve a ticket.
- The app reserves a counter slot before each external call. Failed calls count in Tripfinder's own usage counter conservatively, even if the provider does not count them. This avoids spending beyond the intended safety ceiling.
- The cap is shared across all visitors and deployments that use the same Neon database. It is not per user.
- Uncached requests are also limited by a hashed requester address to 15 per hour and 45 per day. Cached hits do not consume this provider-request allowance.

### Current provider limitations

- SerpApi's Google Flights integration is a search-data source, not an airline reservation system. Round trips require choosing an outbound flight and then requesting return options with the provider token. Seller options may be available after that selection. A booking link is not a reservation.
- Flight search currently resolves airports from the built-in city/airport map or a three-letter IATA code. It does not yet have a live airport-autocomplete service.
- Google Flights receives child count but not each child's age; sellers must confirm age-specific fares.
- The current Google Hotels query supports a single-room search only. Multi-room hotel results are withheld rather than presented as verified for a group.
- The provider's hotel-class filter is a hotel category filter, not a guest-review score filter.
- Flexible date selections are stored and disclosed, but live flight/hotel checks currently use the exact dates entered.
- The destination matcher uses a curated internal catalog. It does not yet discover any destination worldwide from live airfare, weather or local events.
- Itinerary schedules are structured suggestions. Attraction opening hours, ticket inventory, transfer times, entry rules and current local conditions are not yet verified by live data services.
- The free SerpApi plan is intended for controlled development/testing here. Before public commercial use, review SerpApi's terms, data-use/display rights and liability coverage, and obtain suitable supplier/API partnerships. Do not assume an API key or search response grants unrestricted resale or public redistribution rights.

## Technology and services

| Component | Purpose | Status |
|---|---|---|
| GitHub | Source code and version history | Active |
| GitHub Actions | Mobile ZIP extraction and commit automation | Active |
| Vercel | Next.js hosting and deployment | Active if repository connected |
| Next.js, React, TypeScript | Application and server routes | Active |
| Framer Motion, Lucide React | Motion and icon library | Active |
| SerpApi | Google Flights/Hotels search data | Requires `SERPAPI_API_KEY` |
| Neon PostgreSQL | Persistent provider cache and shared request counter | Requires `DATABASE_URL` |
| Affiliate networks | Commission attribution and affiliate links | Not connected |
| AI provider | Optional natural-language intent extraction | Not connected; not required for deterministic search validation |
| Activities/POI provider | Verified attractions and local points of interest | Not connected |

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
5. Open `/api/health` to check which configuration variables are present.

**Commercial hosting note:** Vercel Hobby is restricted to personal, non-commercial use. Before earning affiliate revenue or otherwise operating the site commercially, review current Vercel terms and move to an eligible plan or another host. See [Vercel plans](https://vercel.com/docs/plans/hobby).

## Product quality rules

- Never invent a flight, hotel, fare, room availability, total price, attraction opening time, provider URL or vacation package.
- Distinguish provider snapshots, cached provider data, curated destination guidance and estimates.
- A price snapshot is not a guaranteed quote; the seller must confirm final price and availability.
- Do not call combined independent bookings an official vacation package.
- Keep credentials server-side only.
- Do not scrape travel sites directly or bypass provider terms. Use documented APIs, permitted widgets and outbound search links.
