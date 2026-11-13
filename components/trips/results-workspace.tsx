"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown, Clock3, Copy, ExternalLink, Hotel, MapPin, Plane, RefreshCw, Save, ShieldAlert, Star, Users, Wallet, Wind, CloudRain, ClipboardList, type LucideIcon } from "lucide-react";
import type { FlightBookingOption, HotelBookingOption, LiveExperience, LiveFlight, LiveHotel, LiveTravelSearchResult, ReturnFlightSearchResult } from "@/lib/providers/serpapi";
import type { StayAmenity, TripRecommendation, TripSearchInput } from "@/lib/trip-planner/types";
import { formatDestinationLabel, formatTripDestinationLabel, normalizeDestinationQuery } from "@/lib/trip-planner/destinations";
import { AIRPORT_COORDINATES } from "@/lib/trip-planner/location-suggestions";
import { airportLocalDateTimeToTimestamp, destinationTimezoneNotice, flightLayoverDuration, flightTimeSortTimestamp, formatFlightTimeAtAirport } from "@/lib/trip-planner/flight-routing";
import { inferStaySpaceType, poolAccessLabel, STAY_AMENITY_LABELS, stayAmenityConfirmed } from "@/lib/providers/stay-features";
import { AITripAssistant } from "@/components/trips/ai-trip-assistant";
import { getTripAssistantResultAnchor, getTripAssistantStayAnchor, type TripAssistantContext } from "@/lib/ai/trip-assistant";
import { buildTripCostLedger, parseCostEstimate } from "@/lib/trip-planner/cost-ledger";
import type { FlexibleFlightDateSearchResult } from "@/lib/providers/serpapi";
import type { FlexibleFlightDateOption } from "@/lib/trip-planner/flexible-flight-dates";
import { normalizeSavedTripSnapshot, shiftSavedTripSnapshotDateRange, sortSavedTripItemsChronologically, type SavedTripSnapshot, type SavedTripItem, type SavedTripSelectionReference } from "@/lib/trip-planner/saved-trips";
import { isValidProximityStartingPoint, type ProximityStartingPoint } from "@/lib/trip-planner/proximity";

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
type SupplierLookupState = { checkedAt?: string; dataAsOf?: string; servedFromCache?: boolean; stale?: boolean };
type BookingState = { loading: boolean; error: string; options: FlightBookingOption[] | null } & SupplierLookupState;
type HotelBookingState = { loading: boolean; error: string; options: HotelBookingOption[] | null } & SupplierLookupState;
type WeatherDay = { date: string; condition: string; icon: string; highC: number | null; lowC: number | null; highF: number | null; lowF: number | null; rainChance: number | null; maxWindKph: number | null; uv: number | null };
type WeatherState = { loading: boolean; status: string; message?: string; days: WeatherDay[]; attribution?: string };
type RouteState = { loading: boolean; error?: string; distance?: string; duration?: string; durationInTraffic?: string; source?: string; mapImageDataUrl?: string; mapWarning?: string; directions?: string[]; startAddress?: string; endAddress?: string };
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
const localDateInputValue = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const formatTime = (value?: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = match[2];
  return `${hours % 12 || 12}:${minutes} ${hours >= 12 ? "PM" : "AM"}`;
};

function FlightLegDetails({ flight }: { flight: LiveFlight }) {
  if (!flight.segments?.length) return null;
  return <div className="flight-leg-details">
    <strong className="flight-leg-details-title">Flight-by-flight itinerary</strong>
    {flight.segments.map((segment, index) => {
      const next = flight.segments[index + 1];
      const layover = next ? flightLayoverDuration(segment.arrival, next.departure, segment.toAirportCode) : null;
      return <div className="flight-leg" key={`${flight.id}-segment-${index}`}>
        <div className="flight-leg-heading"><strong>Leg {index + 1}{segment.flightNumber ? ` · ${segment.airline} ${segment.flightNumber}` : ` · ${segment.airline}`}</strong><span>{duration(segment.durationMinutes)}</span></div>
        <div className="flight-leg-route">
          <div className="flight-leg-endpoint"><small>DEPARTS</small><strong>{segment.from}</strong><span>{formatFlightTimeAtAirport(segment.departure, segment.fromAirportCode)}</span></div>
          <ArrowRight size={16} aria-hidden="true"/>
          <div className="flight-leg-endpoint"><small>ARRIVES</small><strong>{segment.to}</strong><span>{formatFlightTimeAtAirport(segment.arrival, segment.toAirportCode)}</span></div>
        </div>
        {next && <div className="flight-layover-note"><Clock3 size={13}/><span><strong>Connection at {segment.to}</strong>{` · Next flight departs ${formatFlightTimeAtAirport(next.departure, next.fromAirportCode)}${layover ? ` · ${layover} layover` : ""}`}</span></div>}
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
function supplierFreshnessLabel(state?: SupplierLookupState): string {
  if (!state?.checkedAt) return "Supplier check time not supplied";
  const checked = cacheAgeLabel(state.checkedAt);
  const sourceAge = state.dataAsOf ? cacheAgeLabel(state.dataAsOf) : "time unknown";
  if (state.stale) return `Lookup attempted ${checked} · using saved fallback data from ${sourceAge}`;
  if (state.servedFromCache) return `Lookup served ${checked} · cached provider data from ${sourceAge}`;
  return `Provider response checked ${checked} · data received ${sourceAge}`;
}
function directionsUrl(origin: string, destination: string): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1"); url.searchParams.set("origin", origin); url.searchParams.set("destination", destination); url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function buildSavedTripSnapshot(
  search: TripSearchInput,
  recommendations: TripRecommendation[],
  states: Record<string, SearchState>,
  selections: Record<string, DestinationSelection>,
): SavedTripSnapshot {
  const destinations = recommendations.map((recommendation) => {
    const destination = recommendation.destination;
    const selection = selections[destination.id] ?? emptySelection();
    const result = states[destination.id]?.result;
    const items: SavedTripItem[] = [];
    const destinationAirportCode = search.destinationAirportCode || destination.airportCode || "";
    const fallbackSort = (date: string, time: string) => airportLocalDateTimeToTimestamp(date, time, destinationAirportCode)
      ?? (() => { const [year, month, day] = date.split("-").map(Number); const [hour, minute] = time.split(":").map(Number); return Date.UTC(year, month - 1, day, hour, minute); })();
    const defaultSlotTime: Record<ExperienceSlot, string> = {
      Morning: "09:00", Lunch: "12:00", Afternoon: "15:00", Dinner: "19:00", Evening: "20:30",
    };
    const outboundSegments = selection.outbound?.segments ?? [];
    const returnSegments = selection.returnFlight?.segments ?? [];
    const outboundDeparture = outboundSegments[0];
    const outboundArrival = outboundSegments[outboundSegments.length - 1];
    const returnDeparture = returnSegments[0];
    const outboundSortAt = selection.outbound
      ? flightTimeSortTimestamp(outboundDeparture?.departure || selection.outbound.departure, outboundDeparture?.fromAirportCode) ?? fallbackSort(search.departureDate, "00:00")
      : null;
    const returnSortAt = selection.returnFlight
      ? flightTimeSortTimestamp(returnDeparture?.departure || selection.returnFlight.departure, returnDeparture?.fromAirportCode) ?? fallbackSort(search.returnDate, "23:59")
      : null;

    const addFlight = (flight: LiveFlight, kind: "outbound-flight" | "return-flight", date: string, sortTimestamp: number) => {
      const first = flight.segments[0];
      const last = flight.segments[flight.segments.length - 1];
      const details = [
        `Departs ${flight.from} · ${formatFlightTimeAtAirport(flight.departure, first?.fromAirportCode)}`,
        `Arrives ${flight.to} · ${formatFlightTimeAtAirport(flight.arrival, last?.toAirportCode)}`,
        `Duration ${duration(flight.durationMinutes)} · ${flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops === 1 ? "" : "s"}`}`,
        ...flight.segments.map((segment, index) => `Leg ${index + 1}: ${segment.airline}${segment.flightNumber ? ` ${segment.flightNumber}` : ""} · ${segment.from} ${formatFlightTimeAtAirport(segment.departure, segment.fromAirportCode)} → ${segment.to} ${formatFlightTimeAtAirport(segment.arrival, segment.toAirportCode)}`),
      ].filter(Boolean);
      items.push({
        kind,
        title: kind === "outbound-flight" ? "Outbound flight" : "Return flight",
        subtitle: `${flight.airlines.join(" / ")} · ${flight.from} → ${flight.to}`,
        date,
        sortTimestamp,
        selectionRef: {
          type: "flight",
          direction: kind === "outbound-flight" ? "outbound" : "return",
          from: flight.from, to: flight.to, departure: flight.departure, arrival: flight.arrival,
          segmentKeys: flight.segments.map((segment) => [segment.airline, segment.flightNumber, segment.from, segment.to, segment.departure, segment.arrival].join("|")),
        },
        details,
      });
    };

    if (selection.outbound && outboundSortAt !== null) addFlight(selection.outbound, "outbound-flight", search.departureDate, outboundSortAt);
    if (selection.returnFlight && returnSortAt !== null) addFlight(selection.returnFlight, "return-flight", search.returnDate, returnSortAt);

    // Google Flights labels these option prices as round-trip results. Store one
    // indicative reference for the selected itinerary; never repeat the same
    // round-trip quote on both the outbound and return schedule events.
    if (selection.flightSeller || selection.outbound?.price != null || selection.returnFlight?.price != null) {
      const offer = selection.flightSeller?.option;
      const referencePrice = selection.outbound?.price ?? selection.returnFlight?.price ?? null;
      const flightSearchUrl = result?.providerSearchLinks?.flights;
      items.push({
        kind: "flight-fare",
        title: offer ? "Selected seller fare" : "Indicative round-trip flight price",
        subtitle: offer ? offer.seller : `${selection.outbound?.airlines.join(" / ") || selection.returnFlight?.airlines.join(" / ") || "Google Flights"} · ${selection.outbound?.from || selection.returnFlight?.from || "Origin"} → ${selection.outbound?.to || selection.returnFlight?.to || "Destination"}`,
        date: search.departureDate,
        sortTimestamp: (outboundSortAt ?? fallbackSort(search.departureDate, "00:00")) + 1,
        price: offer ? offer.price : referencePrice,
        currency: offer?.currency || selection.outbound?.currency || selection.returnFlight?.currency || search.currency,
        ...(offer ? { selectionRef: { type: "flight-seller" as const, seller: offer.seller, fareType: offer.type, price: offer.price, currency: offer.currency || search.currency } } : {}),
        priceLabel: offer
          ? "Provider-displayed seller quote for the selected round trip · confirm ticketing, passengers, taxes and fees at checkout"
          : "One round-trip search reference · not a separate price for each direction or a confirmed seller total",
        ...(flightSearchUrl ? { websiteUrl: flightSearchUrl, websiteLabel: "Open this Google Flights search" } : {}),
        details: offer
          ? [offer.type, offer.separateTickets ? "Separate outbound and return tickets" : "Combined-ticket status must be confirmed at checkout", ...(offer.departingPrice != null ? [`Outbound ticket: ${money(offer.departingPrice, offer.currency || search.currency)}`] : []), ...(offer.returningPrice != null ? [`Return ticket: ${money(offer.returningPrice, offer.currency || search.currency)}`] : [])]
          : ["This amount is shown once for the round-trip itinerary. Do not add it again to the outbound or return flight."],
      });
    }
    if (selection.hotel) {
      const hotel = selection.hotel;
      const nights = Math.max(1, Math.round((new Date(`${search.returnDate}T00:00:00Z`).getTime() - new Date(`${search.departureDate}T00:00:00Z`).getTime()) / 86400000));
      const inferredArrival = outboundArrival ? flightTimeSortTimestamp(outboundArrival.arrival, outboundArrival.toAirportCode) : null;
      const inferredReturnDeparture = returnDeparture ? flightTimeSortTimestamp(returnDeparture.departure, returnDeparture.fromAirportCode) : null;
      const checkInSortAt = selection.checkInTime
        ? fallbackSort(search.departureDate, selection.checkInTime)
        : inferredArrival !== null ? inferredArrival + 60_000 : fallbackSort(search.departureDate, "15:00");
      const checkOutSortAt = selection.checkOutTime
        ? fallbackSort(search.returnDate, selection.checkOutTime)
        : inferredReturnDeparture !== null ? inferredReturnDeparture - 60_000 : fallbackSort(search.returnDate, "18:00");
      items.push({
        kind: "stay-check-in",
        title: hotel.name,
        subtitle: hotel.address || `${hotel.source} · ${hotel.propertyType}`,
        date: search.departureDate,
        ...(selection.checkInTime ? { time: formatTime(selection.checkInTime) } : {}),
        sortTimestamp: checkInSortAt,
        price: hotel.totalPrice ?? hotel.nightlyPrice,
        currency: hotel.currency || search.currency,
        priceLabel: hotel.totalPrice !== null ? "Provider-displayed stay total · verify taxes and fees" : hotel.nightlyPrice !== null ? "Provider-displayed nightly price · not the stay total" : "Provider price basis unavailable",
        ...(hotel.image ? { imageUrl: hotel.image } : {}),
        ...(hotel.rating !== null ? { rating: hotel.rating } : {}),
        ...(hotel.reviews !== null ? { reviewCount: hotel.reviews } : {}),
        ...(hotel.bookingUrl ? { websiteUrl: hotel.bookingUrl, websiteLabel: "View property listing" } : {}),
        ...(hotel.address || (hotel.latitude !== null && hotel.longitude !== null) ? { mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotel.latitude !== null && hotel.longitude !== null ? `${hotel.latitude},${hotel.longitude}` : `${hotel.name} ${hotel.address}`)}` } : {}),
        sourceLabel: hotel.source,
        selectionRef: { type: "stay", name: hotel.name, address: hotel.address },
        details: [`Check-in · ${nights} ${nights === 1 ? "night" : "nights"}`, `${search.returnDate} check-out`, `${hotel.source} · ${hotel.propertyType}`],
      });
      items.push({
        kind: "stay-check-out",
        title: hotel.name,
        subtitle: hotel.address || `${hotel.source} · ${hotel.propertyType}`,
        date: search.returnDate,
        ...(selection.checkOutTime ? { time: formatTime(selection.checkOutTime) } : {}),
        sortTimestamp: checkOutSortAt,
        details: ["Check-out · end of the selected stay", `${hotel.source} · ${hotel.propertyType}`],
      });
    }
    for (const [experienceId, plan] of Object.entries(selection.experiences)) {
      const experience = result?.experiences.find((item) => item.id === experienceId);
      if (!experience) continue;
      const orderTime = plan.time || defaultSlotTime[plan.slot];
      items.push({
        kind: experience.kind,
        title: experience.name,
        subtitle: experience.address || experience.category,
        date: plan.date,
        time: plan.time || plan.slot,
        sortTimestamp: fallbackSort(plan.date, orderTime),
        ...(experience.thumbnail ? { imageUrl: experience.thumbnail } : {}),
        ...(experience.rating !== null ? { rating: experience.rating } : {}),
        ...(experience.reviews !== null ? { reviewCount: experience.reviews } : {}),
        ...(experience.website ? { websiteUrl: experience.website, websiteLabel: "Official website" } : {}),
        ...(experience.mapsUrl ? { mapsUrl: experience.mapsUrl } : {}),
        ...(experience.source ? { sourceLabel: experience.source } : {}),
        selectionRef: { type: "experience", kind: experience.kind, name: experience.name, address: experience.address, category: experience.category, date: plan.date, slot: plan.slot, ...(plan.time ? { time: plan.time } : {}) },
        details: [experience.category, ...(experience.openingHours ? [`Listed hours: ${experience.openingHours}`] : [])],
      });
    }
    return { label: formatDestinationLabel(destination.city, destination.country), items: sortSavedTripItemsChronologically(items) };
  });

  const destinationLabel = formatTripDestinationLabel(search.destination, search.destinationArea);
  return {
    version: 1,
    title: search.destination.toLowerCase() === "anywhere" ? "Trip ideas worth comparing" : `Trip to ${destinationLabel}`,
    destinations,
  };
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
  return `${option.seller}|${option.type}|${option.price ?? ""}|${option.departingPrice ?? ""}|${option.returningPrice ?? ""}|${option.url ?? ""}`;
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
  if (state.loading && !state.options) return <p className="inline-loading"><RefreshCw size={13} className="spin"/> Loading airline and seller offers…</p>;
  if (!state.options) return state.error ? <p className="provider-inline-error">{state.error}</p> : null;
  return <div className="booking-options-list">
    {state.loading && <p className="inline-loading"><RefreshCw size={12} className="spin"/> Rechecking seller prices…</p>}
    {state.error && <p className="provider-inline-error">The refresh did not complete. Previously retrieved offers remain visible: {state.error}</p>}
    <small className="supplier-freshness-note">{supplierFreshnessLabel(state)}. Seller prices are snapshots, not a booking hold; confirm passenger basis, baggage, taxes, fees and availability at checkout.</small>
    {state.options.length ? state.options.map((option, index) => {
      const selected = Boolean(selectedOption && bookingOptionKey(selectedOption) === bookingOptionKey(option));
      return <div className={`booking-option-row ${selected ? "is-selected" : ""}`} key={`${option.seller}-${index}`}>
        <span className="booking-option-description"><strong>{option.seller}</strong><small>{option.type}{(option.fareTerms.length > 0 || option.baggage.length > 0) ? ` · ${[...option.fareTerms, ...option.baggage].join(" · ")}` : ""}</small>
          {option.separateTickets
            ? <small className="booking-separate-ticket-breakdown">Separate tickets{option.departingPrice !== null && option.departingPrice !== undefined ? ` · Outbound ${money(option.departingPrice, option.currency || currency)}${option.departingSeller ? ` (${option.departingSeller})` : ""}` : ""}{option.returningPrice !== null && option.returningPrice !== undefined ? ` · Return ${money(option.returningPrice, option.currency || currency)}${option.returningSeller ? ` (${option.returningSeller})` : ""}` : ""}{option.price !== null ? ` · Total ${money(option.price, option.currency || currency)}` : " · Confirm both leg prices with seller"}</small>
            : <small className="booking-combined-ticket-note">Seller offer for the selected round-trip itinerary; confirm ticketing and final passenger total at checkout.</small>}
        </span>
        <b>{option.price !== null ? money(option.price, option.currency || currency) : "See seller"}</b>
        <button type="button" className="booking-select-button" onClick={() => onSelectSeller(option)}>{selected ? <><Check size={11}/> Selected</> : "Select seller"}</button>
        <BookingContinue option={option}/>
      </div>;
    }) : <small>No direct seller links were returned for this selection. Open the exact Google Flights search above to compare booking options.</small>}
  </div>;
}

