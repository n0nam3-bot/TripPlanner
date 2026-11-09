"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronDown, MapPin, PlaneTakeoff, Users, Wallet, SlidersHorizontal, Hotel } from "lucide-react";

const dateAfter = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function TripSearch() {
  const router = useRouter();
  const [origin, setOrigin] = useState("New York (NYC)");
  const [destination, setDestination] = useState("Anywhere");
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
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!origin.trim()) return setError("Add a departure city or three-letter airport code.");
    if (!destination.trim()) return setError("Enter a destination or choose Anywhere.");
    if (!depart || !returnDate) return setError("Choose both a departure and return date.");
    if (new Date(`${returnDate}T00:00:00`) <= new Date(`${depart}T00:00:00`)) return setError("Your return date must be after your departure date.");
    if (new Date(`${depart}T00:00:00`).getTime() < new Date(`${dateAfter(0)}T00:00:00`).getTime()) return setError("Your departure date cannot be in the past.");
    if (!Number.isFinite(Number(budget)) || Number(budget) < 50) return setError("Enter a trip budget of at least 50.");
    if (Number(adults) < 1 || Number(adults) > 9) return setError("Choose between 1 and 9 adults.");
    const ages = childrenAges.trim() ? childrenAges.split(/[ ,]+/).filter(Boolean) : [];
    if (ages.some((age) => !/^\d+$/.test(age) || Number(age) < 1 || Number(age) > 17)) return setError("Enter each child's age from 1 to 17, separated by commas.");
    if (Number(rooms) < 1 || Number(rooms) > 8) return setError("Choose between 1 and 8 rooms.");

    const params = new URLSearchParams({
      origin: origin.trim(), destination: destination.trim(), depart, return: returnDate,
      adults, childrenAges: ages.join(","), rooms, budget, budgetMode, currency, style,
      flexibleDays, cabin, stops, hotelRating, freeCancellation: String(freeCancellation),
    });
    router.push(`/results?${params.toString()}`);
  }

  return (
    <form className="search-card" onSubmit={submit} id="plan">
      <div className="search-card-top">
        <div><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h2>Let’s find your kind of getaway.</h2></div>
        <span className="step-note">01 <i /> Tell us what matters</span>
      </div>

      <div className="search-fields">
        <label className="search-field"><span className="field-icon"><PlaneTakeoff size={17} /></span><span className="field-copy"><span className="field-label">Leaving from</span><input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="City or airport code" aria-label="Departure city or airport" autoComplete="address-level2" /></span></label>
        <label className="search-field"><span className="field-icon"><MapPin size={17} /></span><span className="field-copy"><span className="field-label">Going to</span><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Anywhere or a destination" aria-label="Destination" /></span></label>
        <label className="search-field"><span className="field-icon"><CalendarDays size={17} /></span><span className="field-copy"><span className="field-label">Depart</span><input type="date" value={depart} min={dateAfter(0)} onChange={(e) => setDepart(e.target.value)} aria-label="Departure date" /></span></label>
        <label className="search-field"><span className="field-icon"><CalendarDays size={17} /></span><span className="field-copy"><span className="field-label">Return</span><input type="date" value={returnDate} min={depart || dateAfter(0)} onChange={(e) => setReturnDate(e.target.value)} aria-label="Return date" /></span></label>
        <label className="search-field"><span className="field-icon"><Users size={17} /></span><span className="field-copy"><span className="field-label">Adults</span><select value={adults} onChange={(e) => setAdults(e.target.value)} aria-label="Number of adults">{Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? "adult" : "adults"}</option>)}</select></span><ChevronDown className="select-chevron" size={14} /></label>
        <label className="search-field"><span className="field-icon"><Wallet size={17} /></span><span className="field-copy"><span className="field-label">Budget</span><input type="number" min="50" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Travel budget" /></span></label>
      </div>

      <div className="search-bottom">
        <div className="search-preferences">
          <label className="preference-select">Trip style <select value={style} onChange={(e) => setStyle(e.target.value)}><option value="any">A little bit of everything</option><option value="beach">Beach and slow days</option><option value="city">City exploration</option><option value="food">Food and local culture</option><option value="nature">Nature and scenery</option><option value="romantic">Romantic escape</option><option value="family">Family-friendly</option><option value="adventure">Adventure</option><option value="culture">History and culture</option></select><ChevronDown size={13} /></label>
          <label className="preference-select">Date flexibility <select value={flexibleDays} onChange={(e) => setFlexibleDays(e.target.value)}><option value="0">Exact dates</option><option value="1">± 1 day</option><option value="3">± 3 days</option><option value="7">± 7 days</option></select><ChevronDown size={13} /></label>
        </div>
        <button type="submit" className="button button-dark search-submit">Build my trip <ArrowRight size={17} /></button>
      </div>

      <details className="advanced-search">
        <summary><SlidersHorizontal size={15} /> More trip preferences <span>Children, rooms, flight and hotel requirements</span></summary>
        <div className="advanced-search-grid">
          <label>Children's ages <input value={childrenAges} onChange={(e) => setChildrenAges(e.target.value)} placeholder="e.g. 5, 9" inputMode="numeric" /><small>Separate ages with commas. Leave blank if none.</small></label>
          <label><span><Hotel size={14}/> Hotel rooms</span><select value={rooms} onChange={(e) => setRooms(e.target.value)}>{Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? "room" : "rooms"}</option>)}</select><small>Live hotel results are only occupancy-verified for one room in the current provider.</small></label>
          <label>Budget applies to <select value={budgetMode} onChange={(e) => setBudgetMode(e.target.value)}><option value="total">Entire trip / all travelers</option><option value="per_person">Per traveler</option></select></label>
          <label>Currency <select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="USD">USD · US Dollar</option><option value="CAD">CAD · Canadian Dollar</option><option value="EUR">EUR · Euro</option><option value="GBP">GBP · British Pound</option></select></label>
          <label>Cabin class <select value={cabin} onChange={(e) => setCabin(e.target.value)}><option value="economy">Economy</option><option value="premium_economy">Premium economy</option><option value="business">Business</option><option value="first">First class</option></select></label>
          <label>Flight stops <select value={stops} onChange={(e) => setStops(e.target.value)}><option value="any">Any number</option><option value="nonstop">Nonstop only</option><option value="one_stop">Nonstop or 1 stop</option><option value="two_stops">Up to 2 stops</option></select></label>
          <label>Minimum hotel category <select value={hotelRating} onChange={(e) => setHotelRating(e.target.value)}><option value="0">No preference</option><option value="3">3-star or higher</option><option value="4">4-star or higher</option><option value="5">5-star</option></select></label>
          <label className="advanced-checkbox"><input type="checkbox" checked={freeCancellation} onChange={(e) => setFreeCancellation(e.target.checked)} /> Prefer free-cancellation stays</label>
        </div>
      </details>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="search-footnote">Your requirements are checked before recommendations are ranked. No booking or payment happens here.</p>
    </form>
  );
}
