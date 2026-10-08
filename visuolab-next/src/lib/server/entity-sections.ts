import "server-only";
import type { z } from "zod";
import { ENTITIES, sectionOf, type EntityKind, type EntitySection } from "@/lib/cms/entity";
import { fieldsOfSchema } from "@/lib/cms/describe";
import type { FieldDef } from "@/lib/cms/fields";
import { blogSchema, toErrors } from "@/lib/validation/blog";
import { caseStudySchema } from "@/lib/validation/case-study";
import { serviceSchema } from "@/lib/validation/service";
import { categoryOptions, checkPostReferences, getPostRecord, otherPosts, updatePost, visibilityOf } from "./blog-admin";
import { checkCaseReferences, getCaseRecord, otherCases, serviceOptions, updateCaseStudy } from "./case-studies-admin";
import { getDb } from "./db";
import { caseOptions, checkReferences, getServiceRecord, updateService } from "./services-admin";

/*
 * Section editing of services, case studies and articles (src/lib/cms/entity). A section is one part of a record. Saving it:
 *   1. checks the content against the section's strict schema (precise field errors),
 *   2. puts it into the record as loaded just now and checks the WHOLE record with the same schema the full form uses, and every reference,
 *   3. refuses if the record changed since the editor opened (the version token is the record's updated_at),
 *   4. writes the record through the same function the full form uses, and keeps the replaced content as a previous version.
 * So a section save can never store what the full form would refuse, and the full form and the section editors stay one data model.
 * Every function assumes the caller already passed requireAdmin(); src/actions/cms-entities.ts does that.
 */

type Rec = { id: string; updatedAt: string; publishedAt: string | null; input: Record<string, unknown> & { slug: string; status: string } };
type Errors = Record<string, string>;

const KEEP = 10;
const now = () => new Date().toISOString();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Kind-specific pieces, behind one shape. */
const KINDS: Record<EntityKind, {
  load: (id: string) => Promise<Rec | null>;
  schema: z.ZodType;
  references: (input: never) => Promise<Errors>;
  write: (id: string, input: never) => Promise<unknown>;
  /** Rules that live outside the schema (the action of the full form). */
  extra?: (before: Rec, next: Record<string, unknown>) => Errors;
}> = {
  service: {
    load: (id) => getServiceRecord(id) as Promise<Rec | null>,
    schema: serviceSchema, references: checkReferences as never, write: updateService as never,
  },
  case_study: {
    load: (id) => getCaseRecord(id) as Promise<Rec | null>,
    schema: caseStudySchema, references: checkCaseReferences as never, write: updateCaseStudy as never,
  },
  blog_post: {
    load: (id) => getPostRecord(id) as Promise<Rec | null>,
    schema: blogSchema, references: checkPostReferences as never, write: updatePost as never,
    // moving a live article's date into the future would take it offline without the usual confirmation
    extra: (before, next): Errors =>
      visibilityOf(before.input.status, before.publishedAt) === "live" && typeof next.publishedAt === "string" && next.publishedAt && `${next.publishedAt}:00.000Z` > now()
        ? { publishedAt: "This article is live. To take it offline use Unpublish; a future date is only for articles that are not live yet" }
        : ({} as Errors),
  },
};

const sectionsOf = (kind: EntityKind) => ENTITIES[kind].sections as unknown as readonly EntitySection<Record<string, unknown>>[];
export const entitySection = (kind: EntityKind, key: string) => sectionOf(sectionsOf(kind), key);

/* ---- reading ------------------------------------------------------------------------------------------------------ */

export const loadEntity = (kind: EntityKind, id: string) => KINDS[kind].load(id);

export type SectionCard = {
  key: string; name: string; type: string; about: string; anchor: string | null;
  /** Can be switched off. False for parts that are not a block of the page (see `lock`). */
  switchable: boolean; lock: string | null; confirm: string | null;
  enabled: boolean; lastSaved: string | null;
};

/** The keys of the sections an editor switched off (not counting the two service sections that keep a flag in the record). */
export async function hiddenKeys(kind: EntityKind, id: string): Promise<Set<string>> {
  const rows = (await getDb().prepare("SELECT section_key FROM entity_hidden_sections WHERE entity_type = ?1 AND entity_id = ?2").bind(kind, id).all<{ section_key: string }>()).results ?? [];
  return new Set(rows.map((r) => r.section_key));
}

