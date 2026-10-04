import type { Metadata } from "next";
import HomeHero from "@/components/site/home/HomeHero";
import HomeIntroRun from "@/components/site/home/HomeIntroRun";
import HomeReviews from "@/components/site/home/HomeReviews";
import HomeServices from "@/components/site/home/HomeServices";
import HomeWorkRun from "@/components/site/home/HomeWorkRun";

export const metadata: Metadata = {
  title: "Visuolab — Digital product design agency",
  description: "Visuolab is a design agency that unites brand, website and product into one story.",
};

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeIntroRun />
      <HomeServices />
      <HomeWorkRun />
      <HomeReviews />
    </>
  );
}
