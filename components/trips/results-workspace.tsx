"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, ExternalLink, Hotel, MapPin, Plane, RefreshCw, ShieldAlert, Star, Users, Wallet, Wind, CloudRain } from "lucide-react";
import type { FlightBookingOption, HotelBookingOption, LiveExperience, LiveFlight, LiveHotel, LiveTravelSearchResult, ReturnFlightSearchResult } from "@/lib/providers/serpapi";
import type { ItineraryDay, TripRecommendation, TripSearchInput } from "@/lib/trip-planner/types";
import { formatDestinationLabel, normalizeDestinationQuery } from "@/lib/trip-planner/destinations";
import { AIRPORT_COORDINATES } from "@/lib/trip-planner/location-suggestions";

type Props = {
  search: TripSearchInput;
  recommendations: TripRecommendation[];
  liveSearchConfigured: boolean;
  providerKeyConfigured: boolean;
  databaseConfigured: boolean;
  weatherKeyConfigured: boolean;
};
type SearchState = { loading: boolean; error: string; result: LiveTravelSearchResult | null };
type ReturnState = { loading: boolean; error: string; result: ReturnFlightSearchResult | null };
type BookingState = { loading: boolean; error: string; options: FlightBookingOption[] | null };
type HotelBookingState = { loading: boolean; error: string; options: HotelBookingOption[] | null };
type WeatherDay = { date: string; condition: string; icon: string; highC: number | null; lowC: number | null; highF: number | null; lowF: number | null; rainChance: number | null; maxWindKph: number | null; uv: number | null };
type WeatherState = { loading: boolean; status: string; message?: string; days: WeatherDay[]; attribution?: string };
type RouteState = { loading: boolean; error?: string; distance?: string; duration?: string; durationInTraffic?: string };
type ExperienceSlot = "Morning" | "Lunch" | "Afternoon" | "Dinner" | "Evening";
type SelectedExperience = { date: string; slot: ExperienceSlot };
type SelectedFlightSeller = { flightId: string; option: FlightBookingOption };
type DestinationSelection = {
  outbound: LiveFlight | null;
  returnFlight: LiveFlight | null;
  flightSeller: SelectedFlightSeller | null;
  hotel: LiveHotel | null;
  experiences: Record<string, SelectedExperience>;
};
const emptySelection = (): DestinationSelection => ({ outbound: null, returnFlight: null, flightSeller: null, hotel: null, experiences: {} });

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const duration = (minutes: number | null) => minutes === null ? "Duration not listed" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const dateShort = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

function haversineMiles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(bLat - aLat); const dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function distanceLabel(miles: number): string { return miles < 0.2 ? "under 0.2 mi" : `${miles.toFixed(1)} mi`; }
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

function ReturnOptions({ state, onSelectReturn, selectedReturnId, currency }: {
  state?: ReturnState;
  onSelectReturn: (flight: LiveFlight) => void;
  selectedReturnId?: string;
  currency: string;
}) {
  if (!state) return null;
  return <div className="return-options-panel">
    <div className="return-options-heading"><strong>Choose your return flight</strong>{state.result && <small>Checked {new Date(state.result.dataAsOf).toLocaleString()}</small>}</div>
    <p className="return-seller-note">Choose a return leg first. Seller comparison then checks booking options for the complete outbound + return itinerary.</p>
    {state.loading && <p className="inline-loading"><RefreshCw size={13} className="spin"/> Matching return legs to this outbound flight…</p>}
    {state.error && <p className="provider-inline-error">{state.error}</p>}
    {state.result?.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}
    {state.result?.flights.map((flight) => <div className={`return-flight-option ${selectedReturnId === flight.id ? "is-selected" : ""}`} key={flight.id}>
      <div className="return-flight-copy"><strong>{flight.departure} <span>→</span> {flight.arrival}</strong><small>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</small><small>{flight.from} → {flight.to}</small></div>
      <div className="return-flight-action">{flight.price !== null && <strong>{money(flight.price, flight.currency || currency)}</strong>}
        <button type="button" className={`selection-button ${selectedReturnId === flight.id ? "is-selected" : ""}`} onClick={() => onSelectReturn(flight)}>{selectedReturnId === flight.id ? <><Check size={13}/> Return selected · Remove</> : "Select return"}</button>
      </div>
    </div>)}
    {state.result && state.result.flights.length === 0 && <p className="empty-inline">No return options matched this outbound selection.</p>}
  </div>;
}

