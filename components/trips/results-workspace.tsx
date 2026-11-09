"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, ChevronDown, Clock3, ExternalLink, Hotel, MapPin, Plane, RefreshCw, ShieldAlert, Sparkles, Star, Wallet, Users } from "lucide-react";
import type { FlightBookingOption, LiveFlight, LiveHotel, LiveTravelSearchResult, ReturnFlightSearchResult } from "@/lib/providers/serpapi";
import type { TripRecommendation, TripSearchInput } from "@/lib/trip-planner/types";

type Props = {
  search: TripSearchInput;
  recommendations: TripRecommendation[];
  liveSearchConfigured: boolean;
  providerKeyConfigured: boolean;
  databaseConfigured: boolean;
};

type SearchState = { loading: boolean; error: string; result: LiveTravelSearchResult | null };
type ReturnState = { loading: boolean; error: string; result: ReturnFlightSearchResult | null };
type BookingOption = FlightBookingOption;
type BookingState = { loading: boolean; error: string; options: BookingOption[] | null };

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const duration = (minutes: number | null) => minutes === null ? "Duration not listed" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function BookingOptions({ state, currency }: { state?: BookingState; currency: string }) {
  if (!state) return null;
  if (state.error) return <p className="booking-error">{state.error}</p>;
  if (!state.options) return null;
  return <div className="booking-options-list">
    {state.options.length ? state.options.map((option, index) => <div className="booking-option-row" key={`${option.seller}-${index}`}>
      <span><strong>{option.seller}</strong><small>{option.type}</small></span>
      <span>{option.price !== null ? money(option.price, option.currency || currency) : "See seller"}</span>
      {option.url && option.postFields.length > 0 ? <form action={option.url} method="post" target="_blank">
        {option.postFields.map((field, fieldIndex) => <input key={`${field.name}-${fieldIndex}`} type="hidden" name={field.name} value={field.value}/>)}
        <button type="submit" className="booking-submit-button">Continue <ArrowUpRight size={12}/></button>
      </form> : option.url ? <a href={option.url} target="_blank" rel="noreferrer">Continue <ArrowUpRight size={12}/></a> : null}
      {(option.baggage.length > 0 || option.fareTerms.length > 0) && <small className="booking-terms">{[...option.baggage, ...option.fareTerms].join(" · ")}</small>}
    </div>) : <small>No seller links were returned for this selection. Try the general flight search link instead.</small>}
  </div>;
}

function ReturnOptions({
  state, bookingStates, onLoadBookingOptions, currency,
}: {
  state?: ReturnState;
  bookingStates: Record<string, BookingState>;
  onLoadBookingOptions: (flight: LiveFlight) => void;
  currency: string;
}) {
  if (!state) return null;
  return <div className="return-options-panel">
    <div className="return-options-heading"><strong>Return options for this outbound flight</strong>{state.result && <small>Data checked {new Date(state.result.dataAsOf).toLocaleString()}</small>}</div>
    {state.loading && <p className="provider-warning"><RefreshCw size={13} className="spin"/> Searching for return flights that connect to this selected outbound itinerary…</p>}
    {state.error && <p className="booking-error">{state.error}</p>}
    {state.result?.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}
    {state.result?.flights.map((flight) => {
      const booking = bookingStates[flight.id];
      return <div className="return-flight-option" key={flight.id}>
        <div className="return-flight-copy">
          <strong>{flight.departure} <span>→</span> {flight.arrival}</strong>
          <small>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</small>
          <small>{flight.from} → {flight.to}</small>
        </div>
        <div className="return-flight-action">
          {flight.price !== null && <strong>{money(flight.price, flight.currency || currency)}</strong>}
          {flight.price !== null && <small>Provider-displayed price after return selection; seller must reconfirm.</small>}
          {flight.bookingToken ? <button className="booking-options-button" type="button" disabled={booking?.loading} onClick={() => onLoadBookingOptions(flight)}>
            {booking?.loading ? <><RefreshCw size={12} className="spin"/> Checking sellers</> : <><ExternalLink size={12}/> See combined booking options</>}
          </button> : <small>Seller-level price link not supplied for this selection.</small>}
        </div>
        <BookingOptions state={booking} currency={currency}/>
      </div>;
    })}
    {state.result && state.result.flights.length === 0 && <small>No return options returned for this outbound choice.</small>}
    <p className="provider-disclaimer">The selected return-stage provider result is not a reservation. Open a seller option to verify the complete round-trip itinerary, traveler details, baggage, taxes and final payable amount.</p>
  </div>;
}

