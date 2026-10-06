import "server-only";
import { cache } from "react";
import { CATALOG } from "@/lib/integrations/core";
import { publicMediaUrl } from "@/lib/media/url";
import { DEFAULTS, SECTION_TITLES, SETTINGS_KEYS, emailSchema, resolveSection, turnstileSchema, type Analytics, type Contact, type EmailSettings, type General, type SectionName, type Seo, type Social, type TurnstileSettings } from "@/lib/settings/schema";
import { getDb, getEnv } from "./db";

/*
 * Site settings, server side.
 *   - Public-safe settings live in D1 (`site_settings`, keys settings.*) and are read by public pages through getSiteConfig().
 *   - Integration settings (email provider, notification addresses, bot protection) live in D1 (`integrations`), are read only on the
 *     server, and never reach the browser.
 *   - Secrets are Cloudflare secrets (Worker environment). Nothing here stores or returns a secret value; secretStatus() only says
 *     whether each one is set.
 */

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

/* ---- public settings ------------------------------------------------------------------------------------------ */

/** What public pages receive: resolved addresses for pictures, no private data. Serialisable (it is passed to client components). */
export type SiteConfig = {
  general: General & { logoUrl: string; logoDarkUrl: string; faviconUrl: string };
  contact: Contact;
  social: Social;
  seo: Seo & { ogImageUrl: string };
  analytics: Analytics;
};

async function readSections(): Promise<Record<SectionName, unknown>> {
  const db = getDb();
  const keys = Object.values(SETTINGS_KEYS);
  const rows = (await db.prepare(`SELECT key, value_json FROM site_settings WHERE key IN (${keys.map((_, i) => `?${i + 1}`).join(",")}) AND status = 'published'`).bind(...keys).all<Row>()).results ?? [];
  const out = {} as Record<SectionName, unknown>;
  for (const [name, key] of Object.entries(SETTINGS_KEYS) as [SectionName, string][]) {
    const r = rows.find((x) => x.key === key);
    try {
      out[name] = r ? JSON.parse(String(r.value_json)) : undefined;
    } catch {
      out[name] = undefined; // a damaged row falls back to the defaults
    }
  }
  return out;
}

/** The stored (or default) value of one section, for the admin forms. */
export async function getSection<K extends SectionName>(name: K): Promise<(typeof DEFAULTS)[K]> {
  return resolveSection(name, (await readSections())[name]);
}

async function mediaPaths(ids: string[]): Promise<Record<string, string>> {
  const want = ids.filter(Boolean);
  if (!want.length) return {};
  const rows = (await getDb().prepare(`SELECT id, url FROM media WHERE id IN (${want.map((_, i) => `?${i + 1}`).join(",")})`).bind(...want).all<Row>()).results ?? [];
  return Object.fromEntries(rows.map((r) => [String(r.id), publicMediaUrl(String(r.url))]));
}

/** Settings for public pages, read once per request. Missing or invalid values fall back to what the website had before settings existed. */
export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  const stored = await readSections();
  const general = resolveSection("general", stored.general);
  const seo = resolveSection("seo", stored.seo);
  const paths = await mediaPaths([general.logo, general.logoDark, general.favicon, seo.ogImage]);
  return {
    general: { ...general, logoUrl: paths[general.logo] ?? "/assets/logo.png", logoDarkUrl: paths[general.logoDark] ?? "/assets/logo-dark.png", faviconUrl: paths[general.favicon] ?? "" },
    contact: resolveSection("contact", stored.contact),
    social: resolveSection("social", stored.social),
    seo: { ...seo, ogImageUrl: paths[seo.ogImage] ?? "" },
    analytics: resolveSection("analytics", stored.analytics),
  };
});

