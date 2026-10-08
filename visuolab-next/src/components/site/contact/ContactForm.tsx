"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { submitContact } from "@/actions/contact";
import { useSiteConfig } from "@/components/site/SiteConfigProvider";
import TurnstileWidget from "@/components/site/contact/TurnstileWidget";
import { PillBadge } from "@/components/site/ui/Pill";
import type { ContactFormSection } from "@/lib/cms/sections";
import type { FieldErrors } from "@/lib/validation/contact";

/** The validator brings in zod (about 80 KB): it is fetched when the visitor first touches the form, and the server checks the same rules anyway. */
const loadValidation = () => import("@/lib/validation/contact");

const FIELD_IDS: Record<string, string> = { name: "c-name", email: "c-email", company: "c-company", message: "c-msg" };

/**
 * The contact form. Markup and classes are the ones in contact.html. States reuse what the design already has:
 * browser validation bubbles and the red :user-invalid border for field problems, the .form-ok panel on success,
 * and the .form-note line (its text swapped) for errors that do not belong to one field.
 */
export default function ContactForm({ content, turnstileKey = "" }: { content: ContactFormSection; turnstileKey?: string }) {
  const site = useSiteConfig();
  const form = useRef<HTMLFormElement>(null);
  const startedAt = useRef(0);
  const submissionKey = useRef(""); // made when the form appears and sent with every try: the server stores one enquiry per key, so a double click or a retry after a lost answer cannot create two
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proofRound, setProofRound] = useState(0); // a Turnstile proof works once: a failed send asks for a new one

  useEffect(() => { startedAt.current = Date.now(); submissionKey.current = crypto.randomUUID(); }, []);
  useEffect(() => { const f = form.current; if (!f) return; const warm = () => { void loadValidation(); }; f.addEventListener("focusin", warm, { once: true }); return () => f.removeEventListener("focusin", warm); }, []); // when the form appeared; very fast submissions are treated as bots

  const showFieldErrors = (errors: FieldErrors) => {
    const f = form.current;
    if (!f) return;
    let first: HTMLInputElement | HTMLTextAreaElement | null = null;
    for (const [key, message] of Object.entries(errors)) {
      const el = FIELD_IDS[key] ? (f.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${FIELD_IDS[key]}`)) : null;
      if (!el) continue;
      el.setCustomValidity(message ?? "");
      first ??= el;
    }
    (first ?? f).reportValidity?.();
    first?.reportValidity();
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (pending || sent) return;
    f.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach((el) => el.setCustomValidity(""));
    setError(null);
    if (!f.checkValidity()) { f.reportValidity(); return; } // required fields and email format: the browser's own messages
    const data = new FormData(f);
    data.set("startedAt", String(startedAt.current));
    if (submissionKey.current) data.set("key", submissionKey.current);
    const { readContactForm, validateContact } = await loadValidation();
    const local = validateContact(readContactForm(data), { needs: content.needOptions, budgets: content.budgetOptions });
    if (!local.ok) { showFieldErrors(local.fieldErrors); return; }

    setPending(true);
    try {
      const res = await submitContact(data);
      if (res.ok) { setSent(true); return; }
      if (res.code === "invalid") showFieldErrors(res.fieldErrors);
      else setError(res.message);
      setProofRound((n) => n + 1);
    } catch {
      setError(content.error.replaceAll("{email}", site.email));
      setProofRound((n) => n + 1);
    }
    setPending(false);
  };

  const busy = pending || sent;
  return (
    <form
      className="contact-form"
      id="contact-form"
      noValidate
      ref={form}
      onSubmit={onSubmit}
      onInput={(e) => (e.target as HTMLInputElement).setCustomValidity?.("")}
    >
      <div className="field"><label htmlFor="c-name">{content.name.label}</label><input id="c-name" name="name" type="text" required autoComplete="name" placeholder={content.name.placeholder} maxLength={100} /></div>
      <div className="field"><label htmlFor="c-email">{content.email.label}</label><input id="c-email" name="email" type="email" required autoComplete="email" placeholder={content.email.placeholder} maxLength={254} /></div>
      <div className="field"><label htmlFor="c-company">{`${content.company.label} `}<span>optional</span></label><input id="c-company" name="company" type="text" autoComplete="organization" placeholder={content.company.placeholder} maxLength={120} /></div>

      <fieldset className="field">
        <legend>{content.needLegend}</legend>
        <div className="opts">
          {content.needOptions.map((n) => (
            <label className="opt" key={n}><input type="checkbox" name="need" value={n} /><span>{n}</span></label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>{content.budgetLegend}</legend>
        <div className="opts">
          {content.budgetOptions.map((b) => (
            <label className="opt" key={b}><input type="radio" name="budget" value={b} /><span>{b}</span></label>
          ))}
        </div>
      </fieldset>

      <div className="field"><label htmlFor="c-msg">{content.message.label}</label><textarea id="c-msg" name="message" rows={5} required placeholder={content.message.placeholder} maxLength={5000}></textarea></div>

      {/* Decoys for bots: out of sight and out of the tab order. A filled "website" field marks the message as spam. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label>Website <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {turnstileKey && <TurnstileWidget siteKey={turnstileKey} resetKey={proofRound} />}

      <button className="pill" type="submit" disabled={busy} style={busy ? { opacity: 0.6 } : undefined}>{`${content.submitLabel} `}<PillBadge /></button>
      <p className="form-note" hidden={sent} role={error ? "alert" : undefined}>{error ?? content.note}</p>
      <p className="form-ok" role="status" hidden={!sent}>{content.success}</p>
    </form>
  );
}
