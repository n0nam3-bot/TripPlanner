import { NextRequest, NextResponse } from "next/server";
import { reviewTripFeedback } from "@/lib/db/saved-trips";
import { isTripFeedbackStatus } from "@/lib/trip-planner/trip-feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Trip feedback is temporarily unavailable." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The review request was not valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Feedback review details are required." }, { status: 400 });
  const record = body as Record<string, unknown>;
  if (!isTripFeedbackStatus(record.status)) return NextResponse.json({ error: "Choose a valid feedback status." }, { status: 400 });
  try {
    const result = await reviewTripFeedback(
      typeof record.shareToken === "string" ? record.shareToken : "",
      typeof record.ownerToken === "string" ? record.ownerToken : "",
      typeof record.feedbackId === "string" ? record.feedbackId : "",
      record.status,
      typeof record.expectedUpdatedAt === "string" ? record.expectedUpdatedAt : "",
    );
    return NextResponse.json({ success: true, updatedAt: result.updatedAt });
  } catch (error) {
    const code = error instanceof Error ? error.message : "TRIP_FEEDBACK_REVIEW_FAILED";
    if (code === "TRIP_FEEDBACK_OWNER_REQUIRED") return NextResponse.json({ error: "Only the saved-trip owner can review feedback." }, { status: 403 });
    if (code === "TRIP_FEEDBACK_CONFLICT") return NextResponse.json({ error: "The saved trip changed or this suggestion was already reviewed. Refresh the feedback inbox before trying again." }, { status: 409 });
    if (code === "TRIP_FEEDBACK_INVALID") return NextResponse.json({ error: "The feedback review request was not valid." }, { status: 400 });
    console.error("Tripfinder could not review traveler feedback.", code);
    return NextResponse.json({ error: "Tripfinder could not update this feedback right now." }, { status: 503 });
  }
}
