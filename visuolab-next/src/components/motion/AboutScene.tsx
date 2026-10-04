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
    import("@/lib/motion/scene").then(({ initScene }) => {
      if (!cancelled) cleanup = initScene(host);
    });
    return () => { cancelled = true; cleanup?.(); };
  }, []);
  return <div ref={ref} className="about-3d reveal" style={style} aria-hidden="true"></div>;
}
