import type { Metadata } from "next";
import PreviewBar from "@/components/site/PreviewBar";
import { enterPreview, requirePublished } from "@/lib/server/preview";
import JsonLd from "@/components/site/JsonLd";
import { fixedPageSeo } from "@/lib/server/seo";
import { getCaseTiles, getPage } from "@/lib/server/cms-pages";
import AboutFaqRun from "@/components/site/about/AboutFaqRun";
import AboutHeroRun from "@/components/site/about/AboutHeroRun";
import AboutManifesto from "@/components/site/about/AboutManifesto";
import AboutMission from "@/components/site/about/AboutMission";
import AboutPlaces from "@/components/site/about/AboutPlaces";
import AboutPrinciples from "@/components/site/about/AboutPrinciples";
import AboutStory from "@/components/site/about/AboutStory";

export async function generateMetadata(): Promise<Metadata> {
  return (await fixedPageSeo("about")).metadata;
}

/**
 * About: the sections come from the page CMS (D1) and are handed, as props, to the components that always drew them.
 * Section type -> component:  about_hero, case_mosaic -> AboutHeroRun · principles_list -> AboutPrinciples · mission_vision -> AboutMission ·
 * timeline -> AboutStory · manifesto -> AboutManifesto · office_clocks -> AboutPlaces · faq_accordion, open_roles -> AboutFaqRun.
 */
export default async function AboutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await enterPreview(await searchParams);
  const seo = await fixedPageSeo("about");
  const { content, enabled, page } = await getPage("about");
  await requirePublished("about", page?.status);
  const tiles = enabled.mosaic ? await getCaseTiles(content.mosaic.caseIds) : null;
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      {preview && <PreviewBar what="About with its draft changes" back="/admin/pages/about" />}
      <AboutHeroRun content={enabled.hero ? content.hero : null} tiles={tiles} />
      {enabled.principles && <AboutPrinciples content={content.principles} />}
      {enabled.mission && <AboutMission content={content.mission} />}
      {enabled.story && <AboutStory content={content.story} />}
      {enabled.manifesto && <AboutManifesto content={content.manifesto} />}
      {enabled.places && <AboutPlaces content={content.places} />}
      <AboutFaqRun faq={enabled.faq ? content.faq : null} careers={enabled.careers ? content.careers : null} />
    </>
  );
}
