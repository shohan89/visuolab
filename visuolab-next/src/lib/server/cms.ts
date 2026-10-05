/*
 * Read side of the CMS database: turns the rows back into the typed content the pages render (src/content/types.ts).
 * Every function takes the database as a parameter, so the same code runs in the Worker (D1) and in the verification
 * script (scripts/db/verify.mjs, SQLite). No function here writes. Pages do not use this yet: they still render the
 * typed content in src/content/*.ts; the verification script proves the two are identical.
 */
import type { BlogPost, CaseCardSeed, CaseStudy, ServiceSeed } from "@/content/types";
import { mapCaseCard, mapCaseStudy } from "../content/case-study-mapper.ts"; // relative with extension: scripts/db/verify.mjs loads this file in plain Node

type Db = D1Database;
type Row = Record<string, unknown>;
const all = async (db: Db, sql: string, ...binds: unknown[]): Promise<Row[]> => (await db.prepare(sql).bind(...binds).all<Row>()).results ?? [];
const parse = <T>(v: unknown): T => JSON.parse(String(v)) as T;
const s = (v: unknown) => String(v);

/** id -> public URL of every media row. */
export async function mediaUrls(db: Db): Promise<Record<string, string>> {
  const rows = await all(db, "SELECT id, url FROM media");
  return Object.fromEntries(rows.map((r) => [s(r.id), s(r.url)]));
}

const STATUS = "status = 'published'";

export async function getCaseStudies(db: Db, opts: { publishedOnly?: boolean; slug?: string } = {}): Promise<CaseStudy[]> {
  const media = await mediaUrls(db);
  const where = opts.publishedOnly ? `WHERE ${STATUS}` : "";
  const cases = await all(db, `SELECT * FROM case_studies ${where} ORDER BY position, slug`);
  const images = await all(db, "SELECT * FROM case_study_images ORDER BY case_study_id, role, position");
  const bySlug = Object.fromEntries(cases.map((c) => [s(c.slug), c]));
  return cases.filter((c) => !opts.slug || c.slug === opts.slug).map((c) => mapCaseStudy(c, images, media, bySlug));
}

/** One case study page model, or null. Drafts and archived ones only with `includeUnpublished`. */
export async function getCaseStudyBySlug(db: Db, slug: string, opts: { includeUnpublished?: boolean } = {}): Promise<CaseStudy | null> {
  const media = await mediaUrls(db);
  const rows = await all(db, `SELECT * FROM case_studies ${opts.includeUnpublished ? "" : `WHERE ${STATUS}`} ORDER BY position, slug`);
  const c = rows.find((r) => r.slug === slug);
  if (!c) return null;
  const images = await all(db, "SELECT * FROM case_study_images WHERE case_study_id = ?1 ORDER BY role, position", c.id);
  // "More work" lists only what visitors can open
  const published = Object.fromEntries(rows.filter((r) => r.status === "published").map((r) => [s(r.slug), r]));
  return mapCaseStudy(c, images, media, published);
}

export async function getServices(db: Db, opts: { publishedOnly?: boolean; slug?: string } = {}): Promise<ServiceSeed[]> {
  const media = await mediaUrls(db);
  const conds = [...(opts.publishedOnly ? [STATUS] : []), ...(opts.slug ? ["slug = ?1"] : [])];
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const services = await all(db, `SELECT * FROM services ${where} ORDER BY position, slug`, ...(opts.slug ? [opts.slug] : []));
  const links = await all(
    db,
    `SELECT l.service_id, l.position, c.slug, c.card_image_id, c.card_image_alt, c.card_tags_json, c.showcase_json
       FROM service_case_studies l JOIN case_studies c ON c.id = l.case_study_id ${opts.publishedOnly ? "WHERE c.status = 'published'" : ""} ORDER BY l.service_id, l.position`,
  );
  return services.map((v) => {
    const shots = parse<{ alt: string; width?: number; height?: number; priority?: boolean; lazy?: boolean }[]>(v.hero_shots_json);
    const ids = [v.hero_image_a_id, v.hero_image_b_id];
    const problems = parse<{ label: string; title: string; items: ServiceSeed["problems"]["items"] }>(v.problems_json);
    const band = parse<{ text: string; cta: { label: string; href: string } }>(v.band_json);
    const cases = parse<{ label: string; title: string }>(v.cases_json);
    return {
      slug: s(v.slug),
      meta: { title: s(v.meta_title), description: s(v.meta_description) },
      hero: {
        title: s(v.hero_title), lead: s(v.hero_lead), cta: { label: s(v.hero_cta_label), href: s(v.hero_cta_href) },
        shots: shots.map((x, i) => ({ src: media[s(ids[i])]!, alt: x.alt, ...(x.width ? { width: x.width, height: x.height } : {}), ...(x.priority ? { priority: true } : {}), ...(x.lazy ? { lazy: true } : {}) })),
      },
      problems: { hidden: !v.show_problems, label: problems.label, title: problems.title, items: problems.items },
      overview: parse(v.overview_json),
      outcomes: parse(v.outcomes_json),
      band: { hidden: !v.show_band, text: band.text, cta: band.cta },
      included: parse(v.included_json),
      process: parse(v.process_json),
      cases: {
        label: cases.label, title: cases.title,
        items: links.filter((l) => l.service_id === v.id).map((l): CaseCardSeed => {
          return mapCaseCard(s(l.slug), l.card_image_id, l.card_image_alt, l.showcase_json, media);
        }),
      },
    };
  });
}

