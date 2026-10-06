import type { Metadata } from "next";
import JsonLd from "@/components/site/JsonLd";
import { fixedPageSeo } from "@/lib/server/seo";
import HomeHero from "@/components/site/home/HomeHero";
import HomeIntroRun from "@/components/site/home/HomeIntroRun";
import HomeReviews from "@/components/site/home/HomeReviews";
import HomeServices from "@/components/site/home/HomeServices";
import HomeWorkRun from "@/components/site/home/HomeWorkRun";

// Title, description and robots come from Settings → SEO → Page metadata (D1); the site address and share picture from the other settings.
export async function generateMetadata(): Promise<Metadata> {
  return (await fixedPageSeo("home")).metadata;
}

export default async function HomePage() {
  const seo = await fixedPageSeo("home");
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      <HomeHero />
      <HomeIntroRun />
      <HomeServices />
      <HomeWorkRun />
      <HomeReviews />
    </>
  );
}
