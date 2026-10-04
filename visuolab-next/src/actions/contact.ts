"use server";

import { readContactForm, validateContact, type ContactResult } from "@/lib/validation/contact";
import { getDb } from "@/lib/server/db";
import { notifyNewSubmission } from "@/lib/server/mail";
import { CONTACT_LIMITS, countHit } from "@/lib/server/rate-limit";
import { ipHash, requestHeaders, sameOrigin, valueHash } from "@/lib/server/request";
import { HONEYPOT_FIELD, STARTED_FIELD, judge } from "@/lib/server/spam";
import { insertSubmission, markNotified } from "@/lib/server/submissions";

const SERVER_ERROR = "Something went wrong on our side. Please try again, or email hello@visuolab.studio.";
const RATE_LIMITED = "Too many messages from this connection. Please try again later, or email hello@visuolab.studio.";

/**
 * Receives the contact form. Order matters: origin, validation, rate limits, spam checks, save, notify.
 * The answer never contains anything internal (no ids, no reasons, nothing about spam detection).
 */
export async function submitContact(formData: FormData): Promise<ContactResult> {
  try {
    const h = await requestHeaders();
    if (!sameOrigin(h)) return { ok: false, code: "server", message: SERVER_ERROR };

    // 1. validate (the browser ran the same schema; this is the check that counts)
    const checked = validateContact(readContactForm(formData));
    if (!checked.ok) return { ok: false, code: "invalid", fieldErrors: checked.fieldErrors };
    const input = checked.data;

    // 2. rate limits: per visitor, per email address, and for the whole site
    const db = getDb();
    const visitor = await ipHash(h);
    const emailKey = await valueHash("email", input.email);
    const [v, e, all] = await Promise.all([
      countHit(db, `contact:ip:${visitor}`, CONTACT_LIMITS.perVisitor.windowSeconds),
      countHit(db, `contact:email:${emailKey}`, CONTACT_LIMITS.perEmail.windowSeconds),
      countHit(db, "contact:site", CONTACT_LIMITS.siteWide.windowSeconds),
    ]);
    if (v > CONTACT_LIMITS.perVisitor.max || e > CONTACT_LIMITS.perEmail.max || all > CONTACT_LIMITS.siteWide.max) {
      return { ok: false, code: "rate_limited", message: RATE_LIMITED };
    }

    // 3. spam checks. Spam is kept (status "spam") so it can be reviewed, but the sender is told it worked.
    const startedRaw = Number(formData.get(STARTED_FIELD));
    const verdict = judge(input, {
      honeypot: typeof formData.get(HONEYPOT_FIELD) === "string" ? (formData.get(HONEYPOT_FIELD) as string) : "",
      startedAt: Number.isFinite(startedRaw) && startedRaw > 0 ? startedRaw : null,
    });

    // 4. save
    const id = await insertSubmission({
      name: input.name,
      email: input.email,
      company: input.company || undefined,
      service: input.need.length ? input.need.join(", ") : undefined,
      budget: input.budget,
      message: input.message,
      status: verdict.spam ? "spam" : "new",
      source: "contact-page",
      ipHash: visitor,
      userAgent: h.get("user-agent") ?? "",
    });

    // 5. tell the team (never blocks or fails the visitor's submission)
    if (!verdict.spam) {
      const problem = await notifyNewSubmission({ id, name: input.name, email: input.email, company: input.company, service: input.need.join(", ") || undefined, budget: input.budget, message: input.message });
      await markNotified(id, problem).catch(() => {});
    }
    return { ok: true };
  } catch (error) {
    console.error("contact submission failed:", error instanceof Error ? error.message : "unknown error"); // no visitor data in logs
    return { ok: false, code: "server", message: SERVER_ERROR };
  }
}
