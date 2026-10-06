import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import BlogArticle from "@/components/site/blog/BlogArticle";
import { getAdmin } from "@/lib/server/auth";
import { getBlogPostBySlug, getSlugRedirect } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import JsonLd from "@/components/site/JsonLd";
import { blogPostSeo } from "@/lib/server/seo";
import { getSiteUrl } from "@/lib/site";

// Articles come from D1 at request time, so scheduled articles appear by themselves when their publish time passes.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

/** Live articles for everybody; drafts, scheduled and archived ones only as a preview for a signed-in admin. */
async function load(slug: string) {
  const db = getDb();
  const live = await getBlogPostBySlug(db, slug);
  if (live) return { ...live, preview: false };
  const redirectTo = await getSlugRedirect(db, "blog_post", slug);
  if (redirectTo) return { redirectTo };
  if (await getAdmin()) {
    const preview = await getBlogPostBySlug(db, slug, { includeUnpublished: true });
    if (preview) return { ...preview, preview: true };
  }
  return {};
}

/** Title, description, canonical (or the original address), Open Graph, Twitter and robots from the article row; a preview is not a public page (noindex). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).slug);
  if (!("post" in found) || !found.post) return {};
  return (await blogPostSeo(found.post, found.preview)).metadata;
}

export default async function BlogPostRoute({ params }: Props) {
  const found = await load((await params).slug);
  if ("redirectTo" in found && found.redirectTo) permanentRedirect(`/blog/${found.redirectTo}`);
  if (!("post" in found) || !found.post) notFound();
  const { post, related } = found;
  const [siteUrl, seo] = await Promise.all([getSiteUrl(), blogPostSeo(post, found.preview)]);
  return (
    <>
      <JsonLd nodes={seo.jsonLd} />
      <BlogArticle post={post} related={related} url={`${siteUrl}/blog/${post.slug}`} />
    </>
  );
}
