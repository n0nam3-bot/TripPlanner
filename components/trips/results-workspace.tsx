"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, ExternalLink, Hotel, MapPin, Plane, RefreshCw, ShieldAlert, Star, Users, Wallet, Wind, CloudRain } from "lucide-react";
import type { FlightBookingOption, HotelBookingOption, LiveExperience, LiveFlight, LiveHotel, LiveTravelSearchResult, ReturnFlightSearchResult } from "@/lib/providers/serpapi";
import type { StayAmenity, TripRecommendation, TripSearchInput } from "@/lib/trip-planner/types";
import { formatDestinationLabel, normalizeDestinationQuery } from "@/lib/trip-planner/destinations";
import { AIRPORT_COORDINATES } from "@/lib/trip-planner/location-suggestions";
import { destinationTimezoneNotice, flightLayoverDuration, formatFlightTimeInDestination } from "@/lib/trip-planner/flight-routing";
import { inferStaySpaceType, poolAccessLabel, STAY_AMENITY_LABELS, stayAmenityConfirmed } from "@/lib/providers/stay-features";
import { AITripAssistant } from "@/components/trips/ai-trip-assistant";
import { getTripAssistantResultAnchor, getTripAssistantStayAnchor, type TripAssistantContext } from "@/lib/ai/trip-assistant";
import { buildTripCostLedger, parseCostEstimate } from "@/lib/trip-planner/cost-ledger";

type Props = {
  search: TripSearchInput;
  recommendations: TripRecommendation[];
  liveSearchConfigured: boolean;
  providerKeyConfigured: boolean;
  databaseConfigured: boolean;
  weatherKeyConfigured: boolean;
  aiProviderConfigured: boolean;
  geminiProviderConfigured: boolean;
  openRouterProviderConfigured: boolean;
};
type SearchState = { loading: boolean; error: string; result: LiveTravelSearchResult | null };
type ReturnState = { loading: boolean; error: string; result: ReturnFlightSearchResult | null };
type BookingState = { loading: boolean; error: string; options: FlightBookingOption[] | null };
type HotelBookingState = { loading: boolean; error: string; options: HotelBookingOption[] | null };
type WeatherDay = { date: string; condition: string; icon: string; highC: number | null; lowC: number | null; highF: number | null; lowF: number | null; rainChance: number | null; maxWindKph: number | null; uv: number | null };
type WeatherState = { loading: boolean; status: string; message?: string; days: WeatherDay[]; attribution?: string };
type RouteState = { loading: boolean; error?: string; distance?: string; duration?: string; durationInTraffic?: string };
type ExperienceSlot = "Morning" | "Lunch" | "Afternoon" | "Dinner" | "Evening";
type SelectedExperience = { date: string; slot: ExperienceSlot; time?: string };
type SelectedFlightSeller = { flightId: string; option: FlightBookingOption };
type DestinationSelection = {
  outbound: LiveFlight | null;
  returnFlight: LiveFlight | null;
  flightSeller: SelectedFlightSeller | null;
  hotel: LiveHotel | null;
  experiences: Record<string, SelectedExperience>;
  /** User-entered times confirmed directly with the property; providers do not currently return these fields. */
  checkInTime?: string;
  checkOutTime?: string;
};
const emptySelection = (): DestinationSelection => ({ outbound: null, returnFlight: null, flightSeller: null, hotel: null, experiences: {} });

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const duration = (minutes: number | null) => minutes === null ? "Duration not listed" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const dateShort = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const formatTime = (value?: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = match[2];
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
};

function FlightLegDetails({ flight, destinationAirportCode }: { flight: LiveFlight; destinationAirportCode: string }) {
  if (!flight.segments?.length) return null;
  return <div className="flight-leg-details">
    <strong className="flight-leg-details-title">Flight-by-flight itinerary</strong>
    {flight.segments.map((segment, index) => {
      const next = flight.segments[index + 1];
      const layover = next ? flightLayoverDuration(segment.arrival, next.departure, segment.toAirportCode) : null;
      return <div className="flight-leg" key={`${flight.id}-segment-${index}`}>
        <div className="flight-leg-heading"><strong>Leg {index + 1}{segment.flightNumber ? ` · ${segment.airline} ${segment.flightNumber}` : ` · ${segment.airline}`}</strong><span>{duration(segment.durationMinutes)}</span></div>
        <div className="flight-leg-route">
          <div className="flight-leg-endpoint"><small>DEPARTS</small><strong>{segment.from}</strong><span>{formatFlightTimeInDestination(segment.departure, segment.fromAirportCode, destinationAirportCode)}</span></div>
          <ArrowRight size={16} aria-hidden="true"/>
          <div className="flight-leg-endpoint"><small>ARRIVES</small><strong>{segment.to}</strong><span>{formatFlightTimeInDestination(segment.arrival, segment.toAirportCode, destinationAirportCode)}</span></div>
        </div>
        {next && <div className="flight-layover-note"><Clock3 size={13}/><span><strong>Connection at {segment.to}</strong>{` · Next flight departs ${formatFlightTimeInDestination(next.departure, next.fromAirportCode, destinationAirportCode)}${layover ? ` · ${layover} layover` : ""}`}</span></div>}
      </div>;
    })}
  </div>;
}

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat); const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function distanceLabel(miles: number): string { return miles < 0.2 ? "under 0.2 mi" : `${miles.toFixed(1)} mi`; }
function cacheAgeLabel(value: string): string {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "time unknown";
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
function resultSourceLabel(result: LiveTravelSearchResult): string {
  const summary = result.cacheSummary ?? [];
  if (summary.some((entry) => entry.status === "stale")) return "includes saved fallback data";
  if (summary.length && summary.every((entry) => entry.status === "cached")) return "cached provider data";
  if (summary.some((entry) => entry.status === "cached")) return "mixed cached and live provider data";
  return "new provider search";
}
function directionsUrl(origin: string, destination: string): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1"); url.searchParams.set("origin", origin); url.searchParams.set("destination", destination); url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function nearestKnownAirport(latitude: number, longitude: number, preferredCode = "") {
  if (preferredCode && AIRPORT_COORDINATES[preferredCode]) {
    return { code: preferredCode, ...AIRPORT_COORDINATES[preferredCode], miles: haversineMiles(latitude, longitude, AIRPORT_COORDINATES[preferredCode].latitude, AIRPORT_COORDINATES[preferredCode].longitude) };
  }
  return Object.entries(AIRPORT_COORDINATES)
    .map(([code, airport]) => ({ code, ...airport, miles: haversineMiles(latitude, longitude, airport.latitude, airport.longitude) }))
    .sort((a, b) => a.miles - b.miles)[0] ?? null;
}

function bookingOptionKey(option: FlightBookingOption): string {
  return `${option.seller}|${option.type}|${option.price ?? ""}|${option.url ?? ""}`;
}

function BookingContinue({ option }: { option: FlightBookingOption }) {
  if (!option.url) return null;
  if (option.postData) {
    return <form action="/api/travel/flight-booking-redirect" method="post" target="_blank">
      <input type="hidden" name="url" value={option.url}/>
      <input type="hidden" name="postData" value={option.postData}/>
      {option.fallbackUrl && <input type="hidden" name="fallbackUrl" value={option.fallbackUrl}/>}
      <button className="booking-submit-button" type="submit">Continue <ArrowUpRight size={12}/></button>
    </form>;
  }
  return <a href={option.url} target="_blank" rel="noreferrer">Continue <ArrowUpRight size={12}/></a>;
}

function BookingOptions({ state, currency, selectedOption, onSelectSeller }: {
  state?: BookingState;
  currency: string;
  selectedOption?: FlightBookingOption | null;
  onSelectSeller: (option: FlightBookingOption) => void;
}) {
  if (!state) return null;
  if (state.loading) return <p className="inline-loading"><RefreshCw size={13} className="spin"/> Loading airline and seller offers…</p>;
  if (state.error) return <p className="provider-inline-error">{state.error}</p>;
  if (!state.options) return null;
  return <div className="booking-options-list">
    {state.options.length ? state.options.map((option, index) => {
      const selected = Boolean(selectedOption && bookingOptionKey(selectedOption) === bookingOptionKey(option));
      return <div className={`booking-option-row ${selected ? "is-selected" : ""}`} key={`${option.seller}-${index}`}>
        <span><strong>{option.seller}</strong><small>{option.type}{(option.fareTerms.length > 0 || option.baggage.length > 0) ? ` · ${[...option.fareTerms, ...option.baggage].join(" · ")}` : ""}</small></span>
        <b>{option.price !== null ? money(option.price, option.currency || currency) : "See seller"}</b>
        <button type="button" className="booking-select-button" onClick={() => onSelectSeller(option)}>{selected ? <><Check size={11}/> Selected</> : "Select seller"}</button>
        <BookingContinue option={option}/>
      </div>;
    }) : <small>No direct seller links were returned for this selection. Open the exact Google Flights search above to compare booking options.</small>}
  </div>;
}

function ReturnOptions({ state, onSelectReturn, selectedReturnId, currency, destinationAirportCode }: {
  state?: ReturnState;
  onSelectReturn: (flight: LiveFlight) => void;
  selectedReturnId?: string;
  currency: string;
  destinationAirportCode: string;
}) {
  if (!state) return null;
  return <div className="return-options-panel">
    <div className="return-options-heading"><strong>Choose your return flight</strong>{state.result && <small>Checked {new Date(state.result.dataAsOf).toLocaleString()}</small>}</div>
    <p className="return-seller-note">Choose a return leg first. Seller comparison then checks booking options for the complete outbound + return itinerary.</p>
    {state.loading && <p className="inline-loading"><RefreshCw size={13} className="spin"/> Matching return legs to this outbound flight…</p>}
    {state.error && <p className="provider-inline-error">{state.error}</p>}
    {state.result?.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}
    {state.result?.flights.map((flight) => <div id={getTripAssistantResultAnchor("flight", flight.id)} tabIndex={-1} className={`return-flight-option ${selectedReturnId === flight.id ? "is-selected" : ""}`} key={flight.id}>
      <div className="return-flight-copy"><strong>{formatFlightTimeInDestination(flight.departure, flight.segments[0]?.fromAirportCode, destinationAirportCode)} <span>→</span> {formatFlightTimeInDestination(flight.arrival, flight.segments[flight.segments.length - 1]?.toAirportCode, destinationAirportCode)}</strong><small>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</small><small>{flight.from} → {flight.to}</small></div>
      <div className="return-flight-action">{flight.price !== null && <strong>{money(flight.price, flight.currency || currency)}</strong>}
        <button type="button" className={`selection-button ${selectedReturnId === flight.id ? "is-selected" : ""}`} onClick={() => onSelectReturn(flight)}>{selectedReturnId === flight.id ? <><Check size={13}/> Return selected · Remove</> : "Select return"}</button>
      </div>
      <FlightLegDetails flight={flight} destinationAirportCode={destinationAirportCode}/>
    </div>)}
    {state.result && state.result.flights.length === 0 && <p className="empty-inline">No return options matched this outbound selection.</p>}
  </div>;
}

