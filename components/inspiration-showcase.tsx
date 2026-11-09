"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

type InspirationPlace = {
  name: string;
  country: string;
  note: string;
  image: string;
  href: string;
  tag: string;
};

export function InspirationShowcase({ places }: { places: InspirationPlace[] }) {
  const [activeName, setActiveName] = useState(places[0]?.name ?? "");
  const active = places.find((place) => place.name === activeName) ?? places[0];
  const alternatives = places.filter((place) => place.name !== active?.name);

  if (!active) return null;

  return (
    <div className="inspiration-showcase" aria-label="Destination inspiration">
      <Link
        href={active.href}
        className="inspiration-feature"
        style={{ backgroundImage: `url('${active.image}')` }}
        aria-label={`Search a trip to ${active.name}, ${active.country}`}
      >
        <span className="inspiration-feature-shade" />
        <span className="inspiration-feature-tag">{active.tag}</span>
        <span className="inspiration-feature-copy">
          <span>{active.country}</span>
          <strong>{active.name}</strong>
          <small>{active.note}</small>
        </span>
        <span className="inspiration-feature-cta">Explore this trip <ArrowUpRight size={15} /></span>
      </Link>

      <div className="inspiration-options" aria-label="More destinations">
        {alternatives.map((place) => (
          <Link
            key={place.name}
            href={place.href}
            className="inspiration-option"
            onMouseEnter={() => setActiveName(place.name)}
            onFocus={() => setActiveName(place.name)}
            aria-label={`Search a trip to ${place.name}, ${place.country}`}
          >
            <span className="inspiration-option-image" style={{ backgroundImage: `url('${place.image}')` }} />
            <span className="inspiration-option-shade" />
            <span className="inspiration-option-copy">
              <small>{place.country}</small>
              <strong>{place.name}</strong>
            </span>
            <ArrowUpRight className="inspiration-option-arrow" size={14} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
