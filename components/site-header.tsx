import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/brand";
import { SupportTipLink } from "@/components/support-tip-link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner shell">
        <Brand />
        <div className="header-actions">
          <SupportTipLink compact />
          <Link href="/#plan" className="header-cta">Plan a trip <ArrowUpRight size={15} /></Link>
        </div>
      </div>
    </header>
  );
}
