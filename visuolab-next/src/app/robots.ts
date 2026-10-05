import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/** Search engines may read the whole site except the admin area. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await getSiteUrl();
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin"] }], sitemap: `${site}/sitemap.xml` };
}
