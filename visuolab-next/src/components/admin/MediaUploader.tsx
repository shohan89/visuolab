"use client";

import { useRef, useState } from "react";
import { CLIENT_LIMIT, CLIENT_TYPES, formatBytes, type PublicMedia } from "./media-types";

type Entry = { key: number; name: string; state: "uploading" | "done" | "duplicate" | "error"; message?: string };

/**
 * Drag-and-drop / file-picker upload. Each file is sent to the Worker (POST /api/admin/media), which checks it and writes it to R2;
 * the browser never holds storage credentials. Files are sent one after the other, with a result line for each.
 */
export default function MediaUploader({ onUploaded, compact = false }: { onUploaded: (items: PublicMedia[]) => void; compact?: boolean }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  const upload = async (files: File[]) => {
    const done: PublicMedia[] = [];
    for (const file of files) {
      const key = ++counter.current;
      const set = (e: Partial<Entry>) => setEntries((list) => list.map((x) => (x.key === key ? { ...x, ...e } : x)));
      setEntries((list) => [...list.slice(-7), { key, name: file.name, state: "uploading" }]);
      // quick answers for the common mistakes; the server decides
      if (file.size > CLIENT_LIMIT) { set({ state: "error", message: `Too large (${formatBytes(file.size)}); the limit is 10 MB.` }); continue; }
      if (file.type && !CLIENT_TYPES.includes(file.type)) { set({ state: "error", message: "Not a supported picture type. Use JPEG, PNG, WebP, GIF or AVIF." }); continue; }
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/admin/media", { method: "POST", body, credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as { item?: PublicMedia; duplicate?: boolean; error?: string };
        if (!res.ok || !data.item) { set({ state: "error", message: data.error ?? `Upload failed (${res.status}).` }); continue; }
        set({ state: data.duplicate ? "duplicate" : "done", message: data.duplicate ? "Already in the library; the existing file is used." : undefined });
        done.push(data.item);
      } catch {
        set({ state: "error", message: "The upload could not be sent. Check the connection and try again." });
      }
    }
    if (done.length) onUploaded(done);
  };

  const pick = (list: FileList | null) => {
    if (list && list.length) void upload([...list]);
    if (input.current) input.current.value = "";
  };

  return (
    <div className={compact ? "uploader compact" : "uploader"}>
      <div
        className={over ? "drop is-over" : "drop"}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files); }}
      >
        <p><b>Drop pictures here</b> or</p>
        <button type="button" className="primary" onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" accept={CLIENT_TYPES.join(",")} multiple hidden onChange={(e) => pick(e.target.files)} aria-label="Choose picture files" />
        <p className="hint">JPEG, PNG, WebP, GIF or AVIF · up to 10 MB each</p>
      </div>
      {entries.length > 0 && (
        <ul className="upload-list" aria-live="polite">
          {entries.map((e) => (
            <li className={`u-${e.state}`} key={e.key}>
              <span>{e.name}</span>
              <span>{e.state === "uploading" ? "Uploading…" : e.state === "done" ? "Uploaded" : e.state === "duplicate" ? "Duplicate" : "Failed"}</span>
              {e.message && <small>{e.message}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
