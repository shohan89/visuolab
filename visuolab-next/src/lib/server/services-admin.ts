import "server-only";
import { getServiceSeedNav } from "./services-nav";
import { publicMediaUrl } from "@/lib/media/url";
import { getDb } from "./db";
import type { ServiceInput } from "@/lib/validation/service";

/*
 * Write side (and admin reads) for services. Public pages read through cms.ts; nothing here is used by them.
 * Every function assumes the caller already passed requireAdmin(); the actions in src/actions/services.ts do that.
 */

type Row = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "");
const parse = <T>(v: unknown): T => JSON.parse(String(v)) as T;
const now = () => new Date().toISOString();

/* ---- lists ---------------------------------------------------------------------------------------------------- */

export type ServiceListItem = { id: string; slug: string; title: string; status: string; position: number; updatedAt: string; publishedAt: string | null; caseCount: number };
export type StatusFilter = "all" | "draft" | "published" | "archived";

// D1 limits a LIKE pattern to 50 bytes, so searches and reference scans use instr() instead: no pattern, no length limit, no wildcards to escape
const has = (col: string, p: string) => `instr(lower(${col}), ${p}) > 0`;

export async function listServices(opts: { q?: string; status?: StatusFilter }): Promise<{ items: ServiceListItem[]; counts: Record<StatusFilter, number>; total: number }> {
  const db = getDb();
  const where: string[] = [];
  const binds: unknown[] = [];
  if (opts.q?.trim()) {
    binds.push(opts.q.trim().slice(0, 100).toLowerCase());
    where.push(`(${["v.title", "v.slug", "v.meta_title"].map((c) => has(c, `?${binds.length}`)).join(" OR ")})`);
  }
  if (opts.status && opts.status !== "all") {
    binds.push(opts.status);
    where.push(`v.status = ?${binds.length}`);
  }
  const rows = await db
    .prepare(
      `SELECT v.id, v.slug, v.title, v.status, v.position, v.updated_at, v.published_at,
              (SELECT COUNT(*) FROM service_case_studies l WHERE l.service_id = v.id) AS cases
         FROM services v ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY v.position, v.slug`,
    )
    .bind(...binds)
    .all<Row>();
  const c = await db.prepare("SELECT status, COUNT(*) AS n FROM services GROUP BY status").all<{ status: string; n: number }>();
  const counts: Record<StatusFilter, number> = { all: 0, draft: 0, published: 0, archived: 0 };
  for (const r of c.results ?? []) { counts[r.status as StatusFilter] = r.n; counts.all += r.n; }
  const items = (rows.results ?? []).map((r) => ({ id: s(r.id), slug: s(r.slug), title: s(r.title), status: s(r.status), position: Number(r.position), updatedAt: s(r.updated_at), publishedAt: (r.published_at as string | null) ?? null, caseCount: Number(r.cases) }));
  return { items, counts, total: items.length };
}

export type MediaOption = { id: string; title: string; url: string; width: number | null; height: number | null };
export async function mediaOptions(): Promise<MediaOption[]> {
  const r = await getDb().prepare("SELECT id, title, url, width, height FROM media WHERE kind = 'image' ORDER BY created_at DESC, slug LIMIT 300").all<Row>(); // newest 300; a file chosen earlier is looked up by id when it is not in this list
  return (r.results ?? []).map((m) => ({ id: s(m.id), title: s(m.title), url: publicMediaUrl(s(m.url)), width: (m.width as number | null) ?? null, height: (m.height as number | null) ?? null }));
}

export type CaseOption = { id: string; label: string; status: string };
export async function caseOptions(): Promise<CaseOption[]> {
  const r = await getDb().prepare("SELECT id, client_name, slug, status FROM case_studies ORDER BY position, slug").all<Row>();
  return (r.results ?? []).map((c) => ({ id: s(c.id), label: `${s(c.client_name)} (${s(c.slug)})`, status: s(c.status) }));
}

/* ---- one service as a form ------------------------------------------------------------------------------------ */

export type ServiceRecord = { id: string; position: number; createdAt: string; updatedAt: string; publishedAt: string | null; input: ServiceInput };

