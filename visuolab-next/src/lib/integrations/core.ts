/*
 * The integration layer: what an integration is, how its state is worked out, and the catalog of the ones the website knows.
 *
 * Pure module (zod only, no framework, no database): shared by the admin screens, the server code and scripts/db/verify.mjs.
 *
 * Where things live:
 *   - the settings of an integration (IDs, sender, which events to send) are public-safe and live in D1;
 *   - anything that is a credential (API key, token, webhook address, signing secret) is a Cloudflare secret and is only ever named
 *     here. Nothing in this file, in the database or in a page holds the value.
 * To add an integration: add an entry to CATALOG (and, if it sends something, a sender in server/integrations.ts). The overview, the
 * detail page, the status rules, the secrets table, the test button and the activity log work for every entry without changes.
 */
import { z } from "zod";
import { EMAIL_PROVIDER_IDS } from "./email/types.ts";

/* ---- states --------------------------------------------------------------------------------------------------- */

export type ConnectionState = "connected" | "disconnected" | "configuration_required" | "error";

export const STATE_LABEL: Record<ConnectionState, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  configuration_required: "Configuration required",
  error: "Error",
};

export type StateInput = {
  /** The switch in the admin. */
  enabled: boolean;
  /** What is missing or wrong in the settings and secrets (see problemsFor). Empty when everything needed is there. */
  problems: string[];
  /** Short safe reason of the latest failed run, cleared by the next successful one. */
  lastError: string | null;
};

/**
 * One rule for all integrations:
 *   switched off                              -> Disconnected (whatever else is missing is not a problem yet)
 *   on, but something needed is missing       -> Configuration required (the reasons say what)
 *   on, complete, and the last run failed     -> Error (the reason is the last failure)
 *   on, complete, no failure since            -> Connected
 */
export function deriveState(i: StateInput): { state: ConnectionState; reasons: string[] } {
  if (!i.enabled) return { state: "disconnected", reasons: ["Switched off"] };
  if (i.problems.length) return { state: "configuration_required", reasons: i.problems };
  if (i.lastError) return { state: "error", reasons: [i.lastError] };
  return { state: "connected", reasons: [] };
}

/* ---- the catalog ---------------------------------------------------------------------------------------------- */

export type IntegrationKind = "analytics" | "email" | "antispam" | "outbound";
export const KIND_LABEL: Record<IntegrationKind, string> = { analytics: "Analytics", email: "Email", antispam: "Bot protection", outbound: "Webhooks" };

/** Things that happen on the website that an outgoing integration can be told about. */
export const EVENTS = [{ id: "contact.submitted", label: "New contact enquiry" }] as const;
export type EventId = (typeof EVENTS)[number]["id"];
export const EVENT_IDS = EVENTS.map((e) => e.id) as [EventId, ...EventId[]];

export type FieldDef =
  | { name: string; label: string; type: "text"; max: number; placeholder?: string; hint?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; hint?: string }
  | { name: string; label: string; type: "emails"; hint?: string }
  | { name: string; label: string; type: "events"; hint?: string };

export type SecretDef = { name: string; purpose: string; required: boolean };

export const SLUGS = ["ga4", "gtm", "meta_pixel", "resend", "turnstile", "webhook", "crm_webhook", "slack"] as const;
export type IntegrationSlug = (typeof SLUGS)[number];
export const isSlug = (s: string): s is IntegrationSlug => (SLUGS as readonly string[]).includes(s);

export type IntegrationDef = {
  slug: IntegrationSlug;
  label: string;
  kind: IntegrationKind;
  summary: string;
  /** What switching it on does on the website. */
  effect: string;
  fields: FieldDef[];
  /** Checks the settings (not the switch). Applied to what the admin saves. */
  schema: z.ZodType<Record<string, unknown>>;
  /** Cloudflare secrets this integration reads at run time. Values are never read into anything that leaves the server. */
  secrets: SecretDef[];
  /** What the test button does, in words. */
  testLabel: string;
  /** Settings the integration cannot work without; each message says what to do. Called with the stored settings. */
  missing: (config: Record<string, unknown>) => string[];
  /** True for integrations that are run by the server when something happens (they get an activity log and can fail at run time). */
  server: boolean;
};

const trimmed = (max: number) => z.string().trim().max(max, "Value is too long");

const GA_ID = /^G-[A-Z0-9]{6,12}$/;
const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/;
const PIXEL_ID = /^\d{8,20}$/;

const events = z.array(z.enum(EVENT_IDS)).max(20).transform((v) => [...new Set(v)]);
const eventsField: FieldDef = { name: "events", label: "Send when", type: "events", hint: "The website calls this integration only for the events you tick." };
const needEvents = (c: Record<string, unknown>) => (Array.isArray(c.events) && c.events.length ? [] : ["Choose at least one event to send"]);