/** The sections of one record in page order, with their switch and when each was last saved. */
export async function sectionCards(kind: EntityKind, rec: Rec): Promise<SectionCard[]> {
  const hidden = await hiddenKeys(kind, rec.id);
  const last = (await getDb().prepare("SELECT section_key, MAX(replaced_at) AS at FROM entity_section_revisions WHERE entity_type = ?1 AND entity_id = ?2 GROUP BY section_key").bind(kind, rec.id).all<{ section_key: string; at: string }>()).results ?? [];
  const at = new Map(last.map((r) => [r.section_key, r.at]));
  return sectionsOf(kind).map((s) => ({
    key: s.key, name: s.name, type: s.type, about: s.about, anchor: s.anchor ?? null,
    switchable: !s.lock, lock: s.lock ?? null, confirm: s.confirm ?? null,
    enabled: s.lock ? true : s.toggle ? s.toggle.read(rec.input) : !hidden.has(s.key), lastSaved: at.get(s.key) ?? null,
  }));
}

export type RevisionRow = { id: string; savedAt: string; replacedAt: string; by: string | null; content: unknown };

export async function entityRevisions(kind: EntityKind, id: string, key: string): Promise<RevisionRow[]> {
  const rows = (await getDb()
    .prepare("SELECT r.id, r.content, r.saved_at, r.replaced_at, u.email AS by_email FROM entity_section_revisions r LEFT JOIN users u ON u.id = r.replaced_by WHERE r.entity_type = ?1 AND r.entity_id = ?2 AND r.section_key = ?3 ORDER BY r.replaced_at DESC, r.rowid DESC")
    .bind(kind, id, key)
    .all<{ id: string; content: string; saved_at: string; replaced_at: string; by_email: string | null }>()).results ?? [];
  const schema = entitySection(kind, key)?.schema;
  return rows.map((r) => {
    let content: unknown = null;
    try { const p = schema?.safeParse(JSON.parse(r.content)); content = p?.success ? p.data : null; } catch { content = null; }
    return { id: r.id, savedAt: r.saved_at, replacedAt: r.replaced_at, by: r.by_email, content };
  });
}

export type PickOption = { value: string; label: string; status?: string };

/** The lists the section's choice fields draw from (other case studies, services, categories, ...). */
export async function pickOptions(kind: EntityKind, id: string, fields: readonly FieldDef[]): Promise<Record<string, PickOption[]>> {
  const sources = new Set<string>();
  const walk = (list: readonly FieldDef[]) => {
    for (const f of list) {
      if (f.kind === "pick") sources.add(f.source);
      else if (f.kind === "group") walk(f.fields);
      else if (f.kind === "list" && "fields" in f.of) walk(f.of.fields);
    }
  };
  walk(fields);
  const out: Record<string, PickOption[]> = {};
  for (const src of sources) {
    if (src === "case_slugs") out[src] = (await otherCases(kind === "case_study" ? id : undefined)).map((o) => ({ value: o.slug, label: o.label, status: o.status }));
    else if (src === "case_ids") out[src] = (await caseOptions()).map((o) => ({ value: o.id, label: o.label, status: o.status }));
    else if (src === "service_ids") out[src] = (await serviceOptions()).map((o) => ({ value: o.id, label: o.title, status: o.status }));
    else if (src === "categories") out[src] = (await categoryOptions()).map((o) => ({ value: o.id, label: o.title, status: o.status }));
    else if (src === "post_slugs") out[src] = (await otherPosts(kind === "blog_post" ? id : undefined)).map((o) => ({ value: o.slug, label: o.label, status: o.status }));
  }
  return out;
}

export type SectionForEdit = { rec: Rec; section: EntitySection<Record<string, unknown>>; fields: readonly FieldDef[]; content: unknown; revisions: RevisionRow[] };

export async function readSectionForEdit(kind: EntityKind, id: string, key: string): Promise<SectionForEdit | null> {
  const section = entitySection(kind, key);
  const rec = section ? await KINDS[kind].load(id) : null;
  if (!section || !rec) return null;
  return { rec, section, fields: fieldsOfSchema(section.schema), content: section.read(rec.input), revisions: await entityRevisions(kind, id, key) };
}

/* ---- writing ------------------------------------------------------------------------------------------------------ */

export type SaveResult =
  | { ok: true; updatedAt: string; changedFields: string[] }
  | { ok: false; kind: "invalid"; errors: Errors }
  | { ok: false; kind: "conflict" | "missing" | "locked" };

/** Maps the errors of the whole-record check to this section's field paths; what belongs to another part of the record is reported as a form message. */
function toSectionErrors(section: EntitySection<Record<string, unknown>>, errors: Errors): Errors {
  const out: Errors = {};
  for (const [k, msg] of Object.entries(errors)) {
    const mapped = section.mapError(k);
    if (mapped && mapped !== "form") out[mapped] ??= msg;
    else out.form ??= mapped === "form" ? msg : `${msg} (this is in another part of the page; the stored page has a problem there)`;
  }
  return out;
}

/** The whole record, as the full form would check it. */
async function checkRecord(kind: EntityKind, before: Rec, next: Record<string, unknown>, section: EntitySection<Record<string, unknown>>): Promise<Errors> {
  const k = KINDS[kind];
  const parsed = k.schema.safeParse(next);
  const errors: Errors = parsed.success ? {} : toErrors(parsed.error);
  if (parsed.success) Object.assign(errors, await k.references(parsed.data as never));
  Object.assign(errors, k.extra?.(before, next) ?? {});
  return Object.keys(errors).length ? toSectionErrors(section, errors) : {};
}

