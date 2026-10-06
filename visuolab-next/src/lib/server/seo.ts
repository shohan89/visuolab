import "server-only";
import type { Metadata } from "next";
import { cache } from "react";
import type { BlogPost, CaseStudy, ServiceSeed } from "@/content/types";
import { articleNode, breadcrumbNode, collectionNode, pageNode, serviceNode, websiteNode, type Crumb } from "@/lib/seo/jsonld";
import { clip, pageMetadata, plain, twitterHandle, type SeoImage, type SeoSite } from "@/lib/seo/metadata";
import type { SeoPageKey } from "@/lib/settings/schema";
import { getDb } from "./db";
import { getSiteConfig, type SiteConfig } from "./site-config";
import { getSiteUrl } from "@/lib/site";

/*
 * Per-route SEO: reads what each page needs from D1 (the site settings, the service / case study / article row) and returns the
 * <head> metadata and the JSON-LD nodes for that page. The routes call one function here and render the result; they contain no
 * SEO rules of their own. Nothing here produces visible content.
 */

export type PageSeoResult = { metadata: Metadata; jsonLd: Record<string, unknown>[] };

export const seoContext = cache(async (): Promise<{ siteUrl: string; cfg: SiteConfig; site: SeoSite }> => {
  const [siteUrl, cfg] = await Promise.all([getSiteUrl(), getSiteConfig()]);
  const site: SeoSite = {
    name: cfg.general.siteName,
    ogImage: cfg.seo.ogImageUrl ? { src: cfg.seo.ogImageUrl, alt: cfg.general.siteName } : undefined,
    twitterSite: twitterHandle(cfg.social.x),
  };
  return { siteUrl, cfg, site };
});

/** Width and height of a picture the library knows (by its public address), so share cards can announce the size. */
async function imageSize(src: string): Promise<{ width: number; height: number } | null> {
  const r = await getDb()
    .prepare("SELECT width, height FROM media WHERE url = ?1 OR (r2_key IS NOT NULL AND length(?1) > length(r2_key) AND substr(?1, -length(r2_key)) = r2_key) LIMIT 1")
    .bind(src)
    .first<{ width: number | null; height: number | null }>();
  return r?.width && r?.height ? { width: r.width, height: r.height } : null;
}

async function sized(src: string, alt?: string, known?: { width?: number | null; height?: number | null }): Promise<SeoImage> {
  const dims = known?.width && known?.height ? { width: known.width, height: known.height } : await imageSize(src);
  return { src, alt, ...(dims ?? {}) };
}

const description = (t: string) => clip(t, 300);

/* ---- the fixed pages: Home, About, Works, Blog, Contact ---------------------------------------------------------- */

const LABELS: Record<SeoPageKey, string> = { home: "Home", about: "About", works: "Works", blog: "Blog", contact: "Contact" };
const PATHS: Record<SeoPageKey, string> = { home: "/", about: "/about", works: "/works", blog: "/blog", contact: "/contact" };

/** Title, description and index/noindex of a fixed page: the SEO settings (Settings → SEO → Page metadata), which start as the text the pages always had. */
export async function fixedPageSeo(page: SeoPageKey, opts: { image?: SeoImage; items?: Crumb[] } = {}): Promise<PageSeoResult> {
  const { siteUrl, cfg, site } = await seoContext();
  const p = cfg.seo.pages[page];
  const path = PATHS[page];
  const noindex = p.noindex || !cfg.seo.indexing;
  const metadata = pageMetadata({ site, title: p.title, description: description(p.description), path, image: opts.image, noindex });
  const trail: Crumb[] = page === "home" ? [] : [{ name: LABELS[page], path }];
  const nodes: Record<string, unknown>[] = [];
  if (page === "home") nodes.push(websiteNode(siteUrl, cfg));
  if (page === "about") nodes.push(pageNode(siteUrl, { type: "AboutPage", path, name: p.title, description: p.description }));
  if (page === "contact") nodes.push(pageNode(siteUrl, { type: "ContactPage", path, name: p.title, description: p.description }));
  if (page === "works" || page === "blog") nodes.push(collectionNode(siteUrl, { path, name: p.title, description: p.description, items: opts.items ?? [] }));
  if (trail.length) nodes.push(breadcrumbNode(siteUrl, cfg.general.siteName, trail, path));
  return { metadata, jsonLd: nodes };
}

