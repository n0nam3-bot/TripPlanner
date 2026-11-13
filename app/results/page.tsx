import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ResultsWorkspace } from "@/components/trips/results-workspace";
import { SupportTipLink } from "@/components/support-tip-link";
import { buildTripRecommendations, tripLength } from "@/lib/trip-planner/engine";
import { formatTripDestinationLabel } from "@/lib/trip-planner/destinations";
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

  const requested = search.components.map((item) => item === "flights" ? "Flights" : item === "stays" ? (search.stayTypes.length > 1 ? "Hotels and rentals" : search.stayTypes[0] === "vacation_rentals" ? "Rentals" : "Hotels") : "Activities");
  const destinationLabel = formatTripDestinationLabel(search.destination, search.destinationArea);
  const heading = search.destination.toLowerCase() === "anywhere" ? "Destinations worth comparing" : `Travel options for ${destinationLabel}`;

  return (
    <main className="results-page">
      <SiteHeader />
      <section className="results-hero shell">
        <Link href="/#plan" className="back-link"><ArrowLeft size={15} /> Edit search</Link>
        <div className="results-title-row">
          <div><span className="eyebrow">TRIP SEARCH</span><h1>{heading}</h1><p className="results-intro">Flights, places to stay and activities based on the dates, travelers and filters you chose.</p></div>
        </div>
        <div className="results-filter-line">
          <span>{requested.join(" + ")}</span>
          {search.destinationArea && <span>Area: {search.destinationArea}</span>}
          {search.components.includes("stays") && <span>{search.rooms} room{search.rooms === 1 ? "" : "s"}</span>}
          {search.components.includes("stays") && search.staySpaceType !== "any" && <span>{search.staySpaceType === "entire_place" ? "Entire place" : search.staySpaceType === "private_room" ? "Private room" : "Shared room"}</span>}
          {search.components.includes("stays") && search.stayMustHaveAmenities.length > 0 && <span>Must have: {search.stayMustHaveAmenities.map((item) => item.replaceAll("_", " ")).join(", ")}</span>}
          {search.components.includes("stays") && search.stayPreferredAmenities.length > 0 && <span>Prefer: {search.stayPreferredAmenities.map((item) => item.replaceAll("_", " ")).join(", ")}</span>}
          {search.components.includes("flights") && <span>{search.cabinClass.replaceAll("_", " ")}</span>}
          {search.components.includes("flights") && search.preferredLayoverCountries.length > 0 && <span>Prefer connections: {search.preferredLayoverCountries.join(", ")}</span>}
          {search.components.includes("flights") && search.avoidLayoverCountries.length > 0 && <span>Avoid connections: {search.avoidLayoverCountries.join(", ")}</span>}
          {search.planningNotes.map((note, index) => <span className="results-filter-note" key={`planning-note-${index}`}>Planning note: {note}</span>)}
        </div>
      </section>
      <section className="results-content shell results-content-with-rail">
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
