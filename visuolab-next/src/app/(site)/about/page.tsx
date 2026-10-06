import type { Metadata } from "next";
import JsonLd from "@/components/site/JsonLd";
import { fixedPageSeo } from "@/lib/server/seo";
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

export default async function AboutPage() {
  const seo = await fixedPageSeo("about");
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      <AboutHeroRun />
      <AboutPrinciples />
      <AboutMission />
      <AboutStory />
      <AboutManifesto />
      <AboutPlaces />
      <AboutFaqRun />
    </>
  );
}
