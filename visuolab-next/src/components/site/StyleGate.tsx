"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import aboutUrl from "@/styles/about.css?url";
import baseUrl from "@/styles/base.css?url";
import heroUrl from "@/styles/hero.css?url";
import pagesUrl from "@/styles/pages.css?url";
import sectionsUrl from "@/styles/sections.css?url";
import workUrl from "@/styles/work.css?url";
import { SHEETS, sheetsForPath, type Sheet } from "@/lib/css-sets";

const URLS: Record<Sheet, string> = {
  base: baseUrl, hero: heroUrl, sections: sectionsUrl, work: workUrl, pages: pagesUrl, about: aboutUrl,
};

/**
 * Renders the original stylesheets in their original order and applies only the ones the current route originally loaded (the sheets
 * override each other, so the order and the subset must stay as they were).
 *
 * A page ships only the sheets it uses. The others are added once the page is idle (or as soon as the visitor points at a link), still
 * switched off with media="not all", so moving to another page is instant and nothing is re-ordered: React puts each new <link> at its own
 * place among its siblings. This keeps the first load small (home: 3 of 6 sheets) without changing a single style.
 */
export default function StyleGate() {
  const on = sheetsForPath(usePathname());
  const [all, setAll] = useState(false);

  useEffect(() => {
    if (all) return;
    const load = () => setAll(true);
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const start = () => (idle ? idle(load, { timeout: 2500 }) : window.setTimeout(load, 1500));
    // after the load event so the rest never competes with the page's own pictures and scripts; sooner if the visitor reaches for a link
    const ready = document.readyState === "complete";
    if (ready) start(); else window.addEventListener("load", start, { once: true });
    const toLink = (e: Event) => { if ((e.target as Element | null)?.closest?.('a[href^="/"]')) load(); };
    document.addEventListener("pointerover", toLink, { passive: true });
    document.addEventListener("touchstart", toLink, { passive: true });
    return () => { window.removeEventListener("load", start); document.removeEventListener("pointerover", toLink); document.removeEventListener("touchstart", toLink); };
  }, [all]);

  return (
    <>
      {SHEETS.filter((s) => all || on.has(s)).map((s) => (
        <link key={s} rel="stylesheet" href={URLS[s]} media={on.has(s) ? "all" : "not all"} data-sheet={s} />
      ))}
    </>
  );
}
