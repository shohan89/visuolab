import type { CSSProperties } from "react";

/** Typed helper for inline styles that carry CSS custom properties (e.g. `--i`). */
export const st = (o: Record<string, string | number>) => o as CSSProperties;
