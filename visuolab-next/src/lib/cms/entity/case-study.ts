/*
 * The sections of a case study page (/works/<slug>), in the order they appear, plus the two cards the case study also feeds (the card on /works and
 * the card on the service pages and Home) and its search settings. Taken from components/site/case/CaseStudyPage.tsx.
 */
import { z } from "zod";
import type { CaseStudyInput } from "../../validation/case-study.ts";
import { DISCIPLINES } from "../../validation/case-study.ts";
import { choice, group, hint, list, mediaRef, optText, pick, rich, text, toggle } from "../primitives.ts";
import { cropPosition, mediaRefRequired } from "./common.ts";
import { section, type EntitySection } from "./types.ts";

type I = CaseStudyInput;
const DISCIPLINE_LABELS = { brand: "Brand", product: "Product", web: "Web", packaging: "Packaging", motion: "Motion" } as const;

const figure = group("Picture", {
  image: mediaRef("Image"),
  caption: optText("Caption", 160),
  position: cropPosition,
});
type Figure = z.infer<typeof figure>;
const toShot = (f: Figure) => ({ media: f.image.id, alt: f.image.alt, caption: f.caption, position: f.position });
const fromShot = (s: I["wide"]): Figure => ({ image: { id: s.media, alt: s.alt }, caption: s.caption, position: s.position });

/** One of the two galleries under the introduction and after the approach. */
function gallery(key: "galleryA" | "galleryB", sectionKey: string, name: string, about: string): EntitySection<I> {
  return section<I, z.ZodType<{ images: Figure[] }>>({
    key: sectionKey, name, type: "Image gallery", about,
    schema: z.strictObject({ images: list(figure, "Pictures", 1, 6, "picture") }),
    read: (i) => ({ images: i[key].map(fromShot) }),
    apply: (i, c) => ({ ...i, [key]: c.images.map(toShot) }),
    map: { [key]: "images" },
    mapError: (k) => {
      const m = new RegExp(`^${key}(?:\\.(\\d+)\\.(media|caption|alt|position))?$`).exec(k);
      if (!m) return null;
      if (m[1] === undefined) return "images";
      return `images.${m[1]}.${m[2] === "media" ? "image.id" : m[2] === "alt" ? "image.alt" : m[2]}`;
    },
  }) as EntitySection<I>;
}

