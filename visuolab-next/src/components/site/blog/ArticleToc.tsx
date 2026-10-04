"use client";

import { useEffect, useState } from "react";
import { subscribeScroll } from "@/lib/motion/scroll";

export type TocItem = { id: string; text: string };

/**
 * "On this page" rail (sticky, left of the article). The links come from the article's headings; the link for the
 * heading the reader is currently under gets .on (same test as the original script: heading top <= scrollY + nav height + 40).
 */
export default function ArticleToc({ items }: { items: TocItem[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    return subscribeScroll(() => {
      const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h") || "92");
      const top = window.scrollY + navH + 40;
      let now = 0;
      items.forEach((it, i) => {
        const h = document.getElementById(it.id);
        if (h && h.offsetTop <= top) now = i;
      });
      setCurrent(now);
    });
  }, [items]);

  return (
    <aside className="toc" aria-label="On this page">
      <p className="rail-label">On this page</p>
      <nav className="toc-list">
        {items.map((it, i) => (
          <a href={`#${it.id}`} className={i === current ? "on" : undefined} key={it.id}>{it.text}</a>
        ))}
      </nav>
    </aside>
  );
}
