import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import JsonLd from "@/components/site/JsonLd";
import ServicePage from "@/components/site/service/ServicePage";
import { getAdmin } from "@/lib/server/auth";
import { getServiceBySlug, getSlugRedirect } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { serviceSeo } from "@/lib/server/seo";

// Content comes from D1 at request time (D1 is not reachable while the site is built), then goes through the same components as before.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Published services for everybody. Drafts and archived ones are opened only for a signed-in admin, as a preview. */
async function load(slug: string) {
  const db = getDb();
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

export default async function ServiceRoute({ params }: Props) {
  const { service, redirectTo, preview } = await load((await params).slug);
  if (redirectTo) permanentRedirect(`/services/${redirectTo}`);
  if (!service) notFound();
  const seo = await serviceSeo(service, !!preview);
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      <ServicePage service={service} />
    </>
  );
}
