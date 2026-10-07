import { ICON_KEYS, ID_RE, LIMITS, SECTIONS, type ItemType, type MenuConfig, type MenuName, type NavItem, type SectionKey } from "../navigation/config.ts";

/** Errors by item id (or "form" for the whole list), one message each. */
export type NavErrors = Record<string, string>;

const TYPES: ItemType[] = ["internal", "external", "group"];
const bad = (v: string) => /[<>"'\\\s]/.test(v) || /[\u0000-\u001f\u007f]/.test(v);
const plain = (v: string) => !/[<>]/.test(v);

/** A link on this site: a path ("/works", "/services/x?y=1#z") or an in-page anchor ("#top", "/#process"). Never "//host". */
export const internalHrefOk = (href: string): boolean => /^(\/(?!\/)|#)/.test(href) && !bad(href) && href.length <= LIMITS.href;

/** An address outside the site: https:// or http:// with a host, mailto: or tel:. Anything else (javascript:, data:, ...) is refused. */
export function externalHrefOk(href: string): boolean {
  if (bad(href) || href.length > LIMITS.href) return false;
  if (/^mailto:[^\s@]+@[^\s@]+$/.test(href)) return true;
  if (/^tel:\+?[0-9() .-]{3,}$/.test(href)) return true;
  try {
    const u = new URL(href);
    return (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Reads the list that came from the browser: anything can be in it, so every field is read defensively. Null when it is not a list of objects. */
export function readItems(raw: unknown): NavItem[] | null {
  if (!Array.isArray(raw) || raw.length > 400) return null;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const out: NavItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    out.push({
      id: str(o.id), menu: str(o.menu) as MenuName, parentId: typeof o.parentId === "string" && o.parentId ? o.parentId : null,
      type: str(o.type) as ItemType, label: str(o.label).trim(), href: str(o.href).trim(),
      isVisible: o.isVisible === true, openInNewTab: o.openInNewTab === true,
      description: str(o.description).trim(), tag: str(o.tag).trim(), icon: str(o.icon).trim(),
    });
  }
  return out;
}

/**
 * Checks the whole list of one section (every menu in it) and returns the cleaned rows in their final order, or the errors.
 * The rules are the ones the editor shows; they are checked again here because the browser is not trusted.
 */
export function validateSection(section: SectionKey, items: NavItem[]): { ok: true; items: NavItem[] } | { ok: false; errors: NavErrors } {
  const errors: NavErrors = {};
  const configs = new Map<MenuName, MenuConfig>(SECTIONS[section].menus.map((m) => [m.menu, m]));
  const err = (id: string, msg: string) => { if (!(id in errors)) errors[id] = msg; };

  const seen = new Set<string>();
  const byId = new Map<string, NavItem>();
  for (const i of items) {
    if (!ID_RE.test(i.id)) { err("form", "An item has an invalid id. Reload the page and try again."); continue; }
    if (seen.has(i.id)) { err("form", "An item appears twice. Reload the page and try again."); continue; }
    seen.add(i.id);
    byId.set(i.id, i);
  }

  for (const i of items) {
    const cfg = configs.get(i.menu);
    if (!cfg) { err(i.id, "This item belongs to a menu that is not part of this section."); continue; }
    if (!TYPES.includes(i.type)) { err(i.id, "Choose a link type."); continue; }
    const child = i.parentId !== null;
    if (cfg.grouped) {
      if (!child && i.type !== "group") err(i.id, "A top-level item here is a column heading, not a link.");
      if (child && i.type === "group") err(i.id, "A link cannot be a column heading.");
      if (child) {
        const p = byId.get(i.parentId!);
        if (!p || p.menu !== i.menu || p.parentId !== null || p.type !== "group") err(i.id, "This link is not inside a column of the same menu.");
      }
    } else {
      if (child) err(i.id, "This menu has no nested items.");
      if (i.type === "group") err(i.id, "This menu has links only, no column headings.");
    }
    if (!i.label) err(i.id, "Label is required.");
    else if (i.label.length > LIMITS.label) err(i.id, `Label is too long (max ${LIMITS.label} characters).`);
    else if (!plain(i.label)) err(i.id, "Label cannot contain < or >.");

    if (i.type === "internal") {
      if (!i.href) err(i.id, "URL is required.");
      else if (!internalHrefOk(i.href)) err(i.id, "Internal URL must start with / or # and have no spaces (for example /about or /#process).");
    } else if (i.type === "external") {
      if (!i.href) err(i.id, "URL is required.");
      else if (!externalHrefOk(i.href)) err(i.id, "External URL must be a full https:// address (mailto: and tel: are also allowed).");
    }
    if (cfg.extras?.description && (i.description.length > LIMITS.description || !plain(i.description))) err(i.id, `Description: at most ${LIMITS.description} characters, no < or >.`);
    if (cfg.extras?.tag && (i.tag.length > LIMITS.tag || !plain(i.tag))) err(i.id, `Badge: at most ${LIMITS.tag} characters, no < or >.`);
    if (cfg.extras?.icon && i.icon && !(ICON_KEYS as readonly string[]).includes(i.icon)) err(i.id, "Unknown icon.");
  }

  for (const cfg of configs.values()) {
    const top = items.filter((i) => i.menu === cfg.menu && i.parentId === null);
    if (top.length > cfg.max) err("form", `${cfg.title}: at most ${cfg.max} ${cfg.noun}${cfg.max === 1 ? "" : "s"}.`);
    if (cfg.maxChildren) for (const g of top) if (items.filter((c) => c.parentId === g.id).length > cfg.maxChildren) err(g.id, `At most ${cfg.maxChildren} links in a column.`);
  }

  if (Object.keys(errors).length) return { ok: false, errors };

  // a link opens in a new tab only when it is not a mail/phone link; fields a menu does not use are cleared
  const cleaned = items.map((i) => {
    const cfg = configs.get(i.menu)!;
    const group = i.type === "group";
    return {
      ...i,
      href: group ? "" : i.href,
      openInNewTab: group ? false : /^(mailto|tel):/.test(i.href) ? false : i.openInNewTab,
      description: cfg.extras?.description ? i.description : "",
      tag: cfg.extras?.tag ? i.tag : "",
      icon: cfg.extras?.icon ? i.icon : "",
    };
  });
  return { ok: true, items: cleaned };
}
