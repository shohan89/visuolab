import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { removeMedia, saveMedia } from "@/actions/media";
import { CopyUrl, ReplaceFile } from "@/components/admin/LibraryActions";
import { formatBytes } from "@/components/admin/media-types";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { getMedia, mediaUsage } from "@/lib/server/media";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function MediaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const m = await getMedia(id);
  if (!m) notFound();
  const usage = await mediaUsage(id);
  const canDelete = m.storage === "r2" && usage.length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{m.title}</h1>
          <p className="admin-sub"><Link href="/admin/media">← Media library</Link> · {m.storage === "r2" ? "uploaded, stored in R2" : "shipped with the website"}</p>
        </div>
      </div>

      <div className="media-detail">
        <section className="form-card md-preview">
          {m.kind === "image" ? <img src={m.publicUrl} alt={m.altText} width={m.width ?? undefined} height={m.height ?? undefined} /> : <span className="media-none">{m.kind}</span>}
        </section>

        <div>
          <section className="form-card">
            <h2>Details</h2>
            <form action={saveMedia}>
              <input type="hidden" name="id" value={m.id} />
              <div className="field"><label htmlFor="m-title">Title</label><input id="m-title" name="title" type="text" defaultValue={m.title} required maxLength={120} /></div>
              <div className="field"><label htmlFor="m-alt">Description for screen readers (alt text)</label><input id="m-alt" name="alt" type="text" defaultValue={m.altText} maxLength={200} /><p className="hint">Describe what the picture shows. Pages can override it where they use the file.</p></div>
              <div className="field"><label htmlFor="m-caption">Caption</label><input id="m-caption" name="caption" type="text" defaultValue={m.caption} maxLength={200} /></div>
              <div className="confirm-actions"><SubmitButton className="primary">Save details</SubmitButton></div>
            </form>
          </section>

          <section className="form-card">
            <h2>File</h2>
            <dl className="facts">
              <div><dt>Type</dt><dd>{m.mime}</dd></div>
              <div><dt>Size</dt><dd>{formatBytes(m.bytes)}{m.bytes ? ` (${m.bytes.toLocaleString("en-GB")} bytes)` : ""}</dd></div>
              <div><dt>Dimensions</dt><dd>{m.width && m.height ? `${m.width} × ${m.height} px` : "—"}</dd></div>
              <div><dt>Original name</dt><dd>{m.originalName ?? "—"}</dd></div>
              <div><dt>Uploaded</dt><dd>{when(m.createdAt)}</dd></div>
              <div><dt>Last changed</dt><dd>{when(m.updatedAt)}</dd></div>
              <div><dt>Address</dt><dd><code>{m.publicUrl}</code> <CopyUrl url={m.publicUrl} /></dd></div>
            </dl>
            <ReplaceFile id={m.id} canReplace={m.kind === "image"} />
          </section>

          <section className="form-card">
            <h2>Where it is used</h2>
            {usage.length === 0 ? <p className="hint">Nothing uses this file at the moment.</p> : (
              <ul className="refs">{usage.map((u, i) => <li key={i}><b>{u.where}</b> — {u.detail}</li>)}</ul>
            )}
          </section>

          <section className="form-card danger-zone">
            <h2>Delete</h2>
            {m.storage !== "r2" ? (
              <p>This file ships with the website and cannot be deleted here. You can replace it above.</p>
            ) : usage.length > 0 ? (
              <p>This file is used by {usage.length === 1 ? "1 item" : `${usage.length} items`}. Replace it where it is used, or replace the file itself, before deleting it.</p>
            ) : (
              <form action={removeMedia}>
                <input type="hidden" name="id" value={m.id} />
                <p>Removes the file from storage for good. It is not used anywhere.</p>
                <SubmitButton className="danger" confirm={`Delete “${m.title}” for good?`}>Delete file</SubmitButton>
              </form>
            )}
            {!canDelete && null}
          </section>
        </div>
      </div>
    </>
  );
}
