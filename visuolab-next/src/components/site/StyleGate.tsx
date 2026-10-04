"use client";

import { usePathname } from "next/navigation";
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
 * Renders all six original stylesheets in their original order and applies only the ones the current route
 * originally loaded. Sheets that are off use media="not all": they are still downloaded, so switching pages
 * during client-side navigation is instant, but they do not take part in the cascade.
 */
export default function StyleGate() {
  const on = sheetsForPath(usePathname());
  return (
    <>
      {SHEETS.map((s) => (
        <link key={s} rel="stylesheet" href={URLS[s]} media={on.has(s) ? "all" : "not all"} data-sheet={s} />
      ))}
    </>
  );
}
