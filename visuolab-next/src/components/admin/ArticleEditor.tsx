"use client";

import { useState } from "react";
import InlineText from "@/components/site/blog/InlineText";
import type { MediaOption } from "@/lib/server/services-admin";
import type { StoredBlock } from "@/lib/validation/blog";
import FormattedTextarea from "./FormattedTextarea";
import { MediaField } from "./MediaPicker";

type BlockType = StoredBlock["type"];
const NEW: Record<BlockType, () => StoredBlock> = {
  paragraph: () => ({ type: "paragraph", text: "" }),
  heading: () => ({ type: "heading", text: "" }),
  subheading: () => ({ type: "subheading", text: "" }),
  list: () => ({ type: "list", ordered: false, items: [""] }),
  quote: () => ({ type: "quote", text: "", cite: "" }),
  image: () => ({ type: "image", media: "", alt: "", caption: "" }),
  divider: () => ({ type: "divider" }),
};
const LABEL: Record<BlockType, string> = { paragraph: "Paragraph", heading: "Heading", subheading: "Subheading", list: "List", quote: "Quote", image: "Image", divider: "Divider" };
const ADD_ORDER: BlockType[] = ["paragraph", "heading", "subheading", "list", "quote", "image", "divider"];

type Props = { name: string; initial: StoredBlock[]; media: MediaOption[]; errors: Record<string, string> };

/**
 * The article body as a list of typed blocks. Text is written with the small inline set (bold, italic, code, link); the editor stores
 * data, never HTML. "Preview" shows how the marks will render (with the admin's own plain styling, not the public design).
 */
