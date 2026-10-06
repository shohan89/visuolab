"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/** About hero 3D host (.about-3d). Three.js is imported lazily so it only ships on /about. */
export default function AboutScene({ style }: { style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    // Three.js (about 120 KB compressed) and the scene set-up are heavy work. They start once the page has loaded and the browser is idle,
    // so the text, pictures and scroll are ready first; the canvas then fades in as before. Reduced-motion visitors still get their single frame.
    const start = () => {
      if (cancelled) return;
      import("@/lib/motion/scene").then(({ initScene }) => {
        if (!cancelled) cleanup = initScene(host);
      });
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void });
    let handle = 0;
    const schedule = () => { handle = idle.requestIdleCallback ? idle.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 300); };
    if (document.readyState === "complete") schedule(); else window.addEventListener("load", schedule, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", schedule);
      if (idle.cancelIdleCallback && handle) idle.cancelIdleCallback(handle); else window.clearTimeout(handle);
      cleanup?.();
    };
  }, []);
  return <div ref={ref} className="about-3d reveal" style={style} aria-hidden="true"></div>;
}
