import "server-only";
import { env } from "cloudflare:workers";
import { sniffImage, MAX_BYTES, type Sniffed } from "@/lib/media/sniff";
import { publicMediaUrl, MEDIA_PREFIX } from "@/lib/media/url";
import { slugify } from "@/lib/slug";
import { getDb } from "./db";

/*
 * Media library: metadata in D1, the files themselves in R2. The database never holds picture bytes.
 * Every function assumes the caller already passed requireAdmin() (the API routes and actions do that).
 */

type Row = Record<string, unknown>;
const s = (v: unknown) => String(v ?? "");
const now = () => new Date().toISOString();
// D1 limits a LIKE pattern to 50 bytes, so searches and reference scans use instr() instead: no pattern, no length limit, no wildcards to escape

export const OBJECT_CACHE = "public, max-age=31536000, immutable"; // object keys are unique and never reused, so a cached copy is never stale

export type MediaItem = {
  id: string; title: string; kind: string; mime: string; storage: "static" | "r2"; /** stored path */ url: string; /** what a browser loads */ publicUrl: string;
  width: number | null; height: number | null; bytes: number | null; altText: string; caption: string; originalName: string | null; r2Key: string | null;
  createdAt: string; updatedAt: string;
};

const toItem = (r: Row): MediaItem => ({
  id: s(r.id), title: s(r.title), kind: s(r.kind), mime: s(r.mime), storage: s(r.storage) as "static" | "r2", url: s(r.url), publicUrl: publicMediaUrl(s(r.url)),
  width: (r.width as number | null) ?? null, height: (r.height as number | null) ?? null, bytes: (r.bytes as number | null) ?? null, altText: s(r.alt_text), caption: s(r.caption),
  originalName: (r.original_name as string | null) ?? null, r2Key: (r.r2_key as string | null) ?? null, createdAt: s(r.created_at), updatedAt: s(r.updated_at),
});

/* ---- library -------------------------------------------------------------------------------------------------- */

export type MediaQuery = { q?: string; type?: "image" | "video" | "file"; storage?: "static" | "r2"; unused?: boolean; page?: number; limit?: number; id?: string };

/** SQL that is true when nothing in the content refers to the media row `m`. Foreign keys cover the columns; the JSON bodies are searched. */
const UNUSED = `NOT EXISTS (SELECT 1 FROM services v WHERE v.hero_image_a_id = m.id OR v.hero_image_b_id = m.id)
  AND NOT EXISTS (SELECT 1 FROM case_studies c WHERE c.card_image_id = m.id OR c.cover_image_id = m.id)
  AND NOT EXISTS (SELECT 1 FROM case_study_images i WHERE i.media_id = m.id)
  AND NOT EXISTS (SELECT 1 FROM blog_posts p WHERE p.cover_image_id = m.id OR p.author_image_id = m.id OR p.og_image_id = m.id OR instr(p.body_json, '"media":"' || m.id || '"') > 0)`;

export async function listMedia(opts: MediaQuery): Promise<{ items: MediaItem[]; total: number; page: number; pages: number }> {
  const db = getDb();
  const where: string[] = [];
  const binds: unknown[] = [];
  const bind = (v: unknown) => { binds.push(v); return `?${binds.length}`; };
  if (opts.id) where.push(`m.id = ${bind(opts.id)}`);
  if (opts.q?.trim()) {
    const p = bind(opts.q.trim().slice(0, 100).toLowerCase());
    where.push(`(${["m.title", "m.alt_text", "m.caption", "COALESCE(m.original_name, '')", "m.slug", "m.mime"].map((c) => `instr(lower(${c}), ${p}) > 0`).join(" OR ")})`);
  }
  if (opts.type) where.push(`m.kind = ${bind(opts.type)}`);
  if (opts.storage) where.push(`m.storage = ${bind(opts.storage)}`);
  if (opts.unused) where.push(`(${UNUSED})`);
  const limit = Math.min(Math.max(opts.limit ?? 24, 1), 100);
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (await db.prepare(`SELECT COUNT(*) AS n FROM media m ${clause}`).bind(...binds).first<{ n: number }>())?.n ?? 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(opts.page ?? 1, 1), pages);
  const rows = await db.prepare(`SELECT m.* FROM media m ${clause} ORDER BY m.created_at DESC, m.slug LIMIT ${limit} OFFSET ${(page - 1) * limit}`).bind(...binds).all<Row>();
  return { items: (rows.results ?? []).map(toItem), total, page, pages };
}

