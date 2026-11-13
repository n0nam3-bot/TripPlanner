import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SupportTipLink } from "@/components/support-tip-link";
import { getSavedTripByShareToken } from "@/lib/db/saved-trips";
import { formatTripDestinationLabel } from "@/lib/trip-planner/destinations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const saved = await getSavedTripByShareToken(token);
  return {
    title: saved ? `${saved.snapshot.title} · Tripfinder` : "Saved trip · Tripfinder",
    description: "A shared Tripfinder planning snapshot.",
    robots: { index: false, follow: false },
  };
}

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function money(value: number, currency: string): string {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}

const kindLabels: Record<string, string> = {
  "outbound-flight": "Outbound flight",
  "return-flight": "Return flight",
  "flight-fare": "Selected flight fare",
  stay: "Place to stay",
  activity: "Activity & attraction",
  restaurant: "Restaurant & dining",
};

export default async function SharedTripPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const saved = await getSavedTripByShareToken(token);
  if (!saved) return notFound();

  const search = saved.search;
  const destination = formatTripDestinationLabel(search.destination, search.destinationArea);
  const travelers = search.adults + search.childrenAges.length;
  const openSearch = `/results?${saved.searchQuery}`;

  return <main className="saved-trip-page">
    <SiteHeader />
    <section className="saved-trip-shell shell">
      <Link href={openSearch} className="back-link"><ArrowLeft size={15}/> Open this search in Tripfinder</Link>
      <header className="saved-trip-header">
        <span className="eyebrow">SHARED TRIP PLAN</span>
        <h1>{saved.snapshot.title}</h1>
        <p className="saved-trip-intro">A saved planning snapshot. It is not a booking, reservation or live availability guarantee.</p>
      </header>
      <section className="saved-trip-overview" aria-label="Trip overview">
        <div><span>FROM</span><strong>{search.originAirportCode || search.origin}</strong></div>
        <div><span>DESTINATION</span><strong>{destination}</strong></div>
        <div><CalendarDays size={15}/><strong>{dateLabel(search.departureDate)} – {dateLabel(search.returnDate)}</strong></div>
        <div><Users size={15}/><strong>{travelers} traveler{travelers === 1 ? "" : "s"}</strong></div>
        <div><span>BUDGET</span><strong>{money(search.budget, search.currency)} {search.budgetMode === "per_person" ? "per person" : "total"}</strong></div>
      </section>
      <div className="saved-trip-notice"><MapPin size={15}/><p>Anyone with this private link can view this trip. Share it only with people you trust. Booking tokens, account credentials and private API data are not included.</p></div>
      <section className="saved-trip-content">
        <div className="saved-trip-content-heading"><div><span className="eyebrow">YOUR PLAN</span><h2>Selected trip details</h2></div><span>Saved {new Date(saved.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span></div>
        {saved.snapshot.destinations.map((group, index) => <section className="saved-trip-destination" key={`${group.label}-${index}`}>
          <h3>{group.label}</h3>
          {!group.items.length ? <p className="saved-trip-empty">No flights, stays, activities or restaurants have been selected yet. This link preserves the original search criteria.</p> : <div className="saved-trip-items">
            {group.items.map((item, itemIndex) => <article className="saved-trip-item" key={`${item.kind}-${item.title}-${itemIndex}`}>
              <div className="saved-trip-item-heading"><span>{kindLabels[item.kind] || "Trip item"}</span>{item.date && <time dateTime={item.date}>{dateLabel(item.date)}{item.time ? ` · ${item.time}` : ""}</time>}</div>
              <h4>{item.title}</h4>
              {item.subtitle && <p>{item.subtitle}</p>}
              {item.details.length > 0 && <ul>{item.details.map((detail, detailIndex) => <li key={detailIndex}>{detail}</li>)}</ul>}
              {item.price !== undefined && item.price !== null && <div className="saved-trip-item-price"><strong>{money(item.price, item.currency || search.currency)}</strong>{item.priceLabel && <span>{item.priceLabel}</span>}</div>}
            </article>)}
          </div>}
        </section>)}
      </section>
      <div className="saved-trip-actions"><Link href={openSearch} className="button button-dark">Reopen search <ArrowRight size={16}/></Link><span>Reopening the search checks the current provider cache and may refresh travel results.</span></div>
      <p className="saved-trip-expiry">This share link expires {dateLabel(saved.expiresAt.slice(0, 10))}. Saving an updated copy extends its expiry.</p>
    </section>
    <footer className="site-footer shell saved-trip-footer">
      <div className="footer-top"><div><span className="brand-name footer-brand">tripfinder<span className="brand-period">.</span></span><p>Make room for somewhere new.</p></div><div className="footer-side"><SupportTipLink/><Link href="/#plan" className="text-link dark-link">Plan a trip <ArrowRight size={16}/></Link></div></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Tripfinder</span><span>Independent planning tool · Bookings completed with providers</span></div>
    </footer>
  </main>;
}
