"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { submitContact } from "@/actions/contact";
import { PillBadge } from "@/components/site/ui/Pill";
import { BUDGETS, NEEDS } from "@/content/contact";
import { readContactForm, validateContact, type FieldErrors } from "@/lib/validation/contact";

const NOTE = "By sending this you agree we may reply by email. That's it — no list, no sequence.";
const FIELD_IDS: Record<string, string> = { name: "c-name", email: "c-email", company: "c-company", message: "c-msg" };

/**
 * The contact form. Markup and classes are the ones in contact.html. States reuse what the design already has:
 * browser validation bubbles and the red :user-invalid border for field problems, the .form-ok panel on success,
 * and the .form-note line (its text swapped) for errors that do not belong to one field.
 */
export default function ContactForm() {
  const form = useRef<HTMLFormElement>(null);
  const startedAt = useRef(0);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { startedAt.current = Date.now(); }, []); // when the form appeared; very fast submissions are treated as bots

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
    const local = validateContact(readContactForm(data));
    if (!local.ok) { showFieldErrors(local.fieldErrors); return; }

    setPending(true);
    try {
      const res = await submitContact(data);
      if (res.ok) { setSent(true); return; }
      if (res.code === "invalid") showFieldErrors(res.fieldErrors);
      else setError(res.message);
    } catch {
      setError("Something went wrong. Please try again, or email hello@visuolab.studio.");
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
      <div className="field"><label htmlFor="c-name">Your name</label><input id="c-name" name="name" type="text" required autoComplete="name" placeholder="Jane Okafor" maxLength={100} /></div>
      <div className="field"><label htmlFor="c-email">Email</label><input id="c-email" name="email" type="email" required autoComplete="email" placeholder="jane@company.com" maxLength={254} /></div>
      <div className="field"><label htmlFor="c-company">Company <span>optional</span></label><input id="c-company" name="company" type="text" autoComplete="organization" placeholder="Company name" maxLength={120} /></div>

      <fieldset className="field">
        <legend>What do you need?</legend>
        <div className="opts">
          {NEEDS.map((n) => (
            <label className="opt" key={n}><input type="checkbox" name="need" value={n} /><span>{n}</span></label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field">
        <legend>Budget range</legend>
        <div className="opts">
          {BUDGETS.map((b) => (
            <label className="opt" key={b}><input type="radio" name="budget" value={b} /><span>{b}</span></label>
          ))}
        </div>
      </fieldset>

      <div className="field"><label htmlFor="c-msg">About the project</label><textarea id="c-msg" name="message" rows={5} required placeholder="What are you building, what's the deadline, and what does success look like?" maxLength={5000}></textarea></div>

      {/* Decoys for bots: out of sight and out of the tab order. A filled "website" field marks the message as spam. */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label>Website <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <button className="pill" type="submit" disabled={busy} style={busy ? { opacity: 0.6 } : undefined}>Send message <PillBadge /></button>
      <p className="form-note" hidden={sent} role={error ? "alert" : undefined}>{error ?? NOTE}</p>
      <p className="form-ok" role="status" hidden={!sent}>Thanks — that&apos;s with us. You&apos;ll hear back within one working day.</p>
    </form>
  );
}
