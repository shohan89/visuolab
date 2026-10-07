"use client";

import { useActionState, useState } from "react";
import { saveNavigation, type NavFormState } from "@/actions/navigation";
import { ICON_KEYS, SECTIONS, type ItemType, type MenuConfig, type NavItem, type SectionKey } from "@/lib/navigation/config";
import type { PageOption } from "@/lib/server/navigation-admin";

const newId = () => "nav_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
const TYPE_LABEL: Record<Exclude<ItemType, "group">, string> = { internal: "Internal page", external: "External link" };

/** Moves `from` to the place of `to` (both in the same list of siblings); everything else keeps its order. */
function moveBefore(items: NavItem[], from: string, to: string): NavItem[] {
  const a = items.findIndex((i) => i.id === from);
  const b = items.findIndex((i) => i.id === to);
  if (a < 0 || b < 0 || a === b) return items;
  const next = [...items];
  const [it] = next.splice(a, 1);
  next.splice(next.findIndex((i) => i.id === to) + (a < b ? 1 : 0), 0, it!);
  return next;
}

/** Swaps an item with its neighbour among the siblings (same menu and parent) in the flat list. */
function step(items: NavItem[], id: string, d: -1 | 1): NavItem[] {
  const me = items.find((i) => i.id === id);
  if (!me) return items;
  const sib = items.filter((i) => i.menu === me.menu && i.parentId === me.parentId);
  const at = sib.findIndex((i) => i.id === id);
  const other = sib[at + d];
  return other ? moveBefore(items, id, other.id) : items;
}

type RowProps = {
  item: NavItem;
  cfg: MenuConfig;
  index: number;
  count: number;
  error?: string;
  onChange: (id: string, patch: Partial<NavItem>) => void;
  onRemove: (id: string) => void;
  onStep: (id: string, d: -1 | 1) => void;
  onDrop: (to: string) => void;
  onDrag: (id: string | null) => void;
  dragging: string | null;
  canDrop: boolean;
  children?: React.ReactNode;
};

