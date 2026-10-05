import "server-only";
import { inputToColumns, rowToInput, type Row } from "@/lib/content/blog-mapper";
import { slugify } from "@/lib/slug";
import type { BlogInput } from "@/lib/validation/blog";
import { getDb } from "./db";

/*
 * Write side (and admin reads) for the blog. Public pages read through cms.ts and the mapper; nothing here is used by them.
 * Every function assumes the caller already passed requireAdmin(); the actions in src/actions/blog.ts do that.
 */

const s = (v: unknown) => String(v ?? "");
const now = () => new Date().toISOString();
// D1 limits a LIKE pattern to 50 bytes, so searches and reference scans use instr() instead: no pattern, no length limit, no wildcards to escape
const has = (col: string, p: string) => `instr(lower(${col}), ${p}) > 0`;

/* ---- visibility ----------------------------------------------------------------------------------------------- */

export type Visibility = "live" | "scheduled" | "draft" | "archived";
/** What visitors can see: live = published and its publish time has passed; scheduled = published for a later time. */
export const visibilityOf = (status: string, publishedAt: string | null, at = now()): Visibility =>
  status === "published" ? (publishedAt && publishedAt > at ? "scheduled" : "live") : status === "archived" ? "archived" : "draft";

/* ---- lists ---------------------------------------------------------------------------------------------------- */

export type PostListItem = {
  id: string; slug: string; title: string; category: string; author: string; status: string; visibility: Visibility; featured: boolean;
  publishedAt: string | null; updatedAt: string; imageUrl: string; tags: string[];
};
export type PostFilter = "all" | Visibility;
export type PostQuery = { q?: string; filter?: PostFilter; category?: string; tag?: string };

export async function listPosts(opts: PostQuery): Promise<{ items: PostListItem[]; counts: Record<PostFilter, number> }> {
  const db = getDb();
  const at = now();
  const where: string[] = ["?1 IS NOT NULL"]; // ?1 is the current time; naming it in every query keeps the number of bindings right
  const binds: unknown[] = [at];
  const bind = (v: unknown) => { binds.push(v); return `?${binds.length}`; };
  if (opts.q?.trim()) {
    const p = bind(opts.q.trim().slice(0, 100).toLowerCase());
    where.push(`(${["p.title", "p.slug", "p.excerpt", "p.author_name", "p.lead"].map((c) => has(c, p)).join(" OR ")})`);
  }
  const f = opts.filter ?? "all";
  if (f === "live") where.push("p.status = 'published' AND p.published_at <= ?1");
  else if (f === "scheduled") where.push("p.status = 'published' AND p.published_at > ?1");
  else if (f === "draft" || f === "archived") where.push(`p.status = ${bind(f)}`);
  if (opts.category) where.push(`p.category_id = ${bind(opts.category)}`);
  if (opts.tag) where.push(`EXISTS (SELECT 1 FROM blog_post_tags pt WHERE pt.post_id = p.id AND pt.tag_id = ${bind(opts.tag)})`);
  const rows = await db
    .prepare(
      `SELECT p.id, p.slug, p.title, p.status, p.featured, p.published_at, p.updated_at, p.author_name, c.title AS category, m.url AS image_url,
              (SELECT GROUP_CONCAT(t.title, '|') FROM blog_post_tags pt JOIN blog_tags t ON t.id = pt.tag_id WHERE pt.post_id = p.id) AS tags
         FROM blog_posts p JOIN blog_categories c ON c.id = p.category_id JOIN media m ON m.id = p.cover_image_id
         ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY COALESCE(p.published_at, p.updated_at) DESC, p.slug`,
    )
    .bind(...binds)
    .all<Row>();
  const c = await db
    .prepare(
      `SELECT SUM(status = 'published' AND published_at <= ?1) AS live, SUM(status = 'published' AND published_at > ?1) AS scheduled,
              SUM(status = 'draft') AS draft, SUM(status = 'archived') AS archived, COUNT(*) AS n FROM blog_posts`,
    )
    .bind(at)
    .first<Record<string, number | null>>();
  const counts: Record<PostFilter, number> = { all: c?.n ?? 0, live: c?.live ?? 0, scheduled: c?.scheduled ?? 0, draft: c?.draft ?? 0, archived: c?.archived ?? 0 };
  const items = (rows.results ?? []).map((r) => ({
    id: s(r.id), slug: s(r.slug), title: s(r.title), category: s(r.category), author: s(r.author_name), status: s(r.status), visibility: visibilityOf(s(r.status), (r.published_at as string | null) ?? null, at),
    featured: Boolean(r.featured), publishedAt: (r.published_at as string | null) ?? null, updatedAt: s(r.updated_at), imageUrl: s(r.image_url), tags: r.tags ? s(r.tags).split("|") : [],
  }));
  return { items, counts };
}