function FlightResult({ flight, currency, returnState, bookingStates, selectedOutbound, selectedReturnFlight, selectedSeller, onSelectOutbound, onSelectReturn, onLoadBookingOptions, onSelectSeller }: {
  flight: LiveFlight;
  currency: string;
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
  return <article className={`live-offer-card ${selectedOutbound ? "is-selected" : ""}`}>
    <div className="live-offer-main"><div className="live-offer-route"><strong>{flight.departure}</strong><span>→</span><strong>{flight.arrival}</strong></div><p>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</p><small>{flight.from} → {flight.to}</small></div>
    <div className="live-offer-price">{flight.price !== null ? <strong>{money(flight.price, flight.currency || currency)}</strong> : <strong>Price not supplied</strong>}<small>Google Flights displayed outbound price; confirm the full round-trip fare with seller</small>
      <button className={`selection-button ${selectedOutbound ? "is-selected" : ""}`} type="button" disabled={returnState?.loading} onClick={() => onSelectOutbound(flight)}>{returnState?.loading && selectedOutbound ? <><RefreshCw size={12} className="spin"/> Finding returns</> : selectedOutbound ? <><Check size={13}/> Outbound selected</> : <>Choose outbound <ArrowRight size={12}/></>}</button>
      {selectedOutbound && selectedReturnFlight && sellerLookupFlight && <button className="text-action" type="button" onClick={() => onLoadBookingOptions(sellerLookupFlight)} disabled={sellerState?.loading}>{sellerState?.loading ? "Loading sellers…" : "Compare round-trip sellers"} <ArrowUpRight size={12}/></button>}
      {selectedOutbound && !selectedReturnFlight && <small className="seller-compare-hint">Select a return flight to compare sellers for the complete trip.</small>}
      {selectedOutbound && selectedReturnFlight && !sellerLookupFlight && <small className="seller-compare-hint">Seller booking links were not supplied for this return option. Use the exact Google Flights search above.</small>}
    </div>
    {selectedOutbound && sellerLookupFlight && <BookingOptions state={sellerState} currency={currency} selectedOption={selectedSeller?.flightId === sellerLookupFlight.id ? selectedSeller.option : null} onSelectSeller={(option) => onSelectSeller(sellerLookupFlight, option)}/>}
    {selectedOutbound && <ReturnOptions state={returnState} onSelectReturn={onSelectReturn} selectedReturnId={selectedReturnFlight?.id} currency={currency}/>}
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

function HotelResult({ hotel, currency, airportCode, experiences, nights, bookingState, selected, onSelect, onLoadBookingOptions }: {
  hotel: LiveHotel; currency: string; airportCode: string; experiences: LiveExperience[]; nights: number;
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
  return <article className={`live-hotel-card ${selected ? "is-selected" : ""}`}>
    {hotel.image && <img src={hotel.image} alt={`${hotel.name} property`} loading="lazy" referrerPolicy="no-referrer"/>}
    <div className="live-hotel-copy">
      <div className="live-hotel-title"><h4><a href={propertyUrl} target="_blank" rel="noreferrer">{hotel.name} <ExternalLink size={12}/></a></h4>{hotel.rating !== null && <span><Star size={12} fill="currentColor"/> {hotel.rating.toFixed(1)}{hotel.reviews ? ` · ${hotel.reviews.toLocaleString()}` : ""}</span>}</div>
      <p>{hotel.address || hotel.source} · {hotel.propertyType}</p>
      <div className="live-hotel-tags">{hotel.freeCancellation && <span><Check size={11}/> Free cancellation shown</span>}{hotel.amenities.slice(0, 4).map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
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
  const activeDate = selected?.date ?? draftDate;
  const activeSlot = selected?.slot ?? draftSlot;
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
    if (selected) onSelectionChange(experience, { date, slot: activeSlot });
  };
  const setSlot = (slot: ExperienceSlot) => {
    setDraftSlot(slot);
    if (selected) onSelectionChange(experience, { date: activeDate, slot });
  };
  return <article className={`experience-card ${selected ? "is-selected" : ""}`}>
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
      <label className="experience-schedule-field"><span>{isRestaurant ? "Meal" : "Time"}</span><select value={activeSlot} onChange={(event) => setSlot(event.target.value as ExperienceSlot)}>{(isRestaurant ? ["Lunch", "Dinner"] : ["Morning", "Afternoon", "Evening"]).map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label>
      <button type="button" className={`selection-button ${selected ? "is-selected" : ""}`} onClick={() => onSelectionChange(experience, selected ? null : { date: activeDate, slot: activeSlot })}>{selected ? <><Check size={13}/> Added to trip · Remove</> : isRestaurant ? "Add restaurant" : "Add activity"}</button>
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

function SelectedTripSummary({ selection, experiences, currency, nights, flightSearchUrl }: {
  selection: DestinationSelection;
  experiences: LiveExperience[];
  currency: string;
  nights: number;
  flightSearchUrl?: string;
}) {
  const selectedExperiences = experiences.filter((experience) => Boolean(selection.experiences[experience.id]));
  if (!selection.outbound && !selection.returnFlight && !selection.hotel && selectedExperiences.length === 0) return null;
  const activities = selectedExperiences.filter((item) => item.kind === "activity");
  const restaurants = selectedExperiences.filter((item) => item.kind === "restaurant");
  return <section className="trip-selection-summary">
    <div className="trip-selection-summary-heading"><div><h4>Your trip selections</h4><p>Selections are reflected in this trip view; they are not bookings.</p></div><span>{selectedExperiences.length} places added</span></div>
    <div className="trip-selection-summary-grid">
      <div><small>Flight</small>{selection.outbound ? <>
        {selection.flightSeller ? <><strong>{selection.outbound.airlines.join(" · ")} · {selection.flightSeller.option.seller}</strong><span>{selection.outbound.departure} → {selection.outbound.arrival}</span><b>{selection.flightSeller.option.price !== null ? `${money(selection.flightSeller.option.price, selection.flightSeller.option.currency || currency)} selected round-trip seller fare` : "Round-trip seller selected"}</b><BookingContinue option={selection.flightSeller.option}/></> : <><strong><a href={flightSearchUrl || "https://www.google.com/travel/flights"} target="_blank" rel="noreferrer">{selection.outbound.airlines.join(" · ")} <ExternalLink size={11}/></a></strong><span>{selection.outbound.departure} → {selection.outbound.arrival}</span>{selection.outbound.price !== null && <b>{money(selection.outbound.price, selection.outbound.currency || currency)} displayed outbound price</b>}</>}
        {selection.returnFlight ? <span>Return: {selection.returnFlight.departure} → {selection.returnFlight.arrival}</span> : <span>Choose a return flight</span>}
      </> : <span>No outbound flight selected</span>}</div>
      <div><small>Stay · {nights} nights</small>{selection.hotel ? <><strong><a href={selection.hotel.providerOffers.find((offer) => offer.url)?.url || selection.hotel.bookingUrl || `https://www.google.com/travel/hotels?q=${encodeURIComponent(selection.hotel.name)}`} target="_blank" rel="noreferrer">{selection.hotel.name} <ExternalLink size={11}/></a></strong><span>{selection.hotel.totalPrice !== null ? `${money(selection.hotel.totalPrice, selection.hotel.currency || currency)} provider-displayed stay total` : "Price not supplied"}</span></> : <span>No hotel or rental selected</span>}</div>
      <div><small>Activities & dining</small><strong>{activities.length} activities · {restaurants.length} restaurants</strong><div className="selected-place-links">{selectedExperiences.length ? selectedExperiences.map((item) => <a key={item.id} href={experienceBookingUrl(item)} target="_blank" rel="noreferrer">{item.name} <ExternalLink size={10}/></a>) : <span>No places added yet</span>}</div></div>
    </div>
  </section>;
}

function activitiesForDay(day: ItineraryDay, selection: DestinationSelection, experiences: LiveExperience[]) {
  return day.activities.flatMap((activity) => {
    const selected = experiences.filter((experience) => {
      const plan = selection.experiences[experience.id];
      return plan?.date === day.date && plan.slot === activity.period;
    });
    if (!selected.length) return [activity];
    if (activity.category === "Meal") {
      return [{ ...activity, title: `${activity.period} at ${selected.map((item) => item.name).join(" + ")}`, description: selected.map((item) => item.address || item.category).join(" · "), category: "Selected restaurant" }];
    }
    return selected.map((item) => ({
      period: activity.period,
      title: item.name,
      description: [item.category, item.address].filter(Boolean).join(" · ") || "Check current opening hours and booking details.",
      category: item.kind === "restaurant" ? "Selected restaurant" : "Selected activity",
    }));
  });
}

function WeatherPanel({ location, startDate, endDate, configured }: { location: string; startDate: string; endDate: string; configured: boolean }) {
  const [state, setState] = useState<WeatherState | null>(null);
  const attempted = useRef(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const daysUntilTrip = Math.ceil((new Date(`${startDate}T00:00:00`).getTime() - today.getTime()) / 86400000);
  const load = useCallback(async () => {
    setState({ loading: true, status: "loading", days: [] });
    try {
      const response = await fetch("/api/travel/weather", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location, startDate, endDate }) });
      const data = await response.json();
      setState({ loading: false, status: String(data.status || "error"), message: typeof data.message === "string" ? data.message : undefined, days: Array.isArray(data.days) ? data.days as WeatherDay[] : [], attribution: typeof data.attribution === "string" ? data.attribution : undefined });
    } catch { setState({ loading: false, status: "error", message: "Weather information is unavailable right now.", days: [] }); }
  }, [location, startDate, endDate]);
  useEffect(() => {
    if (configured && !attempted.current) { attempted.current = true; void load(); }
  }, [configured, load]);
  return <section className="weather-panel">
    <div className="weather-panel-heading"><div><h4>Weather</h4><p>{location}</p></div>{configured && <button className="text-action" type="button" onClick={() => { attempted.current = true; void load(); }} disabled={state?.loading}>{state?.loading ? <><RefreshCw size={12} className="spin"/> Checking</> : "Refresh"}</button>}</div>
    {!configured && <p className="weather-explainer">{daysUntilTrip > 2 ? `A day-by-day forecast for ${dateLabel(startDate)} is too far ahead to be dependable. Add WEATHERAPI_API_KEY in Vercel for short-range forecasts, then check again closer to departure. Tripfinder will not substitute a made-up forecast.` : "Live forecasts are not connected. Add WEATHERAPI_API_KEY in Vercel to retrieve the short-range forecast."}</p>}
    {state?.loading && <p className="inline-loading"><RefreshCw size={13} className="spin"/> Checking the forecast…</p>}
    {state?.message && <p className="weather-explainer">{state.message}</p>}
    {state && state.days.length > 0 && <div className="weather-days">{state.days.map((day) => <div className="weather-day" key={day.date}>{day.icon && <img src={`https:${day.icon}`} alt=""/>}<strong>{dateShort(day.date)}</strong><span>{day.condition}</span><b>{day.highF !== null ? `${Math.round(day.highF)}°F` : "—"} <small>{day.lowF !== null ? `${Math.round(day.lowF)}°F` : ""}</small></b>{day.rainChance !== null && <small><CloudRain size={11}/> {day.rainChance}% rain</small>}{day.maxWindKph !== null && <small><Wind size={11}/> {Math.round(day.maxWindKph)} km/h wind</small>}</div>)}</div>}
    {state?.attribution && <p className="weather-attribution">{state.attribution}</p>}
  </section>;
}

export function ResultsWorkspace({ search, recommendations, liveSearchConfigured, providerKeyConfigured, databaseConfigured, weatherKeyConfigured }: Props) {
  const [expanded, setExpanded] = useState<string | null>(recommendations.length === 1 ? recommendations[0]?.destination.id ?? null : null);
  const [states, setStates] = useState<Record<string, SearchState>>({});
  const [returnStates, setReturnStates] = useState<Record<string, ReturnState>>({});
  const [bookingStates, setBookingStates] = useState<Record<string, BookingState>>({});
  const [hotelBookingStates, setHotelBookingStates] = useState<Record<string, HotelBookingState>>({});
  const [checkedDestinations, setCheckedDestinations] = useState<string[]>([]);
  const [selections, setSelections] = useState<Record<string, DestinationSelection>>({});
  const [flightAirlineFilters, setFlightAirlineFilters] = useState<Record<string, string>>({});
  const people = search.adults + search.childrenAges.length;
  const nights = Math.max(1, Math.round((new Date(`${search.returnDate}T00:00:00Z`).getTime() - new Date(`${search.departureDate}T00:00:00Z`).getTime()) / 86400000));
  const totalBudget = search.budgetMode === "per_person" ? search.budget * people : search.budget;
  const perPersonDaily = useMemo(() => totalBudget / Math.max(1, nights * people), [totalBudget, nights, people]);
  const singleDestination = recommendations.length === 1;

  async function checkLiveOffers(recommendation: TripRecommendation) {
    const id = recommendation.destination.id;
    setExpanded(id);
    setStates((current) => ({ ...current, [id]: { loading: true, error: "", result: current[id]?.result ?? null } }));
    try {
      const response = await fetch("/api/travel/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search, destinationName: formatDestinationLabel(recommendation.destination.city, recommendation.destination.country), destinationAirportCode: search.destinationAirportCode || recommendation.destination.airportCode }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to search this trip right now.");
      setStates((current) => ({ ...current, [id]: { loading: false, error: "", result: data as LiveTravelSearchResult } }));
      setCheckedDestinations((current) => current.includes(id) ? current : [...current, id]);
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
    updateSelection(destinationId, (current) => ({ ...current, hotel: current.hotel?.id === hotel.id ? null : hotel }));
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
          <div className="planner-destination-visual" style={{ backgroundImage: `url('${destination.image}')` }} aria-label={`${destination.city}, ${destination.country}`} />
          <div className="planner-destination-body">
            <div className="planner-destination-heading"><div>{destination.country && normalizeDestinationQuery(destination.country) !== normalizeDestinationQuery(destination.city) && <span className="planner-country">{destination.country}</span>}<h3>{destination.city}</h3><p>{destination.summary}</p>{recommendation.typicalDaytimeHighF !== null ? <p className="planner-climate-note">Typical daytime high for these dates: <strong>{Math.round(search.temperatureUnit === "C" ? (recommendation.typicalDaytimeHighF - 32) * 5 / 9 : recommendation.typicalDaytimeHighF)}°{search.temperatureUnit}</strong> <span>· monthly climate average, not a forecast</span></p> : (search.temperatureMin !== null || search.temperatureMax !== null) ? <p className="planner-climate-note">No monthly temperature baseline is available for this location, so your temperature range could not be checked.</p> : null}</div>{airportCode && <span className="planner-airport">{airportCode}</span>}</div>
            <div className="planner-highlights">{destination.highlights.slice(0, 3).map((highlight) => <span key={highlight}>{highlight}</span>)}</div>
            <div className="planner-actions">
              {search.components.includes("flights") && <a className="planner-outbound-link" href={state?.result?.providerSearchLinks?.flights || recommendation.flightSearchUrl} target="_blank" rel="noreferrer"><Plane size={14}/> Flights <ArrowUpRight size={12}/></a>}
              {search.components.includes("stays") && search.stayTypes.includes("hotels") && <a className="planner-outbound-link" href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer"><Hotel size={14}/> Hotels · {nights} nights <ArrowUpRight size={12}/></a>}
              {search.components.includes("stays") && search.stayTypes.includes("vacation_rentals") && <a className="planner-outbound-link" href={recommendation.vacationRentalSearchUrl} target="_blank" rel="noreferrer"><Hotel size={14}/> Rentals · {nights} nights <ArrowUpRight size={12}/></a>}
              {search.components.includes("activities") && <a className="planner-outbound-link" href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer"><Activity size={14}/> Things to do · {nights} days <ArrowUpRight size={12}/></a>}
              <button className="text-action" type="button" onClick={() => setExpanded(isExpanded ? null : destination.id)} aria-expanded={isExpanded}>{isExpanded ? "Hide trip outline" : "Trip outline"}</button>
            </div>

            {liveSearchConfigured && <div className="live-search-action"><button type="button" className="live-search-button" disabled={state?.loading || (checkedDestinations.includes(destination.id) && Boolean(state?.result))} onClick={() => checkLiveOffers(recommendation)}>{state?.loading ? <><RefreshCw size={14} className="spin"/> Searching selected categories…</> : checkedDestinations.includes(destination.id) ? <><Check size={14}/> Search complete</> : `Search ${requestedLabels.join(" + ")}`}</button>{!singleDestination && <span>Only the destination you open is searched. Other recommendations do not use API requests until selected.</span>}</div>}
            {state?.error && <div className="provider-error" role="alert">{state.error}</div>}
            {state?.loading && <div className="search-loading-panel"><span className="loading-line"/><span className="loading-line short"/><p>Checking current travel options for {destination.city}…</p></div>}

            {state?.result && <div className="live-search-results">
              <div className="live-result-heading"><div><h4>Travel options for {destination.city}</h4><p>Checked {new Date(state.result.checkedAt).toLocaleString()} · {state.result.servedFromCache ? "cached provider data" : "new provider search"}</p></div><span className={`result-status result-status-${state.result.status}`}>{state.result.status === "live" ? "Search complete" : state.result.status === "partial" ? "Some categories returned no results" : "No provider results"}</span></div>
              {state.result.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}

              {search.components.includes("flights") && <section className="live-result-group"><h5><Plane size={16}/> Flights <span>{state.result.flights.length} outbound options</span></h5>
                {state.result.flights.length ? <>{state.result.providerSearchLinks?.flights && <p className="provider-search-link"><a href={state.result.providerSearchLinks.flights} target="_blank" rel="noreferrer">Open this exact search in Google Flights <ArrowUpRight size={12}/></a></p>}{availableAirlines.length > 1 && <div className="airline-filter" aria-label="Filter outbound flights by airline"><span>Airline</span><button type="button" className={selectedAirline === "all" ? "is-active" : ""} onClick={() => setFlightAirlineFilters((current) => ({ ...current, [destination.id]: "all" }))}>All ({state.result.flights.length})</button>{availableAirlines.map((airline) => <button type="button" key={airline} className={selectedAirline === airline ? "is-active" : ""} onClick={() => setFlightAirlineFilters((current) => ({ ...current, [destination.id]: airline }))}>{airline} ({state.result!.flights.filter((flight) => flight.airlines.includes(airline)).length})</button>)}</div>}{visibleFlights.map((flight) => <FlightResult key={flight.id} flight={flight} currency={search.currency} returnState={returnStates[flight.id]} bookingStates={bookingStates} selectedOutbound={selection.outbound?.id === flight.id} selectedReturnFlight={selection.outbound?.id === flight.id ? selection.returnFlight : null} selectedSeller={selection.flightSeller} onSelectOutbound={(selected) => selectOutbound(destination.id, selected, airportCode)} onSelectReturn={(selected) => selectReturn(destination.id, selected)} onLoadBookingOptions={(selected) => loadBookingOptions(selected, airportCode)} onSelectSeller={(selectedFlight, option) => selectFlightSeller(destination.id, selectedFlight, option)}/>)}</> : <div className="empty-category"><p>No flight options were returned for this route and date combination.</p><a href={state.result.providerSearchLinks?.flights || directFlightUrl.toString()} target="_blank" rel="noreferrer">Search this route on Google Flights <ArrowUpRight size={12}/></a><small>The link uses the route and dates submitted to the provider. You can adjust passenger or fare details on Google Flights if needed.</small></div>}
              </section>}

              {search.components.includes("stays") && <section className="live-result-group"><h5><Hotel size={16}/> Places to stay <span>{state.result.hotels.length} properties</span></h5>
                {state.result.hotels.length ? state.result.hotels.map((hotel) => <HotelResult key={hotel.id} hotel={hotel} currency={search.currency} airportCode={airportCode} experiences={state.result!.experiences} nights={nights} bookingState={hotelBookingStates[hotel.id]} selected={selection.hotel?.id === hotel.id} onSelect={(selected) => selectHotel(destination.id, selected)} onLoadBookingOptions={loadHotelOptions}/>) : <div className="empty-category"><p>No properties were returned for these dates and guest details.</p><a href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer">Open the stay search <ArrowUpRight size={12}/></a></div>}
              </section>}

              {search.components.includes("activities") && <>
                <section className="live-result-group"><h5><Activity size={16}/> Activities & attractions <span>{activityExperiences.length} options</span></h5>
                  {activityExperiences.length ? activityExperiences.map((experience) => <ExperienceResult key={experience.id} experience={experience} hotels={state.result!.hotels} airportCode={airportCode} search={search} days={itineraryDates} selected={selection.experiences[experience.id]} onSelectionChange={(item, plan) => updateExperienceSelection(destination.id, item, plan)}/>) : <div className="empty-category"><p>No activity results were returned for this destination.</p><div className="empty-category-links"><a href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer">Search Viator <ArrowUpRight size={12}/></a><a href={`https://www.getyourguide.com/s/?q=${encodeURIComponent(`Things to do in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search GetYourGuide <ArrowUpRight size={12}/></a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Attractions in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search Maps <ArrowUpRight size={12}/></a></div></div>}
                </section>
                <section className="live-result-group"><h5><Users size={16}/> Restaurants & dining <span>{restaurantExperiences.length} options</span></h5>
                  {restaurantExperiences.length ? restaurantExperiences.map((experience) => <ExperienceResult key={experience.id} experience={experience} hotels={state.result!.hotels} airportCode={airportCode} search={search} days={itineraryDates} selected={selection.experiences[experience.id]} onSelectionChange={(item, plan) => updateExperienceSelection(destination.id, item, plan)}/>) : <div className="empty-category"><p>No restaurant results were returned. Open Maps to search current dining options in this destination.</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Restaurants in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search restaurants in Maps <ArrowUpRight size={12}/></a></div>}
                </section>
              </>}
              <SelectedTripSummary selection={selection} experiences={state.result.experiences} currency={search.currency} nights={nights} flightSearchUrl={state.result.providerSearchLinks?.flights || directFlightUrl.toString()}/>
              <WeatherPanel location={destinationLabel} startDate={search.departureDate} endDate={search.returnDate} configured={weatherKeyConfigured}/>
              <p className="provider-disclaimer">Provider results are snapshots, not reservations. Confirm the room or passenger mix, taxes, baggage, cancellation terms and final price with the seller.</p>
            </div>}

            {isExpanded && <><div className="itinerary-panel"><div className="itinerary-panel-heading"><div><h4>{nights}-night outline</h4></div><p>Suggested pacing. Activities and hours are not reservations.</p></div>
              <div className="itinerary-days">{recommendation.itinerary.map((day, dayIndex) => <div className="itinerary-day" key={day.date}><div className="itinerary-day-date"><span>DAY {dayIndex + 1}</span><strong>{dateLabel(day.date)}</strong></div><div className="itinerary-activities">{activitiesForDay(day, selection, resultExperiences).map((activity, activityIndex) => <div className={`itinerary-activity ${activity.category === "Meal" || activity.category === "Selected restaurant" ? "is-meal" : ""}`} key={`${day.date}-${activity.period}-${activity.title}-${activityIndex}`}><span>{activity.period}</span><div><strong>{activity.title}</strong><p>{activity.description}</p></div><small>{activity.category}</small></div>)}<p className="itinerary-pace">{day.paceNote}</p></div></div>)}</div>
              <div className="itinerary-footnote">{destination.sourceNote}</div>
            </div></>}
          </div>
        </motion.article>;
      })}
    </div>

    <div className="planner-method-note"><p><strong>How to read these results.</strong> Flights, properties and places come from the selected providers. Straight-line distances are geographic estimates, not driving times. Weather is only shown when the forecast provider can cover the requested dates. Confirm final terms with the booking provider.</p></div>
  </div>;
}