/* ---- dynamic pages ---------------------------------------------------------------------------------------------- */

/** A service page. `preview`: an unpublished service opened by a signed-in admin: noindex, no structured data. */
export async function serviceSeo(s: ServiceSeed, preview: boolean): Promise<PageSeoResult> {
  const { siteUrl, cfg, site } = await seoContext();
  const path = `/services/${s.slug}`;
  const shot = s.hero.shots[0];
  const image = shot ? await sized(shot.src, shot.alt || plain(s.hero.title), shot) : undefined;
  const name = plain(s.meta.title).replace(/\s+[—–-]\s+[^—–-]+$/, ""); // "Brand identity — Visuolab" → "Brand identity"
  const metadata = pageMetadata({ site, title: s.meta.title, description: description(s.meta.description), path, image, noindex: preview || !cfg.seo.indexing });
  if (preview) return { metadata, jsonLd: [] };
  return {
    metadata,
    jsonLd: [
      serviceNode(siteUrl, { name, slug: s.slug, description: s.meta.description, image: image?.src, offers: s.included.items.map((i) => i.title) }),
      breadcrumbNode(siteUrl, cfg.general.siteName, [{ name, path }], path),
    ],
  };
}

/** A case study page, described as an article about the client. */
export async function caseStudySeo(c: CaseStudy, preview: boolean): Promise<PageSeoResult> {
  const { siteUrl, cfg, site } = await seoContext();
  const path = `/works/${c.slug}`;
  const image = await sized(c.cover.src, c.cover.alt || `${c.card.name}: ${c.card.type}`);
  const metadata = pageMetadata({
    site, title: c.meta.title, description: description(c.meta.description), path, image, noindex: preview || !cfg.seo.indexing,
    article: c.publishedAtIso ? { publishedTime: c.publishedAtIso, modifiedTime: c.updatedAtIso, section: "Case study" } : undefined,
  });
  if (preview) return { metadata, jsonLd: [] };
  return {
    metadata,
    jsonLd: [
      articleNode(siteUrl, { type: "Article", path, headline: c.hero.title, description: c.meta.description, image: image.src, published: c.publishedAtIso, modified: c.updatedAtIso, section: "Case study", about: c.card.name }),
      breadcrumbNode(siteUrl, cfg.general.siteName, [{ name: LABELS.works, path: PATHS.works }, { name: c.card.name, path }], path),
    ],
  };
}

/** A blog article. */
export async function blogPostSeo(p: BlogPost, preview: boolean): Promise<PageSeoResult> {
  const { siteUrl, cfg, site } = await seoContext();
  const path = `/blog/${p.slug}`;
  const picture = p.ogImage?.src ?? p.cover.src;
  const image = await sized(picture, p.cover.alt || p.title);
  const published = p.publishedAtIso ?? p.publishedAt;
  const metadata = pageMetadata({
    site, title: p.meta.title, description: description(p.meta.description), path, canonical: p.canonicalUrl, image, keywords: p.tags,
    article: { publishedTime: published, modifiedTime: p.updatedAtIso, authors: [p.author.name], section: p.category },
    noindex: preview || !cfg.seo.indexing,
  });
  if (preview) return { metadata, jsonLd: [] };
  return {
    metadata,
    jsonLd: [
      articleNode(siteUrl, { type: "BlogPosting", path, headline: p.title, description: p.meta.description, image: image.src, published, modified: p.updatedAtIso, authorName: p.author.name, section: p.category, keywords: p.tags, canonical: p.canonicalUrl }),
      breadcrumbNode(siteUrl, cfg.general.siteName, [{ name: LABELS.blog, path: PATHS.blog }, { name: p.title, path }], path),
    ],
  };
}
