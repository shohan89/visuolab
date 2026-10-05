import type { MetadataRoute } from "next";
import { getBlogPosts, getCaseStudies, getServices } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { getSiteUrl } from "@/lib/site";

// Built from D1 on request, so a new or scheduled article appears in the sitemap as soon as it is live.
export const dynamic = "force-dynamic";

/** Every public page that exists: the fixed pages plus the published services, case studies and live articles. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getSiteUrl();
  const db = getDb();
  const [services, cases, posts] = await Promise.all([getServices(db, { publishedOnly: true }), getCaseStudies(db, { publishedOnly: true }), getBlogPosts(db, { publishedOnly: true })]);
  const fixed = ["/", "/about", "/works", "/blog", "/contact"].map((p) => ({ url: `${site}${p === "/" ? "" : p}` }));
  return [
    ...fixed,
    ...services.map((s) => ({ url: `${site}/services/${s.slug}` })),
    ...cases.map((c) => ({ url: `${site}/works/${c.slug}` })),
    ...posts.map((p) => ({ url: `${site}/blog/${p.slug}`, lastModified: p.updatedAtIso ?? p.publishedAtIso })),
  ];
}
