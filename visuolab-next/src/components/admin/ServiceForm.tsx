"use client";

import { useActionState, useRef, useState } from "react";
import { saveService, type ServiceFormState } from "@/actions/services";
import { slugify } from "@/lib/slug";
import type { CaseOption, MediaOption } from "@/lib/server/services-admin";
import type { ServiceInput } from "@/lib/validation/service";
import { Err, MediaSelect, Section, Text } from "./FormParts";
import ListEditor from "./ListEditor";

type Props = {
  id?: string;
  initial: ServiceInput;
  media: MediaOption[];
  cases: CaseOption[];
  /** Public address of the page, shown in the search-result preview. */
  origin: string;
};

const DEFAULT_ICON = { viewBox: "0 0 24 24", nodes: [{ t: "circle", a: { cx: "12", cy: "12", r: "8" } }] };

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
/** Server error keys follow the data ("overview.title"); the form's fields are named "overviewTitle". Map one to the other. */
function fieldKey(k: string): string {
  const m = /^(overview|outcomes|included|process|problems).(label|title)$/.exec(k) ?? /^(band).(text|ctaLabel|ctaHref)$/.exec(k);
  return m ? `${m[1]}${cap(m[2]!)}` : k;
}

/** Create and edit form for a service. Checks run on the server; this form shows what the server says and keeps what was typed. */
export default function ServiceForm({ id, initial, media, cases, origin }: Props) {
  const [state, action, pending] = useActionState<ServiceFormState, FormData>(saveService, undefined);
  // after a failed save the server sends back what was typed; start the fields again from that
  const v = (state?.values ?? initial) as ServiceInput;
  const errors = Object.fromEntries(Object.entries(state?.errors ?? {}).map(([k, m]) => [/^(overview|outcomes|included|process|problems).(label|title)$|^band./.test(k) ? fieldKey(k) : k, m]));
  const editing = !!id;
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

      <Section title="Search engines (SEO)" hint="Shown in Google results and when the page is shared.">
        <Text name="metaTitle" label="SEO title" defaultValue={v.metaTitle ?? ""} max={70} recommended={60} errors={errors} hint="about 60 characters" />
        <Text name="metaDescription" label="SEO description" defaultValue={v.metaDescription ?? ""} max={200} recommended={160} rows={3} errors={errors} hint="about 150–160 characters" />
      </Section>

      <Section title="Top of the page" hint="The first screen of the service page.">
        <Text name="heroTitle" label="Headline" defaultValue={v.heroTitle ?? ""} max={200} errors={errors} hint={<>Wrap a word in &lt;em&gt;…&lt;/em&gt; for the highlighted style</>} />
        <Text name="heroLead" label="Intro text" defaultValue={v.heroLead ?? ""} max={400} rows={3} errors={errors} />
        <div className="two">
          <Text name="heroCtaLabel" label="Button text" defaultValue={v.heroCtaLabel ?? ""} max={40} errors={errors} />
          <Text name="heroCtaHref" label="Button link" defaultValue={v.heroCtaHref ?? ""} max={300} errors={errors} hint="/contact, #section or https://…" />
        </div>
        <MediaSelect name="heroImageA" altName="heroImageAAlt" label="Featured image" value={v.heroImageA ?? ""} alt={v.heroImageAAlt ?? ""} media={media} errors={errors} />
        <MediaSelect name="heroImageB" altName="heroImageBAlt" label="Second image" value={v.heroImageB ?? ""} alt={v.heroImageBAlt ?? ""} media={media} errors={errors} />
      </Section>

      <Section title="Overview">
        <div className="two">
          <Text name="overviewLabel" label="Small label" defaultValue={v.overview?.label ?? ""} max={60} errors={errors} />
          <Text name="overviewTitle" label="Heading" defaultValue={v.overview?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="overviewBlocks" noun="Block" items={v.overview?.blocks ?? []} min={1} max={8} errorPath="overview.blocks" errors={errors}
          fields={[{ key: "title", label: "Title", max: 100 }, { key: "text", label: "Text", kind: "textarea", max: 600 }]} />
      </Section>

      <Section title="Outcomes">
        <div className="two">
          <Text name="outcomesLabel" label="Small label" defaultValue={v.outcomes?.label ?? ""} max={60} errors={errors} />
          <Text name="outcomesTitle" label="Heading" defaultValue={v.outcomes?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="outcomesItems" noun="Outcome" items={v.outcomes?.items ?? []} min={1} max={8} errorPath="outcomes.items" errors={errors}
          fields={[{ key: "value", label: "Big number or phrase", max: 40 }, { key: "text", label: "Text", kind: "textarea", max: 300 }]} />
      </Section>

      <Section title="What is included">
        <div className="two">
          <Text name="includedLabel" label="Small label" defaultValue={v.included?.label ?? ""} max={60} errors={errors} />
          <Text name="includedTitle" label="Heading" defaultValue={v.included?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="includedItems" noun="Item" items={v.included?.items ?? []} min={1} max={12} errorPath="included.items" errors={errors} defaults={{ icon: DEFAULT_ICON }}
          fields={[{ key: "title", label: "Title", max: 100 }, { key: "text", label: "Text", kind: "textarea", max: 400 }]} />
        <p className="hint">Each item keeps its icon. New items get a plain circle until icons can be chosen.</p>
      </Section>

      <Section title="Process">
        <div className="two">
          <Text name="processLabel" label="Small label" defaultValue={v.process?.label ?? ""} max={60} errors={errors} />
          <Text name="processTitle" label="Heading" defaultValue={v.process?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="processSteps" noun="Step" items={v.process?.steps ?? []} min={1} max={10} errorPath="process.steps" errors={errors}
          fields={[{ key: "title", label: "Title", max: 100 }, { key: "duration", label: "How long", max: 40, placeholder: "1–2 weeks" }, { key: "text", label: "Text", kind: "textarea", max: 400 }]} />
      </Section>

      <Section title="Case studies" hint="Shown at the bottom of the page, in this order. Only published case studies appear on the live page.">
        <div className="two">
          <Text name="casesLabel" label="Small label" defaultValue={v.casesLabel ?? ""} max={60} errors={errors} />
          <Text name="casesTitle" label="Heading" defaultValue={v.casesTitle ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="caseIds" asStrings="id" noun="Case study" items={(v.caseIds ?? []) as unknown as Record<string, unknown>[]} max={6} errorPath="caseIds" errors={errors}
          fields={[{ key: "id", label: "Case study", kind: "select", options: cases.map((c) => ({ value: c.id, label: `${c.label}${c.status === "published" ? "" : ` — ${c.status}`}` })) }]} />
      </Section>

      <Section title="Call to action band" hint="A banner between sections. It exists on every page and is switched off on the live site today.">
        <label className="check"><input type="checkbox" name="showBand" defaultChecked={!!v.showBand} /> Show this band on the page</label>
        <Text name="bandText" label="Text" defaultValue={v.band?.text ?? ""} max={200} errors={errors} />
        <div className="two">
          <Text name="bandCtaLabel" label="Button text" defaultValue={v.band?.ctaLabel ?? ""} max={40} errors={errors} />
          <Text name="bandCtaHref" label="Button link" defaultValue={v.band?.ctaHref ?? ""} max={300} errors={errors} />
        </div>
      </Section>

      <Section title="“What we fix” section" hint="Problems this service solves. Hidden on the live site today.">
        <label className="check"><input type="checkbox" name="showProblems" defaultChecked={!!v.showProblems} /> Show this section on the page</label>
        <div className="two">
          <Text name="problemsLabel" label="Small label" defaultValue={v.problems?.label ?? ""} max={60} errors={errors} />
          <Text name="problemsTitle" label="Heading" defaultValue={v.problems?.title ?? ""} max={200} errors={errors} />
        </div>
        <ListEditor name="problemsItems" noun="Problem" items={v.problems?.items ?? []} max={8} errorPath="problems.items" errors={errors}
          fields={[{ key: "title", label: "Title", max: 100 }, { key: "text", label: "Text", kind: "textarea", max: 400 }, { key: "proofValue", label: "Proof number", max: 40 }, { key: "proofLabel", label: "Proof label", max: 100 }]} />
      </Section>

      <div className="savebar">
        <button type="submit" className="primary" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create service"}</button>
        <a href="/admin/services">Cancel</a>
        <span className="hint">{editing ? "Changes go live on the website as soon as you save (when the service is published)." : "Nothing is public until the status is Published."}</span>
      </div>
    </form>
  );
}

function Basics({ v, errors, editing, origin }: { v: ServiceInput; errors: Record<string, string>; editing: boolean; origin: string }) {
  const slugEl = useRef<HTMLInputElement>(null);
  const touched = useRef(editing || !!v.slug);
  const [slug, setSlug] = useState(v.slug ?? "");
  return (
    <Section title="Basics">
      <div className={errors.title ? "field has-err" : "field"}>
        <label htmlFor="f-title">Name</label>
        <input id="f-title" name="title" type="text" defaultValue={v.title ?? ""} maxLength={120} required
          onInput={(e) => { if (!touched.current) { const s = slugify(e.currentTarget.value); setSlug(s); if (slugEl.current) slugEl.current.value = s; } }} />
        <Err errors={errors} k="title" />
      </div>
      <div className={errors.slug ? "field has-err" : "field"}>
        <label htmlFor="f-slug">Slug (the web address)</label>
        <input id="f-slug" name="slug" type="text" ref={slugEl} defaultValue={v.slug ?? ""} maxLength={80} required spellCheck={false} autoCapitalize="off"
          onInput={(e) => { touched.current = true; setSlug(e.currentTarget.value); }} />
        <p className="hint">{origin}/services/<b>{slug || "…"}</b></p>
        {editing && <p className="hint">If you change the slug, the old address keeps working and redirects to the new one.</p>}
        <Err errors={errors} k="slug" />
      </div>
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
