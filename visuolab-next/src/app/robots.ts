import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/server/site-config";
import { getSiteUrl } from "@/lib/site";

// Follows the SEO settings: indexing on/off, the paths to keep out, and whether the sitemap is announced.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const [site, c] = await Promise.all([getSiteUrl(), getSiteConfig()]);
  const { indexing, disallow, sitemap } = c.seo;
  // the admin area is never offered to search engines, whatever the settings say
  const blocked = indexing ? [...new Set(["/admin", ...disallow])] : ["/"];
  return { rules: [{ userAgent: "*", ...(indexing ? { allow: "/" } : {}), disallow: blocked }], ...(sitemap && indexing ? { sitemap: `${site}/sitemap.xml` } : {}) };
}