function FlightResult({ flight, currency, destinationAirportCode, returnState, bookingStates, selectedOutbound, selectedReturnFlight, selectedSeller, onSelectOutbound, onSelectReturn, onLoadBookingOptions, onSelectSeller }: {
  flight: LiveFlight;
  currency: string;
  destinationAirportCode: string;
  returnState?: ReturnState;
  bookingStates: Record<string, BookingState>;
  selectedOutbound: boolean;
  selectedReturnFlight?: LiveFlight | null;
  selectedSeller?: SelectedFlightSeller | null;
  onSelectOutbound: (flight: LiveFlight) => void;
  onSelectReturn: (flight: LiveFlight) => void;
  onLoadBookingOptions: (flight: LiveFlight) => void;
  onSelectSeller: (flight: LiveFlight, option: FlightBookingOption) => void;
}) {
  // Round-trip booking options normally become available on the selected
  // return result. Prefer that token; use an outbound token only if supplied.
  const sellerLookupFlight = selectedReturnFlight?.bookingToken
    ? selectedReturnFlight
    : flight.bookingToken ? flight : null;
  const sellerState = sellerLookupFlight ? bookingStates[sellerLookupFlight.id] : undefined;
  return <article id={getTripAssistantResultAnchor("flight", flight.id)} tabIndex={-1} className={`live-offer-card ${selectedOutbound ? "is-selected" : ""}`}>
    <div className="live-offer-main"><div className="live-offer-route"><strong>{formatFlightTimeInDestination(flight.departure, flight.segments[0]?.fromAirportCode, destinationAirportCode)}</strong><span>→</span><strong>{formatFlightTimeInDestination(flight.arrival, flight.segments[flight.segments.length - 1]?.toAirportCode, destinationAirportCode)}</strong></div><p>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</p><small>{flight.from} → {flight.to}</small></div>
    <div className="live-offer-price">{flight.price !== null ? <strong>{money(flight.price, flight.currency || currency)}</strong> : <strong>Price not supplied</strong>}<small>Google Flights displayed outbound price; confirm the full round-trip fare with seller</small>
      <button className={`selection-button ${selectedOutbound ? "is-selected" : ""}`} type="button" disabled={returnState?.loading} onClick={() => onSelectOutbound(flight)}>{returnState?.loading && selectedOutbound ? <><RefreshCw size={12} className="spin"/> Finding returns</> : selectedOutbound ? <><Check size={13}/> Outbound selected</> : <>Choose outbound <ArrowRight size={12}/></>}</button>
      {selectedOutbound && selectedReturnFlight && sellerLookupFlight && <button className="text-action" type="button" onClick={() => onLoadBookingOptions(sellerLookupFlight)} disabled={sellerState?.loading}>{sellerState?.loading ? "Loading sellers…" : "Compare round-trip sellers"} <ArrowUpRight size={12}/></button>}
      {selectedOutbound && !selectedReturnFlight && <small className="seller-compare-hint">Select a return flight to compare sellers for the complete trip.</small>}
      {selectedOutbound && selectedReturnFlight && !sellerLookupFlight && <small className="seller-compare-hint">Seller booking links were not supplied for this return option. Use the exact Google Flights search above.</small>}
    </div>
    <FlightLegDetails flight={flight} destinationAirportCode={destinationAirportCode}/>
    {selectedOutbound && sellerLookupFlight && <BookingOptions state={sellerState} currency={currency} selectedOption={selectedSeller?.flightId === sellerLookupFlight.id ? selectedSeller.option : null} onSelectSeller={(option) => onSelectSeller(sellerLookupFlight, option)}/>}
    {selectedOutbound && <ReturnOptions state={returnState} onSelectReturn={onSelectReturn} selectedReturnId={selectedReturnFlight?.id} currency={currency} destinationAirportCode={destinationAirportCode}/>}
  </article>;
}

function RouteLookup({ origin, destination, label }: { origin: string; destination: string; label: string }) {
  const [state, setState] = useState<RouteState | null>(null);
  async function load() {
    setState({ loading: true });
    try {
      const response = await fetch("/api/travel/directions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin, destination }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Driving route unavailable.");
      setState({ loading: false, distance: String(data.distance || ""), duration: String(data.duration || ""), durationInTraffic: typeof data.durationInTraffic === "string" ? data.durationInTraffic : undefined });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Driving route unavailable." });
    }
  }
  return <span className="route-lookup">
    <button type="button" onClick={load} disabled={state?.loading}>{state?.loading ? <><RefreshCw size={11} className="spin"/> Checking route</> : state?.duration ? "Refresh drive" : label}</button>
    {state?.duration && <small>{state.distance} · {state.duration}{state.durationInTraffic ? ` · ${state.durationInTraffic} in traffic` : ""}</small>}
    {state?.error && <><small className="route-error">{state.error}</small><a href={directionsUrl(origin, destination)} target="_blank" rel="noreferrer">Open route in Maps</a></>}
  </span>;
}

function HotelResult({ hotel, currency, airportCode, experiences, nights, search, bookingState, selected, onSelect, onLoadBookingOptions }: {
  hotel: LiveHotel; currency: string; airportCode: string; experiences: LiveExperience[]; nights: number; search: TripSearchInput;
  bookingState?: HotelBookingState; selected: boolean; onSelect: (hotel: LiveHotel) => void; onLoadBookingOptions: (hotel: LiveHotel) => void;
}) {
  const airport = hotel.latitude !== null && hotel.longitude !== null
    ? nearestKnownAirport(hotel.latitude, hotel.longitude, airportCode) : null;
  const airportDistance = airport?.miles ?? null;
  const nearestActivities = hotel.latitude !== null && hotel.longitude !== null
    ? experiences.filter((item) => item.kind === "activity" && item.latitude !== null && item.longitude !== null).map((item) => ({ item, miles: haversineMiles(hotel.latitude!, hotel.longitude!, item.latitude!, item.longitude!) })).sort((a, b) => a.miles - b.miles).slice(0, 2)
    : [];
  const hotelOrigin = hotel.address || (hotel.latitude !== null && hotel.longitude !== null ? `${hotel.latitude},${hotel.longitude}` : hotel.name);
  const propertyUrl = hotel.bookingUrl || `https://www.google.com/travel/hotels?q=${encodeURIComponent(`${hotel.name} ${hotel.address}`)}`;
  const knownSpaceType = hotel.spaceType || inferStaySpaceType(hotel);
  const isPoolAccessAmenity = (amenity: StayAmenity) => ["pool", "private_pool", "shared_pool"].includes(amenity);
  const detectedAmenities = (Object.keys(STAY_AMENITY_LABELS) as StayAmenity[])
    .filter((amenity) => stayAmenityConfirmed(hotel, amenity) && !isPoolAccessAmenity(amenity))
    .slice(0, 16);
  return <article id={getTripAssistantStayAnchor(hotel.id)} tabIndex={-1} className={`live-hotel-card ${selected ? "is-selected" : ""}`}>
    {hotel.image && <img src={hotel.image} alt={`${hotel.name} property`} loading="lazy" referrerPolicy="no-referrer"/>}
    <div className="live-hotel-copy">
      <div className="live-hotel-title"><h4><a href={propertyUrl} target="_blank" rel="noreferrer">{hotel.name} <ExternalLink size={12}/></a></h4>{hotel.rating !== null && <span><Star size={12} fill="currentColor"/> {hotel.rating.toFixed(1)}{hotel.reviews ? ` · ${hotel.reviews.toLocaleString()}` : ""}</span>}</div>
      <p>{hotel.address || hotel.source} · {hotel.propertyType}</p>
      <div className="live-hotel-tags">
        {hotel.freeCancellation && <span><Check size={11}/> Free cancellation shown</span>}
        {knownSpaceType !== "unknown" && <span>{knownSpaceType === "entire_place" ? "Entire place listed" : knownSpaceType === "private_room" ? "Private room listed" : "Shared room listed"}</span>}
        {knownSpaceType === "unknown" && hotel.inventoryTypes?.includes("vacation_rentals") && <span>Rental space type not verified</span>}
        {poolAccessLabel(hotel) && <span>{poolAccessLabel(hotel)}</span>}
        {search.stayMustHaveAmenities.filter((amenity) => !isPoolAccessAmenity(amenity) && stayAmenityConfirmed(hotel, amenity)).map((amenity) => <span className="stay-verified-feature" key={`must-${amenity}`}>✓ {STAY_AMENITY_LABELS[amenity]} · confirmed</span>)}
        {search.stayPreferredAmenities.filter((amenity) => !isPoolAccessAmenity(amenity) && stayAmenityConfirmed(hotel, amenity)).map((amenity) => <span className="stay-preferred-feature" key={`prefer-${amenity}`}>{STAY_AMENITY_LABELS[amenity]} · preference matched</span>)}
        {detectedAmenities.filter((amenity) => !search.stayMustHaveAmenities.includes(amenity) && !search.stayPreferredAmenities.includes(amenity)).map((amenity) => <span key={`detected-${amenity}`}>{STAY_AMENITY_LABELS[amenity]} · listed</span>)}
        {hotel.amenities.filter((amenity) => !/\bpool\b/i.test(amenity) && !(Object.values(STAY_AMENITY_LABELS) as string[]).includes(amenity)).slice(0, 10).map((amenity) => <span key={amenity}>{amenity}</span>)}
      </div>
      {hotel.providerOffers.some((offer) => offer.url) && <div className="hotel-provider-links"><strong>Available booking sites</strong>{hotel.providerOffers.filter((offer) => offer.url).slice(0, 4).map((offer, index) => <div className="hotel-provider-offer" key={`${offer.seller}-${index}`}><span><b>{offer.seller}</b><small>{offer.price !== null ? `${money(offer.price, offer.currency || currency)}${offer.priceBasis === "stay" ? " total stay" : offer.priceBasis === "night" ? " per night" : ""}` : "Price not supplied"}</small></span><a href={offer.url} target="_blank" rel="noreferrer">Open seller <ExternalLink size={11}/></a></div>)}</div>}
      {(airportDistance !== null || nearestActivities.length > 0 || hotel.nearbyPlaces.length > 0) && <div className="hotel-proximity">
        {airportDistance !== null && airport && <span>{airport.name}{!airportCode ? " · nearest listed airport" : ""}: {distanceLabel(airportDistance)} straight-line</span>}
        {airport && <RouteLookup origin={hotelOrigin} destination={airport.name} label="Check drive to airport"/>}
        {hotel.nearbyPlaces.slice(0, 4).map((place) => <span className="hotel-nearby-place" key={`${place.name}-${place.category}`}><strong>{place.name}</strong>{place.category !== "Place" && ` · ${place.category}`}{place.transportations.length > 0 && ` · ${place.transportations.map((item) => `${item.type} ${item.duration}`).join(" · ")}`}</span>)}
        {nearestActivities.map(({ item, miles }) => <span className="hotel-activity-distance" key={item.id}>{item.name}: {distanceLabel(miles)} straight-line <RouteLookup origin={hotelOrigin} destination={item.address || `${item.latitude},${item.longitude}`} label="Driving time"/></span>)}
      </div>}
      {bookingState?.loading && <p className="inline-loading"><RefreshCw size={12} className="spin"/> Retrieving property booking options…</p>}
      {bookingState?.error && <p className="provider-inline-error">{bookingState.error}</p>}
      {bookingState?.options && <div className="hotel-booking-options">{bookingState.options.length ? bookingState.options.map((option, index) => <div className="hotel-booking-option" key={`${option.seller}-${index}`}><span><strong>{option.seller}</strong>{option.terms.length > 0 && <small>{option.terms.join(" · ")}</small>}</span><b>{option.price !== null ? money(option.price, option.currency || currency) : "See provider"}</b>{option.url && <a href={option.url} target="_blank" rel="noreferrer">Open seller <ArrowUpRight size={11}/></a>}</div>) : <p>No separate seller offers were returned. The property link remains available above.</p>}</div>}
    </div>
    <div className="live-hotel-price">
      {hotel.totalPrice !== null ? <strong>{money(hotel.totalPrice, hotel.currency || currency)}</strong> : hotel.nightlyPrice !== null ? <><strong>{money(hotel.nightlyPrice * nights, hotel.currency || currency)}</strong><small>Estimated {nights}-night total before taxes and fees</small><small>{money(hotel.nightlyPrice, hotel.currency || currency)} per night</small></> : <strong>Price unavailable</strong>}
      {hotel.totalPrice !== null && <small>Provider-displayed total for {nights} nights</small>}
      <button type="button" className={`selection-button ${selected ? "is-selected" : ""}`} onClick={() => onSelect(hotel)}>{selected ? <><Check size={13}/> Stay selected · Remove</> : "Select this stay"}</button>
      {hotel.propertyToken && <button type="button" className="text-action" onClick={() => onLoadBookingOptions(hotel)} disabled={bookingState?.loading}>{bookingState?.loading ? "Loading rates…" : bookingState?.options ? "Refresh rates" : "Compare rates"} <ArrowUpRight size={12}/></button>}
      <a className="hotel-primary-link" href={propertyUrl} target="_blank" rel="noreferrer">{hotel.bookingUrlLabel} <ExternalLink size={12}/></a>
    </div>
  </article>;
}

