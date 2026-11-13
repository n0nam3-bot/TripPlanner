"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { TRIP_FEEDBACK_CATEGORIES } from "@/lib/trip-planner/trip-feedback";

const categoryLabels: Record<(typeof TRIP_FEEDBACK_CATEGORIES)[number], string> = {
  dates: "Dates or schedule", flights: "Flights", stay: "Hotel or Airbnb", activities: "Activities", dining: "Restaurants", budget: "Budget", other: "Other",
};

type Props = { inviteToken: string; tripTitle: string; destination: string; expiresAt: string };

export function TripFeedbackForm({ inviteToken, tripTitle, destination, expiresAt }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof TRIP_FEEDBACK_CATEGORIES)[number]>("other");
  const [itemTitle, setItemTitle] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitted) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/trips/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken, name, category, itemTitle, message }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Tripfinder could not submit your feedback.");
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tripfinder could not submit your feedback.");
    } finally { setPending(false); }
  }

  return <section className="trip-feedback-card">
    <span className="eyebrow">INVITED TRAVELER FEEDBACK</span>
    <h1>Suggest an update</h1>
    <p className="trip-feedback-context"><strong>{tripTitle}</strong><br/>{destination}</p>
    {submitted ? <div className="trip-feedback-success" role="status"><CheckCircle2 size={22}/><div><strong>Feedback sent</strong><p>The trip owner can review your suggestion. It will not change the itinerary automatically.</p></div></div> : <form onSubmit={(event) => void submit(event)}>
      <label>Your name <span>Optional</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="name" placeholder="Name"/></label>
      <label>What is this about?<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{TRIP_FEEDBACK_CATEGORIES.map((key) => <option key={key} value={key}>{categoryLabels[key]}</option>)}</select></label>
      <label>Which item? <span>Optional</span><input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} maxLength={140} placeholder="Hotel, flight, activity, or leave blank"/></label>
      <label>Your suggestion<textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={8} maxLength={2000} rows={5} required placeholder="Describe what you would change or add…"/></label>
      {error && <p className="trip-feedback-error" role="alert">{error}</p>}
      <button type="submit" disabled={pending || message.trim().length < 8}><Send size={16}/>{pending ? "Sending feedback…" : "Send suggestion"}</button>
    </form>}
    <p className="trip-feedback-expiry">This invitation expires {new Date(expiresAt).toLocaleDateString("en-US", { dateStyle: "medium" })}. It allows feedback only; it does not allow itinerary editing or booking.</p>
  </section>;
}
