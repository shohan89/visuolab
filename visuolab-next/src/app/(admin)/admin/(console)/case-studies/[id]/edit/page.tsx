import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { publishCaseStudy } from "@/actions/case-studies";
import CaseStudyForm from "@/components/admin/CaseStudyForm";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { workingRecord } from "@/lib/server/entity-sections";
import { getCaseRecord, otherCases, serviceOptions } from "@/lib/server/case-studies-admin";
import { getEnv } from "@/lib/server/db";
import { mediaOptions } from "@/lib/server/services-admin";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function EditCaseStudyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = (await params).id;
  const rec = await getCaseRecord(id);
  if (!rec) notFound();
  const [media, others, services] = await Promise.all([mediaOptions(), otherCases(id), serviceOptions()]);
  const working = await workingRecord("case_study", id); // the published record with its draft changes applied: what the form edits
  const input = (working?.input ?? rec.input) as typeof rec.input;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{input.clientName} <span className={`badge ${input.status}`}>{input.status}</span>{input.featured ? <span className="badge published">featured</span> : null}</h1>
          <p className="admin-sub">
            <Link href="/admin/case-studies">← All case studies</Link> · <Link href={`/admin/case-studies/${rec.id}`}>Edit by section</Link> · last saved {when(rec.updatedAt)}
            {rec.publishedAt && input.status === "published" ? ` · published ${when(rec.publishedAt)}` : ""}
          </p>
        </div>
        <div className="head-actions">
          <a className="btn" href={`/works/${input.slug}`} target="_blank" rel="noopener">{input.status === "published" ? "View page" : "Preview"} ↗</a>
          {input.status === "published" ? (
            <Link className="btn" href={`/admin/case-studies/${rec.id}/confirm?do=unpublish`}>Unpublish…</Link>
          ) : (
            <form action={publishCaseStudy}>
              <input type="hidden" name="id" value={rec.id} />
              <input type="hidden" name="back" value="edit" />
              <SubmitButton className="primary">Publish</SubmitButton>
            </form>
          )}
        </div>
      </div>
      <p className="hint">Publishing uses the last <b>saved</b> version. Save your changes first.</p>
      <CaseStudyForm id={rec.id} initial={input} media={media} others={others} services={services} origin={getEnv().SITE_URL ?? ""} />
      <section className="form-card danger-zone" id="danger">
        <h2>Delete this case study</h2>
        <p>Removes the case study and its image list for good. The pictures stay in the media library, and service pages stop showing the card.</p>
        <Link className="btn danger" href={`/admin/case-studies/${rec.id}/confirm?do=delete`}>Delete…</Link>
      </section>
    </>
  );
}