const emailAddress = z.string().trim().toLowerCase().min(3).max(120).regex(/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/, "Each address must look like name@example.com");

export const CATALOG: IntegrationDef[] = [
  {
    slug: "ga4", label: "Google Analytics 4", kind: "analytics", server: false,
    summary: "Counts visits to the website with Google Analytics.",
    effect: "Loads the Google tag on every public page after it is interactive, on a real https address only.",
    fields: [{ name: "id", label: "Measurement ID", type: "text", max: 16, placeholder: "G-XXXXXXXXXX", hint: "Public by design: it is part of the script address visitors load." }],
    schema: z.object({ id: trimmed(100).refine((v) => v === "" || GA_ID.test(v), "Measurement ID looks like G-XXXXXXXXXX") }),
    secrets: [], testLabel: "Check the ID",
    missing: (c) => (c.id ? [] : ["Add the measurement ID"]),
  },
  {
    slug: "gtm", label: "Google Tag Manager", kind: "analytics", server: false,
    summary: "Loads your Tag Manager container.",
    effect: "Loads the container on every public page after it is interactive, on a real https address only.",
    fields: [{ name: "id", label: "Container ID", type: "text", max: 14, placeholder: "GTM-XXXXXXX" }],
    schema: z.object({ id: trimmed(100).refine((v) => v === "" || GTM_ID.test(v), "Container ID looks like GTM-XXXXXXX") }),
    secrets: [], testLabel: "Check the ID",
    missing: (c) => (c.id ? [] : ["Add the container ID"]),
  },
  {
    slug: "meta_pixel", label: "Meta Pixel", kind: "analytics", server: false,
    summary: "Measures visits for Meta (Facebook, Instagram) advertising.",
    effect: "Loads the pixel on every public page after it is interactive, on a real https address only.",
    fields: [{ name: "id", label: "Pixel ID", type: "text", max: 20, placeholder: "1234567890123456" }],
    schema: z.object({ id: trimmed(100).refine((v) => v === "" || PIXEL_ID.test(v), "Pixel ID is a number of 8 to 20 digits") }),
    secrets: [], testLabel: "Check the ID",
    missing: (c) => (c.id ? [] : ["Add the pixel ID"]),
  },
  {
    slug: "resend", label: "Email notifications", kind: "email", server: true,
    summary: "Emails the team when someone sends the contact form.",
    effect: "Every new enquiry is emailed to the notification addresses. The enquiry is saved whether or not the email goes out.",
    fields: [
      { name: "provider", label: "Provider", type: "select", options: EMAIL_PROVIDER_IDS.map((p) => ({ value: p, label: p === "none" ? "None (store enquiries only)" : p === "resend" ? "Resend" : p })) },
      { name: "from", label: "Sender", type: "text", max: 200, placeholder: "Visuolab <hello@yourdomain.com>", hint: "Must be an address on a domain verified with the provider." },
      { name: "to", label: "Notify these addresses", type: "emails", hint: "One per line, at most 5." },
    ],
    schema: z.object({
      provider: z.enum(EMAIL_PROVIDER_IDS),
      from: z.string().trim().max(200).refine((v) => /^([^<>@\r\n]{1,80}\s)?<?[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}>?$/.test(v), "Sender must be an address like hello@example.com or Name <hello@example.com>"),
      to: z.array(emailAddress).min(1, "Add at least one address to notify").max(5, "At most 5 addresses"),
    }),
    secrets: [{ name: "RESEND_API_KEY", purpose: "Authorises sending through Resend.", required: true }], testLabel: "Send a test email",
    missing: (c) => [...(c.provider === "none" ? ["Choose an email provider"] : []), ...(c.from ? [] : ["Add a sender address"]), ...(Array.isArray(c.to) && c.to.length ? [] : ["Add a notification address"])],
  },
  {
    slug: "turnstile", label: "Cloudflare Turnstile", kind: "antispam", server: true,
    summary: "Checks that a contact form is sent by a person.",
    effect: "The contact form asks Turnstile for a proof (invisible unless Cloudflare needs more) and the server verifies it. Enquiries that fail are kept as spam for review; the visitor is not told.",
    fields: [{ name: "siteKey", label: "Site key", type: "text", max: 80, placeholder: "0x4AAAAAAA…", hint: "Public by design. The secret key is a Cloudflare secret." }],
    schema: z.object({ siteKey: trimmed(80).refine((v) => v === "" || /^[0-9A-Za-z_-]{10,80}$/.test(v), "Site key looks like 0x4AAAAAAA… (letters, digits, - and _)") }),
    secrets: [{ name: "TURNSTILE_SECRET", purpose: "Lets the server verify the visitor's proof with Cloudflare.", required: true }], testLabel: "Check the secret key with Cloudflare",
    missing: (c) => (c.siteKey ? [] : ["Add the site key"]),
  },
  {
    slug: "webhook", label: "Webhook", kind: "outbound", server: true,
    summary: "Sends a signed JSON message to any address you control.",
    effect: "On each chosen event the server POSTs JSON to the webhook address, signed with the signing secret (header X-Visuolab-Signature) when one is set.",
    fields: [eventsField],
    schema: z.object({ events }),
    secrets: [{ name: "WEBHOOK_URL", purpose: "Where the message is sent (https). Kept secret because it can carry a token.", required: true }, { name: "WEBHOOK_SECRET", purpose: "Signs each message (HMAC-SHA256) so the receiver can check it came from here.", required: false }],
    testLabel: "Send a test message", missing: needEvents,
  },
  {
    slug: "crm_webhook", label: "CRM webhook", kind: "outbound", server: true,
    summary: "Creates a lead in your CRM through its incoming-webhook address.",
    effect: "On each chosen event the server POSTs the enquiry as a lead (name, email, company, need, budget, message) to the CRM address.",
    fields: [eventsField],
    schema: z.object({ events }),
    secrets: [{ name: "CRM_WEBHOOK_URL", purpose: "The CRM's incoming webhook address (https).", required: true }, { name: "CRM_WEBHOOK_TOKEN", purpose: "Sent as a Bearer token when the CRM asks for one.", required: false }],
    testLabel: "Send a test lead", missing: needEvents,
  },
  {
    slug: "slack", label: "Slack notifications", kind: "outbound", server: true,
    summary: "Posts a short message in a Slack channel for each enquiry.",
    effect: "On each chosen event the server posts a plain-text message to the Slack channel the webhook belongs to.",
    fields: [eventsField],
    schema: z.object({ events }),
    secrets: [{ name: "SLACK_WEBHOOK_URL", purpose: "Slack incoming-webhook address (https://hooks.slack.com/services/…). Anyone with it can post to the channel.", required: true }],
    testLabel: "Post a test message", missing: needEvents,
  },
];

