import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Relays Google's opaque booking_request POST without decoding or re-encoding
 * the form body. Google returns a redirect to the airline/booking seller.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const rawUrl = form.get("url");
    const rawPostData = form.get("postData");
    if (typeof rawUrl !== "string" || typeof rawPostData !== "string" || !rawPostData || rawPostData.length > 30000) {
      return new NextResponse("The booking request is incomplete. Return to Tripfinder and choose another seller option.", { status: 400 });
    }

    const bookingUrl = new URL(rawUrl);
    if (bookingUrl.protocol !== "https:" || !["www.google.com", "google.com"].includes(bookingUrl.hostname) || bookingUrl.pathname !== "/travel/clk/f") {
      return new NextResponse("The booking destination was not recognized. Return to Tripfinder and choose another seller option.", { status: 400 });
    }

    const upstream = await fetch(bookingUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "text/html,application/xhtml+xml",
      },
      body: rawPostData,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    const location = upstream.headers.get("location");
    if (location) {
      const destination = new URL(location, bookingUrl);
      if (destination.protocol !== "https:") {
        return new NextResponse("The booking provider returned an insecure destination. No link was opened.", { status: 502 });
      }
      return NextResponse.redirect(destination, 303);
    }

    return new NextResponse("Google did not return a booking destination for this fare. Return to Tripfinder and use the airline's direct website or Google Flights search.", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return new NextResponse("Unable to resolve this booking link right now. Return to Tripfinder and try another seller.", { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
