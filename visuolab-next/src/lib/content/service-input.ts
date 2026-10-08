/* One services row (and the ids of its case studies) as the object the admin form and the section editors take. Pure: no database, no framework. */
import type { ServiceInput } from "../validation/service.ts";

export type Row = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "");
const parse = <T>(v: unknown): T => JSON.parse(String(v)) as T;

export function rowToServiceInput(v: Row, caseIds: string[]): ServiceInput {
  const shots = parse<{ alt: string }[]>(v.hero_shots_json);
  const problems = parse<ServiceInput["problems"]>(v.problems_json);
  const band = parse<{ text: string; cta: { label: string; href: string } }>(v.band_json);
  const cases = parse<{ label: string; title: string }>(v.cases_json);
  return {
    title: s(v.title), slug: s(v.slug), status: s(v.status) as ServiceInput["status"],
    metaTitle: s(v.meta_title), metaDescription: s(v.meta_description),
    heroTitle: s(v.hero_title), heroLead: s(v.hero_lead), heroCtaLabel: s(v.hero_cta_label), heroCtaHref: s(v.hero_cta_href),
    heroImageA: s(v.hero_image_a_id), heroImageAAlt: shots[0]?.alt ?? "", heroImageB: s(v.hero_image_b_id), heroImageBAlt: shots[1]?.alt ?? "",
    showProblems: Boolean(v.show_problems), problems,
    overview: parse(v.overview_json), outcomes: parse(v.outcomes_json),
    showBand: Boolean(v.show_band), band: { text: band.text, ctaLabel: band.cta.label, ctaHref: band.cta.href },
    included: parse(v.included_json), process: parse(v.process_json),
    casesLabel: cases.label, casesTitle: cases.title, caseIds,
  };
}
