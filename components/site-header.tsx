import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner shell">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/#discover">Discover</Link>
          <Link href="/my-trips">My trips</Link>
        </nav>
        <div className="header-actions">
          <Link href="/my-trips" className="header-my-trips-mobile">My trips</Link>
          <Link href="/#plan" className="header-cta">Plan a trip <ArrowUpRight size={15} /></Link>
        </div>
      </div>
    </header>
  );
}
