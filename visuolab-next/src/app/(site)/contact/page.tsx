import type { Metadata } from "next";
import ContactSection from "@/components/site/contact/ContactSection";
import PreviewBar from "@/components/site/PreviewBar";
import { enterPreview, requirePublished } from "@/lib/server/preview";
import JsonLd from "@/components/site/JsonLd";
import { getPage } from "@/lib/server/cms-pages";
import { fixedPageSeo } from "@/lib/server/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return (await fixedPageSeo("contact")).metadata;
}

export default async function ContactRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await enterPreview(await searchParams);
  const [seo, { page }] = await Promise.all([fixedPageSeo("contact"), getPage("contact")]);
  await requirePublished("contact", page?.status);
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      {preview && <PreviewBar what="Contact with its draft changes" back="/admin/pages/contact" />}
      <ContactSection />
    </>
  );
}
