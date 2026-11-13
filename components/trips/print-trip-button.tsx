"use client";

import { Printer } from "lucide-react";

export function PrintTripButton() {
  return <button type="button" className="saved-trip-print-button no-print" onClick={() => window.print()}>
    <Printer size={14} aria-hidden="true"/> Print itinerary
  </button>;
}
