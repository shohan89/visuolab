import type { EmailMessage, EmailProvider, SendResult } from "./types.ts";

/*
 * One delivery attempt and what it means for the enquiry's record. Pure: no database, no environment. The server code supplies
 * the provider, the key and the message, and stores the outcome; tests supply a fake provider and check the outcome.
 */

export type NotifyStatus = "pending" | "sent" | "failed" | "skipped";

/** Why nothing was attempted. Stored as notify_error with status "skipped". */
export type SkipReason = "spam" | "disabled" | "not configured" | "no recipient";

export type Outcome =
  | { status: "sent"; provider: string; messageId: string | null; error: null }
  | { status: "failed"; provider: string; messageId: null; error: string; retryable: boolean }
  | { status: "skipped"; provider: string | null; messageId: null; error: SkipReason };

export const TIMEOUT_MS = 5000;

/** Sends through the given provider and turns the answer into an Outcome. Never throws: a provider that misbehaves is a failed delivery. */
export async function attempt(provider: EmailProvider, apiKey: string, message: EmailMessage, opts: { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<Outcome> {
  let result: SendResult;
  try {
    result = await provider.send(message, { apiKey, baseUrl: opts.baseUrl, timeoutMs: opts.timeoutMs ?? TIMEOUT_MS, fetchImpl: opts.fetchImpl });
  } catch {
    result = { ok: false, retryable: true, reason: "mail provider error" }; // a provider bug must not become a visitor-facing error
  }
  return result.ok
    ? { status: "sent", provider: provider.id, messageId: result.messageId ?? null, error: null }
    : { status: "failed", provider: provider.id, messageId: null, error: result.reason.slice(0, 200), retryable: result.retryable };
}

export const skipped = (reason: SkipReason, provider: string | null = null): Outcome => ({ status: "skipped", provider, messageId: null, error: reason });

/** Human wording for the admin. */
export function describe(status: NotifyStatus, error: string | null): string {
  switch (status) {
    case "sent": return "Notification sent";
    case "pending": return "Notification not sent yet";
    case "failed": return error === "timeout" ? "Notification failed: the mail provider did not answer in time" : `Notification failed: ${error ?? "unknown reason"}`;
    case "skipped":
      return error === "spam" ? "No notification (marked as spam)"
        : error === "disabled" ? "No notification: email notifications are switched off"
        : error === "not configured" ? "No notification: the email API key is not set"
        : error === "no recipient" ? "No notification: no recipient is configured"
        : "No notification";
  }
}
