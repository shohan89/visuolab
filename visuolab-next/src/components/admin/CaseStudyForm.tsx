"use client";

import { useActionState, useRef, useState } from "react";
import { saveCaseStudy, type CaseFormState } from "@/actions/case-studies";
import { slugify } from "@/lib/slug";
import type { OtherCase, ServiceOption } from "@/lib/server/case-studies-admin";
import type { MediaOption } from "@/lib/server/services-admin";
import { DISCIPLINES, type CaseStudyInput } from "@/lib/validation/case-study";
import { Err, MediaSelect, Section, Text } from "./FormParts";
import ListEditor from "./ListEditor";

type Props = { id?: string; initial: CaseStudyInput; media: MediaOption[]; others: OtherCase[]; services: ServiceOption[]; origin: string };

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** Server error keys follow the data ("process.title"); the form's fields are named "processTitle". Map one to the other. */
function fieldKey(k: string): string {
  const m = /^(process|challenges|results|more)\.(label|title)$/.exec(k);
  if (m) return `${m[1]}${cap(m[2]!)}`;
  const q = /^showcase\.quote\.(\w+)$/.exec(k);
  if (q) return `quote${cap(q[1]!)}`;
  if (k === "showcase.title") return "showcaseTitle";
  const w = /^wide\.(media|caption|alt|position)$/.exec(k);
  if (w) return `wide${cap(w[1]!)}`;
  return k;
}

const DISCIPLINE_LABELS: Record<string, string> = { brand: "Brand", product: "Product", web: "Web", packaging: "Packaging", motion: "Motion" };

