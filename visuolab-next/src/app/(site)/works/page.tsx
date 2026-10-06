import type { Metadata } from "next";
import JsonLd from "@/components/site/JsonLd";
import WorksPage from "@/components/site/works/WorksPage";
import { fixedPageSeo } from "@/lib/server/seo";
import { getCaseStudies } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";

// The list of case studies comes from D1 at request time; the page itself is unchanged.
export const dynamic = "force-dynamic";

/** The Works page's share picture is the first case study's card; its structured data lists every case study. */
async function seo() {
  const cases = await getCaseStudies(getDb(), { publishedOnly: true });
  const first = cases[0];
  return { cases, seo: await fixedPageSeo("works", { image: first ? { src: first.card.image.src, alt: first.card.image.alt } : undefined, items: cases.map((c) => ({ name: c.card.name, path: `/works/${c.slug}` })) }) };
}

export async function generateMetadata(): Promise<Metadata> {
  return (await seo()).seo.metadata;
}

export default async function WorksRoute() {
  const { cases, seo: s } = await seo();
  return (
    <>
      <JsonLd nodes={s.jsonLd} />
      <WorksPage cases={cases} />
    </>
  );
}
