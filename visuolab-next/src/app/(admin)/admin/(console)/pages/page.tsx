import Link from "@/components/site/ui/Link";
import { requireAdmin } from "@/lib/server/auth";
import { adminPages, adminSections } from "@/lib/server/cms-admin";
import { templateSlug } from "@/lib/cms/registry";
import type { PageSummary, SeoStatus } from "@/lib/cms/store";

export const dynamic = "force-dynamic";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" }) : "—");
const SEO: Record<SeoStatus, { label: string; cls: string; title: string }> = {
  custom: { label: "Custom", cls: "badge published", title: "The page has its own title, description or picture." },
  default: { label: "Default", cls: "badge", title: "Uses the defaults from Settings → SEO." },
  noindex: { label: "Hidden from search", cls: "badge draft", title: "Search engines are told to keep this page out." },
  nofollow: { label: "Links not followed", cls: "badge draft", title: "Search engines are asked not to follow this page's links." },
};

/** One row of the list. `services` is not a page of its own: /services sends visitors to the Services section of Home, so its row opens that section. */
type Row = { key: string; name: string; route: string; status: string; updatedAt: string | null; seo: SeoStatus | "via-home" | null; sections: number; hidden: number; drafts: number; content: string; seoHref: string; note?: string };

export default async function PagesAdmin() {
  await requireAdmin();
  const [pages, home] = await Promise.all([adminPages(), adminSections("home")]);
  const by = (t: string) => pages.find((p) => p.template === t) as PageSummary;
  const row = (p: PageSummary): Row => ({ key: p.template, name: p.label, route: p.route ?? "", status: p.status, updatedAt: p.updatedAt, seo: p.seo, sections: p.sections, hidden: p.hidden, drafts: p.drafts, content: `/admin/pages/${templateSlug(p.template)}`, seoHref: `/admin/pages/${templateSlug(p.template)}/seo` });
  const services = home.sections.find((s) => s.key === "services");
  const rows: Row[] = [
    row(by("home")),
    row(by("about")),
    { key: "services", name: "Services", route: "/services", status: by("home").status, updatedAt: services?.updatedAt ?? null, seo: "via-home", sections: 1, hidden: 0, drafts: services && home.sections.find((s) => s.key === "services")?.draft ? 1 : 0, content: "/admin/pages/home/services", seoHref: "/admin/pages/home/seo", note: "Opens the Services section of Home. The address /services leads there; each service page is edited under Services." },
    row(by("works")),
    row(by("blog")),
    row(by("contact")),
  ];
  const others = pages.filter((p) => !p.route);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pages</h1>
          <p className="admin-sub">The words, pictures and links of the website, section by section. The design, the order of the sections and the layout are fixed: you change what each section says. Service, case study and article pages are edited under their own menus.</p>
        </div>
      </div>
      {pages.some((p) => !p.seeded) && <p className="form-errors" role="status"><b>Some pages have no content in the database yet.</b> The website shows its built-in text for them. Run <code>npm run db:seed:pages:remote</code> to add it, then edit here.</p>}

      <section className="form-card">
        <div className="table-wrap">
          <table className="data pages-table">
            <thead><tr><th scope="col">Page</th><th scope="col">Route</th><th scope="col">Status</th><th scope="col">Last updated</th><th scope="col">SEO</th><th scope="col">Sections</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td><Link href={r.content}><b>{r.name}</b></Link>{r.note && <><br /><small>{r.note}</small></>}</td>
                  <td><code>{r.route}</code></td>
                  <td><span className={`badge ${r.status}`}>{r.status}</span>{r.drafts > 0 ? <> <span className="badge draft" title="Saved but not published. Visitors see the published version.">{r.drafts} draft {r.drafts === 1 ? "change" : "changes"}</span></> : null}</td>
                  <td>{when(r.updatedAt)}</td>
                  <td>{r.seo === "via-home" ? <small>Same as Home</small> : r.seo ? <span className={SEO[r.seo].cls} title={SEO[r.seo].title}>{SEO[r.seo].label}</span> : "—"}</td>
                  <td>{r.sections}{r.hidden > 0 ? <> · <span className="badge draft">{r.hidden} hidden</span></> : null}</td>
                  <td>
                    <div className="row-actions">
                      <Link className="btn" href={r.content}>Edit Content</Link>
                      <Link className="btn" href={r.seoHref}>Edit SEO</Link>
                      <a className="btn" href={r.route} target="_blank" rel="noopener">Preview ↗</a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="form-card">
        <h2>Content used on several pages</h2>
        <p className="hint">Not pages of their own. A change here shows wherever the content appears.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th scope="col">Name</th><th scope="col">Used on</th><th scope="col">Sections</th><th scope="col">Last updated</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {others.map((p) => (
                <tr key={p.template}>
                  <td><Link href={`/admin/pages/${templateSlug(p.template)}`}><b>{p.label}</b></Link></td>
                  <td><small>{p.template === "shared" ? "Every page: the closing call to action, the footer, the reviews, the logos" : p.template === "service_detail" ? "Every service page" : p.template === "case_study_detail" ? "Every case study" : "Every article"}</small></td>
                  <td>{p.sections}{p.hidden > 0 ? <> · <span className="badge draft">{p.hidden} hidden</span></> : null}</td>
                  <td>{when(p.updatedAt)}</td>
                  <td><div className="row-actions"><Link className="btn" href={`/admin/pages/${templateSlug(p.template)}`}>Edit Content</Link></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
