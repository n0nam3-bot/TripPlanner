import { NextRequest, NextResponse } from "next/server";
import { createTripFeedbackInvite } from "@/lib/db/saved-trips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Feedback invitations are unavailable because saved trips are not configured." }, { status: 503 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "The invitation request was not valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Saved-trip owner permission is required." }, { status: 400 });
  const record = body as Record<string, unknown>;
  try {
    const invite = await createTripFeedbackInvite(
      typeof record.shareToken === "string" ? record.shareToken : "",
      typeof record.ownerToken === "string" ? record.ownerToken : "",
    );
    return NextResponse.json({ success: true, inviteUrl: `${request.nextUrl.origin}/trip/feedback/${invite.inviteToken}`, expiresAt: invite.expiresAt });
  } catch (error) {
    const code = error instanceof Error ? error.message : "TRIP_FEEDBACK_INVITE_FAILED";
    if (code === "TRIP_FEEDBACK_OWNER_REQUIRED") return NextResponse.json({ error: "Only the saved-trip owner can create a feedback invitation." }, { status: 403 });
    console.error("Tripfinder could not create a feedback invitation.", code);
    return NextResponse.json({ error: "Tripfinder could not create a feedback invitation right now." }, { status: 503 });
  }
}
