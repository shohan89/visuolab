import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { publishBlogPost } from "@/actions/blog";
import BlogForm from "@/components/admin/BlogForm";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { allTagTitles, categoryOptions, getPostRecord, otherPosts, visibilityOf } from "@/lib/server/blog-admin";
import { getEnv } from "@/lib/server/db";
import { mediaOptions } from "@/lib/server/services-admin";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = (await params).id;
  const rec = await getPostRecord(id);
  if (!rec) notFound();
  const [media, categories, others, tagSuggestions] = await Promise.all([mediaOptions(), categoryOptions(), otherPosts(id), allTagTitles()]);
  const { input } = rec;
  const visibility = visibilityOf(input.status, rec.publishedAt);
  const future = !!input.publishedAt && `${input.publishedAt}:00.000Z` > new Date().toISOString();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{input.title} <span className={`badge ${visibility === "live" ? "published" : visibility}`}>{visibility === "live" ? "published" : visibility}</span>{input.featured ? <span className="badge published">featured</span> : null}</h1>
          <p className="admin-sub">
            <Link href="/admin/blog">← All articles</Link> · last saved {when(rec.updatedAt)}
            {rec.publishedAt && visibility === "live" ? ` · published ${when(rec.publishedAt)}` : ""}
            {visibility === "scheduled" && rec.publishedAt ? ` · goes live ${when(rec.publishedAt)}` : ""}
          </p>
        </div>
        <div className="head-actions">
          <a className="btn" href={`/blog/${input.slug}`} target="_blank" rel="noopener">{visibility === "live" ? "View article" : "Preview"} ↗</a>
          {visibility === "live" || visibility === "scheduled" ? (
            <Link className="btn" href={`/admin/blog/${rec.id}/confirm?do=unpublish`}>{visibility === "live" ? "Unpublish…" : "Unschedule…"}</Link>
          ) : (
            <form action={publishBlogPost}>
              <input type="hidden" name="id" value={rec.id} />
              <input type="hidden" name="back" value="edit" />
              <SubmitButton className="primary">{future ? "Schedule" : "Publish"}</SubmitButton>
            </form>
          )}
        </div>
      </div>
      <p className="hint">Publishing and scheduling use the last <b>saved</b> version. Save your changes first.</p>
      <BlogForm id={rec.id} initial={input} visibility={visibility} media={media} categories={categories} others={others} tagSuggestions={tagSuggestions} origin={getEnv().SITE_URL ?? ""} />
      <section className="form-card danger-zone" id="danger">
        <h2>Delete this article</h2>
        <p>Removes the article for good. Its tags stay available for other articles.</p>
        <Link className="btn danger" href={`/admin/blog/${rec.id}/confirm?do=delete`}>Delete…</Link>
      </section>
    </>
  );
}
