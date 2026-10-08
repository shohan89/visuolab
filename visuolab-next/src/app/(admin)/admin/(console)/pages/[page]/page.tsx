import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { setSectionVisibility } from "@/actions/cms-pages";
import PageSeoForm from "@/components/admin/PageSeoForm";
import { TEMPLATES, templateFromParam, templateSlug } from "@/lib/cms/registry";
import { requireAdmin } from "@/lib/server/auth";
import { adminSections, seoDefaults } from "@/lib/server/cms-admin";
import { mediaOptions } from "@/lib/server/services-admin";

export const dynamic = "force-dynamic";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Not saved yet");

export default async function PageAdmin({ params }: { params: Promise<{ page: string }> }) {
  await requireAdmin();
  const template = templateFromParam((await params).page);
  if (!template) notFound();
  const def = TEMPLATES[template];
  const { page, sections } = await adminSections(template);
  const [media, defaults] = await Promise.all([def.hasSeo && page ? mediaOptions() : Promise.resolve([]), seoDefaults(template)]);
  const base = `/admin/pages/${templateSlug(template)}`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{def.label} {page && <span className={`badge ${page.status}`}>{page.status}</span>}</h1>
          <p className="admin-sub"><Link href="/admin/pages">← All pages</Link>{def.route ? <> · <code>{def.route}</code></> : null}{def.hasSeo && page ? <> · SEO: {page.noindex ? "hidden from search" : page.seoTitle || page.seoDescription || page.ogImageId || page.canonicalUrl ? "custom" : "default"}</> : null}</p>
        </div>
        <div className="head-actions">
          {def.hasSeo && page && <a className="btn" href="#seo">Edit SEO</a>}
          {def.route && <a className="btn" href={def.route} target="_blank" rel="noopener">Preview ↗</a>}
        </div>
      </div>

      {!page && <p className="form-errors" role="status"><b>This page has no content in the database yet.</b> The website shows its built-in text. Run <code>npm run db:seed:pages:remote</code>, then edit it here.</p>}

      <h2 className="cards-title">Sections, in the order they appear on the page</h2>
      <p className="hint">The order and the design are fixed. Open a section to change its words, pictures and links.{sections.some((s) => s.canDisable) ? " Sections with a switch can be hidden without losing their content." : ""}</p>
      <ol className="section-cards">
        {sections.map((s, i) => (
          <li className={s.enabled ? "section-card" : "section-card is-off"} key={s.key}>
            <span className="sc-num" aria-hidden="true">{i + 1}</span>
            <div className="sc-main">
              <h3><Link href={`${base}/${s.key}`}>{s.name}</Link></h3>
              <p className="sc-meta">
                <span className="badge">{s.typeLabel}</span>
                {s.anchor && def.route ? <a href={`${def.route}#${s.anchor}`} target="_blank" rel="noopener">#{s.anchor}</a> : null}
                {s.damaged ? <span className="badge draft" title="The saved content no longer passes its checks; the website shows the built-in text.">needs fixing</span> : null}
              </p>
              <p className="sc-when">Last updated: {when(s.updatedAt)}</p>
            </div>
            <div className="sc-side">
              {s.canDisable ? (
                s.updatedAt ? (
                  <form action={setSectionVisibility} className="sc-switch">
                    <input type="hidden" name="template" value={template} />
                    <input type="hidden" name="key" value={s.key} />
                    <input type="hidden" name="enabled" value={s.enabled ? "0" : "1"} />
                    <button type="submit" className="switch" role="switch" aria-checked={s.enabled} aria-label={`${s.name}: ${s.enabled ? "shown on the website, click to hide" : "hidden, click to show"}`}><span aria-hidden="true" /></button>
                    <span className={s.enabled ? "badge published" : "badge draft"}>{s.enabled ? "Enabled" : "Disabled"}</span>
                  </form>
                ) : <span className="badge">Not in the database</span>
              ) : (
                <span className="sc-always" title="Other pages link to this section, or the page needs it."><span className="badge published">Enabled</span> <small>always</small></span>
              )}
              <Link className="btn primary" href={`${base}/${s.key}`}>Edit</Link>
            </div>
          </li>
        ))}
      </ol>

      {def.hasSeo && page && (
        <div id="seo">
          <PageSeoForm
            template={template}
            updatedAt={page.updatedAt}
            media={media}
            defaults={defaults}
            initial={{ seoTitle: page.seoTitle ?? "", seoDescription: page.seoDescription ?? "", ogImageId: page.ogImageId ?? "", canonicalUrl: page.canonicalUrl ?? "", noindex: page.noindex }}
          />
        </div>
      )}
    </>
  );
}
