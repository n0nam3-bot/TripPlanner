import { NextRequest, NextResponse } from "next/server";

/**
 * Keep one public Tripfinder address. Vercel exposes the project's stable
 * production domain in every deployment, including preview deployments.
 * Set SITE_URL in Vercel only if you later want to force a custom primary domain.
 */
export function middleware(request: NextRequest) {
  const configuredSite = process.env.SITE_URL?.trim();
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const canonicalHost = configuredSite
    ? new URL(configuredSite.startsWith("http") ? configuredSite : `https://${configuredSite}`).host
    : productionHost;

  if (!canonicalHost) return NextResponse.next();

  const currentHost = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  const targetHost = canonicalHost.split(":")[0].toLowerCase();
  if (!currentHost || currentHost === targetHost || currentHost === "localhost" || currentHost === "127.0.0.1") {
    return NextResponse.next();
  }

  const target = request.nextUrl.clone();
  target.protocol = "https:";
  target.host = canonicalHost;
  return NextResponse.redirect(target, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
