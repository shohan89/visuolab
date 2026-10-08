/*
 * The controlled part of the page CMS: which templates exist, which sections each template has and in what order, which schema checks each
 * type of section, and where in a section's content media files and case studies are referenced.
 *
 * Editors fill the content of sections that exist. They cannot add a section, remove one, reorder them or change its type: that is what keeps
 * the design intact. A new design section is a code change (a schema here, a component, a row in `page_section_types`).
 */
import type { z } from "zod";
import * as S from "./sections/index.ts";
import type { PageTemplate, SectionContentMap, SectionRef, SectionType } from "./types.ts";

/** Paths use `*` for "every item of this list": `items.*.avatarId`. */
type SectionTypeDef<T extends SectionType> = {
  label: string;
  /** Bumped when the shape of the content changes; also in the `page_section_types` table. */
  version: number;
  schema: z.ZodType<SectionContentMap[T]>;
  /** Where the content holds the id of a media file, and what kind of file it must be. */
  media: readonly MediaPath[];
  /** Where the content holds the id of a case study. */
  cases: readonly string[];
};

/** A place in the content that holds a media id (`MediaReference.id`): the library row must be of this kind (and type). */
export type MediaPath = { path: string; kind: "image" | "video"; mime?: string };
const image = (path: string): MediaPath => ({ path, kind: "image" });

const def = <T extends SectionType>(label: string, schema: z.ZodType<SectionContentMap[T]>, refs: { media?: readonly MediaPath[]; cases?: readonly string[] } = {}): SectionTypeDef<T> => ({
  label, version: 1, schema, media: refs.media ?? [], cases: refs.cases ?? [],
});

export const SECTION_TYPES: { [T in SectionType]: SectionTypeDef<T> } = {
  home_hero: def("Home hero", S.homeHeroSchema),
  logo_marquee: def("Trusted-by logos band", S.logoMarqueeSchema),
  showreel: def("Showreel video", S.showreelSchema, { media: [{ path: "video.id", kind: "video", mime: "video/mp4" }, image("poster.id")] }),
  why_stats: def("Why us list and numbers", S.whyStatsSchema),
  services_columns: def("Services columns and book bar", S.servicesColumnsSchema, { media: [image("bookBar.avatar.id")] }),
  case_showcase: def("Case study showcase", S.caseShowcaseSchema, { cases: ["caseIds.*"] }),
  industries_grid: def("Industries", S.industriesGridSchema),
  process_steps: def("Process steps", S.processStepsSchema),
  reviews_carousel: def("Reviews carousel", S.reviewsCarouselSchema),
  about_hero: def("About hero", S.aboutHeroSchema),
  case_mosaic: def("Case study mosaic", S.caseMosaicSchema, { cases: ["caseIds.*"] }),
  principles_list: def("Principles", S.principlesListSchema),
  mission_vision: def("Mission and vision", S.missionVisionSchema),
  timeline: def("Story timeline", S.timelineSchema),
  manifesto: def("Manifesto", S.manifestoSchema),
  office_clocks: def("Offices and clocks", S.officeClocksSchema),
  faq_accordion: def("FAQ", S.faqAccordionSchema),
  open_roles: def("Open roles", S.openRolesSchema),
  works_hero: def("Works hero and filters", S.worksHeroSchema),
  works_grid: def("Works grid", S.worksGridSchema),
  blog_hero: def("Blog hero and filters", S.blogHeroSchema),
  blog_featured: def("Blog featured article", S.blogFeaturedSchema),
  blog_grid: def("Blog article grid", S.blogGridSchema),
  contact_intro: def("Contact intro", S.contactIntroSchema, { media: [image("who.avatar.id")] }),
  contact_form: def("Contact form", S.contactFormSchema),
  cta_band: def("Closing call to action", S.ctaBandSchema, { media: [image("avatars.*.id"), image("floaters.*.id")] }),
  reviews_collection: def("Reviews", S.reviewsCollectionSchema, { media: [image("items.*.avatar.id")] }),
  logos_collection: def("Trusted-by logos", S.logosCollectionSchema),
  site_rating: def("Review rating line", S.siteRatingSchema),
  footer_extras: def("Footer extras", S.footerExtrasSchema),
  case_study_chrome: def("Case study page labels", S.caseStudyChromeSchema),
  article_chrome: def("Article page labels", S.articleChromeSchema),
};

export const SECTION_TYPE_NAMES = Object.keys(SECTION_TYPES) as SectionType[];

