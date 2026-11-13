import { createHash, randomBytes } from "node:crypto";

/** Long-lived, random browser identity. The raw value is held only in an HttpOnly cookie. */
export const ANONYMOUS_VISITOR_COOKIE = "tf_visitor";
export const ANONYMOUS_VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{40,48}$/;

export function isValidAnonymousVisitorId(value: unknown): value is string {
  return typeof value === "string" && VISITOR_ID_PATTERN.test(value);
}

export function createAnonymousVisitorId(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAnonymousVisitorId(value: string): string {
  if (!isValidAnonymousVisitorId(value)) throw new Error("ANONYMOUS_VISITOR_ID_INVALID");
  return createHash("sha256").update("tripfinder-anonymous-visitor-quota-v1:").update(value).digest("hex");
}