/* ---- categories ----------------------------------------------------------------------------------------------- */

export type CategoryRow = { id: string; slug: string; title: string; status: string; position: number; posts: number };

export async function listCategories(): Promise<CategoryRow[]> {
  const r = await getDb()
    .prepare("SELECT c.id, c.slug, c.title, c.status, c.position, (SELECT COUNT(*) FROM blog_posts p WHERE p.category_id = c.id) AS posts FROM blog_categories c ORDER BY c.position, c.slug")
    .all<Row>();
  return (r.results ?? []).map((x) => ({ id: s(x.id), slug: s(x.slug), title: s(x.title), status: s(x.status), position: Number(x.position), posts: Number(x.posts) }));
}

export async function createCategory(title: string, slug: string): Promise<void> {
  const db = getDb();
  const t = now();
  const pos = await db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM blog_categories").first<{ p: number }>();
  await db
    .prepare("INSERT INTO blog_categories (id, slug, title, status, position, created_at, updated_at, published_at) VALUES (?1, ?2, ?3, 'published', ?4, ?5, ?5, ?5)")
    .bind(`cat_${crypto.randomUUID()}`, slug, title, pos?.p ?? 0, t)
    .run();
}

export async function updateCategory(id: string, title: string, slug: string, status: "published" | "draft" | "archived"): Promise<void> {
  const t = now();
  await getDb()
    .prepare("UPDATE blog_categories SET title = ?2, slug = ?3, status = ?4, updated_at = ?5, published_at = COALESCE(published_at, ?5) WHERE id = ?1")
    .bind(id, title, slug, status, t)
    .run();
}

export async function categorySlugInUse(slug: string, exceptId?: string): Promise<boolean> {
  return !!(await getDb().prepare("SELECT id FROM blog_categories WHERE slug = ?1 AND id <> ?2").bind(slug, exceptId ?? "").first());
}

export async function moveCategory(id: string, dir: "up" | "down"): Promise<boolean> {
  const db = getDb();
  const rows = (await db.prepare("SELECT id FROM blog_categories ORDER BY position, slug").all<{ id: string }>()).results ?? [];
  const i = rows.findIndex((r) => r.id === id);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return false;
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j]!, order[i]!];
  await db.batch(order.map((rid, p) => db.prepare("UPDATE blog_categories SET position = ?2 WHERE id = ?1").bind(rid, p)));
  return true;
}

export async function deleteCategory(id: string): Promise<void> {
  await getDb().prepare("DELETE FROM blog_categories WHERE id = ?1").bind(id).run(); // refused by the database while articles use it (RESTRICT)
}

/* ---- tags ----------------------------------------------------------------------------------------------------- */

export type TagRow = { id: string; slug: string; title: string; posts: number };

export async function listTags(): Promise<TagRow[]> {
  const r = await getDb()
    .prepare("SELECT t.id, t.slug, t.title, (SELECT COUNT(*) FROM blog_post_tags pt WHERE pt.post_id IS NOT NULL AND pt.tag_id = t.id) AS posts FROM blog_tags t ORDER BY t.title COLLATE NOCASE")
    .all<Row>();
  return (r.results ?? []).map((x) => ({ id: s(x.id), slug: s(x.slug), title: s(x.title), posts: Number(x.posts) }));
}

export async function tagSlugInUse(slug: string, exceptId: string): Promise<boolean> {
  return !!(await getDb().prepare("SELECT id FROM blog_tags WHERE slug = ?1 AND id <> ?2").bind(slug, exceptId).first());
}
export const renameTag = (id: string, title: string, slug: string) =>
  getDb().prepare("UPDATE blog_tags SET title = ?2, slug = ?3, updated_at = ?4 WHERE id = ?1").bind(id, title, slug, now()).run();