/** Save one section (the caller has checked it with the section's schema). Returns the names of the fields that changed. */
export async function saveSection(name: SectionName, value: Record<string, unknown>, adminId: string): Promise<string[]> {
  const db = getDb();
  const before = resolveSection(name, (await readSections())[name]) as Record<string, unknown>;
  const changed = Object.keys(value).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(value[k]));
  const t = now();
  await db
    .prepare(
      `INSERT INTO site_settings (id, key, title, status, value_json, created_at, updated_at, updated_by) VALUES (?1, ?2, ?3, 'published', ?4, ?5, ?5, ?6)
       ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json, status = 'published', updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .bind(`set_${name}`, SETTINGS_KEYS[name], SECTION_TITLES[name], JSON.stringify(value), t, adminId)
    .run();
  return changed;
}

/** Every media id a section points at must exist and be a picture; returns field errors. */
export async function checkMediaIds(ids: Record<string, string>): Promise<Record<string, string>> {
  const errors: Record<string, string> = {};
  for (const [field, id] of Object.entries(ids)) {
    if (!id) continue;
    const ok = await getDb().prepare("SELECT 1 AS ok FROM media WHERE id = ?1 AND kind = 'image'").bind(id).first();
    if (!ok) errors[field] = "Choose a picture from the media library";
  }
  return errors;
}

/* ---- integrations (server only) ------------------------------------------------------------------------------- */

export type IntegrationStatus = "enabled" | "disabled" | "error";

async function integrationRow(slug: string): Promise<{ status: IntegrationStatus; config: Record<string, unknown>; secretName: string | null; lastError: string | null; lastCheckedAt: string | null } | null> {
  const r = await getDb().prepare("SELECT status, config_json, secret_name, last_error, last_checked_at FROM integrations WHERE slug = ?1").bind(slug).first<Row>();
  if (!r) return null;
  let config: Record<string, unknown> = {};
  try { config = JSON.parse(String(r.config_json)); } catch { /* a damaged row falls back to defaults */ }
  return { status: String(r.status) as IntegrationStatus, config, secretName: (r.secret_name as string | null) ?? null, lastError: (r.last_error as string | null) ?? null, lastCheckedAt: (r.last_checked_at as string | null) ?? null };
}

/** The email settings as the admin form shows them. Old rows (a single "to" text) are understood. */
export async function getEmailSettings(): Promise<EmailSettings & { lastError: string | null; lastCheckedAt: string | null }> {
  const env = getEnv();
  const row = await integrationRow("resend");
  const c = row?.config ?? {};
  const to = Array.isArray(c.to) ? c.to.map(String) : typeof c.to === "string" && c.to ? c.to.split(/[,;\s]+/).filter(Boolean) : env.MAIL_TO ? [env.MAIL_TO] : [];
  const draft = { provider: c.provider === "none" ? "none" : "resend", from: typeof c.from === "string" && c.from ? c.from : env.MAIL_FROM ?? "", to, enabled: row ? row.status === "enabled" : true };
  const parsed = emailSchema.safeParse(draft);
  return { ...(parsed.success ? parsed.data : { ...draft, provider: draft.provider as "resend" | "none" }), lastError: row?.lastError ?? null, lastCheckedAt: row?.lastCheckedAt ?? null };
}

export async function saveEmailSettings(v: EmailSettings): Promise<string[]> {
  const before = await getEmailSettings();
  const changed = (Object.keys(v) as (keyof EmailSettings)[]).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(v[k]));
  await getDb()
    .prepare("UPDATE integrations SET status = ?2, config_json = ?3, secret_name = 'RESEND_API_KEY', updated_at = ?4 WHERE slug = 'resend'")
    .bind("resend", v.enabled && v.provider !== "none" ? "enabled" : "disabled", JSON.stringify({ provider: v.provider, from: v.from, to: v.to }), now())
    .run();
  return changed;
}

export async function recordEmailCheck(error: string | null): Promise<void> {
  await getDb().prepare("UPDATE integrations SET last_checked_at = ?2, last_error = ?3 WHERE slug = 'resend'").bind("resend", now(), error ? error.slice(0, 200) : null).run();
}

export async function getTurnstileSettings(): Promise<TurnstileSettings> {
  const row = await integrationRow("turnstile");
  const c = row?.config ?? {};
  const parsed = turnstileSchema.safeParse({ enabled: row?.status === "enabled", siteKey: typeof c.siteKey === "string" ? c.siteKey : "" });
  return parsed.success ? parsed.data : { enabled: false, siteKey: "" };
}

export async function saveTurnstileSettings(v: TurnstileSettings): Promise<string[]> {
  const before = await getTurnstileSettings();
  const changed = (Object.keys(v) as (keyof TurnstileSettings)[]).filter((k) => before[k] !== v[k]);
  await getDb()
    .prepare("UPDATE integrations SET status = ?2, config_json = ?3, secret_name = 'TURNSTILE_SECRET', updated_at = ?4 WHERE slug = 'turnstile'")
    .bind("turnstile", v.enabled ? "enabled" : "disabled", JSON.stringify({ siteKey: v.siteKey }), now())
    .run();
  return changed;
}

/** The analytics integration row mirrors the analytics settings (the IDs are public), so the integrations list is complete. */
export async function mirrorAnalytics(a: Analytics): Promise<void> {
  await getDb()
    .prepare("UPDATE integrations SET status = ?2, config_json = ?3, updated_at = ?4 WHERE slug = 'analytics'")
    .bind("analytics", a.enabled && (a.ga4 || a.gtm || a.metaPixel) ? "enabled" : "disabled", JSON.stringify({ ga4: a.ga4, gtm: a.gtm, metaPixel: a.metaPixel }), now())
    .run();
}

/**
 * What the notification code needs: whether notifications are on, which provider, the sender and the recipients. The provider's API key
 * is NOT here: the notification service reads it from the Worker environment (a Cloudflare secret) at the moment of sending.
 * With no integration row (or no settings) the earlier environment variables MAIL_FROM / MAIL_TO still work.
 */
export async function getMailConfig(): Promise<{ active: boolean; provider: string; from: string; to: string[] }> {
  const s = await getEmailSettings();
  return { active: s.enabled && s.provider !== "none", provider: s.provider, from: s.from, to: s.to };
}

/* ---- secrets and environment: status only --------------------------------------------------------------------- */

export type SecretInfo = { name: string; purpose: string; set: boolean; command: string };

/** Whether each Cloudflare secret is set. The values are never read into anything that leaves the server. */
export function secretStatus(): SecretInfo[] {
  const env = getEnv() as unknown as Record<string, unknown>;
  const set = (n: string) => typeof env[n] === "string" && (env[n] as string).length > 0;
  const rows: SecretInfo[] = [{ name: "SESSION_SECRET", purpose: "Signs sessions and salts visitor hashes. Required in production.", set: set("SESSION_SECRET"), command: "npx wrangler secret put SESSION_SECRET" }];
  for (const d of CATALOG) for (const s of d.secrets) rows.push({ name: s.name, purpose: `${d.label}: ${s.purpose}`, set: set(s.name), command: `npx wrangler secret put ${s.name}` });
  return rows;
}

/** Non-secret environment values the website runs with (set in wrangler.jsonc). Shown read-only. */
export function environmentInfo(): { name: string; value: string; note: string }[] {
  const env = getEnv() as unknown as Record<string, string | undefined>;
  return [
    { name: "SITE_URL", value: env.SITE_URL ?? "", note: "The public address. Canonical links and share links are built from it. Analytics only run on a real https address." },
    { name: "MEDIA_BASE_URL", value: env.MEDIA_BASE_URL || "(not set: the Worker serves /media/*)", note: "The media domain in front of the R2 bucket." },
    { name: "IMAGE_TRANSFORMS", value: env.IMAGE_TRANSFORMS === "1" ? "on" : "off", note: "Cloudflare Image Transformations for admin thumbnails." },
  ];
}
