"use client";

import { useRef } from "react";

/** A textarea with Bold / Italic / Code / Link buttons that wrap the selected text in the article's inline marks (**bold**, *italic*, `code`, [text](url)). */
export default function FormattedTextarea({ id, value, onChange, rows = 4, maxLength, placeholder, name, label }: {
  id: string; value: string; onChange: (v: string) => void; rows?: number; maxLength?: number; placeholder?: string; name?: string; label?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  /** Replace the selection with `wrap(selected)` and keep the cursor sensible. */
  const apply = (wrap: (sel: string) => string, selectInner?: [number, number]) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const sel = value.slice(a, b);
    const next = value.slice(0, a) + wrap(sel) + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const start = selectInner ? a + selectInner[0] : a;
      el.setSelectionRange(start, selectInner ? start + (sel.length || selectInner[1]) : a + wrap(sel).length);
    });
  };
  const wrapWith = (m: string) => apply((sel) => `${m}${sel || "text"}${m}`, [m.length, 4]);
  const link = () => {
    const url = window.prompt("Link address (start with https://, / or #)", "https://");
    if (url) apply((sel) => `[${sel || "link text"}](${url.trim()})`);
  };

  return (
    <div className="fmt">
      <div className="fmt-bar" role="toolbar" aria-label={`Formatting${label ? ` for ${label}` : ""}`}>
        <button type="button" onClick={() => wrapWith("**")} aria-label="Bold" title="Bold"><b>B</b></button>
        <button type="button" onClick={() => wrapWith("*")} aria-label="Italic" title="Italic"><i>I</i></button>
        <button type="button" onClick={() => wrapWith("`")} aria-label="Code" title="Code"><code>{"</>"}</code></button>
        <button type="button" onClick={link} aria-label="Link" title="Link">Link</button>
      </div>
      <textarea ref={ref} id={id} name={name} rows={rows} maxLength={maxLength} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
