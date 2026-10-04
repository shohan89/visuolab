"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { prefersReducedMotion, subscribeScroll } from "@/lib/motion/scroll";

/**
 * Case stack (#cases): dims + blurs the panel underneath as the next one slides up.
 * Sets --p (0..1) on each .case-panel, desktop only (min-width 901px). Same maths as js/main.js.
 */
export default function CaseStack({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const reduce = prefersReducedMotion();
    const stackOn = window.matchMedia("(min-width: 901px)");
    const update = () => {
      if (!stackOn.matches || reduce) return;
      const panels = Array.from(root.querySelectorAll<HTMLElement>(".case-panel"));
      const navH = document.getElementById("nav")?.offsetHeight ?? 92;
      const vh = window.innerHeight;
      for (let i = 0; i < panels.length - 1; i++) {
        const next = panels[i + 1]!.getBoundingClientRect();
        // 0 while the next panel is below the fold, 1 once it has covered this one
        let p = 1 - (next.top - navH) / (vh - navH);
        p = Math.max(0, Math.min(1, p));
        panels[i]!.style.setProperty("--p", p.toFixed(3));
      }
    };
    return subscribeScroll(update);
  }, []);

  return <div ref={ref} className="cases" id="cases">{children}</div>;
}
