/** Inline markup used in seed text: plain text with <em>…</em> only. Rendered by components/site/ui/Rich. */
export type RichText = string;

export type ImageSeed = { src: string; alt: string; width?: number; height?: number; priority?: boolean; lazy?: boolean };
export type IconSeed = { viewBox: string; nodes: { t: string; a: Record<string, string> }[] };
export type CtaSeed = { label: string; href: string };

export type CaseCardSeed = {
  href: string;
  tags: string[];
  title: RichText;
  image: ImageSeed;
  /** Clutch-style quote variant */
  quote?: { source: string; text: string; avatar: string; name: string; role: string };
  /** "Results" variant (no quote) */
  results?: { value: RichText; text: string }[];
};

export type ServiceSeed = {
  slug: string;
  meta: { title: string; description: string };
  hero: { title: RichText; lead: string; cta: CtaSeed; shots: ImageSeed[] };
  problems: { hidden: boolean; label: string; title: RichText; items: { title: string; text: string; proofValue: RichText; proofLabel: string }[] };
  overview: { label: string; title: RichText; blocks: { title: string; text: string }[] };
  outcomes: { label: string; title: RichText; items: { value: RichText; text: string }[] };
  band: { hidden: boolean; text: RichText; cta: CtaSeed };
  included: { label: string; title: RichText; items: { icon: IconSeed; title: string; text: string }[] };
  process: { label: string; title: RichText; steps: { title: string; duration: string; text: string }[] };
  cases: { label: string; title: RichText; items: CaseCardSeed[] };
};

/* ---- Case studies (/works and /works/[slug]) ---------------------------------------------------------------- */

export type CaseFigure = { src: string; alt: string; caption: string; /** CSS object-position, e.g. "20% 30%" */ position: string | null };

export type CaseStudy = {
  slug: string;
  meta: { title: string; description: string };
  /** The card on /works */
  card: {
    name: string;
    year: string;
    type: string;
    /** Tags shown on the card */
    tags: string[];
    /** Filter keys the card answers to (brand, product, web, packaging, motion) */
    filters: string[];
    image: { src: string; alt: string };
  };
  hero: {
    breadcrumb: string;
    title: RichText;
    /** Client, Industry, Services, Year, Timeline */
    facts: { term: string; value: string }[];
  };
  cover: { src: string; alt: string };
  about: { label: string; lead: RichText; stats: { value: RichText; label: string }[] };
  galleryA: CaseFigure[];
  process: {
    label: string;
    title: RichText;
    steps: { title: string; duration: string; text: string; deliverables: { title: string; detail: string }[] }[];
  };
  galleryB: CaseFigure[];
  challenges: { label: string; title: RichText; items: { title: string; text: string }[] };
  wide: CaseFigure;
  results: { label: string; title: RichText; items: { /** Headline numbers get the "is-num" style */ metric: boolean; text: RichText }[] };
  more: { label: string; title: RichText; items: { slug: string; name: string; kind: string; image: string }[] };
};

/* ---- Blog (/blog and /blog/[slug]) ---------------------------------------------------------------------------- */

/**
 * One block of an article. Text in "paragraph", "list", "quote" and the lead may use **bold**, *italic*, `code` and [links](…)
 * (src/lib/content/inline.ts); it is never treated as HTML.
 */
export type BlogBlock =
  | { type: "heading"; text: string } // level-2 heading; gets an id and an entry in the table of contents
  | { type: "subheading"; text: string } // level-3 heading
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "quote"; text: string; cite: string }
  | { type: "image"; src: string; alt: string; caption: string }
  | { type: "divider" };

export type BlogPost = {
  slug: string;
  meta: { title: string; description: string };
  /** One of the blog topics (Brand, Product, Web, Motion, Process) */
  category: string;
  title: string;
  /** ISO date, YYYY-MM-DD */
  publishedAt: string;
  readMinutes: number;
  author: { name: string; avatar: string };
  cover: { src: string; alt: string };
  /** Teaser shown on the featured card (only the featured article has one) */
  excerpt?: string;
  /** Opening paragraph, set larger than the body */
  lead: string;
  body: BlogBlock[];
  /** Closing line with a link, after the rule */
  outro: { before: string; linkText: string; href: string; after: string };
  /** Slugs of the two articles under "More from the studio" */
  related: string[];
  /* Added by the CMS. Optional, so the typed seed content still satisfies this type. */
  featured?: boolean;
  tags?: string[];
  /** Absolute https address search engines should treat as the original, when it is not this page */
  canonicalUrl?: string;
  /** Picture for link previews; the cover is used when there is none */
  ogImage?: { src: string };
  /** Full ISO timestamps */
  publishedAtIso?: string;
  updatedAtIso?: string;
};
