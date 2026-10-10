import type { MetadataRoute } from "next";
import { getBlogPosts, getCaseStudies, getServices } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { getSiteConfig } from "@/lib/server/site-config";
import { SEO_PAGES } from "@/lib/settings/schema";
import { getSiteUrl } from "@/lib/site";

// Built from D1 on request, so a new or scheduled article appears in the sitemap as soon as it is live.
export const dynamic = "force-dynamic";

const PATHS = { home: "", about: "/about", works: "/works", blog: "/blog", contact: "/contact" } as const;
const PRIORITY = { home: 1, about: 0.6, works: 0.8, blog: 0.8, contact: 0.7 } as const;
const newest = (dates: (string | undefined)[]) => dates.filter((d): d is string => !!d).sort().at(-1);

/**
 * Every public page that exists: the fixed pages (unless switched off in the SEO settings) plus the published services, case studies
 * and live articles, each with the time it last changed. Empty when indexing is switched off for the whole site.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return await build();
  } catch (e) {
    // the database could not be read: answer with the fixed pages instead of an error page (and never the error text)
    console.error("sitemap failed:", e instanceof Error ? e.name : "unknown error");
    const site = await getSiteUrl();
    return SEO_PAGES.map((k) => ({ url: `${site}${PATHS[k]}`, priority: PRIORITY[k] }));
  }
}

async function build(): Promise<MetadataRoute.Sitemap> {
  const [site, cfg] = await Promise.all([getSiteUrl(), getSiteConfig()]);
  if (!cfg.seo.indexing) return [];
  const db = getDb();
  const [services, cases, posts] = await Promise.all([getServices(db, { publishedOnly: true }), getCaseStudies(db, { publishedOnly: true }), getBlogPosts(db, { publishedOnly: true })]);
  const changed = {
    works: newest(cases.map((c) => c.updatedAtIso)),
    blog: newest(posts.map((p) => p.updatedAtIso ?? p.publishedAtIso)),
  } as Record<string, string | undefined>;
  const unpublished = new Set(((await db.prepare("SELECT template FROM pages WHERE status <> 'published'").all<{ template: string }>()).results ?? []).map((r) => r.template)); // a page taken off the website is not listed
  const fixed = SEO_PAGES.filter((k) => !cfg.seo.pages[k].noindex && !unpublished.has(k)).map((k) => ({
    url: `${site}${PATHS[k]}`,
    ...(changed[k] ? { lastModified: changed[k] } : {}),
    changeFrequency: (k === "blog" || k === "home" ? "weekly" : "monthly") as "weekly" | "monthly",
    priority: PRIORITY[k],
  }));
  return [
    ...fixed,
    ...services.map((s) => ({ url: `${site}/services/${s.slug}`, changeFrequency: "monthly" as const, priority: 0.9 })),
    ...cases.map((c) => ({ url: `${site}/works/${c.slug}`, ...(c.updatedAtIso ? { lastModified: c.updatedAtIso } : {}), changeFrequency: "monthly" as const, priority: 0.7 })),
    ...posts.map((p) => ({ url: `${site}/blog/${p.slug}`, lastModified: p.updatedAtIso ?? p.publishedAtIso, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