function ExperienceResult({ experience, hotels, airportCode, search, days, selected, onSelectionChange }: {
  experience: LiveExperience;
  hotels: LiveHotel[];
  airportCode: string;
  search: TripSearchInput;
  days: Array<{ date: string; label: string }>;
  selected?: SelectedExperience;
  onSelectionChange: (experience: LiveExperience, selection: SelectedExperience | null) => void;
}) {
  const isRestaurant = experience.kind === "restaurant";
  const [draftDate, setDraftDate] = useState(search.departureDate);
  const [draftSlot, setDraftSlot] = useState<ExperienceSlot>(isRestaurant ? "Dinner" : "Afternoon");
  const [draftTime, setDraftTime] = useState("");
  const activeDate = selected?.date ?? draftDate;
  const activeSlot = selected?.slot ?? draftSlot;
  const activeTime = selected?.time ?? draftTime;
  const nearbyStays = experience.latitude !== null && experience.longitude !== null
    ? hotels.filter((hotel) => hotel.latitude !== null && hotel.longitude !== null).map((hotel) => ({ hotel, miles: haversineMiles(experience.latitude!, experience.longitude!, hotel.latitude!, hotel.longitude!) })).sort((a, b) => a.miles - b.miles).slice(0, 2)
    : [];
  const airport = experience.latitude !== null && experience.longitude !== null
    ? nearestKnownAirport(experience.latitude, experience.longitude, airportCode) : null;
  const airportMiles = airport?.miles ?? null;
  const activityLocation = experience.address || (experience.latitude !== null && experience.longitude !== null ? `${experience.latitude},${experience.longitude}` : experience.name);
  const travelers = `${search.adults} adults${search.childrenAges.length ? `, ${search.childrenAges.length} children ages ${search.childrenAges.join(", ")}` : ""}`;
  const visitWindow = `${dateLabel(search.departureDate)} to ${dateLabel(search.returnDate)}`;
  const ticketQuery = encodeURIComponent(`${experience.name} ${experience.address}. Visit ${visitWindow}. ${travelers}.`);
  const viatorUrl = `https://www.viator.com/searchResults/all?text=${ticketQuery}`;
  const getYourGuideUrl = `https://www.getyourguide.com/s/?q=${ticketQuery}`;
  const setDate = (date: string) => {
    setDraftDate(date);
    if (selected) onSelectionChange(experience, { ...selected, date });
  };
  const setSlot = (slot: ExperienceSlot) => {
    setDraftSlot(slot);
    if (selected) onSelectionChange(experience, { ...selected, date: activeDate, slot });
  };
  const setTime = (time: string) => {
    setDraftTime(time);
    if (selected) onSelectionChange(experience, { ...selected, time: time || undefined });
  };
  return <article id={getTripAssistantResultAnchor(experience.kind, experience.id)} tabIndex={-1} className={`experience-card ${selected ? "is-selected" : ""}`}>
    {experience.thumbnail && <img src={experience.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
    <div className="experience-copy"><div className="experience-title"><h4><a href={experience.website || experience.mapsUrl} target="_blank" rel="noreferrer">{experience.name} <ExternalLink size={11}/></a></h4>{experience.rating !== null && <span><Star size={12} fill="currentColor"/> {experience.rating.toFixed(1)}{experience.reviews ? ` · ${experience.reviews.toLocaleString()}` : ""}</span>}</div><p>{experience.category}{experience.address ? ` · ${experience.address}` : ""}</p>{experience.openState && <small>{experience.openState}</small>}{experience.price && <small>{experience.price}</small>}
      {nearbyStays.length > 0 && <div className="experience-distances">{nearbyStays.map(({ hotel, miles }) => {
        const hotelLocation = hotel.address || (hotel.latitude !== null && hotel.longitude !== null ? `${hotel.latitude},${hotel.longitude}` : hotel.name);
        return <span key={hotel.id}>{distanceLabel(miles)} from {hotel.name} (straight-line) <RouteLookup origin={hotelLocation} destination={activityLocation} label="Drive from hotel"/></span>;
      })}</div>}
      {airport && airportMiles !== null && <div className="experience-distances"><span>{airport.name}{!airportCode ? " · nearest listed airport" : ""}: {distanceLabel(airportMiles)} straight-line <RouteLookup origin={airport.name} destination={activityLocation} label="Check drive from airport"/></span></div>}
    </div>
    <div className="experience-actions">
      <label className="experience-schedule-field"><span>Trip day</span><select value={activeDate} onChange={(event) => setDate(event.target.value)}>{days.map((day) => <option value={day.date} key={day.date}>{day.label}</option>)}</select></label>
      <label className="experience-schedule-field"><span>{isRestaurant ? "Meal" : "Time of day"}</span><select value={activeSlot} onChange={(event) => setSlot(event.target.value as ExperienceSlot)}>{(isRestaurant ? ["Lunch", "Dinner"] : ["Morning", "Afternoon", "Evening"]).map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label>
      <label className="experience-schedule-field"><span>{isRestaurant ? "Reservation time · optional" : "Exact start time · optional"}</span><input type="time" value={activeTime} onChange={(event) => setTime(event.target.value)} aria-label={isRestaurant ? `Reservation time for ${experience.name}` : `Start time for ${experience.name}`}/></label>
      <button type="button" className={`selection-button ${selected ? "is-selected" : ""}`} onClick={() => onSelectionChange(experience, selected ? null : { date: activeDate, slot: activeSlot, time: activeTime || undefined })}>{selected ? <><Check size={13}/> Added to trip · Remove</> : isRestaurant ? "Add restaurant" : "Add activity"}</button>
      <small className="experience-time-note">A time you enter is a planning note; Tripfinder does not make or confirm reservations.</small>
      {experience.website && <a href={experience.website} target="_blank" rel="noreferrer" className="text-action">Official site <ArrowUpRight size={12}/></a>}
      <a href={experience.mapsUrl} target="_blank" rel="noreferrer" className="text-action">Open in Maps <ArrowUpRight size={12}/></a>
      {isRestaurant ? null : <><a href={viatorUrl} target="_blank" rel="noreferrer" className="text-action">Search Viator <ArrowUpRight size={12}/></a><a href={getYourGuideUrl} target="_blank" rel="noreferrer" className="text-action">Search GetYourGuide <ArrowUpRight size={12}/></a></>}
    </div>
  </article>;
}

function experienceBookingUrl(experience: LiveExperience): string {
  if (experience.website) return experience.website;
  if (experience.kind === "activity") {
    return `https://www.viator.com/searchResults/all?text=${encodeURIComponent(`${experience.name} ${experience.address}`)}`;
  }
  return experience.mapsUrl;
}

function SelectedTripSummary({ selection, experiences, currency, nights, search, destinationAirportCode }: {
  selection: DestinationSelection;
  experiences: LiveExperience[];
  currency: string;
  nights: number;
  search: TripSearchInput;
  destinationAirportCode: string;
}) {
  const selectedExperiences = experiences.filter((experience) => Boolean(selection.experiences[experience.id]));
  const activities = selectedExperiences.filter((item) => item.kind === "activity");
  const restaurants = selectedExperiences.filter((item) => item.kind === "restaurant");
  const selectedCount = Number(Boolean(selection.outbound)) + Number(Boolean(selection.returnFlight)) + Number(Boolean(selection.hotel)) + selectedExperiences.length;
  if (!selectedCount) return null;
  const hotelUrl = selection.hotel?.providerOffers.find((offer) => offer.url)?.url || selection.hotel?.bookingUrl;
  return <section className="trip-selection-summary" aria-labelledby="trip-selection-summary-title">
    <div className="trip-selection-summary-heading">
      <div><span className="trip-selection-eyebrow">YOUR PLAN</span><h4 id="trip-selection-summary-title">Your trip selections</h4><p>Everything you add appears here. Selections are not bookings.</p></div>
      <div className="trip-selection-stats" aria-label={`${selectedCount} selected items`}>
        {selection.outbound && <span><Plane size={12}/> Flight</span>}
        {selection.hotel && <span><Hotel size={12}/> Stay</span>}
        {selectedExperiences.length > 0 && <span><MapPin size={12}/> {selectedExperiences.length} places</span>}
      </div>
    </div>
    <div className="trip-selection-summary-grid">
      {(selection.outbound || selection.returnFlight) && <article className="trip-selection-card">
        <div className="trip-selection-card-heading"><span className="trip-selection-card-icon"><Plane size={15}/></span><div><strong>Flights</strong><small>{selection.returnFlight ? "Outbound and return selected" : "Outbound selected · return pending"}</small></div></div>
        {selection.outbound && <div className="trip-selection-line">
          <div><b>Outbound · {selection.outbound.from} → {selection.outbound.to}</b><span>{formatFlightTimeInDestination(selection.outbound.departure, selection.outbound.segments[0]?.fromAirportCode, destinationAirportCode)} – {formatFlightTimeInDestination(selection.outbound.arrival, selection.outbound.segments[selection.outbound.segments.length - 1]?.toAirportCode, destinationAirportCode)}</span>{selection.outbound.price !== null && <small>{money(selection.outbound.price, selection.outbound.currency || currency)} displayed outbound fare</small>}</div>
          <a className="trip-selection-view-link" href={`#${getTripAssistantResultAnchor("flight", selection.outbound.id)}`}>View result <ArrowUpRight size={12}/></a>
        </div>}
        {selection.returnFlight && <div className="trip-selection-line">
          <div><b>Return · {selection.returnFlight.from} → {selection.returnFlight.to}</b><span>{formatFlightTimeInDestination(selection.returnFlight.departure, selection.returnFlight.segments[0]?.fromAirportCode, destinationAirportCode)} – {formatFlightTimeInDestination(selection.returnFlight.arrival, selection.returnFlight.segments[selection.returnFlight.segments.length - 1]?.toAirportCode, destinationAirportCode)}</span>{selection.returnFlight.price !== null && <small>{money(selection.returnFlight.price, selection.returnFlight.currency || currency)} displayed return fare</small>}</div>
          <a className="trip-selection-view-link" href={`#${getTripAssistantResultAnchor("flight", selection.returnFlight.id)}`}>View result <ArrowUpRight size={12}/></a>
        </div>}
        {selection.flightSeller && <div className="trip-selection-inline-note">Seller offer: {selection.flightSeller.option.seller} · {selection.flightSeller.option.price !== null ? money(selection.flightSeller.option.price, selection.flightSeller.option.currency || currency) : "Price not supplied"} <BookingContinue option={selection.flightSeller.option}/></div>}
      </article>}
      {selection.hotel && <article className="trip-selection-card">
        <div className="trip-selection-card-heading"><span className="trip-selection-card-icon"><Hotel size={15}/></span><div><strong>Accommodation</strong><small>{nights} nights · {dateShort(search.departureDate)} – {dateShort(search.returnDate)}</small></div></div>
        <div className="trip-selection-line">
          <div><b>{selection.hotel.name}</b><span>{selection.hotel.totalPrice !== null ? `${money(selection.hotel.totalPrice, selection.hotel.currency || currency)} provider-displayed stay total` : selection.hotel.nightlyPrice !== null ? `${money(selection.hotel.nightlyPrice, selection.hotel.currency || currency)} per night · full total not supplied` : "Price not supplied"}</span></div>
          <a className="trip-selection-view-link" href={`#${getTripAssistantStayAnchor(selection.hotel.id)}`}>View stay <ArrowUpRight size={12}/></a>
        </div>
        {hotelUrl && <a className="trip-selection-external-link" href={hotelUrl} target="_blank" rel="noreferrer">Open property / booking details <ExternalLink size={11}/></a>}
      </article>}
      {selectedExperiences.length > 0 && <article className="trip-selection-card trip-selection-places-card">
        <div className="trip-selection-card-heading"><span className="trip-selection-card-icon"><MapPin size={15}/></span><div><strong>Activities & dining</strong><small>{activities.length} activities · {restaurants.length} restaurants</small></div></div>
        <div className="trip-selection-place-list">{selectedExperiences.map((item) => {
          const plan = selection.experiences[item.id]!;
          return <div className="trip-selection-place" key={item.id}>
            <div><b>{item.name}</b><span>{dateShort(plan.date)} · {plan.time ? formatTime(plan.time) : plan.slot}</span></div>
            <div className="trip-selection-place-actions">
              <a className="trip-selection-view-link" href={`#${getTripAssistantResultAnchor(item.kind, item.id)}`}>View result <ArrowUpRight size={12}/></a>
              <a className="trip-selection-external-link" href={experienceBookingUrl(item)} target="_blank" rel="noreferrer">Open link <ExternalLink size={11}/></a>
            </div>
          </div>;
        })}</div>
      </article>}
    </div>
  </section>;
}

function TripCostLedger({ selection, experiences, currency, nights, people, budget, flightRequested, stayRequested, activitiesRequested }: {
  selection: DestinationSelection;
  experiences: LiveExperience[];
  currency: string;
  nights: number;
  people: number;
  budget: number;
  flightRequested: boolean;
  stayRequested: boolean;
  activitiesRequested: boolean;
}) {
  const [groundTransport, setGroundTransport] = useState("");
  const [activityEstimate, setActivityEstimate] = useState("");
  const [diningEstimate, setDiningEstimate] = useState("");
  const [contingencyPercent, setContingencyPercent] = useState("10");
  const selectedExperiences = experiences.filter((experience) => Boolean(selection.experiences[experience.id]));
  const selectedActivities = selectedExperiences.filter((experience) => experience.kind === "activity");
  const selectedRestaurants = selectedExperiences.filter((experience) => experience.kind === "restaurant");
  const parsedContingency = parseCostEstimate(contingencyPercent);
  const invalidContingency = Boolean(contingencyPercent.trim()) && (parsedContingency === null || parsedContingency > 50);
  const ledger = buildTripCostLedger({
    currency,
    nights,
    budget,
    flightRequested,
    stayRequested,
    activitiesRequested,
    outbound: selection.outbound ? { price: selection.outbound.price, currency: selection.outbound.currency } : null,
    returnFlight: selection.returnFlight ? { price: selection.returnFlight.price, currency: selection.returnFlight.currency } : null,
    flightSeller: selection.flightSeller ? { price: selection.flightSeller.option.price, currency: selection.flightSeller.option.currency, seller: selection.flightSeller.option.seller, type: selection.flightSeller.option.type } : null,
    hotel: selection.hotel ? { name: selection.hotel.name, totalPrice: selection.hotel.totalPrice, nightlyPrice: selection.hotel.nightlyPrice, currency: selection.hotel.currency } : null,
    activities: selectedActivities.map((experience) => ({ name: experience.name, price: experience.price })),
    restaurants: selectedRestaurants.map((experience) => ({ name: experience.name, price: experience.price })),
    manual: {
      groundTransport: parseCostEstimate(groundTransport),
      activities: activitiesRequested ? parseCostEstimate(activityEstimate) : null,
      dining: activitiesRequested ? parseCostEstimate(diningEstimate) : null,
    },
    contingencyPercent: invalidContingency || parsedContingency === null ? 0 : parsedContingency,
  });
  const format = (amount: number, code: string) => {
    try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code, maximumFractionDigits: 2 }).format(amount); }
    catch { return `${code} ${amount.toFixed(2)}`; }
  };
  const invalidEstimate = (value: string) => Boolean(value.trim()) && parseCostEstimate(value) === null;
  const selectedCount = Number(Boolean(selection.outbound)) + Number(Boolean(selection.hotel)) + selectedExperiences.length;
  if (!selectedCount) return null;

  return <section className="trip-cost-ledger" aria-labelledby="trip-cost-ledger-title">
    <div className="trip-cost-ledger-heading">
      <div><span className="eyebrow">COST BREAKDOWN</span><h4 id="trip-cost-ledger-title">Your trip cost ledger</h4><p>{people} traveler{people === 1 ? "" : "s"} · {nights} night{nights === 1 ? "" : "s"} · {currency}</p></div>
      <span className="trip-cost-ledger-status">Planning estimate</span>
    </div>
    <div className="trip-cost-ledger-rows">
      {ledger.rows.map((row) => <div className="trip-cost-ledger-row" key={row.id}>
        <div><strong>{row.label}</strong><small>{row.detail}</small></div>
        <div className={`trip-cost-ledger-amount is-${row.status}`}>{row.amount === null ? "Not priced" : format(row.amount, row.currency)}</div>
      </div>)}
    </div>
    <div className="trip-cost-ledger-inputs">
      <label><span>Ground transport · group estimate</span><input type="text" inputMode="decimal" placeholder="e.g. 180" value={groundTransport} onChange={(event) => setGroundTransport(event.target.value)}/>{invalidEstimate(groundTransport) && <small className="trip-cost-input-error">Enter a valid amount (up to two decimal places).</small>}</label>
      {activitiesRequested && <label><span>Activities · group estimate</span><input type="text" inputMode="decimal" placeholder="e.g. 250" value={activityEstimate} onChange={(event) => setActivityEstimate(event.target.value)}/>{invalidEstimate(activityEstimate) && <small className="trip-cost-input-error">Enter a valid amount (up to two decimal places).</small>}</label>}
      {activitiesRequested && <label><span>Food & dining · group estimate</span><input type="text" inputMode="decimal" placeholder="e.g. 400" value={diningEstimate} onChange={(event) => setDiningEstimate(event.target.value)}/>{invalidEstimate(diningEstimate) && <small className="trip-cost-input-error">Enter a valid amount (up to two decimal places).</small>}</label>}
      <label><span>Contingency allowance (%)</span><input type="number" min="0" max="50" step="1" value={contingencyPercent} onChange={(event) => setContingencyPercent(event.target.value)}/><small>Applied only to priced stay totals and estimates entered above.</small>{invalidContingency && <small className="trip-cost-input-error">Use a percentage from 0 to 50.</small>}</label>
    </div>
    <div className="trip-cost-ledger-total">
      <div><span>Priced subtotal</span><strong>{format(ledger.pricedSubtotal, currency)}</strong></div>
      <div><span>Contingency</span><strong>{format(ledger.contingencyAmount, currency)}</strong></div>
      <div className="trip-cost-ledger-grand"><span>Known / entered planning amount</span><strong>{format(ledger.planningTotal, currency)}</strong></div>
      <p>{ledger.remainingBeforeUnpriced >= 0
        ? `${format(ledger.remainingBeforeUnpriced, currency)} of your ${format(budget, currency)} budget remains against the priced items shown. This is not a complete trip total.`
        : `Priced items and entered estimates exceed your ${format(budget, currency)} budget by ${format(Math.abs(ledger.remainingBeforeUnpriced), currency)}, before any unpriced categories.`}</p>
    </div>
    <p className="trip-cost-ledger-disclaimer">Provider display prices are not confirmed bookings. Flight amounts are shown for reference but excluded until the seller confirms the passenger/party basis and a combined fare. Activities and restaurant price text are not converted into totals. Ground transport, activities and dining estimates are optional amounts you enter for the whole group. No currency conversion or taxes/fee assumptions are applied.</p>
  </section>;
}

