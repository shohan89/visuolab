/*
 * Reading and writing the page CMS. Every function takes the database as a parameter, like src/lib/server/cms.ts, so the same code runs in
 * the Worker (D1) and in scripts/db/verify-pages.mjs (SQLite). Nothing here knows about sessions or requests: the caller (src/actions/cms-pages.ts)
 * has already checked the origin and the admin role.
 *
 * Two rules hold everywhere:
 *  - what is written has passed `checkSection()` (the strict schema of the section's type) and the references it names exist;
 *  - what is read is checked again, and a section that is missing or no longer valid is replaced by its default, so a page always renders.
 */
import { defaultContent } from "./defaults.ts";
import { pageSeoSchema, type PageSeoInput } from "./page-seo.ts";
import { checkSection, SECTION_TYPES, slotOf, TEMPLATES, type SectionErrors } from "./registry.ts";
import type { PageContent, PageRecord, PageStatus, PageTemplate, SectionRef, SectionType } from "./types.ts";

type Db = D1Database;
type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

const toPage = (r: Row): PageRecord => ({
  id: s(r.id), slug: s(r.slug), title: s(r.title), status: s(r.status) as PageStatus, template: s(r.template) as PageTemplate,
  seoTitle: r.seo_title == null ? null : s(r.seo_title), seoDescription: r.seo_description == null ? null : s(r.seo_description),
  ogImageId: r.og_image_id == null ? null : s(r.og_image_id), canonicalUrl: r.canonical_url == null ? null : s(r.canonical_url),
  noindex: r.noindex === 1, nofollow: r.nofollow === 1, createdAt: s(r.created_at), updatedAt: s(r.updated_at),
});

/* ---- reading ------------------------------------------------------------------------------------------------------ */

export type LoadedPage<P extends PageTemplate> = {
  /** Null before the pages have been seeded: the page is then drawn entirely from the defaults. */
  page: PageRecord | null;
  /** The content of every section of the template, checked against its schema (or the default). */
  content: PageContent<P>;
  /** Whether each section is switched on. Sections that cannot be switched off are always on. */
  enabled: { [K in keyof PageContent<P>]: boolean };
  /** What was replaced by a default and why (for the log, never shown to visitors). */
  issues: string[];
};

/** One page with all its sections, each checked; a missing or damaged section is replaced by its default. */
export async function loadPage<P extends PageTemplate>(db: Db, template: P): Promise<LoadedPage<P>> {
  const pageRow = await db.prepare("SELECT * FROM pages WHERE template = ?1").bind(template).first<Row>();
  const rows = pageRow
    ? ((await db.prepare("SELECT section_key, section_type, is_enabled, content FROM page_sections WHERE page_id = ?1 ORDER BY position").bind(pageRow.id).all<Row>()).results ?? [])
    : [];
  const byKey = new Map(rows.map((r) => [s(r.section_key), r]));
  const issues: string[] = [];
  const content: Partial<Record<string, unknown>> = {};
  const enabled: Partial<Record<string, boolean>> = {};
  for (const slot of TEMPLATES[template].sections) {
    const row = byKey.get(slot.key);
    let value: unknown;
    if (!row) {
      if (pageRow) issues.push(`${template}.${slot.key}: no row, using the default`);
    } else if (s(row.section_type) !== slot.type) {
      issues.push(`${template}.${slot.key}: type is ${s(row.section_type)}, expected ${slot.type}; using the default`);
    } else {
      try {
        const parsed = SECTION_TYPES[slot.type].schema.safeParse(JSON.parse(s(row.content)));
        if (parsed.success) value = parsed.data;
        else issues.push(`${template}.${slot.key}: content no longer passes its schema (${parsed.error.issues[0]?.path.join(".") || "form"}); using the default`);
      } catch {
        issues.push(`${template}.${slot.key}: content is not JSON; using the default`);
      }
    }
    content[slot.key] = value ?? defaultContent(template, slot.key);
    enabled[slot.key] = slot.canDisable ? !row || row.is_enabled === 1 : true;
  }
  // every key of the template has just been filled from its own schema or its typed default
  return { page: pageRow ? toPage(pageRow) : null, content: content as PageContent<P>, enabled: enabled as LoadedPage<P>["enabled"], issues };
}

/* ---- writing a section --------------------------------------------------------------------------------------------- */

