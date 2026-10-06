import "server-only";
import { addressProblem, sendEvent, type EnquiryPayload, type OutboundEvent, type SendOutcome, type Target } from "@/lib/integrations/outbound";
import { CATALOG, EVENTS, STATE_LABEL, catalogEntry, defaultConfig, deriveState, problemsFor, KIND_LABEL, type ConnectionState, type EventId, type FieldDef, type IntegrationDef, type IntegrationKind, type IntegrationSlug } from "@/lib/integrations/core";
import { isPublicHttps, type Analytics } from "@/lib/settings/schema";
import { getSiteUrl } from "@/lib/site";
import { getDb, getEnv } from "./db";
import { recordRun } from "./integration-log";
import { sendTestMessage } from "./notifications";
import { getEmailSettings, getSection, getSiteConfig, getTurnstileSettings, saveEmailSettings, saveSection, saveTurnstileSettings, mirrorAnalytics } from "./site-config";

/*
 * Integration management, server side. One place that knows how every integration is stored, whether it is ready, what state it is in,
 * how to run it and how to test it. The admin screens and the contact flow call only the functions here.
 *
 * Secrets: only read from the Worker environment at the moment of use, inside this file, and never put into a result. Everything that
 * leaves a function here (views, log rows, errors) is free of secret values and of webhook addresses.
 */

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();
const env = () => getEnv() as unknown as Record<string, string | undefined>;
const allowInsecure = () => env().INTEGRATIONS_ALLOW_HTTP === "1";

/* ---- views for the admin -------------------------------------------------------------------------------------- */

export type SecretView = { name: string; purpose: string; required: boolean; set: boolean; problem: string | null; command: string };
export type EventView = { id: string; event: string; status: "ok" | "failed" | "skipped"; httpStatus: number | null; error: string | null; durationMs: number | null; ref: string | null; createdAt: string };