function selectedExperiencesForDay(date: string, selection: DestinationSelection, experiences: LiveExperience[]) {
  const slotOrder: ExperienceSlot[] = ["Morning", "Lunch", "Afternoon", "Dinner", "Evening"];
  return experiences
    .flatMap((experience) => {
      const plan = selection.experiences[experience.id];
      return plan?.date === date ? [{ experience, plan }] : [];
    })
    .sort((a, b) => slotOrder.indexOf(a.plan.slot) - slotOrder.indexOf(b.plan.slot) || (a.plan.time || "99:99").localeCompare(b.plan.time || "99:99") || a.experience.name.localeCompare(b.experience.name));
}

function TravelTimeline({ search, selection, nights, currency, destinationAirportCode, onUpdateStayTime }: {
  search: TripSearchInput;
  selection: DestinationSelection;
  nights: number;
  currency: string;
  destinationAirportCode: string;
  onUpdateStayTime: (field: "checkInTime" | "checkOutTime", value: string) => void;
}) {
  const hasFlights = search.components.includes("flights");
  const hasStays = search.components.includes("stays");
  const hotel = selection.hotel;
  const stayBookingUrl = hotel?.providerOffers.find((offer) => offer.url)?.url || hotel?.bookingUrl;
  return <div className="itinerary-travel-timeline" aria-label="Travel and accommodation timeline">
    {hasFlights && <>
      <article className={`itinerary-travel-item ${selection.outbound ? "is-confirmed" : "is-pending"}`}>
        <div className="itinerary-travel-date"><span>Outbound flight</span><strong>{dateShort(search.departureDate)}</strong></div>
        <div className="itinerary-travel-copy">
          <strong>{selection.outbound ? `${selection.outbound.from} → ${selection.outbound.to}` : "Select your outbound flight"}</strong>
          <p>{selection.outbound ? `${selection.outbound.airlines.join(" · ")} · Depart ${formatFlightTimeInDestination(selection.outbound.departure, selection.outbound.segments[0]?.fromAirportCode, destinationAirportCode)} · Arrive ${formatFlightTimeInDestination(selection.outbound.arrival, selection.outbound.segments[selection.outbound.segments.length - 1]?.toAirportCode, destinationAirportCode)}.` : "No flight selected yet. Your selected flight and its displayed departure/arrival times will appear here."}</p>
          {selection.outbound && <a className="itinerary-timeline-link" href={`#${getTripAssistantResultAnchor("flight", selection.outbound.id)}`}>View selected flight <ArrowUpRight size={12}/></a>}
        </div>
        <small>{selection.outbound ? "Selected result" : "Needs selection"}</small>
      </article>
    </>}
    {hasStays && <>
      <article className={`itinerary-travel-item ${hotel ? "is-confirmed" : "is-pending"}`}>
        <div className="itinerary-travel-date"><span>Check-in</span><strong>{dateShort(search.departureDate)}</strong></div>
        <div className="itinerary-travel-copy">
          <strong>{hotel ? hotel.name : "Accommodation check-in"}</strong>
          <p>{hotel ? `${nights} ${nights === 1 ? "night" : "nights"}${hotel.totalPrice !== null ? ` · ${money(hotel.totalPrice, hotel.currency || currency)} provider-displayed stay total` : ""}.` : "Select a property to attach it to your trip."}</p>
          {hotel && <div className="itinerary-time-editor"><label><span>Check-in time confirmed by property</span><input type="time" value={selection.checkInTime || ""} onChange={(event) => onUpdateStayTime("checkInTime", event.target.value)}/></label><small>{selection.checkInTime ? `Your note: ${formatTime(selection.checkInTime)} · verify against the property's booking confirmation.` : "Not supplied by the provider. Add the time from your booking confirmation."}</small></div>}
          {hotel && <div className="itinerary-timeline-links"><a className="itinerary-timeline-link" href={`#${getTripAssistantStayAnchor(hotel.id)}`}>View selected stay <ArrowUpRight size={12}/></a>{stayBookingUrl && <a className="itinerary-timeline-link" href={stayBookingUrl} target="_blank" rel="noreferrer">Open property details <ExternalLink size={11}/></a>}</div>}
        </div>
        <small>{hotel ? "Selected property" : "Needs selection"}</small>
      </article>
      <article className={`itinerary-travel-item ${hotel ? "is-confirmed" : "is-pending"}`}>
        <div className="itinerary-travel-date"><span>Check-out</span><strong>{dateShort(search.returnDate)}</strong></div>
        <div className="itinerary-travel-copy">
          <strong>{hotel ? hotel.name : "Accommodation check-out"}</strong>
          <p>{hotel ? `End of your ${nights}-night stay.` : "Your requested stay ends on this date; select a property to attach it to your trip."}</p>
          {hotel && <div className="itinerary-time-editor"><label><span>Check-out time confirmed by property</span><input type="time" value={selection.checkOutTime || ""} onChange={(event) => onUpdateStayTime("checkOutTime", event.target.value)}/></label><small>{selection.checkOutTime ? `Your note: ${formatTime(selection.checkOutTime)} · verify against the property's booking confirmation.` : "Not supplied by the provider. Add the time from your booking confirmation."}</small></div>}
          {hotel && <a className="itinerary-timeline-link" href={`#${getTripAssistantStayAnchor(hotel.id)}`}>View selected stay <ArrowUpRight size={12}/></a>}
        </div>
        <small>{hotel ? "Selected property" : "Needs selection"}</small>
      </article>
    </>}
    {hasFlights && <article className={`itinerary-travel-item ${selection.returnFlight ? "is-confirmed" : "is-pending"}`}>
      <div className="itinerary-travel-date"><span>Return flight</span><strong>{dateShort(search.returnDate)}</strong></div>
      <div className="itinerary-travel-copy">
        <strong>{selection.returnFlight ? `${selection.returnFlight.from} → ${selection.returnFlight.to}` : "Select your return flight"}</strong>
        <p>{selection.returnFlight ? `${selection.returnFlight.airlines.join(" · ")} · Depart ${formatFlightTimeInDestination(selection.returnFlight.departure, selection.returnFlight.segments[0]?.fromAirportCode, destinationAirportCode)} · Arrive ${formatFlightTimeInDestination(selection.returnFlight.arrival, selection.returnFlight.segments[selection.returnFlight.segments.length - 1]?.toAirportCode, destinationAirportCode)}.` : "No return flight selected yet. Select a return leg to add its actual departure and arrival times."}</p>
        {selection.returnFlight && <a className="itinerary-timeline-link" href={`#${getTripAssistantResultAnchor("flight", selection.returnFlight.id)}`}>View selected return <ArrowUpRight size={12}/></a>}
      </div>
      <small>{selection.returnFlight ? "Selected result" : "Needs selection"}</small>
    </article>}
    {hasFlights && <p className="itinerary-travel-note">{destinationTimezoneNotice(search.destination, destinationAirportCode, search.departureDate)} All converted flight times use the destination timezone, including the outbound departure and return journey. Property check-in and check-out times are not returned in the current stay feed; enter them from your booking confirmation. Adding a time here does not create a reservation.</p>}
  </div>;
}