export const deleteTag = (id: string) => getDb().prepare("DELETE FROM blog_tags WHERE id = ?1").bind(id).run(); // links go with it (ON DELETE CASCADE)

/* ---- options for the form ------------------------------------------------------------------------------------- */

export type CategoryOption = { id: string; title: string; status: string };
export const categoryOptions = async (): Promise<CategoryOption[]> =>
  (await listCategories()).map((c) => ({ id: c.id, title: c.title, status: c.status }));

export type OtherPost = { slug: string; label: string; status: string };
export async function otherPosts(exceptId?: string): Promise<OtherPost[]> {
  const r = await getDb().prepare("SELECT slug, title, status FROM blog_posts WHERE id <> ?1 ORDER BY COALESCE(published_at, updated_at) DESC").bind(exceptId ?? "").all<Row>();
  return (r.results ?? []).map((x) => ({ slug: s(x.slug), label: s(x.title), status: s(x.status) }));
}

export async function allTagTitles(): Promise<string[]> {
  return ((await getDb().prepare("SELECT title FROM blog_tags ORDER BY title COLLATE NOCASE").all<{ title: string }>()).results ?? []).map((r) => r.title);
}

/* ---- one article as a form ------------------------------------------------------------------------------------ */

export type PostRecord = { id: string; createdAt: string; updatedAt: string; publishedAt: string | null; input: BlogInput };

export async function getPostRecord(id: string): Promise<PostRecord | null> {
  const db = getDb();
  const p = await db.prepare("SELECT * FROM blog_posts WHERE id = ?1").bind(id).first<Row>();
  if (!p) return null;
  const tags = (await db.prepare("SELECT t.title FROM blog_post_tags pt JOIN blog_tags t ON t.id = pt.tag_id WHERE pt.post_id = ?1 ORDER BY t.title").bind(id).all<{ title: string }>()).results ?? [];
  return { id: s(p.id), createdAt: s(p.created_at), updatedAt: s(p.updated_at), publishedAt: (p.published_at as string | null) ?? null, input: rowToInput(p, tags.map((t) => t.title)) };
}

/* ---- checks --------------------------------------------------------------------------------------------------- */

export async function postSlugInUse(slug: string, exceptId?: string): Promise<boolean> {
  return !!(await getDb().prepare("SELECT id FROM blog_posts WHERE slug = ?1 AND id <> ?2").bind(slug, exceptId ?? "").first());
}

/** Things a form cannot verify itself: the category, every chosen image and every recommended article must exist. Returns field errors. */
export async function checkPostReferences(input: BlogInput): Promise<Record<string, string>> {
  const db = getDb();
  const errors: Record<string, string> = {};
  if (!(await db.prepare("SELECT 1 AS ok FROM blog_categories WHERE id = ?1").bind(input.categoryId).first())) errors.categoryId = "Choose a category from the list";
  const imageOk = async (id: string) => !!(await db.prepare("SELECT 1 AS ok FROM media WHERE id = ?1 AND kind = 'image'").bind(id).first());
  if (!(await imageOk(input.coverImage))) errors.coverImage = "Choose an image from the list";
  if (input.ogImage && !(await imageOk(input.ogImage))) errors.ogImage = "Choose an image from the list";
  if (input.authorImage && !(await imageOk(input.authorImage))) errors.authorImage = "Choose an image from the list";
  for (const [i, b] of input.blocks.entries()) if (b.type === "image" && !(await imageOk(b.media))) errors[`blocks.${i}`] = `Block ${i + 1}: choose an image from the list`;
  if (input.related.length) {
    const slugs = ((await db.prepare("SELECT slug FROM blog_posts").all<{ slug: string }>()).results ?? []).map((r) => r.slug);
    if (input.related.some((x) => !slugs.includes(x))) errors.related = "One of the chosen articles no longer exists";
  }
  return errors;
}

/* ---- writes --------------------------------------------------------------------------------------------------- */

const COLS = `slug, title, status, category_id, meta_title, meta_description, canonical_url, og_image_id, excerpt, featured, lead, body_json, outro_json, related_json,
  read_minutes, author_name, author_image_id, cover_image_id, cover_alt`;

