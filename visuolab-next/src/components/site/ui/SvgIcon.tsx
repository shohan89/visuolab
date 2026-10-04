import { createElement } from "react";
import type { IconSeed } from "@/content/types";

const ATTR: Record<string, string> = { "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap", "stroke-linejoin": "strokeLinejoin", "fill-rule": "fillRule", "clip-rule": "clipRule" };

/** Renders an inline SVG described as data (viewBox + shape nodes). Used for per-item icons in seed content. */
export default function SvgIcon({ icon }: { icon: IconSeed }) {
  return (
    <svg viewBox={icon.viewBox}>
      {icon.nodes.map((n, i) => createElement(n.t, { key: i, ...Object.fromEntries(Object.entries(n.a).map(([k, v]) => [ATTR[k] ?? k, v])) }))}
    </svg>
  );
}
