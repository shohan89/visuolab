"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import MediaUploader from "./MediaUploader";
import { formatBytes, type PublicMedia } from "./media-types";

type Known = { id: string; title: string; url: string; width: number | null; height: number | null };

type Source = "all" | "r2" | "static";
type Shape = "any" | "landscape" | "portrait" | "square";

/** The file's name: what it was uploaded as, or the last part of its address (files shipped with the site). */
export const fileName = (m: Pick<PublicMedia, "originalName" | "url">) => m.originalName || decodeURIComponent(m.url.split("?")[0]!.split("/").pop() ?? "");

const shapeOf = (m: PublicMedia): Shape => (!m.width || !m.height ? "any" : Math.abs(m.width - m.height) / Math.max(m.width, m.height) < 0.05 ? "square" : m.width > m.height ? "landscape" : "portrait");

/** A thumbnail: a picture, or the first frame of a video. */
function Thumb({ m }: { m: Pick<PublicMedia, "kind" | "url"> }) {
  return m.kind === "video" ? <video src={m.url} muted preload="metadata" aria-hidden="true" /> : <img src={m.url} alt="" loading="lazy" />;
}

/**
 * MediaPicker: a dialog on the media library. It lists the files with their thumbnail, file name, size, dimensions and description, searches them,
 * filters them (where they come from, their shape), lets the editor upload a new picture on the spot, and returns the chosen file.
 * `type` is what may be chosen ("image" by default; "video" lists the videos, which cannot be uploaded here).
 * Reusable anywhere in the admin: `<MediaPicker open onClose onSelect />`. For a form field use MediaField.
 */
