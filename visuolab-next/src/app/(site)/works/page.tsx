import type { Metadata } from "next";
import PreviewBar from "@/components/site/PreviewBar";
import { enterPreview, requirePublished } from "@/lib/server/preview";
import JsonLd from "@/components/site/JsonLd";
import WorksPage from "@/components/site/works/WorksPage";
import { fixedPageSeo } from "@/lib/server/seo";
import { getCaseStudies } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { getPage, getRating, getReviewSeeds } from "@/lib/server/cms-pages";

// The list of case studies and the words around it come from D1 at request time (the page CMS); the page itself is unchanged.
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

export default async function WorksRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await enterPreview(await searchParams);
  const [{ cases, seo: s }, { content, enabled, page }, reviews, rating] = await Promise.all([seo(), getPage("works"), getReviewSeeds(), getRating()]);
  await requirePublished("works", page?.status);
  return (
    <>
      <JsonLd nodes={s.jsonLd} />
      {preview && <PreviewBar what="Works with its draft changes" back="/admin/pages/works" />}
      <WorksPage cases={cases} hero={enabled.hero ? content.hero : null} grid={enabled.grid ? content.grid : null} reviews={enabled.reviews ? { content: content.reviews, items: reviews, rating } : null} />
    </>
  );
}