function FlightResult({
  flight, currency, returnState, bookingStates, onLoadReturnFlights, onLoadBookingOptions,
}: {
  flight: LiveFlight;
  currency: string;
  returnState?: ReturnState;
  bookingStates: Record<string, BookingState>;
  onLoadReturnFlights: (flight: LiveFlight) => void;
  onLoadBookingOptions: (flight: LiveFlight) => void;
}) {
  return <article className="live-offer-card">
    <div className="live-offer-main">
      <span className="eyebrow">OUTBOUND OPTION</span>
      <div className="live-offer-route"><strong>{flight.departure}</strong><span>→</span><strong>{flight.arrival}</strong></div>
      <p>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</p>
      <small>{flight.from} → {flight.to}</small>
    </div>
    <div className="live-offer-price">
      {flight.price !== null ? <strong>{money(flight.price, flight.currency || currency)}</strong> : <strong>Price not supplied</strong>}
      <small>Outbound-stage display only — not a round-trip total</small>
      {flight.departureToken ? <button className="booking-options-button" type="button" disabled={returnState?.loading} onClick={() => onLoadReturnFlights(flight)}>
        {returnState?.loading ? <><RefreshCw size={12} className="spin"/> Finding return flights</> : <><Plane size={12}/> Find matching return flights</>}
      </button> : <small>Provider did not return a return-selection token for this option.</small>}
    </div>
    <ReturnOptions state={returnState} bookingStates={bookingStates} onLoadBookingOptions={onLoadBookingOptions} currency={currency}/>
  </article>;
}

