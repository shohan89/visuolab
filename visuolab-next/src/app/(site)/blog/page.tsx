import type { Metadata } from "next";
import BlogListing from "@/components/site/blog/BlogListing";
import JsonLd from "@/components/site/JsonLd";
import { getBlogCategories, getBlogPosts } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { fixedPageSeo } from "@/lib/server/seo";

// The list of articles comes from D1 at request time.
export const dynamic = "force-dynamic";

/** The blog page's share picture is the featured (or newest) article's; its structured data lists the live articles. */
async function load() {
  const db = getDb();
  const [posts, topics] = await Promise.all([getBlogPosts(db, { publishedOnly: true }), getBlogCategories(db)]);
  const lead = posts.find((p) => p.featured) ?? posts[0];
  const seo = await fixedPageSeo("blog", { image: lead ? { src: lead.ogImage?.src ?? lead.cover.src, alt: lead.cover.alt || lead.title } : undefined, items: posts.map((p) => ({ name: p.title, path: `/blog/${p.slug}` })) });
  return { posts, topics, seo };
}

export async function generateMetadata(): Promise<Metadata> {
  return (await load()).seo.metadata;
}

export default async function BlogRoute() {
  const { posts, topics, seo } = await load();
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      <BlogListing posts={posts} topics={topics} />
    </>
  );
}
