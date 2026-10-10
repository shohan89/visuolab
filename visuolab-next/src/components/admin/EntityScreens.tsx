import { notFound } from "next/navigation";
import { discardEntityChangesAction, discardEntitySectionAction, publishEntityChangesAction, publishEntitySectionAction, restoreEntitySectionAction, saveEntitySectionAction, setEntitySectionVisibility } from "@/actions/cms-entities";
import { publishBlogPost } from "@/actions/blog";
import { publishCaseStudy } from "@/actions/case-studies";
import { publishService } from "@/actions/services";
import ConfirmSubmit from "./ConfirmSubmit";
import Link from "@/components/site/ui/Link";
import { ENTITIES, type EntityKind } from "@/lib/cms/entity";
import { requireAdmin } from "@/lib/server/auth";
import { hiddenKeys, loadEntity, pickOptions, readSectionForEdit, sectionCards } from "@/lib/server/entity-sections";
import { mediaOptions } from "@/lib/server/services-admin";
import SectionEditor from "./SectionEditor";
import SectionSwitch from "./SectionSwitch";

/*
 * The two screens of a record that has sections (a service, a case study, an article): the overview with one card per section in the order of the
 * public page, and the editor of one section. The routes under /admin/services, /admin/case-studies and /admin/blog are one-liners that call these.
 */

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
const titleOf = (kind: EntityKind, input: Record<string, unknown>) => String(kind === "case_study" ? input.clientName : input.title).replace(/<[^>]*>/g, "");
const PUBLISH_STATUS = { service: publishService, case_study: publishCaseStudy, blog_post: publishBlogPost } as const;
const LIST_LABEL: Record<EntityKind, string> = { service: "All services", case_study: "All case studies", blog_post: "All articles" };

