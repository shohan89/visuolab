/*
 * Content mapping layer for case studies.
 *
 *   database rows  ──mapCaseStudy()──▶  CaseStudy (src/content/types.ts)  ──▶  CaseStudyPage / WorksPage (unchanged)
 *   database rows  ──rowToInput()────▶  CaseStudyInput (admin form)
 *   CaseStudyInput ──inputToColumns()▶  column values for INSERT / UPDATE
 *
 * Pure functions: no database, no framework, no "server-only". The Worker, the admin and the verification script all use them,
 * so a record means the same thing everywhere. The shapes of the JSON columns are the types below; nothing else reads them.
 */
import type { CaseCardSeed, CaseFigure, CaseStudy } from "../../content/types.ts";
import type { CaseStudyInput } from "../validation/case-study.ts";

export type Row = Record<string, unknown>;
/** media id → public URL */
export type MediaIndex = Record<string, string>;

const s = (v: unknown) => String(v ?? "");
const parse = <T>(v: unknown): T => JSON.parse(String(v)) as T;

/* ---- JSON column documents ------------------------------------------------------------------------------------ */

export type Fact = { term: string; value: string };
export type Stat = { value: string; label: string };
export type ProcessDoc = CaseStudy["process"];
export type ChallengesDoc = CaseStudy["challenges"];
export type ResultsDoc = CaseStudy["results"];
export type MoreDoc = { label: string; title: string; slugs: string[] };
export type ShowcaseDoc = { title: string; tags: string[]; quote?: NonNullable<CaseCardSeed["quote"]>; results?: NonNullable<CaseCardSeed["results"]> };

export const FACT_TERMS = ["Client", "Industry", "Services", "Year", "Timeline"] as const;
export const IMAGE_ROLES = ["gallery_a", "gallery_b", "wide"] as const;

/* ---- row → public page model ---------------------------------------------------------------------------------- */

const figure = (r: Row, media: MediaIndex): CaseFigure => ({ src: media[s(r.media_id)] ?? "", alt: s(r.alt_text), caption: s(r.caption), position: (r.object_position as string | null) ?? null });

/**
 * One case_studies row (and its images) as the object the page components take.
 * `others` holds the rows of the case studies that may appear under "More work": a slug missing from it (deleted, or not published)
 * is left out instead of breaking the page.
 */
export function mapCaseStudy(c: Row, images: Row[], media: MediaIndex, others: Record<string, Row>): CaseStudy {
  const mine = images.filter((i) => i.case_study_id === c.id).sort((a, b) => Number(a.position) - Number(b.position));
  const role = (name: string) => mine.filter((i) => i.role === name).map((i) => figure(i, media));
  const more = parse<MoreDoc>(c.more_json);
  const wide = role("wide")[0];
  return {
    slug: s(c.slug),
    meta: { title: s(c.meta_title), description: s(c.meta_description) },
    card: {
      name: s(c.client_name), year: s(c.year), type: s(c.type_line), tags: parse(c.card_tags_json), filters: parse(c.filters_json),
      image: { src: media[s(c.card_image_id)] ?? "", alt: s(c.card_image_alt) },
    },
    hero: { breadcrumb: s(c.client_name), title: s(c.title), facts: parse<Fact[]>(c.facts_json) },
    cover: { src: media[s(c.cover_image_id)] ?? "", alt: s(c.cover_image_alt) },
    about: { label: s(c.about_label), lead: s(c.about_lead), stats: parse<Stat[]>(c.stats_json) },
    galleryA: role("gallery_a"),
    process: parse<ProcessDoc>(c.process_json),
    galleryB: role("gallery_b"),
    challenges: parse<ChallengesDoc>(c.challenges_json),
    wide: wide ?? { src: "", alt: "", caption: "", position: null },
    results: parse<ResultsDoc>(c.results_json),
    more: {
      label: more.label,
      title: more.title,
      items: more.slugs.flatMap((slug) => {
        const o = others[slug];
        return o ? [{ slug, name: s(o.client_name), kind: s(o.short_kind), image: media[s(o.card_image_id)] ?? "" }] : [];
      }),
    },
  };
}

/** The small card shown on the home page and on service pages. */
export function mapCaseCard(slug: string, cardImageId: unknown, cardImageAlt: unknown, showcaseJson: unknown, media: MediaIndex): CaseCardSeed {
  const sc = parse<ShowcaseDoc>(showcaseJson);
  return {
    href: `/works/${slug}`,
    tags: sc.tags,
    title: sc.title,
    image: { src: media[s(cardImageId)] ?? "", alt: s(cardImageAlt), lazy: true },
    ...(sc.quote ? { quote: sc.quote } : {}),
    ...(sc.results ? { results: sc.results } : {}),
  };
}

