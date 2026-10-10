import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { discardPageAction, publishPageAction, setPageStatusAction, setSectionVisibility } from "@/actions/cms-pages";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import { hasDrafts } from "@/lib/cms/store";
import SectionSwitch from "@/components/admin/SectionSwitch";
import { TEMPLATES, templateFromParam, templateSlug } from "@/lib/cms/registry";
import { requireAdmin } from "@/lib/server/auth";
import { adminSections } from "@/lib/server/cms-admin";

export const dynamic = "force-dynamic";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Not saved yet");

export default async function PageAdmin({ params }: { params: Promise<{ page: string }> }) {
  await requireAdmin();
  const template = templateFromParam((await params).page);
  if (!template) notFound();
  const def = TEMPLATES[template];
  const { page, sections } = await adminSections(template);
  const base = `/admin/pages/${templateSlug(template)}`;
  const drafted = sections.filter((s) => s.draft);
  const canDraft = hasDrafts(template);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{def.label} {page && <span className={`badge ${page.status}`}>{page.status}</span>}</h1>
          <p className="admin-sub"><Link href="/admin/pages">← All pages</Link>{def.route ? <> · <code>{def.route}</code></> : null}{def.hasSeo && page ? <> · SEO: {page.noindex ? "hidden from search" : page.nofollow ? "links not followed" : page.seoTitle || page.seoDescription || page.ogImageId || page.canonicalUrl ? "custom" : "default"}</> : null}</p>
        </div>
        <div className="head-actions">
          {canDraft && def.route && <a className="btn" href={`${def.route}?preview=1`} target="_blank" rel="noopener">Preview draft ↗</a>}
          {canDraft && drafted.length > 0 && (
            <>
              <form action={publishPageAction}><input type="hidden" name="template" value={template} /><button type="submit" className="btn primary">Publish changes ({drafted.length})</button></form>
              <ConfirmSubmit action={discardPageAction} fields={{ template }} label="Discard drafts" title="Discard all draft changes?" text={`The draft changes in ${drafted.map((s) => s.name).join(", ")} are thrown away. The published page is not changed.`} yes="Discard drafts" />
            </>
          )}
          {canDraft && page && page.status !== "published" && <form action={setPageStatusAction}><input type="hidden" name="template" value={template} /><input type="hidden" name="status" value="published" /><button type="submit" className="btn primary">Publish page</button></form>}
          {canDraft && page && page.status === "published" && template !== "home" && (
            <ConfirmSubmit action={setPageStatusAction} fields={{ template, status: "draft" }} label="Unpublish page" title={`Unpublish “${def.label}”?`} text={`Visitors who open ${def.route} get a not-found page, and links to it (menu, footer, buttons) lead nowhere until you publish it again. Nothing is deleted, and you can still preview it.`} yes="Unpublish page" />
          )}
          {def.hasSeo && page && <Link className="btn" href={`${base}/seo`}>Edit SEO</Link>}
          {def.route && <a className="btn" href={def.route} target="_blank" rel="noopener">Preview ↗</a>}
        </div>
      </div>

      {!page && <p className="form-errors" role="status"><b>This page has no content in the database yet.</b> The website shows its built-in text. Run <code>npm run db:seed:pages:remote</code>, then edit it here.</p>}

      <h2 className="cards-title">Sections, in the order they appear on the page</h2>
      <p className="hint">The order and the design are fixed. Open a section to change its words, pictures and links.{sections.some((s) => s.canDisable) ? " Every section with a switch can be hidden without losing its content; important ones ask you to confirm first." : ""}</p>
      <ol className="section-cards">
        {sections.map((s, i) => (
          <li className={s.enabled ? "section-card" : "section-card is-off"} key={s.key}>
            <span className="sc-num" aria-hidden="true">{i + 1}</span>
            <div className="sc-main">
              <h3><Link href={`${base}/${s.key}`}>{s.name}</Link></h3>
              <p className="sc-meta">
                <span className="badge">{s.typeLabel}</span>
                {s.anchor && def.route ? <a href={`${def.route}#${s.anchor}`} target="_blank" rel="noopener">#{s.anchor}</a> : null}
                {s.draft ? <span className="badge draft" title="Saved but not published. Visitors see the published version.">Draft</span> : null}
                {s.damaged ? <span className="badge draft" title="The saved content no longer passes its checks; the website shows the built-in text.">needs fixing</span> : null}
              </p>
              <p className="sc-when">Last updated: {when(s.updatedAt)}</p>
            </div>
            <div className="sc-side">
              {s.canDisable ? (
                s.updatedAt ? (
                  <SectionSwitch action={setSectionVisibility} fields={{ template, key: s.key }} enabled={s.enabled} name={s.name} {...(s.confirm ? { confirm: s.confirm } : {})} />
                ) : <span className="badge">Not in the database</span>
              ) : (
                <span className="sc-always" title={s.lock ?? "Always shown."}><span className="badge published">Enabled</span> <small>always</small></span>
              )}
              <Link className="btn primary" href={`${base}/${s.key}`}>Edit</Link>
            </div>
          </li>
        ))}
      </ol>

      {def.hasSeo && page && (
        <section className="form-card">
          <h2>SEO</h2>
          <p className="hint">The title, description, canonical address, share picture and robots settings used by search engines and link previews. They are separate from the page&apos;s own headline.</p>
          <Link className="btn" href={`${base}/seo`}>Edit SEO</Link>
        </section>
      )}
    </>
  );
}
