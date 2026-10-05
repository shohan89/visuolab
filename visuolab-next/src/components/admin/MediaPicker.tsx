"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import MediaUploader from "./MediaUploader";
import { formatBytes, type PublicMedia } from "./media-types";

type Known = { id: string; title: string; url: string; width: number | null; height: number | null };

/**
 * MediaPicker: a dialog that lists the media library (search, load more), lets the editor upload new pictures on the spot, and
 * returns the chosen file. Reusable anywhere in the admin: `<MediaPicker open onClose onSelect />`. For a form field use MediaField.
 */
export default function MediaPicker({ open, onClose, onSelect, title = "Choose an image" }: { open: boolean; onClose: () => void; onSelect: (item: PublicMedia) => void; title?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // rendered into <body>, not into the form that holds the field: Enter in the search box must not submit that form
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PublicMedia[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"library" | "upload">("library");

  const load = useCallback(async (query: string, p: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/media?${new URLSearchParams({ type: "image", q: query, page: String(p), limit: "24" })}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { items: PublicMedia[]; page: number; pages: number };
      setItems((cur) => (append ? [...cur, ...data.items] : data.items));
      setPage(data.page);
      setPages(data.pages);
    } catch {
      setError("The library could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // open / close the native dialog; load the first page each time it opens
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); void load("", 1, false); }
    if (!open && d.open) d.close();
  }, [open, load]);

  // search as the editor types (after a short pause)
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => void load(q, 1, false), 250);
    return () => window.clearTimeout(t);
  }, [q, open, load]);

  if (!mounted) return null;
  return createPortal(
    <dialog ref={dialog} className="picker" aria-label={title} onClose={onClose} onClick={(e) => { if (e.target === dialog.current) onClose(); }}>
      <div className="picker-box">
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="picker-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>Library</button>
          <button type="button" role="tab" aria-selected={tab === "upload"} onClick={() => setTab("upload")}>Upload</button>
        </div>
        {tab === "library" ? (
          <>
            <input type="search" className="picker-search" placeholder="Search by title, description or file name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the media library" autoFocus />
            {error && <p className="field-err" role="alert">{error}</p>}
            {!loading && !error && items.length === 0 && <p className="hint">Nothing found. Try another search, or upload a picture.</p>}
            <ul className="picker-grid">
              {items.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onSelect(m)} title={m.title}>
                    <img src={m.url} alt="" loading="lazy" />
                    <span className="p-title">{m.title}</span>
                    <span className="p-meta">{m.width && m.height ? `${m.width}×${m.height}` : "—"} · {formatBytes(m.bytes)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {page < pages && <button type="button" className="picker-more" onClick={() => void load(q, page + 1, true)} disabled={loading}>{loading ? "Loading…" : "Load more"}</button>}
          </>
        ) : (
          <MediaUploader compact onUploaded={(done) => { if (done[0]) onSelect(done[0]); }} />
        )}
      </div>
    </dialog>,
    document.body,
  );
}

/**
 * A form field built on the picker: shows the chosen picture, "Choose / Change" opens the dialog, and the chosen id is submitted under `name`.
 * Controlled when `onChange` is given, otherwise it keeps its own value. `known` lets the first render show thumbnails without a request.
 */
export function MediaField({ name, value, onChange, known = [], optional = false, label, id }: {
  name?: string; value: string; onChange?: (id: string, item?: PublicMedia) => void; known?: Known[]; optional?: boolean; label?: string; id?: string;
}) {
  const [own, setOwn] = useState(value);
  const current = onChange ? value : own;
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState<Record<string, Known>>({});
  const found = known.find((k) => k.id === current) ?? fetched[current];

  // a chosen id the page did not preload (a file chosen earlier, from a long library): ask the API for it
  useEffect(() => {
    if (!current || found) return;
    let live = true;
    fetch(`/api/admin/media?id=${encodeURIComponent(current)}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? (r.json() as Promise<{ items?: PublicMedia[] }>) : null))
      .then((d) => { const m = d?.items?.[0]; if (live && m) setFetched((f) => ({ ...f, [m.id]: m })); })
      .catch(() => {});
    return () => { live = false; };
  }, [current, found]);

  const choose = (m: PublicMedia | null) => {
    if (m) setFetched((f) => ({ ...f, [m.id]: m }));
    if (onChange) onChange(m?.id ?? "", m ?? undefined);
    else setOwn(m?.id ?? "");
    setOpen(false);
  };

  return (
    <div className="media-field">
      {name && <input type="hidden" name={name} value={current} />}
      <div className="media-row">
        {found ? <img src={found.url} alt="" width={96} height={72} /> : <span className="media-none">{current ? "…" : optional ? "None" : "No image"}</span>}
        <div className="media-field-actions">
          {found && <span className="p-title">{found.title}</span>}
          <button type="button" id={id} onClick={() => setOpen(true)} aria-label={label ? `${current ? "Change" : "Choose"} ${label}` : undefined}>{current ? "Change" : "Choose image"}</button>
          {optional && current && <button type="button" className="link" onClick={() => choose(null)}>Remove</button>}
        </div>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} onSelect={(m) => choose(m)} title={label ? `Choose: ${label}` : "Choose an image"} />
    </div>
  );
}
