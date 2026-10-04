import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogArticle from "@/components/site/blog/BlogArticle";
import { blogPosts, postBySlug } from "@/content/blog";
import { blogPostingJsonLd } from "@/lib/seo/jsonld";
import { pageMetadata } from "@/lib/seo/metadata";
import { getSiteUrl } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return blogPosts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = postBySlug((await params).slug);
  if (!p) return {};
  return pageMetadata({
    title: p.meta.title,
    description: p.meta.description,
    path: `/blog/${p.slug}`,
    image: { src: p.cover.src, alt: p.title },
    article: { publishedTime: p.publishedAt, authors: [p.author.name], section: p.category },
  });
}

export default async function BlogPostRoute({ params }: Props) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  const siteUrl = await getSiteUrl();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: blogPostingJsonLd(post, siteUrl) }} />
      <BlogArticle post={post} url={`${siteUrl}/blog/${post.slug}`} />
    </>
  );
}