/** Top-level fields of the section's content that differ. */
const changedKeys = (a: unknown, b: unknown): string[] => {
  const x = (a ?? {}) as Record<string, unknown>;
  const y = (b ?? {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => !same(x[k], y[k]));
};

export async function saveEntitySection(a: { kind: EntityKind; id: string; key: string; content: unknown; expectedUpdatedAt: string; userId: string }): Promise<SaveResult> {
  const section = entitySection(a.kind, a.key);
  const k = KINDS[a.kind];
  const rec = section ? await k.load(a.id) : null;
  if (!section || !rec) return { ok: false, kind: "missing" };

  const parsed = section.schema.safeParse(a.content);
  if (!parsed.success) return { ok: false, kind: "invalid", errors: toErrors(parsed.error) };
  if (rec.updatedAt !== a.expectedUpdatedAt) return { ok: false, kind: "conflict" };

  const before = section.schema.safeParse(section.read(rec.input));
  const changed = changedKeys(before.success ? before.data : section.read(rec.input), parsed.data);
  const next = section.apply(rec.input, parsed.data);
  const errors = await checkRecord(a.kind, rec, next, section);
  if (Object.keys(errors).length) return { ok: false, kind: "invalid", errors };
  if (changed.length === 0) return { ok: true, updatedAt: rec.updatedAt, changedFields: [] };

  // the record may have been saved by someone else while it was being checked
  const fresh = await k.load(a.id);
  if (!fresh || fresh.updatedAt !== a.expectedUpdatedAt) return { ok: false, kind: "conflict" };
  await k.write(a.id, section.apply(fresh.input, parsed.data) as never);

  const db = getDb();
  const t = now();
  await db.batch([
    db.prepare("INSERT INTO entity_section_revisions (id, entity_type, entity_id, section_key, content, saved_at, replaced_at, replaced_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)")
      .bind(crypto.randomUUID(), a.kind, a.id, a.key, JSON.stringify(before.success ? before.data : section.read(rec.input)), rec.updatedAt, t, a.userId),
    db.prepare(`DELETE FROM entity_section_revisions WHERE entity_type = ?1 AND entity_id = ?2 AND section_key = ?3 AND id NOT IN (
      SELECT id FROM entity_section_revisions WHERE entity_type = ?1 AND entity_id = ?2 AND section_key = ?3 ORDER BY replaced_at DESC, rowid DESC LIMIT ${KEEP})`).bind(a.kind, a.id, a.key),
  ]);
  const after = await k.load(a.id);
  return { ok: true, updatedAt: after?.updatedAt ?? t, changedFields: changed };
}

export type VisibilityResult = { ok: true; changed: boolean } | { ok: false; kind: "locked" | "missing" | "invalid" | "confirm"; errors?: Errors };

/**
 * Shows or hides a section. The content is never touched: a hidden section stays in the record and can be shown again.
 * Important sections (`confirm`) are only hidden when the editor confirmed. The two service sections that always had a flag use it (and the whole
 * record is checked as the full form would, so an unfinished one cannot be shown); every other section is a row in entity_hidden_sections.
 */
export async function setEntitySectionEnabled(a: { kind: EntityKind; id: string; key: string; on: boolean; confirmed: boolean; userId: string }): Promise<VisibilityResult> {
  const { kind, id, key, on } = a;
  const section = entitySection(kind, key);
  const k = KINDS[kind];
  const rec = section ? await k.load(id) : null;
  if (!section || !rec) return { ok: false, kind: "missing" };
  if (section.lock) return { ok: false, kind: "locked" };
  if (!on && section.confirm && !a.confirmed) return { ok: false, kind: "confirm" };
  if (section.toggle) {
    if (section.toggle.read(rec.input) === on) return { ok: true, changed: false };
    const next = section.toggle.write(rec.input, on);
    const errors = await checkRecord(kind, rec, next, section);
    if (Object.keys(errors).length) return { ok: false, kind: "invalid", errors };
    await k.write(id, next as never);
    return { ok: true, changed: true };
  }
  const db = getDb();
  const was = (await hiddenKeys(kind, id)).has(key);
  if (on) await db.prepare("DELETE FROM entity_hidden_sections WHERE entity_type = ?1 AND entity_id = ?2 AND section_key = ?3").bind(kind, id, key).run();
  else await db.prepare("INSERT OR IGNORE INTO entity_hidden_sections (entity_type, entity_id, section_key, hidden_at, hidden_by) VALUES (?1, ?2, ?3, ?4, ?5)").bind(kind, id, key, now(), a.userId).run();
  return { ok: true, changed: was === on };
}
