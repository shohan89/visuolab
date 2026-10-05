import "server-only";
import { inputToColumns, inputToImages, rowToInput, type MoreDoc, type Row } from "@/lib/content/case-study-mapper";
import type { CaseStudyInput } from "@/lib/validation/case-study";
import { getDb } from "./db";
import { builtInLinksToCase } from "./services-nav";

/*
 * Write side (and admin reads) for case studies. The public pages read through cms.ts and the mapper; nothing here is used by them.
 * Every function assumes the caller already passed requireAdmin(); the actions in src/actions/case-studies.ts do that.
 */

const s = (v: unknown) => String(v ?? "");
const now = () => new Date().toISOString();
// D1 limits a LIKE pattern to 50 bytes, so searches and reference scans use instr() instead: no pattern, no length limit, no wildcards to escape
const has = (col: string, p: string) => `instr(lower(${col}), ${p}) > 0`;

/* ---- lists ---------------------------------------------------------------------------------------------------- */

export type CaseListItem = {
  id: string; slug: string; title: string; clientName: string; year: string; typeLine: string; status: string; featured: boolean; position: number;
  updatedAt: string; imageUrl: string; images: number; filters: string[];
};
export type CaseStatusFilter = "all" | "draft" | "published" | "archived";

export type CaseListQuery = { q?: string; status?: CaseStatusFilter; featured?: boolean; discipline?: string };

export async function listCaseStudies(opts: CaseListQuery): Promise<{ items: CaseListItem[]; counts: Record<CaseStatusFilter | "featured", number> }> {
  const db = getDb();
  const where: string[] = [];
  const binds: unknown[] = [];
  const bind = (v: unknown) => { binds.push(v); return `?${binds.length}`; };
  if (opts.q?.trim()) {
    const p = bind(opts.q.trim().slice(0, 100).toLowerCase());
    where.push(`(${["c.title", "c.slug", "c.client_name", "c.type_line", "c.facts_json"].map((x) => has(x, p)).join(" OR ")})`);
  }
  if (opts.status && opts.status !== "all") where.push(`c.status = ${bind(opts.status)}`);
  if (opts.featured) where.push("c.featured = 1");
  if (opts.discipline) where.push(`instr(c.filters_json, ${bind(`"${opts.discipline.replace(/[^a-z]/g, "")}"`)}) > 0`);
  const rows = await db
    .prepare(
      `SELECT c.id, c.slug, c.title, c.client_name, c.year, c.type_line, c.status, c.featured, c.position, c.updated_at, c.filters_json, m.url AS image_url,
              (SELECT COUNT(*) FROM case_study_images i WHERE i.case_study_id = c.id) AS images
         FROM case_studies c JOIN media m ON m.id = c.card_image_id ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY c.position, c.slug`,
    )
    .bind(...binds)
    .all<Row>();
  const c = await db.prepare("SELECT status, COUNT(*) AS n, SUM(featured) AS f FROM case_studies GROUP BY status").all<{ status: string; n: number; f: number }>();
  const counts: Record<CaseStatusFilter | "featured", number> = { all: 0, draft: 0, published: 0, archived: 0, featured: 0 };
  for (const r of c.results ?? []) { counts[r.status as CaseStatusFilter] = r.n; counts.all += r.n; counts.featured += r.f ?? 0; }
  const items = (rows.results ?? []).map((r) => ({
    id: s(r.id), slug: s(r.slug), title: s(r.title).replace(/<[^>]*>/g, ""), clientName: s(r.client_name), year: s(r.year), typeLine: s(r.type_line), status: s(r.status),
    featured: Boolean(r.featured), position: Number(r.position), updatedAt: s(r.updated_at), imageUrl: s(r.image_url), images: Number(r.images), filters: JSON.parse(s(r.filters_json)) as string[],
  }));
  return { items, counts };
}

export type ServiceOption = { id: string; title: string; status: string };
export async function serviceOptions(): Promise<ServiceOption[]> {
  const r = await getDb().prepare("SELECT id, title, status FROM services ORDER BY position, slug").all<Row>();
  return (r.results ?? []).map((x) => ({ id: s(x.id), title: s(x.title), status: s(x.status) }));
}

export type OtherCase = { slug: string; label: string; status: string };
/** Case studies that can be chosen under "More work" (every one except the case study itself). */
export async function otherCases(exceptId?: string): Promise<OtherCase[]> {
  const r = await getDb().prepare("SELECT slug, client_name, status FROM case_studies WHERE id <> ?1 ORDER BY position, slug").bind(exceptId ?? "").all<Row>();
  return (r.results ?? []).map((x) => ({ slug: s(x.slug), label: `${s(x.client_name)} (${s(x.slug)})`, status: s(x.status) }));
}