function WeatherPanel({ location, startDate, endDate, configured }: { location: string; startDate: string; endDate: string; configured: boolean }) {
  const [state, setState] = useState<WeatherState | null>(null);
  const attempted = useRef(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysUntilTrip = Math.ceil((new Date(`${startDate}T00:00:00`).getTime() - today.getTime()) / 86400000);
  const load = useCallback(async (forceRefresh = false) => {
    setState((current) => ({ loading: true, status: "loading", days: current?.days ?? [] }));
    try {
      const response = await fetch("/api/travel/weather", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location, startDate, endDate, forceRefresh }) });
      const data = await response.json();
      setState({ loading: false, status: String(data.status || "error"), message: typeof data.message === "string" ? data.message : undefined, days: Array.isArray(data.days) ? data.days as WeatherDay[] : [], attribution: typeof data.attribution === "string" ? data.attribution : undefined });
    } catch { setState({ loading: false, status: "error", message: "Weather information is unavailable right now.", days: [] }); }
  }, [location, startDate, endDate]);
  useEffect(() => {
    if (configured && !attempted.current) { attempted.current = true; void load(); }
  }, [configured, load]);
  return <section className="weather-panel">
    <div className="weather-panel-heading"><div><h4>Weather</h4><p>{location}</p></div>{configured && <button className="text-action" type="button" onClick={() => { attempted.current = true; void load(true); }} disabled={state?.loading}>{state?.loading ? <><RefreshCw size={12} className="spin"/> Checking</> : "Refresh"}</button>}</div>
    {!configured && <p className="weather-explainer">{daysUntilTrip > 2 ? `A day-by-day forecast for ${dateLabel(startDate)} is too far ahead to be dependable. Add WEATHERAPI_API_KEY in Vercel for short-range forecasts, then check again closer to departure. Tripfinder will not substitute a made-up forecast.` : "Live forecasts are not connected. Add WEATHERAPI_API_KEY in Vercel to retrieve the short-range forecast."}</p>}
    {state?.loading && <p className="inline-loading"><RefreshCw size={13} className="spin"/> Checking the forecast…</p>}
    {state?.message && <p className="weather-explainer">{state.message}</p>}
    {state && state.days.length > 0 && <div className="weather-days">{state.days.map((day) => <div className="weather-day" key={day.date}>{day.icon && <img src={`https:${day.icon}`} alt=""/>}<strong>{dateShort(day.date)}</strong><span>{day.condition}</span><b>{day.highF !== null ? `${Math.round(day.highF)}°F` : "—"} <small>{day.lowF !== null ? `${Math.round(day.lowF)}°F` : ""}</small></b>{day.rainChance !== null && <small><CloudRain size={11}/> {day.rainChance}% rain</small>}{day.maxWindKph !== null && <small><Wind size={11}/> {Math.round(day.maxWindKph)} km/h wind</small>}</div>)}</div>}
    {state?.attribution && <p className="weather-attribution">{state.attribution}</p>}
  </section>;
}

