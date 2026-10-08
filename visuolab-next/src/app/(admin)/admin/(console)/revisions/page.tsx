import Link from "@/components/site/ui/Link";
import { requireAdmin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { listRecentPageRevisions } from "@/lib/cms/store";
import { listRecentEntityRevisions } from "@/lib/server/entity-sections";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

/** The latest content changes of pages, services, case studies and articles, newest first. Each links to the section, where earlier versions can be restored. */
export default async function RevisionsPage() {
  await requireAdmin();
  const [pages, records] = await Promise.all([listRecentPageRevisions(getDb(), 50), listRecentEntityRevisions(50)]);
  const rows = [...pages, ...records].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 50);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Recent changes</h1>
          <p className="admin-sub">The latest changes to the content of pages, services, case studies and articles. Open a section to see its earlier versions and restore one.</p>
        </div>
      </div>
      <section className="form-card">
        {rows.length === 0 ? <p className="hint">No content has been changed yet.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Where</th><th scope="col">Section</th><th scope="col">What</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{when(r.at)}</td>
                    <td>{r.by ?? <small>unknown</small>}</td>
                    <td>{r.where}</td>
                    <td><Link href={r.href}><b>{r.section}</b></Link></td>
                    <td>{r.kind === "restore" ? <span className="badge">restore</span> : null} {r.changedFields.length ? r.changedFields.join(", ") : <small>changed</small>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
