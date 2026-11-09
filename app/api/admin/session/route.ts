import { NextRequest, NextResponse } from "next/server";
import { adminCookieOptions, ADMIN_SESSION_COOKIE, createAdminSession, getRequestClientAddress, hasValidAdminSession, isAdminSecretConfigured, verifyAdminPassword } from "@/lib/admin/auth";
import { clearAdminLoginFailures, hashClientAddress, isAdminLoginLocked, recordAdminLoginFailure } from "@/lib/db/travel-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminSecretConfigured()) {
    return NextResponse.json({ authenticated: false, configured: false, error: "ADMIN_DASHBOARD_SECRET is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ authenticated: hasValidAdminSession(request), configured: true }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!isAdminSecretConfigured()) {
    return NextResponse.json({ error: "Set ADMIN_DASHBOARD_SECRET in Vercel before using the admin dashboard." }, { status: 503 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Enter the admin password." }, { status: 400 }); }
  const password = body && typeof body === "object" && "password" in body && typeof body.password === "string" ? body.password : "";
  if (!password || password.length > 512) return NextResponse.json({ error: "Enter the admin password." }, { status: 400 });

  const clientKey = hashClientAddress(getRequestClientAddress(request));
  try {
    if (await isAdminLoginLocked(clientKey)) {
      return NextResponse.json({ error: "Too many failed attempts. Try again in 15 minutes." }, { status: 429 });
    }
    if (!verifyAdminPassword(password)) {
      await recordAdminLoginFailure(clientKey);
      return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
    }
    await clearAdminLoginFailures(clientKey);
  } catch {
    return NextResponse.json({ error: "Admin authentication is temporarily unavailable because the database could not be reached." }, { status: 503 });
  }

  const session = createAdminSession();
  if (!session) return NextResponse.json({ error: "Admin authentication is not configured." }, { status: 503 });
  const response = NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_SESSION_COOKIE, session.value, adminCookieOptions(session.maxAge));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", adminCookieOptions(0));
  return response;
}
