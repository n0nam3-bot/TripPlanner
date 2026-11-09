"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, ExternalLink, Hotel, MapPin, Plane, RefreshCw, ShieldAlert, Star, Users, Wallet, Wind, CloudRain } from "lucide-react";
import type { FlightBookingOption, HotelBookingOption, LiveExperience, LiveFlight, LiveHotel, LiveTravelSearchResult, ReturnFlightSearchResult } from "@/lib/providers/serpapi";
import type { TripRecommendation, TripSearchInput } from "@/lib/trip-planner/types";
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

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const duration = (minutes: number | null) => minutes === null ? "Duration not listed" : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const dateShort = (date: string) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

async function readApiJson(response: Response, fallback: string): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();
  if (!contentType.toLowerCase().includes("application/json")) {
    if (response.status === 404 || body.trimStart().startsWith("<!DOCTYPE")) {
      throw new Error("This Tripfinder service endpoint is not available in the current deployment. Redeploy the latest update and try again.");
    }
    throw new Error(fallback);
  }
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { throw new Error(fallback); }
  if (!parsed || typeof parsed !== "object") throw new Error(fallback);
  const data = parsed as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : fallback);
  return data;
}

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

function BookingOptions({ state, currency }: { state?: BookingState; currency: string }) {
  if (!state) return null;
  if (state.loading) return <p className="inline-loading"><RefreshCw size={13} className="spin"/> Loading airline and seller offers…</p>;
  if (state.error) return <p className="provider-inline-error">{state.error}</p>;
  if (!state.options) return null;
  return <div className="booking-options-list">
    {state.options.length ? state.options.map((option, index) => <div className="booking-option-row" key={`${option.seller}-${index}`}>
      <span><strong>{option.seller}</strong>{(option.fareTerms.length > 0 || option.baggage.length > 0) && <small>{[...option.fareTerms, ...option.baggage].join(" · ")}</small>}</span>
      <span>{option.price !== null ? money(option.price, option.currency || currency) : "See seller"}</span>
      {option.url && <a href={option.url} target="_blank" rel="noreferrer">Continue <ArrowUpRight size={12}/></a>}
    </div>) : <small>No seller links were returned for this selection. Use the direct Google Flights search link below.</small>}
  </div>;
}

function ReturnOptions({ state, bookingStates, onLoadBookingOptions, currency }: {
  state?: ReturnState; bookingStates: Record<string, BookingState>; onLoadBookingOptions: (flight: LiveFlight) => void; currency: string;
}) {
  if (!state) return null;
  return <div className="return-options-panel">
    <div className="return-options-heading"><strong>Return flights</strong>{state.result && <small>Checked {new Date(state.result.dataAsOf).toLocaleString()}</small>}</div>
    {state.loading && <p className="inline-loading"><RefreshCw size={13} className="spin"/> Matching return legs to this outbound flight…</p>}
    {state.error && <p className="provider-inline-error">{state.error}</p>}
    {state.result?.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}
    {state.result?.flights.map((flight) => <div className="return-flight-option" key={flight.id}>
      <div className="return-flight-copy"><strong>{flight.departure} <span>→</span> {flight.arrival}</strong><small>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</small><small>{flight.from} → {flight.to}</small></div>
      <div className="return-flight-action">{flight.price !== null && <strong>{money(flight.price, flight.currency || currency)}</strong>}{flight.bookingToken && <button className="text-action" type="button" onClick={() => onLoadBookingOptions(flight)} disabled={bookingStates[flight.id]?.loading}>Compare sellers <ArrowUpRight size={12}/></button>}</div>
      <BookingOptions state={bookingStates[flight.id]} currency={currency}/>
    </div>)}
    {state.result && state.result.flights.length === 0 && <p className="empty-inline">No return options matched this outbound selection.</p>}
  </div>;
}

function FlightResult({ flight, currency, returnState, bookingStates, onLoadReturnFlights, onLoadBookingOptions }: {
  flight: LiveFlight; currency: string; returnState?: ReturnState; bookingStates: Record<string, BookingState>;
  onLoadReturnFlights: (flight: LiveFlight) => void; onLoadBookingOptions: (flight: LiveFlight) => void;
}) {
  return <article className="live-offer-card">
    <div className="live-offer-main"><div className="live-offer-route"><strong>{flight.departure}</strong><span>→</span><strong>{flight.arrival}</strong></div><p>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</p><small>{flight.from} → {flight.to}</small></div>
    <div className="live-offer-price">{flight.price !== null ? <strong>{money(flight.price, flight.currency || currency)}</strong> : <strong>Price not supplied</strong>}<small>Outbound leg price, not a round-trip total</small>
      {flight.departureToken && <button className="text-action" type="button" disabled={returnState?.loading} onClick={() => onLoadReturnFlights(flight)}>{returnState?.loading ? <><RefreshCw size={12} className="spin"/> Finding return</> : <>Select outbound <ArrowRight size={12}/></>}</button>}
    </div>
    <ReturnOptions state={returnState} bookingStates={bookingStates} onLoadBookingOptions={onLoadBookingOptions} currency={currency}/>
  </article>;
}

