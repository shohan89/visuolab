"use client";

import { useState, useTransition } from "react";
import { savePageSeoAction, type CmsFormState } from "@/actions/cms-pages";
import type { MediaOption } from "@/lib/server/services-admin";
import { MediaField } from "./MediaPicker";

type Seo = { seoTitle: string; seoDescription: string; ogImageId: string; canonicalUrl: string; noindex: boolean };

/** Search settings of one page: title, description, share picture, canonical address, and "keep out of search engines". Empty text means "use the default". */
export default function PageSeoForm({ template, initial, updatedAt, media, defaults }: { template: string; initial: Seo; updatedAt: string; media: MediaOption[]; defaults: { title: string; description: string } }) {
  const [v, setV] = useState<Seo>(initial);
  const [saved, setSaved] = useState<{ seo: Seo; stamp: string }>({ seo: initial, stamp: updatedAt });
  const [result, setResult] = useState<CmsFormState>(undefined);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(v) !== JSON.stringify(saved.seo);
  const errors = result && !result.ok && result.kind === "invalid" ? result.errors : {};
  const set = (patch: Partial<Seo>) => { setResult(undefined); setV((c) => ({ ...c, ...patch })); };
  const err = (k: string) => errors[k] && <p className="field-err" role="alert">{errors[k]}</p>;

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
    <form className="svc-form cms-editor" onSubmit={(e) => { e.preventDefault(); if (dirty && !pending) save(); }} noValidate>
      {result && !result.ok && result.kind === "conflict" && <div className="form-errors" role="alert"><b>These settings were changed by someone else after you opened them.</b> Nothing was saved. <button type="button" onClick={() => window.location.reload()}>Reload</button></div>}
      {Object.keys(errors).length > 0 && <div className="form-errors" role="alert"><b>Check the fields below.</b></div>}
      <section className="form-card">
        <h2>Search settings</h2>
        <p className="hint">Leave a field empty to use the default (Settings → SEO → Page metadata).</p>
        <div className={errors.seoTitle ? "field has-err" : "field"}>
          <label htmlFor="seo-title">Title</label>
          <input id="seo-title" type="text" value={v.seoTitle} placeholder={defaults.title} onChange={(e) => set({ seoTitle: e.target.value })} />
          <p className="hint"><span className={v.seoTitle.length > 70 ? "over" : ""}>{v.seoTitle.length}/70</span> · shown in search results and when the page is shared</p>
          {err("seoTitle")}
        </div>
        <div className={errors.seoDescription ? "field has-err" : "field"}>
          <label htmlFor="seo-desc">Description</label>
          <textarea id="seo-desc" rows={3} value={v.seoDescription} placeholder={defaults.description} onChange={(e) => set({ seoDescription: e.target.value })} />
          <p className="hint"><span className={v.seoDescription.length > 200 ? "over" : ""}>{v.seoDescription.length}/200</span> · 20 to 200 characters, or empty</p>
          {err("seoDescription")}
        </div>
        <div className={errors.ogImageId ? "field has-err media-pick" : "field media-pick"}>
          <span className="label-like">Share picture</span>
          <MediaField id="seo-og" value={v.ogImageId} known={media} optional label="Share picture" onChange={(id) => set({ ogImageId: id })} />
          <p className="hint">Empty: the picture the page already gives, then the site default.</p>
          {err("ogImageId")}
        </div>
        <div className={errors.canonicalUrl ? "field has-err" : "field"}>
          <label htmlFor="seo-canon">Canonical address <span className="opt-tag">optional</span></label>
          <input id="seo-canon" type="text" value={v.canonicalUrl} placeholder="The page's own address" onChange={(e) => set({ canonicalUrl: e.target.value })} />
          <p className="hint">Only if another address should count as the original: a path like /about or a full https:// address.</p>
          {err("canonicalUrl")}
        </div>
        <div className="field"><label className="check"><input type="checkbox" checked={v.noindex} onChange={(e) => set({ noindex: e.target.checked })} /> Keep this page out of search engines</label></div>
      </section>
      <div className="savebar">
        <button type="submit" className="primary" disabled={pending || !dirty}>{pending ? "Saving…" : "Save search settings"}</button>
        <button type="button" onClick={() => { setV(saved.seo); setResult(undefined); }} disabled={pending || !dirty}>Cancel changes</button>
        <span className="hint">{result?.ok && !dirty ? "Saved." : dirty ? "Unsaved changes." : "Changes go live as soon as you save."}</span>
      </div>
    </form>
  );
}
