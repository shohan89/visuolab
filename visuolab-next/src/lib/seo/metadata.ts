/*
 * Reusable metadata utilities. Every public page builds its <head> through pageMetadata(): title, description, canonical address,
 * robots, Open Graph and Twitter/X cards. Head tags only; nothing visible. Pure functions (no framework state, no database), so
 * the verification script tests them directly; the routes feed them data read from D1 (see src/lib/server/seo.ts).
 */
import type { Metadata } from "next";

export type SeoImage = { src: string; alt?: string; width?: number | null; height?: number | null };

/** The site-wide facts every page shares: from Settings → General, Social and SEO. */
export type SeoSite = {
  name: string;
  /** Default share picture, used by pages that have none of their own */
  ogImage?: SeoImage;
  /** "@handle" for twitter:site, taken from the X profile address in the social settings */
  twitterSite?: string;
};

export type PageSeo = {
  site?: SeoSite;
  title: string;
  description: string;
  /** Path on this site, e.g. "/blog/webflow-or-next-js" (resolved against metadataBase) */
  path: string;
  /** Overrides the canonical link: a full https address (an article that first appeared elsewhere) */
  canonical?: string;
  image?: SeoImage;
  /** "article" for editorial pages (articles, case studies); everything else is "website" */
  article?: { publishedTime: string; modifiedTime?: string; authors?: string[]; section?: string };
  /** The article's tags, written as <meta name="keywords"> */
  keywords?: string[];
  /** Keeps the page out of search results (previews of unpublished content, or a page switched off in the SEO settings) */
  noindex?: boolean;
  /** Tells search engines not to follow the page's links. When not given it follows `noindex` (a page kept out of search results has its links ignored too). */
  nofollow?: boolean;
};

/** Text for a head tag: markup used in headlines (<em>…</em>) removed, whitespace collapsed. */
export const plain = (t: string): string => t.replace(/<\/?(em|b|strong|i)>/g, "").replace(/\s+/g, " ").trim();

/** Shortens at a word boundary with an ellipsis; text that already fits is returned unchanged. */
export function clip(text: string, max: number): string {
  const t = plain(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

/** "https://x.com/visuolab" → "@visuolab" (for twitter:site). Anything that is not a profile address gives undefined. */
export function twitterHandle(profileUrl: string): string | undefined {
  try {
    const u = new URL(profileUrl);
    if (!/(^|\.)(x|twitter)\.com$/i.test(u.hostname)) return undefined;
    const h = u.pathname.split("/").filter(Boolean)[0];
    return h && /^[A-Za-z0-9_]{1,15}$/.test(h) ? `@${h}` : undefined;
  } catch {
    return undefined;
  }
}

/** A path or address as an absolute https/http address on the given site. */
export const absoluteUrl = (siteUrl: string, pathOrUrl: string): string => (/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${siteUrl.replace(/\/+$/, "")}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`);

/** Title, description, canonical URL, robots, Open Graph and Twitter card for one page. */
export function pageMetadata({ site, title, description, path, canonical, image, article, keywords, noindex, nofollow }: PageSeo): Metadata {
  const t = plain(title);
  const d = plain(description);
  const pic = image ?? site?.ogImage;
  const images = pic ? [{ url: pic.src, alt: pic.alt || t, ...(pic.width && pic.height ? { width: pic.width, height: pic.height } : {}) }] : undefined;
  const url = canonical ?? path;
  return {
    title: t,
    description: d,
    alternates: { canonical: url },
    ...(keywords?.length ? { keywords } : {}),
    // indexable pages say so explicitly; previews and switched-off pages say noindex
    robots: { index: !noindex, follow: !(nofollow ?? noindex) },
    openGraph: {
      title: t,
      description: d,
      url,
      siteName: site?.name ?? "Visuolab",
      locale: "en_GB",
      ...(article
        ? { type: "article" as const, publishedTime: article.publishedTime, ...(article.modifiedTime ? { modifiedTime: article.modifiedTime } : {}), ...(article.authors?.length ? { authors: article.authors } : {}), ...(article.section ? { section: article.section } : {}) }
        : { type: "website" as const }),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: t,
      description: d,
      ...(site?.twitterSite ? { site: site.twitterSite } : {}),
      ...(images ? { images: images.map((i) => ({ url: i.url, alt: i.alt })) } : {}),
    },
  };
}
