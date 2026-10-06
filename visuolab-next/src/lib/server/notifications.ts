import "server-only";
import { attempt, skipped, type Outcome } from "@/lib/integrations/email/delivery";
import { providerFor } from "@/lib/integrations/email/registry";
import { enquiryEmail, testEmail } from "@/lib/mail/build";
import { getEnv } from "./db";
import { recordRun } from "./integration-log";
import { getMailConfig, getSiteConfig, recordEmailCheck } from "./site-config";
import { getSubmission, recordAttemptStart, recordOutcome } from "./submissions";

/*
 * The notification service: the one place that turns a stored enquiry into an email and records what happened.
 *
 * The contact form only calls notifySubmission(id) AFTER the enquiry is saved, and ignores the result: whatever goes wrong here
 * (no key, provider down, bad sender) is written to the enquiry's delivery record and nothing else. It does not know which email
 * provider is in use; the provider comes from the Integrations settings through the registry.
 */

type Resolved = { ready: true; provider: NonNullable<ReturnType<typeof providerFor>>; apiKey: string; from: string; to: string[] } | { ready: false; outcome: Outcome };

/** Settings + secret -> a provider ready to send, or the reason nothing will be sent. The key stays inside this function's result. */
async function resolve(): Promise<Resolved> {
  const cfg = await getMailConfig();
  const provider = providerFor(cfg.provider);
  if (!cfg.active || !provider) return { ready: false, outcome: skipped("disabled", provider?.id ?? null) };
  if (!cfg.to.length || !cfg.from) return { ready: false, outcome: skipped("no recipient", provider.id) };
  const key = (getEnv() as unknown as Record<string, unknown>)[provider.secretName];
  if (typeof key !== "string" || !key) return { ready: false, outcome: skipped("not configured", provider.id) };
  return { ready: true, provider, apiKey: key, from: cfg.from, to: cfg.to };
}

const baseUrl = () => (getEnv() as unknown as Record<string, string | undefined>).EMAIL_API_BASE || undefined;

/**
 * Notify the team about one stored enquiry and record the outcome on it. Safe to call again for a retry (the admin's "send again").
 * Never throws: an unexpected error is recorded as a failed delivery.
 */
export async function notifySubmission(id: string): Promise<Outcome | null> {
  try {
    const sub = await getSubmission(id);
    if (!sub) return null;
    if (sub.status === "spam") {
      const o = skipped("spam");
      await recordOutcome(id, o);
      return o;
    }
    const r = await resolve();
    if (!r.ready) {
      await recordOutcome(id, r.outcome);
      return r.outcome;
    }
    await recordAttemptStart(id); // before sending: an attempt that is cut short still shows as tried
    const message = enquiryEmail({ from: r.from, to: r.to }, { id: sub.id, name: sub.name, email: sub.email, company: sub.company, service: sub.service, budget: sub.budget, message: sub.message });
    const outcome = await attempt(r.provider, r.apiKey, message, { baseUrl: baseUrl() });
    await recordOutcome(id, outcome);
    // the integration's own log and state (Connected / Error in the admin) follow the real result; a skipped send is not a run
    if (outcome.status !== "skipped") await recordRun("resend", "contact.submitted", { ok: outcome.status === "sent", error: outcome.status === "failed" ? outcome.error : null }, id);
    return outcome;
  } catch (e) {
    console.error("notification failed:", e instanceof Error ? e.name : "unknown error"); // no visitor data in logs
    const o: Outcome = { status: "failed", provider: "", messageId: null, error: "internal error", retryable: true };
    await recordOutcome(id, o).catch(() => {});
    return o;
  }
}

export type TestResult = { ok: boolean; reason: "sent" | "disabled" | "no_key" | "no_recipient" | "failed"; detail?: string };

/** A test message to the notification addresses, to check the sender and the key from the admin. Not tied to any enquiry. */
export async function sendTestMessage(): Promise<TestResult> {
  const r = await resolve();
  if (!r.ready) {
    const why = r.outcome.status === "skipped" ? r.outcome.error : "disabled";
    return { ok: false, reason: why === "not configured" ? "no_key" : why === "no recipient" ? "no_recipient" : "disabled" };
  }
  const site = await getSiteConfig();
  const outcome = await attempt(r.provider, r.apiKey, testEmail({ from: r.from, to: r.to }, site.general.siteName), { baseUrl: baseUrl() });
  const problem = outcome.status === "failed" ? outcome.error : null;
  await recordEmailCheck(problem);
  await recordRun("resend", "integration.test", { ok: !problem, error: problem });
  return problem ? { ok: false, reason: "failed", detail: problem } : { ok: true, reason: "sent" };
}
