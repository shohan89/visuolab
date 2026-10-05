import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { publishService } from "@/actions/services";
import ServiceForm from "@/components/admin/ServiceForm";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { getEnv } from "@/lib/server/db";
import { caseOptions, getServiceRecord, mediaOptions } from "@/lib/server/services-admin";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const rec = await getServiceRecord((await params).id);
  if (!rec) notFound();
  const [media, cases] = await Promise.all([mediaOptions(), caseOptions()]);
  const { input } = rec;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{input.title} <span className={`badge ${input.status}`}>{input.status}</span></h1>
          <p className="admin-sub">
            <Link href="/admin/services">← All services</Link> · last saved {when(rec.updatedAt)}
            {rec.publishedAt && input.status === "published" ? ` · published ${when(rec.publishedAt)}` : ""}
          </p>
        </div>
        <div className="head-actions">
          <a className="btn" href={`/services/${input.slug}`} target="_blank" rel="noopener">{input.status === "published" ? "View page" : "Preview"} ↗</a>
          {input.status === "published" ? (
            <Link className="btn" href={`/admin/services/${rec.id}/confirm?do=unpublish`}>Unpublish…</Link>
          ) : (
            <form action={publishService}>
              <input type="hidden" name="id" value={rec.id} />
              <input type="hidden" name="back" value="edit" />
              <SubmitButton className="primary">Publish</SubmitButton>
            </form>
          )}
        </div>
      </div>
      <p className="hint">Publishing uses the last <b>saved</b> version. Save your changes first.</p>
      <ServiceForm id={rec.id} initial={input} media={media} cases={cases} origin={getEnv().SITE_URL ?? ""} />
      <section className="form-card danger-zone" id="danger">
        <h2>Delete this service</h2>
        <p>Removes the service for good. Its case study links are removed; the case studies themselves stay.</p>
        <Link className="btn danger" href={`/admin/services/${rec.id}/confirm?do=delete`}>Delete…</Link>
      </section>
    </>
  );
}
