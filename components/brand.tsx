import Link from "next/link";
import { Compass } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="Tripfinder home">
      <span className="brand-mark"><Compass size={20} strokeWidth={1.8} /></span>
      <span className="brand-name">tripfinder<span className="brand-period">.</span></span>
    </Link>
  );
}
