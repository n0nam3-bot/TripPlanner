import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { TripSearch } from "@/components/trip-search";
import { InspirationShowcase } from "@/components/inspiration-showcase";
import { Reveal } from "@/components/motion";

// Inspiration links use rolling departure dates; render them per request, not at build time.
export const dynamic = "force-dynamic";

const places = [
  { name: "Amalfi Coast", country: "Italy", note: "Coastal villages and slow afternoons", image: "https://images.unsplash.com/photo-1533587851505-d119e13fa0d7?auto=format&fit=crop&w=1100&q=85", airportCode: "NAP", style: "romantic", budget: "3200", tag: "Coast" },
  { name: "Kyoto", country: "Japan", note: "Temples, gardens and old streets", image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=900&q=82", airportCode: "KIX", style: "culture", budget: "3600", tag: "Culture" },
  { name: "Tulum", country: "Mexico", note: "Caribbean water and Mayan history", image: "https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?auto=format&fit=crop&w=900&q=82", airportCode: "TQO", style: "beach", budget: "2800", tag: "Beach" },
  { name: "Lisbon", country: "Portugal", note: "Food, viewpoints and coastal day trips", image: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&q=82", airportCode: "LIS", style: "food", budget: "2700", tag: "City" },
];

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function inspirationSearchUrl(place: (typeof places)[number]) {
  const params = new URLSearchParams({
    origin: "New York (NYC)", originAirportCode: "NYC",
    destination: place.name, destinationAirportCode: place.airportCode,
    depart: dateAfter(45), return: dateAfter(50), adults: "2", childrenAges: "", rooms: "1",
    budget: place.budget, budgetMode: "total", currency: "USD", style: place.style,
    flexibleDays: "0", cabin: "economy", stops: "any", hotelRating: "0", freeCancellation: "false",
    components: "flights,stays,activities", stayTypes: "hotels,vacation_rentals",
  });
  return `/results?${params.toString()}`;
}

const inspirationPlaces = places.map((place) => ({ ...place, href: inspirationSearchUrl(place) }));

export default function Home() {
  return (
    <main>
      <SiteHeader />

      <section className="landing-hero shell" aria-label="Plan a trip with Tripfinder">
        <Reveal className="landing-copy">
          <span className="eyebrow">A MORE THOUGHTFUL WAY TO GET AWAY</span>
          <h1>Go somewhere<br /><em>that feels like you.</em></h1>
          <p>The best trips are put together around the way you want to feel, explore and spend. Start with a few details; we’ll help bring the pieces together.</p>
          <div className="landing-actions">
            <Link href="#plan" className="button button-dark">Plan your getaway <ArrowUpRight size={17} /></Link>
          </div>
          <p className="landing-note">Thoughtful plans. Your pace. Not another one-size-fits-all search.</p>
        </Reveal>

        <Reveal className="landing-inspiration" delay={0.08}>
          <div className="landing-inspiration-heading" id="discover">
            <span className="eyebrow">A WORLD OF POSSIBILITIES</span>
            <h2>Somewhere is calling.<br /><em>Let’s find out where.</em></h2>
          </div>
          <InspirationShowcase places={inspirationPlaces} />
          <p className="inspiration-disclaimer">A little inspiration to get started. These are curated starting points, not live travel offers.</p>
        </Reveal>
      </section>

      {/* The main trip-search experience is intentionally unchanged. */}
      <section className="planner-section shell">
        <Reveal><TripSearch /></Reveal>
      </section>

      <footer className="site-footer shell landing-footer">
        <div className="footer-top">
          <div><span className="brand-name footer-brand">tripfinder<span className="brand-period">.</span></span><p>Make room for somewhere new.</p></div>
          <div className="footer-links"><Link href="#discover">Discover</Link><Link href="#plan">Plan a trip</Link></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Tripfinder</span><span>Bookings are completed with travel providers.</span></div>
      </footer>
    </main>
  );
}