export async function EntityOverview({ kind, id }: { kind: EntityKind; id: string }) {
  await requireAdmin();
  const rec = await loadEntity(kind, id);
  if (!rec) notFound();
  const info = ENTITIES[kind];
  const cards = await sectionCards(kind, rec);
  const base = `${info.admin}/${rec.id}`;
  const status = String(rec.input.status);
  const route = info.route(rec.input.slug);
  const drafted = cards.filter((c) => c.draft);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{titleOf(kind, rec.input)} <span className={`badge ${status}`}>{status}</span></h1>
          <p className="admin-sub"><Link href={info.admin}>← {LIST_LABEL[kind]}</Link> · <code>{route}</code> · last saved {when(rec.updatedAt)}</p>
        </div>
        <div className="head-actions">
          <a className="btn" href={`${route}?preview=1`} target="_blank" rel="noopener">Preview draft ↗</a>
          {status === "published" && drafted.length > 0 && (
            <>
              <form action={publishEntityChangesAction}><input type="hidden" name="kind" value={kind} /><input type="hidden" name="id" value={rec.id} /><button type="submit" className="btn primary">Publish changes ({drafted.length})</button></form>
              <ConfirmSubmit action={discardEntityChangesAction} fields={{ kind, id: rec.id }} label="Discard drafts" title="Discard all draft changes?" text={`The draft changes in ${drafted.map((c) => c.name).join(", ")} are thrown away. The published ${info.noun} is not changed.`} yes="Discard drafts" />
            </>
          )}
          {status !== "published" && (
            <form action={PUBLISH_STATUS[kind]}><input type="hidden" name="id" value={rec.id} /><input type="hidden" name="back" value="overview" /><button type="submit" className="btn primary">Publish{drafted.length > 0 ? ` (with ${drafted.length} draft ${drafted.length === 1 ? "change" : "changes"})` : ""}</button></form>
          )}
          {status === "published" && <Link className="btn" href={`${base}/confirm?do=unpublish`}>Unpublish…</Link>}
          <Link className="btn" href={`${base}/edit`}>Basics and publishing</Link>
          <a className="btn" href={route} target="_blank" rel="noopener">{status === "published" ? "View page" : "Preview"} ↗</a>
        </div>
      </div>

      <h2 className="cards-title">Sections, in the order they appear on the page</h2>
      <p className="hint">The order and the design are fixed. Open a section to change its words, pictures and links.{cards.some((c) => c.switchable) ? " Every section with a switch can be hidden without losing its content; important ones ask you to confirm first." : ""} The slug, the status and deleting are under <Link href={`${base}/edit`}>Basics and publishing</Link>.</p>
      <ol className="section-cards">
        {cards.map((s, i) => (
          <li className={s.enabled ? "section-card" : "section-card is-off"} key={s.key}>
            <span className="sc-num" aria-hidden="true">{i + 1}</span>
            <div className="sc-main">
              <h3><Link href={`${base}/${s.key}`}>{s.name}</Link></h3>
              <p className="sc-meta">
                <span className="badge">{s.type}</span>
                {s.draft ? <span className="badge draft" title="Saved but not published. Visitors see the published version.">Draft</span> : null}
                {s.anchor ? <a href={`${route}#${s.anchor}`} target="_blank" rel="noopener">#{s.anchor}</a> : null}
              </p>
              <p className="sc-about">{s.about}</p>
              <p className="sc-when">{s.lastSaved ? `Last changed: ${when(s.lastSaved)}` : "Not changed since it was created"}</p>
            </div>
            <div className="sc-side">
              {s.switchable ? (
                <SectionSwitch action={setEntitySectionVisibility} fields={{ kind, id: rec.id, key: s.key }} enabled={s.enabled} name={s.name} {...(s.confirm ? { confirm: s.confirm } : {})} />
              ) : (
                <span className="sc-always" title={s.lock ?? "Always shown."}><span className="badge published">Enabled</span> <small>always</small></span>
              )}
              <Link className="btn primary" href={`${base}/${s.key}`}>Edit</Link>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

export async function EntitySectionScreen({ kind, id, sectionKey }: { kind: EntityKind; id: string; sectionKey: string }) {
  await requireAdmin();
  const data = await readSectionForEdit(kind, id, sectionKey);
  if (!data) notFound();
  const { rec, section, fields, content, token, draft, revisions } = data;
  const info = ENTITIES[kind];
  const base = `${info.admin}/${rec.id}`;
  const route = info.route(rec.input.slug);
  const json = JSON.stringify(fields);
  const [media, options] = await Promise.all([json.includes('"kind":"media"') || json.includes('"kind":"blocks"') ? mediaOptions() : [], pickOptions(kind, rec.id, fields)]);
  const hidden = section.lock ? false : section.toggle ? !section.toggle.read(rec.input) : (await hiddenKeys(kind, rec.id)).has(section.key);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{section.name} <span className="badge">{section.type}</span></h1>
          <p className="admin-sub"><Link href={base}>← {titleOf(kind, rec.input)}</Link>{section.anchor ? <> · <a href={`${route}#${section.anchor}`} target="_blank" rel="noopener">View on the page ↗</a></> : null}{hidden ? " · hidden on the website" : ""}{draft ? " · has a draft" : ""}</p>
        </div>
        <div className="head-actions"><a className="btn" href={`${route}?preview=1${section.anchor ? `#${section.anchor}` : ""}`} target="_blank" rel="noopener">Preview draft ↗</a></div>
      </div>
      <p className="hint">{section.about}</p>
      <SectionEditor
        action={saveEntitySectionAction} restoreAction={restoreEntitySectionAction} drafts={{ has: draft, publish: publishEntitySectionAction, discard: discardEntitySectionAction }} target={{ kind, id: rec.id, key: section.key }} options={options} fields={fields} initial={content}
        updatedAt={token} damaged={false} media={media} cases={[]}
        revisions={revisions.map((r) => ({ id: r.id, savedAt: r.savedAt, replacedAt: r.replacedAt, by: r.by, kind: r.kind, changedFields: r.changedFields, content: r.content }))}
      />
    </>
  );
}