export type SectionSlot = {
  /** The section's key on its page; with the page it identifies the row. */
  key: string;
  type: SectionType;
  /** What the admin calls the section ("Trusted by", "Where we work"). */
  name: string;
  /** May an editor switch the section off? True for every block drawn on a public page; false for copy that is not a block of its own (labels, shared lists). */
  canDisable: boolean;
  /** The `id` other links point at (never editable). */
  anchor?: string;
  /** Set for important sections: what visitors lose when it is switched off. The editor must confirm before switching it off (the server insists). */
  confirm?: string;
  /** Why a section cannot be switched off (shown in the admin). */
  lock?: string;
};

export type TemplateDef = {
  label: string;
  /** The public address, or null for templates that hold copy used elsewhere. */
  route: string | null;
  /** Has its own title, description, share picture and indexing (pages with a route). */
  hasSeo: boolean;
  /** The sections, in the order they are drawn. */
  sections: readonly SectionSlot[];
};

const slot = (key: string, type: SectionType, name: string, canDisable = false, anchor?: string, note?: { confirm?: string; lock?: string }): SectionSlot => ({ key, type, name, canDisable, ...(anchor ? { anchor } : {}), ...(note?.confirm ? { confirm: note.confirm } : {}), ...(note?.lock ? { lock: note.lock } : {}) });
const HERO = "Visitors lose the page headline and its introduction (the page's <h1>, which search engines and screen readers rely on).";
const LABELS = "These are the words around the other blocks of the page, not a block of their own, so there is nothing to hide.";
const POOL = "A list that other sections draw from, not a block of its own: switch off the sections that show it instead.";