/* ---- row → admin form ----------------------------------------------------------------------------------------- */

const fact = (facts: Fact[], term: string) => facts.find((f) => f.term === term)?.value ?? "";

export function rowToInput(c: Row, images: Row[], serviceIds: string[]): CaseStudyInput {
  const mine = images.filter((i) => i.case_study_id === c.id).sort((a, b) => Number(a.position) - Number(b.position));
  const shot = (r: Row) => ({ media: s(r.media_id), caption: s(r.caption), alt: s(r.alt_text), position: s(r.object_position ?? "") });
  const facts = parse<Fact[]>(c.facts_json);
  const showcase = parse<ShowcaseDoc>(c.showcase_json);
  const more = parse<MoreDoc>(c.more_json);
  const wide = mine.find((i) => i.role === "wide");
  return {
    title: s(c.title), slug: s(c.slug), status: s(c.status) as CaseStudyInput["status"], featured: Boolean(c.featured),
    clientName: s(c.client_name), clientFull: fact(facts, "Client"), industry: fact(facts, "Industry"), services: fact(facts, "Services"), year: s(c.year), timeline: fact(facts, "Timeline"),
    typeLine: s(c.type_line), shortKind: s(c.short_kind), cardTags: parse(c.card_tags_json), filters: parse(c.filters_json),
    cardImage: s(c.card_image_id), cardImageAlt: s(c.card_image_alt), coverImage: s(c.cover_image_id), coverImageAlt: s(c.cover_image_alt),
    metaTitle: s(c.meta_title), metaDescription: s(c.meta_description),
    aboutLabel: s(c.about_label), description: s(c.about_lead), stats: parse<Stat[]>(c.stats_json),
    galleryA: mine.filter((i) => i.role === "gallery_a").map(shot),
    process: parse<ProcessDoc>(c.process_json),
    galleryB: mine.filter((i) => i.role === "gallery_b").map(shot),
    challenges: parse<ChallengesDoc>(c.challenges_json),
    wide: wide ? shot(wide) : { media: "", caption: "", alt: "", position: "" },
    results: parse<ResultsDoc>(c.results_json),
    more: { label: more.label, title: more.title, slugs: more.slugs },
    showcase: {
      title: showcase.title, tags: showcase.tags, variant: showcase.quote ? "quote" : "results",
      results: showcase.results ?? [{ value: "", text: "" }],
      quote: showcase.quote ?? { source: "", text: "", avatar: "", name: "", role: "" },
    },
    serviceIds,
  };
}

/* ---- form → columns ------------------------------------------------------------------------------------------- */

/** The JSON documents and derived columns for a validated form. Order of keys inside the documents matches the seed. */
export function inputToColumns(i: CaseStudyInput) {
  const facts: Fact[] = [
    { term: "Client", value: i.clientFull },
    { term: "Industry", value: i.industry },
    { term: "Services", value: i.services },
    { term: "Year", value: i.year },
    { term: "Timeline", value: i.timeline },
  ];
  const showcase: ShowcaseDoc = { title: i.showcase.title, tags: i.showcase.tags, ...(i.showcase.variant === "quote" ? { quote: i.showcase.quote } : { results: i.showcase.results }) };
  return {
    facts_json: JSON.stringify(facts),
    stats_json: JSON.stringify(i.stats),
    showcase_json: JSON.stringify(showcase),
    process_json: JSON.stringify(i.process),
    challenges_json: JSON.stringify(i.challenges),
    results_json: JSON.stringify(i.results),
    more_json: JSON.stringify({ label: i.more.label, title: i.more.title, slugs: i.more.slugs } satisfies MoreDoc),
    card_tags_json: JSON.stringify(i.cardTags),
    filters_json: JSON.stringify(i.filters),
  };
}

/** The images of a case study as rows to insert, in display order. */
export function inputToImages(i: CaseStudyInput): { role: (typeof IMAGE_ROLES)[number]; media: string; caption: string; alt: string; position: string | null; index: number }[] {
  const rows = (role: (typeof IMAGE_ROLES)[number], list: CaseStudyInput["galleryA"]) => list.map((g, index) => ({ role, media: g.media, caption: g.caption, alt: g.alt, position: g.position || null, index }));
  return [...rows("gallery_a", i.galleryA), ...rows("gallery_b", i.galleryB), ...rows("wide", [i.wide])];
}
