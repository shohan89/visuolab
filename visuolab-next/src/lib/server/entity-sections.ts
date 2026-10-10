import "server-only";
import type { z } from "zod";
import { ENTITIES, sectionOf, type EntityKind, type EntitySection } from "@/lib/cms/entity";
import { fieldsOfSchema } from "@/lib/cms/describe";
import { deleteDrafts, getDrafts, putDraft, type Draft } from "@/lib/cms/drafts";
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
 *
 * DRAFTS. A save of a section is a DRAFT (table content_drafts): the record, and so the public website, is not changed. The section editor shows the
 * draft over the published content; a preview (signed-in admin) draws the record with its drafts applied; Publish writes each draft through the
 * live save above (checked again, kept as a revision) and deletes it; Discard just deletes it. Restoring an earlier version and switching a
 * section on or off are not drafts: they act on the published content at once.
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

/** The record's input with the given drafts put in, section by section (a draft that no longer fits its section's schema is ignored). */
function withDrafts(kind: EntityKind, input: Rec["input"], drafts: Map<string, Draft>): Rec["input"] {
  let out = input;
  for (const s of sectionsOf(kind)) {
    const d = drafts.get(s.key);
    if (!d) continue;
    const parsed = s.schema.safeParse(d.content);
    if (parsed.success) out = s.apply(out, parsed.data) as Rec["input"];
  }
  return out;
}

/** The record as an editor sees it: the published record with all its drafts applied. `drafted` lists the sections with a draft. */
export async function workingRecord(kind: EntityKind, id: string): Promise<(Rec & { drafted: string[] }) | null> {
  const rec = await KINDS[kind].load(id);
  if (!rec) return null;
  const drafts = await getDrafts(getDb(), kind, id);
  return { ...rec, input: withDrafts(kind, rec.input, drafts), drafted: sectionsOf(kind).map((s) => s.key).filter((k) => drafts.has(k)) };
}

export type SectionCard = {
  key: string; name: string; type: string; about: string; anchor: string | null;
  /** Can be switched off. False for parts that are not a block of the page (see `lock`). */
  switchable: boolean; lock: string | null; confirm: string | null;
  enabled: boolean; lastSaved: string | null;
  /** An unpublished draft exists. */
  draft: boolean;
};

/** The keys of the sections an editor switched off (not counting the two service sections that keep a flag in the record). */
export async function hiddenKeys(kind: EntityKind, id: string): Promise<Set<string>> {
  const rows = (await getDb().prepare("SELECT section_key FROM entity_hidden_sections WHERE entity_type = ?1 AND entity_id = ?2").bind(kind, id).all<{ section_key: string }>()).results ?? [];
  return new Set(rows.map((r) => r.section_key));
}

/** The sections of one record in page order, with their switch and when each was last saved. */
export async function sectionCards(kind: EntityKind, rec: Rec): Promise<SectionCard[]> {
  const hidden = await hiddenKeys(kind, rec.id);
  const drafts = await getDrafts(getDb(), kind, rec.id);
  const last = (await getDb().prepare("SELECT section_key, MAX(replaced_at) AS at FROM entity_section_revisions WHERE entity_type = ?1 AND entity_id = ?2 GROUP BY section_key").bind(kind, rec.id).all<{ section_key: string; at: string }>()).results ?? [];
  const at = new Map(last.map((r) => [r.section_key, r.at]));
  return sectionsOf(kind).map((s) => ({
    key: s.key, name: s.name, type: s.type, about: s.about, anchor: s.anchor ?? null,
    switchable: !s.lock, lock: s.lock ?? null, confirm: s.confirm ?? null,
    enabled: s.lock ? true : s.toggle ? s.toggle.read(rec.input) : !hidden.has(s.key), lastSaved: at.get(s.key) ?? null, draft: drafts.has(s.key),
  }));
}

export type RevisionRow = { id: string; savedAt: string; replacedAt: string; by: string | null; kind: "edit" | "restore"; changedFields: string[]; content: unknown };

