import type { Metadata } from "next";
import BlogListing from "@/components/site/blog/BlogListing";
import { blogMeta, blogOrder, postBySlug } from "@/content/blog";
import { pageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  const latest = postBySlug(blogOrder[0] ?? "");
  return pageMetadata({
    title: blogMeta.title,
    description: blogMeta.description,
    path: "/blog",
    image: latest ? { src: latest.cover.src, alt: latest.title } : undefined,
  });
}

export default function BlogRoute() {
  return <BlogListing />;
}