export type SaveSectionInput = {
  template: PageTemplate;
  key: string;
  /** What the editor sent: unknown until it has passed the schema. */
  content: unknown;
  /** The `updatedAt` the editor loaded. If the section changed since, nothing is written (two editors cannot silently overwrite each other). */
  expectedUpdatedAt: string;
  userId: string;
};

export type SaveFailure =
  | { ok: false; kind: "invalid"; errors: SectionErrors }
  | { ok: false; kind: "missing" }
  | { ok: false; kind: "conflict" };
export type SaveSectionResult = { ok: true; updatedAt: string; changedFields: string[]; refs: number } | SaveFailure;

/** How many earlier versions of a section are kept. */
export const REVISIONS_KEPT = 10;

/** The first message for each field, by path. */
const invalid = (errors: SectionErrors): SaveFailure => ({ ok: false, kind: "invalid", errors });

/** Checks that every media file and case study the content points at exists, and that a file is the kind (image/video) the field needs. */
export async function checkRefs(db: Db, refs: readonly SectionRef[]): Promise<SectionErrors> {
  const errors: SectionErrors = {};
  const mediaIds = [...new Set(refs.filter((r) => r.kind === "media").map((r) => r.id))];
  const caseIds = [...new Set(refs.filter((r) => r.kind === "case_study").map((r) => r.id))];
  const marks = (n: number) => Array.from({ length: n }, (_, i) => `?${i + 1}`).join(",");
  const media = new Map<string, Row>();
  if (mediaIds.length) {
    for (const r of (await db.prepare(`SELECT id, kind, mime FROM media WHERE id IN (${marks(mediaIds.length)})`).bind(...mediaIds).all<Row>()).results ?? []) media.set(s(r.id), r);
  }
  const cases = new Set<string>();
  if (caseIds.length) {
    for (const r of (await db.prepare(`SELECT id FROM case_studies WHERE id IN (${marks(caseIds.length)})`).bind(...caseIds).all<Row>()).results ?? []) cases.add(s(r.id));
  }
  for (const r of refs) {
    if (r.kind === "case_study") {
      if (!cases.has(r.id)) errors[r.path] = "This case study no longer exists";
    } else {
      const m = media.get(r.id);
      if (!m) errors[r.path] = "This file is not in the media library";
      else if (r.mediaKind && s(m.kind) !== r.mediaKind) errors[r.path] = r.mediaKind === "video" ? "Choose a video from the media library" : "Choose an image from the media library";
      else if (r.mime && s(m.mime) !== r.mime) errors[r.path] = `This file must be ${r.mime}`;
    }
  }
  return errors;
}

/** The top-level fields whose content differs (names only: used for the audit entry, which never holds the content). */
function changedFields(before: unknown, after: unknown): string[] {
  const a = (before && typeof before === "object" ? before : {}) as Partial<Record<string, unknown>>;
  const b = (after && typeof after === "object" ? after : {}) as Partial<Record<string, unknown>>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}

/**
 * Saves the content of one section: strict schema, references that exist, no overwrite of a newer version, and the section and its
 * `page_section_refs` rows written in one atomic batch. The page and the other sections are not touched.
 */