export default function ArticleEditor({ name, initial, media, errors }: Props) {
  const [blocks, setBlocks] = useState<StoredBlock[]>(initial);
  const [preview, setPreview] = useState(false);
  const patch = (i: number, p: Partial<StoredBlock>) => setBlocks((b) => b.map((x, n) => (n === i ? ({ ...x, ...p } as StoredBlock) : x)));
  const move = (i: number, d: -1 | 1) =>
    setBlocks((b) => {
      const j = i + d;
      if (j < 0 || j >= b.length) return b;
      const c = [...b];
      [c[i], c[j]] = [c[j]!, c[i]!];
      return c;
    });
  const err = (i: number, k?: string) => errors[`blocks.${i}${k ? `.${k}` : ""}`] ?? (k ? undefined : errors[`blocks.${i}`]);

  return (
    <div className="article-editor">
      <input type="hidden" name={name} value={JSON.stringify(blocks)} />
      <div className="ae-top">
        <div className="ae-add" role="group" aria-label="Add a block">
          <span>Add:</span>
          {ADD_ORDER.map((t) => <button type="button" key={t} onClick={() => setBlocks((b) => [...b, NEW[t]()])} disabled={blocks.length >= 80}>+ {LABEL[t]}</button>)}
        </div>
        <button type="button" className={preview ? "primary" : undefined} aria-pressed={preview} onClick={() => setPreview((p) => !p)}>{preview ? "Back to editing" : "Preview text"}</button>
      </div>
      {errors.blocks && <p className="field-err">{errors.blocks}</p>}

      {preview ? (
        <div className="ae-preview">
          {blocks.map((b, i) => {
            switch (b.type) {
              case "heading": return <h2 key={i}>{b.text}</h2>;
              case "subheading": return <h3 key={i}>{b.text}</h3>;
              case "paragraph": return <p key={i}><InlineText>{b.text}</InlineText></p>;
              case "list": { const li = b.items.map((t, n) => <li key={n}><InlineText>{t}</InlineText></li>); return b.ordered ? <ol key={i}>{li}</ol> : <ul key={i}>{li}</ul>; }
              case "quote": return <blockquote key={i}><InlineText>{b.text}</InlineText>{b.cite && <cite>— {b.cite}</cite>}</blockquote>;
              case "image": { const m = media.find((x) => x.id === b.media); return <figure key={i}>{m ? <img src={m.url} alt={b.alt} /> : <em>(no image chosen)</em>}{b.caption && <figcaption>{b.caption}</figcaption>}</figure>; }
              case "divider": return <hr key={i} />;
            }
          })}
          {blocks.length === 0 && <p className="hint">Nothing to preview yet.</p>}
        </div>
      ) : (
        <>
          {blocks.length === 0 && <p className="hint">The article is empty. Add a paragraph to start.</p>}
          {blocks.map((b, i) => (
            <fieldset className={err(i) || Object.keys(errors).some((k) => k.startsWith(`blocks.${i}.`)) ? "le-item has-err" : "le-item"} key={i}>
              <legend>{i + 1}. {LABEL[b.type]}</legend>
              <div className="le-tools">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move block ${i + 1} up`}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} aria-label={`Move block ${i + 1} down`}>↓</button>
                <button type="button" className="danger" onClick={() => setBlocks((x) => x.filter((_, n) => n !== i))} aria-label={`Remove block ${i + 1}`}>Remove</button>
              </div>
              {(b.type === "heading" || b.type === "subheading") && (
                <div className="field">
                  <label htmlFor={`b${i}-text`}>{b.type === "heading" ? "Heading (appears in the table of contents)" : "Subheading"}</label>
                  <input id={`b${i}-text`} type="text" maxLength={160} value={b.text} onChange={(e) => patch(i, { text: e.target.value })} />
                </div>
              )}
              {b.type === "paragraph" && (
                <div className="field"><label htmlFor={`b${i}-text`}>Text</label><FormattedTextarea id={`b${i}-text`} value={b.text} onChange={(v) => patch(i, { text: v })} rows={5} maxLength={3200} label={`block ${i + 1}`} /></div>
              )}
              {b.type === "quote" && (
                <>
                  <div className="field"><label htmlFor={`b${i}-text`}>Quote</label><FormattedTextarea id={`b${i}-text`} value={b.text} onChange={(v) => patch(i, { text: v })} rows={3} maxLength={700} label={`block ${i + 1}`} /></div>
                  <div className="field"><label htmlFor={`b${i}-cite`}>Source (optional)</label><input id={`b${i}-cite`} type="text" maxLength={120} value={b.cite} onChange={(e) => patch(i, { cite: e.target.value })} /></div>
                </>
              )}
              {b.type === "list" && (
                <>
                  <div className="field">
                    <label htmlFor={`b${i}-kind`}>Type</label>
                    <select id={`b${i}-kind`} value={b.ordered ? "ol" : "ul"} onChange={(e) => patch(i, { ordered: e.target.value === "ol" })}>
                      <option value="ul">Bullets</option><option value="ol">Numbered</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`b${i}-items`}>Items (one per line)</label>
                    <FormattedTextarea id={`b${i}-items`} value={b.items.join("\n")} onChange={(v) => patch(i, { items: v.split("\n") })} rows={5} label={`block ${i + 1}`} />
                  </div>
                </>
              )}
              {b.type === "image" && (
                <>
                  <div className="field">
                    <span className="label-like">Image</span>
                    <MediaField id={`b${i}-media`} value={b.media} known={media} label={`block ${i + 1} image`} onChange={(mid) => patch(i, { media: mid })} />
                  </div>
                  <div className="field"><label htmlFor={`b${i}-alt`}>Description for screen readers</label><input id={`b${i}-alt`} type="text" maxLength={200} value={b.alt} onChange={(e) => patch(i, { alt: e.target.value })} /></div>
                  <div className="field"><label htmlFor={`b${i}-cap`}>Caption (optional)</label><input id={`b${i}-cap`} type="text" maxLength={200} value={b.caption} onChange={(e) => patch(i, { caption: e.target.value })} /></div>
                </>
              )}
              {b.type === "divider" && <p className="hint">A horizontal rule between sections.</p>}
              {err(i) && <p className="field-err">{err(i)}</p>}
              {["text", "items", "cite", "media", "alt", "caption"].map((k) => errors[`blocks.${i}.${k}`] ? <p className="field-err" key={k}>{errors[`blocks.${i}.${k}`]}</p> : null)}
            </fieldset>
          ))}
          <p className="hint">Marks: <code>**bold**</code> <code>*italic*</code> <code>`code`</code> <code>[text](https://…)</code>. Everything else is shown as typed; HTML is never run.</p>
        </>
      )}
    </div>
  );
}
