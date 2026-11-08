# Tripfinder product roadmap

## Release 0 — polished preview (current)
- Landing page and responsive design system
- Search brief form with client-side validation
- Example results that are explicitly marked as sample data
- Provider adapter contract and health endpoint

## Release 1 — deterministic planning core
- Airport/city reference data and location resolver
- Structured traveler model (adults, child ages, infants)
- Date flexibility model and trip-length constraints
- Room allocation and occupancy validator
- Hard constraints vs weighted preferences
- Budget model with included/excluded cost line items
- Destination matching and explainable scoring
- Fixture-driven regression suite

## Release 2 — sandbox travel search
- Amadeus test API adapter
- Flight search normalization and offer price recheck
- Hotel search normalization and room/rate normalization
- Data freshness and source provenance
- Provider failure handling, caching and request budget controls

## Release 3 — itinerary and package comparison
- Day-by-day itinerary builder
- Travel-time-aware scheduling
- Separate bookings vs supplier-sold package distinction
- Multi-provider price comparison
- Deep-link parameter validation and redirect safety

## Release 4 — persistence and user experience
- Neon persistence for saved searches and itineraries
- Optional account system
- Shareable trip links
- User corrections and feedback capture
- Admin quality and API usage dashboard

## Release 5 — live providers and monetization
- Approved live supplier APIs
- Price/availability revalidation
- Affiliate-link attribution and disclosures
- Provider fallback and link-health monitoring
- Monetization reporting
