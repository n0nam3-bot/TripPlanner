import { NextRequest, NextResponse } from "next/server";
import { applyTripFeedbackEdit } from "@/lib/db/saved-trips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Trip feedback is temporarily unavailable." }, { status: 503 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8 * 1024) return NextResponse.json({ error: "This edit request is too large." }, { status: 413 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The edit request was not valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Owner approval details are required." }, { status: 400 });
  const record = body as Record<string, unknown>;
  try {
    const result = await applyTripFeedbackEdit(
      typeof record.shareToken === "string" ? record.shareToken : "",
      typeof record.ownerToken === "string" ? record.ownerToken : "",
      typeof record.feedbackId === "string" ? record.feedbackId : "",
      typeof record.expectedUpdatedAt === "string" ? record.expectedUpdatedAt : "",
      record.patch,
    );
    return NextResponse.json({ success: true, updatedAt: result.updatedAt, snapshot: result.snapshot, summary: result.summary });
  } catch (error) {
    const code = error instanceof Error ? error.message : "TRIP_FEEDBACK_APPLY_FAILED";
    if (code === "TRIP_FEEDBACK_OWNER_REQUIRED") return NextResponse.json({ error: "Only the saved-trip owner can apply a suggestion." }, { status: 403 });
    if (code === "TRIP_FEEDBACK_CONFLICT") return NextResponse.json({ error: "The itinerary or suggestion changed after you opened the preview. Refresh the feedback inbox and prepare the edit again." }, { status: 409 });
    if (code === "TRIP_FEEDBACK_DATE_OUTSIDE_TRIP") return NextResponse.json({ error: "Choose a date within the current trip range. Update the trip dates first if the traveler is extending the trip." }, { status: 400 });
    if (code === "TRIP_FEEDBACK_TARGET_INVALID") return NextResponse.json({ error: "That selected activity or restaurant is no longer available in the saved itinerary. Refresh the trip before applying this suggestion." }, { status: 400 });
    if (code === "TRIP_FEEDBACK_INVALID") return NextResponse.json({ error: "The proposed itinerary change was not valid." }, { status: 400 });
    console.error("Tripfinder could not apply an owner-approved traveler suggestion.", code);
    return NextResponse.json({ error: "Tripfinder could not apply this suggestion right now." }, { status: 503 });
  }
}