export async function getServiceRecord(id: string): Promise<ServiceRecord | null> {
  const db = getDb();
  const v = await db.prepare("SELECT * FROM services WHERE id = ?1").bind(id).first<Row>();
  if (!v) return null;
  const links = await db.prepare("SELECT case_study_id FROM service_case_studies WHERE service_id = ?1 ORDER BY position").bind(id).all<{ case_study_id: string }>();
  const shots = parse<{ alt: string }[]>(v.hero_shots_json);
  const problems = parse<{ label: string; title: string; items: ServiceInput["problems"]["items"] }>(v.problems_json);
  const band = parse<{ text: string; cta: { label: string; href: string } }>(v.band_json);
  const cases = parse<{ label: string; title: string }>(v.cases_json);
  return {
    id: s(v.id), position: Number(v.position), createdAt: s(v.created_at), updatedAt: s(v.updated_at), publishedAt: (v.published_at as string | null) ?? null,
    input: {
      title: s(v.title), slug: s(v.slug), status: s(v.status) as ServiceInput["status"],
      metaTitle: s(v.meta_title), metaDescription: s(v.meta_description),
      heroTitle: s(v.hero_title), heroLead: s(v.hero_lead), heroCtaLabel: s(v.hero_cta_label), heroCtaHref: s(v.hero_cta_href),
      heroImageA: s(v.hero_image_a_id), heroImageAAlt: shots[0]?.alt ?? "", heroImageB: s(v.hero_image_b_id), heroImageBAlt: shots[1]?.alt ?? "",
      showProblems: Boolean(v.show_problems), problems,
      overview: parse(v.overview_json), outcomes: parse(v.outcomes_json),
      showBand: Boolean(v.show_band), band: { text: band.text, ctaLabel: band.cta.label, ctaHref: band.cta.href },
      included: parse(v.included_json), process: parse(v.process_json),
      casesLabel: cases.label, casesTitle: cases.title, caseIds: (links.results ?? []).map((l) => l.case_study_id),
    },
  };
}

/* ---- slugs ---------------------------------------------------------------------------------------------------- */

export async function slugInUse(slug: string, exceptId?: string): Promise<boolean> {
  const r = await getDb().prepare("SELECT id FROM services WHERE slug = ?1 AND id <> ?2").bind(slug, exceptId ?? "").first();
  return !!r;
}

/** Foreign keys the form could not verify on its own: every chosen image and case study must exist. Returns field errors. */
export async function checkReferences(input: ServiceInput): Promise<Record<string, string>> {
  const db = getDb();
  const errors: Record<string, string> = {};
  for (const [key, id] of [["heroImageA", input.heroImageA], ["heroImageB", input.heroImageB]] as const) {
    const m = await db.prepare("SELECT 1 AS ok FROM media WHERE id = ?1 AND kind = 'image'").bind(id).first();
    if (!m) errors[key] = "Choose an image from the list";
  }
  if (input.caseIds.length) {
    const marks = input.caseIds.map((_, i) => `?${i + 1}`).join(",");
    const found = await db.prepare(`SELECT COUNT(*) AS n FROM case_studies WHERE id IN (${marks})`).bind(...input.caseIds).first<{ n: number }>();
    if ((found?.n ?? 0) !== input.caseIds.length) errors.caseIds = "One of the chosen case studies no longer exists";
  }
  return errors;
}

/* ---- writes --------------------------------------------------------------------------------------------------- */

/** `previous`: the stored hero shots and image ids of the service being saved. An image that has not changed keeps the size recorded for it. */
async function columns(input: ServiceInput, previous?: { ids: (string | null)[]; shots: { width?: number; height?: number }[] }) {
  const db = getDb();
  const [a, b] = await Promise.all(
    [input.heroImageA, input.heroImageB].map((id) => db.prepare("SELECT width, height FROM media WHERE id = ?1").bind(id).first<{ width: number | null; height: number | null }>()),
  );
  const size = (m: typeof a, i: number, id: string) => {
    const kept = previous && previous.ids[i] === id ? previous.shots[i] : undefined;
    const w = kept?.width ?? m?.width;
    const h = kept?.height ?? m?.height;
    return w && h ? { width: w, height: h } : {};
  };
  const shot = (m: typeof a, i: number, id: string, alt: string) => ({ alt, ...size(m, i, id), priority: i === 0, lazy: i !== 0 });
  return {
    shots: JSON.stringify([shot(a, 0, input.heroImageA, input.heroImageAAlt), shot(b, 1, input.heroImageB, input.heroImageBAlt)]),
    problems: JSON.stringify(input.problems),
    overview: JSON.stringify(input.overview),
    outcomes: JSON.stringify(input.outcomes),
    band: JSON.stringify({ text: input.band.text, cta: { label: input.band.ctaLabel, href: input.band.ctaHref } }),
    included: JSON.stringify(input.included),
    process: JSON.stringify(input.process),
    cases: JSON.stringify({ label: input.casesLabel, title: input.casesTitle }),
  };
}

