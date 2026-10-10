import type { Metadata } from "next";
import PreviewBar from "@/components/site/PreviewBar";
import { enterPreview, requirePublished } from "@/lib/server/preview";
import JsonLd from "@/components/site/JsonLd";
import { fixedPageSeo } from "@/lib/server/seo";
import { getCaseCards, getLogoSeeds, getMediaIndex, getPage, getRating, getReviewSeeds, mediaSrc } from "@/lib/server/cms-pages";
import HomeHero from "@/components/site/home/HomeHero";
import HomeIntroRun from "@/components/site/home/HomeIntroRun";
import HomeReviews from "@/components/site/home/HomeReviews";
import HomeServices from "@/components/site/home/HomeServices";
import HomeWorkRun from "@/components/site/home/HomeWorkRun";

// Title, description and robots come from Settings → SEO → Page metadata (D1); the site address and share picture from the other settings.
export async function generateMetadata(): Promise<Metadata> {
  return (await fixedPageSeo("home")).metadata;
}

/**
 * Home: the sections come from the page CMS (D1) and are handed, as props, to the components that always drew them.
 * Section type -> component:  home_hero -> HomeHero · logo_marquee, showreel, why_stats -> HomeIntroRun · services_columns -> HomeServices ·
 * case_showcase, industries_grid, process_steps -> HomeWorkRun · reviews_carousel -> HomeReviews.
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await enterPreview(await searchParams);
  const seo = await fixedPageSeo("home");
  const [{ content, enabled, page }, media, reviews, logos, rating] = await Promise.all([getPage("home"), getMediaIndex(), getReviewSeeds(), getLogoSeeds(), getRating()]);
  await requirePublished("home", page?.status);
  const cards = enabled.work ? await getCaseCards(content.work.caseIds) : [];
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      {preview && <PreviewBar what="Home with its draft changes" back="/admin/pages/home" />}
      {enabled.hero && <HomeHero content={content.hero} />}
      <HomeIntroRun
        logos={enabled.logos ? { content: content.logos, items: logos } : null}
        showreel={enabled.showreel ? { videoSrc: mediaSrc(content.showreel.video, media), posterSrc: mediaSrc(content.showreel.poster, media), videoAlt: content.showreel.video.alt, posterAlt: content.showreel.poster.alt, tag: content.showreel.tag, time: content.showreel.time } : null}
        why={enabled.why ? content.why : null}
      />
      {enabled.services && <HomeServices content={content.services} avatarSrc={mediaSrc(content.services.bookBar.avatar, media)} />}
      <HomeWorkRun work={enabled.work ? content.work : null} cards={cards} industries={enabled.industries ? content.industries : null} process={enabled.process ? content.process : null} />
      {enabled.reviews && <HomeReviews content={content.reviews} rating={rating} reviews={reviews} />}
    </>
  );
}
