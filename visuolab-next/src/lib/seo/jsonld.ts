import type { BlogPost } from "@/content/types";
import { SITE_NAME } from "@/lib/site";

/** Serialise for a JSON-LD script: "<" is escaped so the text can never close the tag, whatever an editor typed. */
const toScript = (data: unknown) => JSON.stringify(data).replace(/</g, "\u003c");

const absolute = (siteUrl: string, src: string) => (/^https?:\/\//.test(src) ? src : `${siteUrl}${src}`);

/** schema.org BlogPosting for an article. */
export function blogPostingJsonLd(post: BlogPost, siteUrl: string): string {
  const url = `${siteUrl}/blog/${post.slug}`;
  return toScript({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta.description,
    image: absolute(siteUrl, post.ogImage?.src ?? post.cover.src),
    datePublished: post.publishedAtIso ?? post.publishedAt,
    ...(post.updatedAtIso ? { dateModified: post.updatedAtIso } : {}),
    articleSection: post.category,
    ...(post.tags?.length ? { keywords: post.tags.join(", ") } : {}),
    inLanguage: "en-GB",
    author: { "@type": "Person", name: post.author.name },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${siteUrl}/assets/logo.png` } },
    mainEntityOfPage: post.canonicalUrl ?? url,
  });
}

/** schema.org BreadcrumbList: Home / Blog / Article. */
export function blogBreadcrumbJsonLd(post: BlogPost, siteUrl: string): string {
  return toScript({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${siteUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${siteUrl}/blog/${post.slug}` },
    ],
  });
}
