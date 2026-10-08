"use client";

import { useState, useTransition } from "react";
import { savePageSeoAction, type CmsFormState } from "@/actions/cms-pages";
import { DESCRIPTION, TITLE, descriptionBand, titleBand, type Band } from "@/lib/cms/seo-guidance";
import type { MediaOption } from "@/lib/server/services-admin";
import { MediaField } from "./MediaPicker";

export type Seo = { seoTitle: string; seoDescription: string; ogImageId: string; canonicalUrl: string; noindex: boolean; nofollow: boolean };

/** A character counter with the guidance for its band (colour and words). */
function Guide({ len, max, band }: { len: number; max: number; band: Band }) {
  return (
    <p className={`seo-guide is-${band.level}`} aria-live="polite">
      <b>{len}/{max}</b> · {band.message}
    </p>
  );
}

/**
 * The SEO editor of one page: title, description, canonical address, share (Open Graph) picture and the two robots switches, with character guidance
 * and a preview of the search result and the share card. Empty text means "use the default" (Settings → SEO → Page metadata). These fields are
 * for search engines and link previews only; the page's own headline is a separate field in its Hero section.
 */
export default function PageSeoForm({ template, initial, updatedAt, media, defaults, site }: {
  template: string; initial: Seo; updatedAt: string; media: MediaOption[]; defaults: { title: string; description: string };
  site: { name: string; url: string; path: string; indexing: boolean };
}) {
  const [v, setV] = useState<Seo>(initial);
  const [saved, setSaved] = useState<{ seo: Seo; stamp: string }>({ seo: initial, stamp: updatedAt });
  const [result, setResult] = useState<CmsFormState>(undefined);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved.seo);
  const errors = result && !result.ok && result.kind === "invalid" ? result.errors : {};
  const set = (patch: Partial<Seo>) => { setResult(undefined); setV((c) => ({ ...c, ...patch })); };
  const err = (k: string) => errors[k] && <p className="field-err" role="alert">{errors[k]}</p>;

  const title = v.seoTitle.trim() || defaults.title;
  const description = v.seoDescription.trim() || defaults.description;
  const og = media.find((m) => m.id === v.ogImageId);
  const address = v.canonicalUrl.trim() || `${site.url}${site.path === "/" ? "" : site.path}`;

  const save = () => {
    const fd = new FormData();
    fd.set("template", template);
    fd.set("seo", JSON.stringify(v));
    fd.set("expectedUpdatedAt", saved.stamp);
    start(async () => {
      const r = await savePageSeoAction(undefined, fd);
      setResult(r);
      if (r?.ok) setSaved({ seo: v, stamp: r.updatedAt });
    });
  };

  return (
    <form className="svc-form cms-editor seo-editor" onSubmit={(e) => { e.preventDefault(); if (dirty && !pending) save(); }} noValidate>
      {result && !result.ok && result.kind === "conflict" && <div className="form-errors" role="alert"><b>These settings were changed by someone else after you opened them.</b> Nothing was saved. <button type="button" onClick={() => window.location.reload()}>Reload</button></div>}
      {Object.keys(errors).length > 0 && <div className="form-errors" role="alert"><b>Check the fields below.</b></div>}
      {!site.indexing && <div className="form-errors" role="status"><b>Search engines are blocked for the whole site</b> (Settings → SEO → Indexing). The robots choices below take effect once that is switched back on.</div>}

      <section className="form-card">
        <h2>Search result</h2>
        <p className="hint">What search engines and link previews use. Leave a field empty to use the default (Settings → SEO → Page metadata). The page&apos;s own headline is separate: it is the Hero section&apos;s headline and is not changed here.</p>

        <div className={errors.seoTitle ? "field has-err" : "field"}>
          <label htmlFor="seo-title">SEO title</label>
          <input id="seo-title" type="text" value={v.seoTitle} placeholder={defaults.title} onChange={(e) => set({ seoTitle: e.target.value })} aria-describedby="seo-title-guide" />
          <div id="seo-title-guide"><Guide len={v.seoTitle.trim().length} max={TITLE.max} band={titleBand(v.seoTitle.trim().length)} /></div>
          {err("seoTitle")}
        </div>

        <div className={errors.seoDescription ? "field has-err" : "field"}>
          <label htmlFor="seo-desc">SEO description</label>
          <textarea id="seo-desc" rows={3} value={v.seoDescription} placeholder={defaults.description} onChange={(e) => set({ seoDescription: e.target.value })} aria-describedby="seo-desc-guide" />
          <div id="seo-desc-guide"><Guide len={v.seoDescription.trim().length} max={DESCRIPTION.max} band={descriptionBand(v.seoDescription.trim().length)} /></div>
          {err("seoDescription")}
        </div>

        <div className="seo-preview" aria-label="Search result preview">
          <p className="sp-label">Preview in search results</p>
          <p className="sp-site">{site.name}</p>
          <p className="sp-url">{address}</p>
          <p className="sp-title">{title.length > TITLE.good[1] + 5 ? `${title.slice(0, TITLE.good[1] + 5).trimEnd()}…` : title}</p>
          <p className="sp-desc">{description.length > DESCRIPTION.good[1] ? `${description.slice(0, DESCRIPTION.good[1]).trimEnd()}…` : description}</p>
        </div>

        <div className={errors.canonicalUrl ? "field has-err" : "field"}>
          <label htmlFor="seo-canon">Canonical URL <span className="opt-tag">optional</span></label>
          <input id="seo-canon" type="text" value={v.canonicalUrl} placeholder={`${site.url}${site.path === "/" ? "" : site.path}`} onChange={(e) => set({ canonicalUrl: e.target.value })} />
          <p className="hint">Only if another address should count as the original: a path like /about or a full https:// address. Empty: the page&apos;s own address.</p>
          {err("canonicalUrl")}
        </div>
      </section>

      <section className="form-card">
        <h2>Share picture (Open Graph)</h2>
        <p className="hint">The picture shown when the page is shared. 1200 × 630 pixels works best.</p>
        <div className={errors.ogImageId ? "field has-err media-pick" : "field media-pick"}>
          <span className="label-like">Open Graph image</span>
          <MediaField id="seo-og" value={v.ogImageId} known={media} optional details label="Open Graph image" onChange={(id) => set({ ogImageId: id })} />
          <p className="hint">Empty: the picture the page already gives, then the site default.</p>
          {err("ogImageId")}
        </div>
        <div className="share-card" aria-label="Share card preview">
          {og ? <img src={og.url} alt="" /> : <span className="sc-noimg">Default picture</span>}
          <div><b>{title}</b><span>{description}</span><small>{site.url.replace(/^https?:\/\//, "")}</small></div>
        </div>
      </section>

      <section className="form-card">
        <h2>Robots</h2>
        <div className="field">
          <label htmlFor="seo-index">Indexing</label>
          <select id="seo-index" value={v.noindex ? "noindex" : "index"} onChange={(e) => set({ noindex: e.target.value === "noindex" })}>
            <option value="index">Index: allow the page in search results</option>
            <option value="noindex">Noindex: keep the page out of search results</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="seo-follow">Links</label>
          <select id="seo-follow" value={v.nofollow ? "nofollow" : "follow"} onChange={(e) => set({ nofollow: e.target.value === "nofollow" })}>
            <option value="follow">Follow: search engines may follow the page&apos;s links</option>
            <option value="nofollow">Nofollow: ask search engines not to follow them</option>
          </select>
        </div>
        <p className="hint">Result: <code>{v.noindex ? "noindex" : "index"}, {v.nofollow ? "nofollow" : "follow"}</code></p>
      </section>

      <div className="savebar">
        <button type="submit" className="primary" disabled={pending || !dirty}>{pending ? "Saving…" : "Save SEO"}</button>
        <button type="button" onClick={() => { setV(saved.seo); setResult(undefined); }} disabled={pending || !dirty}>Cancel changes</button>
        <span className="hint">{result?.ok && !dirty ? "Saved. It is live now." : dirty ? "Unsaved changes." : "Changes go live as soon as you save."}</span>
      </div>
    </form>
  );
}
