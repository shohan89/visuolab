import Link from "@/components/site/ui/Link";
import BlogForm from "@/components/admin/BlogForm";
import { requireAdmin } from "@/lib/server/auth";
import { allTagTitles, categoryOptions, otherPosts } from "@/lib/server/blog-admin";
import { getEnv } from "@/lib/server/db";
import { mediaOptions } from "@/lib/server/services-admin";
import type { BlogInput } from "@/lib/validation/blog";

export const dynamic = "force-dynamic";

/** Starting values for a new article. */
const EMPTY: BlogInput = {
  title: "", slug: "", status: "draft", featured: false, categoryId: "", tags: [], excerpt: "", lead: "",
  blocks: [{ type: "paragraph", text: "" }],
  outro: { before: "Working on something like this?", linkText: "Tell us about it", href: "/contact", after: " — we answer within a day." },
  related: [], coverImage: "", coverAlt: "", ogImage: "", canonicalUrl: "", metaTitle: "", metaDescription: "", authorName: "", authorImage: "", readMinutes: null, publishedAt: "",
};

export default async function NewArticlePage() {
  await requireAdmin();
  const [media, categories, others, tagSuggestions] = await Promise.all([mediaOptions(), categoryOptions(), otherPosts(), allTagTitles()]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>New article</h1>
          <p className="admin-sub"><Link href="/admin/blog">← All articles</Link></p>
        </div>
      </div>
      <BlogForm initial={EMPTY} visibility="draft" media={media} categories={categories} others={others} tagSuggestions={tagSuggestions} origin={getEnv().SITE_URL ?? ""} />
    </>
  );
}
