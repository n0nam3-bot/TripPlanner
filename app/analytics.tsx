"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

/** Strip trip-search query strings and omit private operations/API routes. */
function sanitizeTelemetryUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    if (parsed.pathname === "/admin" || parsed.pathname.startsWith("/admin/") || parsed.pathname === "/api" || parsed.pathname.startsWith("/api/")) {
      return null;
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return null;
  }
}

export function VercelTelemetry() {
  return (
    <>
      <VercelAnalytics
        beforeSend={(event) => {
          const url = sanitizeTelemetryUrl(event.url);
          return url ? { ...event, url } : null;
        }}
      />
      <SpeedInsights
        sampleRate={0.25}
        beforeSend={(event) => {
          const url = sanitizeTelemetryUrl(event.url);
          return url ? { ...event, url } : null;
        }}
      />
    </>
  );
}
