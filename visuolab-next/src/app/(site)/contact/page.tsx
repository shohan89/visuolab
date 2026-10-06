import type { Metadata } from "next";
import ContactSection from "@/components/site/contact/ContactSection";
import JsonLd from "@/components/site/JsonLd";
import { fixedPageSeo } from "@/lib/server/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return (await fixedPageSeo("contact")).metadata;
}

export default async function ContactRoute() {
  const seo = await fixedPageSeo("contact");
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      <ContactSection />
    </>
  );
}
