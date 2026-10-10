import type { Metadata } from "next";
import BlogListing from "@/components/site/blog/BlogListing";
import PreviewBar from "@/components/site/PreviewBar";
import { enterPreview, requirePublished } from "@/lib/server/preview";
import JsonLd from "@/components/site/JsonLd";
import { getBlogCategories, getBlogPosts } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { getPage } from "@/lib/server/cms-pages";
import { fixedPageSeo } from "@/lib/server/seo";

// The list of articles and the words around it come from D1 at request time (the page CMS).
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

export default async function BlogRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const preview = await enterPreview(await searchParams);
  const [{ posts, topics, seo }, { content, enabled, page }] = await Promise.all([load(), getPage("blog")]);
  await requirePublished("blog", page?.status);
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      {preview && <PreviewBar what="Blog with its draft changes" back="/admin/pages/blog" />}
      <BlogListing posts={posts} topics={topics} hero={enabled.hero ? content.hero : null} featuredContent={enabled.featured ? content.featured : null} grid={enabled.grid ? content.grid : null} />
    </>
  );
}
