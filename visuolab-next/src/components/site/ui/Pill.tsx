import Link from "@/components/site/ui/Link";
import type { ReactNode } from "react";

/** The double-arrow badge inside every .pill button (the first arrow slides out, the second slides in on hover). */
export function PillBadge() {
  return (
    <span className="badge">
      <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </span>
  );
}

/** Primary call-to-action button (.pill). `className` adds variants such as "dark", "ghost", "nav-cta". */
export default function Pill({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <Link className={className ? `pill ${className}` : "pill"} href={href}>
      {children}
      <PillBadge />
    </Link>
  );
}
