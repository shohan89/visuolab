"use client";

import { useState } from "react";

export type ListField = { key: string; label: string; kind?: "text" | "textarea" | "select"; options?: { value: string; label: string }[]; max?: number; placeholder?: string };
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

const blank = (fields: ListField[], defaults: Item = {}): Item => ({ ...Object.fromEntries(fields.map((f) => [f.key, ""])), ...structuredClone(defaults) });

/** An ordered list of small groups of fields: add, remove, move up and down. Native inputs; the whole list is sent as one JSON value. */
export default function ListEditor({ name, items, fields, noun, min = 0, max = 12, defaults, errorPath, errors, asStrings }: Props) {
  const [rows, setRows] = useState<Item[]>(() => (asStrings ? (items as unknown as string[]).map((v) => ({ [asStrings]: v })) : items.map((i) => ({ ...i }))));
  const value = JSON.stringify(asStrings ? rows.map((r) => r[asStrings]) : rows);
  const set = (i: number, key: string, v: string) => setRows((r) => r.map((row, n) => (n === i ? { ...row, [key]: v } : row)));
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
                {f.kind === "textarea" ? (
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
