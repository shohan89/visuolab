/*
 * Draft changes (table content_drafts): what an editor saved in a section but has not published. Every function takes the database as a parameter,
 * like store.ts, so the same code runs in the Worker (D1) and in the verification scripts (SQLite).
 */
type Db = D1Database;
type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

export type DraftScope = "page" | "service" | "case_study" | "blog_post";
export type Draft = { key: string; content: unknown; updatedAt: string; updatedBy: string | null };

/** The drafts of one page or record, by section key. Content that is not JSON is skipped (it can never have been written by putDraft). */
export async function getDrafts(db: Db, scope: DraftScope, ownerId: string): Promise<Map<string, Draft>> {
  const rows = (await db.prepare("SELECT section_key, content, updated_at, updated_by FROM content_drafts WHERE scope = ?1 AND owner_id = ?2").bind(scope, ownerId).all<Row>()).results ?? [];
  const out = new Map<string, Draft>();
  for (const r of rows) {
    try { out.set(s(r.section_key), { key: s(r.section_key), content: JSON.parse(s(r.content)), updatedAt: s(r.updated_at), updatedBy: r.updated_by == null ? null : s(r.updated_by) }); } catch { /* skipped */ }
  }
  return out;
}

/** A timestamp later than `after`, so a draft's version token always changes when it is saved. */
export function nextStamp(after: string | null): string {
  const now = new Date().toISOString();
  return after && now <= after ? new Date(Date.parse(after) + 1).toISOString() : now;
}

/** Writes (or replaces) the draft of a section; returns its new version token. */
export async function putDraft(db: Db, scope: DraftScope, ownerId: string, key: string, content: unknown, userId: string, after: string | null): Promise<string> {
  const stamp = nextStamp(after);
  await db
    .prepare("INSERT INTO content_drafts (scope, owner_id, section_key, content, updated_at, updated_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT (scope, owner_id, section_key) DO UPDATE SET content = ?4, updated_at = ?5, updated_by = ?6")
    .bind(scope, ownerId, key, JSON.stringify(content), stamp, userId)
    .run();
  return stamp;
}

/** Removes the draft of one section, or of all sections when no key is given. */
export async function deleteDrafts(db: Db, scope: DraftScope, ownerId: string, key?: string): Promise<void> {
  if (key) await db.prepare("DELETE FROM content_drafts WHERE scope = ?1 AND owner_id = ?2 AND section_key = ?3").bind(scope, ownerId, key).run();
  else await db.prepare("DELETE FROM content_drafts WHERE scope = ?1 AND owner_id = ?2").bind(scope, ownerId).run();
}