export async function getMedia(id: string): Promise<MediaItem | null> {
  const r = await getDb().prepare("SELECT * FROM media WHERE id = ?1").bind(id).first<Row>();
  return r ? toItem(r) : null;
}

/** Everything the media library holds, for the counts at the top of the library. */
export async function mediaCounts(): Promise<{ all: number; r2: number; static: number; bytes: number }> {
  const r = await getDb().prepare("SELECT COUNT(*) AS n, SUM(storage = 'r2') AS r2, SUM(storage = 'static') AS st, COALESCE(SUM(bytes), 0) AS b FROM media").first<Record<string, number | null>>();
  return { all: r?.n ?? 0, r2: r?.r2 ?? 0, static: r?.st ?? 0, bytes: r?.b ?? 0 };
}

/* ---- upload --------------------------------------------------------------------------------------------------- */

export type UploadResult = { ok: true; item: MediaItem; duplicate: boolean } | { ok: false; status: number; error: string };

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** A readable default title from the uploaded file name: "Brand-board_v2.PNG" -> "Brand board v2". */
export function titleFromFilename(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.[A-Za-z0-9]{1,5}$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return (base || "Image").replace(/[<>]/g, "").slice(0, 120);
}

/** Looks at the bytes, not at what the browser says. Returns the picture facts or an error with the HTTP status to answer with. */
export function checkUpload(bytes: Uint8Array): { ok: true; image: Sniffed } | { ok: false; status: number; error: string } {
  if (bytes.length > MAX_BYTES) return { ok: false, status: 413, error: `The file is too large (${(bytes.length / 1048576).toFixed(1)} MB). The limit is ${MAX_BYTES / 1048576} MB.` };
  const sniffed = sniffImage(bytes);
  return sniffed.ok ? { ok: true, image: sniffed.image } : { ok: false, status: 415, error: sniffed.error };
}