function values(i: BlogInput) {
  const c = inputToColumns(i);
  return [
    i.slug, i.title, i.status, i.categoryId, i.metaTitle, i.metaDescription, i.canonicalUrl || null, i.ogImage || null, i.excerpt || null, i.featured ? 1 : 0, i.lead,
    c.body_json, c.outro_json, c.related_json, c.read_minutes, i.authorName, i.authorImage || null, i.coverImage, i.coverAlt,
  ];
}

/** Tag links for an article: missing tags are created, existing ones (matched by slug) are reused. */
function tagStatements(postId: string, titles: string[], t: string) {
  const db = getDb();
  const unique = [...new Map(titles.map((x) => [slugify(x), x])).entries()].filter(([slug]) => slug);
  return [
    db.prepare("DELETE FROM blog_post_tags WHERE post_id = ?1").bind(postId),
    ...unique.map(([slug, title]) =>
      db.prepare("INSERT OR IGNORE INTO blog_tags (id, slug, title, status, created_at, updated_at, published_at) VALUES (?1, ?2, ?3, 'published', ?4, ?4, ?4)").bind(`tag_${crypto.randomUUID()}`, slug, title, t),
    ),
    ...unique.map(([slug]) => db.prepare("INSERT OR IGNORE INTO blog_post_tags (post_id, tag_id) SELECT ?1, id FROM blog_tags WHERE slug = ?2").bind(postId, slug)),
  ];
}

/** Only one article is featured at a time: the featured flag of every other article is cleared. */
const featuredStatement = (id: string) => getDb().prepare("UPDATE blog_posts SET featured = 0 WHERE id <> ?1 AND featured = 1").bind(id);

export async function createPost(input: BlogInput): Promise<string> {
  const db = getDb();
  const id = `post_${crypto.randomUUID()}`;
  const t = now();
  const v = values(input);
  const marks = v.map((_, i) => `?${i + 4}`).join(",");
  const publishedAt = inputToColumns(input).published_at;
  await db.batch([
    db.prepare("DELETE FROM slug_redirects WHERE kind = 'blog_post' AND old_slug = ?1").bind(input.slug),
    db.prepare(`INSERT INTO blog_posts (id, created_at, updated_at, published_at, ${COLS}) VALUES (?1, ?2, ?2, ?3, ${marks})`).bind(id, t, publishedAt, ...v),
    ...(input.featured ? [featuredStatement(id)] : []),
    ...tagStatements(id, input.tags, t),
  ]);
  return id;
}

/** Rewrites the "More from the studio" lists of the other articles when a slug changes (to the new slug) or goes away (null removes it). */
async function rewriteRelated(oldSlug: string, newSlug: string | null, exceptId: string) {
  const db = getDb();
  const rows = (await db.prepare("SELECT id, related_json FROM blog_posts WHERE id <> ?1 AND instr(related_json, ?2) > 0").bind(exceptId, `"${oldSlug}"`).all<{ id: string; related_json: string }>()).results ?? [];
  return rows.map((r) => {
    const list = JSON.parse(r.related_json) as string[];
    const next = newSlug ? list.map((x) => (x === oldSlug ? newSlug : x)) : list.filter((x) => x !== oldSlug);
    return db.prepare("UPDATE blog_posts SET related_json = ?2 WHERE id = ?1").bind(r.id, JSON.stringify(next));
  });
}

/** Saves the form. A changed slug keeps the old address as a redirect and updates the "More from the studio" lists that name it. */
export async function updatePost(id: string, input: BlogInput): Promise<{ oldSlug: string | null }> {
  const db = getDb();
  const cur = await db.prepare("SELECT slug FROM blog_posts WHERE id = ?1").bind(id).first<{ slug: string }>();
  if (!cur) throw new Error("not found");
  const t = now();
  const changed = cur.slug !== input.slug;
  const v = values(input);
  const sets = COLS.split(",").map((c, i) => `${c.trim()} = ?${i + 4}`).join(", ");
  await db.batch([
    ...(changed
      ? [
          db.prepare("DELETE FROM slug_redirects WHERE kind = 'blog_post' AND old_slug = ?1").bind(input.slug),
          db.prepare("UPDATE slug_redirects SET new_slug = ?2 WHERE kind = 'blog_post' AND new_slug = ?1").bind(cur.slug, input.slug),
          db.prepare("INSERT INTO slug_redirects (id, kind, old_slug, new_slug, created_at) VALUES (?1, 'blog_post', ?2, ?3, ?4)").bind(crypto.randomUUID(), cur.slug, input.slug, t),
          ...(await rewriteRelated(cur.slug, input.slug, id)),
        ]
      : []),
    db.prepare(`UPDATE blog_posts SET updated_at = ?2, published_at = ?3, ${sets} WHERE id = ?1`).bind(id, t, inputToColumns(input).published_at, ...v),
    ...(input.featured ? [featuredStatement(id)] : []),
    ...tagStatements(id, input.tags, t),
  ]);
  return { oldSlug: changed ? cur.slug : null };
}

