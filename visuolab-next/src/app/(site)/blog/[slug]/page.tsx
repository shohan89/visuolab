import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import BlogArticle from "@/components/site/blog/BlogArticle";
import { getAdmin } from "@/lib/server/auth";
import { getBlogPostBySlug, getSlugRedirect } from "@/lib/server/cms";
import { getDb } from "@/lib/server/db";
import { blogBreadcrumbJsonLd, blogPostingJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load((await params).slug);
  if (!("post" in found) || !found.post) return {};
  const p = found.post;
  return pageMetadata({
    title: p.meta.title,
    description: p.meta.description,
    path: `/blog/${p.slug}`,
    canonical: p.canonicalUrl,
    image: { src: p.ogImage?.src ?? p.cover.src, alt: p.cover.alt || p.title },
    article: { publishedTime: p.publishedAtIso ?? p.publishedAt, modifiedTime: p.updatedAtIso, authors: [p.author.name], section: p.category },
    keywords: p.tags,
    noindex: found.preview, // a preview is not a public page
  });
}

export default async function BlogPostRoute({ params }: Props) {
  const found = await load((await params).slug);
  if ("redirectTo" in found && found.redirectTo) permanentRedirect(`/blog/${found.redirectTo}`);
  if (!("post" in found) || !found.post) notFound();
  const { post, related } = found;
  const siteUrl = await getSiteUrl();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: blogPostingJsonLd(post, siteUrl) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: blogBreadcrumbJsonLd(post, siteUrl) }} />
      <BlogArticle post={post} related={related} url={`${siteUrl}/blog/${post.slug}`} />
    </>
  );
}