export async function saveSectionContent(db: Db, input: SaveSectionInput): Promise<SaveSectionResult> {
  const slot = slotOf(input.template, input.key);
  if (!slot) return invalid({ form: `The ${input.template} page has no section "${input.key}".` });

  const row = await db
    .prepare("SELECT s.id, s.section_type, s.updated_at, s.content FROM page_sections s JOIN pages p ON p.id = s.page_id WHERE p.template = ?1 AND s.section_key = ?2")
    .bind(input.template, input.key)
    .first<Row>();
  if (!row) return { ok: false, kind: "missing" };
  if (s(row.section_type) !== slot.type) return invalid({ form: "This section is of a different type than the template says." });

  const checked = checkSection(input.template, input.key, input.content);
  if (!checked.ok) return invalid(checked.errors);
  const refErrors = await checkRefs(db, checked.refs);
  if (Object.keys(refErrors).length) return invalid(refErrors);
  if (s(row.updated_at) !== input.expectedUpdatedAt) return { ok: false, kind: "conflict" };

  const id = s(row.id);
  const expected = s(row.updated_at);
  let now = new Date().toISOString();
  if (now <= expected) now = new Date(Date.parse(expected) + 1).toISOString(); // the new value must differ: it is the token the reference rows check below
  const version = SECTION_TYPES[slot.type].version;
  const stillMine = "(SELECT updated_at FROM page_sections WHERE id = ?1) = ?2";
  const newJson = JSON.stringify(checked.content);
  const changed = s(row.content) !== newJson;
  const stmts = [
    // the version being replaced is kept (only if it differs, and only if this save will win the race: same guard as the update)
    ...(changed
      ? [db.prepare("INSERT INTO page_section_revisions (id, section_id, content, schema_version, saved_at, saved_by, replaced_at) SELECT ?1, id, content, schema_version, updated_at, updated_by, ?2 FROM page_sections WHERE id = ?3 AND updated_at = ?4").bind(`rev_${crypto.randomUUID()}`, now, id, expected)]
      : []),
    db.prepare("UPDATE page_sections SET content = ?3, schema_version = ?4, updated_at = ?2, updated_by = ?5 WHERE id = ?1 AND updated_at = ?6").bind(id, now, newJson, version, input.userId, expected),
    // the reference rows follow only if the update above happened (the row now carries `now`)
    db.prepare(`DELETE FROM page_section_refs WHERE section_id = ?1 AND ${stillMine}`).bind(id, now),
    ...checked.refs.map((r) =>
      db
        .prepare(`INSERT INTO page_section_refs (section_id, field_path, kind, media_id, case_study_id) SELECT ?1, ?3, ?4, ?5, ?6 WHERE ${stillMine}`)
        .bind(id, now, r.path, r.kind, r.kind === "media" ? r.id : null, r.kind === "case_study" ? r.id : null),
    ),
    // keep the last REVISIONS_KEPT versions
    db.prepare(`DELETE FROM page_section_revisions WHERE section_id = ?1 AND ${stillMine} AND id NOT IN (SELECT id FROM page_section_revisions WHERE section_id = ?1 ORDER BY replaced_at DESC, id DESC LIMIT ${REVISIONS_KEPT})`).bind(id, now),
  ];
  const results = await db.batch(stmts);
  if ((results[changed ? 1 : 0]?.meta?.changes ?? 0) !== 1) return { ok: false, kind: "conflict" };
  let before: unknown;
  try { before = JSON.parse(s(row.content)); } catch { before = {}; }
  return { ok: true, updatedAt: now, changedFields: changedFields(before, checked.content), refs: checked.refs.length };
}

/* ---- switching a section on or off ----------------------------------------------------------------------------------- */

export type EnableResult = { ok: true } | { ok: false; kind: "missing" | "locked" };

/** Hides or shows a section. Only sections the registry allows (their anchors are not linked from elsewhere); the content is kept. */
export async function setSectionEnabled(db: Db, template: PageTemplate, key: string, enabled: boolean, userId: string): Promise<EnableResult> {
  const slot = slotOf(template, key);
  if (!slot) return { ok: false, kind: "missing" };
  if (!slot.canDisable) return enabled ? { ok: true } : { ok: false, kind: "locked" };
  const res = await db
    .prepare("UPDATE page_sections SET is_enabled = ?3, updated_at = ?4, updated_by = ?5 WHERE section_key = ?2 AND page_id = (SELECT id FROM pages WHERE template = ?1)")
    .bind(template, key, enabled ? 1 : 0, new Date().toISOString(), userId)
    .run();
  return (res.meta?.changes ?? 0) === 1 ? { ok: true } : { ok: false, kind: "missing" };
}

/* ---- the page's own SEO fields ----------------------------------------------------------------------------------------- */

export type SaveSeoResult = { ok: true; updatedAt: string; changedFields: string[] } | SaveFailure;