const caseLinks = (serviceId: string, ids: string[]) => [
  getDb().prepare("DELETE FROM service_case_studies WHERE service_id = ?1").bind(serviceId),
  ...ids.map((cid, i) => getDb().prepare("INSERT INTO service_case_studies (service_id, case_study_id, position) VALUES (?1, ?2, ?3)").bind(serviceId, cid, i)),
];

export async function createService(input: ServiceInput): Promise<string> {
  const db = getDb();
  const id = `svc_${crypto.randomUUID()}`;
  const t = now();
  const c = await columns(input);
  const pos = await db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM services").first<{ p: number }>();
  await db.batch([
    db.prepare("DELETE FROM slug_redirects WHERE kind = 'service' AND old_slug = ?1").bind(input.slug), // a new page claims the address
    db
      .prepare(
        `INSERT INTO services (id, slug, title, status, position, meta_title, meta_description, hero_title, hero_lead, hero_cta_label, hero_cta_href,
           hero_image_a_id, hero_image_b_id, hero_shots_json, show_problems, problems_json, overview_json, outcomes_json, show_band, band_json,
           included_json, process_json, cases_json, created_at, updated_at, published_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?24,?25)`,
      )
      .bind(id, input.slug, input.title, input.status, pos?.p ?? 0, input.metaTitle, input.metaDescription, input.heroTitle, input.heroLead, input.heroCtaLabel, input.heroCtaHref,
        input.heroImageA, input.heroImageB, c.shots, input.showProblems ? 1 : 0, c.problems, c.overview, c.outcomes, input.showBand ? 1 : 0, c.band, c.included, c.process, c.cases, t,
        input.status === "published" ? t : null),
    ...caseLinks(id, input.caseIds),
  ]);
  return id;
}

/** Saves the form. A changed slug keeps the old address alive as a permanent redirect. Returns the previous slug when it changed. */
export async function updateService(id: string, input: ServiceInput): Promise<{ oldSlug: string | null }> {
  const db = getDb();
  const cur = await db
    .prepare("SELECT slug, status, published_at, hero_image_a_id, hero_image_b_id, hero_shots_json FROM services WHERE id = ?1")
    .bind(id)
    .first<{ slug: string; status: string; published_at: string | null; hero_image_a_id: string | null; hero_image_b_id: string | null; hero_shots_json: string }>();
  if (!cur) throw new Error("not found");
  const t = now();
  const c = await columns(input, { ids: [cur.hero_image_a_id, cur.hero_image_b_id], shots: parse(cur.hero_shots_json) });
  const publishedAt = input.status === "published" ? cur.published_at ?? t : cur.published_at;
  const changed = cur.slug !== input.slug;
  await db.batch([
    ...(changed
      ? [
          db.prepare("DELETE FROM slug_redirects WHERE kind = 'service' AND old_slug = ?1").bind(input.slug),
          db.prepare("UPDATE slug_redirects SET new_slug = ?2 WHERE kind = 'service' AND new_slug = ?1").bind(cur.slug, input.slug), // no chains
          db.prepare("INSERT INTO slug_redirects (id, kind, old_slug, new_slug, created_at) VALUES (?1, 'service', ?2, ?3, ?4)").bind(crypto.randomUUID(), cur.slug, input.slug, t),
        ]
      : []),
    db
      .prepare(
        `UPDATE services SET slug=?2, title=?3, status=?4, meta_title=?5, meta_description=?6, hero_title=?7, hero_lead=?8, hero_cta_label=?9, hero_cta_href=?10,
           hero_image_a_id=?11, hero_image_b_id=?12, hero_shots_json=?13, show_problems=?14, problems_json=?15, overview_json=?16, outcomes_json=?17,
           show_band=?18, band_json=?19, included_json=?20, process_json=?21, cases_json=?22, updated_at=?23, published_at=?24
         WHERE id = ?1`,
      )
      .bind(id, input.slug, input.title, input.status, input.metaTitle, input.metaDescription, input.heroTitle, input.heroLead, input.heroCtaLabel, input.heroCtaHref,
        input.heroImageA, input.heroImageB, c.shots, input.showProblems ? 1 : 0, c.problems, c.overview, c.outcomes, input.showBand ? 1 : 0, c.band, c.included, c.process, c.cases, t, publishedAt),
    ...caseLinks(id, input.caseIds),
  ]);
  return { oldSlug: changed ? cur.slug : null };
}