export const catalogEntry = (slug: string): IntegrationDef | undefined => CATALOG.find((d) => d.slug === slug);

/** The settings a new or unreadable integration starts with. */
export function defaultConfig(slug: IntegrationSlug): Record<string, unknown> {
  switch (slug) {
    case "ga4": case "gtm": case "meta_pixel": return { id: "" };
    case "resend": return { provider: "resend", from: "", to: [] };
    case "turnstile": return { siteKey: "" };
    default: return { events: ["contact.submitted"] };
  }
}

/**
 * What stops an enabled integration from working: missing settings, missing or unusable secrets, and for the analytics scripts a site
 * address that is not public https. `secretsSet` says which Cloudflare secrets exist; `secretProblems` has a message for any that is
 * set but unusable (a webhook address that is not https); `siteIsHttps` is false on localhost and over http.
 */
export function problemsFor(def: IntegrationDef, config: Record<string, unknown>, ctx: { secretsSet: Record<string, boolean>; secretProblems?: Record<string, string>; siteIsHttps: boolean }): string[] {
  const out = [...def.missing(config)];
  for (const s of def.secrets) {
    if (!ctx.secretsSet[s.name]) {
      if (s.required) out.push(`Cloudflare secret ${s.name} is not set`);
    } else {
      const p = ctx.secretProblems?.[s.name];
      if (p) out.push(p);
    }
  }
  if (def.kind === "analytics" && !ctx.siteIsHttps) out.push("SITE_URL is not a public https address, so the script is not loaded on the website");
  return out;
}

/** Validates what an admin typed for one integration against its schema. Returns the cleaned settings or the field errors. */
export function parseConfig(def: IntegrationDef, raw: Record<string, unknown>): { ok: true; config: Record<string, unknown> } | { ok: false; errors: Record<string, string> } {
  const r = def.schema.safeParse(raw);
  if (r.success) {
    // every field has its own strict shape above; this is the last guard against a credential pasted into a setting
    const secret = Object.values(r.data).some((v) => (typeof v === "string" ? looksSecret(v) : Array.isArray(v) && v.some((x) => typeof x === "string" && looksSecret(x))));
    if (!secret) return { ok: true, config: r.data };
    return { ok: false, errors: { _: "This looks like a key or a secret address. Do not store them here: set them as Cloudflare secrets." } };
  }
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? "_");
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

/** Shapes of credentials (Resend, Slack, GitHub, AWS, Stripe, PEM, Slack webhook paths). A value like this is refused as a setting. */
const SECRET_SHAPES = [/\bre_[A-Za-z0-9_]{16,}/, /\b[sr]k_(live|test)_[A-Za-z0-9]{10,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bxox[abprs]-[A-Za-z0-9-]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /hooks\.slack\.com\/services\//, /https?:\/\/[^\s]*[?&](token|key|secret)=/i];
export const looksSecret = (v: string): boolean => SECRET_SHAPES.some((re) => re.test(v));
