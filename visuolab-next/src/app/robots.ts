import type { MetadataRoute } from "next";
import { getSiteConfig } from "@/lib/server/site-config";
import { getSiteUrl } from "@/lib/site";

// Follows the SEO settings: indexing on/off, the paths to keep out, and whether the sitemap is announced.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteUrl();
  const c = await getSiteConfig().catch((e) => {
    console.error("robots settings unreadable:", e instanceof Error ? e.name : "unknown error"); // the database is down: fall back to the default rules
    return null;
  });
  if (!c) return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin"] }], sitemap: `${site}/sitemap.xml` };
  const { indexing, disallow, sitemap } = c.seo;
  // the admin area is never offered to search engines, whatever the settings say
  const blocked = indexing ? [...new Set(["/admin", ...disallow])] : ["/"];
  return { rules: [{ userAgent: "*", ...(indexing ? { allow: "/" } : {}), disallow: blocked }], ...(sitemap && indexing ? { sitemap: `${site}/sitemap.xml` } : {}) };
}
