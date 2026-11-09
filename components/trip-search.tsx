"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, CalendarDays, ChevronDown, Hotel, MapPin, PlaneTakeoff, RefreshCw, Users, Wallet } from "lucide-react";
import type { TripComponent, StayType } from "@/lib/trip-planner/types";
import { getDestinationGateways, getDestinationRegionScope, getLocationSuggestions, type LocationSuggestion } from "@/lib/trip-planner/location-suggestions";
import { resolveAirportCode } from "@/lib/trip-planner/airports";

const dateAfter = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function LocationField({
  field, label, value, airportCode, placeholder, onChange, onSelect, includeAttractions = false, includeAirports = false, scope = "",
}: {
  field: "origin" | "destination"; includeAttractions?: boolean; includeAirports?: boolean; label: string; value: string; airportCode: string;
  placeholder: string; onChange: (value: string) => void;
  onSelect: (suggestion: LocationSuggestion) => void; scope?: string;
}) {
  const [open, setOpen] = useState(false);
  const suggestions = useMemo(() => getLocationSuggestions(value, field, includeAttractions, includeAirports, scope), [value, field, includeAttractions, includeAirports, scope]);
  return (
    <div className="search-field location-field">
      <span className="field-icon">{field === "origin" ? <PlaneTakeoff size={17}/> : <MapPin size={17}/>}</span>
      <span className="field-copy">
        <span className="field-label">{label}</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={(event) => { if (!event.currentTarget.parentElement?.parentElement?.contains(event.relatedTarget as Node | null)) setOpen(false); }}
          onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "ArrowDown" && suggestions[0]) { event.preventDefault(); onSelect(suggestions[0]); setOpen(false); } }}
          placeholder={placeholder}
          aria-label={label}
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
        {airportCode && <small className="location-code">{field === "origin" ? "Departure airport" : "Arrival airport"} · {airportCode}</small>}
      </span>
      {open && suggestions.length > 0 && <div className="location-suggestions" role="listbox" aria-label={`${label} suggestions`}>
        <div className="suggestion-heading">{field === "origin" ? "Matching departure points" : "Matching destinations"}</div>
        {suggestions.map((suggestion, index) => {
          const group = suggestion.kind === "region" ? "Countries and states" : suggestion.kind === "airport" ? "Airports" : suggestion.kind === "attraction" ? "Attractions and places" : suggestion.kind === "area" ? "Nearby cities and areas" : "Cities and gateways";
          const previous = suggestions[index - 1];
          const previousGroup = previous ? (previous.kind === "region" ? "Countries and states" : previous.kind === "airport" ? "Airports" : previous.kind === "attraction" ? "Attractions and places" : previous.kind === "area" ? "Nearby cities and areas" : "Cities and gateways") : "";
          return <div className="suggestion-row-wrap" key={`${suggestion.airportCode}-${suggestion.value}`}>
            {group !== previousGroup && <div className="suggestion-group-heading">{group}</div>}
            <button
              type="button" role="option" aria-selected={value === suggestion.value}
              className="location-suggestion"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onSelect(suggestion); setOpen(false); }}
            >
              <span className="suggestion-main">{suggestion.label}</span>
              <span className="suggestion-detail">{suggestion.detail}</span>
              <span className="suggestion-code">{suggestion.airportCode}</span>
            </button>
          </div>;
        })}
      </div>}
    </div>
  );
}

const COMPONENTS: Array<{ value: TripComponent; label: string; description: string; icon: typeof PlaneTakeoff }> = [
  { value: "flights", label: "Flights", description: "Airfare and route options", icon: PlaneTakeoff },
  { value: "stays", label: "Places to stay", description: "Hotels and Airbnb-style rentals", icon: Hotel },
  { value: "activities", label: "Things to do", description: "Attractions and experiences", icon: Activity },
];

const SEARCH_PRESETS: Array<{ label: string; components: TripComponent[] }> = [
  { label: "Complete trip", components: ["flights", "stays", "activities"] },
  { label: "Flights + stays", components: ["flights", "stays"] },
  { label: "Flights + activities", components: ["flights", "activities"] },
  { label: "Stays + activities", components: ["stays", "activities"] },
  { label: "Flights only", components: ["flights"] },
  { label: "Stays only", components: ["stays"] },
  { label: "Activities only", components: ["activities"] },
];