/* ---- one case study as a form --------------------------------------------------------------------------------- */

export type CaseRecord = { id: string; position: number; createdAt: string; updatedAt: string; publishedAt: string | null; input: CaseStudyInput };

export async function getCaseRecord(id: string): Promise<CaseRecord | null> {
  const db = getDb();
  const c = await db.prepare("SELECT * FROM case_studies WHERE id = ?1").bind(id).first<Row>();
  if (!c) return null;
  const images = (await db.prepare("SELECT * FROM case_study_images WHERE case_study_id = ?1").bind(id).all<Row>()).results ?? [];
  const links = (await db.prepare("SELECT service_id FROM service_case_studies WHERE case_study_id = ?1").bind(id).all<{ service_id: string }>()).results ?? [];
  return { id: s(c.id), position: Number(c.position), createdAt: s(c.created_at), updatedAt: s(c.updated_at), publishedAt: (c.published_at as string | null) ?? null, input: rowToInput(c, images, links.map((l) => l.service_id)) };
}

/* ---- checks --------------------------------------------------------------------------------------------------- */

export async function caseSlugInUse(slug: string, exceptId?: string): Promise<boolean> {
  return !!(await getDb().prepare("SELECT id FROM case_studies WHERE slug = ?1 AND id <> ?2").bind(slug, exceptId ?? "").first());
}

/** Things a form cannot verify itself: every chosen image, case study and service must exist. Returns field errors. */
export async function checkCaseReferences(input: CaseStudyInput): Promise<Record<string, string>> {
  const db = getDb();
  const errors: Record<string, string> = {};
  const imageOk = async (id: string) => !!(await db.prepare("SELECT 1 AS ok FROM media WHERE id = ?1 AND kind = 'image'").bind(id).first());
  if (!(await imageOk(input.cardImage))) errors.cardImage = "Choose an image from the list";
  if (!(await imageOk(input.coverImage))) errors.coverImage = "Choose an image from the list";
  const gal = (key: string, list: { media: string }[]) => Promise.all(list.map(async (g, i) => { if (!(await imageOk(g.media))) errors[`${key}.${i}.media`] = "Choose an image from the list"; }));
  await gal("galleryA", input.galleryA); await gal("galleryB", input.galleryB); await gal("wide", [input.wide]);
  const slugs = (await db.prepare("SELECT slug FROM case_studies").all<{ slug: string }>()).results?.map((r) => r.slug) ?? [];
  if (input.more.slugs.some((x) => !slugs.includes(x))) errors["more.slugs"] = "One of the chosen projects no longer exists";
  if (input.serviceIds.length) {
    const marks = input.serviceIds.map((_, i) => `?${i + 1}`).join(",");
    const n = await db.prepare(`SELECT COUNT(*) AS n FROM services WHERE id IN (${marks})`).bind(...input.serviceIds).first<{ n: number }>();
    if ((n?.n ?? 0) !== input.serviceIds.length) errors.serviceIds = "One of the chosen services no longer exists";
  }
  return errors;
}

/* ---- writes --------------------------------------------------------------------------------------------------- */

const imageStatements = (caseId: string, input: CaseStudyInput, t: string) => {
  const db = getDb();
  return [
    db.prepare("DELETE FROM case_study_images WHERE case_study_id = ?1").bind(caseId),
    ...inputToImages(input).map((i) =>
      db
        .prepare("INSERT INTO case_study_images (id, case_study_id, media_id, role, position, caption, alt_text, object_position, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)")
        .bind(`img_${crypto.randomUUID()}`, caseId, i.media, i.role, i.index, i.caption, i.alt, i.position, t),
    ),
  ];
};

/** Make the service links match the chosen services: keep the order of links that stay, add new ones at the end, drop the rest. */
const serviceLinkStatements = (caseId: string, serviceIds: string[]) => {
  const db = getDb();
  const marks = serviceIds.map((_, i) => `?${i + 2}`).join(",");
  return [
    serviceIds.length
      ? db.prepare(`DELETE FROM service_case_studies WHERE case_study_id = ?1 AND service_id NOT IN (${marks})`).bind(caseId, ...serviceIds)
      : db.prepare("DELETE FROM service_case_studies WHERE case_study_id = ?1").bind(caseId),
    ...serviceIds.map((sid) =>
      db
        .prepare("INSERT OR IGNORE INTO service_case_studies (service_id, case_study_id, position) VALUES (?1, ?2, (SELECT COALESCE(MAX(position), -1) + 1 FROM service_case_studies WHERE service_id = ?1))")
        .bind(sid, caseId),
    ),
  ];
};

