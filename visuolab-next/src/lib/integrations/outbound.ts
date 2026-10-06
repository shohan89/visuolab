/*
 * Outgoing messages (generic webhook, CRM webhook, Slack). Pure: no database, no environment. The server passes the address, the secrets
 * and a fetch function; this file builds the message, signs it, sends it with a time limit and turns the answer into a short safe result.
 * Results never contain the address, a token or the receiver's answer text: they are stored and shown to admins.
 */

export type EnquiryPayload = { id: string; name: string; email: string; company?: string | null; service?: string | null; budget?: string | null; message: string; createdAt: string };
export type OutboundEvent = { event: string; id: string; createdAt: string; siteName: string; data: EnquiryPayload | { test: true } };

export type SendOutcome = { ok: true; status: number; ms: number } | { ok: false; retryable: boolean; reason: string; status?: number; ms: number };

export const TIMEOUT_MS = 5000;

/* ---- addresses ------------------------------------------------------------------------------------------------ */

const PRIVATE_HOST = /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[.*\])$/i;

/**
 * Whether the address may be called. https only, no login in the address, no private or local hosts (the server must not be pointed at
 * the inside of a network). `hosts` limits it to named hosts (Slack). `allowInsecure` is for development and tests only (INTEGRATIONS_ALLOW_HTTP).
 * Returns a short message for the admin, or null when the address is fine.
 */
export function addressProblem(value: string, opts: { hosts?: string[]; allowInsecure?: boolean } = {}): string | null {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return "is not a valid address";
  }
  if (value.length > 600) return "is too long";
  if (u.username || u.password) return "must not contain a user name or password";
  if (!opts.allowInsecure) {
    if (u.protocol !== "https:") return "must start with https://";
    if (PRIVATE_HOST.test(u.hostname)) return "must be a public address";
  } else if (u.protocol !== "https:" && u.protocol !== "http:") return "must start with https://";
  if (opts.hosts && !opts.allowInsecure && !opts.hosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) return `must be an address on ${opts.hosts.join(" or ")}`;
  return null;
}

/* ---- messages ------------------------------------------------------------------------------------------------- */

/** Slack treats & < > as markup in text: escape them so visitor input cannot become a link, a mention or a channel ping. */
export const slackEscape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const clip = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);
const oneLine = (v: string) => v.replace(/\s+/g, " ").trim();

export function slackMessage(e: OutboundEvent): { text: string } {
  if ("test" in e.data) return { text: `:white_check_mark: Test message from ${slackEscape(e.siteName)}. Slack notifications are connected.` };
  const d = e.data;
  const lines = [
    `*New enquiry on ${slackEscape(e.siteName)}*`,
    `*${slackEscape(clip(oneLine(d.name), 80))}* (${slackEscape(clip(d.email, 120))})${d.company ? `, ${slackEscape(clip(oneLine(d.company), 80))}` : ""}`,
    ...(d.service ? [`Need: ${slackEscape(clip(oneLine(d.service), 120))}`] : []),
    ...(d.budget ? [`Budget: ${slackEscape(clip(oneLine(d.budget), 60))}`] : []),
    `> ${slackEscape(clip(oneLine(d.message), 400))}`,
  ];
  return { text: lines.join("\n") };
}

/** The generic webhook body. A stable shape: event name, ids, time, data. Extra fields are added, existing ones are not renamed. */
export const webhookBody = (e: OutboundEvent) => ({ event: e.event, id: e.id, createdAt: e.createdAt, site: e.siteName, data: e.data });

/** The CRM lead: flat fields most CRM webhooks (HubSpot forms, Zapier, Make, Pipedrive) map directly. */
export function crmBody(e: OutboundEvent) {
  if ("test" in e.data) return { event: e.event, test: true, site: e.siteName, createdAt: e.createdAt };
  const d = e.data;
  return { event: e.event, site: e.siteName, createdAt: d.createdAt, lead: { id: d.id, name: d.name, email: d.email, company: d.company ?? "", need: d.service ?? "", budget: d.budget ?? "", message: d.message, source: "website contact form" } };
}

/* ---- signing and sending -------------------------------------------------------------------------------------- */

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

/** HMAC-SHA256 of `${timestamp}.${body}`, as hex. The receiver recomputes it with the shared secret and compares. */
export async function sign(secret: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
}

export type SendOptions = { headers?: Record<string, string>; timeoutMs?: number; fetchImpl?: typeof fetch; now?: () => number };

/** POSTs JSON with a time limit. Never throws; a receiver that misbehaves is a failed run with a short safe reason. Redirects are not followed. */
export async function postJson(url: string, body: unknown, opts: SendOptions = {}): Promise<SendOutcome> {
  const now = opts.now ?? Date.now;
  const started = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? TIMEOUT_MS);
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, { method: "POST", headers: { "content-type": "application/json", "user-agent": "Visuolab-Integrations/1", ...opts.headers }, body: JSON.stringify(body), signal: controller.signal, redirect: "manual" });
    const ms = now() - started;
    if (res.status >= 200 && res.status < 300) return { ok: true, status: res.status, ms };
    if (res.status >= 300 && res.status < 400) return { ok: false, retryable: false, reason: `answered ${res.status} (redirects are not followed; use the final address)`, status: res.status, ms };
    return { ok: false, retryable: res.status === 429 || res.status >= 500, reason: `answered ${res.status}`, status: res.status, ms };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return { ok: false, retryable: true, reason: timedOut ? "timeout" : "could not reach the address", ms: now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export type Target = { slug: "webhook" | "crm_webhook" | "slack"; url: string; secret?: string; token?: string };

/** Builds and sends the message for one target. The signing secret and the token travel only in headers. */
export async function sendEvent(t: Target, e: OutboundEvent, opts: SendOptions = {}): Promise<SendOutcome> {
  const body = t.slug === "slack" ? slackMessage(e) : t.slug === "crm_webhook" ? crmBody(e) : webhookBody(e);
  const headers: Record<string, string> = { "x-visuolab-event": e.event, "x-visuolab-delivery": e.id };
  if (t.slug === "webhook" && t.secret) {
    const ts = String(Math.floor((opts.now ?? Date.now)() / 1000));
    headers["x-visuolab-timestamp"] = ts;
    headers["x-visuolab-signature"] = `sha256=${await sign(t.secret, ts, JSON.stringify(body))}`;
  }
  if (t.slug === "crm_webhook" && t.token) headers.authorization = `Bearer ${t.token}`;
  return postJson(t.url, body, { ...opts, headers: { ...headers, ...opts.headers } });
}
