import type { Metadata } from "next";
import BlogListing from "@/components/site/blog/BlogListing";
import { getBlogCategories, getBlogPosts } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { pageMetadata } from "@/lib/seo/metadata";

// The list of articles comes from D1 at request time.
export const dynamic = "force-dynamic";

const TITLE = "Blog — Visuolab";
const DESCRIPTION = "Notes on brand, product, web and motion design from the Visuolab studio — what we ship, what we learn and what we would do differently.";

export async function generateMetadata(): Promise<Metadata> {
  const posts = await getBlogPosts(getDb(), { publishedOnly: true });
  const latest = posts.find((p) => p.featured) ?? posts[0];
  return pageMetadata({ title: TITLE, description: DESCRIPTION, path: "/blog", image: latest ? { src: latest.ogImage?.src ?? latest.cover.src, alt: latest.title } : undefined });
}

export default async function BlogRoute() {
  const db = getDb();
  const [posts, topics] = await Promise.all([getBlogPosts(db, { publishedOnly: true }), getBlogCategories(db)]);
  return <BlogListing posts={posts} topics={topics} />;
}
