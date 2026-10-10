"use client";

import { useId, useRef, useState, useTransition } from "react";
import type { CmsFormState } from "@/actions/cms-pages";
import { blank, blankItem, type FieldDef } from "@/lib/cms/fields";
import type { CaseOption, MediaOption } from "@/lib/server/services-admin";
import type { StoredBlock } from "@/lib/validation/blog";
import ArticleEditor from "./ArticleEditor";
import Rich, { RichLines } from "@/components/site/ui/Rich";
import { MediaField } from "./MediaPicker";

/** An earlier saved version of the section (content is null if it no longer passes the section's checks). */
export type RevisionView = { id: string; savedAt: string; replacedAt: string; by: string | null; kind: "edit" | "restore"; changedFields: string[]; content: unknown };

/** One choice of a list that comes from the database (another case study, a category, ...). */
export type PickOption = { value: string; label: string; status?: string };
type Ctx = { media: MediaOption[]; cases: CaseOption[]; options: Record<string, PickOption[]>; errors: Record<string, string> };
type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Moves the item at `i` one place (−1 up, +1 down). */
function move<T>(list: readonly T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return [...list];
  const c = [...list];
  [c[i], c[j]] = [c[j]!, c[i]!];
  return c;
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

/** A readable path for the error summary: "items.2.title" -> "items 3 › title". */
const readable = (path: string) => path.split(".").map((p) => (/^\d+$/.test(p) ? String(Number(p) + 1) : p)).join(" › ");

function Counter({ len, max }: { len: number; max: number }) {
  return <span className={len > max ? "over" : ""}>{len}/{max}</span>;
}

/** Rich text: a text area with buttons that wrap the selection in <em> or <b>, and a preview of what the website will show. Only those two tags are allowed (the server checks). */
function RichInput({ id, value, onChange, rows, lines, invalid, label }: { id: string; value: string; onChange: (v: string) => void; rows: number; lines: boolean; invalid: boolean; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const wrap = (tag: "em" | "b") => {
    const el = ref.current;
    if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd;
    const sel = value.slice(a, b) || "text";
    onChange(`${value.slice(0, a)}<${tag}>${sel}</${tag}>${value.slice(b)}`);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + tag.length + 2, a + tag.length + 2 + sel.length); });
  };
  const clear = () => onChange(value.replace(/<\/?(em|b)>/g, ""));
  return (
    <div className="rich-input">
      <div className="rich-tools" role="toolbar" aria-label={`Formatting for ${label}`}>
        <button type="button" onClick={() => wrap("em")} title="Emphasise the selected words (italic accent)"><em>Emphasis</em></button>
        <button type="button" onClick={() => wrap("b")} title="Make the selected words bold"><b>Bold</b></button>
        <button type="button" onClick={clear} disabled={!/<\/?(em|b)>/.test(value)} title="Remove all emphasis">Clear formatting</button>
      </div>
      <textarea id={id} ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} />
      <p className="rich-preview" aria-label="Preview">{lines ? <RichLines>{value}</RichLines> : <Rich>{value}</Rich>}</p>
    </div>
  );
}