/** A unique object key: date folders for tidiness, a random UUID so a key is never guessed or reused, the extension from the real type. */
const newKey = (ext: string) => {
  const d = new Date();
  return `uploads/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
};

async function putObject(key: string, bytes: Uint8Array, image: Sniffed, original: string, by: string) {
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType: image.mime, cacheControl: OBJECT_CACHE },
    customMetadata: { originalName: original.slice(0, 200), uploadedBy: by, width: String(image.width), height: String(image.height) },
  });
}

export async function uploadImage(file: { name: string; bytes: Uint8Array }, adminId: string, meta: { title?: string; alt?: string; caption?: string } = {}): Promise<UploadResult> {
  const check = checkUpload(file.bytes);
  if (!check.ok) return check;
  const db = getDb();
  const sha = hex(await crypto.subtle.digest("SHA-256", new Uint8Array(file.bytes)));
  const same = await db.prepare("SELECT * FROM media WHERE sha256 = ?1 LIMIT 1").bind(sha).first<Row>();
  if (same) return { ok: true, item: toItem(same), duplicate: true }; // the same picture is already in the library: reuse it

  const key = newKey(check.image.ext);
  const t = now();
  const title = (meta.title ?? "").trim().slice(0, 120) || titleFromFilename(file.name);
  const id = `media_${crypto.randomUUID()}`;
  await putObject(key, file.bytes, check.image, file.name, adminId);
  try {
    await db
      .prepare(
        `INSERT INTO media (id, slug, title, status, kind, mime, storage, url, r2_key, width, height, bytes, alt_text, caption, original_name, sha256, uploaded_by, created_at, updated_at, published_at)
         VALUES (?1, ?2, ?3, 'published', 'image', ?4, 'r2', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15, ?15)`,
      )
      .bind(id, `${slugify(title).slice(0, 40) || "image"}-${crypto.randomUUID().slice(0, 6)}`, title, check.image.mime, `${MEDIA_PREFIX}${key}`, key, check.image.width, check.image.height, file.bytes.length,
        (meta.alt ?? "").trim().slice(0, 200), (meta.caption ?? "").trim().slice(0, 200), file.name.slice(0, 200), sha, adminId, t)
      .run();
  } catch (e) {
    await env.MEDIA.delete(key).catch(() => {}); // no orphan object when the row could not be written
    throw e;
  }
  return { ok: true, item: (await getMedia(id))!, duplicate: false };
}

/**
 * Replace the file behind a media row. The row keeps its id, so every page that uses it follows; the object key is new (so caches
 * and the media domain never serve the old picture under the new address) and the old object is deleted afterwards.
 */
export async function replaceImage(id: string, file: { name: string; bytes: Uint8Array }, adminId: string): Promise<UploadResult> {
  const db = getDb();
  const cur = await db.prepare("SELECT * FROM media WHERE id = ?1").bind(id).first<Row>();
  if (!cur) return { ok: false, status: 404, error: "This media file no longer exists." };
  if (s(cur.kind) !== "image") return { ok: false, status: 400, error: "Only pictures can be replaced." };
  const check = checkUpload(file.bytes);
  if (!check.ok) return check;
  const sha = hex(await crypto.subtle.digest("SHA-256", new Uint8Array(file.bytes)));
  const key = newKey(check.image.ext);
  await putObject(key, file.bytes, check.image, file.name, adminId);
  try {
    await db
      .prepare("UPDATE media SET mime = ?2, storage = 'r2', url = ?3, r2_key = ?4, width = ?5, height = ?6, bytes = ?7, original_name = ?8, sha256 = ?9, updated_at = ?10 WHERE id = ?1")
      .bind(id, check.image.mime, `${MEDIA_PREFIX}${key}`, key, check.image.width, check.image.height, file.bytes.length, file.name.slice(0, 200), sha, now())
      .run();
  } catch (e) {
    await env.MEDIA.delete(key).catch(() => {});
    throw e;
  }
  const oldKey = (cur.r2_key as string | null) ?? null;
  if (oldKey && oldKey !== key) await env.MEDIA.delete(oldKey).catch((e) => console.error("old media object not deleted", oldKey, e instanceof Error ? e.message : e));
  return { ok: true, item: (await getMedia(id))!, duplicate: false };
}

/* ---- metadata ------------------------------------------------------------------------------------------------- */

export async function updateMediaMeta(id: string, m: { title: string; alt: string; caption: string }): Promise<void> {
  await getDb().prepare("UPDATE media SET title = ?2, alt_text = ?3, caption = ?4, updated_at = ?5 WHERE id = ?1").bind(id, m.title, m.alt, m.caption, now()).run();
}

/* ---- usage and delete ----------------------------------------------------------------------------------------- */

export type Usage = { where: string; detail: string };

/** Everything that uses a media file. Deleting a file that is in use would leave a broken picture, so it is refused. */
export async function mediaUsage(id: string): Promise<Usage[]> {
  const db = getDb();
  const out: Usage[] = [];
  const rows = async (sql: string, ...b: unknown[]) => (await db.prepare(sql).bind(...b).all<Row>()).results ?? [];
  for (const r of await rows("SELECT title, hero_image_a_id AS a FROM services WHERE hero_image_a_id = ?1 OR hero_image_b_id = ?1", id)) out.push({ where: "Service", detail: `${s(r.title)} (hero image)` });
  for (const r of await rows("SELECT client_name, card_image_id AS card FROM case_studies WHERE card_image_id = ?1 OR cover_image_id = ?1", id)) out.push({ where: "Case study", detail: `${s(r.client_name)} (card or hero image)` });
  for (const r of await rows("SELECT c.client_name, i.role FROM case_study_images i JOIN case_studies c ON c.id = i.case_study_id WHERE i.media_id = ?1", id)) out.push({ where: "Case study", detail: `${s(r.client_name)} (${s(r.role).replace("_", " ")})` });
  for (const r of await rows("SELECT title FROM blog_posts WHERE cover_image_id = ?1 OR author_image_id = ?1 OR og_image_id = ?1 OR instr(body_json, ?2) > 0", id, `"media":"${id}"`)) out.push({ where: "Blog article", detail: s(r.title) });
  return out;
}

export type DeleteResult = { ok: true } | { ok: false; reason: "not_found" | "static" | "in_use"; usage?: Usage[] };

export async function deleteMedia(id: string): Promise<DeleteResult> {
  const db = getDb();
  const cur = await db.prepare("SELECT storage, r2_key FROM media WHERE id = ?1").bind(id).first<{ storage: string; r2_key: string | null }>();
  if (!cur) return { ok: false, reason: "not_found" };
  if (cur.storage !== "r2") return { ok: false, reason: "static" }; // shipped with the website; removing the row would not remove the file
  const usage = await mediaUsage(id);
  if (usage.length) return { ok: false, reason: "in_use", usage };
  try {
    await db.prepare("DELETE FROM media WHERE id = ?1").bind(id).run(); // foreign keys refuse this too while any content still points here (RESTRICT)
  } catch {
    return { ok: false, reason: "in_use", usage: await mediaUsage(id) };
  }
  if (cur.r2_key) await env.MEDIA.delete(cur.r2_key).catch((e) => console.error("media object not deleted", cur.r2_key, e instanceof Error ? e.message : e));
  return { ok: true };
}