const COLS = `slug, title, status, featured, meta_title, meta_description, client_name, year, type_line, short_kind, card_tags_json, filters_json, card_image_id, card_image_alt,
  cover_image_id, cover_image_alt, facts_json, about_label, about_lead, stats_json, showcase_json, process_json, challenges_json, results_json, more_json`;

function values(input: CaseStudyInput) {
  const c = inputToColumns(input);
  return [
    input.slug, input.title, input.status, input.featured ? 1 : 0, input.metaTitle, input.metaDescription, input.clientName, input.year, input.typeLine, input.shortKind,
    c.card_tags_json, c.filters_json, input.cardImage, input.cardImageAlt, input.coverImage, input.coverImageAlt, c.facts_json, input.aboutLabel, input.description, c.stats_json,
    c.showcase_json, c.process_json, c.challenges_json, c.results_json, c.more_json,
  ];
}

export async function createCaseStudy(input: CaseStudyInput): Promise<string> {
  const db = getDb();
  const id = `case_${crypto.randomUUID()}`;
  const t = now();
  const pos = await db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM case_studies").first<{ p: number }>();
  const v = values(input);
  const marks = v.map((_, i) => `?${i + 5}`).join(",");
  await db.batch([
    db.prepare("DELETE FROM slug_redirects WHERE kind = 'case_study' AND old_slug = ?1").bind(input.slug),
    db
      .prepare(`INSERT INTO case_studies (id, position, created_at, updated_at, ${COLS}, published_at) VALUES (?1, ?2, ?3, ?3, ${marks}, ?4)`)
      .bind(id, pos?.p ?? 0, t, input.status === "published" ? t : null, ...v),
    ...imageStatements(id, input, t),
    ...serviceLinkStatements(id, input.serviceIds),
  ]);
  return id;
}

/** Rewrites the "More work" slug lists of the other case studies when a slug changes (to the new slug) or goes away (null removes it). */
async function rewriteMoreLists(oldSlug: string, newSlug: string | null, exceptId: string) {
  const db = getDb();
  const rows = (await db.prepare("SELECT id, more_json FROM case_studies WHERE id <> ?1 AND instr(more_json, ?2) > 0").bind(exceptId, `"${oldSlug}"`).all<{ id: string; more_json: string }>()).results ?? [];
  return rows.map((r) => {
    const doc = JSON.parse(r.more_json) as MoreDoc;
    doc.slugs = newSlug ? doc.slugs.map((x) => (x === oldSlug ? newSlug : x)) : doc.slugs.filter((x) => x !== oldSlug);
    return db.prepare("UPDATE case_studies SET more_json = ?2 WHERE id = ?1").bind(r.id, JSON.stringify(doc));
  });
}

/** Saves the form. A changed slug keeps the old address as a redirect and updates the "More work" lists that name it. */
export async function updateCaseStudy(id: string, input: CaseStudyInput): Promise<{ oldSlug: string | null }> {
  const db = getDb();
  const cur = await db.prepare("SELECT slug, published_at FROM case_studies WHERE id = ?1").bind(id).first<{ slug: string; published_at: string | null }>();
  if (!cur) throw new Error("not found");
  const t = now();
  const changed = cur.slug !== input.slug;
  const v = values(input);
  const sets = COLS.split(",").map((c, i) => `${c.trim()} = ?${i + 4}`).join(", ");
  await db.batch([
    ...(changed
      ? [
          db.prepare("DELETE FROM slug_redirects WHERE kind = 'case_study' AND old_slug = ?1").bind(input.slug),
          db.prepare("UPDATE slug_redirects SET new_slug = ?2 WHERE kind = 'case_study' AND new_slug = ?1").bind(cur.slug, input.slug),
          db.prepare("INSERT INTO slug_redirects (id, kind, old_slug, new_slug, created_at) VALUES (?1, 'case_study', ?2, ?3, ?4)").bind(crypto.randomUUID(), cur.slug, input.slug, t),
          ...(await rewriteMoreLists(cur.slug, input.slug, id)),
        ]
      : []),
    db.prepare(`UPDATE case_studies SET updated_at = ?2, published_at = ?3, ${sets} WHERE id = ?1`).bind(id, t, input.status === "published" ? cur.published_at ?? t : cur.published_at, ...v),
    ...imageStatements(id, input, t),
    ...serviceLinkStatements(id, input.serviceIds),
  ]);
  return { oldSlug: changed ? cur.slug : null };
}

