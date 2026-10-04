/*
 * Which of the six original stylesheets each page loads.
 *
 * The static site loaded a different subset per page (home: base+hero+sections, About: base+sections+about,
 * blog/contact/services: base+sections+work+pages, ...). The files override each other and several class names are
 * reused with different meanings (.out, .about-lead, .copy, ...), so loading all six everywhere changes how pages
 * render. Instead every sheet stays in the page, in the original order, and only the sheets a route originally
 * loaded are switched on (see components/site/StyleGate.tsx).
 */
export const SHEETS = ["base", "hero", "sections", "work", "pages", "about"] as const;
export type Sheet = (typeof SHEETS)[number];

const HOME: Sheet[] = ["base", "hero", "sections"];
const ABOUT: Sheet[] = ["base", "sections", "about"];
const WORKS: Sheet[] = ["base", "sections", "work"];
const PAGES: Sheet[] = ["base", "sections", "work", "pages"];

export function sheetsForPath(pathname: string): ReadonlySet<Sheet> {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/") return new Set(HOME);
  if (p === "/about") return new Set(ABOUT);
  if (p === "/works" || p.startsWith("/works/")) return new Set(WORKS); // listing and case studies
  return new Set(PAGES); // services, blog, contact
}