export async function entityRevisions(kind: EntityKind, id: string, key: string): Promise<RevisionRow[]> {
  const rows = (await getDb()
    .prepare("SELECT r.id, r.content, r.new_content, r.kind, r.saved_at, r.replaced_at, COALESCE(NULLIF(u.name, ''), u.email) AS by_email FROM entity_section_revisions r LEFT JOIN users u ON u.id = r.replaced_by WHERE r.entity_type = ?1 AND r.entity_id = ?2 AND r.section_key = ?3 ORDER BY r.replaced_at DESC, r.rowid DESC")
    .bind(kind, id, key)
    .all<{ id: string; content: string; new_content: string | null; kind: string; saved_at: string; replaced_at: string; by_email: string | null }>()).results ?? [];
  const schema = entitySection(kind, key)?.schema;
  return rows.map((r) => {
    let content: unknown = null;
    try { const p = schema?.safeParse(JSON.parse(r.content)); content = p?.success ? p.data : null; } catch { content = null; }
    let changedFieldsList: string[] = [];
    try { if (r.new_content) changedFieldsList = changedKeys(JSON.parse(r.content), JSON.parse(r.new_content)); } catch { /* no field list */ }
    return { id: r.id, savedAt: r.saved_at, replacedAt: r.replaced_at, by: r.by_email, kind: r.kind === "restore" ? "restore" : "edit", changedFields: changedFieldsList, content };
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

export type SectionForEdit = { rec: Rec; section: EntitySection<Record<string, unknown>>; fields: readonly FieldDef[]; /** The draft if there is one, else the published content. */ content: unknown; /** Version token of what the editor shows: the draft's, else the record's. */ token: string; draft: boolean; revisions: RevisionRow[] };

export async function readSectionForEdit(kind: EntityKind, id: string, key: string): Promise<SectionForEdit | null> {
  const section = entitySection(kind, key);
  const rec = section ? await KINDS[kind].load(id) : null;
  if (!section || !rec) return null;
  const d = (await getDrafts(getDb(), kind, id)).get(key);
  const ok = d ? section.schema.safeParse(d.content) : null;
  const revisions = await entityRevisions(kind, id, key);
  if (d && ok?.success) return { rec, section, fields: fieldsOfSchema(section.schema), content: ok.data, token: d.updatedAt, draft: true, revisions };
  return { rec, section, fields: fieldsOfSchema(section.schema), content: section.read(rec.input), token: rec.updatedAt, draft: false, revisions };
}

/* ---- writing ------------------------------------------------------------------------------------------------------ */

export type SaveResult =
  | { ok: true; updatedAt: string; changedFields: string[]; /** saved as a draft (not live) */ draft?: boolean }
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

export async function saveEntitySectionLive(a: { kind: EntityKind; id: string; key: string; content: unknown; expectedUpdatedAt: string; userId: string; mode?: "edit" | "restore" }): Promise<SaveResult> {
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
    db.prepare("INSERT INTO entity_section_revisions (id, entity_type, entity_id, section_key, content, saved_at, replaced_at, replaced_by, new_content, kind) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)")
      .bind(crypto.randomUUID(), a.kind, a.id, a.key, JSON.stringify(before.success ? before.data : section.read(rec.input)), rec.updatedAt, t, a.userId, JSON.stringify(parsed.data), a.mode ?? "edit"),
    db.prepare(`DELETE FROM entity_section_revisions WHERE entity_type = ?1 AND entity_id = ?2 AND section_key = ?3 AND id NOT IN (
      SELECT id FROM entity_section_revisions WHERE entity_type = ?1 AND entity_id = ?2 AND section_key = ?3 ORDER BY replaced_at DESC, rowid DESC LIMIT ${KEEP})`).bind(a.kind, a.id, a.key),
  ]);
  const after = await k.load(a.id);
  return { ok: true, updatedAt: after?.updatedAt ?? t, changedFields: changed };
}

/** Saves a section as a DRAFT. Same checks as a live save (section schema, then the whole record with every other draft applied, then references), same kind of version token. */
export async function saveEntitySection(a: { kind: EntityKind; id: string; key: string; content: unknown; expectedUpdatedAt: string; userId: string }): Promise<SaveResult> {
  const section = entitySection(a.kind, a.key);
  const k = KINDS[a.kind];
  const rec = section ? await k.load(a.id) : null;
  if (!section || !rec) return { ok: false, kind: "missing" };
  const parsed = section.schema.safeParse(a.content);
  if (!parsed.success) return { ok: false, kind: "invalid", errors: toErrors(parsed.error) };
  const db = getDb();
  const drafts = await getDrafts(db, a.kind, a.id);
  const mine = drafts.get(a.key);
  if ((mine ? mine.updatedAt : rec.updatedAt) !== a.expectedUpdatedAt) return { ok: false, kind: "conflict" };

  const others = new Map([...drafts].filter(([key]) => key !== a.key));
  const next = section.apply(withDrafts(a.kind, rec.input, others), parsed.data);
  const errors = await checkRecord(a.kind, rec, next, section);
  if (Object.keys(errors).length) return { ok: false, kind: "invalid", errors };

  const liveRead = section.read(rec.input);
  const live = section.schema.safeParse(liveRead);
  const changed = changedKeys(mine ? mine.content : live.success ? live.data : liveRead, parsed.data);
  if (live.success && same(live.data, parsed.data)) {
    if (mine) await deleteDrafts(db, a.kind, a.id, a.key);
    return { ok: true, updatedAt: rec.updatedAt, changedFields: changed, draft: false };
  }
  const stamp = await putDraft(db, a.kind, a.id, a.key, parsed.data, a.userId, mine ? mine.updatedAt : rec.updatedAt);
  return { ok: true, updatedAt: stamp, changedFields: changed, draft: true };
}

export type PublishResult = { published: string[]; errors: Record<string, Errors | "conflict" | "missing"> };

/** Publishes the drafts of a record (all, or the given sections) through the live save: checked again, kept as a revision, then the draft is deleted. A draft that no longer passes stays a draft and is reported. */
export async function publishEntityDrafts(a: { kind: EntityKind; id: string; userId: string; keys?: readonly string[] }): Promise<PublishResult> {
  const db = getDb();
  const drafts = await getDrafts(db, a.kind, a.id);
  const out: PublishResult = { published: [], errors: {} };
  for (const s of sectionsOf(a.kind)) {
    const d = drafts.get(s.key);
    if (!d || (a.keys && !a.keys.includes(s.key))) continue;
    const rec = await KINDS[a.kind].load(a.id);
    if (!rec) { out.errors[s.key] = "missing"; continue; }
    const res = await saveEntitySectionLive({ kind: a.kind, id: a.id, key: s.key, content: d.content, expectedUpdatedAt: rec.updatedAt, userId: a.userId });
    if (res.ok) { await deleteDrafts(db, a.kind, a.id, s.key); out.published.push(s.key); }
    else out.errors[s.key] = res.kind === "invalid" ? res.errors : res.kind === "conflict" ? "conflict" : "missing";
  }
  return out;
}

/** Throws a record's draft changes away (all sections, or the given ones). Returns the sections that had a draft. */
export async function discardEntityDrafts(kind: EntityKind, id: string, keys?: readonly string[]): Promise<string[]> {
  const db = getDb();
  const drafts = await getDrafts(db, kind, id);
  const gone = [...drafts.keys()].filter((k) => !keys || keys.includes(k));
  for (const k of gone) await deleteDrafts(db, kind, id, k);
  return gone;
}

/**
 * The full form of a record (everything on one page) saves like the section editors: each section whose content differs from the published one becomes
 * a draft (or the draft is removed when it equals the published content). What belongs to no section (the slug, the featured flag, a service's name)
 * is "basics" and is written to the record at once, as before. `input` has already passed the schema of the full form.
 */
export async function saveRecordAsDrafts(a: { kind: EntityKind; id: string; input: Record<string, unknown>; userId: string }): Promise<{ ok: true; basics: string[]; drafted: string[]; cleared: string[]; oldSlug: string | null } | { ok: false; errors: Errors }> {
  const k = KINDS[a.kind];
  const rec = await k.load(a.id);
  if (!rec) return { ok: false, errors: { form: "This record no longer exists. It may have been deleted in another window." } };
  const sections = sectionsOf(a.kind);
  const covered: Record<string, unknown> = sections.reduce<Rec["input"]>((acc, s) => s.apply(acc, s.read(a.input as Rec["input"])) as Rec["input"], rec.input);
  const basics = Object.keys(a.input).filter((key) => !same(a.input[key], covered[key]));
  const db = getDb();
  const existing = await getDrafts(db, a.kind, a.id);
  const plan: { key: string; data: unknown; equalsLive: boolean }[] = [];
  for (const s of sections) {
    const parsed = s.schema.safeParse(s.read(a.input as Rec["input"]));
    if (!parsed.success) return { ok: false, errors: { form: `${s.name}: ${Object.values(toErrors(parsed.error))[0] ?? "the content is not valid"}` } };
    const live = s.schema.safeParse(s.read(rec.input));
    plan.push({ key: s.key, data: parsed.data, equalsLive: live.success && same(live.data, parsed.data) });
  }
  let oldSlug: string | null = null;
  if (basics.length) {
    const r = (await k.write(a.id, { ...rec.input, ...Object.fromEntries(basics.map((key) => [key, a.input[key]])) } as never)) as { oldSlug?: string | null } | undefined;
    oldSlug = r?.oldSlug ?? null;
  }
  const drafted: string[] = [];
  const cleared: string[] = [];
  const fresh = basics.length ? (await k.load(a.id)) ?? rec : rec;
  for (const p of plan) {
    const mine = existing.get(p.key);
    if (p.equalsLive) { if (mine) { await deleteDrafts(db, a.kind, a.id, p.key); cleared.push(p.key); } continue; }
    if (mine && same(mine.content, p.data)) continue;
    await putDraft(db, a.kind, a.id, p.key, p.data, a.userId, mine ? mine.updatedAt : fresh.updatedAt);
    drafted.push(p.key);
  }
  return { ok: true, basics, drafted, cleared, oldSlug };
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

/** One earlier version of a section of a record, to put back: its previous content (checked against the section's schema now). Null if it is not this section's or no longer fits. */
export async function getEntityRevision(kind: EntityKind, id: string, key: string, revisionId: string): Promise<{ content: unknown; replacedAt: string } | null> {
  const section = entitySection(kind, key);
  const r = section
    ? await getDb().prepare("SELECT content, replaced_at FROM entity_section_revisions WHERE id = ?1 AND entity_type = ?2 AND entity_id = ?3 AND section_key = ?4").bind(revisionId, kind, id, key).first<{ content: string; replaced_at: string }>()
    : null;
  if (!section || !r) return null;
  try {
    const parsed = section.schema.safeParse(JSON.parse(r.content));
    return parsed.success ? { content: parsed.data, replacedAt: r.replaced_at } : null;
  } catch { return null; }
}

/** The latest content changes of services, case studies and articles, newest first. */
export async function listRecentEntityRevisions(limit: number): Promise<import("@/lib/cms/store").RecentChange[]> {
  const rows = (await getDb()
    .prepare(`SELECT r.entity_type, r.entity_id, r.section_key, r.replaced_at, r.kind, r.content, r.new_content, COALESCE(NULLIF(u.name, ''), u.email) AS by_email, COALESCE(sv.title, cs.client_name, bp.title) AS title
                FROM entity_section_revisions r LEFT JOIN users u ON u.id = r.replaced_by
                LEFT JOIN services sv ON r.entity_type = 'service' AND sv.id = r.entity_id
                LEFT JOIN case_studies cs ON r.entity_type = 'case_study' AND cs.id = r.entity_id
                LEFT JOIN blog_posts bp ON r.entity_type = 'blog_post' AND bp.id = r.entity_id
               ORDER BY r.replaced_at DESC, r.rowid DESC LIMIT ?1`)
    .bind(limit)
    .all<{ entity_type: EntityKind; entity_id: string; section_key: string; replaced_at: string; kind: string; content: string; new_content: string | null; by_email: string | null; title: string | null }>()).results ?? [];
  return rows.map((r) => {
    let fields: string[] = [];
    try { if (r.new_content) fields = changedKeys(JSON.parse(r.content), JSON.parse(r.new_content)); } catch { /* no field list */ }
    return {
      at: r.replaced_at, by: r.by_email, kind: r.kind === "restore" ? "restore" : "edit",
      where: `${ENTITIES[r.entity_type].noun[0]!.toUpperCase()}${ENTITIES[r.entity_type].noun.slice(1)}: ${(r.title ?? r.entity_id).replace(/<[^>]*>/g, "")}`,
      section: entitySection(r.entity_type, r.section_key)?.name ?? r.section_key, changedFields: fields, href: `${ENTITIES[r.entity_type].admin}/${r.entity_id}/${r.section_key}`,
    };
  });
}
