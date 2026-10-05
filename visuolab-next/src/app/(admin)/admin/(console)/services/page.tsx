import Link from "@/components/site/ui/Link";
import { publishService, reorderService } from "@/actions/services";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { listServices, type StatusFilter } from "@/lib/server/services-admin";

export const dynamic = "force-dynamic";

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
];
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" });

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (TABS.some((t) => t.key === sp.status) ? sp.status : "all") as StatusFilter;
  const q = (sp.q ?? "").slice(0, 100);
  const { items, counts } = await listServices({ q, status });
  const filtered = status !== "all" || q.trim() !== "";
  const href = (s: StatusFilter) => `/admin/services?${new URLSearchParams({ ...(s !== "all" ? { status: s } : {}), ...(q ? { q } : {}) })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Services</h1>
          <p className="admin-sub">The service pages of the website. Published ones are live at /services/&lt;slug&gt;.</p>
        </div>
        <Link href="/admin/services/new" className="btn primary">New service</Link>
      </div>

      <form className="toolbar" action="/admin/services" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Search by name or slug" aria-label="Search services" maxLength={100} />
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <button type="submit">Search</button>
        {q && <Link href={status !== "all" ? `/admin/services?status=${status}` : "/admin/services"}>Clear</Link>}
      </form>
      <nav className="tabs" aria-label="Filter by status">
        {TABS.map((t) => (
          <Link href={href(t.key)} aria-current={status === t.key ? "page" : undefined} key={t.key}>{t.label} <i>{counts[t.key]}</i></Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="empty-state">
          <b>{filtered ? "No services match" : "No services yet"}</b>
          <p>{filtered ? "Try another search or filter." : "Create the first service page."}</p>
          {filtered ? <Link href="/admin/services">Show all services</Link> : <Link href="/admin/services/new" className="btn primary">New service</Link>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {!filtered && <th scope="col" className="col-order">Order</th>}
                <th scope="col">Service</th>
                <th scope="col">Status</th>
                <th scope="col" className="col-num">Cases</th>
                <th scope="col">Updated</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((s, i) => (
                <tr key={s.id}>
                  {!filtered && (
                    <td className="col-order">
                      <form action={reorderService}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" name="dir" value="up" disabled={i === 0} aria-label={`Move ${s.title} up`}>↑</button>
                        <button type="submit" name="dir" value="down" disabled={i === items.length - 1} aria-label={`Move ${s.title} down`}>↓</button>
                      </form>
                    </td>
                  )}
                  <td>
                    <Link href={`/admin/services/${s.id}/edit`}><b>{s.title}</b></Link>
                    <br /><small className="mono">/services/{s.slug}</small>
                  </td>
                  <td><span className={`badge ${s.status}`}>{s.status}</span></td>
                  <td className="col-num">{s.caseCount}</td>
                  <td>{when(s.updatedAt)}</td>
                  <td><div className="row-actions">
                    <Link href={`/admin/services/${s.id}/edit`}>Edit</Link>
                    <a href={`/services/${s.slug}`} target="_blank" rel="noopener">{s.status === "published" ? "View" : "Preview"}</a>
                    {s.status === "published" ? (
                      <Link href={`/admin/services/${s.id}/confirm?do=unpublish`}>Unpublish</Link>
                    ) : (
                      <form action={publishService}>
                        <input type="hidden" name="id" value={s.id} />
                        <SubmitButton className="link">Publish</SubmitButton>
                      </form>
                    )}
                    <Link href={`/admin/services/${s.id}/confirm?do=delete`} className="danger-link">Delete</Link>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!filtered && items.length > 1 && <p className="hint">Order: the sequence the services are listed in here. (The website’s menus are not generated from this order yet.)</p>}
    </>
  );
}