/** Create and edit form for a case study. Checks run on the server; this form shows what the server says and keeps what was typed. */
export default function CaseStudyForm({ id, initial, media, others, services, origin }: Props) {
  const [state, action, pending] = useActionState<CaseFormState, FormData>(saveCaseStudy, undefined);
  // after a failed save the server sends back what was typed; start the fields again from that
  const v = (state?.values ?? initial) as CaseStudyInput;
  const errors = Object.fromEntries(Object.entries(state?.errors ?? {}).map(([k, m]) => [fieldKey(k), m]));
  const editing = !!id;
  const shotFields = [
    { key: "media", label: "Image", kind: "media" as const, media },
    { key: "caption", label: "Caption", max: 160 },
    { key: "alt", label: "Description for screen readers", max: 200 },
    { key: "position", label: "Crop position (optional)", max: 20, placeholder: "20% 30%" },
  ];
  const [variant, setVariant] = useState<string>(v.showcase?.variant ?? "results");

  return (
    <form action={action} key={state?.nonce ?? 0} className="svc-form" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      {Object.keys(errors).length > 0 && (
        <div className="form-errors" role="alert">
          <b>{Object.keys(errors).length === 1 ? "One thing needs fixing" : `${Object.keys(errors).length} things need fixing`} before this can be saved:</b>
          <ul>{Object.values(errors).map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <Basics v={v} errors={errors} editing={editing} origin={origin} />

      <Section title="Project details" hint="The facts under the headline.">
        <div className="two">
          <Text name="clientFull" label="Client (full name)" defaultValue={v.clientFull ?? ""} max={80} errors={errors} />
          <Text name="industry" label="Industry" defaultValue={v.industry ?? ""} max={80} errors={errors} />
        </div>
        <div className="two">
          <Text name="services" label="Services provided" defaultValue={v.services ?? ""} max={160} errors={errors} hint="for example: Brand strategy, Visual identity" />
          <Text name="timeline" label="Timeline" defaultValue={v.timeline ?? ""} max={40} errors={errors} hint="for example: 10 weeks" />
        </div>
      </Section>

      <Section title="Card on the Works page" hint="How this project looks in the grid of all work.">
        <div className="two">
          <Text name="typeLine" label="Type line" defaultValue={v.typeLine ?? ""} max={80} errors={errors} hint="for example: Rebrand · Furniture" />
          <Text name="shortKind" label="Short label" defaultValue={v.shortKind ?? ""} max={40} errors={errors} hint="shown under the thumbnail in “More work”" />
        </div>
        <div className="field">
          <span className="label-like">Appears under these filters</span>
          <div className="checks">
            {DISCIPLINES.map((d) => (
              <label className="check" key={d}><input type="checkbox" name="filters" value={d} defaultChecked={(v.filters ?? []).includes(d)} /> {DISCIPLINE_LABELS[d]}</label>
            ))}
          </div>
          <Err errors={errors} k="filters" />
        </div>
        <p className="label-like">Tags on the card</p>
        <ListEditor name="cardTags" asStrings="tag" noun="Tag" items={(v.cardTags ?? []) as unknown as Record<string, unknown>[]} min={1} max={4} errorPath="cardTags" errors={errors} fields={[{ key: "tag", label: "Tag", max: 24 }]} />
        <MediaSelect name="cardImage" altName="cardImageAlt" label="Card image" value={v.cardImage ?? ""} alt={v.cardImageAlt ?? ""} media={media} errors={errors} />
      </Section>

      <Section title="Hero image" hint="The large picture under the headline.">
        <MediaSelect name="coverImage" altName="coverImageAlt" label="Hero image" value={v.coverImage ?? ""} alt={v.coverImageAlt ?? ""} media={media} errors={errors} />
      </Section>

      <Section title="Search engines (SEO)" hint="Shown in Google results and when the page is shared.">
        <Text name="metaTitle" label="SEO title" defaultValue={v.metaTitle ?? ""} max={70} recommended={60} errors={errors} hint="about 60 characters" />
        <Text name="metaDescription" label="SEO description" defaultValue={v.metaDescription ?? ""} max={200} recommended={160} rows={3} errors={errors} hint="about 150–160 characters" />
      </Section>

      <Section title="Description">
        <Text name="aboutLabel" label="Small label" defaultValue={v.aboutLabel ?? ""} max={60} errors={errors} />
        <Text name="description" label="Description" defaultValue={v.description ?? ""} max={600} rows={4} errors={errors} hint={<>Wrap a word in &lt;em&gt;…&lt;/em&gt; for the highlighted style</>} />
        <p className="label-like">Key numbers</p>
        <ListEditor name="stats" noun="Number" items={v.stats ?? []} min={1} max={4} errorPath="stats" errors={errors}
          fields={[{ key: "value", label: "Number", max: 24, placeholder: "41<em>%</em>" }, { key: "label", label: "What it means", max: 100 }]} />
      </Section>

      <Section title="Gallery" hint="Pictures of the project. Two groups: the first sits under the description, the second after the approach. Add as many as you need (up to 6 each).">
        <p className="label-like">First gallery</p>
        <ListEditor name="galleryA" noun="Image" items={v.galleryA ?? []} min={1} max={6} errorPath="galleryA" errors={errors} fields={shotFields} />
        <p className="label-like">Second gallery</p>
        <ListEditor name="galleryB" noun="Image" items={v.galleryB ?? []} min={1} max={6} errorPath="galleryB" errors={errors} fields={shotFields} />
        <p className="label-like">Wide image (between challenge and results)</p>
        <MediaSelect name="wideMedia" altName="wideAlt" label="Wide image" value={v.wide?.media ?? ""} alt={v.wide?.alt ?? ""} media={media} errors={errors} />
        <div className="two">
          <Text name="wideCaption" label="Caption" defaultValue={v.wide?.caption ?? ""} max={160} errors={errors} />
          <Text name="widePosition" label="Crop position (optional)" defaultValue={v.wide?.position ?? ""} max={20} errors={errors} hint="like 50% 40%" />
        </div>
      </Section>

      <Section title="Approach" hint="The steps we took. “Deliverables” are one per line: title | detail.">
        <div className="two">
          <Text name="processLabel" label="Small label" defaultValue={v.process?.label ?? ""} max={60} errors={errors} />
          <Text name="processTitle" label="Heading" defaultValue={v.process?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="processSteps" noun="Step" items={v.process?.steps ?? []} min={1} max={8} errorPath="process.steps" errors={errors}
          fields={[
            { key: "title", label: "Title", max: 100 }, { key: "duration", label: "How long", max: 40, placeholder: "2 weeks" }, { key: "text", label: "Text", kind: "textarea", max: 500 },
            { key: "deliverables", label: "Deliverables (title | detail, one per line)", kind: "pairs", placeholder: "Brand platform | Positioning, voice and principles" },
          ]} />
      </Section>

      <Section title="Challenge">
        <div className="two">
          <Text name="challengesLabel" label="Small label" defaultValue={v.challenges?.label ?? ""} max={60} errors={errors} />
          <Text name="challengesTitle" label="Heading" defaultValue={v.challenges?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="challengesItems" noun="Challenge" items={v.challenges?.items ?? []} min={1} max={8} errorPath="challenges.items" errors={errors}
          fields={[{ key: "title", label: "Title", max: 100 }, { key: "text", label: "Text", kind: "textarea", max: 500 }]} />
      </Section>

      <Section title="Results">
        <div className="two">
          <Text name="resultsLabel" label="Small label" defaultValue={v.results?.label ?? ""} max={60} errors={errors} />
          <Text name="resultsTitle" label="Heading" defaultValue={v.results?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="resultsItems" noun="Result" items={v.results?.items ?? []} min={1} max={10} errorPath="results.items" errors={errors}
          fields={[{ key: "text", label: "Result", kind: "textarea", max: 300, placeholder: "<em>62%</em> more direct traffic" }, { key: "metric", label: "Style", kind: "checkbox", placeholder: "Headline number (shown larger)" }]} />
      </Section>

      <Section title="More work" hint="Other projects suggested at the bottom of the page.">
        <div className="two">
          <Text name="moreLabel" label="Small label" defaultValue={v.more?.label ?? ""} max={60} errors={errors} />
          <Text name="moreTitle" label="Heading" defaultValue={v.more?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="moreSlugs" asStrings="slug" noun="Project" items={(v.more?.slugs ?? []) as unknown as Record<string, unknown>[]} min={1} max={4} errorPath="more.slugs" errors={errors}
          fields={[{ key: "slug", label: "Project", kind: "select", options: others.map((o) => ({ value: o.slug, label: `${o.label}${o.status === "published" ? "" : ` — ${o.status}`}` })) }]} />
        <p className="hint">Only published projects are shown to visitors.</p>
      </Section>

      <Section title="Shown on service pages" hint="Service pages that include this case study as a card.">
        {services.length === 0 ? <p className="hint">No services yet.</p> : (
          <div className="checks">
            {services.map((sv) => (
              <label className="check" key={sv.id}><input type="checkbox" name="serviceIds" value={sv.id} defaultChecked={(v.serviceIds ?? []).includes(sv.id)} /> {sv.title}{sv.status === "published" ? "" : ` (${sv.status})`}</label>
            ))}
          </div>
        )}
        <Err errors={errors} k="serviceIds" />
      </Section>

      <Section title="Card on service pages and the home page" hint="The smaller card with a quote or results.">
        <Text name="showcaseTitle" label="Card headline" defaultValue={v.showcase?.title ?? ""} max={200} errors={errors} />
        <p className="label-like">Card tags</p>
        <ListEditor name="showcaseTags" asStrings="tag" noun="Tag" items={(v.showcase?.tags ?? []) as unknown as Record<string, unknown>[]} min={1} max={4} errorPath="showcase.tags" errors={errors} fields={[{ key: "tag", label: "Tag", max: 24 }]} />
        <div className="field">
          <label htmlFor="f-showcaseVariant">Card shows</label>
          <select id="f-showcaseVariant" name="showcaseVariant" value={variant} onChange={(e) => setVariant(e.target.value)}>
            <option value="results">Results (numbers)</option>
            <option value="quote">A client quote</option>
          </select>
        </div>
        <div hidden={variant !== "results"}>
          <ListEditor name="showcaseResults" noun="Result" items={v.showcase?.results ?? []} max={4} errorPath="showcase.results" errors={errors}
            fields={[{ key: "value", label: "Number", max: 24, placeholder: "62<em>%</em>" }, { key: "text", label: "Text", max: 140 }]} />
        </div>
        <div hidden={variant !== "quote"}>
          <Text name="quoteText" label="Quote" defaultValue={v.showcase?.quote?.text ?? ""} max={400} rows={3} errors={errors} />
          <div className="two">
            <Text name="quoteName" label="Name" defaultValue={v.showcase?.quote?.name ?? ""} max={60} errors={errors} />
            <Text name="quoteRole" label="Role" defaultValue={v.showcase?.quote?.role ?? ""} max={80} errors={errors} />
          </div>
          <div className="two">
            <Text name="quoteSource" label="Source" defaultValue={v.showcase?.quote?.source ?? ""} max={60} errors={errors} hint="for example: Clutch" />
            <Text name="quoteAvatar" label="Avatar picture path" defaultValue={v.showcase?.quote?.avatar ?? ""} max={200} errors={errors} hint="/assets/people/…" />
          </div>
        </div>
      </Section>

      <div className="savebar">
        <button type="submit" className="primary" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create case study"}</button>
        <a href="/admin/case-studies">Cancel</a>
        <span className="hint">{editing ? "Changes go live on the website as soon as you save (when the case study is published)." : "Nothing is public until the status is Published."}</span>
      </div>
    </form>
  );
}

function Basics({ v, errors, editing, origin }: { v: CaseStudyInput; errors: Record<string, string>; editing: boolean; origin: string }) {
  const slugEl = useRef<HTMLInputElement>(null);
  const touched = useRef(editing || !!v.slug);
  const [slug, setSlug] = useState(v.slug ?? "");
  return (
    <Section title="Basics">
      <div className={errors.clientName ? "field has-err" : "field"}>
        <label htmlFor="f-clientName">Client name</label>
        <input id="f-clientName" name="clientName" type="text" defaultValue={v.clientName ?? ""} maxLength={100} required
          onInput={(e) => { if (!touched.current) { const s = slugify(e.currentTarget.value); setSlug(s); if (slugEl.current) slugEl.current.value = s; } }} />
        <p className="hint">Short name used on cards and in the breadcrumb, for example “Orbit”.</p>
        <Err errors={errors} k="clientName" />
      </div>
      <Text name="title" label="Headline" defaultValue={v.title ?? ""} max={200} errors={errors} hint={<>Wrap a word in &lt;em&gt;…&lt;/em&gt; for the highlighted style</>} />
      <div className="two">
        <div className={errors.slug ? "field has-err" : "field"}>
          <label htmlFor="f-slug">Slug (the web address)</label>
          <input id="f-slug" name="slug" type="text" ref={slugEl} defaultValue={v.slug ?? ""} maxLength={80} required spellCheck={false} autoCapitalize="off"
            onInput={(e) => { touched.current = true; setSlug(e.currentTarget.value); }} />
          <p className="hint">{origin}/works/<b>{slug || "…"}</b></p>
          {editing && <p className="hint">If you change the slug, the old address keeps working and redirects to the new one.</p>}
          <Err errors={errors} k="slug" />
        </div>
        <Text name="year" label="Year" defaultValue={v.year ?? ""} max={4} errors={errors} hint="4 digits" />
      </div>
      <label className="check"><input type="checkbox" name="featured" defaultChecked={!!v.featured} /> Featured (marks the project for the home page selection)</label>
      {editing ? null : (
        <div className="field">
          <label htmlFor="f-status">Status</label>
          <select id="f-status" name="status" defaultValue={v.status === "published" ? "published" : "draft"}>
            <option value="draft">Draft (not on the website)</option>
            <option value="published">Published (live right away)</option>
          </select>
        </div>
      )}
    </Section>
  );
}