export const CASE_STUDY_SECTIONS: readonly EntitySection<I>[] = [
  section<I, z.ZodType<{ title: string; cover: { id: string; alt: string } }>>({
    key: "hero", name: "Hero", type: "Hero with cover picture", anchor: "top",
    about: "The headline and the large cover picture under it.",
    schema: z.strictObject({ title: rich("Headline", 200), cover: mediaRefRequired("Cover picture") }),
    read: (i) => ({ title: i.title, cover: { id: i.coverImage, alt: i.coverImageAlt } }),
    apply: (i, c) => ({ ...i, title: c.title, coverImage: c.cover.id, coverImageAlt: c.cover.alt }),
    map: { title: "title", coverImage: "cover.id", coverImageAlt: "cover.alt" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ clientName: string; clientFull: string; industry: string; services: string; year: string; timeline: string }>>({
    key: "facts", name: "Project details", type: "Project facts",
    about: "The facts under the headline: client, industry, services, year and timeline.",
    schema: z.strictObject({
      clientName: hint(text("Client (short name)", 60), "Used on cards and in the breadcrumb, for example “Orbit”."),
      clientFull: text("Client (full name)", 80),
      industry: text("Industry", 80),
      services: hint(text("Services provided", 160), "For example: Brand strategy, Visual identity"),
      year: hint(z.string().trim().min(1, "Year is required").max(4, "Year must be 4 digits, like 2026").regex(/^(19|20)\d{2}$/, "Year must be 4 digits, like 2026").meta({ kind: "text", label: "Year" }), "4 digits."),
      timeline: hint(text("Timeline", 40), "For example: 10 weeks"),
    }),
    read: (i) => ({ clientName: i.clientName, clientFull: i.clientFull, industry: i.industry, services: i.services, year: i.year, timeline: i.timeline }),
    apply: (i, c) => ({ ...i, ...c }),
    map: { clientName: "clientName", clientFull: "clientFull", industry: "industry", services: "services", year: "year", timeline: "timeline" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ label: string; lead: string; stats: { value: string; label: string }[] }>>({
    key: "about", name: "Introduction", type: "Introduction with key numbers", anchor: "about-title",
    about: "The opening paragraph about the project and its key numbers.",
    schema: z.strictObject({
      label: text("Small label", 60),
      lead: rich("Introduction", 600),
      stats: list(group("Key number", { value: hint(rich("Number", 24), "For example 41<em>%</em>"), label: text("What it means", 100) }), "Key numbers", 1, 4, "number"),
    }),
    read: (i) => ({ label: i.aboutLabel, lead: i.description, stats: i.stats }),
    apply: (i, c) => ({ ...i, aboutLabel: c.label, description: c.lead, stats: c.stats }),
    map: { aboutLabel: "label", description: "lead", stats: "stats" },
  }) as EntitySection<I>,

  gallery("galleryA", "gallery-1", "First gallery", "Pictures of the project, under the introduction (1 to 6)."),

  section<I, z.ZodType<CaseStudyInput["process"]>>({
    key: "approach", name: "Approach", type: "Step-by-step process", anchor: "chapters-title",
    about: "The steps taken, each with how long it took and what was delivered.",
    schema: z.strictObject({
      label: text("Small label", 60),
      title: rich("Heading", 200),
      steps: list(group("Step", {
        title: text("Title", 100),
        duration: hint(text("How long", 40), "For example: 2 weeks"),
        text: text("Text", 500),
        deliverables: list(group("Deliverable", { title: text("Title", 100), detail: text("Detail", 200) }), "Deliverables", 0, 8, "deliverable"),
      }), "Steps", 1, 8, "step"),
    }),
    read: (i) => i.process,
    apply: (i, c) => ({ ...i, process: c }),
    map: { process: "" },
  }) as EntitySection<I>,

  gallery("galleryB", "gallery-2", "Second gallery", "More pictures, after the approach (1 to 6)."),

  section<I, z.ZodType<CaseStudyInput["challenges"]>>({
    key: "challenges", name: "Challenge", type: "Numbered list", anchor: "challenges-title",
    about: "What made the project hard.",
    schema: z.strictObject({
      label: text("Small label", 60),
      title: rich("Heading", 200),
      items: list(group("Challenge", { title: text("Title", 100), text: text("Text", 500) }), "Challenges", 1, 8, "challenge"),
    }),
    read: (i) => i.challenges,
    apply: (i, c) => ({ ...i, challenges: c }),
    map: { challenges: "" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ image: { id: string; alt: string }; caption: string; position: string }>>({
    key: "wide-image", name: "Wide image", type: "Full-width picture",
    about: "One wide picture between the challenge and the results.",
    schema: z.strictObject({ image: mediaRef("Image"), caption: optText("Caption", 160), position: cropPosition }),
    read: (i) => fromShot(i.wide),
    apply: (i, c) => ({ ...i, wide: toShot(c) }),
    map: { wide: "" },
    mapError: (k) => {
      const m = /^wide(?:\.(media|caption|alt|position))?$/.exec(k);
      return !m ? null : !m[1] ? "image" : m[1] === "media" ? "image.id" : m[1] === "alt" ? "image.alt" : m[1];
    },
  }) as EntitySection<I>,

  section<I, z.ZodType<CaseStudyInput["results"]>>({
    key: "results", name: "Results", type: "Result list", anchor: "results-title",
    about: "What the project achieved. A result marked as a headline number is set larger.",
    schema: z.strictObject({
      label: text("Small label", 60),
      title: rich("Heading", 200),
      items: list(group("Result", { text: hint(rich("Result", 300), "For example <em>62%</em> more direct traffic"), metric: toggle("Style", "Headline number (shown larger)") }), "Results", 1, 10, "result"),
    }),
    read: (i) => ({ ...i.results, items: i.results.items.map((r) => ({ text: r.text, metric: r.metric })) }),
    apply: (i, c) => ({ ...i, results: c }),
    map: { results: "" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ label: string; title: string; slugs: string[] }>>({
    key: "related-work", name: "Related work", type: "Related projects", anchor: "more-title",
    about: "Other projects suggested at the bottom of the page. Only published projects are shown to visitors.",
    schema: z.strictObject({ label: text("Small label", 60), title: rich("Heading", 200), slugs: pick("Project", "case_slugs", 1, 4, "project") }),
    read: (i) => ({ label: i.more.label, title: i.more.title, slugs: i.more.slugs }),
    apply: (i, c) => ({ ...i, more: { label: c.label, title: c.title, slugs: c.slugs } }),
    map: { more: "" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ typeLine: string; shortKind: string; cardTags: string[]; filters: CaseStudyInput["filters"]; image: { id: string; alt: string } }>>({
    key: "works-card", name: "Card on the Works page", type: "Project card",
    about: "How the project looks in the grid of all work: its type line, tags, filters and picture.",
    schema: z.strictObject({
      typeLine: hint(text("Type line", 80), "For example: Rebrand · Furniture"),
      shortKind: hint(text("Short label", 40), "Shown under the thumbnail in “More work”."),
      cardTags: list(text("Tag", 24), "Tags on the card", 1, 4, "tag").refine((v) => new Set(v).size === v.length, "Each tag once"),
      filters: list(choice("Filter", DISCIPLINES, DISCIPLINE_LABELS), "Appears under these filters", 1, 5, "filter").refine((v) => new Set(v).size === v.length, "Each filter once"),
      image: mediaRefRequired("Card picture"),
    }),
    read: (i) => ({ typeLine: i.typeLine, shortKind: i.shortKind, cardTags: i.cardTags, filters: i.filters, image: { id: i.cardImage, alt: i.cardImageAlt } }),
    apply: (i, c) => ({ ...i, typeLine: c.typeLine, shortKind: c.shortKind, cardTags: c.cardTags, filters: c.filters, cardImage: c.image.id, cardImageAlt: c.image.alt }),
    map: { typeLine: "typeLine", shortKind: "shortKind", cardTags: "cardTags", filters: "filters", cardImage: "image.id", cardImageAlt: "image.alt" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ title: string; tags: string[]; results: { value: string; text: string }[]; quote: CaseStudyInput["showcase"]["quote"] | null }>>({
    key: "showcase", name: "Card on service pages and Home", type: "Result or quote card",
    about: "The smaller card shown on service pages and on Home. It shows numbers, or a client quote when the quote part is on.",
    schema: z.strictObject({
      title: rich("Card headline", 200),
      tags: list(text("Tag", 24), "Card tags", 1, 4, "tag"),
      results: list(group("Result", { value: hint(rich("Number", 24), "For example 62<em>%</em>"), text: text("Text", 140) }), "Numbers (shown when there is no quote)", 0, 4, "result"),
      quote: hint(z.strictObject({
        source: hint(text("Source", 60), "For example: Clutch"),
        text: text("Quote", 400),
        name: text("Name", 60),
        role: text("Role", 80),
        avatar: hint(text("Avatar picture path", 200).refine((v) => /^\/[^\s<>"']*$/.test(v), "Avatar must be a path starting with /"), "/assets/people/…"),
      }).meta({ kind: "group", label: "Client quote" }), "Switch this on to show a client quote on the card instead of the numbers.").nullable(),
    }).superRefine((v, ctx) => {
      if (v.quote) return;
      if (v.results.length === 0) ctx.addIssue({ code: "custom", path: ["results"], message: "Add at least 1 number, or switch the client quote on" });
    }),
    read: (i) => ({ title: i.showcase.title, tags: i.showcase.tags, results: i.showcase.variant === "results" ? i.showcase.results : [], quote: i.showcase.variant === "quote" ? i.showcase.quote : null }),
    apply: (i, c) => ({
      ...i,
      showcase: {
        title: c.title, tags: c.tags, variant: c.quote ? "quote" : "results",
        results: c.results.length ? c.results : i.showcase.results,
        quote: c.quote ?? i.showcase.quote,
      },
    }),
    map: { "showcase.title": "title", "showcase.tags": "tags", "showcase.results": "results", "showcase.quote": "quote" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ serviceIds: string[] }>>({
    key: "services", name: "Shown on service pages", type: "Service links",
    about: "The service pages that include this case study as a card.",
    schema: z.strictObject({ serviceIds: pick("Service", "service_ids", 0, 10, "service") }),
    read: (i) => ({ serviceIds: i.serviceIds }),
    apply: (i, c) => ({ ...i, serviceIds: c.serviceIds }),
    map: { serviceIds: "serviceIds" },
  }) as EntitySection<I>,

  section<I, z.ZodType<{ metaTitle: string; metaDescription: string }>>({
    key: "seo", name: "Search engines (SEO)", type: "Search settings",
    about: "The title and description shown in search results and when the page is shared. Separate from the headline.",
    schema: z.strictObject({
      metaTitle: hint(text("SEO title", 70), "About 60 characters."),
      metaDescription: hint(text("SEO description", 200, 20), "About 150–160 characters."),
    }),
    read: (i) => ({ metaTitle: i.metaTitle, metaDescription: i.metaDescription }),
    apply: (i, c) => ({ ...i, ...c }),
    map: { metaTitle: "metaTitle", metaDescription: "metaDescription" },
  }) as EntitySection<I>,
];