/** One field of a section, by kind. `value` is this field's part of the content; `set` replaces it. */
function Field({ def, value, path, set, ctx, bare = false }: { def: FieldDef; value: unknown; path: string; set: (v: unknown) => void; ctx: Ctx; /** no label (the caller shows it) */ bare?: boolean }) {
  const id = `sf-${useId()}`;
  const err = ctx.errors[path] ?? (def.kind === "media" ? ctx.errors[`${path}.id`] ?? ctx.errors[`${path}.alt`] : undefined);
  const cls = err ? "field has-err" : "field";
  const label = bare ? null : <label htmlFor={id}>{def.label}{("optional" in def && def.optional) || (def.kind === "text" && def.optional) ? <span className="opt-tag"> optional</span> : null}</label>;
  const hint = def.hint ? <p className="hint">{def.hint}</p> : null;
  const error = err ? <p className="field-err" role="alert">{err}</p> : null;

  switch (def.kind) {
    case "text":
    case "rich": {
      const v = typeof value === "string" ? value : "";
      const rows = def.rows;
      return (
        <div className={cls}>
          {label}
          {def.kind === "rich" ? (
            <RichInput id={id} value={v} onChange={set} rows={rows ?? (def.lines ? 3 : 2)} lines={!!def.lines} invalid={!!err} label={def.label} />
          ) : rows && rows > 1 ? (
            <textarea id={id} rows={rows} value={v} onChange={(e) => set(e.target.value)} aria-invalid={err ? true : undefined} aria-label={bare ? def.label : undefined} />
          ) : (
            <input id={id} type="text" value={v} onChange={(e) => set(e.target.value)} aria-invalid={err ? true : undefined} aria-label={bare ? def.label : undefined} />
          )}
          <p className="hint"><Counter len={v.length} max={def.max} /></p>
          {hint}
          {error}
        </div>
      );
    }
    case "href":
    case "colour":
    case "timezone": {
      const v = typeof value === "string" ? value : "";
      return (
        <div className={cls}>
          {label}
          <input id={id} type="text" value={v} list={def.kind === "timezone" ? "cms-timezones" : undefined} placeholder={def.kind === "colour" ? "#ffb86b" : def.kind === "href" ? "/about, #contact or https://…" : undefined} onChange={(e) => set(e.target.value)} aria-invalid={err ? true : undefined} />
          {hint}
          {error}
        </div>
      );
    }
    case "select":
      return (
        <div className={cls}>
          {label}
          <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)}>{def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          {hint}
          {error}
        </div>
      );
    case "bool":
      return (
        <div className={cls}>
          <label className="check"><input id={id} type="checkbox" checked={value === true} onChange={(e) => set(e.target.checked)} /> {def.text}</label>
          {hint}
          {error}
        </div>
      );
    case "media": {
      const ref = isObj(value) ? { id: String(value.id ?? ""), alt: String(value.alt ?? "") } : null;
      const change = (nid: string) => set(nid ? (def.noAlt ? { id: nid } : { id: nid, alt: ref?.alt ?? "" }) : def.optional ? null : def.noAlt ? { id: "" } : { id: "", alt: "" });
      return (
        <div className={err ? "field has-err media-pick" : "field media-pick"}>
          {bare ? null : <span className="label-like">{def.label}{def.optional ? <span className="opt-tag"> optional</span> : null}</span>}
          <MediaField id={id} value={ref?.id ?? ""} known={ctx.media} optional={def.optional} label={def.label} kind={def.media} details onChange={(nid) => change(nid)} onDescribe={def.noAlt ? undefined : (alt) => set({ id: ref?.id ?? "", alt })} />
          {ref && ref.id && !def.noAlt && (
            <>
              <label htmlFor={`${id}-alt`} className="sub">Description for screen readers (leave empty if it is only decoration)</label>
              <input id={`${id}-alt`} type="text" value={ref.alt} maxLength={240} onChange={(e) => set({ id: ref.id, alt: e.target.value })} />
            </>
          )}
          {hint}
          {error}
        </div>
      );
    }
    case "group": {
      const on = isObj(value);
      return (
        <fieldset className={err ? "le-item has-err cms-group" : "le-item cms-group"}>
          <legend>{def.label}</legend>
          {def.optional && (
            <label className="check"><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked ? blank({ ...def, optional: false }) : null)} /> Show this part</label>
          )}
          {hint}
          {on && def.fields.map((f) => <Field key={f.key} def={f} value={(value as Obj)[f.key]} path={`${path}.${f.key}`} set={(v) => set({ ...(value as Obj), [f.key]: v })} ctx={ctx} />)}
          {error}
        </fieldset>
      );
    }
    case "hidden":
      return null;
    case "number": {
      const v = typeof value === "number" ? String(value) : "";
      return (
        <div className={cls}>
          {label}
          <input id={id} type="number" inputMode="numeric" min={def.min} max={def.max} step={1} value={v} onChange={(e) => set(e.target.value === "" ? (def.optional ? null : def.min) : Number(e.target.value))} aria-invalid={err ? true : undefined} />
          {hint}
          {error}
        </div>
      );
    }
    case "datetime":
      return (
        <div className={cls}>
          {label}
          <input id={id} type="datetime-local" value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)} aria-invalid={err ? true : undefined} />
          {hint}
          {error}
        </div>
      );
    case "blocks":
      return (
        <div className={cls}>
          <span className="label-like">{def.label}</span>
          {hint}
          <ArticleEditor name={def.key} initial={Array.isArray(value) ? (value as StoredBlock[]) : []} value={Array.isArray(value) ? (value as StoredBlock[]) : []} onChange={(b) => set(b)} media={ctx.media} errors={ctx.errors} />
          {error}
        </div>
      );
    case "pick": {
      const opts = ctx.options[def.source] ?? [];
      const labelOf = (o: PickOption) => `${o.label}${o.status && o.status !== "published" ? ` — ${o.status}` : ""}`;
      if (def.single) {
        return (
          <div className={cls}>
            {label}
            <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => set(e.target.value)} aria-invalid={err ? true : undefined}>
              <option value="">Choose…</option>
              {opts.map((o) => <option key={o.value} value={o.value}>{labelOf(o)}</option>)}
            </select>
            {hint}
            {error}
          </div>
        );
      }
      const vals = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={cls}>
          <span className="label-like">{def.label}</span>
          {hint}
          <div className="list-editor">
            {vals.map((v, i) => (
              <div className="cms-case-row" key={i}>
                <select value={v} aria-label={`${def.label} ${i + 1}`} onChange={(e) => set(vals.map((x, k) => (k === i ? e.target.value : x)))}>
                  <option value="">Choose…</option>
                  {opts.map((o) => <option key={o.value} value={o.value}>{labelOf(o)}</option>)}
                </select>
                <button type="button" onClick={() => set(move(vals, i, -1))} disabled={i === 0} aria-label={`Move ${i + 1} up`}>↑</button>
                <button type="button" onClick={() => set(move(vals, i, 1))} disabled={i === vals.length - 1} aria-label={`Move ${i + 1} down`}>↓</button>
                <button type="button" className="danger" onClick={() => set(vals.filter((_, k) => k !== i))} disabled={vals.length <= def.min}>Remove</button>
                {ctx.errors[`${path}.${i}`] && <p className="field-err">{ctx.errors[`${path}.${i}`]}</p>}
              </div>
            ))}
            <button type="button" onClick={() => set([...vals, ""])} disabled={vals.length >= def.max}>+ Add {def.noun}</button>
            <p className="hint">{def.min === def.max ? `Exactly ${def.min}` : `${def.min} to ${def.max}`}.</p>
          </div>
          {error}
        </div>
      );
    }
    case "cases": {
      const ids = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className={cls}>
          <span className="label-like">{def.label}</span>
          {hint}
          <div className="list-editor">
            {ids.map((cid, i) => (
              <div className="cms-case-row" key={i}>
                <select value={cid} aria-label={`${def.label} ${i + 1}`} onChange={(e) => set(ids.map((x, k) => (k === i ? e.target.value : x)))}>
                  <option value="">Choose a case study…</option>
                  {ctx.cases.map((c) => <option key={c.id} value={c.id}>{c.label}{c.status !== "published" ? ` — ${c.status}` : ""}</option>)}
                </select>
                <button type="button" onClick={() => set(move(ids, i, -1))} disabled={i === 0} aria-label={`Move ${i + 1} up`}>↑</button>
                <button type="button" onClick={() => set(move(ids, i, 1))} disabled={i === ids.length - 1} aria-label={`Move ${i + 1} down`}>↓</button>
                <button type="button" className="danger" onClick={() => set(ids.filter((_, k) => k !== i))} disabled={ids.length <= def.min}>Remove</button>
                {ctx.errors[`${path}.${i}`] && <p className="field-err">{ctx.errors[`${path}.${i}`]}</p>}
              </div>
            ))}
            <button type="button" onClick={() => set([...ids, ""])} disabled={ids.length >= def.max}>+ Add case study</button>
            <p className="hint">{def.min === def.max ? `Exactly ${def.min}` : `${def.min} to ${def.max}`} · only published case studies are shown on the website.</p>
          </div>
          {error}
        </div>
      );
    }
    case "list": {
      const items = Array.isArray(value) ? (value as unknown[]) : [];
      const leaf = "leaf" in def.of ? def.of.leaf : null;
      return (
        <div className={err ? "field has-err" : "field"}>
          <span className="label-like">{def.label}</span>
          {hint}
          <div className="list-editor">
            {items.map((it, i) => (
              <fieldset className={Object.keys(ctx.errors).some((k) => k.startsWith(`${path}.${i}.`) || k === `${path}.${i}`) ? "le-item has-err" : "le-item"} key={i}>
                <legend>{def.noun[0]!.toUpperCase() + def.noun.slice(1)} {i + 1}</legend>
                <div className="le-tools">
                  <button type="button" onClick={() => set(move(items, i, -1))} disabled={i === 0} aria-label={`Move ${def.noun} ${i + 1} up`}>↑</button>
                  <button type="button" onClick={() => set(move(items, i, 1))} disabled={i === items.length - 1} aria-label={`Move ${def.noun} ${i + 1} down`}>↓</button>
                  {!def.fixed && <button type="button" className="danger" onClick={() => set(items.filter((_, k) => k !== i))} disabled={items.length <= def.min} aria-label={`Remove ${def.noun} ${i + 1}`}>Remove</button>}
                </div>
                {leaf ? (
                  <Field def={leaf} bare value={it} path={`${path}.${i}`} set={(v) => set(items.map((x, k) => (k === i ? v : x)))} ctx={ctx} />
                ) : (
                  "fields" in def.of && def.of.fields.map((f) => <Field key={f.key} def={f} value={isObj(it) ? it[f.key] : undefined} path={`${path}.${i}.${f.key}`} set={(v) => set(items.map((x, k) => (k === i ? { ...(x as Obj), [f.key]: v } : x)))} ctx={ctx} />)
                )}
              </fieldset>
            ))}
            {!def.fixed && <button type="button" onClick={() => set([...items, blankItem(def)])} disabled={items.length >= def.max}>+ Add {def.noun}</button>}
            <p className="hint">{def.fixed ? `Exactly ${def.min}: the layout is built for this number.` : def.min === def.max ? `Exactly ${def.min}.` : `${def.min} to ${def.max}.`}</p>
          </div>
          {error}
        </div>
      );
    }
  }
}

