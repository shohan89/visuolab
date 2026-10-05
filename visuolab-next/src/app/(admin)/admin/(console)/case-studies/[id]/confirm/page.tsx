import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { removeCaseStudy, unpublishCaseStudy } from "@/actions/case-studies";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { caseReferences, getCaseRecord } from "@/lib/server/case-studies-admin";

export const dynamic = "force-dynamic";

/**
 * Hide or delete a case study. Taking a published page away makes its address stop working, so this page lists what links to it and,
 * when anything does (or when a published page is deleted), asks for the slug to be typed. The action checks the same thing again.
 */
export default async function ConfirmCaseStudyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ do?: string; to?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const rec = await getCaseRecord(id);
  if (!rec) notFound();
  const doing = sp.do === "delete" ? "delete" : "unpublish";
  const archive = doing === "unpublish" && sp.to === "archived";
  const { slug, clientName, status } = rec.input;
  const refs = await caseReferences(slug, id);
  const live = status === "published";
  const needsTyping = doing === "delete" ? live || refs.length > 0 : refs.length > 0;
  const verb = doing === "delete" ? "Delete" : archive ? "Archive" : "Unpublish";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{verb} “{clientName}”?</h1>
          <p className="admin-sub"><Link href={`/admin/case-studies/${id}/edit`}>← Back to the case study</Link></p>
        </div>
      </div>

      <section className={live || refs.length ? "form-card warn" : "form-card"}>
        {live ? (
          <p><b>This page is live.</b> After this, <code>/works/{slug}</code> shows “page not found” to every visitor, and the card disappears from the Works page{doing === "delete" ? ". It cannot be restored" : ", until you publish it again"}.</p>
        ) : (
          <p>This case study is not published, so no visitor can see it now. {doing === "delete" ? "Deleting it cannot be undone." : "Nothing changes on the website."}</p>
        )}
        {refs.length > 0 && (
          <>
            <p><b>{refs.length === 1 ? "1 place links" : `${refs.length} places link`} to this page.</b> These will lose the project or lead to a “page not found”:</p>
            <ul className="refs">
              {refs.map((r, i) => <li key={i}><b>{r.where}</b> — {r.detail}</li>)}
            </ul>
          </>
        )}

        <form action={doing === "delete" ? removeCaseStudy : unpublishCaseStudy} className="confirm-form">
          <input type="hidden" name="id" value={id} />
          {doing === "unpublish" && <input type="hidden" name="to" value={archive ? "archived" : "draft"} />}
          {needsTyping && (
            <div className="field">
              <label htmlFor="confirmSlug">To confirm, type the slug <code>{slug}</code></label>
              <input id="confirmSlug" name="confirmSlug" type="text" autoComplete="off" spellCheck={false} required pattern={slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} />
            </div>
          )}
          <div className="confirm-actions">
            <SubmitButton className={doing === "delete" ? "danger" : "primary"}>{verb} case study</SubmitButton>
            <Link href={`/admin/case-studies/${id}/edit`}>Cancel</Link>
            {doing === "unpublish" && !archive && <Link href={`/admin/case-studies/${id}/confirm?do=unpublish&to=archived`}>Archive instead</Link>}
          </div>
        </form>
      </section>
    </>
  );
}