export function TripSearch() {
  const router = useRouter();
  const [origin, setOrigin] = useState("New York (NYC)");
  const [originAirportCode, setOriginAirportCode] = useState("NYC");
  const [destination, setDestination] = useState("Anywhere");
  const [destinationAirportCode, setDestinationAirportCode] = useState("");
  const [destinationArea, setDestinationArea] = useState("");
  const destinationGateways = useMemo(() => getDestinationGateways(destination), [destination]);
  const destinationScope = useMemo(() => getDestinationRegionScope(destination), [destination]);
  const [depart, setDepart] = useState(dateAfter(45));
  const [returnDate, setReturnDate] = useState(dateAfter(50));
  const [adults, setAdults] = useState("2");
  const [childrenAges, setChildrenAges] = useState("");
  const [rooms, setRooms] = useState("1");
  const [budget, setBudget] = useState("2500");
  const [budgetMode, setBudgetMode] = useState("total");
  const [currency, setCurrency] = useState("USD");
  const [style, setStyle] = useState("any");
  const [flexibleDays, setFlexibleDays] = useState("0");
  const [cabin, setCabin] = useState("economy");
  const [stops, setStops] = useState("any");
  const [hotelRating, setHotelRating] = useState("0");
  const [freeCancellation, setFreeCancellation] = useState(false);
  const [temperatureMin, setTemperatureMin] = useState("");
  const [temperatureMax, setTemperatureMax] = useState("");
  const [temperatureUnit, setTemperatureUnit] = useState<"F" | "C">("F");
  const [components, setComponents] = useState<TripComponent[]>(["flights", "stays", "activities"]);
  const [stayTypes, setStayTypes] = useState<StayType[]>(["hotels"]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleComponent(value: TripComponent) {
    setComponents((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }
  function toggleStayType(value: StayType) {
    setStayTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  function applyPreset(values: TripComponent[]) {
    setComponents(values);
    if (values.includes("stays") && stayTypes.length === 0) setStayTypes(["hotels"]);
  }

  function changeTemperatureUnit(nextUnit: "F" | "C") {
    if (nextUnit === temperatureUnit) return;
    const convert = (raw: string) => {
      if (!raw.trim()) return "";
      const value = Number(raw);
      if (!Number.isFinite(value)) return "";
      const converted = temperatureUnit === "F" ? (value - 32) * 5 / 9 : value * 9 / 5 + 32;
      return String(Math.round(converted));
    };
    setTemperatureMin(convert(temperatureMin));
    setTemperatureMax(convert(temperatureMax));
    setTemperatureUnit(nextUnit);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (submitting) return;
    if (components.length === 0) return setError("Choose at least one search: flights, places to stay or things to do.");
    const selectedOriginCode = originAirportCode || resolveAirportCode(origin) || "";
    const typedArea = destinationArea.trim();
    const selectedDestination = typedArea
      ? (typedArea.includes(",") || typedArea.toLocaleLowerCase() === destination.trim().toLocaleLowerCase() ? typedArea : `${typedArea}, ${destination.trim()}`)
      : destination.trim();
    const hasLocalTravelComponents = components.includes("stays") || components.includes("activities");
    if (destinationScope && hasLocalTravelComponents && !typedArea) {
      return setError(`Choose a city or area within ${destinationScope} so Tripfinder can return nearby stays, attractions and restaurants instead of unrelated results across the entire region.`);
    }
    if (components.includes("flights") && !selectedOriginCode) return setError("Choose a departure city or airport from the suggestions so we can search the correct route.");
    if (components.includes("flights") && selectedDestination.toLowerCase() !== "anywhere" && !destinationAirportCode && !resolveAirportCode(selectedDestination)) return setError(destinationGateways.length ? "Choose an arrival airport for this state or area before searching flights." : "Choose a destination city or arrival airport from the suggestions for flight searches.");
    if (!selectedDestination) return setError("Enter a destination or choose Anywhere.");
    if (!depart || !returnDate) return setError("Choose check-in/departure and check-out/return dates.");
    if (new Date(`${returnDate}T00:00:00`) <= new Date(`${depart}T00:00:00`)) return setError("Your return or check-out date must be after departure or check-in.");
    if (new Date(`${depart}T00:00:00`).getTime() < new Date(`${dateAfter(0)}T00:00:00`).getTime()) return setError("Your departure or check-in date cannot be in the past.");
    if (!Number.isFinite(Number(budget)) || Number(budget) < 50) return setError("Enter a trip budget of at least 50.");
    if (Number(adults) < 1 || Number(adults) > 9) return setError("Choose between 1 and 9 adults.");
    const ages = childrenAges.trim() ? childrenAges.split(/[ ,]+/).filter(Boolean) : [];
    if (ages.some((age) => !/^\d+$/.test(age) || Number(age) < 1 || Number(age) > 17)) return setError("Enter each child's age from 1 to 17, separated by commas.");
    if (Number(rooms) < 1 || Number(rooms) > 8) return setError("Choose between 1 and 8 rooms.");
    if (components.includes("stays") && stayTypes.length === 0) return setError("Choose hotels, vacation rentals or both.");
    const minTemp = temperatureMin.trim() === "" ? null : Number(temperatureMin);
    const maxTemp = temperatureMax.trim() === "" ? null : Number(temperatureMax);
    const tempFloor = temperatureUnit === "F" ? -40 : -40;
    const tempCeiling = temperatureUnit === "F" ? 130 : 55;
    if (minTemp !== null && (!Number.isFinite(minTemp) || minTemp < tempFloor || minTemp > tempCeiling)) return setError(`Minimum temperature must be between ${tempFloor} and ${tempCeiling}°${temperatureUnit}.`);
    if (maxTemp !== null && (!Number.isFinite(maxTemp) || maxTemp < tempFloor || maxTemp > tempCeiling)) return setError(`Maximum temperature must be between ${tempFloor} and ${tempCeiling}°${temperatureUnit}.`);
    if (minTemp !== null && maxTemp !== null && minTemp >= maxTemp) return setError("Maximum temperature must be higher than minimum temperature.");

    setSubmitting(true);
    const params = new URLSearchParams({
      origin: origin.trim(), originAirportCode: selectedOriginCode,
      destination: selectedDestination, destinationAirportCode: destinationAirportCode || resolveAirportCode(selectedDestination) || "",
      depart, return: returnDate, adults, childrenAges: ages.join(","), rooms, budget, budgetMode, currency, style,
      flexibleDays: "0", cabin, stops, hotelRating, freeCancellation: String(freeCancellation),
      components: components.join(","), stayTypes: stayTypes.join(","),
      temperatureMin: temperatureMin.trim(), temperatureMax: temperatureMax.trim(), temperatureUnit,
    });
    router.push(`/results?${params.toString()}`);
  }

  return (
    <form className="search-card search-card-product" onSubmit={submit} id="plan">
      <div className="search-card-top">
        <div><span className="eyebrow">TRIP SEARCH</span><h2>What are you looking to book?</h2></div>
        <span className="search-step-note">Choose flights, stays, activities or any combination. U.S. states can be narrowed to a city or area; flights use a separate airport gateway.</span>
      </div>

      <div className="search-presets" aria-label="Common search combinations">
        {SEARCH_PRESETS.map((preset) => {
          const active = preset.components.length === components.length && preset.components.every((item) => components.includes(item));
          return <button type="button" key={preset.label} className={active ? "is-active" : ""} aria-pressed={active} onClick={() => applyPreset(preset.components)}>{preset.label}</button>;
        })}
      </div>

      <div className="component-picker" aria-label="What to search for">
        {COMPONENTS.map(({ value, label, description, icon: Icon }) => {
          const selected = components.includes(value);
          return <button type="button" key={value} className={`component-option ${selected ? "is-selected" : ""}`} aria-pressed={selected} onClick={() => toggleComponent(value)}>
            <span className="component-check">{selected ? <span/> : null}</span><Icon size={18}/><span className="component-option-copy"><strong>{label}</strong><small>{description}</small></span>
          </button>;
        })}
      </div>

      {components.includes("stays") && <div className="stay-type-row"><span>Accommodation:</span>
        <label><input type="checkbox" checked={stayTypes.includes("hotels")} onChange={() => toggleStayType("hotels")}/> Hotels</label>
        <label><input type="checkbox" checked={stayTypes.includes("vacation_rentals")} onChange={() => toggleStayType("vacation_rentals")}/> Vacation rentals</label>
      </div>}

      <div className={`search-fields ${components.includes("flights") ? "has-origin" : "no-origin"}`}>
        {components.includes("flights") && <LocationField field="origin" label="Leaving from" value={origin} airportCode={originAirportCode} placeholder="City or airport" onChange={(value) => { setOrigin(value); setOriginAirportCode(resolveAirportCode(value) || ""); }} onSelect={(item) => { setOrigin(item.value); setOriginAirportCode(item.airportCode); }}/ >}
        <LocationField field="destination" label="Going to" value={destination} airportCode={components.includes("flights") ? destinationAirportCode : ""} placeholder="Country, state, city or area" includeAttractions={components.includes("activities")} includeAirports={components.includes("flights")} onChange={(value) => { setDestination(value); setDestinationArea(""); setDestinationAirportCode(""); }} onSelect={(item) => { setDestination(item.value); setDestinationArea(""); setDestinationAirportCode(item.airportCode); }}/>
        {destinationScope && <LocationField field="destination" label={`City or area in ${destinationScope}`} value={destinationArea} airportCode="" placeholder="Choose or type a city, town, resort or nearby area" scope={destinationScope} onChange={(value) => { setDestinationArea(value); setDestinationAirportCode(""); }} onSelect={(item) => { setDestinationArea(item.value); if (item.airportCode) setDestinationAirportCode(item.airportCode); }}/ >}
        {components.includes("flights") && destinationGateways.length > 0 && <label className="search-field gateway-field"><span className="field-icon"><PlaneTakeoff size={17}/></span><span className="field-copy"><span className="field-label">Arrival airport</span><select value={destinationAirportCode} onChange={(event) => setDestinationAirportCode(event.target.value)} aria-label="Choose arrival airport"><option value="">Choose a gateway</option>{destinationAirportCode && !destinationGateways.some((gateway) => gateway.code === destinationAirportCode) && <option value={destinationAirportCode}>Selected nearby airport · {destinationAirportCode}</option>}{destinationGateways.map((gateway) => <option value={gateway.code} key={gateway.code}>{gateway.label}</option>)}</select></span><ChevronDown className="select-chevron" size={14}/></label>}
        {components.includes("flights") && (destinationArea || destination).trim().toLowerCase() !== "anywhere" && destinationGateways.length === 0 && !destinationAirportCode && !resolveAirportCode(destinationArea || destination) && <label className="search-field gateway-field"><span className="field-icon"><PlaneTakeoff size={17}/></span><span className="field-copy"><span className="field-label">Arrival airport code</span><input value={destinationAirportCode} onChange={(event) => setDestinationAirportCode(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))} placeholder="3-letter IATA code" maxLength={3} autoCapitalize="characters" aria-label="Arrival airport three-letter IATA code"/><small className="location-code">Enter the airport code serving your selected country or area.</small></span></label>}

        <label className="search-field"><span className="field-icon"><CalendarDays size={17}/></span><span className="field-copy"><span className="field-label">{components.includes("flights") ? "Depart" : "Check in / start"}</span><input type="date" value={depart} min={dateAfter(0)} onChange={(e) => setDepart(e.target.value)} aria-label="Departure or check-in date"/></span></label>
        <label className="search-field"><span className="field-icon"><CalendarDays size={17}/></span><span className="field-copy"><span className="field-label">{components.includes("flights") ? "Return" : "Check out / end"}</span><input type="date" value={returnDate} min={depart || dateAfter(0)} onChange={(e) => setReturnDate(e.target.value)} aria-label="Return or check-out date"/></span></label>
        <label className="search-field"><span className="field-icon"><Users size={17}/></span><span className="field-copy"><span className="field-label">Travelers</span><select value={adults} onChange={(e) => setAdults(e.target.value)} aria-label="Number of adults">{Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? "adult" : "adults"}</option>)}</select></span><ChevronDown className="select-chevron" size={14}/></label>
        <label className="search-field"><span className="field-icon"><Wallet size={17}/></span><span className="field-copy"><span className="field-label">Total budget</span><input type="number" min="50" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Travel budget"/></span></label>
      </div>
      {components.includes("flights") && (destinationArea || destination).trim().toLowerCase() !== "anywhere" && !destinationAirportCode && !resolveAirportCode(destinationArea || destination) && <p className="location-help">{destinationGateways.length ? "Choose the nearest practical gateway airport for flights. Narrow the state to a city or nearby area above to target stays and activities more precisely." : "Enter a 3-letter IATA airport code for this destination's flight search. Stays and activities use the selected city or area."}</p>}

      <div className="search-bottom">
        <div className="search-preferences">
          <label className="preference-select">Trip style <select value={style} onChange={(e) => setStyle(e.target.value)}><option value="any">No preference</option><option value="beach">Beach</option><option value="city">City</option><option value="food">Food and culture</option><option value="nature">Nature</option><option value="romantic">Romantic</option><option value="family">Family</option><option value="adventure">Adventure</option><option value="culture">History and culture</option></select><ChevronDown size={13}/></label>
          <div className="temperature-filter temperature-filter-inline">
            <div className="temperature-filter-heading"><strong>Typical daytime high</strong><small>Monthly climate average for your dates</small></div>
            <div className="temperature-filter-controls">
              <label><span className="sr-only">Minimum temperature</span><input type="number" min={-40} max={temperatureUnit === "F" ? 130 : 55} step="1" value={temperatureMin} onChange={(e) => setTemperatureMin(e.target.value)} placeholder="Min" aria-label={`Minimum temperature in ${temperatureUnit === "F" ? "Fahrenheit" : "Celsius"}`}/></label>
              <span>to</span>
              <label><span className="sr-only">Maximum temperature</span><input type="number" min={-40} max={temperatureUnit === "F" ? 130 : 55} step="1" value={temperatureMax} onChange={(e) => setTemperatureMax(e.target.value)} placeholder="Max" aria-label={`Maximum temperature in ${temperatureUnit === "F" ? "Fahrenheit" : "Celsius"}`}/></label>
              <select value={temperatureUnit} onChange={(e) => changeTemperatureUnit(e.target.value as "F" | "C")} aria-label="Temperature unit"><option value="F">°F</option><option value="C">°C</option></select>
            </div>
          </div>
        </div>
        <button type="submit" className="button button-dark search-submit" disabled={submitting}>{submitting ? <><RefreshCw size={15} className="spin"/> Building search</> : <>Search trips <ArrowRight size={17}/></>}</button>
      </div>

      <details className="advanced-search">
        <summary>More details <ChevronDown size={14}/></summary>
        <div className="advanced-search-grid">
          <label>Children's ages <input value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="e.g. 5, 9" inputMode="numeric"/><small>Separate ages with commas.</small></label>
          {components.includes("stays") && <label>Rooms <select value={rooms} onChange={(e) => setRooms(e.target.value)}>{Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? "room" : "rooms"}</option>)}</select></label>}
          <label>Budget applies to <select value={budgetMode} onChange={(e) => setBudgetMode(e.target.value)}><option value="total">Entire trip / all travelers</option><option value="per_person">Per traveler</option></select></label>
          <label>Currency <select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="USD">USD · US Dollar</option><option value="CAD">CAD · Canadian Dollar</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · British Pound</option></select></label>
          {components.includes("flights") && <><label>Cabin <select value={cabin} onChange={(e) => setCabin(e.target.value)}><option value="economy">Economy</option><option value="premium_economy">Premium economy</option><option value="business">Business</option><option value="first">First class</option></select></label><label>Flight stops <select value={stops} onChange={(e) => setStops(e.target.value)}><option value="any">Any</option><option value="nonstop">Nonstop only</option><option value="one_stop">Up to 1 stop</option><option value="two_stops">Up to 2 stops</option></select></label></>}
          {components.includes("stays") && <><label>Minimum hotel rating <select value={hotelRating} onChange={(e) => setHotelRating(e.target.value)}><option value="0">No preference</option><option value="3">3-star or higher</option><option value="4">4-star or higher</option><option value="5">5-star</option></select></label><label className="advanced-checkbox"><input type="checkbox" checked={freeCancellation} onChange={(e) => setFreeCancellation(e.target.checked)}/> Prefer free cancellation</label></>}
        </div>
      </details>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="search-footnote">Search the parts of the trip you need. Booking and payment happen with the provider.</p>
    </form>
  );
}
