"use client";

import { useActionState, type ReactNode } from "react";
import { saveAnalytics, saveContact, saveEmail, saveGeneral, saveSeo, saveSocial, saveTurnstile, type SettingsFormState } from "@/actions/settings";
import type { MediaOption } from "@/lib/server/services-admin";
import { SEO_PAGES, type Analytics, type Contact, type EmailSettings, type General, type Seo, type Social, type TurnstileSettings } from "@/lib/settings/schema";
import { Err, Section, Text } from "./FormParts";
import ListEditor from "./ListEditor";
import { MediaField } from "./MediaPicker";

type Action = (prev: SettingsFormState, f: FormData) => Promise<SettingsFormState>;

/** One settings form: runs the section's action, shows what the server says (errors on top and under the fields) and keeps what was typed. */
function Shell<V>({ action, initial, label, inline = false, children }: { action: Action; initial: V; label: string; inline?: boolean; children: (v: V, errors: Record<string, string>) => ReactNode }) {
  const [state, run, pending] = useActionState<SettingsFormState, FormData>(action, undefined);
  const v = (state?.values ?? initial) as V;
  const errors = state?.errors ?? {};
  const n = Object.keys(errors).length;
  return (
    <form action={run} key={state?.nonce ?? 0} className={inline ? "svc-form inline-bar" : "svc-form"} noValidate>
      {n > 0 && (
        <div className="form-errors" role="alert">
          <b>{n === 1 ? "One thing needs fixing" : `${n} things need fixing`} before this can be saved:</b>
          <ul>{Object.values(errors).map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      {children(v, errors)}
      <div className="savebar">
        <button type="submit" className="primary" disabled={pending}>{pending ? "Saving…" : `Save ${label}`}</button>
        <span className="hint">Changes go live on the website as soon as you save.</span>
      </div>
    </form>
  );
}

const Pic = ({ name, label, value, media, errors, hint }: { name: string; label: string; value: string; media: MediaOption[]; errors: Record<string, string>; hint?: string }) => (
  <div className={errors[name] ? "field has-err" : "field"}>
    <span className="label-like">{label}</span>
    <MediaField name={name} id={`f-${name}`} value={value} known={media} optional label={label} />
    {hint && <p className="hint">{hint}</p>}
    <Err errors={errors} k={name} />
  </div>
);

const Check = ({ name, label, checked, hint }: { name: string; label: string; checked: boolean; hint?: string }) => (
  <div>
    <label className="check"><input type="checkbox" name={name} defaultChecked={checked} /> {label}</label>
    {hint && <p className="hint">{hint}</p>}
  </div>
);

/* ---- General -------------------------------------------------------------------------------------------------- */

export function GeneralForm({ initial, media }: { initial: General; media: MediaOption[] }) {
  return (
    <Shell action={saveGeneral} initial={initial} label="general settings">
      {(v, errors) => (
        <>
          <Section title="Site identity" hint="Used in the header and footer, in link previews and in search results.">
            <Text name="siteName" label="Site name" defaultValue={v.siteName} max={60} errors={errors} />
            <Text name="description" label="Site description" defaultValue={v.description} max={300} rows={3} errors={errors} hint="one or two sentences about what you do" />
          </Section>
          <Section title="Logo and favicon" hint="Pictures from the media library. The logo keeps the size it has today (335 × 100), so use a picture with that shape.">
            <Pic name="logo" label="Logo (for light backgrounds)" value={v.logo} media={media} errors={errors} />
            <Pic name="logoDark" label="Logo (for dark backgrounds)" value={v.logoDark} media={media} errors={errors} />
            <Pic name="favicon" label="Favicon" value={v.favicon} media={media} errors={errors} hint="A square PNG, WebP or GIF, at least 64 × 64 pixels. Empty: the browser's default." />
          </Section>
        </>
      )}
    </Shell>
  );
}

/* ---- Contact -------------------------------------------------------------------------------------------------- */

export function ContactSettingsForm({ initial }: { initial: Contact }) {
  return (
    <Shell action={saveContact} initial={initial} label="contact details">
      {(v, errors) => (
        <Section title="Contact details" hint="Public. The e-mail address is shown on the contact page, in the menu and in the closing call-to-action; all details are also given to search engines.">
          <Text name="email" label="Email" defaultValue={v.email} max={120} errors={errors} />
          <Text name="phone" label="Phone" defaultValue={v.phone} max={30} errors={errors} hint="optional, for example +31 20 123 4567" />
          <Text name="address" label="Address" defaultValue={v.address} max={300} rows={3} errors={errors} hint="one line per line of the address (up to 5)" />
          <Text name="hours" label="Business hours" defaultValue={v.hours} max={300} rows={3} errors={errors} hint="one line per day or range, for example Mon–Fri 09:00–17:30 (up to 7 lines)" />
        </Section>
      )}
    </Shell>
  );
}

/* ---- Social --------------------------------------------------------------------------------------------------- */

export function SocialForm({ initial }: { initial: Social }) {
  return (
    <Shell action={saveSocial} initial={initial} label="social profiles">
      {(v, errors) => (
        <>
          <Section title="Profiles" hint="Full https addresses. The footer shows Instagram, LinkedIn, X and Dribbble; all profiles are given to search engines. Empty fields keep the footer icons as they are today.">
            <div className="two">
              <Text name="instagram" label="Instagram" defaultValue={v.instagram} max={300} errors={errors} hint="https://instagram.com/…" />
              <Text name="linkedin" label="LinkedIn" defaultValue={v.linkedin} max={300} errors={errors} hint="https://linkedin.com/company/…" />
            </div>
            <div className="two">
              <Text name="x" label="X" defaultValue={v.x} max={300} errors={errors} hint="https://x.com/…" />
              <Text name="facebook" label="Facebook" defaultValue={v.facebook} max={300} errors={errors} hint="https://facebook.com/…" />
            </div>
            <Text name="youtube" label="YouTube" defaultValue={v.youtube} max={300} errors={errors} hint="https://youtube.com/@…" />
          </Section>
          <Section title="Other profiles" hint="For example Dribbble, Behance or GitHub. A profile named “Dribbble” is used for the Dribbble icon in the footer.">
            <ListEditor name="others" noun="Profile" items={v.others as unknown as Record<string, unknown>[]} max={8} errorPath="others" errors={errors}
              fields={[{ key: "label", label: "Name", max: 30, placeholder: "Dribbble" }, { key: "url", label: "Address", max: 300, placeholder: "https://dribbble.com/…" }]} />
          </Section>
        </>
      )}
    </Shell>
  );
}

/* ---- SEO ------------------------------------------------------------------------------------------------------ */

const PAGE_LABELS = { home: "Home page (/)", about: "About page (/about)", works: "Works page (/works)", blog: "Blog page (/blog)", contact: "Contact page (/contact)" } as const;

export function SeoForm({ initial, media }: { initial: Seo; media: MediaOption[] }) {
  return (
    <Shell action={saveSeo} initial={initial} label="SEO settings">
      {(v, errors) => (
        <>
          <Section title="Defaults" hint="Used by pages that do not set their own title, description or share picture. Pages with their own SEO fields (articles, case studies, services) keep them.">
            <Text name="defaultTitle" label="Default title" defaultValue={v.defaultTitle} max={70} recommended={60} errors={errors} hint="about 60 characters" />
            <Text name="defaultDescription" label="Default description" defaultValue={v.defaultDescription} max={200} recommended={160} rows={3} errors={errors} hint="about 150–160 characters" />
            <Pic name="ogImage" label="Default Open Graph image" value={v.ogImage} media={media} errors={errors} hint="The picture shown when a page is shared and has no picture of its own. 1200 × 630 works best." />
          </Section>
          <Section title="Page metadata" hint="The title and description search engines and link previews show for each fixed page. Services, case studies and articles have their own SEO fields in their editors. A page set to “hidden” gets a noindex tag and leaves the sitemap.">
            {SEO_PAGES.map((k) => (
              <fieldset className="le-item" key={k}>
                <legend>{PAGE_LABELS[k]}</legend>
                <Text name={`pageTitle_${k}`} label="Title" defaultValue={v.pages?.[k]?.title ?? ""} max={70} recommended={60} errors={errors} />
                <Text name={`pageDescription_${k}`} label="Description" defaultValue={v.pages?.[k]?.description ?? ""} max={200} recommended={160} rows={3} errors={errors} />
                <Check name={`pageNoindex_${k}`} label="Hide this page from search engines" checked={!!v.pages?.[k]?.noindex} />
              </fieldset>
            ))}
          </Section>
          <Section title="Search engines (robots)" hint="Controls robots.txt and, when indexing is off, a noindex tag on every page.">
            <Check name="indexing" label="Allow search engines to index the site" checked={v.indexing} hint="Turn this off for a staging copy or before launch: robots.txt then blocks everything and every page says noindex." />
            <Check name="sitemap" label="Announce the sitemap (/sitemap.xml) in robots.txt" checked={v.sitemap} />
            <p className="label-like">Paths search engines should stay out of</p>
            <ListEditor name="disallow" asStrings="path" noun="Path" items={v.disallow as unknown as Record<string, unknown>[]} max={20} errorPath="disallow" errors={errors}
              fields={[{ key: "path", label: "Path", max: 100, placeholder: "/private" }]} />
            <p className="hint">/admin is always blocked, even if it is not listed.</p>
          </Section>
        </>
      )}
    </Shell>
  );
}

/* ---- Analytics ------------------------------------------------------------------------------------------------ */

export function AnalyticsForm({ initial, siteUrl }: { initial: Analytics; siteUrl: string }) {
  const live = /^https:\/\//.test(siteUrl) && !/localhost|127\./.test(siteUrl);
  return (
    <Shell action={saveAnalytics} initial={initial} label="analytics settings">
      {(v, errors) => (
        <Section title="Tracking IDs" hint="These IDs are public (they appear in the page's scripts), so they are stored with the other settings. Scripts load after the page is ready and never change what is shown.">
          <Check name="enabled" label="Turn analytics on" checked={v.enabled} hint={live ? "The site runs on a real https address, so tracking will load." : `The site address is ${siteUrl}; tracking only loads on a real https address, so visits while testing are never counted.`} />
          <div className="two">
            <Text name="ga4" label="Google Analytics ID" defaultValue={v.ga4} max={14} errors={errors} hint="G-XXXXXXXXXX" />
            <Text name="gtm" label="Google Tag Manager ID" defaultValue={v.gtm} max={14} errors={errors} hint="GTM-XXXXXXX" />
          </div>
          <Text name="metaPixel" label="Meta Pixel ID" defaultValue={v.metaPixel} max={20} errors={errors} hint="a number, for example 1234567890123456" />
          <p className="hint">Visitor consent: if your visitors need to agree to tracking (for example in the EU), add a consent tool through Tag Manager before turning this on.</p>
        </Section>
      )}
    </Shell>
  );
}

/* ---- Integrations --------------------------------------------------------------------------------------------- */

export function EmailForm({ initial, keySet }: { initial: EmailSettings; keySet: boolean }) {
  return (
    <Shell action={saveEmail} initial={initial} label="email settings" inline>
      {(v, errors) => (
        <Section title="Email notifications" hint="Where enquiries from the contact form are sent. The API key is a Cloudflare secret and is never entered here.">
          <div className={errors.provider ? "field has-err" : "field"}>
            <label htmlFor="f-provider">Email provider</label>
            <select id="f-provider" name="provider" defaultValue={v.provider}>
              <option value="resend">Resend</option>
              <option value="none">None (do not send notifications)</option>
            </select>
            <Err errors={errors} k="provider" />
          </div>
          <Check name="enabled" label="Send notification emails" checked={v.enabled} hint={keySet ? "The Resend API key is set." : "The Resend API key (RESEND_API_KEY) is not set yet: enquiries are stored but no email goes out. See “Cloudflare secrets” below."} />
          <Text name="from" label="Send from" defaultValue={v.from} max={200} errors={errors} hint="Name <address@your-domain>. The domain must be verified in Resend." />
          <p className="label-like">Send notifications to</p>
          <ListEditor name="to" asStrings="email" noun="Address" items={v.to as unknown as Record<string, unknown>[]} min={1} max={5} errorPath="to" errors={errors}
            fields={[{ key: "email", label: "Email address", max: 120 }]} />
        </Section>
      )}
    </Shell>
  );
}

export function TurnstileForm({ initial, secretSet }: { initial: TurnstileSettings; secretSet: boolean }) {
  return (
    <Shell action={saveTurnstile} initial={initial} label="bot protection" inline>
      {(v, errors) => (
        <Section title="Bot protection (Cloudflare Turnstile)" hint="The site key is public by design. The secret key is a Cloudflare secret. The contact form does not show the Turnstile widget yet (that would change the form), so this is stored for when it is switched on.">
          <Check name="turnstileEnabled" label="Turnstile enabled" checked={v.enabled} hint={secretSet ? "The secret key is set." : "The secret key (TURNSTILE_SECRET) is not set yet."} />
          <Text name="siteKey" label="Site key" defaultValue={v.siteKey} max={80} errors={errors} hint="0x4AAAAAAA…" />
        </Section>
      )}
    </Shell>
  );
}
