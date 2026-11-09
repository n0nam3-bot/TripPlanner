import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check, MapPin, Plane, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ResultsWorkspace } from "@/components/trips/results-workspace";
import { buildTripRecommendations, tripLength } from "@/lib/trip-planner/engine";
import { styleLabel } from "@/lib/trip-planner/destinations";
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
          <h1>Let’s get the details <em>right.</em></h1>
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

  return (
    <main className="results-page">
      <SiteHeader />
      <section className="results-hero shell">
        <Link href="/#plan" className="back-link"><ArrowLeft size={15} /> Edit your search</Link>
        <div className="results-title-row">
          <div><span className="eyebrow">YOUR SEARCH, THOUGHTFULLY CONSIDERED</span><h1>Let’s see where<br /><em>you could go.</em></h1></div>
          <div className="results-search-note"><Sparkles size={16} /><span>We’ve matched your dates, budget and travel preferences against our destination planning catalog.</span></div>
        </div>
        <div className="search-summary">
          <div><Plane size={16}/><span><small>FROM</small><strong>{search.origin}</strong></span></div>
          <div><MapPin size={16}/><span><small>TO</small><strong>{search.destination}</strong></span></div>
          <div><CalendarDays size={16}/><span><small>DATES</small><strong>{dateLabel}</strong></span></div>
          <div><Users size={16}/><span><small>TRAVELERS</small><strong>{travelerLabel}</strong></span></div>
          <div><Wallet size={16}/><span><small>BUDGET</small><strong>{budgetLabel}</strong></span></div>
        </div>
        <div className="results-filter-line">
          <span><Check size={14}/> {styleLabel(search.style)}</span>
          <span><Check size={14}/> {search.flexibleDays ? `±${search.flexibleDays} date flexibility` : "Exact dates"}</span>
          <span><ShieldCheck size={14}/> {search.rooms} room{search.rooms === 1 ? "" : "s"} · {search.cabinClass.replaceAll("_", " ")}</span>
        </div>
      </section>
      <section className="results-content shell">
        <div className="results-section-heading">
          <div><span className="eyebrow">PERSONALIZED DESTINATION MATCHES</span><h2>{search.destination.toLowerCase() === "anywhere" ? "Places that could fit your trip" : `Planning your trip to ${search.destination}`}</h2><p>{recommendations.length} {recommendations.length === 1 ? "destination match" : "destination matches"} · {tripLength(search)} nights · {travelers} traveler{travelers === 1 ? "" : "s"}</p></div>
        </div>
        <div className="results-truth-note"><span className="results-truth-icon"><ShieldCheck size={17}/></span><div><strong>What is live and what is planning guidance?</strong><p>Destination matches and day-by-day outlines are generated from our curated planning catalog. Current flights and hotel rates are fetched only when you ask us to check them and the live provider is configured. Search results are price snapshots, not guaranteed reservations.</p></div></div>
        <ResultsWorkspace
          search={search}
          recommendations={recommendations}
          liveSearchConfigured={Boolean(process.env.SERPAPI_API_KEY && process.env.DATABASE_URL)}
          providerKeyConfigured={Boolean(process.env.SERPAPI_API_KEY)}
          databaseConfigured={Boolean(process.env.DATABASE_URL)}
        />
      </section>
      <footer className="site-footer shell results-footer">
        <div className="footer-top"><div><span className="brand-name footer-brand">tripfinder<span className="brand-period">.</span></span><p>Make room for somewhere new.</p></div><Link href="/#plan" className="text-link dark-link">Start another search <ArrowRight size={16}/></Link></div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Tripfinder</span><span>Independent planning tool · Bookings completed with travel providers</span></div>
      </footer>
    </main>
  );
}
