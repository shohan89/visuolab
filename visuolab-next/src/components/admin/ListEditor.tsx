"use client";

import { useState } from "react";
import { MediaField } from "./MediaPicker";

export type ListField = { key: string; label: string; kind?: "text" | "textarea" | "select" | "checkbox" | "pairs" | "media";
  /** For kind "media": the files the page already knows (thumbnails without a request) */
  media?: { id: string; title: string; url: string; width: number | null; height: number | null }[]; options?: { value: string; label: string }[]; max?: number; placeholder?: string };
type Item = Record<string, unknown>;

type Props = {
  /** Name of the hidden input that carries the list (as JSON) to the server action. */
  name: string;
  items: Item[];
  fields: ListField[];
  /** Used for the heading of each entry: "Step 1", "Block 2". */
  noun: string;
  min?: number;
  max?: number;
  /** Extra keys given to a new entry (an icon, for example). Keys of existing entries that are not fields are kept as they are. */
  defaults?: Item;
  /** Path of this list in the error map, e.g. "overview.blocks"; field errors are looked up as `${errorPath}.${index}.${key}`. */
  errorPath: string;
  errors: Record<string, string>;
  /** When set, the list holds plain strings (the chosen ids) and each entry has this one field. */
  asStrings?: string;
};

const blank = (fields: ListField[], defaults: Item = {}): Item => ({ ...Object.fromEntries(fields.map((f) => [f.key, f.kind === "checkbox" ? false : f.kind === "pairs" ? [] : ""])), ...structuredClone(defaults) });

/** "Title | detail" per line, in both directions. Only the first " | " on a line separates the two. */
const pairsToText = (v: unknown) => (Array.isArray(v) ? v.map((p) => `${(p as { title: string }).title} | ${(p as { detail: string }).detail}`).join("\n") : "");
const parsePairs = (text: string) =>
  text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(" | "); return i < 0 ? { title: l, detail: "" } : { title: l.slice(0, i).trim(), detail: l.slice(i + 3).trim() }; });

/** An ordered list of small groups of fields: add, remove, move up and down. Native inputs; the whole list is sent as one JSON value. */
export default function ListEditor({ name, items, fields, noun, min = 0, max = 12, defaults, errorPath, errors, asStrings }: Props) {
  const [rows, setRows] = useState<Item[]>(() => (asStrings ? (items as unknown as string[]).map((v) => ({ [asStrings]: v })) : items.map((i) => ({ ...i }))));
  const clean = (row: Item): Item => {
    const out: Item = {};
    for (const [k, v] of Object.entries(row)) if (!k.startsWith("_t_")) out[k] = v;
    for (const f of fields) if (f.kind === "pairs" && typeof row[`_t_${f.key}`] === "string") out[f.key] = parsePairs(String(row[`_t_${f.key}`]));
    return out;
  };
  const value = JSON.stringify(asStrings ? rows.map((r) => r[asStrings]) : rows.map(clean));
  const set = (i: number, key: string, v: string | boolean) => setRows((r) => r.map((row, n) => (n === i ? { ...row, [key]: v } : row)));
  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const c = [...r];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
  const listError = errors[errorPath];

  return (
    <div className="list-editor">
      <input type="hidden" name={name} value={value} />
      {rows.length === 0 && <p className="hint">Nothing here yet.</p>}
      {rows.map((row, i) => (
        <fieldset className="le-item" key={i}>
          <legend>{noun} {i + 1}</legend>
          <div className="le-tools">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${noun} ${i + 1} up`}>↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move ${noun} ${i + 1} down`}>↓</button>
            <button type="button" className="danger" onClick={() => setRows((r) => r.filter((_, n) => n !== i))} disabled={rows.length <= min} aria-label={`Remove ${noun} ${i + 1}`}>Remove</button>
          </div>
          {fields.map((f) => {
            const id = `${name}-${i}-${f.key}`;
            const err = errors[`${errorPath}.${i}.${f.key}`];
            const v = String(row[f.key] ?? "");
            return (
              <div className={err ? "field has-err" : "field"} key={f.key}>
                <label htmlFor={id}>{f.label}</label>
                {f.kind === "media" ? (
                  <MediaField id={id} value={v} known={f.media} label={`${noun} ${i + 1} image`} onChange={(mid) => set(i, f.key, mid)} />
                ) : f.kind === "checkbox" ? (
                  <label className="check"><input id={id} type="checkbox" checked={Boolean(row[f.key])} onChange={(e) => set(i, f.key, e.target.checked)} /> {f.placeholder ?? "Yes"}</label>
                ) : f.kind === "pairs" ? (
                  <textarea id={id} rows={3} value={typeof row[`_t_${f.key}`] === "string" ? String(row[`_t_${f.key}`]) : pairsToText(row[f.key])} placeholder={f.placeholder} onChange={(e) => set(i, `_t_${f.key}`, e.target.value)} />
                ) : f.kind === "textarea" ? (
                  <textarea id={id} rows={3} maxLength={f.max} value={v} placeholder={f.placeholder} onChange={(e) => set(i, f.key, e.target.value)} />
                ) : f.kind === "select" ? (
                  <select id={id} value={v} onChange={(e) => set(i, f.key, e.target.value)}>
                    <option value="">Choose…</option>
                    {f.options?.map((o) => <option value={o.value} key={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input id={id} type="text" maxLength={f.max} value={v} placeholder={f.placeholder} onChange={(e) => set(i, f.key, e.target.value)} />
                )}
                {err && <p className="field-err">{err}</p>}
              </div>
            );
          })}
        </fieldset>
      ))}
      {listError && <p className="field-err">{listError}</p>}
      <button type="button" onClick={() => setRows((r) => [...r, blank(fields, defaults)])} disabled={rows.length >= max}>+ Add {noun.toLowerCase()}</button>
    </div>
  );
}
