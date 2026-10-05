"use client";

import { useActionState, useRef, useState } from "react";
import { saveBlogPost, type BlogFormState } from "@/actions/blog";
import { slugify } from "@/lib/slug";
import type { CategoryOption, OtherPost, Visibility } from "@/lib/server/blog-admin";
import type { MediaOption } from "@/lib/server/services-admin";
import type { BlogInput } from "@/lib/validation/blog";
import ArticleEditor from "./ArticleEditor";
import { Err, MediaSelect, Section, Text } from "./FormParts";
import FormattedTextarea from "./FormattedTextarea";
import ListEditor from "./ListEditor";
import { MediaField } from "./MediaPicker";
import TagInput from "./TagInput";

type Props = {
  id?: string;
  initial: BlogInput;
  visibility: Visibility;
  media: MediaOption[];
  categories: CategoryOption[];
  others: OtherPost[];
  tagSuggestions: string[];
  origin: string;
};

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** Server error keys follow the data ("outro.href"); the form's fields are named "outroHref". Map one to the other. */
function fieldKey(k: string): string {
  const m = /^outro\.(before|linkText|href|after)$/.exec(k);
  return m ? `outro${cap(m[1]!)}` : k;
}

/** Create and edit form for an article. Checks run on the server; this form shows what the server says and keeps what was typed. */
export default function BlogForm({ id, initial, visibility, media, categories, others, tagSuggestions, origin }: Props) {
  const [state, action, pending] = useActionState<BlogFormState, FormData>(saveBlogPost, undefined);
  // after a failed save the server sends back what was typed; start the fields again from that
  const v = (state?.values ?? initial) as BlogInput;
  const errors = Object.fromEntries(Object.entries(state?.errors ?? {}).map(([k, m]) => [fieldKey(k), m]));
  const editing = !!id;
  const [lead, setLead] = useState(v.lead ?? "");

  return (
    <form action={action} key={state?.nonce ?? 0} className="svc-form" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {Object.keys(errors).length > 0 && (
        <div className="form-errors" role="alert">
          <b>{Object.keys(errors).length === 1 ? "One thing needs fixing" : `${Object.keys(errors).length} things need fixing`} before this can be saved:</b>
          <ul>{Object.values(errors).map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <Basics v={v} errors={errors} editing={editing} origin={origin} categories={categories} tagSuggestions={tagSuggestions} />

      <Section title="Featured image and excerpt" hint="The picture at the top of the article and on the blog cards.">
        <MediaSelect name="coverImage" altName="coverAlt" label="Featured image" value={v.coverImage ?? ""} alt={v.coverAlt ?? ""} media={media} errors={errors} />
        <Text name="excerpt" label="Excerpt" defaultValue={v.excerpt ?? ""} max={300} rows={3} errors={errors} hint="shown on the blog page when this is the featured article" />
      </Section>

      <Section title="Article" hint="The opening paragraph, then the body as blocks.">
        <div className={errors.lead ? "field has-err" : "field"}>
          <label htmlFor="f-lead">Opening paragraph</label>
          <FormattedTextarea id="f-lead" name="lead" value={lead} onChange={setLead} rows={4} maxLength={640} label="the opening paragraph" />
          <p className="hint">{lead.length}/600</p>
          <Err errors={errors} k="lead" />
        </div>
        <ArticleEditor name="blocks" initial={v.blocks ?? []} media={media} errors={errors} />
        <h3 className="sub-h">Closing line</h3>
        <p className="hint">After the rule, for example: “Working on something like this? <u>Tell us about it</u> — we answer within a day.”</p>
        <Text name="outroBefore" label="Text before the link" defaultValue={v.outro?.before ?? ""} max={120} errors={errors} />
        <div className="two">
          <Text name="outroLinkText" label="Link text" defaultValue={v.outro?.linkText ?? ""} max={60} errors={errors} />
          <Text name="outroHref" label="Link address" defaultValue={v.outro?.href ?? ""} max={300} errors={errors} hint="/contact, #contact or https://…" />
        </div>
        <Text name="outroAfter" label="Text after the link" defaultValue={v.outro?.after ?? ""} max={160} errors={errors} />
      </Section>

      <Section title="More from the studio" hint="Articles recommended under this one (up to 3). Only live articles are shown to visitors.">
        <ListEditor name="related" asStrings="slug" noun="Article" items={(v.related ?? []) as unknown as Record<string, unknown>[]} max={3} errorPath="related" errors={errors}
          fields={[{ key: "slug", label: "Article", kind: "select", options: others.map((o) => ({ value: o.slug, label: `${o.label}${o.status === "published" ? "" : ` — ${o.status}`}` })) }]} />
      </Section>

      <Section title="Search engines and sharing (SEO)">
        <Text name="metaTitle" label="SEO title" defaultValue={v.metaTitle ?? ""} max={70} recommended={60} errors={errors} hint="about 60 characters" />
        <Text name="metaDescription" label="SEO description" defaultValue={v.metaDescription ?? ""} max={200} recommended={160} rows={3} errors={errors} hint="about 150–160 characters" />
        <Text name="canonicalUrl" label="Canonical URL (optional)" defaultValue={v.canonicalUrl ?? ""} max={300} errors={errors} hint="only if the article first appeared elsewhere; leave empty to use this page’s own address" />
        <div className={errors.ogImage ? "field has-err" : "field"}>
          <OgImage value={v.ogImage ?? ""} media={media} />
          <Err errors={errors} k="ogImage" />
        </div>
      </Section>

      <Section title="Author, publishing and reading time">
        <div className="two">
          <Text name="authorName" label="Author" defaultValue={v.authorName ?? ""} max={60} errors={errors} />
          <AuthorImage value={v.authorImage ?? ""} media={media} error={errors.authorImage} />
        </div>
        <div className="two">
          <div className={errors.publishedAt ? "field has-err" : "field"}>
            <label htmlFor="f-publishedAt">Publish date and time (UTC)</label>
            <input id="f-publishedAt" name="publishedAt" type="datetime-local" defaultValue={v.publishedAt ?? ""} />
            <p className="hint">
              Now: <b>{visibility === "live" ? "Live" : visibility === "scheduled" ? "Scheduled" : visibility === "archived" ? "Archived" : "Draft"}</b>.
              {" "}A date in the future schedules the article: when you press Publish it goes live by itself at that time.
            </p>
            <Err errors={errors} k="publishedAt" />
          </div>
          <div className={errors.readMinutes ? "field has-err" : "field"}>
            <label htmlFor="f-readMinutes">Reading time (minutes)</label>
            <input id="f-readMinutes" name="readMinutes" type="number" min={1} max={120} defaultValue={v.readMinutes ?? ""} />
            <p className="hint">Leave empty to count it from the text.</p>
            <Err errors={errors} k="readMinutes" />
          </div>
        </div>
      </Section>

      <div className="savebar">
        <button type="submit" className="primary" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create article"}</button>
        <a href="/admin/blog">Cancel</a>
        <span className="hint">{editing ? "Changes go live as soon as you save (when the article is live)." : "Nothing is public until the article is published."}</span>
      </div>
    </form>
  );
}

function OgImage({ value, media }: { value: string; media: MediaOption[] }) {
  return (
    <>
      <span className="label-like">Open Graph image (optional)</span>
      <MediaField name="ogImage" id="f-ogImage" value={value} known={media} optional label="the Open Graph image" />
      <p className="hint">The picture shown when the link is shared on social networks. The featured image is used when this is empty.</p>
    </>
  );
}

function AuthorImage({ value, media, error }: { value: string; media: MediaOption[]; error?: string }) {
  return (
    <div className={error ? "field has-err" : "field"}>
      <span className="label-like">Author picture</span>
      <MediaField name="authorImage" id="f-authorImage" value={value} known={media} optional label="the author picture" />
      {error && <p className="field-err">{error}</p>}
    </div>
  );
}

function Basics({ v, errors, editing, origin, categories, tagSuggestions }: { v: BlogInput; errors: Record<string, string>; editing: boolean; origin: string; categories: CategoryOption[]; tagSuggestions: string[] }) {
  const slugEl = useRef<HTMLInputElement>(null);
  const touched = useRef(editing || !!v.slug);
  const [slug, setSlug] = useState(v.slug ?? "");
  return (
    <Section title="Basics">
      <div className={errors.title ? "field has-err" : "field"}>
        <label htmlFor="f-title">Title</label>
        <input id="f-title" name="title" type="text" defaultValue={v.title ?? ""} maxLength={180} required
          onInput={(e) => { if (!touched.current) { const s = slugify(e.currentTarget.value); setSlug(s); if (slugEl.current) slugEl.current.value = s; } }} />
        <Err errors={errors} k="title" />
      </div>
      <div className={errors.slug ? "field has-err" : "field"}>
        <label htmlFor="f-slug">Slug (the web address)</label>
        <input id="f-slug" name="slug" type="text" ref={slugEl} defaultValue={v.slug ?? ""} maxLength={100} required spellCheck={false} autoCapitalize="off"
          onInput={(e) => { touched.current = true; setSlug(e.currentTarget.value); }} />
        <p className="hint">{origin}/blog/<b>{slug || "…"}</b></p>
        {editing && <p className="hint">If you change the slug, the old address keeps working and redirects to the new one.</p>}
        <Err errors={errors} k="slug" />
      </div>
      <div className="two">
        <div className={errors.categoryId ? "field has-err" : "field"}>
          <label htmlFor="f-categoryId">Category</label>
          <select id="f-categoryId" name="categoryId" defaultValue={v.categoryId ?? ""}>
            <option value="">Choose a category…</option>
            {categories.map((c) => <option value={c.id} key={c.id}>{c.title}{c.status === "published" ? "" : ` (${c.status})`}</option>)}
          </select>
          <Err errors={errors} k="categoryId" />
        </div>
        <TagInput name="tags" initial={v.tags ?? []} suggestions={tagSuggestions} error={errors.tags} />
      </div>
      <label className="check"><input type="checkbox" name="featured" defaultChecked={!!v.featured} /> Featured (shown large at the top of the blog page; only one article is featured at a time)</label>
      {editing ? null : (
        <div className="field">
          <label htmlFor="f-status">Status</label>
          <select id="f-status" name="status" defaultValue={v.status === "published" ? "published" : "draft"}>
            <option value="draft">Draft (not on the website)</option>
            <option value="published">Published (at the publish date below; now when empty)</option>
          </select>
        </div>
      )}
    </Section>
  );
}
