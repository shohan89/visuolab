import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import PreviewBar from "@/components/site/PreviewBar";
import { enterPreview } from "@/lib/server/preview";
import JsonLd from "@/components/site/JsonLd";
import { getServicePreview } from "@/lib/server/entity-preview";
import ServicePage from "@/components/site/service/ServicePage";
import { getAdmin } from "@/lib/server/auth";
import { getHiddenSections, getServiceBySlug, getSlugRedirect } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { getLogoSeeds, getPage, getRating, getReviewSeeds } from "@/lib/server/cms-pages";
import { serviceSeo } from "@/lib/server/seo";

// Content comes from D1 at request time (D1 is not reachable while the site is built), then goes through the same components as before. The words that are
// the same on every service page (the "Trusted by" label, the reviews heading) come from the page CMS.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
type Page = Props & { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Published services for everybody. Drafts and archived ones are opened only for a signed-in admin, as a preview. */
async function load(slug: string, draft = false) {
  const db = getDb();
  if (draft) { const p = await getServicePreview(slug); if (p) return { service: p, preview: true }; } // an admin's preview: the page with its draft changes
  const live = await getServiceBySlug(db, slug);
  if (live) return { service: live, preview: false };
  const redirectTo = await getSlugRedirect(db, "service", slug);
  if (redirectTo) return { redirectTo };
  if (await getAdmin()) {
    const preview = await getServiceBySlug(db, slug, { includeUnpublished: true });
    if (preview) return { service: preview, preview: true };
  }
  return {};
}

/** Title and description from the service row; canonical, Open Graph (hero picture), Twitter, robots and Service structured data from the same record. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { service, preview } = await load((await params).slug);
  return service ? (await serviceSeo(service, !!preview)).metadata : {};
}

export default async function ServiceRoute({ params, searchParams }: Page) {
  const draft = await enterPreview(await searchParams);
  const { service, redirectTo, preview } = await load((await params).slug, draft);
  if (redirectTo) permanentRedirect(`/services/${redirectTo}`);
  if (!service) notFound();
  const [seo, { content, enabled }, logos, reviews, rating, hidden] = await Promise.all([serviceSeo(service, !!preview), getPage("service_detail"), getLogoSeeds(), getReviewSeeds(), getRating(), getHiddenSections(getDb(), "service", service.slug)]);
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      {draft && <PreviewBar what="this service with its draft changes" back="/admin/services" />}
      <ServicePage service={service} hidden={hidden} chrome={{ rating, logos: enabled.logos ? { content: content.logos, items: logos } : null, reviews: enabled.reviews ? { content: content.reviews, items: reviews } : null }} />
    </>
  );
}