export const TEMPLATES: Record<PageTemplate, TemplateDef> = {
  home: {
    label: "Home", route: "/", hasSeo: true,
    sections: [
      slot("hero", "home_hero", "Hero", true, "top", { confirm: HERO }),
      slot("logos", "logo_marquee", "Trusted by", true),
      slot("showreel", "showreel", "Showreel", true, "showreel"),
      slot("why", "why_stats", "Why us and numbers", true, "why"),
      slot("services", "services_columns", "Services", true, "services", { confirm: "Visitors lose the Services block, including the book-a-call bar. Menu and footer links to #services will go nowhere." }),
      slot("work", "case_showcase", "Our cases", true, "work", { confirm: "Visitors lose the case study panels on Home. Links to #work will go nowhere." }),
      slot("industries", "industries_grid", "Industries", true, "industries"),
      slot("process", "process_steps", "How we work", true, "process"),
      slot("reviews", "reviews_carousel", "Reviews", true, "reviews"),
    ],
  },
  about: {
    label: "About", route: "/about", hasSeo: true,
    sections: [
      slot("hero", "about_hero", "Hero", true, "top", { confirm: HERO }),
      slot("mosaic", "case_mosaic", "Projects strip", true),
      slot("principles", "principles_list", "Principles", true, "principles"),
      slot("mission", "mission_vision", "Mission and vision", true),
      slot("story", "timeline", "Our story", true, "story"),
      slot("manifesto", "manifesto", "Manifesto", true, "manifesto"),
      slot("places", "office_clocks", "Where we work", true, "places"),
      slot("faq", "faq_accordion", "FAQ", true, "faq"),
      slot("careers", "open_roles", "Careers", true, "careers", { confirm: "Visitors lose the open roles. The header and footer link to /about#careers, so those links will point at nothing." }),
    ],
  },
  works: {
    label: "Works", route: "/works", hasSeo: true,
    sections: [slot("hero", "works_hero", "Hero and filters", true, "top", { confirm: HERO + " The discipline filter chips go with it." }), slot("grid", "works_grid", "Case study grid", true, "works-grid", { confirm: "Visitors lose the grid of case studies: the page would show no work." }), slot("reviews", "reviews_carousel", "Reviews", true, "reviews")],
  },
  blog: {
    label: "Blog", route: "/blog", hasSeo: true,
    sections: [slot("hero", "blog_hero", "Hero and filters", true, "top", { confirm: HERO + " The topic filter chips go with it." }), slot("featured", "blog_featured", "Featured article", true), slot("grid", "blog_grid", "Article grid", true, "posts-grid", { confirm: "Visitors lose the list of articles: the page would show none." })],
  },
  contact: {
    label: "Contact", route: "/contact", hasSeo: true,
    sections: [slot("intro", "contact_intro", "Intro", true, "top", { confirm: HERO + " The direct e-mail links and facts go with it." }), slot("form", "contact_form", "Form", true, "form", { confirm: "Visitors can no longer send a message from the website. Links to #form will go nowhere." })],
  },
  // copy that is the same on every service page; each service's own content stays on the service (table `services`)
  service_detail: {
    label: "Service page copy", route: null, hasSeo: false,
    sections: [slot("logos", "logo_marquee", "Trusted by", true), slot("reviews", "reviews_carousel", "Reviews", true, "rev-title")],
  },
  case_study_detail: { label: "Case study page copy", route: null, hasSeo: false, sections: [slot("chrome", "case_study_chrome", "Page labels", false, undefined, { lock: LABELS })] },
  article_detail: { label: "Article page copy", route: null, hasSeo: false, sections: [slot("chrome", "article_chrome", "Page labels", false, undefined, { lock: LABELS })] },
  // copy used on several pages
  shared: {
    label: "Shared across pages", route: null, hasSeo: false,
    sections: [
      slot("cta", "cta_band", "Closing call to action", true, "contact", { confirm: "The closing call-to-action band disappears from every page that shows it. Menu and button links to #contact on those pages will go nowhere." }),
      slot("reviews", "reviews_collection", "Reviews", false, undefined, { lock: POOL }),
      slot("logos", "logos_collection", "Trusted-by names", false, undefined, { lock: POOL }),
      slot("rating", "site_rating", "Rating line", false, undefined, { lock: POOL }),
      slot("footer", "footer_extras", "Footer extras", false, undefined, { lock: "The footer carries the legal links and the copyright line on every page, so it always stays." }),
    ],
  },
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as PageTemplate[];

/** The address segment of a template in the admin (`service_detail` is `service-detail`), and back. */
export const templateSlug = (t: PageTemplate): string => t.replace(/_/g, "-");
export const templateFromSlug = (slug: string): PageTemplate | undefined => TEMPLATE_NAMES.find((t) => templateSlug(t) === slug);
/** The page named by an admin address: its slug (`home`) or its id (`page_home`). */
export const templateFromParam = (param: string): PageTemplate | undefined => templateFromSlug(param) ?? TEMPLATE_NAMES.find((t) => `page_${t}` === param);

/** The slot a (template, key) pair names, or undefined. */
export const slotOf = (template: PageTemplate, key: string): SectionSlot | undefined => TEMPLATES[template]?.sections.find((s) => s.key === key);

/* ---- validation ------------------------------------------------------------------------------------------------- */

export type SectionErrors = Record<string, string>;
export type SectionCheck<T extends SectionType = SectionType> = { ok: true; type: T; content: SectionContentMap[T]; refs: SectionRef[] } | { ok: false; errors: SectionErrors };

/** Errors by the path of the field ("items.2.title"), one message each; "form" for a problem with the section as a whole. */
function toErrors(error: z.ZodError): SectionErrors {
  const out: SectionErrors = {};
  for (const i of error.issues) {
    const key = i.path.join(".") || "form";
    if (!(key in out)) out[key] = i.message;
  }
  return out;
}

/** Every value at a path pattern: `items.*.avatarId` visits each item of `items`. */
function valuesAt(value: unknown, pattern: string): { path: string; value: unknown }[] {
  let found: { path: string; value: unknown }[] = [{ path: "", value }];
  for (const part of pattern.split(".")) {
    const next: { path: string; value: unknown }[] = [];
    for (const f of found) {
      const join = (k: string | number) => (f.path ? `${f.path}.${k}` : String(k));
      if (part === "*") {
        if (Array.isArray(f.value)) f.value.forEach((v, i) => next.push({ path: join(i), value: v }));
      } else if (f.value && typeof f.value === "object" && part in (f.value as object)) {
        next.push({ path: join(part), value: (f.value as Record<string, unknown>)[part] });
      }
    }
    found = next;
  }
  return found;
}

/** The media files and case studies a section's content points at (empty ids are skipped). */
export function refsOf<T extends SectionType>(type: T, content: SectionContentMap[T]): SectionRef[] {
  const d = SECTION_TYPES[type];
  const refs: SectionRef[] = [];
  for (const m of d.media) for (const v of valuesAt(content, m.path)) if (typeof v.value === "string" && v.value) refs.push({ path: v.path, kind: "media", id: v.value, mediaKind: m.kind, ...(m.mime ? { mime: m.mime } : {}) });
  for (const p of d.cases) for (const v of valuesAt(content, p)) if (typeof v.value === "string" && v.value) refs.push({ path: v.path, kind: "case_study", id: v.value });
  return refs;
}

/**
 * The one entry point for checking a section: checks that the section exists in the template, then checks the content against the schema of its
 * type (unknown keys are errors), and returns the cleaned content and the references to write to `page_section_refs`.
 * It does not look at the database: that the referenced media and case studies exist is checked by the caller (and by the foreign keys).
 */
export function checkSection(template: PageTemplate, key: string, content: unknown): SectionCheck {
  const s = slotOf(template, key);
  if (!s) return { ok: false, errors: { form: `The ${template} page has no section "${key}".` } };
  const parsed = SECTION_TYPES[s.type].schema.safeParse(content);
  if (!parsed.success) return { ok: false, errors: toErrors(parsed.error) };
  return { ok: true, type: s.type, content: parsed.data, refs: refsOf(s.type, parsed.data) };
}