/** Publish uses the planned publish date when there is one (in the future that means scheduled), otherwise now. */
export async function publishPost(id: string): Promise<void> {
  const t = now();
  await getDb().prepare("UPDATE blog_posts SET status = 'published', published_at = COALESCE(published_at, ?2), updated_at = ?2 WHERE id = ?1").bind(id, t).run();
}

export async function setPostStatus(id: string, status: "draft" | "archived"): Promise<void> {
  await getDb().prepare("UPDATE blog_posts SET status = ?2, updated_at = ?3 WHERE id = ?1").bind(id, status, now()).run();
}

export async function setPostFeatured(id: string, featured: boolean): Promise<void> {
  const db = getDb();
  await db.batch([...(featured ? [featuredStatement(id)] : []), db.prepare("UPDATE blog_posts SET featured = ?2, updated_at = ?3 WHERE id = ?1").bind(id, featured ? 1 : 0, now())]);
}

export async function deletePost(id: string): Promise<void> {
  const db = getDb();
  const cur = await db.prepare("SELECT slug FROM blog_posts WHERE id = ?1").bind(id).first<{ slug: string }>();
  if (!cur) return;
  await db.batch([
    ...(await rewriteRelated(cur.slug, null, id)),
    db.prepare("DELETE FROM slug_redirects WHERE kind = 'blog_post' AND new_slug = ?1").bind(cur.slug),
    db.prepare("DELETE FROM blog_posts WHERE id = ?1").bind(id), // tag links go with it (ON DELETE CASCADE)
  ]);
}

/* ---- what would break ----------------------------------------------------------------------------------------- */

export type Reference = { where: string; detail: string };

/** Everything that links to /blog/<slug>. Used before hiding or deleting a live article. */
export async function postReferences(slug: string, id: string): Promise<Reference[]> {
  const db = getDb();
  const path = `/blog/${slug}`;
  const out: Reference[] = [];
  const nav = await db.prepare("SELECT menu, label FROM navigation_items WHERE href = ?1 OR instr(href, ?2) = 1").bind(path, `${path}/`).all<{ menu: string; label: string }>();
  for (const n of nav.results ?? []) out.push({ where: `Navigation (${n.menu.replace("_", " ")})`, detail: n.label });
  const set = await db.prepare("SELECT title FROM site_settings WHERE instr(value_json, ?1) > 0").bind(path).all<{ title: string }>();
  for (const r of set.results ?? []) out.push({ where: "Site content", detail: r.title });
  const rel = await db.prepare("SELECT title FROM blog_posts WHERE id <> ?1 AND instr(related_json, ?2) > 0").bind(id, `"${slug}"`).all<{ title: string }>();
  for (const r of rel.results ?? []) out.push({ where: "More from the studio", detail: `Recommended under “${r.title}”` });
  const body = await db.prepare("SELECT title FROM blog_posts WHERE id <> ?1 AND (instr(body_json, ?2) > 0 OR instr(outro_json, ?2) > 0 OR instr(lead, ?2) > 0)").bind(id, path).all<{ title: string }>();
  for (const r of body.results ?? []) out.push({ where: "Another article", detail: `Links to it in “${r.title}”` });
  const cases = await db.prepare("SELECT client_name FROM case_studies WHERE instr(process_json, ?1) > 0 OR instr(results_json, ?1) > 0 OR instr(about_lead, ?1) > 0").bind(path).all<{ client_name: string }>();
  for (const r of cases.results ?? []) out.push({ where: "Case study", detail: r.client_name });
  return out;
}
