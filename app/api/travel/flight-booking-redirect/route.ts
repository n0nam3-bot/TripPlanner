import { NextResponse } from "next/server";
import { recordProviderEvent } from "@/lib/db/travel-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validatedGoogleBookingUrl(value: FormDataEntryValue | null): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["www.google.com", "google.com"].includes(url.hostname.toLowerCase()) && url.pathname === "/travel/clk/f"
      ? url
      : null;
  } catch {
    return null;
  }
}

function validatedGoogleFlightsFallback(value: FormDataEntryValue | null): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["www.google.com", "google.com"].includes(url.hostname.toLowerCase()) && url.pathname === "/travel/flights"
      ? url
      : null;
  } catch {
    return null;
  }
}

function redirectNoStore(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

/**
 * Resolves Google's opaque booking POST. Google may redirect through more than
 * one hop; fetch follows the chain and exposes the final URL as response.url.
 * If Google does not produce a seller destination, return to an exact search
 * rather than showing a dead-end error page.
 */
export async function POST(request: Request) {
  let fallbackUrl: URL | null = null;
  const startedAt = Date.now();
  let journeyId = "";
  const logRedirect = (outcome: "success" | "fallback" | "error", httpStatus: number) => recordProviderEvent({
    provider: "google_flights", category: "flight_booking", eventType: "outbound_redirect", outcome,
    httpStatus, durationMs: Date.now() - startedAt, journeyId,
  });
  try {
    const form = await request.formData();
    const rawJourneyId = form.get("journeyId");
    journeyId = typeof rawJourneyId === "string" && /^[a-f0-9-]{36}$/i.test(rawJourneyId) ? rawJourneyId : "";
    const bookingUrl = validatedGoogleBookingUrl(form.get("url"));
    fallbackUrl = validatedGoogleFlightsFallback(form.get("fallbackUrl"));
    const rawPostData = form.get("postData");
    if (!bookingUrl || typeof rawPostData !== "string" || !rawPostData || rawPostData.length > 30000) {
      await logRedirect(fallbackUrl ? "fallback" : "error", fallbackUrl ? 303 : 400);
      return fallbackUrl
        ? redirectNoStore(fallbackUrl)
        : new NextResponse("The booking request is incomplete. Return to Tripfinder and choose another seller option.", { status: 400 });
    }

    const upstream = await fetch(bookingUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": request.headers.get("user-agent") || "Mozilla/5.0 (compatible; Tripfinder/1.0)",
      },
      body: rawPostData,
      // Follow Google's complete redirect chain. The response body itself is
      // not rendered; only the final HTTPS destination is handed to the user.
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const finalUrl = new URL(upstream.url || bookingUrl.toString());
    const isGoogleHost = ["www.google.com", "google.com"].includes(finalUrl.hostname.toLowerCase());
    if (finalUrl.protocol === "https:" && !isGoogleHost) {
      await logRedirect("success", upstream.status || 302);
      return redirectNoStore(finalUrl);
    }

    await logRedirect(fallbackUrl ? "fallback" : "error", fallbackUrl ? 303 : 502);
    return fallbackUrl
      ? redirectNoStore(fallbackUrl)
      : new NextResponse("Google did not return a seller destination. Return to Tripfinder and open the exact flight search.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
  } catch {
    await logRedirect(fallbackUrl ? "fallback" : "error", fallbackUrl ? 303 : 502);
    return fallbackUrl
      ? redirectNoStore(fallbackUrl)
      : new NextResponse("Unable to resolve this booking link right now. Return to Tripfinder and use the exact Google Flights search.", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
  }
}