function HotelResult({ hotel, currency }: { hotel: LiveHotel; currency: string }) {
  return <article className="live-hotel-card">
    {hotel.image && <img src={hotel.image} alt={`${hotel.name} property`} loading="lazy" referrerPolicy="no-referrer" />}
    <div className="live-hotel-copy">
      <div className="live-hotel-title"><h4>{hotel.name}</h4>{hotel.rating !== null && <span><Star size={12} fill="currentColor"/> {hotel.rating.toFixed(1)}{hotel.reviews ? ` · ${hotel.reviews.toLocaleString()} reviews` : ""}</span>}</div>
      <p>{hotel.address || hotel.source}</p>
      <div className="live-hotel-tags">{hotel.freeCancellation && <span><Check size={11}/> Free cancellation shown</span>}{hotel.amenities.slice(0, 3).map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
    </div>
    <div className="live-hotel-price">
      {hotel.totalPrice !== null ? <strong>{money(hotel.totalPrice, hotel.currency || currency)}</strong> : hotel.nightlyPrice !== null ? <strong>{money(hotel.nightlyPrice, hotel.currency || currency)}<small>/night</small></strong> : <strong>Price unavailable</strong>}
      <small>{hotel.totalPrice !== null ? "Provider-displayed stay total" : "Provider-displayed nightly rate"}</small>
      {hotel.bookingUrl && <a href={hotel.bookingUrl} target="_blank" rel="noreferrer">View property options <ExternalLink size={12}/></a>}
    </div>
  </article>;
}

export function ResultsWorkspace({ search, recommendations, liveSearchConfigured, providerKeyConfigured, databaseConfigured }: Props) {
  const [expanded, setExpanded] = useState<string | null>(recommendations[0]?.destination.id ?? null);
  const [states, setStates] = useState<Record<string, SearchState>>({});
  const [returnStates, setReturnStates] = useState<Record<string, ReturnState>>({});
  const [bookingStates, setBookingStates] = useState<Record<string, BookingState>>({});
  const [checkedDestinations, setCheckedDestinations] = useState<string[]>([]);
  const people = search.adults + search.childrenAges.length;
  const nights = Math.max(1, Math.round((new Date(`${search.returnDate}T00:00:00Z`).getTime() - new Date(`${search.departureDate}T00:00:00Z`).getTime()) / 86400000));
  const perPersonDaily = useMemo(() => search.budgetMode === "per_person" ? search.budget / nights : search.budget / Math.max(1, people * nights), [search, nights, people]);

  async function checkLiveOffers(recommendation: TripRecommendation) {
    const id = recommendation.destination.id;
    setStates((current) => ({ ...current, [id]: { loading: true, error: "", result: current[id]?.result ?? null } }));
    try {
      const response = await fetch("/api/travel/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search, destinationName: `${recommendation.destination.city}, ${recommendation.destination.country}`, destinationAirportCode: recommendation.destination.airportCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to search this trip right now.");
      setStates((current) => ({ ...current, [id]: { loading: false, error: "", result: data as LiveTravelSearchResult } }));
      setCheckedDestinations((current) => current.includes(id) ? current : [...current, id]);
    } catch (error) {
      setStates((current) => ({ ...current, [id]: { loading: false, error: error instanceof Error ? error.message : "Travel search failed.", result: current[id]?.result ?? null } }));
    }
  }

  async function loadReturnFlights(outbound: LiveFlight, destinationAirportCode: string) {
    if (!outbound.departureToken) return;
    setReturnStates((current) => ({ ...current, [outbound.id]: { loading: true, error: "", result: current[outbound.id]?.result ?? null } }));
    try {
      const response = await fetch("/api/travel/return-flights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search, destinationAirportCode, departureToken: outbound.departureToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to retrieve return flight options.");
      setReturnStates((current) => ({ ...current, [outbound.id]: { loading: false, error: "", result: data as ReturnFlightSearchResult } }));
    } catch (error) {
      setReturnStates((current) => ({ ...current, [outbound.id]: { loading: false, error: error instanceof Error ? error.message : "Return flight search failed.", result: current[outbound.id]?.result ?? null } }));
    }
  }

  async function loadBookingOptions(flight: LiveFlight, destinationAirportCode: string) {
    if (!flight.bookingToken) return;
    setBookingStates((current) => ({ ...current, [flight.id]: { loading: true, error: "", options: current[flight.id]?.options ?? null } }));
    try {
      const response = await fetch("/api/travel/booking-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingToken: flight.bookingToken, search, destinationAirportCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not retrieve seller links.");
      setBookingStates((current) => ({ ...current, [flight.id]: { loading: false, error: "", options: Array.isArray(data.options) ? data.options as BookingOption[] : [] } }));
    } catch (error) {
      setBookingStates((current) => ({ ...current, [flight.id]: { loading: false, error: error instanceof Error ? error.message : "Seller lookup failed.", options: current[flight.id]?.options ?? null } }));
    }
  }

  return (
    <div className="planner-results-workspace">
      <div className="planning-context">
        <div><span className="eyebrow">YOUR PLANNING TARGET</span><strong>{money(search.budget, search.currency)} <small>{search.budgetMode === "total" ? "total trip budget" : "per traveler budget"}</small></strong></div>
        <div><span className="eyebrow">DAILY TARGET</span><strong>{money(perPersonDaily, search.currency)} <small>per person / day</small></strong></div>
        <div><span className="eyebrow">TRIP LENGTH</span><strong>{nights} <small>nights · {people} travelers</small></strong></div>
      </div>

      {!liveSearchConfigured && <div className="live-setup-note"><div className="live-setup-icon"><ShieldAlert size={19}/></div><div><strong>Trip planning is active · Live travel search setup is incomplete</strong><p>{!providerKeyConfigured ? <>Add a private <code>SERPAPI_API_KEY</code> in Vercel from a SerpApi account. </> : null}{!databaseConfigured ? <>Add your Neon connection string as <code>DATABASE_URL</code>. The database stores one-hour provider caches and enforces a shared monthly search cap before any uncached request is sent. </> : null}Direct flight, hotel and experience search links remain available without these connections.</p></div></div>}
      {liveSearchConfigured && <div className="live-ready-note"><span><span className="live-status-dot"/> Live-search credentials are present</span><small>Neon connectivity and the SerpApi account balance are checked on the first request. Persistent caching and shared monthly/hourly and per-connection limits protect the search allowance. Each destination check can request one flight and one hotel search; return and seller lookups use additional requests.</small></div>}

      {search.flexibleDays > 0 && <p className="accuracy-note"><Clock3 size={14}/> Your ±{search.flexibleDays}-day flexibility is recorded as a preference, but live provider searches currently check only the exact dates entered.</p>}
      {search.rooms > 1 && <p className="accuracy-note"><Hotel size={14}/> You requested {search.rooms} rooms. Hotel offers are withheld because this integration cannot confirm the requested room count for your full party.</p>}
      {search.childrenAges.length > 0 && <p className="accuracy-note"><Users size={14}/> Hotel search receives the children's ages. Flight search receives the child count but not each child's age, so verify age-specific fares with the airline or seller.</p>}

      <div className="planner-results-list">
        {recommendations.map((recommendation, index) => {
          const destination = recommendation.destination;
          const state = states[destination.id];
          const isExpanded = expanded === destination.id;
          return (
            <motion.article className={`planner-destination-card ${isExpanded ? "is-expanded" : ""}`} key={destination.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] }}>
              <div className="planner-destination-visual" style={{ backgroundImage: `url('${destination.image}')` }}>
                <span className="planner-destination-index">0{index + 1}</span>
                <span className="planner-match-score" title="Heuristic score based on trip style, travel month, trip length and broad destination cost profile — not a fare prediction."><Sparkles size={12}/> Preference match {recommendation.score}/100</span>
              </div>
              <div className="planner-destination-body">
                <div className="planner-destination-heading">
                  <div><span className="planner-country">{destination.country}</span><h3>{destination.city}</h3><p>{destination.summary}</p></div>
                  <span className="planner-airport"><MapPin size={13}/>{destination.airportCode || "Airport needed"}</span>
                </div>
                <div className="planner-highlights">{destination.highlights.map((highlight) => <span key={highlight}><Check size={12}/>{highlight}</span>)}</div>
                <div className="planner-reasons"><strong>Why it matched</strong>{recommendation.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
                <div className="planner-actions">
                  <button className="button button-dark" onClick={() => setExpanded(isExpanded ? null : destination.id)} aria-expanded={isExpanded}>{isExpanded ? "Hide itinerary" : "View trip plan"}<ChevronDown size={15} className={isExpanded ? "chevron-up" : ""}/></button>
                  <a className="planner-outbound-link" href={recommendation.flightSearchUrl} target="_blank" rel="noreferrer"><Plane size={15}/> Flights <ArrowUpRight size={13}/></a>
                  <a className="planner-outbound-link" href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer"><Hotel size={15}/> Stays <ArrowUpRight size={13}/></a>
                  <a className="planner-outbound-link" href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer">Experiences <ArrowUpRight size={13}/></a>
                </div>

                {liveSearchConfigured && destination.airportCode && <div className="live-search-action"><button type="button" className="live-search-button" disabled={state?.loading || checkedDestinations.includes(destination.id)} onClick={() => checkLiveOffers(recommendation)}>{state?.loading ? <><RefreshCw size={14} className="spin"/> Checking current options…</> : checkedDestinations.includes(destination.id) ? <><Check size={14}/> Search checked</> : <><RefreshCw size={14}/> Check flights and stays for these dates</>}</button><span>Up to 2 provider searches. Follow-up return and seller lookups use additional searches. One initial check per destination in this results session.</span></div>}
                {state?.error && <div className="provider-error" role="alert">{state.error}</div>}
                {state?.result && <div className="live-search-results">
                  <div className="live-result-heading"><div><span className="eyebrow">PROVIDER RESULTS</span><h4>Travel options found</h4></div><small>Checked {new Date(state.result.checkedAt).toLocaleString()}<br/>Source snapshot {new Date(state.result.dataAsOf).toLocaleString()}{state.result.servedFromCache ? " · cached" : " · freshly queried"}</small></div>
                  {state.result.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}
                  {state.result.flights.length > 0 && <section className="live-result-group"><h5><Plane size={15}/> Outbound flight options <span>{state.result.flights.length} options</span></h5>{state.result.flights.map((flight) => <FlightResult key={flight.id} flight={flight} currency={search.currency} returnState={returnStates[flight.id]} bookingStates={bookingStates} onLoadReturnFlights={(selected) => loadReturnFlights(selected, destination.airportCode)} onLoadBookingOptions={(selected) => loadBookingOptions(selected, destination.airportCode)}/>)}</section>}
                  {state.result.hotels.length > 0 && <section className="live-result-group"><h5><Hotel size={15}/> Hotel results <span>{state.result.hotels.length} properties</span></h5>{state.result.hotels.map((hotel) => <HotelResult key={hotel.id} hotel={hotel} currency={search.currency}/>)}</section>}
                  {state.result.status === "empty" && <div className="empty-provider-results">No matching provider options were returned. Try another date, destination airport or passenger configuration.</div>}
                  <p className="provider-disclaimer">Provider snapshots are not guaranteed quotes. Verify the complete itinerary, exact passenger and room mix, taxes, baggage, cancellation terms and final price with the seller before purchase.</p>
                </div>}

                {isExpanded && <div className="itinerary-panel">
                  <div className="itinerary-panel-heading"><div><span className="eyebrow">A FIRST-PASS ITINERARY</span><h4>{nights}-night trip in {destination.city}</h4></div><p>Suggested structure, not confirmed reservations.</p></div>
                  <div className="itinerary-days">{recommendation.itinerary.map((day, dayIndex) => <div className="itinerary-day" key={day.date}><div className="itinerary-day-date"><span>DAY {dayIndex + 1}</span><strong>{dateLabel(day.date)}</strong></div><div className="itinerary-activities">{day.activities.map((activity) => <div className="itinerary-activity" key={`${day.date}-${activity.period}-${activity.title}`}><span>{activity.period}</span><div><strong>{activity.title}</strong><p>{activity.description}</p></div><small>{activity.category}</small></div>)}<p className="itinerary-pace">{day.paceNote}</p></div></div>)}</div>
                  <div className="itinerary-footnote">{destination.sourceNote} This itinerary does not verify attraction hours, tickets, transfers, safety alerts or local closures.</div>
                </div>}
              </div>
            </motion.article>
          );
        })}
      </div>

      <div className="planner-method-note"><div><Wallet size={18}/></div><p><strong>How we use your budget</strong> We calculate a daily target using your chosen total-trip or per-traveler budget. Destination cost bands are a broad planning signal only; we do not claim that a trip fits your budget until current flight, hotel and other costs are retrieved and checked.</p></div>
      <div className="planner-method-note"><div><ShieldAlert size={18}/></div><p><strong>Data quality rules</strong> We do not fabricate fares or hotel inventory. Provider data is timestamped and identified; itinerary suggestions remain guidance until local schedules, tickets, transfers and conditions are verified.</p></div>
    </div>
  );
}
