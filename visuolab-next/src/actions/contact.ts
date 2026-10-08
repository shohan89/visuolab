"use server";

import { readContactForm, validateContact, type ContactResult } from "@/lib/validation/contact";
import { getDb } from "@/lib/server/db";
import { getPage } from "@/lib/server/cms-pages";
import { background } from "@/lib/server/background";
import { dispatchEvent, verifyTurnstile } from "@/lib/server/integrations";
import { notifySubmission } from "@/lib/server/notifications";
import { getSiteConfig } from "@/lib/server/site-config";
import { CONTACT_LIMITS, countHit } from "@/lib/server/rate-limit";
import { ipHash, requestHeaders, sameOrigin, valueHash } from "@/lib/server/request";
import { HONEYPOT_FIELD, STARTED_FIELD, judge } from "@/lib/server/spam";
import { findDuplicate, insertSubmission } from "@/lib/server/submissions";

const serverError = async () => `Something went wrong on our side. Please try again, or email ${(await getSiteConfig()).contact.email}.`;
const rateLimited = async () => `Too many messages from this connection. Please try again later, or email ${(await getSiteConfig()).contact.email}.`;

/** The idempotency key the form made when it appeared: a random UUID. Anything else is ignored (the content check still applies). */
const KEY_FIELD = "key";
const validKey = (v: unknown): string | undefined => (typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v) ? v.toLowerCase() : undefined);

/** Same text from the same address, whatever the spacing or capital letters. */
const normalised = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Receives the contact form.
 *
 *   visitor → origin check → validation → rate limits → duplicate check → spam checks → SAVE → notify
 *
 * The enquiry is saved before anything is sent, and the email notification can never fail the visitor's submission: its outcome is
 * recorded on the enquiry (notify_status) for the admin to see. The same form key, or the same text from the same address within
 * ten minutes, is stored once and answered with the same success, so a double click or a retry cannot create two enquiries or two emails.
 * The answer never contains anything internal (no ids, no reasons, nothing about spam detection or delivery).
 */
export async function submitContact(formData: FormData): Promise<ContactResult> {
  try {
    const h = await requestHeaders();
    if (!sameOrigin(h)) return { ok: false, code: "server", message: await serverError() };

    // 1. validate (the browser ran the same schema; this is the check that counts)
    const form = (await getPage("contact")).content.form; // the choices the form offers are page content: the same lists decide what is accepted
    const checked = validateContact(readContactForm(formData), { needs: form.needOptions, budgets: form.budgetOptions });
    if (!checked.ok) return { ok: false, code: "invalid", fieldErrors: checked.fieldErrors };
    const input = checked.data;

    // 2. rate limits: per visitor, per email address, and for the whole site (replays count too)
    const db = getDb();
    const visitor = await ipHash(h);
    const emailKey = await valueHash("email", input.email);
    const [v, e, all] = await Promise.all([
      countHit(db, `contact:ip:${visitor}`, CONTACT_LIMITS.perVisitor.windowSeconds),
      countHit(db, `contact:email:${emailKey}`, CONTACT_LIMITS.perEmail.windowSeconds),
      countHit(db, "contact:site", CONTACT_LIMITS.siteWide.windowSeconds),
    ]);
    if (v > CONTACT_LIMITS.perVisitor.max || e > CONTACT_LIMITS.perEmail.max || all > CONTACT_LIMITS.siteWide.max) {
      return { ok: false, code: "rate_limited", message: await rateLimited() };
    }

    // 3. already received? (same key, or same text from the same address a few minutes ago) -> the same success, nothing new stored or sent
    const key = validKey(formData.get(KEY_FIELD));
    const contentHash = await valueHash("content", `${input.email}\n${normalised(input.message)}`);
    if (await findDuplicate(key, contentHash)) return { ok: true };

    // 4. spam checks. Spam is kept (status "spam") so it can be reviewed, but the sender is told it worked.
    const startedRaw = Number(formData.get(STARTED_FIELD));
    const verdict = judge(input, {
      honeypot: typeof formData.get(HONEYPOT_FIELD) === "string" ? (formData.get(HONEYPOT_FIELD) as string) : "",
      startedAt: Number.isFinite(startedRaw) && startedRaw > 0 ? startedRaw : null,
    });

    // bot protection (Turnstile), when it is switched on and fully configured: a proof Cloudflare rejects makes the enquiry spam (kept, not announced).
    // If Cloudflare cannot be reached the enquiry goes through and the problem is logged on the integration.
    let spam = verdict.spam;
    if (!spam) {
      const proof = formData.get("cf-turnstile-response");
      spam = (await verifyTurnstile(typeof proof === "string" ? proof : "", h.get("cf-connecting-ip"))) === "failed";
    }

    // 5. save. The unique index on the key decides when two identical requests arrive at once: only one is stored.
    const id = await insertSubmission({
      name: input.name,
      email: input.email,
      company: input.company || undefined,
      service: input.need.length ? input.need.join(", ") : undefined,
      budget: input.budget,
      message: input.message,
      status: spam ? "spam" : "new",
      source: "contact-page",
      ipHash: visitor,
      userAgent: h.get("user-agent") ?? "",
      idempotencyKey: key,
      contentHash,
    });
    if (id === null) return { ok: true }; // the other request with this key stored it and sends the notification

    // 6. tell the team. Its result is recorded on the enquiry and never changes the answer: the enquiry is already safe.
    // The email is sent before answering (as before). The other integrations (webhook, CRM, Slack) run after the answer, each with its own
    // time limit, so a slow or broken receiver can neither delay nor fail the visitor; their results go to the integration's activity log.
    await notifySubmission(id);
    if (!spam) background(dispatchEvent("contact.submitted", { id, name: input.name, email: input.email, company: input.company || null, service: input.need.length ? input.need.join(", ") : null, budget: input.budget ?? null, message: input.message, createdAt: new Date().toISOString() }));
    return { ok: true };
  } catch (error) {
    console.error("contact submission failed:", error instanceof Error ? error.message : "unknown error"); // no visitor data in logs
    return { ok: false, code: "server", message: await serverError() };
  }
}