export async function setCaseStatus(id: string, status: "draft" | "published" | "archived"): Promise<void> {
  const t = now();
  await getDb()
    .prepare("UPDATE case_studies SET status = ?2, updated_at = ?3, published_at = CASE WHEN ?2 = 'published' THEN COALESCE(published_at, ?3) ELSE published_at END WHERE id = ?1")
    .bind(id, status, t)
    .run();
}

export async function setCaseFeatured(id: string, featured: boolean): Promise<void> {
  await getDb().prepare("UPDATE case_studies SET featured = ?2, updated_at = ?3 WHERE id = ?1").bind(id, featured ? 1 : 0, now()).run();
}

/** Swap places with the neighbour above or below; positions are renumbered 0..n-1 first. */
export async function moveCaseStudy(id: string, dir: "up" | "down"): Promise<boolean> {
  const db = getDb();
  const rows = (await db.prepare("SELECT id FROM case_studies ORDER BY position, slug").all<{ id: string }>()).results ?? [];
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return false;
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  const t = now();
  await db.batch(order.map((rid, p) => db.prepare("UPDATE case_studies SET position = ?2, updated_at = CASE WHEN id IN (?3, ?4) THEN ?5 ELSE updated_at END WHERE id = ?1").bind(rid, p, id, rows[j]!.id, t)));
  return true;
}

export async function deleteCaseStudy(id: string): Promise<void> {
  const db = getDb();
  const cur = await db.prepare("SELECT slug FROM case_studies WHERE id = ?1").bind(id).first<{ slug: string }>();
  if (!cur) return;
  await db.batch([
    ...(await rewriteMoreLists(cur.slug, null, id)), // other pages must not keep a link to it
    db.prepare("DELETE FROM slug_redirects WHERE kind = 'case_study' AND new_slug = ?1").bind(cur.slug),
    db.prepare("DELETE FROM case_studies WHERE id = ?1").bind(id), // images and service links go with it (ON DELETE CASCADE); the media files stay
  ]);
}

/* ---- what would break ----------------------------------------------------------------------------------------- */

export type Reference = { where: string; detail: string };

/** Everything that links to /works/<slug>. Used before hiding or deleting a published case study. */
export async function caseReferences(slug: string, id: string): Promise<Reference[]> {
  const db = getDb();
  const path = `/works/${slug}`;
  const out: Reference[] = [];
  const nav = await db.prepare("SELECT menu, label FROM navigation_items WHERE href = ?1 OR instr(href, ?2) = 1").bind(path, `${path}/`).all<{ menu: string; label: string }>();
  for (const n of nav.results ?? []) out.push({ where: `Navigation (${n.menu.replace("_", " ")})`, detail: n.label });
  const set = await db.prepare("SELECT title FROM site_settings WHERE instr(value_json, ?1) > 0 OR instr(value_json, ?2) > 0").bind(path, `"${slug}"`).all<{ title: string }>();
  for (const r of set.results ?? []) out.push({ where: "Site content", detail: r.title });
  const svc = await db.prepare("SELECT v.title FROM service_case_studies l JOIN services v ON v.id = l.service_id WHERE l.case_study_id = ?1 ORDER BY v.position").bind(id).all<{ title: string }>();
  for (const r of svc.results ?? []) out.push({ where: "Service page", detail: `${r.title} shows this case study` });
  const more = await db.prepare("SELECT client_name FROM case_studies WHERE id <> ?1 AND instr(more_json, ?2) > 0").bind(id, `"${slug}"`).all<{ client_name: string }>();
  for (const r of more.results ?? []) out.push({ where: "More work", detail: `Listed under ${r.client_name}` });
  const posts = await db.prepare("SELECT title FROM blog_posts WHERE instr(outro_json, ?1) > 0 OR instr(body_json, ?1) > 0").bind(path).all<{ title: string }>();
  for (const r of posts.results ?? []) out.push({ where: "Blog post", detail: r.title });
  if (builtInLinksToCase(slug)) out.push({ where: "Home and About pages", detail: "Built into the website's pages (work cards and hero)" });
  return out;
}
