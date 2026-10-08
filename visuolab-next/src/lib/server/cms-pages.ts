import "server-only";
import { cache } from "react";
import { PAGE_DEFAULTS } from "@/lib/cms/defaults";
import { loadPage, type LoadedPage } from "@/lib/cms/store";
import { TEMPLATES } from "@/lib/cms/registry";
import type { PageContent, PageTemplate } from "@/lib/cms/types";
import { getCaseCardsByIds, getCaseTilesByIds, mediaUrls } from "./cms";
import { getDb } from "./db";
import type { MediaReference } from "@/lib/cms/types";
import type { LogoSeed } from "@/content/logos";
import type { ReviewSeed } from "@/content/reviews";
import type { CaseCardSeed } from "@/content/types";
import type { SharedContent } from "@/components/site/SharedContentProvider";

/*
 * The server-side page loader: D1 -> checked section content -> the existing components (as props).
 * Public pages call getPage("home") and hand each section's content to the component that draws it. If the database cannot be read the page is
 * drawn from the built-in defaults (the same copy), so the site never goes blank.
 */

const load = cache(async (template: PageTemplate): Promise<LoadedPage<PageTemplate>> => {
  try {
    const page = await loadPage(getDb(), template);
    if (page.issues.length) console.error("page CMS:", page.issues.join(" | "));
    return page;
  } catch (e) {
    console.error(`page CMS: ${template} unavailable, using the built-in content`, e instanceof Error ? e.message : e);
    const enabled = Object.fromEntries(TEMPLATES[template].sections.map((s) => [s.key, true]));
    return { page: null, content: PAGE_DEFAULTS[template], enabled, issues: ["database unavailable"] } as LoadedPage<PageTemplate>;
  }
});

/** One page's sections: checked content, which sections are switched on, and the page row (null before seeding). */
export const getPage = <P extends PageTemplate>(template: P) => load(template) as Promise<LoadedPage<P>>;

/** media id -> public URL, for the pictures and videos sections refer to. One query per request. */
export const getMediaIndex = cache(() => mediaUrls(getDb()));

/** The address of a media reference ("" if the file is gone). */
export const mediaSrc = (ref: MediaReference | null, media: Record<string, string>): string => (ref ? (media[ref.id] ?? "") : "");

/** The showcase cards of the chosen case studies, in order (published ones only). */
export const getCaseCards = async (ids: readonly string[]): Promise<CaseCardSeed[]> => getCaseCardsByIds(getDb(), ids, await getMediaIndex());

/** The shared reviews, as the carousels draw them. */
export async function getReviewSeeds(): Promise<ReviewSeed[]> {
  const [shared, media] = await Promise.all([getPage("shared"), getMediaIndex()]);
  return (shared.content as PageContent<"shared">).reviews.items.map((r) => ({
    avatar: mediaSrc(r.avatar, media), company: r.company, ...(r.dot ? { dot: r.dot } : {}), quote: r.quote, name: r.name, role: r.role, city: r.city,
  }));
}

/** The shared "Trusted by" names, as the marquee draws them. */
export async function getLogoSeeds(): Promise<LogoSeed[]> {
  const shared = await getPage("shared");
  return shared.content.logos.items.map((l) => ({ text: l.text, ...(l.style !== "plain" ? { cls: l.style } : {}), ...(l.dot ? { dot: true } : {}) }));
}

/** The shared rating line ("5.0", "60+ reviews on Clutch"). */
export async function getRating(): Promise<{ score: string; text: string }> {
  return (await getPage("shared")).content.rating;
}

/** The projects in the About strip: name, kind, picture and link of each chosen case study (published ones, in order). */
export const getCaseTiles = async (ids: readonly string[]) => getCaseTilesByIds(getDb(), ids, await getMediaIndex());

/** The shared copy every page draws in its closing band and footer, with the pictures as addresses. */
export async function getSharedContent(): Promise<SharedContent> {
  const [{ content, enabled }, media] = await Promise.all([getPage("shared"), getMediaIndex()]);
  const pic = (r: MediaReference) => ({ src: mediaSrc(r, media), alt: r.alt });
  const c = content.cta;
  return { ctaEnabled: enabled.cta, cta: { title: c.title, lead: c.lead, primary: c.primary, avatars: c.avatars.map(pic), floaters: c.floaters.map(pic) }, footer: content.footer };
}

/** Where the built-in pictures live (`media_people-jordan` is /assets/people/jordan.webp): used only when the database cannot be read. */
const builtInPic = (ref: MediaReference) => {
  const m = /^media_(cases|people|covers)-(.+)$/.exec(ref.id);
  return { src: m ? `/assets/${m[1]}/${m[2]}.webp` : `/assets/${ref.id.replace(/^media_/, "")}.webp`, alt: ref.alt };
};

/** The shared copy the site was built with: drawn if the database cannot be read. */
export function builtInSharedContent(): SharedContent {
  const d = PAGE_DEFAULTS.shared;
  return { ctaEnabled: true, cta: { title: d.cta.title, lead: d.cta.lead, primary: d.cta.primary, avatars: d.cta.avatars.map(builtInPic), floaters: d.cta.floaters.map(builtInPic) }, footer: d.footer };
}
