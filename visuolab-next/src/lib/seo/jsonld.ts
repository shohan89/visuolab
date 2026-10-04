import type { BlogPost } from "@/content/types";
import { SITE_NAME } from "@/lib/site";

/** schema.org BlogPosting for an article, serialised for a JSON-LD script ("<" is escaped so the text cannot close the tag). */
export function blogPostingJsonLd(post: BlogPost, siteUrl: string): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.meta.description,
    image: `${siteUrl}${post.cover.src}`,
    datePublished: post.publishedAt,
    articleSection: post.category,
    author: { "@type": "Person", name: post.author.name },
    publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${siteUrl}/assets/logo.png` } },
    mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
  };
  return JSON.stringify(data).replace(/</g, "\u003c");
}
