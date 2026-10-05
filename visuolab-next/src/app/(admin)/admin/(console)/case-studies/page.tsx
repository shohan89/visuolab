import Link from "@/components/site/ui/Link";
import { publishCaseStudy, reorderCaseStudy, toggleFeatured } from "@/actions/case-studies";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { listCaseStudies, type CaseStatusFilter } from "@/lib/server/case-studies-admin";
import { DISCIPLINES } from "@/lib/validation/case-study";

export const dynamic = "force-dynamic";

const TABS: { key: CaseStatusFilter | "featured"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
  { key: "featured", label: "Featured" },
];
const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" });
const LABEL: Record<string, string> = { brand: "Brand", product: "Product", web: "Web", packaging: "Packaging", motion: "Motion" };

export default async function CaseStudiesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; discipline?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = (TABS.some((t) => t.key === sp.status) ? sp.status : "all") as CaseStatusFilter | "featured";
  const discipline = (DISCIPLINES as readonly string[]).includes(sp.discipline ?? "") ? sp.discipline : undefined;
  const q = (sp.q ?? "").slice(0, 100);
  const { items, counts } = await listCaseStudies({ q, status: tab === "featured" ? "all" : tab, featured: tab === "featured", discipline });
  const filtered = tab !== "all" || q.trim() !== "" || !!discipline;
  const href = (t: string) => `/admin/case-studies?${new URLSearchParams({ ...(t !== "all" ? { status: t } : {}), ...(q ? { q } : {}), ...(discipline ? { discipline } : {}) })}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Case studies</h1>
          <p className="admin-sub">The projects on the Works page. Published ones are live at /works/&lt;slug&gt;.</p>
        </div>
        <Link href="/admin/case-studies/new" className="btn primary">New case study</Link>
      </div>

      <form className="toolbar" action="/admin/case-studies" role="search">
        <input type="search" name="q" defaultValue={q} placeholder="Search by client, headline, slug or industry" aria-label="Search case studies" maxLength={100} />
        <select name="discipline" defaultValue={discipline ?? ""} aria-label="Filter by discipline">
          <option value="">All disciplines</option>
          {DISCIPLINES.map((d) => <option value={d} key={d}>{LABEL[d]}</option>)}
        </select>
        {tab !== "all" && <input type="hidden" name="status" value={tab} />}
        <button type="submit">Search</button>
        {(q || discipline) && <Link href={tab !== "all" ? `/admin/case-studies?status=${tab}` : "/admin/case-studies"}>Clear</Link>}
      </form>
      <nav className="tabs" aria-label="Filter by status">
        {TABS.map((t) => (
          <Link href={href(t.key)} aria-current={tab === t.key ? "page" : undefined} key={t.key}>{t.label} <i>{counts[t.key]}</i></Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="empty-state">
          <b>{filtered ? "No case studies match" : "No case studies yet"}</b>
          <p>{filtered ? "Try another search or filter." : "Create the first case study."}</p>
          {filtered ? <Link href="/admin/case-studies">Show all case studies</Link> : <Link href="/admin/case-studies/new" className="btn primary">New case study</Link>}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {!filtered && <th scope="col" className="col-order">Order</th>}
                <th scope="col">Case study</th>
                <th scope="col">Status</th>
                <th scope="col">Featured</th>
                <th scope="col" className="col-num">Images</th>
                <th scope="col">Updated</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => (
                <tr key={c.id}>
                  {!filtered && (
                    <td className="col-order">
                      <form action={reorderCaseStudy}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" name="dir" value="up" disabled={i === 0} aria-label={`Move ${c.clientName} up`}>↑</button>
                        <button type="submit" name="dir" value="down" disabled={i === items.length - 1} aria-label={`Move ${c.clientName} down`}>↓</button>
                      </form>
                    </td>
                  )}
                  <td>
                    <div className="cell-media">
                      <img className="thumb" src={c.imageUrl} alt="" width={64} height={48} loading="lazy" />
                      <div>
                        <Link href={`/admin/case-studies/${c.id}/edit`}><b>{c.clientName}</b></Link> <small>{c.year}</small>
                        <br /><small className="mono">/works/{c.slug}</small>
                        <br /><small>{c.typeLine}{c.filters.length ? ` · ${c.filters.map((f) => LABEL[f] ?? f).join(", ")}` : ""}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                  <td>
                    <form action={toggleFeatured}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className={c.featured ? "star on" : "star"} aria-label={c.featured ? `Remove ${c.clientName} from featured` : `Feature ${c.clientName}`} aria-pressed={c.featured} title={c.featured ? "Featured" : "Not featured"}>{c.featured ? "★" : "☆"}</button>
                    </form>
                  </td>
                  <td className="col-num">{c.images}</td>
                  <td>{when(c.updatedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Link href={`/admin/case-studies/${c.id}/edit`}>Edit</Link>
                      <a href={`/works/${c.slug}`} target="_blank" rel="noopener">{c.status === "published" ? "View" : "Preview"}</a>
                      {c.status === "published" ? (
                        <Link href={`/admin/case-studies/${c.id}/confirm?do=unpublish`}>Unpublish</Link>
                      ) : (
                        <form action={publishCaseStudy}>
                          <input type="hidden" name="id" value={c.id} />
                          <SubmitButton className="link">Publish</SubmitButton>
                        </form>
                      )}
                      <Link href={`/admin/case-studies/${c.id}/confirm?do=delete`} className="danger-link">Delete</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!filtered && items.length > 1 && <p className="hint">Order: the sequence of the cards on the Works page (and the order shown here).</p>}
    </>
  );
}
