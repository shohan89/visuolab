"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { initBanner } from "@/lib/motion/hero";

/** The pinned hero stage (.banner.reaching). Content is server-rendered; this only drives its CSS variables. */
export default function HeroBanner({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? initBanner(ref.current) : undefined), []);
  return <div ref={ref} className={className}>{children}</div>;
}
