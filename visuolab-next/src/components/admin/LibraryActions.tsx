"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import MediaUploader from "./MediaUploader";
import { CLIENT_LIMIT, CLIENT_TYPES, formatBytes } from "./media-types";

/** The upload box of the library page: after an upload the list is reloaded from the server. */
export function LibraryUploader() {
  const router = useRouter();
  return <MediaUploader onUploaded={() => router.refresh()} />;
}

/** Replace the picture behind a media file. The file keeps its id, so every page that uses it follows. */
export function ReplaceFile({ id, canReplace }: { id: string; canReplace: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ kind: "idle" | "busy" | "ok" | "error"; message?: string }>({ kind: "idle" });

  const send = async (file: File) => {
    if (file.size > CLIENT_LIMIT) { setState({ kind: "error", message: `Too large (${formatBytes(file.size)}); the limit is 10 MB.` }); return; }
    if (file.type && !CLIENT_TYPES.includes(file.type)) { setState({ kind: "error", message: "Not a supported picture type. Use JPEG, PNG, WebP, GIF or AVIF." }); return; }
    setState({ kind: "busy" });
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/admin/media/${id}/replace`, { method: "POST", body, credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setState({ kind: "error", message: data.error ?? `Replace failed (${res.status}).` }); return; }
      setState({ kind: "ok", message: "Replaced. Every page that uses this file now shows the new picture." });
      router.refresh();
    } catch {
      setState({ kind: "error", message: "The file could not be sent. Check the connection and try again." });
    }
  };

  return (
    <div>
      <input ref={input} type="file" accept={CLIENT_TYPES.join(",")} hidden aria-label="Choose the replacement picture" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); if (input.current) input.current.value = ""; }} />
      <button type="button" onClick={() => input.current?.click()} disabled={!canReplace || state.kind === "busy"}>{state.kind === "busy" ? "Replacing…" : "Replace file…"}</button>
      <p className="hint">Upload a new picture for this entry. Titles, descriptions and everything that uses it stay as they are.</p>
      {state.message && <p className={state.kind === "error" ? "field-err" : "hint"} role={state.kind === "error" ? "alert" : "status"}>{state.message}</p>}
    </div>
  );
}

/** Copies the public address of a file. */
export function CopyUrl({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(new URL(url, window.location.origin).toString()); setDone(true); window.setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked: the address is shown next to the button */ } }}>
      {done ? "Copied" : "Copy address"}
    </button>
  );
}