function RouteLookup({ origin, destination, label }: { origin: string; destination: string; label: string }) {
  const [state, setState] = useState<RouteState | null>(null);
  async function load() {
    setState({ loading: true });
    try {
      const response = await fetch("/api/travel/directions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin, destination }) });
      const data = await readApiJson(response, "Driving route unavailable.");
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

function HotelResult({ hotel, currency, airportCode, experiences, bookingState, onLoadBookingOptions }: {
  hotel: LiveHotel; currency: string; airportCode: string; experiences: LiveExperience[];
  bookingState?: HotelBookingState; onLoadBookingOptions: (hotel: LiveHotel) => void;
}) {
  const airport = hotel.latitude !== null && hotel.longitude !== null
    ? nearestKnownAirport(hotel.latitude, hotel.longitude, airportCode) : null;
  const airportDistance = airport?.miles ?? null;
  const nearestActivities = hotel.latitude !== null && hotel.longitude !== null
    ? experiences.filter((item) => item.latitude !== null && item.longitude !== null).map((item) => ({ item, miles: haversineMiles(hotel.latitude!, hotel.longitude!, item.latitude!, item.longitude!) })).sort((a, b) => a.miles - b.miles).slice(0, 2)
    : [];
  const hotelOrigin = hotel.address || (hotel.latitude !== null && hotel.longitude !== null ? `${hotel.latitude},${hotel.longitude}` : hotel.name);
  const propertyUrl = hotel.bookingUrl || `https://www.google.com/travel/hotels?q=${encodeURIComponent(`${hotel.name} ${hotel.address}`)}`;
  return <article className="live-hotel-card">
    {hotel.image && <img src={hotel.image} alt={`${hotel.name} property`} loading="lazy" referrerPolicy="no-referrer"/>}
    <div className="live-hotel-copy">
      <div className="live-hotel-title"><h4><a href={propertyUrl} target="_blank" rel="noreferrer">{hotel.name} <ExternalLink size={12}/></a></h4>{hotel.rating !== null && <span><Star size={12} fill="currentColor"/> {hotel.rating.toFixed(1)}{hotel.reviews ? ` · ${hotel.reviews.toLocaleString()}` : ""}</span>}</div>
      <p>{hotel.address || hotel.source} · {hotel.propertyType}</p>
      <div className="live-hotel-tags">{hotel.freeCancellation && <span><Check size={11}/> Free cancellation shown</span>}{hotel.amenities.slice(0, 4).map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
      {hotel.providerOffers.some((offer) => offer.url) && <div className="hotel-provider-links"><strong>Available booking sites</strong>{hotel.providerOffers.filter((offer) => offer.url).slice(0, 4).map((offer, index) => <a key={`${offer.seller}-${index}`} href={offer.url} target="_blank" rel="noreferrer">{offer.seller}{offer.price !== null ? ` · ${money(offer.price, offer.currency || currency)}${offer.priceBasis === "stay" ? " total" : offer.priceBasis === "night" ? "/night" : ""}` : ""} <ExternalLink size={11}/></a>)}</div>}
      {(airportDistance !== null || nearestActivities.length > 0 || hotel.nearbyPlaces.length > 0) && <div className="hotel-proximity">
        {airportDistance !== null && airport && <span>{airport.name}{!airportCode ? " · nearest listed airport" : ""}: {distanceLabel(airportDistance)} straight-line</span>}
        {airport && <RouteLookup origin={hotelOrigin} destination={airport.name} label="Check drive to airport"/>}
        {hotel.nearbyPlaces.slice(0, 4).map((place) => <span className="hotel-nearby-place" key={`${place.name}-${place.category}`}><strong>{place.name}</strong>{place.category !== "Place" && ` · ${place.category}`}{place.transportations.length > 0 && ` · ${place.transportations.map((item) => `${item.type} ${item.duration}`).join(" · ")}`}</span>)}
        {nearestActivities.map(({ item, miles }) => <span className="hotel-activity-distance" key={item.id}>{item.name}: {distanceLabel(miles)} straight-line <RouteLookup origin={hotelOrigin} destination={item.address || `${item.latitude},${item.longitude}`} label="Driving time"/></span>)}
      </div>}
      {bookingState?.loading && <p className="inline-loading"><RefreshCw size={12} className="spin"/> Retrieving property booking options…</p>}
      {bookingState?.error && <p className="provider-inline-error">{bookingState.error}</p>}
      {bookingState?.options && <div className="hotel-booking-options">{bookingState.options.length ? bookingState.options.map((option, index) => <div key={`${option.seller}-${index}`}><span><strong>{option.seller}</strong>{option.terms.length > 0 && <small>{option.terms.join(" · ")}</small>}</span><span>{option.price !== null ? money(option.price, option.currency || currency) : "See provider"}</span>{option.url && <a href={option.url} target="_blank" rel="noreferrer">Open <ArrowUpRight size={11}/></a>}</div>) : <p>No separate seller offers were returned. The property link remains available above.</p>}</div>}
    </div>
    <div className="live-hotel-price">
      {hotel.totalPrice !== null ? <strong>{money(hotel.totalPrice, hotel.currency || currency)}</strong> : hotel.nightlyPrice !== null ? <strong>{money(hotel.nightlyPrice, hotel.currency || currency)}<small>/night</small></strong> : <strong>Price unavailable</strong>}
      <small>{hotel.totalPrice !== null ? "Provider-displayed stay total" : "Provider-displayed nightly rate"}</small>
      {hotel.propertyToken && <button type="button" className="text-action" onClick={() => onLoadBookingOptions(hotel)} disabled={bookingState?.loading}>{bookingState?.loading ? "Loading rates…" : bookingState?.options ? "Refresh rates" : "Compare rates"} <ArrowUpRight size={12}/></button>}
      <a className="hotel-primary-link" href={propertyUrl} target="_blank" rel="noreferrer">{hotel.bookingUrlLabel} <ExternalLink size={12}/></a>
    </div>
  </article>;
}

function ExperienceResult({ experience, hotels, airportCode }: { experience: LiveExperience; hotels: LiveHotel[]; airportCode: string }) {
  const nearbyStays = experience.latitude !== null && experience.longitude !== null
    ? hotels.filter((hotel) => hotel.latitude !== null && hotel.longitude !== null).map((hotel) => ({ hotel, miles: haversineMiles(experience.latitude!, experience.longitude!, hotel.latitude!, hotel.longitude!) })).sort((a, b) => a.miles - b.miles).slice(0, 2)
    : [];
  const airport = experience.latitude !== null && experience.longitude !== null
    ? nearestKnownAirport(experience.latitude, experience.longitude, airportCode) : null;
  const airportMiles = airport?.miles ?? null;
  const activityLocation = experience.address || (experience.latitude !== null && experience.longitude !== null ? `${experience.latitude},${experience.longitude}` : experience.name);
  const ticketQuery = encodeURIComponent(`${experience.name} ${experience.address}`);
  const viatorUrl = `https://www.viator.com/searchResults/all?text=${ticketQuery}`;
  const getYourGuideUrl = `https://www.getyourguide.com/s/?q=${ticketQuery}`;
  return <article className="experience-card">
    {experience.thumbnail && <img src={experience.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
    <div className="experience-copy"><div className="experience-title"><h4>{experience.name}</h4>{experience.rating !== null && <span><Star size={12} fill="currentColor"/> {experience.rating.toFixed(1)}{experience.reviews ? ` · ${experience.reviews.toLocaleString()}` : ""}</span>}</div><p>{experience.category}{experience.address ? ` · ${experience.address}` : ""}</p>{experience.openState && <small>{experience.openState}</small>}{experience.price && <small>{experience.price}</small>}
      {nearbyStays.length > 0 && <div className="experience-distances">{nearbyStays.map(({ hotel, miles }) => {
        const hotelLocation = hotel.address || (hotel.latitude !== null && hotel.longitude !== null ? `${hotel.latitude},${hotel.longitude}` : hotel.name);
        return <span key={hotel.id}>{distanceLabel(miles)} from {hotel.name} (straight-line) <RouteLookup origin={hotelLocation} destination={activityLocation} label="Drive from hotel"/></span>;
      })}</div>}
      {airport && airportMiles !== null && <div className="experience-distances"><span>{airport.name}{!airportCode ? " · nearest listed airport" : ""}: {distanceLabel(airportMiles)} straight-line <RouteLookup origin={airport.name} destination={activityLocation} label="Check drive from airport"/></span></div>}
    </div>
    <div className="experience-actions">{experience.website && <a href={experience.website} target="_blank" rel="noreferrer" className="text-action">Official site <ArrowUpRight size={12}/></a>}<a href={experience.mapsUrl} target="_blank" rel="noreferrer" className="text-action">Open in Maps <ArrowUpRight size={12}/></a><a href={viatorUrl} target="_blank" rel="noreferrer" className="text-action">Search Viator <ArrowUpRight size={12}/></a><a href={getYourGuideUrl} target="_blank" rel="noreferrer" className="text-action">Search GetYourGuide <ArrowUpRight size={12}/></a></div>
  </article>;
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
      const data = await readApiJson(response, "Weather information is unavailable right now.");
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
      const response = await fetch("/api/travel/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search, destinationName: [recommendation.destination.city, recommendation.destination.country].filter(Boolean).join(", "), destinationAirportCode: search.destinationAirportCode || recommendation.destination.airportCode }) });
      const data = await readApiJson(response, "Unable to search this trip right now.");
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
      const data = await readApiJson(response, "Unable to retrieve return flight options.");
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
      const data = await readApiJson(response, "Could not retrieve seller links.");
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
      const data = await readApiJson(response, "Could not retrieve property booking options.");
      setHotelBookingStates((current) => ({ ...current, [hotel.id]: { loading: false, error: "", options: Array.isArray(data.offers) ? data.offers as HotelBookingOption[] : [] } }));
    } catch (error) {
      setHotelBookingStates((current) => ({ ...current, [hotel.id]: { loading: false, error: error instanceof Error ? error.message : "Hotel booking lookup failed.", options: current[hotel.id]?.options ?? null } }));
    }
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
        const isExpanded = expanded === destination.id;
        const airportCode = search.destinationAirportCode || destination.airportCode;
        const destinationLabel = [destination.city, destination.country].filter(Boolean).join(", ");
        const directFlightUrl = new URL("https://www.google.com/travel/flights");
        directFlightUrl.searchParams.set("q", `Flights from ${search.origin} to ${destinationLabel} on ${search.departureDate} returning ${search.returnDate} for ${people} travelers`);
        return <motion.article className={`planner-destination-card ${isExpanded ? "is-expanded" : ""}`} key={destination.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, delay: index * 0.035 }}>
          <div className="planner-destination-visual" style={{ backgroundImage: `url('${destination.image}')` }} aria-label={`${destination.city}, ${destination.country}`} />
          <div className="planner-destination-body">
            <div className="planner-destination-heading"><div><span className="planner-country">{destination.country}</span><h3>{destination.city}</h3><p>{destination.summary}</p></div>{airportCode && <span className="planner-airport">{airportCode}</span>}</div>
            <div className="planner-highlights">{destination.highlights.slice(0, 3).map((highlight) => <span key={highlight}>{highlight}</span>)}</div>
            <div className="planner-actions">
              {search.components.includes("flights") && <a className="planner-outbound-link" href={recommendation.flightSearchUrl} target="_blank" rel="noreferrer"><Plane size={14}/> Flights <ArrowUpRight size={12}/></a>}
              {search.components.includes("stays") && <a className="planner-outbound-link" href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer"><Hotel size={14}/> Stays <ArrowUpRight size={12}/></a>}
              {search.components.includes("activities") && <a className="planner-outbound-link" href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer"><Activity size={14}/> Things to do <ArrowUpRight size={12}/></a>}
              <button className="text-action" type="button" onClick={() => setExpanded(isExpanded ? null : destination.id)} aria-expanded={isExpanded}>{isExpanded ? "Hide trip outline" : "Trip outline"}</button>
            </div>

            {liveSearchConfigured && <div className="live-search-action"><button type="button" className="live-search-button" disabled={state?.loading || (checkedDestinations.includes(destination.id) && Boolean(state?.result))} onClick={() => checkLiveOffers(recommendation)}>{state?.loading ? <><RefreshCw size={14} className="spin"/> Searching selected categories…</> : checkedDestinations.includes(destination.id) ? <><Check size={14}/> Search complete</> : `Search ${requestedLabels.join(" + ")}`}</button>{!singleDestination && <span>Only the destination you open is searched. Other recommendations do not use API requests until selected.</span>}</div>}
            {state?.error && <div className="provider-error" role="alert">{state.error}</div>}
            {state?.loading && <div className="search-loading-panel"><span className="loading-line"/><span className="loading-line short"/><p>Checking current travel options for {destination.city}…</p></div>}

            {state?.result && <div className="live-search-results">
              <div className="live-result-heading"><div><h4>Travel options for {destination.city}</h4><p>Checked {new Date(state.result.checkedAt).toLocaleString()} · {state.result.servedFromCache ? "cached provider data" : "new provider search"}</p></div><span className={`result-status result-status-${state.result.status}`}>{state.result.status === "live" ? "Search complete" : state.result.status === "partial" ? "Some categories returned no results" : "No provider results"}</span></div>
              {state.result.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}

              {search.components.includes("flights") && <section className="live-result-group"><h5><Plane size={16}/> Flights <span>{state.result.flights.length} outbound options</span></h5>
                {state.result.flights.length ? state.result.flights.map((flight) => <FlightResult key={flight.id} flight={flight} currency={search.currency} returnState={returnStates[flight.id]} bookingStates={bookingStates} onLoadReturnFlights={(selected) => loadReturnFlights(selected, airportCode)} onLoadBookingOptions={(selected) => loadBookingOptions(selected, airportCode)}/>) : <div className="empty-category"><p>No flight options were returned for this route and date combination.</p><a href={directFlightUrl.toString()} target="_blank" rel="noreferrer">Search this route on Google Flights <ArrowUpRight size={12}/></a><small>Try an individual airport such as JFK, LGA or EWR, or adjust your dates.</small></div>}
              </section>}

              {search.components.includes("stays") && <section className="live-result-group"><h5><Hotel size={16}/> Places to stay <span>{state.result.hotels.length} properties</span></h5>
                {state.result.hotels.length ? state.result.hotels.map((hotel) => <HotelResult key={hotel.id} hotel={hotel} currency={search.currency} airportCode={airportCode} experiences={state.result!.experiences} bookingState={hotelBookingStates[hotel.id]} onLoadBookingOptions={loadHotelOptions}/>) : <div className="empty-category"><p>No properties were returned for these dates and guest details.</p><a href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer">Open the stay search <ArrowUpRight size={12}/></a></div>}
              </section>}

              {search.components.includes("activities") && <section className="live-result-group"><h5><Activity size={16}/> Things to do <span>{state.result.experiences.length} places</span></h5>
                {state.result.experiences.length ? state.result.experiences.map((experience) => <ExperienceResult key={experience.id} experience={experience} hotels={state.result!.hotels} airportCode={airportCode}/>) : <div className="empty-category"><p>No local places matched this search. Try a more specific city or activity style.</p><div className="empty-category-links"><a href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer">Search Viator <ArrowUpRight size={12}/></a><a href={`https://www.getyourguide.com/s/?q=${encodeURIComponent(`Things to do in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search GetYourGuide <ArrowUpRight size={12}/></a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Attractions in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search Maps <ArrowUpRight size={12}/></a></div></div>}
              </section>}
              <WeatherPanel location={destinationLabel} startDate={search.departureDate} endDate={search.returnDate} configured={weatherKeyConfigured}/>
              <p className="provider-disclaimer">Provider results are snapshots, not reservations. Confirm the room or passenger mix, taxes, baggage, cancellation terms and final price with the seller.</p>
            </div>}

            {isExpanded && <><div className="itinerary-panel"><div className="itinerary-panel-heading"><div><h4>{nights}-night outline</h4></div><p>Suggested pacing. Activities and hours are not reservations.</p></div>
              <div className="itinerary-days">{recommendation.itinerary.map((day, dayIndex) => <div className="itinerary-day" key={day.date}><div className="itinerary-day-date"><span>DAY {dayIndex + 1}</span><strong>{dateLabel(day.date)}</strong></div><div className="itinerary-activities">{day.activities.map((activity) => <div className="itinerary-activity" key={`${day.date}-${activity.period}-${activity.title}`}><span>{activity.period}</span><div><strong>{activity.title}</strong><p>{activity.description}</p></div><small>{activity.category}</small></div>)}<p className="itinerary-pace">{day.paceNote}</p></div></div>)}</div>
              <div className="itinerary-footnote">{destination.sourceNote}</div>
            </div></>}
          </div>
        </motion.article>;
      })}
    </div>

    <div className="planner-method-note"><p><strong>How to read these results.</strong> Flights, properties and places come from the selected providers. Straight-line distances are geographic estimates, not driving times. Weather is only shown when the forecast provider can cover the requested dates. Confirm final terms with the booking provider.</p></div>
  </div>;
}