export function ResultsWorkspace({ search, recommendations, liveSearchConfigured, providerKeyConfigured, databaseConfigured, weatherKeyConfigured, aiProviderConfigured, geminiProviderConfigured, openRouterProviderConfigured }: Props) {
  const [expanded, setExpanded] = useState<string | null>(recommendations.length === 1 ? recommendations[0]?.destination.id ?? null : null);
  const [states, setStates] = useState<Record<string, SearchState>>({});
  const [returnStates, setReturnStates] = useState<Record<string, ReturnState>>({});
  const [bookingStates, setBookingStates] = useState<Record<string, BookingState>>({});
  const [hotelBookingStates, setHotelBookingStates] = useState<Record<string, HotelBookingState>>({});
  const [selections, setSelections] = useState<Record<string, DestinationSelection>>({});
  const [flightAirlineFilters, setFlightAirlineFilters] = useState<Record<string, string>>({});
  const people = search.adults + search.childrenAges.length;
  const nights = Math.max(1, Math.round((new Date(`${search.returnDate}T00:00:00Z`).getTime() - new Date(`${search.departureDate}T00:00:00Z`).getTime()) / 86400000));
  const totalBudget = search.budgetMode === "per_person" ? search.budget * people : search.budget;
  const perPersonDaily = useMemo(() => totalBudget / Math.max(1, nights * people), [totalBudget, nights, people]);
  const singleDestination = recommendations.length === 1;

  async function checkLiveOffers(recommendation: TripRecommendation, forceRefresh = false) {
    const id = recommendation.destination.id;
    setExpanded(id);
    setStates((current) => ({ ...current, [id]: { loading: true, error: "", result: current[id]?.result ?? null } }));
    try {
      const response = await fetch("/api/travel/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search, destinationName: formatDestinationLabel(recommendation.destination.city, recommendation.destination.country), destinationAirportCode: search.destinationAirportCode || recommendation.destination.airportCode, forceRefresh }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to search this trip right now.");
      setStates((current) => ({ ...current, [id]: { loading: false, error: "", result: data as LiveTravelSearchResult } }));
    } catch (error) {
      setStates((current) => ({ ...current, [id]: { loading: false, error: error instanceof Error ? error.message : "Travel search failed.", result: current[id]?.result ?? null } }));
    }
  }

  useEffect(() => {
    if (singleDestination && liveSearchConfigured && !states[recommendations[0].destination.id]) checkLiveOffers(recommendations[0]);
    // Auto-run only for one explicitly selected destination. "Anywhere" never fans out API calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [singleDestination, liveSearchConfigured]);

  async function loadReturnFlights(outbound: LiveFlight, destinationAirportCode: string) {
    if (!outbound.departureToken) return;
    setReturnStates((current) => ({ ...current, [outbound.id]: { loading: true, error: "", result: current[outbound.id]?.result ?? null } }));
    try {
      const response = await fetch("/api/travel/return-flights", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search, destinationAirportCode, departureToken: outbound.departureToken }) });
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
      const response = await fetch("/api/travel/booking-options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingToken: flight.bookingToken, search, destinationAirportCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not retrieve seller links.");
      setBookingStates((current) => ({ ...current, [flight.id]: { loading: false, error: "", options: Array.isArray(data.options) ? data.options as FlightBookingOption[] : [] } }));
    } catch (error) {
      setBookingStates((current) => ({ ...current, [flight.id]: { loading: false, error: error instanceof Error ? error.message : "Seller lookup failed.", options: current[flight.id]?.options ?? null } }));
    }
  }

  async function loadHotelOptions(hotel: LiveHotel) {
    if (!hotel.propertyToken) return;
    setHotelBookingStates((current) => ({ ...current, [hotel.id]: { loading: true, error: "", options: current[hotel.id]?.options ?? null } }));
    try {
      const response = await fetch("/api/travel/hotel-options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyToken: hotel.propertyToken, search }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not retrieve property booking options.");
      setHotelBookingStates((current) => ({ ...current, [hotel.id]: { loading: false, error: "", options: Array.isArray(data.offers) ? data.offers as HotelBookingOption[] : [] } }));
    } catch (error) {
      setHotelBookingStates((current) => ({ ...current, [hotel.id]: { loading: false, error: error instanceof Error ? error.message : "Hotel booking lookup failed.", options: current[hotel.id]?.options ?? null } }));
    }
  }

  function updateSelection(destinationId: string, updater: (current: DestinationSelection) => DestinationSelection) {
    setSelections((current) => ({
      ...current,
      [destinationId]: updater(current[destinationId] ?? emptySelection()),
    }));
  }

  function selectOutbound(destinationId: string, flight: LiveFlight, destinationAirportCode: string) {
    const alreadySelected = selections[destinationId]?.outbound?.id === flight.id;
    updateSelection(destinationId, (current) => ({ ...current, outbound: alreadySelected ? null : flight, returnFlight: null, flightSeller: null }));
    if (!alreadySelected) void loadReturnFlights(flight, destinationAirportCode);
  }

  function selectFlightSeller(destinationId: string, flight: LiveFlight, option: FlightBookingOption) {
    updateSelection(destinationId, (current) => ({ ...current, flightSeller: { flightId: flight.id, option } }));
  }

  function selectReturn(destinationId: string, flight: LiveFlight) {
    updateSelection(destinationId, (current) => ({
      ...current,
      returnFlight: current.returnFlight?.id === flight.id ? null : flight,
      flightSeller: null,
    }));
  }

  function selectHotel(destinationId: string, hotel: LiveHotel) {
    updateSelection(destinationId, (current) => ({
      ...current,
      hotel: current.hotel?.id === hotel.id ? null : hotel,
      checkInTime: undefined,
      checkOutTime: undefined,
    }));
  }

  function updateExperienceSelection(destinationId: string, experience: LiveExperience, plan: SelectedExperience | null) {
    updateSelection(destinationId, (current) => {
      const next = { ...current.experiences };
      if (plan) next[experience.id] = plan;
      else delete next[experience.id];
      return { ...current, experiences: next };
    });
  }

  const requestedLabels = search.components.map((component) => component === "flights" ? "Flights" : component === "stays" ? (search.stayTypes.includes("vacation_rentals") && search.stayTypes.includes("hotels") ? "Hotels and vacation rentals" : search.stayTypes.includes("vacation_rentals") ? "Vacation rentals" : "Hotels") : "Things to do");

  const assistantRecommendation = recommendations.find((item) => item.destination.id === expanded)
    ?? recommendations.find((item) => Boolean(states[item.destination.id]?.result))
    ?? null;
  const assistantResult = assistantRecommendation ? states[assistantRecommendation.destination.id]?.result ?? null : null;
  const assistantSelection = assistantRecommendation ? selections[assistantRecommendation.destination.id] ?? emptySelection() : emptySelection();
  const assistantExperiences = assistantResult?.experiences ?? [];
  // Send balanced place categories and retain the selected property even when it
  // is beyond the first page of provider results. The assistant needs both the
  // restaurant and attraction coordinates to answer proximity questions.
  const assistantStayRows = assistantResult
    ? [...(assistantSelection.hotel ? [assistantSelection.hotel] : []), ...assistantResult.hotels.filter((hotel) => hotel.id !== assistantSelection.hotel?.id)].slice(0, 14)
    : [];
  const assistantExperienceRows = [
    ...assistantExperiences.filter((experience) => experience.kind === "activity").slice(0, 20),
    ...assistantExperiences.filter((experience) => experience.kind === "restaurant").slice(0, 20),
  ];
  const assistantContext: TripAssistantContext | null = assistantRecommendation && assistantResult ? {
    destination: formatDestinationLabel(assistantRecommendation.destination.city, assistantRecommendation.destination.country),
    currency: search.currency,
    budget: totalBudget,
    departureDate: search.departureDate,
    returnDate: search.returnDate,
    adults: search.adults,
    childrenAges: search.childrenAges,
    rooms: search.rooms,
    preferences: {
      tripStyle: search.style,
      mustHave: search.stayMustHaveAmenities.map((item) => STAY_AMENITY_LABELS[item] ?? item),
      prefer: search.stayPreferredAmenities.map((item) => STAY_AMENITY_LABELS[item] ?? item),
      preferredLayoverCountries: search.preferredLayoverCountries,
      avoidedLayoverCountries: search.avoidLayoverCountries,
    },
    flights: assistantResult.flights.slice(0, 8).map((flight) => {
      const targetAirport = search.destinationAirportCode || assistantRecommendation.destination.airportCode;
      return {
        id: flight.id, airline: flight.airlines.join(" / "), from: flight.from, to: flight.to,
        departure: formatFlightTimeInDestination(flight.departure, flight.segments[0]?.fromAirportCode, targetAirport),
        arrival: formatFlightTimeInDestination(flight.arrival, flight.segments[flight.segments.length - 1]?.toAirportCode, targetAirport),
        price: flight.price, stops: flight.stops,
        segments: flight.segments.map((segment) => ({
          airline: segment.airline, flightNumber: segment.flightNumber, from: segment.from, to: segment.to,
          departure: formatFlightTimeInDestination(segment.departure, segment.fromAirportCode, targetAirport),
          arrival: formatFlightTimeInDestination(segment.arrival, segment.toAirportCode, targetAirport),
        })),
      };
    }),
    stays: assistantStayRows.map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      externalUrl: hotel.bookingUrl || `https://www.google.com/travel/hotels?q=${encodeURIComponent(`${hotel.name} ${hotel.address ?? ""}`)}`,
      externalUrlLabel: hotel.bookingUrl ? "Open booking listing" : "Search property on Google Hotels",
      source: hotel.source, propertyType: hotel.propertyType, spaceType: hotel.spaceType,
      amenities: hotel.amenities.map((item) => STAY_AMENITY_LABELS[item as StayAmenity] ?? item),
      description: hotel.description ?? "", address: hotel.address ?? "",
      essentialInfo: hotel.essentialInfo ?? [], excludedAmenities: hotel.excludedAmenities ?? [],
      latitude: hotel.latitude, longitude: hotel.longitude,
      nearbyPlaces: (hotel.nearbyPlaces ?? []).slice(0, 8).map((place) => ({
        name: place.name, category: place.category,
        transportations: (place.transportations ?? []).slice(0, 2).map((transport) => ({ type: transport.type, duration: transport.duration })),
      })),
      totalPrice: hotel.totalPrice, nightlyPrice: hotel.nightlyPrice, rating: hotel.rating, reviews: hotel.reviews,
    })),
    experiences: assistantExperienceRows.map((experience) => ({
      id: experience.id, kind: experience.kind, name: experience.name,
      externalUrl: experience.website || experience.mapsUrl,
      externalUrlLabel: experience.website ? "Open official site" : "Open in Maps",
      category: experience.category, address: experience.address, rating: experience.rating, price: experience.price ?? "",
      latitude: experience.latitude, longitude: experience.longitude,
    })),
    selected: {
      outboundFlight: assistantSelection.outbound ? `${assistantSelection.outbound.airlines.join(" / ")} · ${formatFlightTimeInDestination(assistantSelection.outbound.departure, assistantSelection.outbound.segments[0]?.fromAirportCode, search.destinationAirportCode || assistantRecommendation.destination.airportCode)} → ${formatFlightTimeInDestination(assistantSelection.outbound.arrival, assistantSelection.outbound.segments[assistantSelection.outbound.segments.length - 1]?.toAirportCode, search.destinationAirportCode || assistantRecommendation.destination.airportCode)} · ${assistantSelection.outbound.from} → ${assistantSelection.outbound.to}` : undefined,
      returnFlight: assistantSelection.returnFlight ? `${assistantSelection.returnFlight.airlines.join(" / ")} · ${formatFlightTimeInDestination(assistantSelection.returnFlight.departure, assistantSelection.returnFlight.segments[0]?.fromAirportCode, search.destinationAirportCode || assistantRecommendation.destination.airportCode)} → ${formatFlightTimeInDestination(assistantSelection.returnFlight.arrival, assistantSelection.returnFlight.segments[assistantSelection.returnFlight.segments.length - 1]?.toAirportCode, search.destinationAirportCode || assistantRecommendation.destination.airportCode)} · ${assistantSelection.returnFlight.from} → ${assistantSelection.returnFlight.to}` : undefined,
      stay: assistantSelection.hotel?.name,
      stayId: assistantSelection.hotel?.id,
      schedule: Object.entries(assistantSelection.experiences).flatMap(([experienceId, plan]) => {
        const experience = assistantExperiences.find((item) => item.id === experienceId);
        return experience ? [{ name: experience.name, kind: experience.kind, date: plan.date, slot: plan.slot }] : [];
      }).slice(0, 16),
    },
  } : null;

  return <div className="planner-results-workspace">
    <div className="results-overview-bar">
      <div><small>Budget</small><strong>{money(totalBudget, search.currency)}</strong><span>{search.budgetMode === "total" ? "for the whole group" : "per traveler"}</span></div>
      <div><small>Dates</small><strong>{dateLabel(search.departureDate)} – {dateLabel(search.returnDate)}</strong><span>{nights} nights</span></div>
      <div><small>Travelers</small><strong>{people}</strong><span>{search.adults} adults{search.childrenAges.length ? ` · ${search.childrenAges.length} children` : ""}</span></div>
      <div><small>Daily budget</small><strong>{money(perPersonDaily, search.currency)}</strong><span>per person / day</span></div>
    </div>

    {!liveSearchConfigured && <div className="live-setup-note"><ShieldAlert size={17}/><div><strong>Live search is not connected</strong><p>{!providerKeyConfigured ? "Add SERPAPI_API_KEY in Vercel. " : ""}{!databaseConfigured ? "Add DATABASE_URL for the Neon cache and shared usage limits." : ""}</p></div></div>}

    {search.flexibleDays > 0 && <p className="accuracy-note"><Clock3 size={13}/> Date flexibility is stored as a preference; live searches currently use the exact dates entered.</p>}
    {search.rooms > 1 && search.components.includes("stays") && <p className="accuracy-note">Room count is shown in your request. Confirm the exact room allocation with the property before booking.</p>}

    <div className="planner-results-list">
      {recommendations.map((recommendation, index) => {
        const destination = recommendation.destination;
        const state = states[destination.id];
        const selection = selections[destination.id] ?? emptySelection();
        const resultExperiences = state?.result?.experiences ?? [];
        const itineraryDates = recommendation.itinerary.map((day, dayIndex) => ({ date: day.date, label: `Day ${dayIndex + 1} · ${dateShort(day.date)}` }));
        const hasActivityPlanning = search.components.includes("activities");
        const scheduledDays = recommendation.itinerary
          .map((day) => ({ day, items: selectedExperiencesForDay(day.date, selection, resultExperiences) }))
          .filter((entry) => entry.items.length > 0);
        const activityExperiences = resultExperiences.filter((item) => item.kind === "activity");
        const restaurantExperiences = resultExperiences.filter((item) => item.kind === "restaurant");
        const availableAirlines: string[] = Array.from(new Set<string>((state?.result?.flights ?? []).reduce<string[]>((names, flight) => names.concat(flight.airlines), []))).sort((a, b) => a.localeCompare(b));
        const selectedAirline = flightAirlineFilters[destination.id] ?? "all";
        const visibleFlights = selectedAirline === "all" ? (state?.result?.flights ?? []) : (state?.result?.flights ?? []).filter((flight) => flight.airlines.includes(selectedAirline));
        const isExpanded = expanded === destination.id;
        const airportCode = search.destinationAirportCode || destination.airportCode;
        const destinationLabel = formatDestinationLabel(destination.city, destination.country);
        const directFlightUrl = new URL("https://www.google.com/travel/flights");
        const originCode = search.originAirportCode || search.origin;
        const arrivalCode = search.destinationAirportCode || destination.airportCode || destinationLabel;
        const childrenText = search.childrenAges.length ? `, ${search.childrenAges.length} children ages ${search.childrenAges.join(", ")}` : "";
        const stopsText = search.stops === "any" ? "any stops" : search.stops === "nonstop" ? "nonstop only" : search.stops === "one_stop" ? "up to 1 stop" : "up to 2 stops";
        directFlightUrl.searchParams.set("q", `Flights from ${originCode} to ${arrivalCode} on ${search.departureDate} through ${search.returnDate}, ${search.adults} adults${childrenText}, ${search.cabinClass.replaceAll("_", " ")} class, ${stopsText}`);
        directFlightUrl.searchParams.set("curr", search.currency);
        directFlightUrl.searchParams.set("hl", "en");
        directFlightUrl.searchParams.set("gl", "us");

        return <motion.article className={`planner-destination-card ${isExpanded ? "is-expanded" : ""}`} key={destination.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: index * 0.035 }}>
          <div className="planner-destination-body">
            <div className="planner-destination-heading"><div>{destination.country && normalizeDestinationQuery(destination.country) !== normalizeDestinationQuery(destination.city) && <span className="planner-country">{destination.country}</span>}<h3>{destination.city}</h3><p>{destination.summary}</p>{recommendation.typicalDaytimeHighF !== null ? <p className="planner-climate-note">Typical daytime high for these dates: <strong>{Math.round(search.temperatureUnit === "C" ? (recommendation.typicalDaytimeHighF - 32) * 5 / 9 : recommendation.typicalDaytimeHighF)}°{search.temperatureUnit}</strong> <span>· monthly climate average, not a forecast</span></p> : (search.temperatureMin !== null || search.temperatureMax !== null) ? <p className="planner-climate-note">No monthly temperature baseline is available for this location, so your temperature range could not be checked.</p> : null}</div>{airportCode && <span className="planner-airport">{airportCode}</span>}</div>
            <div className="planner-highlights">{destination.highlights.slice(0, 3).map((highlight) => <span key={highlight}>{highlight}</span>)}</div>
            <div className="planner-actions">
              {search.components.includes("flights") && <a className="planner-outbound-link" href={state?.result?.providerSearchLinks?.flights || recommendation.flightSearchUrl} target="_blank" rel="noreferrer"><Plane size={14}/> Flights <ArrowUpRight size={12}/></a>}
              {search.components.includes("stays") && search.stayTypes.includes("hotels") && <a className="planner-outbound-link" href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer"><Hotel size={14}/> Hotels · {nights} nights <ArrowUpRight size={12}/></a>}
              {search.components.includes("stays") && search.stayTypes.includes("vacation_rentals") && <a className="planner-outbound-link" href={recommendation.vacationRentalSearchUrl} target="_blank" rel="noreferrer"><Hotel size={14}/> Rentals · {nights} nights <ArrowUpRight size={12}/></a>}
              {search.components.includes("activities") && <a className="planner-outbound-link" href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer"><Activity size={14}/> Things to do · {nights} days <ArrowUpRight size={12}/></a>}
              <button className="text-action" type="button" onClick={() => setExpanded(isExpanded ? null : destination.id)} aria-expanded={isExpanded}>{isExpanded ? "Hide schedule" : hasActivityPlanning ? "Trip schedule" : "Travel timeline"}</button>
            </div>

            {liveSearchConfigured && <div className="live-search-action"><button type="button" className="live-search-button" disabled={state?.loading} onClick={() => checkLiveOffers(recommendation, Boolean(state?.result))}>{state?.loading ? <><RefreshCw size={14} className="spin"/> {state?.result ? "Refreshing selected categories…" : "Searching selected categories…"}</> : state?.result ? <><RefreshCw size={14}/> Refresh results</> : `Search ${requestedLabels.join(" + ")}`}</button>{!singleDestination && <span>Only the destination you open is searched. Other recommendations do not use API requests until selected.</span>}<span>Identical searches use the shared Neon cache. Refresh bypasses Tripfinder’s saved results and may use a provider search. The provider may still return its own cached data.</span></div>}
            {state?.error && <div className="provider-error" role="alert">{state.error}</div>}
            {state?.loading && <div className="search-loading-panel"><span className="loading-line"/><span className="loading-line short"/><p>Checking current travel options for {destination.city}…</p></div>}

            {state?.result && <div className="live-search-results">
              <div className="live-result-heading"><div><h4>Travel options for {destination.city}</h4><p>Checked {new Date(state.result.checkedAt).toLocaleString()} · {resultSourceLabel(state.result)}</p></div><span className={`result-status result-status-${state.result.status}`}>{state.result.status === "live" ? "Search complete" : state.result.status === "partial" ? "Some categories returned no results" : "No provider results"}</span></div>
              {state.result.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}
              {state.result.cacheSummary?.length > 0 && <div className="cache-freshness-list" aria-label="Search result freshness">{state.result.cacheSummary.map((entry) => <span className={`cache-freshness cache-${entry.status}`} key={entry.key}><strong>{entry.label}</strong>{entry.status === "live" ? "Live" : entry.status === "cached" ? "Cached" : "Saved fallback"} · {cacheAgeLabel(entry.fetchedAt)}</span>)}</div>}

              {search.components.includes("flights") && <details className="live-result-group" open>
                <summary className="live-result-group-summary"><Plane size={17}/><strong>Flights</strong><span>{state.result.flights.length} outbound options{selection.outbound ? " · 1 selected" : ""}{selection.returnFlight ? " + return selected" : ""}</span><ChevronDown size={16} className="group-chevron"/></summary>
                <p className="flight-timezone-note">{destinationTimezoneNotice(destinationLabel, airportCode, search.departureDate)}</p>
                {state.result.flights.length ? <>{state.result.providerSearchLinks?.flights && <p className="provider-search-link"><a href={state.result.providerSearchLinks.flights} target="_blank" rel="noreferrer">Open this exact search in Google Flights <ArrowUpRight size={12}/></a></p>}{availableAirlines.length > 1 && <div className="airline-filter" aria-label="Filter outbound flights by airline"><span>Airline</span><button type="button" className={selectedAirline === "all" ? "is-active" : ""} onClick={() => setFlightAirlineFilters((current) => ({ ...current, [destination.id]: "all" }))}>All ({state.result.flights.length})</button>{availableAirlines.map((airline) => <button type="button" key={airline} className={selectedAirline === airline ? "is-active" : ""} onClick={() => setFlightAirlineFilters((current) => ({ ...current, [destination.id]: airline }))}>{airline} ({state.result!.flights.filter((flight) => flight.airlines.includes(airline)).length})</button>)}</div>}{visibleFlights.map((flight) => <FlightResult key={flight.id} flight={flight} currency={search.currency} destinationAirportCode={airportCode} returnState={returnStates[flight.id]} bookingStates={bookingStates} selectedOutbound={selection.outbound?.id === flight.id} selectedReturnFlight={selection.outbound?.id === flight.id ? selection.returnFlight : null} selectedSeller={selection.flightSeller} onSelectOutbound={(selected) => selectOutbound(destination.id, selected, airportCode)} onSelectReturn={(selected) => selectReturn(destination.id, selected)} onLoadBookingOptions={(selected) => loadBookingOptions(selected, airportCode)} onSelectSeller={(selectedFlight, option) => selectFlightSeller(destination.id, selectedFlight, option)}/>)}</> : <div className="empty-category"><p>No flight options were returned for this route and date combination.</p><a href={state.result.providerSearchLinks?.flights || directFlightUrl.toString()} target="_blank" rel="noreferrer">Search this route on Google Flights <ArrowUpRight size={12}/></a><small>The link uses the route and dates submitted to the provider. You can adjust passenger or fare details on Google Flights if needed.</small></div>}
              </details>}

              {search.components.includes("stays") && <details className="live-result-group" open>
                <summary className="live-result-group-summary"><Hotel size={17}/><strong>Places to stay</strong><span>{state.result.hotels.length} properties{selection.hotel ? " · 1 selected" : ""}</span><ChevronDown size={16} className="group-chevron"/></summary>
                {state.result.hotels.length ? state.result.hotels.map((hotel) => <HotelResult key={hotel.id} hotel={hotel} currency={search.currency} airportCode={airportCode} experiences={state.result!.experiences} nights={nights} search={search} bookingState={hotelBookingStates[hotel.id]} selected={selection.hotel?.id === hotel.id} onSelect={(selected) => selectHotel(destination.id, selected)} onLoadBookingOptions={loadHotelOptions}/>) : <div className="empty-category"><p>No properties were returned for these dates and guest details.</p><a href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer">Open the stay search <ArrowUpRight size={12}/></a></div>}
              </details>}

              {search.components.includes("activities") && <>
                <details className="live-result-group" open><summary className="live-result-group-summary"><Activity size={17}/><strong>Activities & attractions</strong><span>{activityExperiences.length} options · {Object.keys(selection.experiences).filter((id) => state.result!.experiences.some((item) => item.id === id && item.kind === "activity")).length} selected</span><ChevronDown size={16} className="group-chevron"/></summary>
                  {activityExperiences.length ? activityExperiences.map((experience) => <ExperienceResult key={experience.id} experience={experience} hotels={state.result!.hotels} airportCode={airportCode} search={search} days={itineraryDates} selected={selection.experiences[experience.id]} onSelectionChange={(item, plan) => updateExperienceSelection(destination.id, item, plan)}/>) : <div className="empty-category"><p>No activity results were returned for this destination.</p><div className="empty-category-links"><a href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer">Search Viator <ArrowUpRight size={12}/></a><a href={`https://www.getyourguide.com/s/?q=${encodeURIComponent(`Things to do in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search GetYourGuide <ArrowUpRight size={12}/></a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Attractions in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search Maps <ArrowUpRight size={12}/></a></div></div>}
                </details>
                <details className="live-result-group" open><summary className="live-result-group-summary"><Users size={17}/><strong>Restaurants & dining</strong><span>{restaurantExperiences.length} options · {Object.keys(selection.experiences).filter((id) => state.result!.experiences.some((item) => item.id === id && item.kind === "restaurant")).length} selected</span><ChevronDown size={16} className="group-chevron"/></summary>
                  {restaurantExperiences.length ? restaurantExperiences.map((experience) => <ExperienceResult key={experience.id} experience={experience} hotels={state.result!.hotels} airportCode={airportCode} search={search} days={itineraryDates} selected={selection.experiences[experience.id]} onSelectionChange={(item, plan) => updateExperienceSelection(destination.id, item, plan)}/>) : <div className="empty-category"><p>No restaurant results were returned. Open Maps to search current dining options in this destination.</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Restaurants in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search restaurants in Maps <ArrowUpRight size={12}/></a></div>}
                </details>
              </>}
              <SelectedTripSummary selection={selection} experiences={state.result.experiences} currency={search.currency} nights={nights} search={search} destinationAirportCode={airportCode}/>
              <TripCostLedger selection={selection} experiences={state.result.experiences} currency={search.currency} nights={nights} people={people} budget={totalBudget} flightRequested={search.components.includes("flights")} stayRequested={search.components.includes("stays")} activitiesRequested={search.components.includes("activities")}/>
              <WeatherPanel location={destinationLabel} startDate={search.departureDate} endDate={search.returnDate} configured={weatherKeyConfigured}/>
              <p className="provider-disclaimer">Provider results are snapshots, not reservations. Confirm the room or passenger mix, taxes, baggage, cancellation terms and final price with the seller.</p>
            </div>}

            {isExpanded && <div className="itinerary-panel">
              <div className="itinerary-panel-heading">
                <div><h4>{hasActivityPlanning ? "Your trip schedule" : "Travel timeline"}</h4></div>
                <p>{hasActivityPlanning ? "Only activities and restaurants you add are scheduled here." : "Selected flight and accommodation details only. No activities or meals are generated."}</p>
              </div>

              {(search.components.includes("flights") || search.components.includes("stays")) && <TravelTimeline search={search} selection={selection} nights={nights} currency={search.currency} destinationAirportCode={airportCode} onUpdateStayTime={(field, value) => updateSelection(destination.id, (current) => ({ ...current, [field]: value || undefined }))}/>}

              {hasActivityPlanning && <section className="itinerary-selected-schedule">
                <h5>Activities and dining you selected</h5>
                {scheduledDays.length ? <div className="itinerary-days">{scheduledDays.map(({ day, items }) => <div className="itinerary-day" key={day.date}>
                  <div className="itinerary-day-date"><span>{day.label}</span><strong>{dateLabel(day.date)}</strong></div>
                  <div className="itinerary-activities">{items.map(({ experience, plan }) => <div className={`itinerary-activity ${experience.kind === "restaurant" ? "is-meal" : ""}`} key={`${day.date}-${experience.id}`}>
                    <span>{plan.time ? formatTime(plan.time) : plan.slot}</span>
                    <div><strong><a className="itinerary-selected-link" href={`#${getTripAssistantResultAnchor(experience.kind, experience.id)}`}>{experience.name} <ArrowUpRight size={11}/></a></strong><p>{[experience.category, experience.address].filter(Boolean).join(" · ") || "Check current opening hours and booking details."}</p><div className="itinerary-activity-actions"><a href={experienceBookingUrl(experience)} target="_blank" rel="noreferrer">Open listing <ExternalLink size={10}/></a><label><span>{experience.kind === "restaurant" ? "Reservation time" : "Start time"}</span><input type="time" value={plan.time || ""} onChange={(event) => updateExperienceSelection(destination.id, experience, { ...plan, time: event.target.value || undefined })}/></label></div><small className="itinerary-time-note">Your schedule only · this does not confirm a booking or reservation.</small></div>
                    <small>{experience.kind === "restaurant" ? "Selected restaurant" : "Selected activity"}</small>
                  </div>)}</div>
                </div>)}</div> : <div className="itinerary-empty-state">No activities or restaurants have been added to your schedule yet. Choose a result above, select its trip day and time slot, then press Add to trip. Only those selections will appear here.</div>}
              </section>}
            </div>}
          </div>
        </motion.article>;
      })}
    </div>

    {assistantContext && assistantRecommendation && <AITripAssistant key={assistantRecommendation.destination.id} context={assistantContext} configured={aiProviderConfigured && databaseConfigured} databaseAvailable={databaseConfigured} geminiAvailable={geminiProviderConfigured} openRouterAvailable={openRouterProviderConfigured}/>}

    <div className="planner-method-note"><p><strong>How to read these results.</strong> Flights, properties and places come from the selected providers. Straight-line distances are geographic estimates, not driving times. Weather is only shown when the forecast provider can cover the requested dates. Confirm final terms with the booking provider.</p></div>
  </div>;
}
