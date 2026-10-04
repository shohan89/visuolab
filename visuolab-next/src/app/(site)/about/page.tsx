import type { Metadata } from "next";
import AboutFaqRun from "@/components/site/about/AboutFaqRun";
import AboutHeroRun from "@/components/site/about/AboutHeroRun";
import AboutManifesto from "@/components/site/about/AboutManifesto";
import AboutMission from "@/components/site/about/AboutMission";
import AboutPlaces from "@/components/site/about/AboutPlaces";
import AboutPrinciples from "@/components/site/about/AboutPrinciples";
import AboutStory from "@/components/site/about/AboutStory";
import CtaBand from "@/components/site/chrome/CtaBand";
import Footer from "@/components/site/chrome/Footer";

export const metadata: Metadata = {
  title: "About — Visuolab",
  description:
    "Visuolab is an independent design agency. What started as two designers in 2017 now ships brands, products and websites for teams on four continents.",
};

export default function AboutPage() {
  return (
    <>
      <AboutHeroRun />
      <AboutPrinciples />
      <AboutMission />
      <AboutStory />
      <AboutManifesto />
      <AboutPlaces />
      <AboutFaqRun />
      <CtaBand />
      <Footer variant="about" />
    </>
  );
}
