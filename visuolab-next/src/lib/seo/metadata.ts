import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

type PageSeo = {
  title: string;
  description: string;
  /** Path on this site, e.g. "/blog/webflow-or-next-js" (resolved against metadataBase) */
  path: string;
  /** Social image path or URL (resolved against metadataBase) */
  image?: { src: string; alt?: string };
  article?: { publishedTime: string; authors: string[]; section: string };
};

/** Title, description, canonical URL, Open Graph and Twitter card for one page. Head tags only; no visual effect. */
export function pageMetadata({ title, description, path, image, article }: PageSeo): Metadata {
  const images = image ? [{ url: image.src, alt: image.alt || title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_GB",
      ...(article ? { type: "article" as const, publishedTime: article.publishedTime, authors: article.authors, section: article.section } : { type: "website" as const }),
      ...(images ? { images } : {}),
    },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}
