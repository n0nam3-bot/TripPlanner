"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronDown, MapPin, PlaneTakeoff, Users, Wallet } from "lucide-react";

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
  const [travelers, setTravelers] = useState("2 adults");
  const [budget, setBudget] = useState("2500");
  const [style, setStyle] = useState("A little bit of everything");
  const [flexible, setFlexible] = useState(true);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!origin.trim()) return setError("Add a departure city or airport so we know where to begin.");
    if (!depart || !returnDate) return setError("Choose both a departure and return date.");
    if (new Date(returnDate) <= new Date(depart)) return setError("Your return date must be after your departure date.");
    if (!Number.isFinite(Number(budget)) || Number(budget) <= 0) return setError("Enter a trip budget greater than zero.");

    const params = new URLSearchParams({
      origin: origin.trim(),
      destination: destination.trim() || "Anywhere",
      depart,
      return: returnDate,
      travelers,
      budget,
      style,
      flexible: String(flexible),
    });
    router.push(`/results?${params.toString()}`);
  }

  return (
    <form className="search-card" onSubmit={submit} id="plan">
      <div className="search-card-top">
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2>Let’s find your kind of getaway.</h2>
        </div>
        <span className="step-note">01 <i />  Tell us what you have in mind</span>
      </div>

      <div className="search-fields">
        <label className="search-field">
          <span className="field-icon"><PlaneTakeoff size={17} /></span>
          <span className="field-copy"><span className="field-label">Leaving from</span><input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="City or airport" aria-label="Departure city or airport" /></span>
        </label>
        <label className="search-field">
          <span className="field-icon"><MapPin size={17} /></span>
          <span className="field-copy"><span className="field-label">Going to</span><input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Anywhere or a destination" aria-label="Destination" /></span>
        </label>
        <label className="search-field">
          <span className="field-icon"><CalendarDays size={17} /></span>
          <span className="field-copy"><span className="field-label">Depart</span><input type="date" value={depart} min={dateAfter(0)} onChange={(e) => setDepart(e.target.value)} aria-label="Departure date" /></span>
        </label>
        <label className="search-field">
          <span className="field-icon"><CalendarDays size={17} /></span>
          <span className="field-copy"><span className="field-label">Return</span><input type="date" value={returnDate} min={depart || dateAfter(0)} onChange={(e) => setReturnDate(e.target.value)} aria-label="Return date" /></span>
        </label>
        <label className="search-field">
          <span className="field-icon"><Users size={17} /></span>
          <span className="field-copy"><span className="field-label">Travelers</span><select value={travelers} onChange={(e) => setTravelers(e.target.value)} aria-label="Number of travelers"><option>1 adult</option><option>2 adults</option><option>3 adults</option><option>4 adults</option><option>2 adults, 1 child</option><option>2 adults, 2 children</option><option>Family (4+)</option></select></span><ChevronDown className="select-chevron" size={14} />
        </label>
        <label className="search-field">
          <span className="field-icon"><Wallet size={17} /></span>
          <span className="field-copy"><span className="field-label">Total budget · USD</span><input type="number" min="1" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} aria-label="Total trip budget in US dollars" /></span>
        </label>
      </div>

      <div className="search-bottom">
        <div className="search-preferences">
          <label className="preference-select">Trip mood <select value={style} onChange={(e) => setStyle(e.target.value)}><option>A little bit of everything</option><option>Beach & slow days</option><option>Food, culture & city life</option><option>Nature & adventure</option><option>Romantic escape</option><option>Family-friendly fun</option></select><ChevronDown size={13} /></label>
          <label className="flexible-toggle"><input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} /><span className="toggle-ui" /> My dates are flexible</label>
        </div>
        <button type="submit" className="button button-dark search-submit">Find my getaway <ArrowRight size={17} /></button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="search-footnote">No booking, no pressure. Just thoughtful trip ideas built around you.</p>
    </form>
  );
}