export default function MediaPicker({ open, onClose, onSelect, title = "Choose an image", type = "image", initialTab = "library", selectedId }: {
  open: boolean; onClose: () => void; onSelect: (item: PublicMedia) => void; title?: string; type?: "image" | "video"; initialTab?: "library" | "upload"; selectedId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // rendered into <body>, not into the form that holds the field: Enter in the search box must not submit that form
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<Source>("all");
  const [shape, setShape] = useState<Shape>("any");
  const [items, setItems] = useState<PublicMedia[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"library" | "upload">(initialTab);

  const load = useCallback(async (query: string, p: number, append: boolean, src: Source) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type, q: query, page: String(p), limit: "24", ...(src !== "all" ? { storage: src } : {}) });
      const res = await fetch(`/api/admin/media?${params}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: PublicMedia[]; page: number; pages: number; total: number };
      setItems((cur) => (append ? [...cur, ...data.items] : data.items));
      setPage(data.page);
      setPages(data.pages);
      setTotal(data.total);
    } catch {
      setError("The library could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, [type]);

  // open / close the native dialog; show the tab asked for and load the first page each time it opens
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); setTab(type === "image" ? initialTab : "library"); void load(q, 1, false, source); }
    if (!open && d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the query is read when the dialog opens; typing in the search box has its own effect below
  }, [open, load]);

  // search and filter as the editor types or chooses (after a short pause)
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void load(q, 1, false, source), 250);
    return () => window.clearTimeout(t);
  }, [q, source, open, load]);

  if (!mounted) return null;
  const shown = shape === "any" ? items : items.filter((m) => shapeOf(m) === shape);
  return createPortal(
    <dialog ref={dialog} className="picker" aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === dialog.current) onClose(); }}>
      <div className="picker-box">
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="picker-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>Library</button>
          {type === "image" && <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")}>Upload</button>}
        </div>
        {tab === "library" ? (
          <>
            <div className="picker-filters">
              <input type="search" className="picker-search" placeholder="Search by title, description or file name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the media library" autoFocus />
              <label>Source
                <select value={source} onChange={(e) => setSource(e.target.value as Source)} aria-label="Filter by source">
                  <option value="all">All files</option>
                  <option value="r2">Uploaded</option>
                  <option value="static">Shipped with the site</option>
                </select>
              </label>
              {type === "image" && (
                <label>Shape
                  <select value={shape} onChange={(e) => setShape(e.target.value as Shape)} aria-label="Filter by shape">
                    <option value="any">Any shape</option>
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                    <option value="square">Square</option>
                  </select>
                </label>
              )}
            </div>
            <p className="hint picker-count" aria-live="polite">{loading ? "Loading…" : `${total} file${total === 1 ? "" : "s"}${shape !== "any" ? `, ${shown.length} of the ones loaded match the shape` : ""}`}</p>
            {error && <p className="field-err" role="alert">{error}</p>}
            {!loading && !error && shown.length === 0 && <p className="hint">Nothing found. Try another search or filter{type === "image" ? ", or upload a picture" : ""}.</p>}
            <ul className="picker-grid">
              {shown.map((m) => (
                <li key={m.id}>
                  <button type="button" className={m.id === selectedId ? "is-selected" : undefined} onClick={() => onSelect(m)} title={m.title} aria-label={`${m.title}, ${fileName(m)}`}>
                    <Thumb m={m} />
                    <span className="p-title">{m.title}</span>
                    <span className="p-file">{fileName(m)}</span>
                    <span className="p-meta">{m.width && m.height ? `${m.width}×${m.height}` : "—"} · {formatBytes(m.bytes)}</span>
                    <span className={m.alt ? "p-alt" : "p-alt none"}>{m.alt || "No description"}</span>
                  </button>
                </li>
              ))}
            </ul>
            {page < pages && <button type="button" className="picker-more" onClick={() => void load(q, page + 1, true, source)} disabled={loading}>{loading ? "Loading…" : "Load more"}</button>}
          </>
        ) : (
          <MediaUploader compact onUploaded={(done) => { if (done[0]) onSelect(done[0]); }} />
        )}
      </div>
    </dialog>,
    document.body,
  );
}

const details = new Map<string, PublicMedia>(); // what the API told us about a file, kept while the page is open

/**
 * A form field built on the picker: shows the chosen picture, "Choose / Change" opens the dialog, and the chosen id is submitted under `name`.
 * Controlled when `onChange` is given, otherwise it keeps its own value. `known` lets the first render show thumbnails without a request.
 *
 * With `details` (the page section editor) the field also shows the file's name, size, dimensions and description, and offers:
 * Upload new (the picker opens on its Upload tab), Replace file (a new file for the same library entry: every page that uses it follows),
 * Remove, and "Use as description" (copies the library description to the page's own description). `kind="video"` picks a video.
 */
export function MediaField({ name, value, onChange, known = [], optional = false, label, id, kind = "image", details: withDetails = false, onDescribe }: {
  name?: string; value: string; onChange?: (id: string, item?: PublicMedia) => void; known?: Known[]; optional?: boolean; label?: string; id?: string;
  kind?: "image" | "video"; details?: boolean; onDescribe?: (alt: string) => void;
}) {
  const [own, setOwn] = useState(value);
  const current = onChange ? value : own;
  const [open, setOpen] = useState<null | "library" | "upload">(null);
  const [fetched, setFetched] = useState<Record<string, PublicMedia>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [replacing, setReplacing] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const info: PublicMedia | undefined = fetched[current] ?? details.get(current);
  const found = info ?? known.find((k) => k.id === current);

  // the file's details: asked of the API (the page only preloaded a thumbnail), once per file
  useEffect(() => {
    if (!current || (withDetails ? info : found)) return;
    let live = true;
    fetch(`/api/admin/media?id=${encodeURIComponent(current)}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: PublicMedia[] }>) : null))
      .then((d) => { const m = d?.items?.[0]; if (live && m) { details.set(m.id, m); setFetched((f) => ({ ...f, [m.id]: m })); } })
      .catch(() => {});
    return () => { live = false; };
  }, [current, info, found, withDetails]);

  const choose = (m: PublicMedia | null) => {
    if (m) { details.set(m.id, m); setFetched((f) => ({ ...f, [m.id]: m })); }
    setNote(null);
    if (onChange) onChange(m?.id ?? "", m ?? undefined);
    else setOwn(m?.id ?? "");
    setOpen(null);
  };

  const replace = async (f: File | undefined) => {
    if (!f || !current) return;
    if (!window.confirm("Replace the file of this library entry? Every page that uses it will show the new picture.")) return;
    setReplacing(true);
    setNote(null);
    try {
      const body = new FormData();
      body.append("file", f);
      const res = await fetch(`/api/admin/media/${encodeURIComponent(current)}/replace`, { method: "POST", body, credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { item?: PublicMedia; error?: string };
      if (!res.ok || !data.item) setNote({ ok: false, text: data.error ?? `The file could not be replaced (${res.status}).` });
      else { details.set(data.item.id, data.item); setFetched((cur) => ({ ...cur, [data.item!.id]: data.item! })); setNote({ ok: true, text: "File replaced. Every page that uses it now shows the new picture." }); }
    } catch {
      setNote({ ok: false, text: "The file could not be sent. Check the connection and try again." });
    } finally {
      setReplacing(false);
      if (file.current) file.current.value = "";
    }
  };

  const noun = kind === "video" ? "video" : "image";
  return (
    <div className={withDetails ? "media-field has-details" : "media-field"}>
      {name && <input type="hidden" name={name} value={current} />}
      <div className="media-row">
        {found ? (
          kind === "video" && info ? <video src={info.url} muted preload="metadata" width={96} height={72} aria-hidden="true" /> : <img src={found.url} alt="" width={96} height={72} />
        ) : (
          <span className="media-none">{current ? "…" : optional ? "None" : `No ${noun}`}</span>
        )}
        <div className="media-field-actions">
          {found && <span className="p-title">{found.title}</span>}
          <div className="media-buttons">
            <button type="button" id={id} onClick={() => setOpen("library")} aria-label={label ? `${current ? "Change" : "Choose"} ${label}` : undefined}>{current ? "Change" : `Choose ${noun}`}</button>
            {withDetails && kind === "image" && <button type="button" onClick={() => setOpen("upload")} aria-label={label ? `Upload new ${label}` : undefined}>Upload new</button>}
            {withDetails && kind === "image" && current && info?.storage === "r2" && (
              <>
                <button type="button" onClick={() => file.current?.click()} disabled={replacing} aria-label={label ? `Replace file of ${label}` : undefined}>{replacing ? "Replacing…" : "Replace file"}</button>
                <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={(e) => void replace(e.target.files?.[0])} aria-label="Choose the new file" />
              </>
            )}
            {(optional || withDetails) && current && <button type="button" className="link" onClick={() => choose(null)} aria-label={label ? `Remove ${label}` : undefined}>Remove</button>}
          </div>
        </div>
      </div>
      {withDetails && current && info && (
        <dl className="media-info">
          <div><dt>File</dt><dd>{fileName(info)}</dd></div>
          <div><dt>Size</dt><dd>{formatBytes(info.bytes)}{info.width && info.height ? ` · ${info.width}×${info.height} px` : ""}{info.mime ? ` · ${info.mime.replace("image/", "").replace("video/", "").toUpperCase()}` : ""}</dd></div>
          <div><dt>Library description</dt><dd>{info.alt || <em>None</em>}{onDescribe && info.alt ? <> <button type="button" className="link" onClick={() => onDescribe(info.alt)}>Use as description here</button></> : null}</dd></div>
          {info.storage === "static" && <div><dt>Source</dt><dd>Shipped with the site (cannot be replaced here)</dd></div>}
        </dl>
      )}
      {note && <p className={note.ok ? "hint cms-saved" : "field-err"} role={note.ok ? "status" : "alert"}>{note.text}</p>}
      <MediaPicker open={open !== null} onClose={() => setOpen(null)} onSelect={(m) => choose(m)} title={label ? `Choose: ${label}` : `Choose ${noun === "video" ? "a video" : "an image"}`} type={kind} initialTab={open === "upload" ? "upload" : "library"} selectedId={current} />
    </div>
  );
}
