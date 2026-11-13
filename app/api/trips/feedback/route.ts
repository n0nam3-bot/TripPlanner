import { NextRequest, NextResponse } from "next/server";
import { listTripFeedback, submitTripFeedback } from "@/lib/db/saved-trips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 8 * 1024) return NextResponse.json({ error: "This feedback request is too large." }, { status: 413 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Trip feedback is temporarily unavailable." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The feedback request was not valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Feedback details are required." }, { status: 400 });
  const record = body as Record<string, unknown>;
  try {
    if (record.action === "list") {
      const result = await listTripFeedback(
        typeof record.shareToken === "string" ? record.shareToken : "",
        typeof record.ownerToken === "string" ? record.ownerToken : "",
      );
      return NextResponse.json({ success: true, ...result });
    }
    const result = await submitTripFeedback(typeof record.inviteToken === "string" ? record.inviteToken : "", record);
    return NextResponse.json({ success: true, id: result.id, createdAt: result.createdAt }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "TRIP_FEEDBACK_SAVE_FAILED";
    if (code === "TRIP_FEEDBACK_OWNER_REQUIRED") return NextResponse.json({ error: "Only the saved-trip owner can view this feedback inbox." }, { status: 403 });
    if (code === "TRIP_FEEDBACK_INVITE_NOT_FOUND") return NextResponse.json({ error: "This feedback invitation has expired, reached its submission limit, or is no longer available." }, { status: 404 });
    if (code === "TRIP_FEEDBACK_INVALID") return NextResponse.json({ error: "Choose a feedback category and enter at least 8 characters." }, { status: 400 });
    console.error("Tripfinder could not process traveler feedback.", code);
    return NextResponse.json({ error: "Tripfinder could not process this feedback right now." }, { status: 503 });
  }
}
