import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { removeService, unpublishService } from "@/actions/services";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { getServiceRecord, serviceReferences } from "@/lib/server/services-admin";

export const dynamic = "force-dynamic";

/**
 * Hide or delete a service. Taking a published page away makes its address stop working, so this page lists what links to it and,
 * when anything does (or when a published page is deleted), asks for the slug to be typed. The action checks the same thing again.
 */
export default async function ConfirmServicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ do?: string; to?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const rec = await getServiceRecord(id);
  if (!rec) notFound();
  const doing = sp.do === "delete" ? "delete" : "unpublish";
  const archive = doing === "unpublish" && sp.to === "archived";
  const { slug, title, status } = rec.input;
  const refs = await serviceReferences(slug, id);
  const live = status === "published";
  const needsTyping = doing === "delete" ? live || refs.length > 0 : refs.length > 0;
  const breaks = live; // a published page's address stops working
  const verb = doing === "delete" ? "Delete" : archive ? "Archive" : "Unpublish";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{verb} “{title}”?</h1>
          <p className="admin-sub"><Link href={`/admin/services/${id}/edit`}>← Back to the service</Link></p>
        </div>
      </div>

      <section className={breaks || refs.length ? "form-card warn" : "form-card"}>
        {breaks ? (
          <p><b>This page is live.</b> After this, <code>/services/{slug}</code> shows “page not found” to every visitor{doing === "delete" ? ", and the service cannot be restored" : ", until you publish it again"}.</p>
        ) : (
          <p>This service is not published, so no visitor can see it now. {doing === "delete" ? "Deleting it cannot be undone." : "Nothing changes on the website."}</p>
        )}
        {refs.length > 0 && (
          <>
            <p><b>{refs.length === 1 ? "1 place links" : `${refs.length} places link`} to this page.</b> These links will lead to a “page not found”:</p>
            <ul className="refs">
              {refs.map((r, i) => <li key={i}><b>{r.where}</b> — {r.detail}</li>)}
            </ul>
          </>
        )}
        {!breaks && refs.length === 0 && doing === "unpublish" && <p>This service is already hidden.</p>}

        <form action={doing === "delete" ? removeService : unpublishService} className="confirm-form">
          <input type="hidden" name="id" value={id} />
          {doing === "unpublish" && <input type="hidden" name="to" value={archive ? "archived" : "draft"} />}
          {needsTyping && (
            <div className="field">
              <label htmlFor="confirmSlug">To confirm, type the slug <code>{slug}</code></label>
              <input id="confirmSlug" name="confirmSlug" type="text" autoComplete="off" spellCheck={false} required pattern={slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} />
            </div>
          )}
          <div className="confirm-actions">
            <SubmitButton className={doing === "delete" ? "danger" : "primary"}>{verb} service</SubmitButton>
            <Link href={`/admin/services/${id}/edit`}>Cancel</Link>
            {doing === "unpublish" && !archive && <Link href={`/admin/services/${id}/confirm?do=unpublish&to=archived`}>Archive instead</Link>}
          </div>
        </form>
      </section>
    </>
  );
}