/** Saves the SEO fields of a page that has a route. Empty text is stored as NULL ("use the default"). */
export async function savePageSeo(db: Db, template: PageTemplate, input: unknown, expectedUpdatedAt: string, userId: string): Promise<SaveSeoResult> {
  if (!TEMPLATES[template]?.hasSeo) return invalid({ form: "This page has no search settings of its own." });
  const parsed = pageSeoSchema.safeParse(input);
  if (!parsed.success) {
    const errors: SectionErrors = {};
    for (const i of parsed.error.issues) { const k = i.path.join(".") || "form"; if (!(k in errors)) errors[k] = i.message; }
    return invalid(errors);
  }
  const v: PageSeoInput = parsed.data;
  const row = await db.prepare("SELECT * FROM pages WHERE template = ?1").bind(template).first<Row>();
  if (!row) return { ok: false, kind: "missing" };
  if (v.ogImageId) {
    const errs = await checkRefs(db, [{ path: "ogImageId", kind: "media", id: v.ogImageId, mediaKind: "image" }]);
    if (errs.ogImageId) return invalid(errs);
  }
  const expected = s(row.updated_at);
  if (expected !== expectedUpdatedAt) return { ok: false, kind: "conflict" };
  let now = new Date().toISOString();
  if (now <= expected) now = new Date(Date.parse(expected) + 1).toISOString();
  const next = { seoTitle: v.seoTitle || null, seoDescription: v.seoDescription || null, ogImageId: v.ogImageId || null, canonicalUrl: v.canonicalUrl || null, noindex: v.noindex, nofollow: v.nofollow };
  const before = toPage(row);
  const res = await db
    .prepare("UPDATE pages SET seo_title = ?3, seo_description = ?4, og_image_id = ?5, canonical_url = ?6, noindex = ?7, nofollow = ?10, updated_at = ?8, updated_by = ?9 WHERE id = ?1 AND updated_at = ?2")
    .bind(s(row.id), expected, next.seoTitle, next.seoDescription, next.ogImageId, next.canonicalUrl, next.noindex ? 1 : 0, now, userId, next.nofollow ? 1 : 0)
    .run();
  if ((res.meta?.changes ?? 0) !== 1) return { ok: false, kind: "conflict" };
  const names = (["seoTitle", "seoDescription", "ogImageId", "canonicalUrl", "noindex", "nofollow"] as const).filter((k) => before[k] !== next[k]);
  return { ok: true, updatedAt: now, changedFields: names };
}

/* ---- what the admin screens show ------------------------------------------------------------------------------------- */

/** How a page's search settings stand: its own values, the defaults from Settings, or kept out of search engines. Null for copy that is not a page. */
export type SeoStatus = "custom" | "default" | "noindex" | "nofollow";

export type PageSummary = { template: PageTemplate; id: string; label: string; route: string | null; slug: string; status: PageStatus; sections: number; hidden: number; updatedAt: string | null; seeded: boolean; seo: SeoStatus | null };

/** Every page of the CMS with how many sections it has, how many are hidden and when something on it last changed. A page that has not been seeded is listed too. */
export async function listPages(db: Db): Promise<PageSummary[]> {
  const pages = (await db.prepare("SELECT id, slug, template, status, seo_title, seo_description, og_image_id, canonical_url, noindex, nofollow, updated_at FROM pages").all<Row>()).results ?? [];
  const secs = (await db.prepare("SELECT page_id, is_enabled, updated_at FROM page_sections").all<Row>()).results ?? [];
  return (Object.keys(TEMPLATES) as PageTemplate[]).map((template) => {
    const p = pages.find((x) => x.template === template);
    const mine = p ? secs.filter((x) => x.page_id === p.id) : [];
    const newest = [...mine.map((x) => s(x.updated_at)), ...(p ? [s(p.updated_at)] : [])].sort().pop() ?? null;
    const own = !!p && !!(p.seo_title || p.seo_description || p.og_image_id || p.canonical_url);
    const seo: SeoStatus | null = !TEMPLATES[template].hasSeo ? null : p?.noindex === 1 ? "noindex" : p?.nofollow === 1 ? "nofollow" : own ? "custom" : "default";
    return { template, id: p ? s(p.id) : `page_${template}`, label: TEMPLATES[template].label, route: TEMPLATES[template].route, slug: p ? s(p.slug) : template.replace(/_/g, "-"), status: p ? (s(p.status) as PageStatus) : "published", sections: TEMPLATES[template].sections.length, hidden: mine.filter((x) => x.is_enabled !== 1).length, updatedAt: newest, seeded: !!p, seo };
  });
}

export type SectionSummary = { key: string; name: string; type: SectionType; typeLabel: string; canDisable: boolean; anchor?: string; enabled: boolean; /** null: no row yet */ updatedAt: string | null; /** the saved content no longer passes its schema (the default is drawn) */ damaged: boolean };

