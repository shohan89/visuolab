import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { removeBlogPost, unpublishBlogPost } from "@/actions/blog";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { getPostRecord, postReferences, visibilityOf } from "@/lib/server/blog-admin";

export const dynamic = "force-dynamic";

/**
 * Take an article offline or delete it. A live article's address stops working, so this page lists what links to it and, when
 * anything does (or when a live article is deleted), asks for the slug to be typed. The action checks the same thing again.
 */
export default async function ConfirmArticlePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ do?: string; to?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const rec = await getPostRecord(id);
  if (!rec) notFound();
  const doing = sp.do === "delete" ? "delete" : "unpublish";
  const archive = doing === "unpublish" && sp.to === "archived";
  const { slug, title } = rec.input;
  const visibility = visibilityOf(rec.input.status, rec.publishedAt);
  const live = visibility === "live";
  const refs = await postReferences(slug, id);
  const needsTyping = doing === "delete" ? live || refs.length > 0 : live && refs.length > 0;
  const verb = doing === "delete" ? "Delete" : archive ? "Archive" : visibility === "scheduled" ? "Unschedule" : "Unpublish";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{verb} “{title}”?</h1>
          <p className="admin-sub"><Link href={`/admin/blog/${id}/edit`}>← Back to the article</Link></p>
        </div>
      </div>

      <section className={live || refs.length ? "form-card warn" : "form-card"}>
        {live ? (
          <p><b>This article is live.</b> After this, <code>/blog/{slug}</code> shows “page not found” to every visitor, and the article disappears from the Blog page{doing === "delete" ? ". It cannot be restored" : ", until you publish it again"}.</p>
        ) : (
          <p>This article is {visibility === "scheduled" ? "scheduled and not visible yet" : "not published, so no visitor can see it"}. {doing === "delete" ? "Deleting it cannot be undone." : "Nothing changes on the website."}</p>
        )}
        {refs.length > 0 && (
          <>
            <p><b>{refs.length === 1 ? "1 place links" : `${refs.length} places link`} to this article.</b> These will lose it or lead to a “page not found”:</p>
            <ul className="refs">{refs.map((r, i) => <li key={i}><b>{r.where}</b> — {r.detail}</li>)}</ul>
          </>
        )}
        <form action={doing === "delete" ? removeBlogPost : unpublishBlogPost} className="confirm-form">
          <input type="hidden" name="id" value={id} />
          {doing === "unpublish" && <input type="hidden" name="to" value={archive ? "archived" : "draft"} />}
          {needsTyping && (
            <div className="field">
              <label htmlFor="confirmSlug">To confirm, type the slug <code>{slug}</code></label>
              <input id="confirmSlug" name="confirmSlug" type="text" autoComplete="off" spellCheck={false} required pattern={slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} />
            </div>
          )}
          <div className="confirm-actions">
            <SubmitButton className={doing === "delete" ? "danger" : "primary"}>{verb} article</SubmitButton>
            <Link href={`/admin/blog/${id}/edit`}>Cancel</Link>
            {doing === "unpublish" && !archive && <Link href={`/admin/blog/${id}/confirm?do=unpublish&to=archived`}>Archive instead</Link>}
          </div>
        </form>
      </section>
    </>
  );
}
