import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { MyTripsClient } from "@/components/trips/my-trips-client";
import { SupportTipLink } from "@/components/support-tip-link";

export const metadata: Metadata = {
  title: "My trips · Tripfinder",
  description: "Open your saved Tripfinder itineraries and manage traveler feedback.",
  robots: { index: false, follow: false },
};

export default function MyTripsPage() {
  return <main className="my-trips-page">
    <SiteHeader />
    <section className="my-trips-shell shell">
      <Link href="/#plan" className="back-link"><ArrowLeft size={15}/> Back to trip planner</Link>
      <header className="my-trips-heading">
        <span className="eyebrow">YOUR TRIPFINDER WORKSPACE</span>
        <h1>Your saved trips</h1>
        <p>Open a trip you saved in this browser, update its itinerary, or invite travelers to share suggestions.</p>
      </header>
      <MyTripsClient />
    </section>
    <footer className="site-footer shell my-trips-footer">
      <div className="footer-top"><div><span className="brand-name footer-brand">tripfinder<span className="brand-period">.</span></span><p>Make room for somewhere new.</p></div><div className="footer-side"><SupportTipLink/><Link href="/#plan" className="text-link dark-link">Plan a trip <ArrowRight size={16}/></Link></div></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Tripfinder</span><span>Independent planning tool · Bookings completed with providers</span></div>
    </footer>
  </main>;
}
