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
        </nav>
        <div className="header-actions">
          <Link href="/#plan" className="header-cta">Plan a trip <ArrowUpRight size={15} /></Link>
        </div>
      </div>
    </header>
  );
}