type Props = {
  /** The server action that saves this section, and the fields it is told which section this is (page + key, or kind + id + key). */
  action: (prev: CmsFormState, f: FormData) => Promise<CmsFormState>;
  /** Puts an earlier version back (it is told the same `target`, the `revisionId` and the version token). */
  restoreAction: (prev: CmsFormState, f: FormData) => Promise<CmsFormState>;
  /** Present for content that has draft and published versions: whether a draft exists, and the actions that publish or discard it. */
  drafts?: { has: boolean; publish: (prev: CmsFormState, f: FormData) => Promise<CmsFormState>; discard: (prev: CmsFormState, f: FormData) => Promise<CmsFormState> };
  target: Record<string, string>;
  /** The lists the choice fields draw from. */
  options?: Record<string, PickOption[]>;
  fields: readonly FieldDef[];
  initial: unknown;
  updatedAt: string;
  damaged: boolean;
  media: MediaOption[];
  cases: CaseOption[];
  /** Earlier saved versions, newest first. */
  revisions: RevisionView[];
};

/**
 * Edits the content of one section. The form is described by `fields` (src/lib/cms/fields.ts); nothing is written until Save, Cancel puts back what is
 * stored, and the server checks everything again against the strict schema of the section (the same rules, whatever the browser sent).
 */
