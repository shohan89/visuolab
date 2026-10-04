"use client";

import { Children, cloneElement, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { prefersReducedMotion, subscribeScroll } from "@/lib/motion/scroll";

/** Wraps every word of the text in <span class="w">, keeping inline elements (<em>) and spacing intact. */
function splitWords(node: ReactNode, path: string): ReactNode {
  if (typeof node === "string") {
    return node.split(/(\s+)/).map((part, i) => {
      if (!part) return null;
      if (/^\s+$/.test(part)) return part;
      return <span className="w" key={`${path}.${i}`}>{part}</span>;
    });
  }
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    return cloneElement(el, { key: path }, ...Children.toArray(el.props.children).map((c, i) => splitWords(c, `${path}.${i}`)));
  }
  return node;
}

/** Manifesto: words brighten one by one as the paragraph scrolls (--o per word). Same maths as js/main.js. */
export default function ScrollWords({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const mani = ref.current;
    if (!mani) return;
    const reduce = prefersReducedMotion();
    const words = Array.from(mani.querySelectorAll<HTMLElement>(".w"));
    const update = () => {
      if (!words.length || reduce) return;
      const r = mani.getBoundingClientRect(), vh = window.innerHeight;
      let p = (vh * 0.85 - r.top) / (r.height + vh * 0.45); // 0: top enters at 85% of the viewport -> 1: bottom passes 40%
      p = Math.max(0, Math.min(1, p));
      const n = words.length, lit = p * n;
      for (let i = 0; i < n; i++) {
        const o = Math.max(0, Math.min(1, lit - i + 1)); // two-word ramp
        words[i]!.style.setProperty("--o", (0.2 + o * 0.8).toFixed(3));
      }
    };
    return subscribeScroll(update);
  }, []);

  return (
    <p className="manifesto-text" data-scroll-words ref={ref}>
      {Children.toArray(children).map((c, i) => splitWords(c, `w${i}`))}
    </p>
  );
}
