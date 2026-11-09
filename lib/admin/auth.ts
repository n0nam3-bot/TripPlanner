import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const ADMIN_SESSION_COOKIE = "tripfinder_admin_session";
const SESSION_SECONDS = 12 * 60 * 60;

function secret(): string | null {
  const value = process.env.ADMIN_DASHBOARD_SECRET;
  return value && value.length >= 32 ? value : null;
}

function safeEqual(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function signature(expiresAt: string, key: string): string {
  return createHmac("sha256", key).update(`tripfinder-admin:${expiresAt}`).digest("base64url");
}

export function isAdminSecretConfigured(): boolean {
  return Boolean(secret());
}

export function verifyAdminPassword(candidate: string): boolean {
  const key = secret();
  if (!key || !candidate || candidate.length > 512) return false;
  return safeEqual(candidate, key);
}

export function createAdminSession(): { value: string; maxAge: number } | null {
  const key = secret();
  if (!key) return null;
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  return { value: `${expiresAt}.${signature(expiresAt, key)}`, maxAge: SESSION_SECONDS };
}

export function hasValidAdminSession(request: NextRequest | Request): boolean {
  const key = secret();
  if (!key) return false;
  const cookieHeader = request.headers.get("cookie") ?? "";
  const entry = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
  if (!entry) return false;
  let value = "";
  try { value = decodeURIComponent(entry.slice(ADMIN_SESSION_COOKIE.length + 1)); } catch { return false; }
  const [expiresAt, suppliedSignature, extra] = value.split(".");
  if (!expiresAt || !suppliedSignature || extra || !/^\d{10,12}$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expected = signature(expiresAt, key);
  return safeEqual(suppliedSignature, expected);
}

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export function getRequestClientAddress(request: Request): string {
  return request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}
