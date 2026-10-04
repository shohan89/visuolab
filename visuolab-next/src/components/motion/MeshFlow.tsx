"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { initMesh } from "@/lib/motion/mesh";

/** Hero mesh gradient host (.mesh). The CSS gradient spans are children; the WebGL canvas is appended once GL is live. */
export default function MeshFlow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasGl, setHasGl] = useState(false);
  useEffect(() => (ref.current ? initMesh(ref.current, setHasGl) : undefined), []);
  return (
    <div ref={ref} className={hasGl ? "mesh has-gl" : "mesh"} aria-hidden="true">
      {children}
    </div>
  );
}
