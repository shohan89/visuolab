"use client";

import { useState, type KeyboardEvent } from "react";

/** Tags as chips: type a tag and press Enter or comma. Existing tags are suggested; new ones are created when the article is saved. */
export default function TagInput({ name, initial, suggestions, error }: { name: string; initial: string[]; suggestions: string[]; error?: string }) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const t = raw.trim().replace(/\s+/g, " ").slice(0, 30);
    if (t.length < 2 || tags.some((x) => x.toLowerCase() === t.toLowerCase()) || tags.length >= 8) return;
    setTags([...tags, t]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(draft); }
    else if (e.key === "Backspace" && !draft && tags.length) setTags(tags.slice(0, -1));
  };
  return (
    <div className={error ? "field has-err" : "field"}>
      <label htmlFor="f-tag-draft">Tags</label>
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      <div className="chips">
        {tags.map((t) => (
          <span className="chip" key={t}>{t}<button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>×</button></span>
        ))}
        <input id="f-tag-draft" type="text" list="tag-suggestions" value={draft} placeholder={tags.length >= 8 ? "Maximum 8 tags" : "Add a tag…"} disabled={tags.length >= 8}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => add(draft)} maxLength={30} />
      </div>
      <datalist id="tag-suggestions">{suggestions.filter((s) => !tags.includes(s)).map((s) => <option value={s} key={s} />)}</datalist>
      <p className="hint">Enter or comma adds a tag. Up to 8.</p>
      {error && <p className="field-err">{error}</p>}
    </div>
  );
}