export default function SectionEditor({ action, restoreAction, drafts, target, options = {}, fields, initial, updatedAt, damaged, media, cases, revisions }: Props) {
  const [value, setValue] = useState<Obj>(isObj(initial) ? initial : {});
  const [saved, setSaved] = useState<{ obj: Obj; stamp: string }>({ obj: isObj(initial) ? initial : {}, stamp: updatedAt });
  const [result, setResult] = useState<CmsFormState>(undefined);
  const [pending, start] = useTransition();
  const [hasDraft, setHasDraft] = useState(!!drafts?.has);
  const dirty = JSON.stringify(value) !== JSON.stringify(saved.obj);
  const errors = result && !result.ok && result.kind === "invalid" ? result.errors : {};
  const n = Object.keys(errors).length;

  const save = () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(target)) fd.set(k, v);
    fd.set("content", JSON.stringify(value));
    fd.set("expectedUpdatedAt", saved.stamp);
    start(async () => {
      const r = await action(undefined, fd);
      setResult(r);
      if (r?.ok) { setSaved({ obj: value, stamp: r.updatedAt }); if (drafts) setHasDraft(!!r.draft); }
    });
  };
  const draftAction = (which: "publish" | "discard") => {
    if (!drafts) return;
    const fd = new FormData();
    for (const [k, v] of Object.entries(target)) fd.set(k, v);
    start(async () => {
      const r = await drafts[which](undefined, fd);
      setResult(r);
      if (r?.ok) window.location.reload(); // the screen then shows the published content and the new list of versions
    });
  };
  const restore = (revisionId: string) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(target)) fd.set(k, v);
    fd.set("revisionId", revisionId);
    fd.set("expectedUpdatedAt", saved.stamp);
    start(async () => {
      const r = await restoreAction(undefined, fd);
      setResult(r);
      if (r?.ok) window.location.reload(); // the page then shows the restored content and the new list of versions
    });
  };
  const edit = (f: FieldDef, v: unknown) => { setResult(undefined); setValue((cur) => ({ ...cur, [f.key]: v })); };
  const ctx: Ctx = { media, cases, options, errors };

  return (
    <form className="svc-form cms-editor" onSubmit={(e) => { e.preventDefault(); if (dirty && !pending) save(); }} noValidate>
      <datalist id="cms-timezones">{["Europe/Lisbon", "Europe/London", "Europe/Berlin", "America/New_York", "America/Toronto", "America/Los_Angeles", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"].map((z) => <option key={z} value={z} />)}</datalist>
      {damaged && <div className="form-errors" role="status"><b>The saved content of this section no longer passes its checks.</b> The website is showing the built-in text instead. What you see here is that text; saving puts it right.</div>}
      {result && !result.ok && result.kind === "conflict" && <div className="form-errors" role="alert"><b>This section was changed by someone else after you opened it.</b> Nothing was saved. <button type="button" onClick={() => window.location.reload()}>Reload to see their version</button></div>}
      {result && !result.ok && result.kind === "missing" && <div className="form-errors" role="alert"><b>This section is not in the database yet.</b> Run the page seed (<code>npm run db:seed:pages:remote</code>) first.</div>}
      {n > 0 && (
        <div className="form-errors" role="alert">
          <b>{n === 1 ? "One thing needs fixing" : `${n} things need fixing`} before this can be saved:</b>
          <ul>{Object.entries(errors).map(([k, m]) => <li key={k}>{k === "form" ? m : `${readable(k)}: ${m}`}</li>)}</ul>
        </div>
      )}
      {drafts && hasDraft && (
        <div className="draft-banner" role="status">
          <b>Draft.</b> This section has unpublished changes. Visitors see the published version until you publish.
          <span className="rev-actions">
            <button type="button" className="primary" disabled={pending || dirty} onClick={() => draftAction("publish")}>Publish this section</button>
            <button type="button" disabled={pending || dirty} onClick={() => draftAction("discard")}>Discard draft</button>
          </span>
          {dirty && <small> Save or cancel your edits first.</small>}
        </div>
      )}
      {result?.ok && !dirty && <p className="hint cms-saved" role="status">{drafts ? (result.draft ? "Draft saved. Visitors still see the published version." : "Saved. It is the same as the published version, so there is no draft.") : "Saved. It is live on the website now."}</p>}

      <section className="form-card">
        {fields.map((f) => <Field key={f.key} def={f} value={value[f.key]} path={f.key} set={(v) => edit(f, v)} ctx={ctx} />)}
      </section>

      <section className="form-card cms-versions">
        <h2>Versions</h2>
        <p className="hint"><b>Last saved version:</b> the one in the editor, saved {when(saved.stamp)}. {revisions.length > 0 ? `Each change keeps the version it replaces (the last ${revisions.length >= 10 ? "10" : "few"}). Restore one to make it live again; the current one is kept as a new previous version.` : "Nothing has been replaced yet: after the next change the version it replaces appears here."}</p>
        {dirty && revisions.length > 0 && <p className="hint">Save or cancel your changes before restoring a version.</p>}
        <ul>
          {revisions.map((r, i) => (
            <li key={r.id}>
              <span>
                <b>{i === 0 ? "Previous version" : "Earlier version"}</b>, replaced {when(r.replacedAt)}{r.by ? ` by ${r.by}` : ""}{r.kind === "restore" ? " (by a restore)" : ""}
                <small> · saved {when(r.savedAt)}{r.changedFields.length ? ` · the change touched: ${r.changedFields.join(", ")}` : ""}</small>
              </span>
              {r.content && typeof r.content === "object" ? (
                <span className="rev-actions">
                  <button type="button" className="primary" disabled={pending || dirty} onClick={() => restore(r.id)}>Restore this version</button>
                  <button type="button" disabled={pending} onClick={() => { setValue(r.content as Obj); setResult(undefined); }}>Load into the editor</button>
                </span>
              ) : (
                <small>Cannot be restored (it no longer fits this section)</small>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="savebar">
        <button type="submit" className="primary" disabled={pending || !dirty}>{pending ? "Saving…" : drafts ? "Save draft" : "Save section"}</button>
        <button type="button" onClick={() => { setValue(saved.obj); setResult(undefined); }} disabled={pending || !dirty}>Cancel changes</button>
        <span className="hint">{dirty ? "Unsaved changes." : drafts ? "Saving keeps a draft; nothing goes live until you publish." : "Changes go live on the website as soon as you save."}</span>
      </div>
    </form>
  );
}