function Row({ item, cfg, index, count, error, onChange, onRemove, onStep, onDrop, onDrag, dragging, canDrop, children }: RowProps) {
  const group = item.type === "group";
  const name = item.label || (group ? "column" : cfg.noun);
  const id = (k: string) => `${item.id}-${k}`;
  return (
    <li
      className={"nav-row" + (group ? " is-group" : "") + (!item.isVisible ? " is-hidden" : "") + (dragging === item.id ? " is-dragging" : "") + (error ? " has-err" : "")}
      onDragOver={(e) => { if (canDrop) e.preventDefault(); }}
      onDrop={(e) => { if (canDrop) { e.preventDefault(); e.stopPropagation(); onDrop(item.id); } }}
    >
      <div className="nav-line">
        <span className="nav-handle" draggable aria-hidden="true" title="Drag to reorder" onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); onDrag(item.id); }} onDragEnd={() => onDrag(null)}>⠿</span>
        <div className="nav-fields">
          <div className="field">
            <label htmlFor={id("label")}>{group ? "Column heading" : "Label"}</label>
            <input id={id("label")} type="text" value={item.label} maxLength={60} onChange={(e) => onChange(item.id, { label: e.target.value })} aria-invalid={error ? true : undefined} />
          </div>
          {!group && (
            <>
              <div className="field nav-type">
                <label htmlFor={id("type")}>Type</label>
                <select id={id("type")} value={item.type} onChange={(e) => { const t = e.target.value as ItemType; onChange(item.id, { type: t, openInNewTab: t === "external" }); }}>
                  {(Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </div>
              <div className="field nav-url">
                <label htmlFor={id("href")}>URL</label>
                <input id={id("href")} type="text" value={item.href} maxLength={300} list={item.type === "internal" ? "nav-pages" : undefined} placeholder={item.type === "internal" ? "/about" : "https://example.com"} onChange={(e) => onChange(item.id, { href: e.target.value })} aria-invalid={error ? true : undefined} />
              </div>
            </>
          )}
        </div>
        <div className="nav-tools">
          <button type="button" onClick={() => onStep(item.id, -1)} disabled={index === 0} aria-label={`Move ${name} up`}>↑</button>
          <button type="button" onClick={() => onStep(item.id, 1)} disabled={index === count - 1} aria-label={`Move ${name} down`}>↓</button>
          <button type="button" className="danger" onClick={() => onRemove(item.id)} aria-label={`Delete ${name}`}>Delete</button>
        </div>
      </div>
      <div className="nav-opts">
        <label className="check"><input type="checkbox" checked={item.isVisible} onChange={(e) => onChange(item.id, { isVisible: e.target.checked })} /> Visible</label>
        {!group && <label className="check"><input type="checkbox" checked={item.openInNewTab} disabled={/^(mailto|tel):/.test(item.href)} onChange={(e) => onChange(item.id, { openInNewTab: e.target.checked })} /> Open in new tab</label>}
        {cfg.extras?.description && (
          <label className="nav-extra">Description <input type="text" value={item.description} maxLength={160} onChange={(e) => onChange(item.id, { description: e.target.value })} /></label>
        )}
        {cfg.extras?.tag && (
          <label className="nav-extra nav-tag">Badge <input type="text" value={item.tag} maxLength={30} onChange={(e) => onChange(item.id, { tag: e.target.value })} /></label>
        )}
        {cfg.extras?.icon && (
          <label className="nav-extra nav-icon">Icon <select value={item.icon} onChange={(e) => onChange(item.id, { icon: e.target.value })}>{ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
        )}
      </div>
      {error && <p className="err" role="alert">{error}</p>}
      {children}
    </li>
  );
}

/**
 * Edits one section (header or footer) of the navigation: every menu in it, as lists that can be reordered by dragging or with the arrows.
 * Nothing is written until Save; Cancel puts back what is stored. The whole section is sent as one JSON value and checked again on the server.
 */
export default function NavigationEditor({ section, initial, pages }: { section: SectionKey; initial: NavItem[]; pages: PageOption[] }) {
  const [state, run, pending] = useActionState<NavFormState, FormData>(saveNavigation, undefined);
  const [items, setItems] = useState<NavItem[]>(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);
  const [seen, setSeen] = useState<number | undefined>(); // the answer whose errors were dismissed (by editing or cancelling)
  const errors = state && state.nonce !== seen ? state.errors : {};
  const n = Object.keys(errors).length;

  const edit = (f: (l: NavItem[]) => NavItem[]) => { setSeen(state?.nonce); setItems(f); };
  const patch = (id: string, p: Partial<NavItem>) => edit((l) => l.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id: string) => edit((l) => l.filter((i) => i.id !== id && i.parentId !== id));
  const add = (cfg: MenuConfig, parentId: string | null) =>
    edit((l) => {
      const group = cfg.grouped && parentId === null;
      const item: NavItem = { id: newId(), menu: cfg.menu, parentId, type: group ? "group" : "internal", label: "", href: group ? "" : "/", isVisible: true, openInNewTab: false, description: "", tag: "", icon: cfg.extras?.icon ? ICON_KEYS[0] : "" };
      // keep a group's links next to it in the list, so the order of the flat list matches what is shown
      const last = l.map((i, k) => (i.menu === cfg.menu && (parentId === null ? true : i.parentId === parentId || i.id === parentId) ? k : -1)).filter((k) => k >= 0).pop();
      const next = [...l];
      next.splice(last === undefined ? next.length : last + 1, 0, item);
      return next;
    });
  const dropOn = (to: string) => {
    const from = items.find((i) => i.id === dragging);
    const target = items.find((i) => i.id === to);
    setDragging(null);
    if (from && target && from.menu === target.menu && from.parentId === target.parentId) edit((l) => moveBefore(l, from.id, to));
  };

  return (
    <form action={run} className="svc-form nav-editor" noValidate aria-labelledby={`nav-${section}`}>
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <datalist id="nav-pages">{pages.map((p) => <option key={p.ref} value={p.href}>{p.label}</option>)}</datalist>
      <h2 className="nav-title" id={`nav-${section}`}>{SECTIONS[section].title}</h2>
      {n > 0 && (
        <div className="form-errors" role="alert">
          <b>{n === 1 ? "One thing needs fixing" : `${n} things need fixing`} before this can be saved:</b>
          <ul>{Object.entries(errors).map(([k, m]) => <li key={k}>{k !== "form" && items.find((i) => i.id === k)?.label ? `${items.find((i) => i.id === k)!.label}: ` : ""}{m}</li>)}</ul>
        </div>
      )}

      {SECTIONS[section].menus.map((cfg) => {
        const top = items.filter((i) => i.menu === cfg.menu && i.parentId === null);
        return (
          <section className="form-card" key={cfg.menu} aria-label={cfg.title}>
            <h3>{cfg.title}</h3>
            <p className="hint">{cfg.hint}</p>
            {top.length === 0 && <p className="hint">Nothing here yet.</p>}
            <ul className="nav-list">
              {top.map((it, k) => {
                const kids = items.filter((i) => i.parentId === it.id);
                return (
                  <Row key={it.id} item={it} cfg={cfg} index={k} count={top.length} error={errors[it.id]} onChange={patch} onRemove={remove} onStep={(id, d) => edit((l) => step(l, id, d))} onDrop={dropOn} onDrag={setDragging} dragging={dragging} canDrop={!!dragging && items.find((i) => i.id === dragging)?.menu === cfg.menu && items.find((i) => i.id === dragging)?.parentId === null}>
                    {cfg.grouped && (
                      <>
                        <ul className="nav-list nav-children">
                          {kids.map((c, j) => (
                            <Row key={c.id} item={c} cfg={cfg} index={j} count={kids.length} error={errors[c.id]} onChange={patch} onRemove={remove} onStep={(id, d) => edit((l) => step(l, id, d))} onDrop={dropOn} onDrag={setDragging} dragging={dragging} canDrop={!!dragging && items.find((i) => i.id === dragging)?.parentId === it.id} />
                          ))}
                        </ul>
                        <button type="button" className="nav-add" onClick={() => add(cfg, it.id)} disabled={kids.length >= (cfg.maxChildren ?? 99)}>+ Add link to “{it.label || "column"}”</button>
                      </>
                    )}
                  </Row>
                );
              })}
            </ul>
            <button type="button" className="nav-add" onClick={() => add(cfg, null)} disabled={top.length >= cfg.max}>+ Add {cfg.noun}</button>
          </section>
        );
      })}

      <div className="savebar">
        <button type="submit" className="primary" disabled={pending || !dirty}>{pending ? "Saving…" : `Save ${section} navigation`}</button>
        <button type="button" onClick={() => { setSeen(state?.nonce); setItems(initial); }} disabled={pending || !dirty}>Cancel changes</button>
        <span className="hint">{dirty ? "Unsaved changes. Deleting and reordering only take effect when you save." : "Changes go live on the website as soon as you save."}</span>
      </div>
    </form>
  );
}
