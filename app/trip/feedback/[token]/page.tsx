import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { TripFeedbackForm } from "@/components/trips/trip-feedback-form";
import { getTripFeedbackInvite } from "@/lib/db/saved-trips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Traveler feedback · Tripfinder",
  description: "Send a suggestion to the owner of a shared Tripfinder itinerary.",
  robots: { index: false, follow: false },
};

export default async function TripFeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getTripFeedbackInvite(token);
  if (!invite) return notFound();
  return <main className="trip-feedback-page"><SiteHeader/><div className="trip-feedback-shell shell">
    <TripFeedbackForm inviteToken={token} tripTitle={invite.title} destination={invite.destination} expiresAt={invite.expiresAt}/>
  </div></main>;
}
