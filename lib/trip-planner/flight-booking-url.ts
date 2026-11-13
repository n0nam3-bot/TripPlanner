/** Accept only Google's opaque flight-booking redirect endpoint over HTTPS. */
export function safeGoogleBookingUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "www.google.com" || host === "google.com") && url.pathname === "/travel/clk/f"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}