export async function getBlogPosts(db: Db, opts: { publishedOnly?: boolean } = {}): Promise<BlogPost[]> {
  const media = await mediaUrls(db);
  const where = opts.publishedOnly ? "WHERE p.status = 'published'" : "";
  const rows = await all(db, `SELECT p.*, c.title AS category_title FROM blog_posts p JOIN blog_categories c ON c.id = p.category_id ${where} ORDER BY p.published_at DESC, p.slug`);
  return rows.map((p) => ({
    slug: s(p.slug),
    meta: { title: s(p.meta_title), description: s(p.meta_description) },
    category: s(p.category_title),
    title: s(p.title),
    publishedAt: s(p.published_at).slice(0, 10),
    readMinutes: Number(p.read_minutes),
    author: { name: s(p.author_name), avatar: media[s(p.author_image_id)]! },
    cover: { src: media[s(p.cover_image_id)]!, alt: s(p.cover_alt) },
    ...(p.excerpt ? { excerpt: s(p.excerpt) } : {}),
    lead: s(p.lead),
    body: parse(p.body_json),
    outro: parse(p.outro_json),
    related: parse(p.related_json),
  }));
}

export async function getBlogCategories(db: Db): Promise<string[]> {
  return (await all(db, `SELECT title FROM blog_categories WHERE ${STATUS} ORDER BY position`)).map((r) => s(r.title));
}

export async function getBlogTagsForPost(db: Db, slug: string): Promise<string[]> {
  const rows = await all(db, "SELECT t.title FROM blog_tags t JOIN blog_post_tags pt ON pt.tag_id = t.id JOIN blog_posts p ON p.id = pt.post_id WHERE p.slug = ?1 ORDER BY t.title", slug);
  return rows.map((r) => s(r.title));
}

/** One settings document by key, or null. */
export async function getSetting<T = unknown>(db: Db, key: string): Promise<T | null> {
  const row = await db.prepare(`SELECT value_json FROM site_settings WHERE key = ?1 AND ${STATUS}`).bind(key).first<Row>();
  return row ? parse<T>(row.value_json) : null;
}

export async function getAllSettings(db: Db): Promise<Record<string, unknown>> {
  const rows = await all(db, `SELECT key, value_json FROM site_settings WHERE ${STATUS} ORDER BY key`);
  return Object.fromEntries(rows.map((r) => [s(r.key), parse(r.value_json)]));
}

export type NavLink = { label: string; href: string };
export type NavGroup = { label: string; links: NavLink[] };
export type Navigation = {
  primary: NavLink[];
  cta: NavLink | null;
  megaCards: { label: string; href: string; description: string; icon: string }[];
  promo: { label: string; href: string; description: string; tag: string } | null;
  megaColumns: NavGroup[];
  footer: NavGroup[];
};

export async function getNavigation(db: Db): Promise<Navigation> {
  const items = await all(db, `SELECT * FROM navigation_items WHERE ${STATUS} ORDER BY menu, position`);
  const top = (menu: string) => items.filter((i) => i.menu === menu && !i.parent_id);
  const groups = (menu: string): NavGroup[] =>
    top(menu).map((g) => ({ label: s(g.label), links: items.filter((i) => i.parent_id === g.id).map((l) => ({ label: s(l.label), href: s(l.href) })) }));
  const promo = top("mega_promo")[0];
  const cta = top("cta")[0];
  return {
    primary: top("primary").map((i) => ({ label: s(i.label), href: s(i.href) })),
    cta: cta ? { label: s(cta.label), href: s(cta.href) } : null,
    megaCards: top("mega_cards").map((i) => ({ label: s(i.label), href: s(i.href), description: s(i.description), icon: s(i.icon_key) })),
    promo: promo ? { label: s(promo.label), href: s(promo.href), description: s(promo.description), tag: s(promo.tag) } : null,
    megaColumns: groups("mega_columns"),
    footer: groups("footer"),
  };
}

/** Everything the admin dashboard counts, in one round trip. */
export async function contentCounts(db: Db): Promise<Record<string, number>> {
  const tables = ["services", "case_studies", "blog_posts", "media", "navigation_items", "site_settings", "integrations", "contact_submissions", "users"];
  const out: Record<string, number> = {};
  for (const t of tables) out[t] = Number(((await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<Row>()) ?? {}).n ?? 0);
  return out;
}

/** The page for /services/<slug>, or null. Drafts and archived services are returned only when `includeUnpublished` is set (signed-in admins). */
export async function getServiceBySlug(db: Db, slug: string, opts: { includeUnpublished?: boolean } = {}): Promise<ServiceSeed | null> {
  const found = await getServices(db, { slug, publishedOnly: !opts.includeUnpublished });
  return found[0] ?? null;
}

/** Where an old service address now lives (set when an editor renames a slug), or null. */
export async function getSlugRedirect(db: Db, kind: "service" | "case_study" | "blog_post", slug: string): Promise<string | null> {
  const rows = await all(db, "SELECT new_slug FROM slug_redirects WHERE kind = ?1 AND old_slug = ?2", kind, slug);
  return rows[0] ? s(rows[0].new_slug) : null;
}