/** The sections of a page in order, with what the page overview needs. */
export async function listSections(db: Db, template: PageTemplate): Promise<{ page: PageRecord | null; sections: SectionSummary[] }> {
  const pageRow = await db.prepare("SELECT * FROM pages WHERE template = ?1").bind(template).first<Row>();
  const rows = pageRow ? ((await db.prepare("SELECT section_key, section_type, is_enabled, content, updated_at FROM page_sections WHERE page_id = ?1").bind(pageRow.id).all<Row>()).results ?? []) : [];
  const sections = TEMPLATES[template].sections.map((slot): SectionSummary => {
    const row = rows.find((r) => r.section_key === slot.key);
    let damaged = false;
    if (row) {
      try { damaged = s(row.section_type) !== slot.type || !SECTION_TYPES[slot.type].schema.safeParse(JSON.parse(s(row.content))).success; } catch { damaged = true; }
    }
    return { key: slot.key, name: slot.name, type: slot.type, typeLabel: SECTION_TYPES[slot.type].label, canDisable: slot.canDisable, ...(slot.anchor ? { anchor: slot.anchor } : {}), enabled: slot.canDisable ? !row || row.is_enabled === 1 : true, updatedAt: row ? s(row.updated_at) : null, damaged };
  });
  return { page: pageRow ? toPage(pageRow) : null, sections };
}

export type SectionForEdit = { type: SectionType; /** What the editor starts from: the saved content, or the default if the saved content is damaged. */ content: unknown; updatedAt: string; damaged: boolean; enabled: boolean };

/** One section for its editor, or null if the section does not exist or has no row (the page has not been seeded). */
export async function readSectionForEdit(db: Db, template: PageTemplate, key: string): Promise<SectionForEdit | null> {
  const slot = slotOf(template, key);
  if (!slot) return null;
  const row = await db.prepare("SELECT s.section_type, s.content, s.updated_at, s.is_enabled FROM page_sections s JOIN pages p ON p.id = s.page_id WHERE p.template = ?1 AND s.section_key = ?2").bind(template, key).first<Row>();
  if (!row) return null;
  let content: unknown;
  let damaged = s(row.section_type) !== slot.type;
  if (!damaged) {
    try {
      const parsed = SECTION_TYPES[slot.type].schema.safeParse(JSON.parse(s(row.content)));
      if (parsed.success) content = parsed.data; else damaged = true;
    } catch { damaged = true; }
  }
  return { type: slot.type, content: damaged ? defaultContent(template, key) : content, updatedAt: s(row.updated_at), damaged, enabled: slot.canDisable ? row.is_enabled === 1 : true };
}

export type Revision = {
  id: string;
  /** When this version was saved, and when the next save replaced it. */
  savedAt: string;
  replacedAt: string;
  /** Who saved it (null if that user is gone). */
  by: string | null;
  /** The content, or null if it no longer passes the section's schema (it cannot be loaded into the editor). */
  content: unknown;
};

/** The earlier saved versions of a section, newest first (at most REVISIONS_KEPT). */
export async function listRevisions(db: Db, template: PageTemplate, key: string): Promise<Revision[]> {
  const slot = slotOf(template, key);
  if (!slot) return [];
  const rows = (
    await db
      .prepare(
        `SELECT r.id, r.content, r.saved_at, r.replaced_at, u.name AS by_name FROM page_section_revisions r
           JOIN page_sections s ON s.id = r.section_id JOIN pages p ON p.id = s.page_id
           LEFT JOIN users u ON u.id = r.saved_by
          WHERE p.template = ?1 AND s.section_key = ?2 ORDER BY r.replaced_at DESC, r.id DESC LIMIT ${REVISIONS_KEPT}`,
      )
      .bind(template, key)
      .all<Row>()
  ).results ?? [];
  return rows.map((r) => {
    let content: unknown = null;
    try {
      const parsed = SECTION_TYPES[slot.type].schema.safeParse(JSON.parse(s(r.content)));
      if (parsed.success) content = parsed.data;
    } catch { /* an unreadable old version is listed without content */ }
    return { id: s(r.id), savedAt: s(r.saved_at), replacedAt: s(r.replaced_at), by: r.by_name == null ? null : s(r.by_name), content };
  });
}