export async function setServiceStatus(id: string, status: "draft" | "published" | "archived"): Promise<void> {
  const t = now();
  await getDb()
    .prepare("UPDATE services SET status = ?2, updated_at = ?3, published_at = CASE WHEN ?2 = 'published' THEN COALESCE(published_at, ?3) ELSE published_at END WHERE id = ?1")
    .bind(id, status, t)
    .run();
}

/** Swaps places with the neighbour above or below. Positions are renumbered 0..n-1 first so ties and gaps cannot confuse the swap. */
export async function moveService(id: string, dir: "up" | "down"): Promise<boolean> {
  const db = getDb();
  const rows = (await db.prepare("SELECT id FROM services ORDER BY position, slug").all<{ id: string }>()).results ?? [];
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return false;
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  const t = now();
  await db.batch(order.map((rid, p) => db.prepare("UPDATE services SET position = ?2, updated_at = CASE WHEN id IN (?3, ?4) THEN ?5 ELSE updated_at END WHERE id = ?1").bind(rid, p, id, rows[j]!.id, t)));
  return true;
}

export async function deleteService(id: string): Promise<void> {
  const db = getDb();
  await db.batch([
    db.prepare("DELETE FROM slug_redirects WHERE kind = 'service' AND new_slug = (SELECT slug FROM services WHERE id = ?1)").bind(id), // redirects to a page that is gone would only end in a 404
    db.prepare("DELETE FROM services WHERE id = ?1").bind(id), // service_case_studies rows go with it (ON DELETE CASCADE); the case studies stay
  ]);
}

/* ---- what would break ----------------------------------------------------------------------------------------- */

export type Reference = { where: string; detail: string };

/**
 * Places that link to the public page /services/<slug>. Used before hiding, deleting or renaming a published service:
 * the page's address would stop working (or start redirecting) for all of these.
 */
export async function serviceReferences(slug: string, id: string): Promise<Reference[]> {
  const db = getDb();
  const path = `/services/${slug}`;
  const out: Reference[] = [];
  const nav = await db.prepare("SELECT menu, label FROM navigation_items WHERE href = ?1 OR instr(href, ?2) = 1").bind(path, `${path}/`).all<{ menu: string; label: string }>();
  for (const n of nav.results ?? []) out.push({ where: `Navigation (${n.menu.replace("_", " ")})`, detail: n.label });
  const set = await db.prepare("SELECT title FROM site_settings WHERE instr(value_json, ?1) > 0").bind(path).all<{ title: string }>();
  for (const r of set.results ?? []) out.push({ where: "Site content", detail: r.title });
  const svc = await db.prepare("SELECT title FROM services WHERE id <> ?1 AND (hero_cta_href = ?2 OR instr(band_json, ?3) > 0 OR instr(included_json, ?3) > 0)").bind(id, path, path).all<{ title: string }>();
  for (const r of svc.results ?? []) out.push({ where: "Another service page", detail: r.title });
  const posts = await db.prepare("SELECT title FROM blog_posts WHERE instr(outro_json, ?1) > 0 OR instr(body_json, ?1) > 0").bind(path).all<{ title: string }>();
  for (const r of posts.results ?? []) out.push({ where: "Blog post", detail: r.title });
  if (getServiceSeedNav().includes(path)) out.push({ where: "Site menu and footer", detail: "Built into the website's pages (header menu, footer, home page)" });
  return out;
}
