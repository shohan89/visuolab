import { notFound } from "next/navigation";
import Link from "@/components/site/ui/Link";
import { discardSectionAction, publishSectionAction, restoreSection, saveSection } from "@/actions/cms-pages";
import SectionEditor from "@/components/admin/SectionEditor";
import { fieldsFor } from "@/lib/cms/describe";
import { SECTION_TYPES, TEMPLATES, slotOf, templateFromParam, templateSlug } from "@/lib/cms/registry";
import { hasDrafts } from "@/lib/cms/store";
import { requireAdmin } from "@/lib/server/auth";
import { adminRevisions, adminSection } from "@/lib/server/cms-admin";
import { caseOptions, mediaOptions } from "@/lib/server/services-admin";

export const dynamic = "force-dynamic";

export default async function SectionAdmin({ params }: { params: Promise<{ page: string; section: string }> }) {
  await requireAdmin();
  const { page: pageSlug, section: key } = await params;
  const template = templateFromParam(pageSlug);
  const slot = template ? slotOf(template, key) : undefined;
  if (!template || !slot) notFound();
  const [row, revisions] = await Promise.all([adminSection(template, key), adminRevisions(template, key)]);
  const def = TEMPLATES[template];
  const back = `/admin/pages/${templateSlug(template)}`;
  const fields = fieldsFor(slot.type); // the form is built from the section's strict schema
  const needsMedia = JSON.stringify(fields).includes('"kind":"media"');
  const needsCases = JSON.stringify(fields).includes('"kind":"cases"');
  const [media, cases] = await Promise.all([needsMedia ? mediaOptions() : [], needsCases ? caseOptions() : []]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{slot.name} <span className="badge">{SECTION_TYPES[slot.type].label}</span></h1>
          <p className="admin-sub"><Link href={back}>← {def.label}</Link>{def.route && slot.anchor ? <> · <a href={`${def.route}#${slot.anchor}`} target="_blank" rel="noopener">View on the page ↗</a></> : null}{row && !row.enabled ? " · hidden on the website" : ""}{row?.draft ? " · has a draft" : ""}</p>
        </div>
        {def.route && hasDrafts(template) && <div className="head-actions"><a className="btn" href={`${def.route}?preview=1${slot.anchor ? `#${slot.anchor}` : ""}`} target="_blank" rel="noopener">Preview draft ↗</a></div>}
      </div>
      {!row ? (
        <p className="form-errors" role="status"><b>This section is not in the database yet.</b> The website shows its built-in text. Run <code>npm run db:seed:pages:remote</code>, then edit it here.</p>
      ) : (
        <SectionEditor action={saveSection} restoreAction={restoreSection} {...(hasDrafts(template) ? { drafts: { has: row.draft, publish: publishSectionAction, discard: discardSectionAction } } : {})} target={{ template, key }} fields={fields} initial={row.content} updatedAt={row.updatedAt} damaged={row.damaged} media={media} cases={cases} revisions={revisions.map((r) => ({ id: r.id, savedAt: r.savedAt, replacedAt: r.replacedAt, by: r.by, kind: r.kind, changedFields: r.changedFields, content: r.content }))} />
      )}
    </>
  );
}