function ReturnOptions({ state, onSelectReturn, selectedReturnId }: {
  state?: ReturnState;
  onSelectReturn: (flight: LiveFlight) => void;
  selectedReturnId?: string;
}) {
  if (!state) return null;
  return <div className="return-options-panel">
    <div className="return-options-heading"><strong>Choose your return flight</strong>{state.result && <small>Checked {new Date(state.result.dataAsOf).toLocaleString()}</small>}</div>
    <p className="return-seller-note">Choose a return leg first. Seller comparison then checks booking options for the complete outbound + return itinerary.</p>
    {state.loading && <p className="inline-loading"><RefreshCw size={13} className="spin"/> Matching return legs to this outbound flight…</p>}
    {state.error && <p className="provider-inline-error">{state.error}</p>}
    {state.result?.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}
    {state.result?.flights.map((flight) => <div id={getTripAssistantResultAnchor("flight", flight.id)} tabIndex={-1} className={`return-flight-option ${selectedReturnId === flight.id ? "is-selected" : ""}`} key={flight.id}>
      <div className="return-flight-copy"><strong>{formatFlightTimeAtAirport(flight.departure, flight.segments[0]?.fromAirportCode)} <span>→</span> {formatFlightTimeAtAirport(flight.arrival, flight.segments[flight.segments.length - 1]?.toAirportCode)}</strong><small>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</small><small>{flight.from} → {flight.to}</small></div>
      <div className="return-flight-action">
        <small>Return leg of this round-trip search</small>
        <button type="button" className={`selection-button ${selectedReturnId === flight.id ? "is-selected" : ""}`} onClick={() => onSelectReturn(flight)}>{selectedReturnId === flight.id ? <><Check size={13}/> Return selected · Remove</> : "Select return"}</button>
      </div>
      <FlightLegDetails flight={flight}/>
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
  onLoadBookingOptions: (flight: LiveFlight, forceRefresh?: boolean) => void;
  onSelectSeller: (flight: LiveFlight, option: FlightBookingOption) => void;
}) {
  // Round-trip booking options normally become available on the selected
  // return result. Prefer that token; use an outbound token only if supplied.
  const sellerLookupFlight = selectedReturnFlight?.bookingToken
    ? selectedReturnFlight
    : flight.bookingToken ? flight : null;
  const sellerState = sellerLookupFlight ? bookingStates[sellerLookupFlight.id] : undefined;
  return <article id={getTripAssistantResultAnchor("flight", flight.id)} tabIndex={-1} className={`live-offer-card ${selectedOutbound ? "is-selected" : ""}`}>
    <div className="live-offer-main"><div className="live-offer-route"><strong>{formatFlightTimeAtAirport(flight.departure, flight.segments[0]?.fromAirportCode)}</strong><span>→</span><strong>{formatFlightTimeAtAirport(flight.arrival, flight.segments[flight.segments.length - 1]?.toAirportCode)}</strong></div><p>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</p><small>{flight.from} → {flight.to}</small></div>
    <div className="live-offer-price">{flight.price !== null ? <strong>{money(flight.price, flight.currency || currency)}</strong> : <strong>Price not supplied</strong>}<small>Indicative price from the initial round-trip search. It is not a confirmed combined outbound + return seller fare.</small>
      <button className={`selection-button ${selectedOutbound ? "is-selected" : ""}`} type="button" disabled={returnState?.loading} onClick={() => onSelectOutbound(flight)}>{returnState?.loading && selectedOutbound ? <><RefreshCw size={12} className="spin"/> Finding returns</> : selectedOutbound ? <><Check size={13}/> Outbound selected</> : <>Choose outbound <ArrowRight size={12}/></>}</button>
      {selectedOutbound && selectedReturnFlight && sellerLookupFlight && <button className="text-action" type="button" onClick={() => onLoadBookingOptions(sellerLookupFlight, Boolean(sellerState?.options))} disabled={sellerState?.loading}>{sellerState?.loading ? (sellerState?.options ? "Rechecking prices…" : "Loading sellers…") : sellerState?.options ? "Recheck seller prices" : "Compare round-trip sellers"} <ArrowUpRight size={12}/></button>}
      {selectedOutbound && !selectedReturnFlight && <small className="seller-compare-hint">Select a return flight to compare sellers for the complete trip.</small>}
      {selectedOutbound && selectedReturnFlight && !sellerLookupFlight && <small className="seller-compare-hint">Seller booking links were not supplied for this return option. Use the exact Google Flights search above.</small>}
    </div>
    <FlightLegDetails flight={flight}/>
    {selectedOutbound && sellerLookupFlight && <BookingOptions state={sellerState} currency={currency} selectedOption={selectedSeller?.flightId === sellerLookupFlight.id ? selectedSeller.option : null} onSelectSeller={(option) => onSelectSeller(sellerLookupFlight, option)}/>}
    {selectedOutbound && <ReturnOptions state={returnState} onSelectReturn={onSelectReturn} selectedReturnId={selectedReturnFlight?.id}/>}
  </article>;
}

function RouteLookup({ origin, destination, label, originCoordinates, destinationCoordinates }: {
  origin: string;
  destination: string;
  label: string;
  originCoordinates?: { latitude: number; longitude: number };
  destinationCoordinates?: { latitude: number; longitude: number };
}) {
  const [state, setState] = useState<RouteState | null>(null);
  async function load(forceMapRefresh = false) {
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const response = await fetch("/api/travel/directions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin, destination, originCoordinates, destinationCoordinates, forceMapRefresh }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Driving route unavailable.");
      setState({
        loading: false,
        distance: String(data.distance || ""),
        duration: String(data.duration || ""),
        durationInTraffic: typeof data.durationInTraffic === "string" ? data.durationInTraffic : undefined,
        source: typeof data.source === "string" ? data.source : undefined,
        mapImageDataUrl: typeof data.mapImageDataUrl === "string" && data.mapImageDataUrl.startsWith("data:image/") ? data.mapImageDataUrl : undefined,
        mapWarning: typeof data.mapWarning === "string" ? data.mapWarning : undefined,
        directions: Array.isArray(data.directions) ? data.directions.filter((item: unknown): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 16) : [],
        startAddress: typeof data.startAddress === "string" ? data.startAddress : undefined,
        endAddress: typeof data.endAddress === "string" ? data.endAddress : undefined,
      });
    } catch (error) {
      setState({ loading: false, error: error instanceof Error ? error.message : "Driving route unavailable." });
    }
  }
  return <div className="route-lookup">
    <button type="button" onClick={() => load(Boolean(state?.duration && !state?.mapImageDataUrl))} disabled={state?.loading}>{state?.loading ? <><RefreshCw size={11} className="spin"/> Calculating route</> : state?.duration ? "Refresh route" : label}</button>
    {state?.duration && <div className="route-result">
      <strong>{state.distance} · {state.duration}{state.durationInTraffic ? ` · ${state.durationInTraffic} in traffic` : ""}</strong>
      {state.startAddress && state.endAddress && <small>{state.startAddress} → {state.endAddress}</small>}
      {state.mapImageDataUrl
        ? <div className="route-map-preview"><img src={state.mapImageDataUrl} alt={`Driving route map from ${origin} to ${destination}`} loading="lazy"/><small>Route preview · A = start · B = destination · Powered by Geoapify · © OpenStreetMap contributors</small></div>
        : <small className="route-source-note">{state.mapWarning ? `Map preview unavailable: ${state.mapWarning}. ` : "A map preview was not returned for this route. "}Open Google Maps for the interactive map and turn-by-turn directions.</small>}
      {state.source?.includes("Geoapify") && <small className="route-source-note">Estimated route · no live traffic</small>}
      <a href={directionsUrl(origin, destination)} target="_blank" rel="noreferrer" className="route-open-maps">Open turn-by-turn navigation in Google Maps <ArrowUpRight size={12}/></a>
      {Boolean(state.directions?.length) ? <details className="route-directions"><summary>Turn-by-turn steps</summary><ol>{state.directions?.filter((step) => Boolean(step.trim())).map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol></details> : state.source?.includes("Geoapify") ? <small className="route-source-note">Turn-by-turn step text was not supplied for this route. Open Google Maps for navigation instructions.</small> : null}
    </div>}
    {state?.error && <><small className="route-error">{state.error}</small><a href={directionsUrl(origin, destination)} target="_blank" rel="noreferrer">Open route in Maps</a></>}
  </div>;
}

function HotelResult({ hotel, currency, airportCode, experiences, nights, search, bookingState, selected, onSelect, onLoadBookingOptions }: {
  hotel: LiveHotel; currency: string; airportCode: string; experiences: LiveExperience[]; nights: number; search: TripSearchInput;
  bookingState?: HotelBookingState; selected: boolean; onSelect: (hotel: LiveHotel) => void; onLoadBookingOptions: (hotel: LiveHotel, forceRefresh?: boolean) => void;
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
      {hotel.providerOffers.some((offer) => offer.url) && <div className="hotel-provider-links"><strong>Available booking sites</strong>{hotel.providerOffers.filter((offer) => offer.url).slice(0, 4).map((offer, index) => <div className="hotel-provider-offer" key={`${offer.seller}-${index}`}><span><b>{offer.seller}</b><small>{offer.price !== null ? `${money(offer.price, offer.currency || currency)}${offer.priceBasis === "stay" ? " total stay" : offer.priceBasis === "night" ? " per night" : " · price basis not supplied"}` : "Price not supplied"}</small></span><a href={offer.url} target="_blank" rel="noreferrer">Open seller <ExternalLink size={11}/></a></div>)}</div>}
      {(airportDistance !== null || nearestActivities.length > 0 || hotel.nearbyPlaces.length > 0) && <div className="hotel-proximity">
        {airportDistance !== null && airport && <span>{airport.name}{!airportCode ? " · nearest listed airport" : ""}: {distanceLabel(airportDistance)} straight-line</span>}
        {airport && <RouteLookup origin={hotelOrigin} destination={airport.name} label="Check drive to airport" originCoordinates={hotel.latitude !== null && hotel.longitude !== null ? { latitude: hotel.latitude, longitude: hotel.longitude } : undefined} destinationCoordinates={{ latitude: airport.latitude, longitude: airport.longitude }}/>}
        {hotel.nearbyPlaces.slice(0, 4).map((place) => <span className="hotel-nearby-place" key={`${place.name}-${place.category}`}><strong>{place.name}</strong>{place.category !== "Place" && ` · ${place.category}`}{place.transportations.length > 0 && ` · ${place.transportations.map((item) => `${item.type} ${item.duration}`).join(" · ")}`}</span>)}
        {nearestActivities.map(({ item, miles }) => <div className="hotel-activity-distance" key={item.id}>{item.name}: {distanceLabel(miles)} straight-line <RouteLookup origin={hotelOrigin} destination={item.address || `${item.latitude},${item.longitude}`} label="Driving time" originCoordinates={{ latitude: hotel.latitude!, longitude: hotel.longitude! }} destinationCoordinates={{ latitude: item.latitude!, longitude: item.longitude! }}/></div>)}
      </div>}
      {bookingState?.loading && <p className="inline-loading"><RefreshCw size={12} className="spin"/> Retrieving property booking options…</p>}
      {bookingState?.error && !bookingState.options && <p className="provider-inline-error">{bookingState.error}</p>}
      {bookingState?.options && <div className="hotel-booking-options">{bookingState.error && <p className="provider-inline-error">The refresh did not complete. Previously retrieved rates remain visible: {bookingState.error}</p>}<small className="supplier-freshness-note">{supplierFreshnessLabel(bookingState)}. Rates are not a booking hold; confirm room availability, guest allocation, taxes and fees at checkout.</small>{bookingState.options.length ? bookingState.options.map((option, index) => <div className="hotel-booking-option" key={`${option.seller}-${index}`}><span><strong>{option.seller}</strong>{option.terms.length > 0 && <small>{option.terms.join(" · ")}</small>}</span><b>{option.price !== null ? `${money(option.price, option.currency || currency)}${option.priceBasis === "stay" ? " · total stay" : option.priceBasis === "night" ? " · per night" : " · basis not supplied"}` : "See provider"}</b>{option.url && <a href={option.url} target="_blank" rel="noreferrer">Open seller <ArrowUpRight size={11}/></a>}</div>) : <p>No separate seller offers were returned. The property link remains available above.</p>}</div>}
    </div>
    <div className="live-hotel-price">
      {hotel.totalPrice !== null ? <strong>{money(hotel.totalPrice, hotel.currency || currency)}</strong> : hotel.nightlyPrice !== null ? <><strong>{money(hotel.nightlyPrice * nights, hotel.currency || currency)}</strong><small>Estimated {nights}-night total before taxes and fees</small><small>{money(hotel.nightlyPrice, hotel.currency || currency)} per night</small></> : <strong>Price unavailable</strong>}
      {hotel.totalPrice !== null && <small>Provider-displayed total for {nights} nights</small>}
      <button type="button" className={`selection-button ${selected ? "is-selected" : ""}`} onClick={() => onSelect(hotel)}>{selected ? <><Check size={13}/> Stay selected · Remove</> : "Select this stay"}</button>
      {hotel.propertyToken && <button type="button" className="text-action" onClick={() => onLoadBookingOptions(hotel, Boolean(bookingState?.options))} disabled={bookingState?.loading}>{bookingState?.loading ? (bookingState?.options ? "Rechecking rates…" : "Loading rates…") : bookingState?.options ? "Recheck current rates" : "Compare rates"} <ArrowUpRight size={12}/></button>}
      <a className="hotel-primary-link" href={propertyUrl} target="_blank" rel="noreferrer">{hotel.bookingUrlLabel} <ExternalLink size={12}/></a>
    </div>
  </article>;
}

function ProximityStartingPointPanel({ destinationId, point, defaultOriginLabel, defaultOriginAddress, value, loading, error, onChange, onSubmit, onClear }: {
  destinationId: string;
  point?: ProximityStartingPoint;
  defaultOriginLabel?: string;
  defaultOriginAddress?: string;
  value: string;
  loading: boolean;
  error?: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return <section className="proximity-origin-panel" aria-labelledby={`proximity-origin-title-${destinationId}`}>
    <div className="proximity-origin-copy">
      <div><MapPin size={15}/><strong id={`proximity-origin-title-${destinationId}`}>Your starting point</strong><span>Optional · no hotel booking required</span></div>
      {point
        ? <p>Using your custom starting point: <strong>{point.label}</strong> · {point.address}</p>
        : defaultOriginLabel
          ? <p>Using your selected stay by default: <strong>{defaultOriginLabel}</strong>{defaultOriginAddress ? ` · ${defaultOriginAddress}` : ""}</p>
          : null}
    </div>
    <form className="proximity-origin-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={defaultOriginLabel ? "Use a different starting point (optional)" : "Hotel, Airbnb, college, venue or street address"} aria-label="Where you will be staying or starting from" maxLength={180}/>
      <button type="submit" disabled={loading || value.trim().length < 4}>{loading ? <><RefreshCw size={12} className="spin"/> Finding</> : point ? "Update point" : "Use this location"}</button>
      {point && <button type="button" className="proximity-origin-clear" onClick={onClear}>Clear</button>}
    </form>
    {error && <p className="proximity-origin-error" role="alert">{error}</p>}
    <small>{point ? "Your custom starting point overrides the selected stay for activities and restaurants. " : defaultOriginLabel ? "Your selected hotel or Airbnb is the default origin for activities and restaurants. Enter a different point above to override it. " : "Set a starting point to compare nearby activities and restaurants. "}Distances are straight-line estimates; driving routes are calculated only when requested. A custom starting point is saved in this browser and is not included in the public trip share link.</small>
  </section>;
}

function ExperienceResult({ experience, hotels, selectedHotel, startingPoint, airportCode, search, days, selected, onSelectionChange }: {
  experience: LiveExperience;
  hotels: LiveHotel[];
  selectedHotel?: LiveHotel | null;
  startingPoint?: ProximityStartingPoint;
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
  const nearbyStays = !selectedHotel && search.components.includes("stays") && experience.latitude !== null && experience.longitude !== null
    ? hotels.filter((hotel) => hotel.latitude !== null && hotel.longitude !== null).map((hotel) => ({ hotel, miles: haversineMiles(experience.latitude!, experience.longitude!, hotel.latitude!, hotel.longitude!) })).sort((a, b) => a.miles - b.miles).slice(0, 2)
    : [];
  const selectedStayLocation = selectedHotel?.address || (selectedHotel && selectedHotel.latitude !== null && selectedHotel.longitude !== null ? `${selectedHotel.latitude},${selectedHotel.longitude}` : selectedHotel?.name || "");
  const selectedStayMiles = selectedHotel && selectedHotel.latitude !== null && selectedHotel.longitude !== null && experience.latitude !== null && experience.longitude !== null
    ? haversineMiles(selectedHotel.latitude, selectedHotel.longitude, experience.latitude, experience.longitude)
    : null;
  const startingPointMiles = startingPoint && experience.latitude !== null && experience.longitude !== null
    ? haversineMiles(startingPoint.latitude, startingPoint.longitude, experience.latitude, experience.longitude)
    : null;
  const startingPointLocation = startingPoint?.address || (startingPoint ? `${startingPoint.latitude},${startingPoint.longitude}` : "");
  const airport = experience.latitude !== null && experience.longitude !== null
    ? nearestKnownAirport(experience.latitude, experience.longitude, airportCode) : null;
  const airportMiles = airport?.miles ?? null;
  const activityLocation = experience.address || (experience.latitude !== null && experience.longitude !== null ? `${experience.latitude},${experience.longitude}` : experience.name);
  const ticketSearchText = `${experience.name} ${experience.address} ${search.destination || ""}`.replace(/\s+/g, " ").trim();
  const ticketQuery = encodeURIComponent(ticketSearchText);
  const viatorUrl = `https://www.viator.com/searchResults/all?text=${ticketQuery}`;
  const getYourGuideUrl = `https://www.getyourguide.com/s/?q=${ticketQuery}`;
  const googleMapsPlaceUrl = experience.mapsUrl.includes("google.com/maps")
    ? experience.mapsUrl
    : experience.latitude !== null && experience.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${experience.latitude},${experience.longitude}`)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${experience.name} ${experience.address}`)}`;
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
  return <article id={getTripAssistantResultAnchor(experience.kind, experience.id)} tabIndex={-1} className={`experience-card ${experience.thumbnail ? "has-image" : "no-image"} ${selected ? "is-selected" : ""}`}>
    {experience.thumbnail && <img src={experience.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer"/>}
    <div className="experience-copy"><div className="experience-title"><h4><a href={experience.website || experience.mapsUrl} target="_blank" rel="noreferrer">{experience.name} <ExternalLink size={11}/></a></h4>{experience.rating !== null && <span><Star size={12} fill="currentColor"/> {experience.rating.toFixed(1)}{experience.reviews ? ` · ${experience.reviews.toLocaleString()}` : ""}</span>}</div><p>{experience.category}{experience.address ? ` · ${experience.address}` : ""}</p>{experience.openState && <small>{experience.openState}</small>}{experience.openingHours && <small>Hours listed: {experience.openingHours} · confirm directly before visiting</small>}{experience.price && <small>{experience.price}</small>}{experience.source?.includes("Geoapify") && <small className="experience-attribution">Place data via <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a></small>}
      {startingPoint && startingPointLocation
        ? <div className="experience-distances"><div>{startingPointMiles !== null ? `${distanceLabel(startingPointMiles)} straight-line from ${startingPoint.label}` : `From ${startingPoint.label}`}<RouteLookup origin={startingPointLocation} destination={activityLocation} label="Show driving route from your starting point" originCoordinates={{ latitude: startingPoint.latitude, longitude: startingPoint.longitude }} destinationCoordinates={experience.latitude !== null && experience.longitude !== null ? { latitude: experience.latitude, longitude: experience.longitude } : undefined}/></div></div>
        : selectedHotel && selectedStayLocation
          ? <div className="experience-distances"><div>{selectedStayMiles !== null ? `${distanceLabel(selectedStayMiles)} straight-line from selected stay · ${selectedHotel.name}` : `From selected stay · ${selectedHotel.name}`}<RouteLookup origin={selectedStayLocation} destination={activityLocation} label="Show driving route from selected stay" originCoordinates={selectedHotel.latitude !== null && selectedHotel.latitude !== undefined && selectedHotel.longitude !== null ? { latitude: selectedHotel.latitude, longitude: selectedHotel.longitude } : undefined} destinationCoordinates={experience.latitude !== null && experience.longitude !== null ? { latitude: experience.latitude, longitude: experience.longitude } : undefined}/></div></div>
          : nearbyStays.length > 0 && <div className="experience-distances">{nearbyStays.map(({ hotel, miles }) => {
            const hotelLocation = hotel.address || (hotel.latitude !== null && hotel.longitude !== null ? `${hotel.latitude},${hotel.longitude}` : hotel.name);
            return <div key={hotel.id}>{distanceLabel(miles)} from {hotel.name} (straight-line)<RouteLookup origin={hotelLocation} destination={activityLocation} label="Show driving route from hotel" originCoordinates={hotel.latitude !== null && hotel.longitude !== null ? { latitude: hotel.latitude, longitude: hotel.longitude } : undefined} destinationCoordinates={experience.latitude !== null && experience.longitude !== null ? { latitude: experience.latitude, longitude: experience.longitude } : undefined}/></div>;
          })}</div>}
      {search.components.includes("flights") && airport && airportMiles !== null && <div className="experience-distances"><div>{airport.name}{!airportCode ? " · nearest listed airport" : ""}: {distanceLabel(airportMiles)} straight-line<RouteLookup origin={airport.name} destination={activityLocation} label="Show driving route from airport" originCoordinates={{ latitude: airport.latitude, longitude: airport.longitude }} destinationCoordinates={experience.latitude !== null && experience.longitude !== null ? { latitude: experience.latitude, longitude: experience.longitude } : undefined}/></div></div>}
    </div>
    <div className="experience-actions">
      <label className="experience-schedule-field"><span>Trip day</span><select value={activeDate} onChange={(event) => setDate(event.target.value)}>{days.map((day) => <option value={day.date} key={day.date}>{day.label}</option>)}</select></label>
      <label className="experience-schedule-field"><span>{isRestaurant ? "Meal" : "Time of day"}</span><select value={activeSlot} onChange={(event) => setSlot(event.target.value as ExperienceSlot)}>{(isRestaurant ? ["Lunch", "Dinner"] : ["Morning", "Afternoon", "Evening"]).map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label>
      <label className="experience-schedule-field"><span>{isRestaurant ? "Reservation time · optional" : "Exact start time · optional"}</span><input type="time" value={activeTime} onChange={(event) => setTime(event.target.value)} aria-label={isRestaurant ? `Reservation time for ${experience.name}` : `Start time for ${experience.name}`}/></label>
      <button type="button" className={`selection-button ${selected ? "is-selected" : ""}`} onClick={() => onSelectionChange(experience, selected ? null : { date: activeDate, slot: activeSlot, time: activeTime || undefined })}>{selected ? <><Check size={13}/> Added to trip · Remove</> : isRestaurant ? "Add restaurant" : "Add activity"}</button>
      <small className="experience-time-note">A time you enter is a planning note; Tripfinder does not make or confirm reservations.</small>
      {experience.website && <a href={experience.website} target="_blank" rel="noreferrer" className="text-action">Official site <ArrowUpRight size={12}/></a>}
      <a href={googleMapsPlaceUrl} target="_blank" rel="noreferrer" className="text-action">Open exact location in Google Maps <ArrowUpRight size={12}/></a>
      {experience.source?.includes("Geoapify") && <a href={experience.mapsUrl} target="_blank" rel="noreferrer" className="text-action">View on OpenStreetMap <ArrowUpRight size={12}/></a>}
      {isRestaurant ? null : <><a href={viatorUrl} target="_blank" rel="noreferrer" className="text-action">Search Viator for this place <ArrowUpRight size={12}/></a><a href={getYourGuideUrl} target="_blank" rel="noreferrer" className="text-action">Search GetYourGuide for this place <ArrowUpRight size={12}/></a><small className="experience-booking-link-note">These provider search links use this place name and address. They are not direct links to a verified tour at this exact attraction.</small></>}
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

function SelectedTripSummary({ selection, experiences, currency, nights, search }: {
  selection: DestinationSelection;
  experiences: LiveExperience[];
  currency: string;
  nights: number;
  search: TripSearchInput;
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
        <div className="trip-selection-card-heading"><span className="trip-selection-card-icon"><Plane size={15}/></span><div><strong>Flights</strong><small>{selection.returnFlight ? "Outbound and return selected · one round-trip search" : "Outbound selected · choose its matching return leg"}</small></div></div>
        {selection.outbound && <div className="trip-selection-line">
          <div><b>Outbound · {selection.outbound.from} → {selection.outbound.to}</b><span>{formatFlightTimeAtAirport(selection.outbound.departure, selection.outbound.segments[0]?.fromAirportCode)} – {formatFlightTimeAtAirport(selection.outbound.arrival, selection.outbound.segments[selection.outbound.segments.length - 1]?.toAirportCode)}</span>{selection.outbound.price !== null && <small>{money(selection.outbound.price, selection.outbound.currency || currency)} initial-search reference price · not a confirmed combined outbound + return seller fare</small>}</div>
          <a className="trip-selection-view-link" href={`#${getTripAssistantResultAnchor("flight", selection.outbound.id)}`}>View result <ArrowUpRight size={12}/></a>
        </div>}
        {selection.returnFlight && <div className="trip-selection-line">
          <div><b>Return · {selection.returnFlight.from} → {selection.returnFlight.to}</b><span>{formatFlightTimeAtAirport(selection.returnFlight.departure, selection.returnFlight.segments[0]?.fromAirportCode)} – {formatFlightTimeAtAirport(selection.returnFlight.arrival, selection.returnFlight.segments[selection.returnFlight.segments.length - 1]?.toAirportCode)}</span></div>
          <a className="trip-selection-view-link" href={`#${getTripAssistantResultAnchor("flight", selection.returnFlight.id)}`}>View result <ArrowUpRight size={12}/></a>
        </div>}
        {selection.flightSeller && <div className="trip-selection-inline-note">
          <span>Seller offer: {selection.flightSeller.option.seller} · {selection.flightSeller.option.price !== null ? money(selection.flightSeller.option.price, selection.flightSeller.option.currency || currency) : "Price not supplied"}</span>
          {selection.flightSeller.option.separateTickets && <small>Separate tickets{selection.flightSeller.option.departingPrice !== null && selection.flightSeller.option.departingPrice !== undefined ? ` · Outbound ${money(selection.flightSeller.option.departingPrice, selection.flightSeller.option.currency || currency)}` : ""}{selection.flightSeller.option.returningPrice !== null && selection.flightSeller.option.returningPrice !== undefined ? ` · Return ${money(selection.flightSeller.option.returningPrice, selection.flightSeller.option.currency || currency)}` : ""}. The legs are ticketed separately.</small>}
          <BookingContinue option={selection.flightSeller.option}/>
        </div>}
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
    flightSeller: selection.flightSeller ? {
      price: selection.flightSeller.option.price,
      currency: selection.flightSeller.option.currency,
      seller: selection.flightSeller.option.seller,
      type: selection.flightSeller.option.type,
      departingPrice: selection.flightSeller.option.departingPrice,
      returningPrice: selection.flightSeller.option.returningPrice,
      departingSeller: selection.flightSeller.option.departingSeller,
      returningSeller: selection.flightSeller.option.returningSeller,
    } : null,
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
  const selectedCount = Number(Boolean(selection.outbound)) + Number(Boolean(selection.returnFlight)) + Number(Boolean(selection.flightSeller)) + Number(Boolean(selection.hotel)) + selectedExperiences.length;
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
      <div><span>Priced subtotal (provider stay totals + entered estimates)</span><strong>{format(ledger.pricedSubtotal, currency)}</strong></div>
      {ledger.referenceOnlyTotal > 0 && <div><span>Reference-only display prices · excluded from subtotal</span><strong>{format(ledger.referenceOnlyTotal, currency)}</strong></div>}
      <div><span>Contingency</span><strong>{format(ledger.contingencyAmount, currency)}</strong></div>
      <div><span>Priced / entered planning amount</span><strong>{format(ledger.planningTotal, currency)}</strong></div>
      {ledger.referenceOnlyTotal > 0 && <div className="trip-cost-ledger-grand"><span>Displayed amount incl. reference prices · not a confirmed total</span><strong>{format(ledger.displayedTotalIncludingReferences, currency)}</strong></div>}
      <p>{ledger.referenceOnlyTotal > 0
        ? ledger.displayedTotalIncludingReferences > budget
          ? `Priced/entered items plus separate provider display prices amount to ${format(ledger.displayedTotalIncludingReferences, currency)}, which is ${format(ledger.displayedTotalIncludingReferences - budget, currency)} above your ${format(budget, currency)} budget. Flight references are not a confirmed combined fare, so treat this as a warning rather than a final total.`
          : `${format(ledger.referenceOnlyTotal, currency)} in provider display prices are excluded from the priced subtotal. The displayed amount including those references is ${format(ledger.displayedTotalIncludingReferences, currency)}, but your actual budget balance cannot be confirmed until the seller provides a comparable total fare and the remaining trip costs are priced.`
        : ledger.planningTotal === 0
          ? `No comparable provider totals or positive group estimates have been added yet. Budget remaining cannot be calculated from unpriced items.`
          : ledger.remainingBeforeUnpriced >= 0
            ? `${format(ledger.remainingBeforeUnpriced, currency)} of your ${format(budget, currency)} budget remains against the priced items and entered estimates shown. This is not a complete trip total.`
            : `Priced items and entered estimates exceed your ${format(budget, currency)} budget by ${format(Math.abs(ledger.remainingBeforeUnpriced), currency)}, before any unpriced categories.`}</p>
    </div>
    <details className={`trip-budget-readiness ${ledger.budgetEnforcement.ready ? "is-complete" : "is-advisory"}`}>
      <summary className="trip-budget-readiness-summary">
        <span className="trip-budget-readiness-label">Budget status</span>
        <span className="trip-budget-readiness-state">{ledger.budgetEnforcement.ready ? "Planning inputs complete" : "Some costs still need verification"}</span>
        <span className="trip-budget-readiness-disclosure">Details</span>
      </summary>
      <div className="trip-budget-readiness-details">
        {ledger.budgetEnforcement.ready
          ? <p>Planning amounts have been entered for the requested categories. Final taxes, fees and checkout prices can still change.</p>
          : <><p>Budget checks remain advisory until the requested costs have comparable, verified totals. Missing amounts are never treated as $0, and choices are not blocked using an incomplete total.</p><ul>{ledger.budgetEnforcement.reasons.slice(0, 5).map((reason) => <li key={reason}>{reason}</li>)}</ul></>}
      </div>
    </details>
    <p className="trip-cost-ledger-disclaimer">Flight-leg and seller display prices are shown as reference amounts and excluded from the priced subtotal until a comparable fare is confirmed for the selected itinerary and passenger basis. Activities and restaurant price text are not converted into totals. Ground transport, activities and dining estimates are optional group amounts entered by you; a blank field remains unpriced, while an explicit $0 is treated as your estimate. No currency conversion or taxes/fee assumptions are applied.</p>
  </section>;
}

type UnifiedScheduleEntry =
  | { kind: "flight"; id: string; date: string; sortAt: number; direction: "Outbound flight" | "Return flight"; flight: LiveFlight }
  | { kind: "stay"; id: string; date: string; sortAt: number; phase: "Check-in" | "Check-out"; hotel: LiveHotel | null }
  | { kind: "experience"; id: string; date: string; sortAt: number; experience: LiveExperience; plan: SelectedExperience };

function fallbackLocalDayTime(date: string, time: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
}

function UnifiedTripSchedule({ search, selection, experiences, days, nights, currency, destinationAirportCode, onUpdateStayTime, onUpdateExperience }: {
  search: TripSearchInput;
  selection: DestinationSelection;
  experiences: LiveExperience[];
  days: Array<{ date: string; label: string }>;
  nights: number;
  currency: string;
  destinationAirportCode: string;
  onUpdateStayTime: (field: "checkInTime" | "checkOutTime", value: string) => void;
  onUpdateExperience: (experience: LiveExperience, plan: SelectedExperience) => void;
}) {
  const hasFlights = search.components.includes("flights");
  const hasStays = search.components.includes("stays");
  const hotel = selection.hotel;
  const stayBookingUrl = hotel?.providerOffers.find((offer) => offer.url)?.url || hotel?.bookingUrl;
  const outboundSegments = selection.outbound?.segments ?? [];
  const returnSegments = selection.returnFlight?.segments ?? [];
  const outboundDeparture = outboundSegments[0];
  const outboundArrival = outboundSegments[outboundSegments.length - 1];
  const returnDeparture = returnSegments[0];
  const fallbackSort = (date: string, time: string) => airportLocalDateTimeToTimestamp(date, time, destinationAirportCode) ?? fallbackLocalDayTime(date, time);
  const entries: UnifiedScheduleEntry[] = [];

  if (hasFlights) {
    if (selection.outbound) {
      entries.push({
        kind: "flight", id: `outbound-${selection.outbound.id}`, date: search.departureDate,
        sortAt: flightTimeSortTimestamp(outboundDeparture?.departure || selection.outbound.departure, outboundDeparture?.fromAirportCode) ?? fallbackSort(search.departureDate, "00:00"),
        direction: "Outbound flight", flight: selection.outbound,
      });
    }
    if (hasStays) {
      const explicitCheckIn = selection.checkInTime ? fallbackSort(search.departureDate, selection.checkInTime) : null;
      const inferredArrival = outboundArrival ? flightTimeSortTimestamp(outboundArrival.arrival, outboundArrival.toAirportCode) : null;
      entries.push({
        kind: "stay", id: "stay-check-in", date: search.departureDate,
        sortAt: explicitCheckIn ?? (inferredArrival !== null ? inferredArrival + 60_000 : fallbackSort(search.departureDate, "15:00")),
        phase: "Check-in", hotel,
      });
      const explicitCheckOut = selection.checkOutTime ? fallbackSort(search.returnDate, selection.checkOutTime) : null;
      const inferredReturnDeparture = returnDeparture ? flightTimeSortTimestamp(returnDeparture.departure, returnDeparture.fromAirportCode) : null;
      entries.push({
        kind: "stay", id: "stay-check-out", date: search.returnDate,
        sortAt: explicitCheckOut ?? (inferredReturnDeparture !== null ? inferredReturnDeparture - 60_000 : fallbackSort(search.returnDate, "18:00")),
        phase: "Check-out", hotel,
      });
    }
    if (selection.returnFlight) {
      entries.push({
        kind: "flight", id: `return-${selection.returnFlight.id}`, date: search.returnDate,
        sortAt: flightTimeSortTimestamp(returnDeparture?.departure || selection.returnFlight.departure, returnDeparture?.fromAirportCode) ?? fallbackSort(search.returnDate, "23:59"),
        direction: "Return flight", flight: selection.returnFlight,
      });
    }
  } else if (hasStays) {
    entries.push({ kind: "stay", id: "stay-check-in", date: search.departureDate, sortAt: fallbackSort(search.departureDate, selection.checkInTime || "15:00"), phase: "Check-in", hotel });
    entries.push({ kind: "stay", id: "stay-check-out", date: search.returnDate, sortAt: fallbackSort(search.returnDate, selection.checkOutTime || "18:00"), phase: "Check-out", hotel });
  }

  const defaultSlotTime: Record<ExperienceSlot, string> = {
    Morning: "09:00", Lunch: "12:00", Afternoon: "15:00", Dinner: "19:00", Evening: "20:30",
  };
  experiences.forEach((experience) => {
    const plan = selection.experiences[experience.id];
    if (!plan) return;
    const orderTime = plan.time || defaultSlotTime[plan.slot];
    entries.push({
      kind: "experience", id: `experience-${experience.id}`, date: plan.date,
      sortAt: fallbackSort(plan.date, orderTime), experience, plan,
    });
  });

  entries.sort((a, b) => a.sortAt - b.sortAt || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  return <div className="itinerary-travel-timeline itinerary-unified-timeline" aria-label="Chronological trip schedule">
    {entries.length ? entries.map((entry) => {
      if (entry.kind === "flight") {
        const flight = entry.flight;
        const first = flight.segments[0];
        const last = flight.segments[flight.segments.length - 1];
        return <article className="itinerary-travel-item is-confirmed itinerary-unified-item" key={entry.id}>
          <div className="itinerary-travel-date"><span>{entry.direction}</span><strong>{dateShort(entry.date)}</strong></div>
          <div className="itinerary-travel-copy">
            <strong>{flight.from} → {flight.to}</strong>
            <p>{flight.airlines.join(" · ")} · {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`} · {duration(flight.durationMinutes)}</p>
            {first && last && <p><strong>Departure:</strong> {formatFlightTimeAtAirport(first.departure, first.fromAirportCode)} · <strong>Arrival:</strong> {formatFlightTimeAtAirport(last.arrival, last.toAirportCode)}</p>}
            <FlightLegDetails flight={flight}/>
            <a className="itinerary-timeline-link" href={`#${getTripAssistantResultAnchor("flight", flight.id)}`}>View selected {entry.direction.toLowerCase()} <ArrowUpRight size={12}/></a>
          </div>
          <small>Selected result</small>
        </article>;
      }

      if (entry.kind === "stay") {
        const isCheckIn = entry.phase === "Check-in";
        const timeValue = isCheckIn ? selection.checkInTime || "" : selection.checkOutTime || "";
        const field = isCheckIn ? "checkInTime" : "checkOutTime";
        return <article className={`itinerary-travel-item ${hotel ? "is-confirmed" : "is-pending"} itinerary-unified-item`} key={entry.id}>
          <div className="itinerary-travel-date"><span>{entry.phase}</span><strong>{dateShort(entry.date)}</strong></div>
          <div className="itinerary-travel-copy">
            <strong>{hotel ? hotel.name : `Accommodation ${entry.phase.toLowerCase()}`}</strong>
            <p>{isCheckIn
              ? hotel ? `${nights} ${nights === 1 ? "night" : "nights"}${hotel.totalPrice !== null ? ` · ${money(hotel.totalPrice, hotel.currency || currency)} provider-displayed stay total` : ""}.` : "Select a property to attach it to your trip."
              : hotel ? `End of your ${nights}-night stay.` : "Your requested stay ends on this date; select a property to attach it to your trip."}</p>
            {hotel && <div className="itinerary-time-editor"><label><span>{entry.phase} time confirmed by property</span><input type="time" value={timeValue} onChange={(event) => onUpdateStayTime(field, event.target.value)}/></label><small>{timeValue ? `Your note: ${formatTime(timeValue)} · verify against the property's booking confirmation.` : "Not supplied by the provider. Add the time from your booking confirmation."}</small></div>}
            {hotel && <div className="itinerary-timeline-links"><a className="itinerary-timeline-link" href={`#${getTripAssistantStayAnchor(hotel.id)}`}>View selected stay <ArrowUpRight size={12}/></a>{isCheckIn && stayBookingUrl && <a className="itinerary-timeline-link" href={stayBookingUrl} target="_blank" rel="noreferrer">Open property details <ExternalLink size={11}/></a>}</div>}
          </div>
          <small>{hotel ? "Selected property" : "Needs selection"}</small>
        </article>;
      }

      const experience = entry.experience;
      const plan = entry.plan;
      const exactTime = plan.time ? formatTime(plan.time) : plan.slot;
      return <article className="itinerary-travel-item is-confirmed itinerary-unified-item" key={entry.id}>
        <div className="itinerary-travel-date"><span>{experience.kind === "restaurant" ? "Restaurant" : "Activity"}</span><strong>{dateShort(entry.date)}</strong></div>
        <div className="itinerary-travel-copy">
          <strong><a className="itinerary-selected-link" href={`#${getTripAssistantResultAnchor(experience.kind, experience.id)}`}>{experience.name} <ArrowUpRight size={11}/></a></strong>
          <p>{exactTime} · {[experience.category, experience.address].filter(Boolean).join(" · ") || "Check current opening hours and booking details."}</p>
          <div className="itinerary-activity-actions">
            <a href={experienceBookingUrl(experience)} target="_blank" rel="noreferrer">Open listing <ExternalLink size={10}/></a>
            <label className="itinerary-date-select"><span>Scheduled date</span><select value={plan.date} onChange={(event) => onUpdateExperience(experience, { ...plan, date: event.target.value })} aria-label={`Change scheduled date for ${experience.name}`}>
              {days.map((day) => <option value={day.date} key={day.date}>{day.label}</option>)}
            </select></label>
            <label><span>{experience.kind === "restaurant" ? "Reservation time" : "Start time"}</span><input type="time" value={plan.time || ""} onChange={(event) => onUpdateExperience(experience, { ...plan, time: event.target.value || undefined })}/></label>
          </div>
          <small className="itinerary-time-note">Your schedule only · this does not confirm a booking or reservation.</small>
        </div>
        <small>{experience.kind === "restaurant" ? "Selected restaurant" : "Selected activity"}</small>
      </article>;
    }) : <div className="itinerary-empty-state">Nothing has been added to your schedule yet. Select an outbound flight, property, activity, or restaurant to build a single chronological trip schedule.</div>}
    {hasFlights && <p className="itinerary-travel-note">{destinationTimezoneNotice(search.destination, destinationAirportCode, search.departureDate)} Each flight leg shows its departure and arrival in the local time at the corresponding airport. Where property times are missing, they remain marked as not supplied rather than assumed. Your activity and dining times are planning notes only; they do not create bookings.</p>}
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

type ResultSectionNavItem = { key: string; id: string; label: string; icon: LucideIcon };

function ResultsTripOverview({ search, totalBudget, people, nights, databaseConfigured, savingTrip, hasSavedTrip, shareUrl, saveMessage, currentSnapshot, onSaveTrip, onCopyShareLink }: {
  search: TripSearchInput;
  totalBudget: number;
  people: number;
  nights: number;
  databaseConfigured: boolean;
  savingTrip: boolean;
  hasSavedTrip: boolean;
  shareUrl: string;
  saveMessage: string;
  currentSnapshot: SavedTripSnapshot;
  onSaveTrip: () => void;
  onCopyShareLink: () => void;
}) {
  const [dateEditorOpen, setDateEditorOpen] = useState(false);
  const [nextDepartureDate, setNextDepartureDate] = useState(search.departureDate);
  const [nextReturnDate, setNextReturnDate] = useState(search.returnDate);
  const [dateChangeError, setDateChangeError] = useState("");
  const [dateChangePending, setDateChangePending] = useState(false);
  const destinationLabel = formatTripDestinationLabel(search.destination, search.destinationArea);
  const travelerLabel = `${search.adults} adult${search.adults === 1 ? "" : "s"}${search.childrenAges.length ? ` · ${search.childrenAges.length} child${search.childrenAges.length === 1 ? "" : "ren"}` : ""}`;
  const budgetAmount = money(search.budget, search.currency);
  const budgetBasis = search.budgetMode === "total" ? "total group budget" : `per traveler · ${money(totalBudget, search.currency)} group total`;
  const items = [
    ...(search.components.includes("flights") ? [{ label: "FROM", value: search.originAirportCode || search.origin }] : []),
    { label: "DESTINATION", value: destinationLabel },
    { label: "DATES", value: `${dateLabel(search.departureDate)} – ${dateLabel(search.returnDate)}`, note: `${nights} nights` },
    { label: "TRAVELERS", value: travelerLabel, note: `${people} total` },
    { label: "BUDGET", value: budgetAmount, note: budgetBasis },
  ];

  function applyDateRange() {
    if (dateChangePending) return;
    setDateChangeError("");
    const today = localDateInputValue();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDepartureDate) || !/^\d{4}-\d{2}-\d{2}$/.test(nextReturnDate)) {
      setDateChangeError("Choose both a start date and an end date.");
      return;
    }
    if (nextDepartureDate < today) {
      setDateChangeError("The new start date must be today or later.");
      return;
    }
    if (nextReturnDate <= nextDepartureDate) {
      setDateChangeError("The end date must be at least one day after the start date.");
      return;
    }
    if (nextDepartureDate === search.departureDate && nextReturnDate === search.returnDate) {
      setDateEditorOpen(false);
      return;
    }

    setDateChangePending(true);
    try {
      const currentIdentity = `${window.location.pathname}${window.location.search}`;
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("depart", nextDepartureDate);
      nextUrl.searchParams.set("return", nextReturnDate);
      const nextIdentity = `${nextUrl.pathname}${nextUrl.search}`;
      const ownerPrefix = "tripfinder:saved-trip-owner:v1:";
      const restorePrefix = "tripfinder:saved-trip-fork-restore:v1:";
      const ownerRaw = window.localStorage.getItem(`${ownerPrefix}${currentIdentity}`);
      const restoreRaw = window.localStorage.getItem(`${restorePrefix}${currentIdentity}`);
      if (ownerRaw) window.localStorage.setItem(`${ownerPrefix}${nextIdentity}`, ownerRaw);
      let sourceSnapshot: SavedTripSnapshot | null = null;
      if (restoreRaw) {
        const parsed = JSON.parse(restoreRaw) as { snapshot?: unknown };
        sourceSnapshot = normalizeSavedTripSnapshot(parsed.snapshot);
        if (!sourceSnapshot) throw new Error("Tripfinder could not safely carry your saved selections to the new dates. Your current trip has not been changed.");
      } else if (currentSnapshot.destinations.some((destination) => destination.items.length > 0)) {
        sourceSnapshot = currentSnapshot;
      }
      if (sourceSnapshot) {
        const shiftedSnapshot = shiftSavedTripSnapshotDateRange(
          sourceSnapshot,
          search.departureDate,
          search.returnDate,
          nextDepartureDate,
          nextReturnDate,
        );
        window.localStorage.setItem(`${restorePrefix}${nextIdentity}`, JSON.stringify({ snapshot: shiftedSnapshot }));
      }
      nextUrl.hash = "";
      window.location.assign(`${nextUrl.pathname}${nextUrl.search}`);
    } catch (error) {
      setDateChangePending(false);
      setDateChangeError(error instanceof Error ? error.message : "Tripfinder could not save your date change in this browser. Enable site storage and try again.");
    }
  }

  return <section className="results-trip-overview" aria-label="Your selected trip details">
    <div className="results-trip-overview-heading"><span>YOUR TRIP</span><small>Search overview</small></div>
    <div className="results-trip-overview-list">
      {items.map((item) => <div className={`results-trip-overview-item ${item.label === "DATES" ? `is-date-item ${dateEditorOpen ? "is-editing-dates" : ""}` : ""}`} key={item.label}>
        <small>{item.label}</small>
        <strong title={item.value}>{item.value}</strong>
        {item.note && <span>{item.note}</span>}
        {item.label === "DATES" && <button type="button" className="results-overview-change-dates" onClick={() => { setDateEditorOpen((open) => !open); setDateChangeError(""); }} aria-expanded={dateEditorOpen} aria-controls="results-overview-date-editor">
          <CalendarDays size={13}/> {dateEditorOpen ? "Close date editor" : "Change dates"}
        </button>}
      </div>)}
    </div>
    {dateEditorOpen && <div className="results-overview-date-editor" id="results-overview-date-editor" aria-label="Change trip dates">
      <div className="results-overview-date-fields">
        <label htmlFor="results-overview-start-date"><span>Start date</span><input id="results-overview-start-date" name="startDate" type="date" value={nextDepartureDate} min={localDateInputValue()} onChange={(event) => setNextDepartureDate(event.target.value)} /></label>
        <label htmlFor="results-overview-end-date"><span>End date</span><input id="results-overview-end-date" name="endDate" type="date" value={nextReturnDate} min={nextDepartureDate || localDateInputValue()} onChange={(event) => setNextReturnDate(event.target.value)} /></label>
      </div>
      <p>Results will refresh for these dates. Some flights or activities may need review.{hasSavedTrip ? " After results load, update your saved trip to refresh its share link." : ""}</p>
      {dateChangeError && <p className="results-overview-date-error" role="alert">{dateChangeError}</p>}
      <div className="results-overview-date-actions">
        <button type="button" onClick={() => { setNextDepartureDate(search.departureDate); setNextReturnDate(search.returnDate); setDateEditorOpen(false); setDateChangeError(""); }} disabled={dateChangePending}>Cancel</button>
        <button type="button" onClick={applyDateRange} disabled={dateChangePending || (nextDepartureDate === search.departureDate && nextReturnDate === search.returnDate)}>{dateChangePending ? "Updating…" : "Update results"}</button>
      </div>
    </div>}
    <div className="results-trip-overview-save-actions">
      <button type="button" className="results-overview-save-primary" onClick={onSaveTrip} disabled={!databaseConfigured || savingTrip} title={!databaseConfigured ? "Neon database must be configured to save trips." : "Save this search and its selected itinerary."}>
        {savingTrip ? <><RefreshCw size={12} className="spin"/> Saving</> : <><Save size={12}/> {hasSavedTrip ? "Update saved trip" : "Save trip"}</>}
      </button>
      <div className="results-overview-share-actions">
        <button type="button" onClick={onCopyShareLink} disabled={!shareUrl} title={shareUrl ? "Copy the private share link" : "Save this trip first to create a share link."}><Copy size={11}/> Copy share link</button>
        {shareUrl ? <a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink size={11}/> Open share link</a> : <button type="button" disabled title="Save this trip first to create a share link."><ExternalLink size={11}/> Open share link</button>}
      </div>
    </div>
    {saveMessage && <p className={`results-overview-save-message ${shareUrl ? "is-success" : "is-error"}`} role="status">{saveMessage}</p>}
  </section>;
}

function ResultsSectionNavigation({
  sections,
  activeKey,
  openState,
  onNavigate,
  onToggle,
}: {
  sections: ResultSectionNavItem[];
  activeKey: string;
  openState: Record<string, boolean>;
  onNavigate: (item: ResultSectionNavItem) => void;
  onToggle: (item: ResultSectionNavItem) => void;
}) {
  if (!sections.length) return null;
  return <nav className="results-section-rail" aria-label="Trip section navigation">
    <div className="results-section-rail-heading"><span>QUICK NAVIGATION</span><small>Jump · expand · collapse</small></div>
    <div className="results-section-rail-list">
      {sections.map((section) => {
        const Icon = section.icon;
        const isOpen = openState[section.id] ?? true;
        return <div className={`results-section-rail-item ${activeKey === section.key ? "is-active" : ""}`} key={section.key}>
          <button type="button" className="results-section-rail-link" onClick={() => onNavigate(section)} aria-current={activeKey === section.key ? "location" : undefined} title={`Jump to ${section.label}`}>
            <Icon size={15} aria-hidden="true"/><span>{section.label}</span>
          </button>
          <button type="button" className="results-section-rail-toggle" onClick={() => onToggle(section)} aria-label={`${isOpen ? "Collapse" : "Expand"} ${section.label}`} aria-expanded={isOpen} title={`${isOpen ? "Collapse" : "Expand"} ${section.label}`}>
            <ChevronDown size={13} aria-hidden="true"/>
          </button>
        </div>;
      })}
    </div>
  </nav>;
}

function FlexibleFlightDatePanel({ search, destinationAirportCode, hasSelections }: {
  search: TripSearchInput;
  destinationAirportCode: string;
  hasSelections: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<FlexibleFlightDateSearchResult | null>(null);

  if (search.flexibleDays < 1) return null;

  async function compareDates() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/travel/flexible-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search, destinationAirportCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to compare flexible flight dates.");
      setResult(data as FlexibleFlightDateSearchResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Flexible-date comparison failed.");
    } finally {
      setLoading(false);
    }
  }

  function chooseDates(option: FlexibleFlightDateOption) {
    if (hasSelections && !window.confirm("Changing dates will reload flights, stays, activities and weather for the new trip dates. Current selections on this results page will be cleared. Continue?")) return;
    try {
      const key = "tripfinder:search-draft:v2";
      const current = JSON.parse(window.sessionStorage.getItem(key) || "{}") as Record<string, unknown>;
      current.depart = option.departureDate;
      current.returnDate = option.returnDate;
      window.sessionStorage.setItem(key, JSON.stringify(current));
    } catch { /* Draft restoration is optional; the URL remains the source of truth. */ }
    const url = new URL(window.location.href);
    url.searchParams.set("depart", option.departureDate);
    url.searchParams.set("return", option.returnDate);
    window.location.assign(url.toString());
  }

  const rankedOptions = result ? [...result.options].sort((a, b) => a.price - b.price) : [];
  return <section className="flexible-date-compare" aria-label="Flexible flight date comparison">
    <div className="flexible-date-compare-heading">
      <div><strong>Compare nearby dates</strong><p>One calendar lookup compares the same trip length within ±{search.flexibleDays} {search.flexibleDays === 1 ? "day" : "days"}.</p></div>
      <button type="button" className="flexible-date-compare-button" onClick={() => void compareDates()} disabled={loading}>
        {loading ? <><RefreshCw size={13} className="spin"/> Comparing</> : <><CalendarDays size={13}/> {result ? "Refresh comparison" : "Compare dates"}</>}
      </button>
    </div>
    {error && <p className="flexible-date-error" role="alert">{error}</p>}
    {result && <>
      {result.stale && <p className="flexible-date-meta">Showing saved provider data from {new Date(result.dataAsOf).toLocaleString()}.</p>}
      {!rankedOptions.length && <p className="empty-inline">No date-level price indications were returned for this window.</p>}
      <div className="flexible-date-options">
        {rankedOptions.map((option, index) => <article className="flexible-date-option" key={`${option.departureDate}-${option.returnDate}`}>
          <div><strong>{dateShort(option.departureDate)}</strong><span>Return · {dateShort(option.returnDate)}</span></div>
          <b>{money(option.price, option.currency || search.currency)}</b>
          {option.lowPrice && <small className="flexible-date-low">Near the lowest price in this window</small>}
          <button type="button" onClick={() => chooseDates(option)}>Use these dates</button>
        </article>)}
      </div>
      <p className="flexible-date-disclaimer">Calendar prices are indicative, not confirmed itineraries or seller fares. Selecting dates reloads all requested trip categories. Flight stop and connection-country preferences are applied during the exact flight search after you choose a date pair.{result.servedFromCache ? " This comparison was served from cache." : " This comparison used one SerpApi request."}</p>
    </>}
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
  const [activeNavSection, setActiveNavSection] = useState("");
  const [navOpenState, setNavOpenState] = useState<Record<string, boolean>>({});
  const [savingTrip, setSavingTrip] = useState(false);
  const [saveTripMessage, setSaveTripMessage] = useState("");
  const [savedShareUrl, setSavedShareUrl] = useState("");
  const [savedTripCredentials, setSavedTripCredentials] = useState<{ shareToken: string; ownerToken: string } | null>(null);
  const [savedTripStorageKey, setSavedTripStorageKey] = useState("");
  const [pendingForkSnapshot, setPendingForkSnapshot] = useState<SavedTripSnapshot | null>(null);
  const [forkRestoreNotice, setForkRestoreNotice] = useState("");
  const forkRestoreStorageKeyRef = useRef("");
  const forkRestoreProcessedRef = useRef<Set<string>>(new Set());
  const forkReturnMatchesRef = useRef<Record<string, { destinationId: string; reference: Extract<SavedTripSelectionReference, { type: "flight" }> }>>({});
  const forkSellerMatchesRef = useRef<Record<string, { destinationId: string; reference: Extract<SavedTripSelectionReference, { type: "flight-seller" }> }>>({});
  const [startingPoints, setStartingPoints] = useState<Record<string, ProximityStartingPoint>>({});
  const [startingPointDrafts, setStartingPointDrafts] = useState<Record<string, string>>({});
  const [startingPointLoading, setStartingPointLoading] = useState<Record<string, boolean>>({});
  const [startingPointErrors, setStartingPointErrors] = useState<Record<string, string>>({});
  const people = search.adults + search.childrenAges.length;
  const nights = Math.max(1, Math.round((new Date(`${search.returnDate}T00:00:00Z`).getTime() - new Date(`${search.departureDate}T00:00:00Z`).getTime()) / 86400000));
  const totalBudget = search.budgetMode === "per_person" ? search.budget * people : search.budget;
  const singleDestination = recommendations.length === 1;

  useEffect(() => {
    const key = `tripfinder:saved-trip-owner:v1:${window.location.pathname}${window.location.search}`;
    setSavedTripStorageKey(key);
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { shareToken?: unknown; ownerToken?: unknown };
      if (typeof parsed.shareToken === "string" && typeof parsed.ownerToken === "string") {
        setSavedTripCredentials({ shareToken: parsed.shareToken, ownerToken: parsed.ownerToken });
        setSavedShareUrl(new URL(`/trip/${parsed.shareToken}`, window.location.origin).toString());
      }
    } catch { /* Saved-link ownership is a convenience; creating a new share link remains available. */ }
  }, []);

  useEffect(() => {
    const key = `tripfinder:saved-trip-fork-restore:v1:${window.location.pathname}${window.location.search}`;
    forkRestoreStorageKeyRef.current = key;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { snapshot?: unknown };
      const snapshot = normalizeSavedTripSnapshot(parsed.snapshot);
      if (snapshot) {
        setPendingForkSnapshot(snapshot);
        setForkRestoreNotice("Your copied itinerary is being matched to current provider results. Exact matches will be selected automatically; anything unavailable will be flagged for review.");
      } else {
        window.localStorage.removeItem(key);
      }
    } catch { /* A copied trip can still be searched if local restore metadata is unavailable. */ }
  }, []);

  useEffect(() => {
    const restored: Record<string, ProximityStartingPoint> = {};
    const drafts: Record<string, string> = {};
    for (const recommendation of recommendations) {
      const destinationId = recommendation.destination.id;
      try {
        const raw = window.localStorage.getItem(`tripfinder:proximity-origin:v1:${destinationId}`);
        if (!raw) continue;
        const parsed: unknown = JSON.parse(raw);
        if (!isValidProximityStartingPoint(parsed)) continue;
        restored[destinationId] = parsed;
        drafts[destinationId] = parsed.label;
      } catch { /* Invalid or unavailable local storage is ignored. */ }
    }
    if (Object.keys(restored).length) setStartingPoints(restored);
    if (Object.keys(drafts).length) setStartingPointDrafts(drafts);
  }, [recommendations]);

  async function resolveStartingPoint(destinationId: string, rawLocation: string): Promise<ProximityStartingPoint> {
    const query = rawLocation.trim().slice(0, 180);
    if (query.length < 4) throw new Error("Enter a hotel, Airbnb, college, venue, landmark, or full street address.");
    setStartingPointLoading((current) => ({ ...current, [destinationId]: true }));
    setStartingPointErrors((current) => ({ ...current, [destinationId]: "" }));
    try {
      const recommendation = recommendations.find((item) => item.destination.id === destinationId);
      if (!recommendation) throw new Error("The destination could not be found. Reload the results and try again.");
      const destinationText = formatDestinationLabel(recommendation.destination.city, recommendation.destination.country);
      const response = await fetch("/api/travel/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, destination: destinationText }),
      });
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Tripfinder could not resolve that starting point.");
      const candidate = {
        label: typeof payload.label === "string" ? payload.label : query,
        address: typeof payload.address === "string" ? payload.address : "",
        latitude: typeof payload.latitude === "number" ? payload.latitude : NaN,
        longitude: typeof payload.longitude === "number" ? payload.longitude : NaN,
        confidence: typeof payload.confidence === "number" ? payload.confidence : 0,
        ...(typeof payload.resultType === "string" ? { resultType: payload.resultType } : {}),
      };
      if (!isValidProximityStartingPoint(candidate)) throw new Error("Geoapify returned an incomplete location. Add a more specific address or place name.");
      setStartingPoints((current) => ({ ...current, [destinationId]: candidate }));
      setStartingPointDrafts((current) => ({ ...current, [destinationId]: candidate.label }));
      try { window.localStorage.setItem(`tripfinder:proximity-origin:v1:${destinationId}`, JSON.stringify(candidate)); } catch { /* The current page can use it even if browser storage is disabled. */ }
      return candidate;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tripfinder could not resolve that starting point.";
      setStartingPointErrors((current) => ({ ...current, [destinationId]: message }));
      throw new Error(message);
    } finally {
      setStartingPointLoading((current) => ({ ...current, [destinationId]: false }));
    }
  }

  function clearStartingPoint(destinationId: string) {
    setStartingPoints((current) => { const next = { ...current }; delete next[destinationId]; return next; });
    setStartingPointDrafts((current) => ({ ...current, [destinationId]: "" }));
    setStartingPointErrors((current) => ({ ...current, [destinationId]: "" }));
    try { window.localStorage.removeItem(`tripfinder:proximity-origin:v1:${destinationId}`); } catch { /* Ignore unavailable storage. */ }
  }

  async function saveCurrentTrip() {
    if (savingTrip) return;
    setSavingTrip(true);
    setSaveTripMessage("");
    try {
      const snapshot = buildSavedTripSnapshot(search, recommendations, states, selections);
      const payload: Record<string, unknown> = { search, snapshot };
      if (savedTripCredentials) {
        payload.shareToken = savedTripCredentials.shareToken;
        payload.ownerToken = savedTripCredentials.ownerToken;
      }
      const response = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { error?: string; shareToken?: string; ownerToken?: string; shareUrl?: string; updated?: boolean };
      if (!response.ok || !data.shareToken || !data.shareUrl) {
        if (response.status === 403 && savedTripCredentials) {
          setSavedTripCredentials(null);
          try { if (savedTripStorageKey) window.localStorage.removeItem(savedTripStorageKey); } catch { /* ignore storage failures */ }
        }
        throw new Error(data.error || "Tripfinder couldn't save this trip right now.");
      }
      const credentials = { shareToken: data.shareToken, ownerToken: data.ownerToken || savedTripCredentials?.ownerToken || "" };
      if (!credentials.ownerToken) throw new Error("The saved trip was created, but this browser did not receive its update permission. Keep the share link below.");
      setSavedTripCredentials(credentials);
      setSavedShareUrl(data.shareUrl);
      try {
        if (savedTripStorageKey) window.localStorage.setItem(savedTripStorageKey, JSON.stringify(credentials));
      } catch { /* The public link remains usable when browser storage is unavailable. */ }
      try {
        await navigator.clipboard.writeText(data.shareUrl);
        setSaveTripMessage(data.updated ? "Saved trip updated · link copied" : "Trip saved · share link copied");
      } catch {
        setSaveTripMessage(data.updated ? "Saved trip updated · copy the link below" : "Trip saved · copy the link below");
      }
    } catch (error) {
      setSaveTripMessage(error instanceof Error ? error.message : "Tripfinder couldn't save this trip right now.");
    } finally {
      setSavingTrip(false);
    }
  }

  async function copySavedTripLink() {
    if (!savedShareUrl) return;
    try {
      await navigator.clipboard.writeText(savedShareUrl);
      setSaveTripMessage("Share link copied");
    } catch {
      setSaveTripMessage("Clipboard access was blocked. Open the share link and copy its address from the browser.");
    }
  }

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

  async function loadBookingOptions(destinationId: string, flight: LiveFlight, destinationAirportCode: string, forceRefresh = false) {
    if (!flight.bookingToken) return;
    setBookingStates((current) => ({ ...current, [flight.id]: { ...current[flight.id], loading: true, error: "", options: current[flight.id]?.options ?? null } }));
    try {
      const response = await fetch("/api/travel/booking-options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingToken: flight.bookingToken, search, destinationAirportCode, forceRefresh }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not retrieve seller links.");
      const refreshedOptions = Array.isArray(data.options) ? data.options as FlightBookingOption[] : [];
      setBookingStates((current) => ({ ...current, [flight.id]: { loading: false, error: "", options: refreshedOptions, checkedAt: typeof data.checkedAt === "string" ? data.checkedAt : undefined, dataAsOf: typeof data.dataAsOf === "string" ? data.dataAsOf : undefined, servedFromCache: data.servedFromCache === true, stale: data.stale === true } }));
      // A seller selection must not silently retain an old quote after its
      // refreshed token lookup changes or removes that exact offer.
      setSelections((current) => {
        const selection = current[destinationId];
        if (!selection?.flightSeller || selection.flightSeller.flightId !== flight.id) return current;
        const matchingOffer = refreshedOptions.find((offer) => bookingOptionKey(offer) === bookingOptionKey(selection.flightSeller!.option));
        if (matchingOffer) return { ...current, [destinationId]: { ...selection, flightSeller: { flightId: flight.id, option: matchingOffer } } };
        return { ...current, [destinationId]: { ...selection, flightSeller: null } };
      });
    } catch (error) {
      setBookingStates((current) => ({ ...current, [flight.id]: { ...current[flight.id], loading: false, error: error instanceof Error ? error.message : "Seller lookup failed.", options: current[flight.id]?.options ?? null } }));
    }
  }

  async function loadHotelOptions(hotel: LiveHotel, forceRefresh = false) {
    if (!hotel.propertyToken) return;
    setHotelBookingStates((current) => ({ ...current, [hotel.id]: { ...current[hotel.id], loading: true, error: "", options: current[hotel.id]?.options ?? null } }));
    try {
      const response = await fetch("/api/travel/hotel-options", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyToken: hotel.propertyToken, search, forceRefresh }) });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not retrieve property booking options.");
      setHotelBookingStates((current) => ({ ...current, [hotel.id]: { loading: false, error: "", options: Array.isArray(data.offers) ? data.offers as HotelBookingOption[] : [], checkedAt: typeof data.checkedAt === "string" ? data.checkedAt : undefined, dataAsOf: typeof data.dataAsOf === "string" ? data.dataAsOf : undefined, servedFromCache: data.servedFromCache === true, stale: data.stale === true } }));
    } catch (error) {
      setHotelBookingStates((current) => ({ ...current, [hotel.id]: { ...current[hotel.id], loading: false, error: error instanceof Error ? error.message : "Hotel booking lookup failed.", options: current[hotel.id]?.options ?? null } }));
    }
  }

  function normalizeRestoreKey(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function flightMatchesRestoreReference(flight: LiveFlight, reference: Extract<SavedTripSelectionReference, { type: "flight" }>): boolean {
    const segments = flight.segments.map((segment) => [segment.airline, segment.flightNumber, segment.from, segment.to, segment.departure, segment.arrival].join("|"));
    if (reference.legacyDisplay) {
      const first = flight.segments[0];
      const last = flight.segments[flight.segments.length - 1];
      const departure = `Departs ${flight.from} · ${formatFlightTimeAtAirport(flight.departure, first?.fromAirportCode)}`;
      const arrival = `Arrives ${flight.to} · ${formatFlightTimeAtAirport(flight.arrival, last?.toAirportCode)}`;
      const legacySegments = flight.segments.map((segment, index) => `Leg ${index + 1}: ${segment.airline}${segment.flightNumber ? ` ${segment.flightNumber}` : ""} · ${segment.from} ${formatFlightTimeAtAirport(segment.departure, segment.fromAirportCode)} → ${segment.to} ${formatFlightTimeAtAirport(segment.arrival, segment.toAirportCode)}`);
      return normalizeRestoreKey(flight.from) === normalizeRestoreKey(reference.from)
        && normalizeRestoreKey(flight.to) === normalizeRestoreKey(reference.to)
        && normalizeRestoreKey(departure) === normalizeRestoreKey(`Departs ${reference.from} · ${reference.departure}`)
        && normalizeRestoreKey(arrival) === normalizeRestoreKey(`Arrives ${reference.to} · ${reference.arrival}`)
        && legacySegments.length === reference.segmentKeys.length
        && legacySegments.every((segment, index) => normalizeRestoreKey(segment) === normalizeRestoreKey(reference.segmentKeys[index]));
    }
    return normalizeRestoreKey(flight.from) === normalizeRestoreKey(reference.from)
      && normalizeRestoreKey(flight.to) === normalizeRestoreKey(reference.to)
      && flight.departure === reference.departure && flight.arrival === reference.arrival
      && segments.length === reference.segmentKeys.length
      && segments.every((segment, index) => segment === reference.segmentKeys[index]);
  }

  function uniqueMatch<T>(items: T[], predicate: (item: T) => boolean): T | null {
    const matches = items.filter(predicate);
    return matches.length === 1 ? matches[0] : null;
  }

  function restoreClockTime(value?: string): string | undefined {
    const match = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(value || "");
    if (!match) return undefined;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 1 || hour > 12 || minute > 59) return undefined;
    hour = (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function matchSnapshotGroup(label: string): SavedTripSnapshot["destinations"][number] | null {
    if (!pendingForkSnapshot) return null;
    const key = normalizeRestoreKey(label);
    const exact = pendingForkSnapshot.destinations.filter((destination) => normalizeRestoreKey(destination.label) === key);
    if (exact.length === 1) return exact[0];
    return pendingForkSnapshot.destinations.length === 1 && recommendations.length === 1 ? pendingForkSnapshot.destinations[0] : null;
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

  useEffect(() => {
    if (!pendingForkSnapshot) return;
    for (const recommendation of recommendations) {
      const destinationId = recommendation.destination.id;
      if (forkRestoreProcessedRef.current.has(destinationId)) continue;
      const result = states[destinationId]?.result;
      if (!result) continue;
      const destinationLabel = formatDestinationLabel(recommendation.destination.city, recommendation.destination.country);
      const group = matchSnapshotGroup(destinationLabel);
      if (!group) continue;
      const items = group.items;
      const reviewItems = items.filter((item) => item.dateNeedsReview);
      const selectableItems = items.filter((item) => !item.dateNeedsReview);
      const outboundRef = selectableItems.find((item) => item.selectionRef?.type === "flight" && item.selectionRef.direction === "outbound")?.selectionRef;
      const returnRef = selectableItems.find((item) => item.selectionRef?.type === "flight" && item.selectionRef.direction === "return")?.selectionRef;
      const hotelRef = selectableItems.find((item) => item.selectionRef?.type === "stay")?.selectionRef;
      const checkInTime = restoreClockTime(selectableItems.find((item) => item.kind === "stay-check-in")?.time);
      const checkOutTime = restoreClockTime(selectableItems.find((item) => item.kind === "stay-check-out")?.time);
      const sellerRef = selectableItems.find((item) => item.selectionRef?.type === "flight-seller")?.selectionRef;
      const outbound = outboundRef?.type === "flight" ? uniqueMatch(result.flights, (flight) => flightMatchesRestoreReference(flight, outboundRef)) : null;
      const hotel = hotelRef?.type === "stay" ? uniqueMatch(result.hotels, (candidate) => normalizeRestoreKey(candidate.name) === normalizeRestoreKey(hotelRef.name) && (!hotelRef.address || normalizeRestoreKey(candidate.address) === normalizeRestoreKey(hotelRef.address))) : null;
      const experiences: Record<string, SelectedExperience> = {};
      const experienceRefs = selectableItems.flatMap((item) => item.selectionRef?.type === "experience" ? [item.selectionRef] : []);
      const missing: string[] = reviewItems.map((item) => `${item.title} (review for the updated dates)`);
      for (const reference of experienceRefs) {
        const experience = uniqueMatch(result.experiences, (candidate) => candidate.kind === reference.kind
          && normalizeRestoreKey(candidate.name) === normalizeRestoreKey(reference.name)
          && (!reference.address || normalizeRestoreKey(candidate.address) === normalizeRestoreKey(reference.address)));
        if (experience) experiences[experience.id] = { date: reference.date, slot: reference.slot, ...(reference.time ? { time: reference.time } : {}) };
        else missing.push(reference.name);
      }
      if (outboundRef?.type === "flight" && !outbound) missing.push(`${outboundRef.from} → ${outboundRef.to} flight`);
      if (hotelRef?.type === "stay" && !hotel) missing.push(hotelRef.name);
      setSelections((current) => {
        const previous = current[destinationId] ?? emptySelection();
        return { ...current, [destinationId]: { ...previous, ...(outbound ? { outbound } : {}), ...(hotel ? { hotel } : {}), ...(hotel && checkInTime ? { checkInTime } : {}), ...(hotel && checkOutTime ? { checkOutTime } : {}), experiences: { ...previous.experiences, ...experiences } } };
      });
      if (outbound && returnRef?.type === "flight") {
        if (outbound.departureToken) {
          forkReturnMatchesRef.current[outbound.id] = { destinationId, reference: returnRef };
          void loadReturnFlights(outbound, search.destinationAirportCode || recommendation.destination.airportCode || "");
        } else {
          missing.push("return flight (no current return-search token)");
        }
      }
      if (outbound && sellerRef?.type === "flight-seller") {
        forkSellerMatchesRef.current[outbound.id] = { destinationId, reference: sellerRef };
        if (returnRef?.type !== "flight" && outbound.bookingToken) {
          void loadBookingOptions(destinationId, outbound, search.destinationAirportCode || recommendation.destination.airportCode || "");
        } else if (returnRef?.type !== "flight") {
          delete forkSellerMatchesRef.current[outbound.id];
          missing.push("saved seller offer (provider recheck unavailable)");
        }
      }
      forkRestoreProcessedRef.current.add(destinationId);
      const restoredCount = (outbound ? 1 : 0) + (hotel ? 1 : 0) + Object.keys(experiences).length;
      setForkRestoreNotice(`${restoredCount} itinerary selection${restoredCount === 1 ? "" : "s"} matched to current results${missing.length ? `. Needs review: ${missing.join(", ")}` : ". Checking the saved return flight and seller selection if included."}`);
    }
  }, [pendingForkSnapshot, recommendations, states, search.destinationAirportCode]);

  useEffect(() => {
    for (const [flightId, pending] of Object.entries(forkReturnMatchesRef.current)) {
      const returnState = returnStates[flightId];
      if (!returnState || returnState.loading) continue;
      if (!returnState.result) {
        if (returnState.error) {
          setForkRestoreNotice((message) => `${message} Tripfinder could not recheck the previous return flight; choose a current return option manually.`);
          delete forkSellerMatchesRef.current[flightId];
          delete forkReturnMatchesRef.current[flightId];
        }
        continue;
      }
      const match = uniqueMatch(returnState.result.flights, (flight) => flightMatchesRestoreReference(flight, pending.reference));
      if (match) {
        setSelections((current) => {
          const previous = current[pending.destinationId] ?? emptySelection();
          return { ...current, [pending.destinationId]: { ...previous, returnFlight: match } };
        });
        const seller = forkSellerMatchesRef.current[flightId];
        if (seller) {
          delete forkSellerMatchesRef.current[flightId];
          if (match.bookingToken) {
            forkSellerMatchesRef.current[match.id] = seller;
            const recommendation = recommendations.find((item) => item.destination.id === pending.destinationId);
            if (recommendation) void loadBookingOptions(pending.destinationId, match, search.destinationAirportCode || recommendation.destination.airportCode || "");
          } else {
            setForkRestoreNotice((message) => `${message} The saved seller offer could not be rechecked for this return result; compare current offers manually.`);
          }
        }
      } else {
        setForkRestoreNotice((message) => `${message} The original return flight is no longer an exact current match; please choose a replacement.`);
        delete forkSellerMatchesRef.current[flightId];
      }
      delete forkReturnMatchesRef.current[flightId];
    }
  }, [returnStates, recommendations, search.destinationAirportCode]);

  useEffect(() => {
    for (const [flightId, pending] of Object.entries(forkSellerMatchesRef.current)) {
      const state = bookingStates[flightId];
      if (!state || state.loading) continue;
      if (!state.options) {
        if (state.error) {
          setForkRestoreNotice((message) => `${message} Tripfinder could not recheck the previous seller quote; compare current offers manually.`);
          delete forkSellerMatchesRef.current[flightId];
        }
        continue;
      }
      const offer = uniqueMatch(state.options, (candidate) => normalizeRestoreKey(candidate.seller) === normalizeRestoreKey(pending.reference.seller)
        && normalizeRestoreKey(candidate.type) === normalizeRestoreKey(pending.reference.fareType)
        && (candidate.currency || "USD").toUpperCase() === pending.reference.currency);
      if (offer) {
        setSelections((current) => {
          const previous = current[pending.destinationId] ?? emptySelection();
          return { ...current, [pending.destinationId]: { ...previous, flightSeller: { flightId, option: offer } } };
        });
        setForkRestoreNotice((message) => `${message} The saved seller offer was rechecked and restored${offer.price !== pending.reference.price ? " at its refreshed price" : ""}.`);
      } else {
        setForkRestoreNotice((message) => `${message} The previous seller quote is no longer available; compare current seller offers.`);
      }
      delete forkSellerMatchesRef.current[flightId];
    }
  }, [bookingStates]);

  useEffect(() => {
    if (!pendingForkSnapshot) return;
    const allLoadedAndProcessed = pendingForkSnapshot.destinations.every((group) => {
      const destinationKey = normalizeRestoreKey(group.label);
      const recommendation = recommendations.find((item) => normalizeRestoreKey(formatDestinationLabel(item.destination.city, item.destination.country)) === destinationKey)
        ?? (pendingForkSnapshot.destinations.length === 1 && recommendations.length === 1 ? recommendations[0] : undefined);
      return Boolean(recommendation && forkRestoreProcessedRef.current.has(recommendation.destination.id));
    });
    if (!allLoadedAndProcessed || Object.keys(forkReturnMatchesRef.current).length || Object.keys(forkSellerMatchesRef.current).length) return;
    try { if (forkRestoreStorageKeyRef.current) window.localStorage.removeItem(forkRestoreStorageKeyRef.current); } catch { /* Restore data is also held in component state for this page. */ }
    setPendingForkSnapshot(null);
  }, [pendingForkSnapshot, recommendations, states, returnStates, bookingStates]);

  const navigationRecommendation = recommendations.find((item) => item.destination.id === expanded && Boolean(states[item.destination.id]?.result))
    ?? recommendations.find((item) => Boolean(states[item.destination.id]?.result))
    ?? null;
  const navigationDestinationId = navigationRecommendation?.destination.id ?? "";
  const navigationResult = navigationDestinationId ? states[navigationDestinationId]?.result ?? null : null;
  const navigationSections: ResultSectionNavItem[] = navigationResult ? [
    ...(search.components.includes("flights") ? [{ key: "flights", id: `trip-section-${navigationDestinationId}-flights`, label: "Flights", icon: Plane }] : []),
    ...(search.components.includes("stays") ? [{ key: "stays", id: `trip-section-${navigationDestinationId}-stays`, label: "Places to stay", icon: Hotel }] : []),
    ...(search.components.includes("activities") ? [
      { key: "activities", id: `trip-section-${navigationDestinationId}-activities`, label: "Activities & attractions", icon: Activity },
      { key: "restaurants", id: `trip-section-${navigationDestinationId}-restaurants`, label: "Restaurants & dining", icon: Users },
    ] : []),
    { key: "weather", id: `trip-section-${navigationDestinationId}-weather`, label: "Weather", icon: CloudRain },
    { key: "plan", id: `trip-section-${navigationDestinationId}-plan`, label: "Your plan", icon: ClipboardList },
    { key: "cost", id: `trip-section-${navigationDestinationId}-cost`, label: "Cost breakdown", icon: Wallet },
    { key: "schedule", id: `trip-section-${navigationDestinationId}-schedule`, label: "Your trip schedule", icon: CalendarDays },
  ] : [];
  const navigationSignature = navigationSections.map((item) => item.id).join("|");

  useEffect(() => {
    if (!navigationSignature || typeof IntersectionObserver === "undefined") return;
    const elements = navigationSignature.split("|").map((id) => document.getElementById(id)).filter((item): item is HTMLElement => Boolean(item));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      const active = visible[0]?.target.getAttribute("data-section-key");
      if (active) setActiveNavSection(active);
    }, { rootMargin: "-105px 0px -68% 0px", threshold: 0.01 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [navigationSignature]);

  function navigateToResultSection(section: ResultSectionNavItem) {
    const target = document.getElementById(section.id);
    if (!target) return;
    if (navigationDestinationId) setExpanded(navigationDestinationId);
    if (target instanceof HTMLDetailsElement) target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveNavSection(section.key);
  }

  function toggleResultSection(section: ResultSectionNavItem) {
    const target = document.getElementById(section.id);
    if (target instanceof HTMLDetailsElement) target.open = !target.open;
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
    ...(startingPoints[assistantRecommendation.destination.id] ? { startingPoint: startingPoints[assistantRecommendation.destination.id] } : {}),
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
      return {
        id: flight.id, airline: flight.airlines.join(" / "), from: flight.from, to: flight.to,
        departure: formatFlightTimeAtAirport(flight.departure, flight.segments[0]?.fromAirportCode),
        arrival: formatFlightTimeAtAirport(flight.arrival, flight.segments[flight.segments.length - 1]?.toAirportCode),
        price: flight.price, stops: flight.stops,
        segments: flight.segments.map((segment) => ({
          airline: segment.airline, flightNumber: segment.flightNumber, from: segment.from, to: segment.to,
          departure: formatFlightTimeAtAirport(segment.departure, segment.fromAirportCode),
          arrival: formatFlightTimeAtAirport(segment.arrival, segment.toAirportCode),
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
      outboundFlight: assistantSelection.outbound ? `${assistantSelection.outbound.airlines.join(" / ")} · ${formatFlightTimeAtAirport(assistantSelection.outbound.departure, assistantSelection.outbound.segments[0]?.fromAirportCode)} → ${formatFlightTimeAtAirport(assistantSelection.outbound.arrival, assistantSelection.outbound.segments[assistantSelection.outbound.segments.length - 1]?.toAirportCode)} · ${assistantSelection.outbound.from} → ${assistantSelection.outbound.to}` : undefined,
      returnFlight: assistantSelection.returnFlight ? `${assistantSelection.returnFlight.airlines.join(" / ")} · ${formatFlightTimeAtAirport(assistantSelection.returnFlight.departure, assistantSelection.returnFlight.segments[0]?.fromAirportCode)} → ${formatFlightTimeAtAirport(assistantSelection.returnFlight.arrival, assistantSelection.returnFlight.segments[assistantSelection.returnFlight.segments.length - 1]?.toAirportCode)} · ${assistantSelection.returnFlight.from} → ${assistantSelection.returnFlight.to}` : undefined,
      stay: assistantSelection.hotel?.name,
      stayId: assistantSelection.hotel?.id,
      schedule: Object.entries(assistantSelection.experiences).flatMap(([experienceId, plan]) => {
        const experience = assistantExperiences.find((item) => item.id === experienceId);
        return experience ? [{ name: experience.name, kind: experience.kind, date: plan.date, slot: plan.slot }] : [];
      }).slice(0, 16),
    },
  } : null;

  return <div className="planner-results-workspace">
    {forkRestoreNotice && <p className="fork-restore-notice" role="status">{forkRestoreNotice}</p>}
    <aside className="results-left-sidebar" aria-label="Trip overview and section navigation">
      <ResultsTripOverview
        search={search} totalBudget={totalBudget} people={people} nights={nights}
        databaseConfigured={databaseConfigured} savingTrip={savingTrip} hasSavedTrip={Boolean(savedTripCredentials)}
        shareUrl={savedShareUrl} saveMessage={saveTripMessage} currentSnapshot={buildSavedTripSnapshot(search, recommendations, states, selections)}
        onSaveTrip={() => void saveCurrentTrip()} onCopyShareLink={() => void copySavedTripLink()}
      />
      {navigationSections.length > 0 && <ResultsSectionNavigation sections={navigationSections} activeKey={activeNavSection || navigationSections[0].key} openState={navOpenState} onNavigate={navigateToResultSection} onToggle={toggleResultSection}/>}
    </aside>

    {!liveSearchConfigured && <div className="live-setup-note"><ShieldAlert size={17}/><div><strong>Live search is not connected</strong><p>{!providerKeyConfigured ? "Add SERPAPI_API_KEY in Vercel. " : ""}{!databaseConfigured ? "Add DATABASE_URL for the Neon cache and shared usage limits." : ""}</p></div></div>}

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
          <div className="planner-destination-body">
            <div className="planner-destination-heading"><div>{destination.country && normalizeDestinationQuery(destination.country) !== normalizeDestinationQuery(destination.city) && <span className="planner-country">{destination.country}</span>}<h3>{destination.city}</h3><p>{destination.summary}</p>{recommendation.typicalDaytimeHighF !== null ? <p className="planner-climate-note">Typical daytime high for these dates: <strong>{Math.round(search.temperatureUnit === "C" ? (recommendation.typicalDaytimeHighF - 32) * 5 / 9 : recommendation.typicalDaytimeHighF)}°{search.temperatureUnit}</strong> <span>· monthly climate average, not a forecast</span></p> : (search.temperatureMin !== null || search.temperatureMax !== null) ? <p className="planner-climate-note">No monthly temperature baseline is available for this location, so your temperature range could not be checked.</p> : null}</div>{search.components.includes("flights") && airportCode && <span className="planner-airport">{airportCode}</span>}</div>
            <div className="planner-highlights">{destination.highlights.slice(0, 3).map((highlight) => <span key={highlight}>{highlight}</span>)}</div>
            <div className="planner-actions">
              {search.components.includes("flights") && <a className="planner-outbound-link" href={state?.result?.providerSearchLinks?.flights || recommendation.flightSearchUrl} target="_blank" rel="noreferrer"><Plane size={14}/> Flights <ArrowUpRight size={12}/></a>}
              {search.components.includes("stays") && search.stayTypes.includes("hotels") && <a className="planner-outbound-link" href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer"><Hotel size={14}/> Hotels · {nights} nights <ArrowUpRight size={12}/></a>}
              {search.components.includes("stays") && search.stayTypes.includes("vacation_rentals") && <a className="planner-outbound-link" href={recommendation.vacationRentalSearchUrl} target="_blank" rel="noreferrer"><Hotel size={14}/> Rentals · {nights} nights <ArrowUpRight size={12}/></a>}
              {search.components.includes("activities") && <a className="planner-outbound-link" href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer"><Activity size={14}/> Things to do · {nights} days <ArrowUpRight size={12}/></a>}
              {state?.result && <button className="text-action" type="button" onClick={() => { setExpanded(destination.id); window.requestAnimationFrame(() => window.requestAnimationFrame(() => { const schedule = document.getElementById(`trip-section-${destination.id}-schedule`); if (schedule instanceof HTMLDetailsElement) schedule.open = true; schedule?.scrollIntoView({ behavior: "smooth", block: "start" }); })); }}>Go to schedule</button>}
            </div>

            {liveSearchConfigured && <div className="live-search-action"><button type="button" className="live-search-button" disabled={state?.loading} onClick={() => checkLiveOffers(recommendation, Boolean(state?.result))}>{state?.loading ? <><RefreshCw size={14} className="spin"/> {state?.result ? "Refreshing selected categories…" : "Searching selected categories…"}</> : state?.result ? <><RefreshCw size={14}/> Refresh results</> : `Search ${requestedLabels.join(" + ")}`}</button>{!singleDestination && <span>Only the destination you open is searched. Other recommendations do not use API requests until selected.</span>}<span>Identical searches use the shared Neon cache. Refresh bypasses Tripfinder’s saved results and may use a provider search. The provider may still return its own cached data.</span></div>}
            {state?.error && <div className="provider-error" role="alert">{state.error}</div>}
            {state?.loading && <div className="search-loading-panel"><span className="loading-line"/><span className="loading-line short"/><p>Checking current travel options for {destination.city}…</p></div>}

            {state?.result && <div className="live-search-results">
              <div className="live-result-heading"><div><h4>Travel options for {destination.city}</h4><p>Checked {new Date(state.result.checkedAt).toLocaleString()} · {resultSourceLabel(state.result)}</p></div><span className={`result-status result-status-${state.result.status}`}>{state.result.status === "live" ? "Search complete" : state.result.status === "partial" ? "Some categories returned no results" : "No provider results"}</span></div>
              {state.result.warnings.map((warning) => <p className="provider-warning" key={warning}>{warning}</p>)}
              {state.result.cacheSummary?.length > 0 && <div className="cache-freshness-list" aria-label="Search result freshness">{state.result.cacheSummary.map((entry) => <span className={`cache-freshness cache-${entry.status}`} key={entry.key}><strong>{entry.label}</strong>{entry.status === "live" ? "Live" : entry.status === "cached" ? "Cached" : "Saved fallback"} · {cacheAgeLabel(entry.fetchedAt)}</span>)}</div>}

              {search.components.includes("flights") && <details id={`trip-section-${destination.id}-flights`} data-section-key="flights" className="live-result-group" open onToggle={(event) => { const sectionId = event.currentTarget.id; const isOpen = event.currentTarget.open; setNavOpenState((current) => ({ ...current, [sectionId]: isOpen })); }}>
                <summary className="live-result-group-summary"><Plane size={17}/><strong>Flights</strong><span>{state.result.flights.length} outbound options{selection.outbound ? " · 1 selected" : ""}{selection.returnFlight ? " + return selected" : ""}</span><ChevronDown size={16} className="group-chevron"/></summary>
                <p className="flight-timezone-note">{destinationTimezoneNotice(destinationLabel, airportCode, search.departureDate)}</p>
                <FlexibleFlightDatePanel search={search} destinationAirportCode={airportCode} hasSelections={Boolean(selection.outbound || selection.returnFlight || selection.hotel || Object.keys(selection.experiences).length)}/>
                <p className="flight-roundtrip-note">Tripfinder sends one round-trip search with both dates. Google Flights returns outbound choices first; selecting one uses its departure token to retrieve matching return choices. The initial result price is indicative, not a confirmed combined fare. After choosing both legs, compare seller offers: they identify whether the booking is one combined ticket or separate outbound and return tickets, and show each leg's price when the provider supplies it.</p>
                {state.result.flights.length ? <>{state.result.providerSearchLinks?.flights && <p className="provider-search-link"><a href={state.result.providerSearchLinks.flights} target="_blank" rel="noreferrer">Open this exact search in Google Flights <ArrowUpRight size={12}/></a></p>}{availableAirlines.length > 1 && <div className="airline-filter" aria-label="Filter outbound flights by airline"><span>Airline</span><button type="button" className={selectedAirline === "all" ? "is-active" : ""} onClick={() => setFlightAirlineFilters((current) => ({ ...current, [destination.id]: "all" }))}>All ({state.result.flights.length})</button>{availableAirlines.map((airline) => <button type="button" key={airline} className={selectedAirline === airline ? "is-active" : ""} onClick={() => setFlightAirlineFilters((current) => ({ ...current, [destination.id]: airline }))}>{airline} ({state.result!.flights.filter((flight) => flight.airlines.includes(airline)).length})</button>)}</div>}{visibleFlights.map((flight) => <FlightResult key={flight.id} flight={flight} currency={search.currency} returnState={returnStates[flight.id]} bookingStates={bookingStates} selectedOutbound={selection.outbound?.id === flight.id} selectedReturnFlight={selection.outbound?.id === flight.id ? selection.returnFlight : null} selectedSeller={selection.flightSeller} onSelectOutbound={(selected) => selectOutbound(destination.id, selected, airportCode)} onSelectReturn={(selected) => selectReturn(destination.id, selected)} onLoadBookingOptions={(selected, forceRefresh) => loadBookingOptions(destination.id, selected, airportCode, forceRefresh)} onSelectSeller={(selectedFlight, option) => selectFlightSeller(destination.id, selectedFlight, option)}/>)}</> : <div className="empty-category"><p>No flight options were returned for this route and date combination.</p><a href={state.result.providerSearchLinks?.flights || directFlightUrl.toString()} target="_blank" rel="noreferrer">Search this route on Google Flights <ArrowUpRight size={12}/></a><small>The link uses the route and dates submitted to the provider. You can adjust passenger or fare details on Google Flights if needed.</small></div>}
              </details>}

              {search.components.includes("stays") && <details id={`trip-section-${destination.id}-stays`} data-section-key="stays" className="live-result-group" open onToggle={(event) => { const sectionId = event.currentTarget.id; const isOpen = event.currentTarget.open; setNavOpenState((current) => ({ ...current, [sectionId]: isOpen })); }}>
                <summary className="live-result-group-summary"><Hotel size={17}/><strong>Places to stay</strong><span>{state.result.hotels.length} properties{selection.hotel ? " · 1 selected" : ""}</span><ChevronDown size={16} className="group-chevron"/></summary>
                {state.result.hotels.length ? state.result.hotels.map((hotel) => <HotelResult key={hotel.id} hotel={hotel} currency={search.currency} airportCode={airportCode} experiences={state.result!.experiences} nights={nights} search={search} bookingState={hotelBookingStates[hotel.id]} selected={selection.hotel?.id === hotel.id} onSelect={(selected) => selectHotel(destination.id, selected)} onLoadBookingOptions={loadHotelOptions}/>) : <div className="empty-category"><p>No properties were returned for these dates and guest details.</p><a href={recommendation.hotelSearchUrl} target="_blank" rel="noreferrer">Open the stay search <ArrowUpRight size={12}/></a></div>}
              </details>}

              {search.components.includes("activities") && <>
                <ProximityStartingPointPanel
                  destinationId={destination.id}
                  point={startingPoints[destination.id]}
                  defaultOriginLabel={selection.hotel?.name}
                  defaultOriginAddress={selection.hotel?.address || undefined}
                  value={startingPointDrafts[destination.id] ?? startingPoints[destination.id]?.label ?? ""}
                  loading={startingPointLoading[destination.id] === true}
                  error={startingPointErrors[destination.id]}
                  onChange={(value) => setStartingPointDrafts((current) => ({ ...current, [destination.id]: value }))}
                  onSubmit={() => { void resolveStartingPoint(destination.id, startingPointDrafts[destination.id] ?? "").catch(() => undefined); }}
                  onClear={() => clearStartingPoint(destination.id)}
                />
                <details id={`trip-section-${destination.id}-activities`} data-section-key="activities" className="live-result-group" open onToggle={(event) => { const sectionId = event.currentTarget.id; const isOpen = event.currentTarget.open; setNavOpenState((current) => ({ ...current, [sectionId]: isOpen })); }}><summary className="live-result-group-summary"><Activity size={17}/><strong>Activities & attractions</strong><span>{activityExperiences.length} options · {Object.keys(selection.experiences).filter((id) => state.result!.experiences.some((item) => item.id === id && item.kind === "activity")).length} selected</span><ChevronDown size={16} className="group-chevron"/></summary>
                  {activityExperiences.length ? activityExperiences.map((experience) => <ExperienceResult key={experience.id} experience={experience} hotels={state.result!.hotels} selectedHotel={selection.hotel} startingPoint={startingPoints[destination.id]} airportCode={airportCode} search={search} days={itineraryDates} selected={selection.experiences[experience.id]} onSelectionChange={(item, plan) => updateExperienceSelection(destination.id, item, plan)}/>) : <div className="empty-category"><p>No activity results were returned for this destination.</p><div className="empty-category-links"><a href={recommendation.activitySearchUrl} target="_blank" rel="noreferrer">Search Viator <ArrowUpRight size={12}/></a><a href={`https://www.getyourguide.com/s/?q=${encodeURIComponent(`Things to do in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search GetYourGuide <ArrowUpRight size={12}/></a><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Attractions in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search Maps <ArrowUpRight size={12}/></a></div></div>}
                </details>
                <details id={`trip-section-${destination.id}-restaurants`} data-section-key="restaurants" className="live-result-group" open onToggle={(event) => { const sectionId = event.currentTarget.id; const isOpen = event.currentTarget.open; setNavOpenState((current) => ({ ...current, [sectionId]: isOpen })); }}><summary className="live-result-group-summary"><Users size={17}/><strong>Restaurants & dining</strong><span>{restaurantExperiences.length} options · {Object.keys(selection.experiences).filter((id) => state.result!.experiences.some((item) => item.id === id && item.kind === "restaurant")).length} selected</span><ChevronDown size={16} className="group-chevron"/></summary>
                  {search.planningNotes.some((note) => /^Restaurant proximity:/i.test(note)) && <p className="restaurant-proximity-note">To verify a requested drive-time limit, set Your starting point above or select a property, then use the driving-route control on each restaurant. Tripfinder checks routes only when requested; straight-line distance is not driving time.</p>}
                  {restaurantExperiences.length ? restaurantExperiences.map((experience) => <ExperienceResult key={experience.id} experience={experience} hotels={state.result!.hotels} selectedHotel={selection.hotel} startingPoint={startingPoints[destination.id]} airportCode={airportCode} search={search} days={itineraryDates} selected={selection.experiences[experience.id]} onSelectionChange={(item, plan) => updateExperienceSelection(destination.id, item, plan)}/>) : <div className="empty-category"><p>No restaurant results were returned. Open Maps to search current dining options in this destination.</p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Restaurants in ${destinationLabel}`)}`} target="_blank" rel="noreferrer">Search restaurants in Maps <ArrowUpRight size={12}/></a></div>}
                </details>
              </>}
              <details id={`trip-section-${destination.id}-weather`} data-section-key="weather" className="live-result-group results-utility-group" open onToggle={(event) => { const sectionId = event.currentTarget.id; const isOpen = event.currentTarget.open; setNavOpenState((current) => ({ ...current, [sectionId]: isOpen })); }}>
                <summary className="live-result-group-summary"><CloudRain size={17}/><strong>Weather</strong><span>Forecast for your trip dates</span><ChevronDown size={16} className="group-chevron"/></summary>
                <WeatherPanel location={destinationLabel} startDate={search.departureDate} endDate={search.returnDate} configured={weatherKeyConfigured}/>
              </details>
              <details id={`trip-section-${destination.id}-plan`} data-section-key="plan" className="live-result-group results-utility-group" open onToggle={(event) => { const sectionId = event.currentTarget.id; const isOpen = event.currentTarget.open; setNavOpenState((current) => ({ ...current, [sectionId]: isOpen })); }}>
                <summary className="live-result-group-summary"><ClipboardList size={17}/><strong>Your plan</strong><span>Selected trip items</span><ChevronDown size={16} className="group-chevron"/></summary>
                <SelectedTripSummary selection={selection} experiences={state.result.experiences} currency={search.currency} nights={nights} search={search}/>
                {!selection.outbound && !selection.returnFlight && !selection.hotel && Object.keys(selection.experiences).length === 0 && <p className="empty-inline results-plan-empty">Your plan is empty. Select flights, a place to stay, activities or restaurants to add them here.</p>}
              </details>
              <details id={`trip-section-${destination.id}-cost`} data-section-key="cost" className="live-result-group results-utility-group" open onToggle={(event) => { const sectionId = event.currentTarget.id; const isOpen = event.currentTarget.open; setNavOpenState((current) => ({ ...current, [sectionId]: isOpen })); }}>
                <summary className="live-result-group-summary"><Wallet size={17}/><strong>Cost breakdown</strong><span>Planning estimate</span><ChevronDown size={16} className="group-chevron"/></summary>
                <TripCostLedger selection={selection} experiences={state.result.experiences} currency={search.currency} nights={nights} people={people} budget={totalBudget} flightRequested={search.components.includes("flights")} stayRequested={search.components.includes("stays")} activitiesRequested={search.components.includes("activities")}/>
              </details>
              <p className="provider-disclaimer">Provider results are snapshots, not reservations. Confirm the room or passenger mix, taxes, baggage, cancellation terms and final price with the seller.</p>
            </div>}

            {isExpanded && state?.result && <details id={`trip-section-${destination.id}-schedule`} data-section-key="schedule" className="live-result-group results-utility-group results-schedule-group" open onToggle={(event) => { const sectionId = event.currentTarget.id; const isOpen = event.currentTarget.open; setNavOpenState((current) => ({ ...current, [sectionId]: isOpen })); }}>
              <summary className="live-result-group-summary"><CalendarDays size={17}/><strong>Your trip schedule</strong><span>Chronological itinerary</span><ChevronDown size={16} className="group-chevron"/></summary>
              <div className="itinerary-panel">
                <div className="itinerary-panel-heading">
                  <div><h4>Schedule overview</h4></div>
                  <p>Flights, stay milestones, activities, and dining are combined in one chronological schedule. Change the scheduled date of any selected activity or restaurant to move it to another trip day.</p>
                </div>

              <UnifiedTripSchedule
                search={search}
                selection={selection}
                experiences={state?.result?.experiences ?? []}
                days={itineraryDates}
                nights={nights}
                currency={search.currency}
                destinationAirportCode={airportCode}
                onUpdateStayTime={(field, value) => updateSelection(destination.id, (current) => ({ ...current, [field]: value || undefined }))}
                onUpdateExperience={(experience, plan) => updateExperienceSelection(destination.id, experience, plan)}
              />
              </div>
            </details>}
          </div>
        </motion.article>;
      })}
    </div>

    {assistantContext && assistantRecommendation && <AITripAssistant key={assistantRecommendation.destination.id} context={assistantContext} configured={aiProviderConfigured && databaseConfigured} databaseAvailable={databaseConfigured} geminiAvailable={geminiProviderConfigured} openRouterAvailable={openRouterProviderConfigured} onSetStartingPoint={(location) => resolveStartingPoint(assistantRecommendation.destination.id, location)}/>}

    <div className="planner-method-note"><p><strong>How to read these results.</strong> Flights, properties and places come from the selected providers. Straight-line distances are geographic estimates, not driving times. Weather is only shown when the forecast provider can cover the requested dates. Confirm final terms with the booking provider.</p></div>
  </div>;
}
