import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Plane, Users, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ResultsWorkspace } from "@/components/trips/results-workspace";
import { SupportTipLink } from "@/components/support-tip-link";
import { buildTripRecommendations, tripLength } from "@/lib/trip-planner/engine";
import { parseTripSearch } from "@/lib/trip-planner/validation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toSearchParams(values: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  return params;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = toSearchParams(await searchParams);
  const parsed = parseTripSearch(params);

  if (!parsed.input) {
    return (
      <main className="results-page">
        <SiteHeader />
        <section className="results-content shell validation-error-page">
          <Link href="/#plan" className="back-link"><ArrowLeft size={15} /> Back to trip planner</Link>
          <span className="eyebrow">WE NEED A LITTLE MORE INFORMATION</span>
          <h1>Check your trip details</h1>
          <p>Some trip details were missing or invalid, so we haven't searched or generated recommendations.</p>
          <ul>{parsed.errors.map((error) => <li key={error}>{error}</li>)}</ul>
          <Link href="/#plan" className="button button-dark">Update my search <ArrowRight size={16}/></Link>
        </section>
      </main>
    );
  }

  const search = parsed.input;
  const recommendations = buildTripRecommendations(search);
  const travelers = search.adults + search.childrenAges.length;
  const travelerLabel = `${search.adults} adult${search.adults === 1 ? "" : "s"}${search.childrenAges.length ? ` · ${search.childrenAges.length} child${search.childrenAges.length === 1 ? "" : "ren"}` : ""}`;
  const budgetLabel = `${formatMoney(search.budget, search.currency)} ${search.budgetMode === "total" ? "total" : "per traveler"}`;
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const dateLabel = `${dateFormat.format(new Date(`${search.departureDate}T12:00:00Z`))} – ${dateFormat.format(new Date(`${search.returnDate}T12:00:00Z`))}`;

  const requested = search.components.map((item) => item === "flights" ? "Flights" : item === "stays" ? (search.stayTypes.length > 1 ? "Hotels and rentals" : search.stayTypes[0] === "vacation_rentals" ? "Rentals" : "Hotels") : "Activities");
  const heading = search.destination.toLowerCase() === "anywhere" ? "Destinations worth comparing" : `Travel options for ${search.destination}`;

  return (
    <main className="results-page">
      <SiteHeader />
      <section className="results-hero shell">
        <Link href="/#plan" className="back-link"><ArrowLeft size={15} /> Edit search</Link>
        <div className="results-title-row">
          <div><span className="eyebrow">TRIP SEARCH</span><h1>{heading}</h1><p className="results-intro">Flights, places to stay and activities based on the dates, travelers and filters you chose.</p></div>
        </div>
        <div className="search-summary">
          {search.components.includes("flights") && <div><Plane size={16}/><span><small>FROM</small><strong>{search.origin}</strong></span></div>}
          <div><MapPin size={16}/><span><small>DESTINATION</small><strong>{search.destination}</strong></span></div>
          <div><CalendarDays size={16}/><span><small>DATES</small><strong>{dateLabel}</strong></span></div>
          <div><Users size={16}/><span><small>TRAVELERS</small><strong>{travelerLabel}</strong></span></div>
          <div><Wallet size={16}/><span><small>BUDGET</small><strong>{budgetLabel}</strong></span></div>
        </div>
        <div className="results-filter-line">
          <span>{requested.join(" + ")}</span>
          {search.components.includes("stays") && <span>{search.rooms} room{search.rooms === 1 ? "" : "s"}</span>}
          {search.components.includes("stays") && search.staySpaceType !== "any" && <span>{search.staySpaceType === "entire_place" ? "Entire place" : search.staySpaceType === "private_room" ? "Private room" : "Shared room"}</span>}
          {search.components.includes("stays") && search.stayMustHaveAmenities.length > 0 && <span>Must have: {search.stayMustHaveAmenities.map((item) => item.replaceAll("_", " ")).join(", ")}</span>}
          {search.components.includes("stays") && search.stayPreferredAmenities.length > 0 && <span>Prefer: {search.stayPreferredAmenities.map((item) => item.replaceAll("_", " ")).join(", ")}</span>}
          {search.components.includes("flights") && <span>{search.cabinClass.replaceAll("_", " ")}</span>}
        </div>
      </section>
      <section className="results-content shell">
        <div className="results-section-heading">
          <div><h2>{recommendations.length === 1 ? "Your search" : "Destination ideas"}</h2><p>{recommendations.length} {recommendations.length === 1 ? "destination" : "destinations"} · {tripLength(search)} nights · {travelers} traveler{travelers === 1 ? "" : "s"}</p></div>
        </div>
        <p className="results-truth-note">Flight, stay and activity results are retrieved only for the categories you select. Your schedule shows only the flights, stays, activities and restaurants you explicitly select. Prices and availability can change before checkout.</p>
        <ResultsWorkspace
          search={search}
          recommendations={recommendations}
          liveSearchConfigured={Boolean(process.env.SERPAPI_API_KEY && process.env.DATABASE_URL)}
          providerKeyConfigured={Boolean(process.env.SERPAPI_API_KEY)}
          databaseConfigured={Boolean(process.env.DATABASE_URL)}
          weatherKeyConfigured={Boolean(process.env.WEATHERAPI_API_KEY)}
          aiProviderConfigured={Boolean(process.env.OPENROUTER_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim())}
          geminiProviderConfigured={Boolean(process.env.GEMINI_API_KEY?.trim())}
          openRouterProviderConfigured={Boolean(process.env.OPENROUTER_API_KEY?.trim())}
        />
      </section>
      <footer className="site-footer shell results-footer">
        <div className="footer-top">
          <div><span className="brand-name footer-brand">tripfinder<span className="brand-period">.</span></span><p>Plan the whole trip in one place.</p></div>
          <div className="footer-side">
            <SupportTipLink />
            <Link href="/#plan" className="text-link dark-link">New search <ArrowRight size={16}/></Link>
          </div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Tripfinder</span><span>Independent planning tool · Bookings completed with providers</span></div>
      </footer>
    </main>
  );
}
