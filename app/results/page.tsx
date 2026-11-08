import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, MapPin, Plane, ShieldCheck, SlidersHorizontal, Sparkles, Users, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ResultTripCard } from "@/components/result-trip-card";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function get(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" && value.length ? value : fallback;
}

export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const origin = get(params.origin, "New York (NYC)");
  const destination = get(params.destination, "Anywhere");
  const depart = get(params.depart, "Flexible dates");
  const returnDate = get(params.return, "Not selected");
  const travelers = get(params.travelers, "2 adults");
  const budget = Number(get(params.budget, "2500"));
  const style = get(params.style, "A little bit of everything");
  const flexible = get(params.flexible, "true") === "true";
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(budget) ? budget : 2500);

  return (
    <main className="results-page">
      <SiteHeader />
      <section className="results-hero shell">
        <Link href="/#plan" className="back-link"><ArrowLeft size={15} /> Edit your search</Link>
        <div className="results-title-row">
          <div><span className="eyebrow">YOUR SEARCH, THOUGHTFULLY CONSIDERED</span><h1>Let’s see where<br /><em>you could go.</em></h1></div>
          <div className="results-search-note"><Sparkles size={16} /><span>We’ve shaped a few starting points around your brief.</span></div>
        </div>
        <div className="search-summary">
          <div><Plane size={16}/><span><small>FROM</small><strong>{origin}</strong></span></div>
          <div><MapPin size={16}/><span><small>TO</small><strong>{destination}</strong></span></div>
          <div><CalendarDays size={16}/><span><small>DATES</small><strong>{depart} – {returnDate}</strong></span></div>
          <div><Users size={16}/><span><small>TRAVELERS</small><strong>{travelers}</strong></span></div>
          <div><Wallet size={16}/><span><small>MAX BUDGET</small><strong>{money}</strong></span></div>
        </div>
        <div className="results-filter-line"><span><Check size={14}/> {style}</span><span><Check size={14}/> {flexible ? "Flexible dates" : "Fixed dates"}</span><span><ShieldCheck size={14}/> Planning preview</span></div>
      </section>

      <section className="results-content shell">
        <div className="results-section-heading"><div><span className="eyebrow">A FIRST LOOK</span><h2>Trip ideas to get you started</h2><p>These are curated demo itineraries so you can test the planning experience.</p></div><button className="filter-button" disabled><SlidersHorizontal size={16}/> Filters coming next</button></div>
        <div className="demo-alert"><span className="demo-dot"/><div><strong>Preview mode — no live fares or room inventory are connected yet.</strong><p>All prices and availability below are illustrative sample data. They are not quotes and cannot be booked.</p></div></div>
        <div className="trip-results-grid">
          <ResultTripCard
            number="01"
            badge="A little of everything"
            name="Lisbon, Portugal"
            subtitle="Colourful streets, coastal day trips & long lunches"
            image="https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1400&q=88"
            estimate="$1,780"
            perPerson="$890"
            nights="5 nights"
            flight="Example flight allowance: $640"
            stay="Example stay allowance: $720"
            extras="Local transport & experiences: $420"
            highlights={["Food and neighbourhoods", "Easy day trip to the coast", "Walkable city centre"]}
          />
          <ResultTripCard
            number="02"
            badge="Sunshine & slow days"
            name="Tenerife, Canary Islands"
            subtitle="Volcanic landscapes, ocean air & unhurried afternoons"
            image="https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1400&q=88"
            estimate="$2,120"
            perPerson="$1,060"
            nights="5 nights"
            flight="Example flight allowance: $860"
            stay="Example stay allowance: $820"
            extras="Local transport & experiences: $440"
            highlights={["Beach and nature mix", "Scenic coastal drives", "Warm-weather escape"]}
          />
          <ResultTripCard
            number="03"
            badge="Culture & discovery"
            name="Mexico City, Mexico"
            subtitle="Design, history, brilliant food & neighbourhood life"
            image="https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?auto=format&fit=crop&w=1400&q=88"
            estimate="$1,640"
            perPerson="$820"
            nights="5 nights"
            flight="Example flight allowance: $720"
            stay="Example stay allowance: $560"
            extras="Local transport & experiences: $360"
            highlights={["Exceptional food scene", "Museums and architecture", "Neighbourhood exploration"]}
          />
        </div>
        <div className="results-next-step"><div><span className="eyebrow">THE NEXT ITERATION</span><h3>From trip ideas to verified options.</h3><p>The next build connects live flight and accommodation search, validates each result, and replaces these sample estimates with timestamped provider data.</p></div><div className="next-step-icon"><Clock3 size={27}/></div></div>
      </section>
      <footer className="site-footer shell results-footer"><div className="footer-top"><div><span className="brand-name footer-brand">tripfinder<span className="brand-period">.</span></span><p>Make room for somewhere new.</p></div><Link href="/#plan" className="text-link dark-link">Start another search <ArrowRight size={16}/></Link></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Tripfinder</span><span>Sample planning data only · No booking transactions</span></div></footer>
    </main>
  );
}
