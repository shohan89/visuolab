"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { prefersReducedMotion, subscribeScroll } from "@/lib/motion/scroll";

/**
 * Showreel panel (.reel): --p grows it from 74% to 100% as it rises into view (CSS does the scaling),
 * and the video only plays while the panel is on screen. Same maths as js/main.js.
 */
export default function Reel({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reel = ref.current;
    if (!reel) return;
    const reduce = prefersReducedMotion();
    const update = () => {
      if (reduce) return;
      const r = reel.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the panel's top is at the fold, 1 once it reaches ~18% from the top
      let p = (vh - r.top) / (vh * 0.82);
      p = Math.max(0, Math.min(1, p));
      p = p * p * (3 - 2 * p);
      reel.style.setProperty("--p", p.toFixed(3));
    };
    const unsub = subscribeScroll(update);

    // only play a real video while the panel is on screen
    const video = reel.querySelector<HTMLVideoElement>(".reel-video");
    let io: IntersectionObserver | null = null;
    if (video && !video.hidden && "IntersectionObserver" in window) {
      io = new IntersectionObserver((en) => {
        if (en[0]?.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }, { threshold: 0.2 });
      io.observe(reel);
    }
    return () => { unsub(); io?.disconnect(); };
  }, []);

  return <div ref={ref} className="reel" style={style}>{children}</div>;
}
