import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

type PageSeo = {
  title: string;
  description: string;
  /** Path on this site, e.g. "/blog/webflow-or-next-js" (resolved against metadataBase) */
  path: string;
  /** Overrides the canonical link: a full https address (an article that first appeared elsewhere) */
  canonical?: string;
  /** Social image path or URL (resolved against metadataBase) */
  image?: { src: string; alt?: string };
  article?: { publishedTime: string; modifiedTime?: string; authors: string[]; section: string };
  /** The article's tags, written as <meta name="keywords"> */
  keywords?: string[];
  /** Keeps the page out of search results (previews of unpublished content) */
  noindex?: boolean;
};

/** Title, description, canonical URL, Open Graph and Twitter card for one page. Head tags only; no visual effect. */
export function pageMetadata({ title, description, path, canonical, image, article, keywords, noindex }: PageSeo): Metadata {
  const images = image ? [{ url: image.src, alt: image.alt || title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: canonical ?? path },
    ...(keywords?.length ? { keywords } : {}),
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      url: canonical ?? path,
      siteName: SITE_NAME,
      locale: "en_GB",
      ...(article
        ? { type: "article" as const, publishedTime: article.publishedTime, ...(article.modifiedTime ? { modifiedTime: article.modifiedTime } : {}), authors: article.authors, section: article.section }
        : { type: "website" as const }),
      ...(images ? { images } : {}),
    },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}
