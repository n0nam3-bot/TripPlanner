"use client";

import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown, Clock3, Plane, Wallet } from "lucide-react";

type Props = {
  number: string; badge: string; name: string; subtitle: string; image: string;
  estimate: string; perPerson: string; nights: string; flight: string; stay: string; extras: string; highlights: string[];
};

export function ResultTripCard(props: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="trip-card">
      <div className="trip-card-image" style={{ backgroundImage: `url('${props.image}')` }}>
        <span className="trip-number">{props.number}</span>
        <span className="trip-badge">{props.badge}</span>
      </div>
      <div className="trip-card-body">
        <div className="trip-card-heading"><div><span className="trip-kicker">SAMPLE TRIP IDEA</span><h3>{props.name}</h3><p>{props.subtitle}</p></div><span className="trip-bookmark"><Check size={15}/></span></div>
        <div className="trip-highlights">{props.highlights.map((item) => <span key={item}><Check size={12}/>{item}</span>)}</div>
        <div className="trip-price-row"><div><span>Illustrative trip estimate</span><strong>{props.estimate}</strong><small>{props.perPerson} per person · {props.nights}</small></div><button className="expand-trip" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Hide details" : "Trip breakdown"}<ChevronDown size={16} className={expanded ? "chevron-up" : ""}/></button></div>
        {expanded && <div className="trip-breakdown"><div><Plane size={15}/><span>{props.flight}</span></div><div><Wallet size={15}/><span>{props.stay}</span></div><div><Clock3 size={15}/><span>{props.extras}</span></div><p>Sample allowances only. No live provider pricing, room availability, taxes or baggage fees have been checked.</p></div>}
        <div className="trip-card-bottom"><span><span className="sample-status-dot"/> Demo data · Not bookable</span><button className="trip-card-link" onClick={() => setExpanded(true)}>Explore this idea <ArrowUpRight size={15}/></button></div>
      </div>
    </article>
  );
}
