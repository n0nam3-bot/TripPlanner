"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, MessageSquareText } from "lucide-react";

type OwnedTrip = {
  shareToken: string;
  searchPath: string;
  title: string;
  origin: string;
  departureDate: string;
  returnDate: string;
};

const OWNER_STORAGE_PREFIX = "tripfinder:saved-trip-owner:v1:";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,64}$/;

function readOwnedTrips(): OwnedTrip[] {
  const byShareToken = new Map<string, OwnedTrip>();
  if (typeof window === "undefined") return [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(OWNER_STORAGE_PREFIX)) continue;
    const searchPath = key.slice(OWNER_STORAGE_PREFIX.length);
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "null") as { shareToken?: unknown; ownerToken?: unknown } | null;
      if (!parsed || typeof parsed.shareToken !== "string" || typeof parsed.ownerToken !== "string"
        || !TOKEN_PATTERN.test(parsed.shareToken) || !TOKEN_PATTERN.test(parsed.ownerToken)) continue;
      const url = new URL(searchPath, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname !== "/results") continue;
      const destination = url.searchParams.get("destinationArea") || url.searchParams.get("destination") || "Saved trip";
      const title = destination.trim() || "Saved trip";
      byShareToken.set(parsed.shareToken, {
        shareToken: parsed.shareToken,
        searchPath: `${url.pathname}${url.search}`,
        title,
        origin: url.searchParams.get("origin") || "",
        departureDate: url.searchParams.get("depart") || "",
        returnDate: url.searchParams.get("return") || "",
      });
    } catch {
      // Ignore corrupt or legacy local entries; other owned trips remain available.
    }
  }

  return [...byShareToken.values()].sort((left, right) => right.departureDate.localeCompare(left.departureDate));
}

function formatDateRange(departureDate: string, returnDate: string): string {
  const format = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Date not available";
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date)
      : "Date not available";
  };
  return `${format(departureDate)} – ${format(returnDate)}`;
}

export function MyTripsClient() {
  const [trips, setTrips] = useState<OwnedTrip[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try { setTrips(readOwnedTrips()); }
    catch { setTrips([]); }
    setLoaded(true);
  }, []);

  if (!loaded) return <div className="my-trips-loading" role="status">Loading saved trips…</div>;

  if (!trips.length) return <div className="my-trips-empty">
    <ClipboardList size={24} aria-hidden="true" />
    <h2>No saved trips in this browser yet</h2>
    <p>When you save a trip, it will appear here. Use the same browser where you originally saved it to manage the trip and view traveler feedback.</p>
    <Link href="/#plan" className="button button-dark">Plan a trip <ArrowRight size={15}/></Link>
  </div>;

  return <div className="my-trips-list" aria-label="Saved trips">
    {trips.map((trip) => <article className="my-trip-card" key={trip.shareToken}>
      <div className="my-trip-card-copy">
        <span className="eyebrow">SAVED TRIP</span>
        <h2>{trip.title}</h2>
        <p><CalendarDays size={14} aria-hidden="true"/>{formatDateRange(trip.departureDate, trip.returnDate)}</p>
        {trip.origin && <small>Starting from {trip.origin}</small>}
      </div>
      <div className="my-trip-card-actions">
        <Link href={`${trip.searchPath}#feedback`} className="my-trip-manage-link"><MessageSquareText size={15}/> Manage trip & feedback <ArrowRight size={14}/></Link>
        <Link href={`/trip/${trip.shareToken}`} className="my-trip-share-link">Open shared itinerary <ArrowRight size={14}/></Link>
      </div>
    </article>)}
    <p className="my-trips-storage-note">Your owner access is stored privately in this browser. Saved trips are not automatically synced between different browsers or devices.</p>
  </div>;
}

/** Appears only when the current browser holds the matching private owner credential. */
export function OwnerTripAccess({ shareToken }: { shareToken: string }) {
  const [manageHref, setManageHref] = useState("");

  useEffect(() => {
    try {
      const trip = readOwnedTrips().find((entry) => entry.shareToken === shareToken);
      setManageHref(trip ? `${trip.searchPath}#feedback` : "");
    } catch { setManageHref(""); }
  }, [shareToken]);

  if (!manageHref) return null;
  return <section className="saved-trip-owner-tools no-print" aria-label="Saved trip owner controls">
    <div><strong>This is your saved trip</strong><p>Manage your itinerary, invite travelers to give feedback, or review suggestions.</p></div>
    <div className="saved-trip-owner-actions">
      <Link href={manageHref}>Manage trip & feedback <ArrowRight size={15}/></Link>
      <Link href="/my-trips">All my trips</Link>
    </div>
  </section>;
}
