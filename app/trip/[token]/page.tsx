import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, ExternalLink, MapPin, Star, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SupportTipLink } from "@/components/support-tip-link";
import { PrintTripButton } from "@/components/trips/print-trip-button";
import { MakeTripCopyButton } from "@/components/trips/make-trip-copy-button";
import { getSavedTripByShareToken } from "@/lib/db/saved-trips";
import { formatTripDestinationLabel } from "@/lib/trip-planner/destinations";
import { sortSavedTripItemsChronologically } from "@/lib/trip-planner/saved-trips";

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
  "flight-fare": "Flight pricing · round trip",
  stay: "Place to stay",
  "stay-check-in": "Accommodation check-in",
  "stay-check-out": "Accommodation check-out",
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
        <div className="saved-trip-header-row"><div><span className="eyebrow">SHARED TRIP PLAN</span><h1>{saved.snapshot.title}</h1></div><PrintTripButton/></div>
        <p className="saved-trip-intro">A saved planning snapshot. It is not a booking, reservation or live availability guarantee.</p>
      </header>
      <section className="saved-trip-overview" aria-label="Trip overview">
        <div><span>FROM</span><strong>{search.originAirportCode || search.origin}</strong></div>
        <div><span>DESTINATION</span><strong>{destination}</strong></div>
        <div><CalendarDays size={15}/><strong>{dateLabel(search.departureDate)} – {dateLabel(search.returnDate)}</strong></div>
        <div><Users size={15}/><strong>{travelers} traveler{travelers === 1 ? "" : "s"}</strong></div>
        <div><span>BUDGET</span><strong>{money(search.budget, search.currency)} {search.budgetMode === "per_person" ? "per person" : "total"}</strong></div>
      </section>
      <div className="saved-trip-notice no-print"><MapPin size={15}/><p>Anyone with this private link can view this trip. Share it only with people you trust. Booking tokens, account credentials and private API data are not included. Photos, ratings and links are saved provider snapshots and may change.</p></div>
      <section className="saved-trip-content">
        <div className="saved-trip-content-heading"><div><span className="eyebrow">YOUR PLAN</span><h2>Selected trip details</h2></div><span>Saved {new Date(saved.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span></div>
        {saved.snapshot.destinations.map((group, index) => <section className="saved-trip-destination" key={`${group.label}-${index}`}>
          <h3>{group.label}</h3>
          {!group.items.length ? <p className="saved-trip-empty">No flights, stays, activities or restaurants have been selected yet. This link preserves the original search criteria.</p> : <div className="saved-trip-items">
            {sortSavedTripItemsChronologically(group.items).map((item, itemIndex) => <article className={`saved-trip-item ${item.imageUrl ? "has-image" : "no-image"}`} key={`${item.kind}-${item.title}-${itemIndex}`}>
              {item.imageUrl && <a className="saved-trip-item-image-link" href={item.mapsUrl || item.websiteUrl || undefined} target={item.mapsUrl || item.websiteUrl ? "_blank" : undefined} rel={item.mapsUrl || item.websiteUrl ? "noreferrer" : undefined}><img className="saved-trip-item-image" src={item.imageUrl} alt={`${item.title}`} loading="lazy" referrerPolicy="no-referrer"/></a>}
              <div className="saved-trip-item-main">
                <div className="saved-trip-item-heading"><span>{kindLabels[item.kind] || "Trip item"}</span>{item.date && <time dateTime={item.date}>{dateLabel(item.date)}{item.time ? ` · ${item.time}` : ""}</time>}</div>
                <h4>{item.title}</h4>
                {item.dateNeedsReview && <p className="saved-trip-date-review">Needs review for the updated trip dates</p>}
                {item.subtitle && <p>{item.subtitle}</p>}
                {item.rating !== undefined && <div className="saved-trip-item-rating"><Star size={12} fill="currentColor" aria-hidden="true"/><strong>{item.rating.toFixed(1)}</strong>{item.reviewCount !== undefined && <span>{item.reviewCount.toLocaleString("en-US")} reviews</span>}</div>}
                {item.sourceLabel && <small className="saved-trip-item-source">Information from {item.sourceLabel}</small>}
                {item.details.length > 0 && <ul>{item.details.map((detail, detailIndex) => <li key={detailIndex}>{detail}</li>)}</ul>}
                {item.price !== undefined && item.price !== null && <div className="saved-trip-item-price"><strong>{money(item.price, item.currency || search.currency)}</strong>{item.priceLabel && <span>{item.priceLabel}</span>}</div>}
                {(item.mapsUrl || item.websiteUrl) && <div className="saved-trip-item-links">
                  {item.mapsUrl && <a href={item.mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps <ExternalLink size={11}/></a>}
                  {item.websiteUrl && <a href={item.websiteUrl} target="_blank" rel="noreferrer">{item.websiteLabel || "Open provider link"} <ExternalLink size={11}/></a>}
                </div>}
              </div>
            </article>)}
          </div>}
        </section>)}
      </section>
      <div className="saved-trip-actions no-print"><MakeTripCopyButton sourceShareToken={token} searchQuery={saved.searchQuery} snapshot={saved.snapshot}/><Link href={openSearch} className="button button-outline">Reopen search <ArrowRight size={16}/></Link><span>Make your own copy opens a temporary editable draft and carries over your selected itinerary. Exact matches are restored from current provider results; unavailable or changed offers are flagged for review. The draft does not use a daily saved-trip slot until you press Save trip. Closing it before saving leaves the original share unchanged. Reopening this original link remains read-only.</span></div>
      <p className="saved-trip-expiry">This share link expires {dateLabel(saved.expiresAt.slice(0, 10))}. Saving an updated copy extends its expiry.</p>
    </section>
    <footer className="site-footer shell saved-trip-footer">
      <div className="footer-top"><div><span className="brand-name footer-brand">tripfinder<span className="brand-period">.</span></span><p>Make room for somewhere new.</p></div><div className="footer-side"><SupportTipLink/><Link href="/#plan" className="text-link dark-link">Plan a trip <ArrowRight size={16}/></Link></div></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Tripfinder</span><span>Independent planning tool · Bookings completed with providers</span></div>
    </footer>
  </main>;
}