export type IntegrationView = {
  slug: IntegrationSlug;
  label: string;
  kind: IntegrationKind;
  kindLabel: string;
  summary: string;
  effect: string;
  fields: FieldDef[];
  testLabel: string;
  server: boolean;
  enabled: boolean;
  config: Record<string, unknown>;
  state: ConnectionState;
  stateLabel: string;
  reasons: string[];
  secrets: SecretView[];
  lastSuccessAt: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

type Meta = { lastSuccessAt: string | null; lastCheckedAt: string | null; lastError: string | null; status: string; config: Record<string, unknown> };

async function readMeta(): Promise<Record<string, Meta>> {
  const rows = (await getDb().prepare("SELECT slug, status, config_json, last_success_at, last_checked_at, last_error FROM integrations").all<Row>()).results ?? [];
  const out: Record<string, Meta> = {};
  for (const r of rows) {
    let config: Record<string, unknown> = {};
    try { config = JSON.parse(String(r.config_json)); } catch { /* damaged row: defaults */ }
    out[String(r.slug)] = { lastSuccessAt: (r.last_success_at as string | null) ?? null, lastCheckedAt: (r.last_checked_at as string | null) ?? null, lastError: (r.last_error as string | null) ?? null, status: String(r.status), config };
  }
  return out;
}

/** The switch and the settings of one integration, from wherever it keeps them. */
async function readSettings(slug: IntegrationSlug, meta: Record<string, Meta>): Promise<{ enabled: boolean; config: Record<string, unknown> }> {
  switch (slug) {
    case "ga4": case "gtm": case "meta_pixel": {
      const a = await getSection("analytics");
      return slug === "ga4" ? { enabled: a.enabled && a.ga4On, config: { id: a.ga4 } } : slug === "gtm" ? { enabled: a.enabled && a.gtmOn, config: { id: a.gtm } } : { enabled: a.enabled && a.pixelOn, config: { id: a.metaPixel } };
    }
    case "resend": {
      const e = await getEmailSettings();
      return { enabled: e.enabled && e.provider !== "none", config: { provider: e.provider, from: e.from, to: e.to } };
    }
    case "turnstile": {
      const t = await getTurnstileSettings();
      return { enabled: t.enabled, config: { siteKey: t.siteKey } };
    }
    default: {
      const m = meta[slug];
      const base = defaultConfig(slug);
      const events = Array.isArray(m?.config.events) ? (m.config.events as unknown[]).filter((x): x is EventId => EVENTS.some((e) => e.id === x)) : base.events;
      return { enabled: m?.status === "enabled", config: { ...base, ...(m?.config ?? {}), events } };
    }
  }
}

/** Which Cloudflare secrets are set, and for address-like ones whether the value is usable. The values themselves are not returned. */
function readSecrets(def: IntegrationDef): SecretView[] {
  const e = env();
  return def.secrets.map((s) => {
    const value = e[s.name];
    const set = typeof value === "string" && value.length > 0;
    let problem: string | null = null;
    if (set && /_URL$/.test(s.name)) {
      const why = addressProblem(value as string, { hosts: s.name === "SLACK_WEBHOOK_URL" ? ["slack.com"] : undefined, allowInsecure: allowInsecure() });
      if (why) problem = `Cloudflare secret ${s.name} ${why}`;
    }
    return { name: s.name, purpose: s.purpose, required: s.required, set, problem, command: `npx wrangler secret put ${s.name}` };
  });
}

function buildView(def: IntegrationDef, settings: { enabled: boolean; config: Record<string, unknown> }, meta: Meta | undefined, siteIsHttps: boolean): IntegrationView {
  const secrets = readSecrets(def);
  const problems = problemsFor(def, settings.config, {
    secretsSet: Object.fromEntries(secrets.map((s) => [s.name, s.set])),
    secretProblems: Object.fromEntries(secrets.filter((s) => s.problem).map((s) => [s.name, s.problem as string])),
    siteIsHttps,
  });
  // an analytics script cannot fail on the server, so only server-run integrations can be in the Error state
  const lastError = def.server ? meta?.lastError ?? null : null;
  const { state, reasons } = deriveState({ enabled: settings.enabled, problems, lastError });
  return {
    slug: def.slug, label: def.label, kind: def.kind, kindLabel: KIND_LABEL[def.kind], summary: def.summary, effect: def.effect, fields: def.fields, testLabel: def.testLabel, server: def.server,
    enabled: settings.enabled, config: settings.config, state, stateLabel: STATE_LABEL[state], reasons, secrets,
    lastSuccessAt: meta?.lastSuccessAt ?? null, lastCheckedAt: meta?.lastCheckedAt ?? null, lastError: meta?.lastError ?? null,
  };
}

export async function listIntegrations(): Promise<IntegrationView[]> {
  const [meta, siteUrl] = await Promise.all([readMeta(), getSiteUrl()]);
  const https = isPublicHttps(siteUrl);
  return Promise.all(CATALOG.map(async (d) => buildView(d, await readSettings(d.slug, meta), meta[d.slug], https)));
}

export async function getIntegration(slug: string): Promise<IntegrationView | null> {
  const def = catalogEntry(slug);
  if (!def) return null;
  const [meta, siteUrl] = await Promise.all([readMeta(), getSiteUrl()]);
  return buildView(def, await readSettings(def.slug, meta), meta[def.slug], isPublicHttps(siteUrl));
}

/** Counts by state, for the dashboard. */
export async function integrationCounts(): Promise<Record<ConnectionState, number>> {
  const out: Record<ConnectionState, number> = { connected: 0, disconnected: 0, configuration_required: 0, error: 0 };
  for (const v of await listIntegrations()) out[v.state]++;
  return out;
}

export async function recentEvents(slug: string, limit = 20): Promise<EventView[]> {
  const rows = (await getDb().prepare("SELECT id, event, status, http_status, error, duration_ms, ref, created_at FROM integration_events WHERE integration = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2").bind(slug, limit).all<Row>()).results ?? [];
  return rows.map((r) => ({ id: String(r.id), event: String(r.event), status: r.status as EventView["status"], httpStatus: (r.http_status as number | null) ?? null, error: (r.error as string | null) ?? null, durationMs: (r.duration_ms as number | null) ?? null, ref: (r.ref as string | null) ?? null, createdAt: String(r.created_at) }));
}

/* ---- saving --------------------------------------------------------------------------------------------------- */

/** Saves the switch and the (already validated) settings of one integration. Returns the names of what changed. */
export async function saveIntegration(slug: IntegrationSlug, enabled: boolean, config: Record<string, unknown>, adminId: string): Promise<string[]> {
  const before = await readSettings(slug, await readMeta());
  const changed = [...new Set([...Object.keys(config), "enabled"])].filter((k) => (k === "enabled" ? before.enabled !== enabled : JSON.stringify(before.config[k]) !== JSON.stringify(config[k])));
  switch (slug) {
    case "ga4": case "gtm": case "meta_pixel": {
      const a = await getSection("analytics");
      const id = String(config.id ?? "");
      const next: Analytics = { ...a, ...(slug === "ga4" ? { ga4: id, ga4On: enabled } : slug === "gtm" ? { gtm: id, gtmOn: enabled } : { metaPixel: id, pixelOn: enabled }) };
      if (enabled && !a.enabled) {
        // the master switch was off: turning it on must not start the services that were off, only this one
        next.ga4On = slug === "ga4"; next.gtmOn = slug === "gtm"; next.pixelOn = slug === "meta_pixel";
      }
      // the master switch follows the services: on while at least one has an ID and is on
      next.enabled = enabled ? true : a.enabled && !!((next.ga4 && next.ga4On) || (next.gtm && next.gtmOn) || (next.metaPixel && next.pixelOn));
      await saveSection("analytics", next, adminId);
      await mirrorAnalytics(next);
      break;
    }
    case "resend":
      await saveEmailSettings({ provider: config.provider as "resend" | "none", from: String(config.from), to: config.to as string[], enabled });
      break;
    case "turnstile":
      await saveTurnstileSettings({ enabled, siteKey: String(config.siteKey ?? "") });
      break;
    default: {
      const def = catalogEntry(slug) as IntegrationDef;
      const t = now();
      await getDb()
        .prepare(
          `INSERT INTO integrations (id, slug, title, status, config_json, secret_name, created_at, updated_at, updated_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8)
           ON CONFLICT (slug) DO UPDATE SET status = excluded.status, config_json = excluded.config_json, secret_name = excluded.secret_name, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
        )
        .bind(`int_${slug}`, slug, def.label, enabled ? "enabled" : "disabled", JSON.stringify(config), def.secrets[0]?.name ?? null, t, adminId)
        .run();
    }
  }
  return changed;
}

/* ---- running ---------------------------------------------------------------------------------------------------- */

/** The address and keys of an outgoing integration, read from the Worker environment. Null when it cannot run. */
function targetFor(slug: "webhook" | "crm_webhook" | "slack"): Target | null {
  const e = env();
  const url = slug === "webhook" ? e.WEBHOOK_URL : slug === "crm_webhook" ? e.CRM_WEBHOOK_URL : e.SLACK_WEBHOOK_URL;
  if (!url || addressProblem(url, { hosts: slug === "slack" ? ["slack.com"] : undefined, allowInsecure: allowInsecure() })) return null;
  return { slug, url, secret: slug === "webhook" ? e.WEBHOOK_SECRET || undefined : undefined, token: slug === "crm_webhook" ? e.CRM_WEBHOOK_TOKEN || undefined : undefined };
}

const OUTBOUND = ["webhook", "crm_webhook", "slack"] as const;

async function deliver(slug: (typeof OUTBOUND)[number], event: OutboundEvent, ref: string | null): Promise<SendOutcome | null> {
  const target = targetFor(slug);
  if (!target) return null;
  let outcome: SendOutcome;
  try {
    outcome = await sendEvent(target, event);
  } catch {
    outcome = { ok: false, retryable: true, reason: "internal error", ms: 0 };
  }
  await recordRun(slug, event.event, { ok: outcome.ok, status: outcome.ok ? outcome.status : outcome.status ?? null, error: outcome.ok ? null : outcome.reason, ms: outcome.ms }, ref);
  return outcome;
}

/**
 * Tell every connected outgoing integration that listens for `event`. Each runs on its own with a time limit; a failure is written to the
 * activity log and the integration's state and goes no further. Never throws, so the contact form cannot be affected.
 */
export async function dispatchEvent(event: EventId, data: EnquiryPayload): Promise<void> {
  try {
    const [views, site] = await Promise.all([listIntegrations(), getSiteConfig()]);
    const e: OutboundEvent = { event, id: `${data.id}:${event}`, createdAt: data.createdAt, siteName: site.general.siteName, data };
    const live = views.filter((v) => (OUTBOUND as readonly string[]).includes(v.slug) && v.enabled && v.state !== "configuration_required" && Array.isArray(v.config.events) && (v.config.events as string[]).includes(event));
    await Promise.allSettled(live.map((v) => deliver(v.slug as (typeof OUTBOUND)[number], e, data.id)));
  } catch (err) {
    console.error("integration dispatch failed:", err instanceof Error ? err.name : "unknown error");
  }
}

/* ---- tests (run from the admin) ----------------------------------------------------------------------------------- */

export type TestOutcome = { ok: boolean; message: string };

/** Runs the integration's own check from the server and records it. The message is short, safe and shown to the admin. */
export async function testIntegration(slug: string): Promise<TestOutcome> {
  const v = await getIntegration(slug);
  if (!v) return { ok: false, message: "Unknown integration" };
  const def = catalogEntry(slug) as IntegrationDef;
  const missing = problemsFor(def, v.config, { secretsSet: Object.fromEntries(v.secrets.map((s) => [s.name, s.set])), secretProblems: Object.fromEntries(v.secrets.filter((s) => s.problem).map((s) => [s.name, s.problem as string])), siteIsHttps: true });
  if (missing.length) return { ok: false, message: `Not tested: ${missing[0]}` };
  const done = async (ok: boolean, message: string, status?: number, ms?: number): Promise<TestOutcome> => {
    await recordRun(slug, "integration.test", { ok, status, error: ok ? null : message, ms });
    return { ok, message };
  };
  switch (slug) {
    case "ga4": case "gtm": case "meta_pixel":
      return done(true, `The ${def.label} ID has the right shape. The script loads on the website once it runs on a public https address.`);
    case "resend": {
      const r = await sendTestMessage();
      return r.ok ? { ok: true, message: "Test email handed to the provider." } : { ok: false, message: r.reason === "failed" ? `The provider refused the test: ${r.detail ?? "unknown reason"}` : `Not sent: ${r.reason.replace("_", " ")}` };
    }
    case "turnstile": {
      const res = await verifyWithCloudflare("visuolab-connection-test", null);
      if (res.kind === "unreachable") return done(false, "Could not reach Cloudflare to check the secret key");
      if (res.codes.includes("invalid-input-secret")) return done(false, "Cloudflare rejected the secret key (TURNSTILE_SECRET)");
      return done(true, "Cloudflare accepted the secret key.");
    }
    default: {
      const site = await getSiteConfig();
      const out = await deliver(slug as (typeof OUTBOUND)[number], { event: "integration.test", id: `test:${Date.now()}`, createdAt: now(), siteName: site.general.siteName, data: { test: true } }, null);
      if (!out) return { ok: false, message: "Not tested: the address secret is not usable" };
      return out.ok ? { ok: true, message: `The receiver answered ${out.status} in ${out.ms} ms.` } : { ok: false, message: `The receiver ${out.reason}` };
    }
  }
}

/* ---- Turnstile ---------------------------------------------------------------------------------------------------- */

type CfAnswer = { kind: "answer"; success: boolean; codes: string[] } | { kind: "unreachable"; codes: [] };

async function verifyWithCloudflare(token: string, ip: string | null): Promise<CfAnswer> {
  const secret = env().TURNSTILE_SECRET;
  if (!secret) return { kind: "unreachable", codes: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(env().TURNSTILE_VERIFY_URL || "https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: controller.signal });
    const j = (await res.json()) as { success?: boolean; "error-codes"?: unknown };
    return { kind: "answer", success: j.success === true, codes: Array.isArray(j["error-codes"]) ? j["error-codes"].map(String).slice(0, 5) : [] };
  } catch {
    return { kind: "unreachable", codes: [] };
  } finally {
    clearTimeout(timer);
  }
}

export type TurnstileGate = { active: false } | { active: true; siteKey: string };

/** Whether the contact form must carry a Turnstile proof right now (switched on, site key set, secret set). Public-safe: only the site key. */
export async function turnstileGate(): Promise<TurnstileGate> {
  const [t, secretSet] = [await getTurnstileSettings(), !!env().TURNSTILE_SECRET];
  return t.enabled && t.siteKey && secretSet ? { active: true, siteKey: t.siteKey } : { active: false };
}

/**
 * Verifies a visitor's proof. "failed" means Cloudflare said the proof is not valid (the enquiry is kept as spam). If Cloudflare cannot be
 * reached the enquiry is let through: a real customer is worth more than a missed check, and the problem is logged (the integration shows Error).
 */
export async function verifyTurnstile(token: string, ip: string | null): Promise<"passed" | "failed" | "unavailable"> {
  const gate = await turnstileGate();
  if (!gate.active) return "passed";
  // no proof (a script that was blocked, or a bot posting straight to the form) is the check doing its job, not a fault of the integration
  if (!token || token.length > 2048) return "failed";
  const started = Date.now();
  const a = await verifyWithCloudflare(token, ip);
  const ms = Date.now() - started;
  if (a.kind === "unreachable") {
    await recordRun("turnstile", "contact.submitted", { ok: false, error: "could not reach Cloudflare to verify", ms });
    return "unavailable";
  }
  if (a.success) {
    await recordRun("turnstile", "contact.submitted", { ok: true, ms });
    return "passed";
  }
  // a rejected proof is the check working (a bot), unless the key itself is wrong: that is a configuration error
  const keyProblem = a.codes.includes("invalid-input-secret") || a.codes.includes("missing-input-secret");
  await recordRun("turnstile", "contact.submitted", keyProblem ? { ok: false, error: "Cloudflare rejected the secret key", ms } : { ok: true, ms });
  return keyProblem ? "unavailable" : "failed";
}
