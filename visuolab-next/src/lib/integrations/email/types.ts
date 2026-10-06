/*
 * The email integration, as the rest of the website sees it.
 *
 * The contact form, the admin and the notification service talk only to these types. A provider (Resend today) is one file that
 * implements `EmailProvider`; changing provider means adding a file and one line in the registry, never touching the form.
 */

export type EmailMessage = {
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  /** Plain text. Nothing is ever sent as HTML, so visitor input cannot become markup. */
  text: string;
};

/**
 * What a provider answers.
 *   ok: the provider accepted the message (it may still be delivered or bounce later; that is the provider's report).
 *   failure: `retryable` says whether trying again later could work (timeout, 429, 5xx) or not (bad key, rejected sender).
 * `reason` is a short, safe text (never the provider's raw answer, never a key) that is stored and shown to admins.
 */
export type SendResult = { ok: true; messageId?: string } | { ok: false; retryable: boolean; reason: string };

export type ProviderContext = {
  /** The secret, read from the Worker environment by the server just before sending. Never stored, logged or returned. */
  apiKey: string;
  /** Overrides the provider's address (a proxy, or a test server). Optional. */
  baseUrl?: string;
  /** Milliseconds before giving up on the provider. */
  timeoutMs: number;
  /** Injected for tests; the real `fetch` otherwise. */
  fetchImpl?: typeof fetch;
};

export interface EmailProvider {
  /** Stable id stored in settings and on each delivery record: "resend". */
  readonly id: string;
  readonly label: string;
  /** Name of the Cloudflare secret that holds this provider's key. */
  readonly secretName: string;
  send(message: EmailMessage, ctx: ProviderContext): Promise<SendResult>;
}

/** The ids the settings may choose from. "none" means no provider: enquiries are stored, nothing is sent. */
export const EMAIL_PROVIDER_IDS = ["resend", "none"] as const;
export type EmailProviderId = (typeof EMAIL_PROVIDER_IDS)[number];
