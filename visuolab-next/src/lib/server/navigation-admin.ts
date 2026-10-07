import "server-only";
import { menusOf, STATIC_PAGES, type MenuName, type NavItem, type SectionKey } from "../navigation/config";
import { getDb } from "./db";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v));

/** Every row of the section's menus in display order: top level by position, each group's links after it. The editor shows them in this order. */
export async function listSection(section: SectionKey): Promise<NavItem[]> {
  const menus = menusOf(section);
  const rows = (await getDb().prepare(`SELECT * FROM navigation_items WHERE menu IN (${menus.map(() => "?").join(",")}) ORDER BY menu, position, id`).bind(...menus).all<Row>()).results ?? [];
  return rows.map((r) => ({
    id: s(r.id), menu: s(r.menu) as MenuName, parentId: r.parent_id ? s(r.parent_id) : null,
    type: s(r.type) as NavItem["type"], label: s(r.label), href: s(r.href),
    isVisible: r.is_visible === 1, openInNewTab: r.open_in_new_tab === 1,
    description: s(r.description), tag: s(r.tag), icon: s(r.icon_key),
  }));
}

export type PageOption = { href: string; label: string; ref: string };

/** The pages an internal link can point at: the fixed pages, plus every published service, case study and article. */
export async function pageOptions(): Promise<PageOption[]> {
  const db = getDb();
  const [services, cases, posts] = await Promise.all([
    db.prepare("SELECT slug, title FROM services WHERE status = 'published' ORDER BY position, slug").all<Row>(),
    db.prepare("SELECT slug, client_name FROM case_studies WHERE status = 'published' ORDER BY position, slug").all<Row>(),
    db.prepare("SELECT slug, title FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC").all<Row>(),
  ]);
  return [
    ...STATIC_PAGES,
    ...(services.results ?? []).map((r) => ({ href: `/services/${s(r.slug)}`, label: `Service: ${s(r.title)}`, ref: `service:${s(r.slug)}` })),
    ...(cases.results ?? []).map((r) => ({ href: `/works/${s(r.slug)}`, label: `Case study: ${s(r.client_name)}`, ref: `case:${s(r.slug)}` })),
    ...(posts.results ?? []).map((r) => ({ href: `/blog/${s(r.slug)}`, label: `Article: ${s(r.title).replace(/<[^>]*>/g, "")}`, ref: `post:${s(r.slug)}` })),
  ];
}

export type SaveResult = { ok: true; added: number; removed: number; changed: number; reordered: boolean } | { ok: false; error: string };

/**
 * Replaces the section's menus with `items` (already validated), in one atomic batch: rows no longer in the list are deleted, the rest are
 * inserted or updated, and position is the index within the menu and parent. A row id that already belongs to a menu outside this
 * section is refused, so a crafted request cannot take over another menu's rows.
 */
export async function saveSection(section: SectionKey, items: NavItem[]): Promise<SaveResult> {
  const db = getDb();
  const menus = menusOf(section);
  const marks = menus.map(() => "?").join(",");
  const [existing, all] = await Promise.all([
    listSection(section),
    db.prepare("SELECT id, menu FROM navigation_items").all<Row>(),
  ]);
  const owner = new Map((all.results ?? []).map((r) => [s(r.id), s(r.menu)]));
  for (const i of items) {
    const m = owner.get(i.id);
    if (m && !menus.includes(m as MenuName)) return { ok: false, error: "An item id belongs to another menu." };
  }

  const before = new Map(existing.map((e) => [e.id, e]));
  const keep = new Set(items.map((i) => i.id));
  const removed = existing.filter((e) => !keep.has(e.id));
  const same = (a: NavItem, b: NavItem) => a.menu === b.menu && a.parentId === b.parentId && a.type === b.type && a.label === b.label && a.href === b.href && a.isVisible === b.isVisible && a.openInNewTab === b.openInNewTab && a.description === b.description && a.tag === b.tag && a.icon === b.icon;
  const added = items.filter((i) => !before.has(i.id)).length;
  const changed = items.filter((i) => before.has(i.id) && !same(before.get(i.id)!, i)).length;
  const order = (list: NavItem[]) => list.map((i) => i.id).join(",");
  const reordered = order(items.filter((i) => before.has(i.id))) !== order(existing.filter((e) => keep.has(e.id)));

  const refs = new Map((await pageOptions()).map((p) => [p.href, p.ref]));
  const now = new Date().toISOString();
  const position = new Map<string, number>();
  const stmts: D1PreparedStatement[] = [];

  // children go with a parent that is deleted (ON DELETE CASCADE); deleting the missing ids first also frees nothing that is re-inserted
  if (removed.length) stmts.push(db.prepare(`DELETE FROM navigation_items WHERE id IN (${removed.map(() => "?").join(",")}) AND menu IN (${marks})`).bind(...removed.map((r) => r.id), ...menus));

  // parents first: a new link must find its new column already in the table
  const sorted = [...items.filter((i) => i.parentId === null), ...items.filter((i) => i.parentId !== null)];
  for (const i of sorted) {
    const key = `${i.menu}|${i.parentId ?? ""}`;
    const pos = position.get(key) ?? 0;
    position.set(key, pos + 1);
    stmts.push(
      db.prepare(
        `INSERT INTO navigation_items (id, menu, parent_id, position, label, href, description, tag, icon_key, status, type, page_ref, is_visible, open_in_new_tab, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'published', ?10, ?11, ?12, ?13, ?14, ?14)
         ON CONFLICT (id) DO UPDATE SET menu = excluded.menu, parent_id = excluded.parent_id, position = excluded.position, label = excluded.label, href = excluded.href,
           description = excluded.description, tag = excluded.tag, icon_key = excluded.icon_key, status = 'published', type = excluded.type, page_ref = excluded.page_ref,
           is_visible = excluded.is_visible, open_in_new_tab = excluded.open_in_new_tab, updated_at = excluded.updated_at`,
      ).bind(
        i.id, i.menu, i.parentId, pos, i.label, i.type === "group" ? null : i.href, i.description || null, i.tag || null, i.icon || null,
        i.type, i.type === "internal" ? refs.get(i.href.split(/[?#]/)[0]!) ?? null : null, i.isVisible ? 1 : 0, i.openInNewTab ? 1 : 0, now,
      ),
    );
  }
  await db.batch(stmts);
  return { ok: true, added, removed: removed.length, changed, reordered };
}
