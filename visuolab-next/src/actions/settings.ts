"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";
import { audit } from "@/lib/server/audit";
import { requireAdmin, type AdminUser } from "@/lib/server/auth";
import { sendTestMessage } from "@/lib/server/notifications";
import { countHit } from "@/lib/server/rate-limit";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";
import { checkMediaIds, getSection, mirrorAnalytics, saveEmailSettings, saveSection, saveTurnstileSettings } from "@/lib/server/site-config";
import { getDb } from "@/lib/server/db";
import { SEO_PAGES, analyticsSchema, contactSchema, emailSchema, generalSchema, seoSchema, socialSchema, turnstileSchema, type SectionName } from "@/lib/settings/schema";
import { toErrors } from "@/lib/validation/service";

/** Same two checks as every admin action: the request comes from this site, and the session belongs to an admin. */
async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();
  return { admin, h };
}

/** `nonce` is new on every answer, so the form knows to show the returned values again. */
export type SettingsFormState = { errors: Record<string, string>; values?: Record<string, unknown>; nonce: number } | undefined;
const fail = (errors: Record<string, string>, values: Record<string, unknown>): SettingsFormState => ({ errors, values, nonce: Date.now() + Math.random() });

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const flag = (f: FormData, k: string) => f.get(k) === "on";
const list = (f: FormData, k: string): unknown[] => {
  try {
    const v = JSON.parse(text(f, k));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

const BASE = "/admin/settings";

/** Audit entry that names the fields that changed (never their values: phone numbers and addresses are not copied into the log). */
async function done(admin: AdminUser, h: Headers, what: string, changed: string[], section: string): Promise<never> {
  await audit({
    action: "settings.update", userId: admin.id, userEmail: admin.email, entityType: "settings", entityId: section,
    summary: changed.length ? `${what}: changed ${changed.join(", ")}` : `${what}: saved, nothing changed`, ipHash: await ipHash(h),
  });
  redirect(`${BASE}/${section}?n=saved`);
}

type Result<T> = { ok: true; data: T } | { ok: false; state: SettingsFormState };

/** Runs a section's schema over the raw form values and the extra database checks. */
async function check<T>(schema: z.ZodType<T>, raw: Record<string, unknown>, extra?: (d: T) => Promise<Record<string, string>>): Promise<Result<T>> {
  const parsed = schema.safeParse(raw);
  const errors: Record<string, string> = parsed.success ? {} : toErrors(parsed.error);
  if (parsed.success && extra) Object.assign(errors, await extra(parsed.data));
  return Object.keys(errors).length || !parsed.success ? { ok: false, state: fail(errors, raw) } : { ok: true, data: parsed.data };
}

/* ---- sections ------------------------------------------------------------------------------------------------- */

export async function saveGeneral(_prev: SettingsFormState, f: FormData): Promise<SettingsFormState> {
  const { admin, h } = await guard();
  const raw = { siteName: text(f, "siteName"), description: text(f, "description"), logo: text(f, "logo"), logoDark: text(f, "logoDark"), favicon: text(f, "favicon") };
  const r = await check(generalSchema, raw, (d) => checkMediaIds({ logo: d.logo, logoDark: d.logoDark, favicon: d.favicon }));
  if (!r.ok) return r.state;
  return done(admin, h, "General", await saveSection("general", r.data, admin.id), "general");
}

export async function saveContact(_prev: SettingsFormState, f: FormData): Promise<SettingsFormState> {
  const { admin, h } = await guard();
  const raw = { email: text(f, "email"), phone: text(f, "phone"), address: text(f, "address"), hours: text(f, "hours") };
  const r = await check(contactSchema, raw);
  if (!r.ok) return r.state;
  return done(admin, h, "Contact", await saveSection("contact", r.data, admin.id), "contact");
}

export async function saveSocial(_prev: SettingsFormState, f: FormData): Promise<SettingsFormState> {
  const { admin, h } = await guard();
  const raw = { instagram: text(f, "instagram"), facebook: text(f, "facebook"), linkedin: text(f, "linkedin"), x: text(f, "x"), youtube: text(f, "youtube"), others: list(f, "others") };
  const r = await check(socialSchema, raw);
  if (!r.ok) return r.state;
  return done(admin, h, "Social profiles", await saveSection("social", r.data, admin.id), "social");
}

export async function saveSeo(_prev: SettingsFormState, f: FormData): Promise<SettingsFormState> {
  const { admin, h } = await guard();
  const pages = Object.fromEntries(SEO_PAGES.map((k) => [k, { title: text(f, `pageTitle_${k}`), description: text(f, `pageDescription_${k}`), noindex: flag(f, `pageNoindex_${k}`) }]));
  const raw = { defaultTitle: text(f, "defaultTitle"), defaultDescription: text(f, "defaultDescription"), ogImage: text(f, "ogImage"), indexing: flag(f, "indexing"), disallow: list(f, "disallow"), sitemap: flag(f, "sitemap"), pages };
  const r = await check(seoSchema, raw, (d) => checkMediaIds({ ogImage: d.ogImage }));
  if (!r.ok) {
    // the schema names fields by their data path ("pages.home.title"); the form names them "pageTitle_home"
    const errors = Object.fromEntries(Object.entries(r.state?.errors ?? {}).map(([k, m]) => { const p = /^pages\.(\w+)\.(title|description|noindex)$/.exec(k); return [p ? `page${p[2]![0]!.toUpperCase()}${p[2]!.slice(1)}_${p[1]}` : k, m]; }));
    return fail(errors, raw);
  }
  return done(admin, h, "SEO", await saveSection("seo", r.data, admin.id), "seo");
}

export async function saveAnalytics(_prev: SettingsFormState, f: FormData): Promise<SettingsFormState> {
  const { admin, h } = await guard();
  const current = await getSection("analytics"); // the per-service switches belong to Integrations: keep them
  const raw = { enabled: flag(f, "enabled"), ga4: text(f, "ga4"), gtm: text(f, "gtm"), metaPixel: text(f, "metaPixel"), ga4On: current.ga4On, gtmOn: current.gtmOn, pixelOn: current.pixelOn };
  const r = await check(analyticsSchema, raw);
  if (!r.ok) return r.state;
  const changed = await saveSection("analytics", r.data, admin.id);
  await mirrorAnalytics(r.data);
  return done(admin, h, "Analytics", changed, "analytics");
}

export async function saveEmail(_prev: SettingsFormState, f: FormData): Promise<SettingsFormState> {
  const { admin, h } = await guard();
  const raw = { provider: text(f, "provider"), from: text(f, "from"), to: list(f, "to"), enabled: flag(f, "enabled") };
  const r = await check(emailSchema, raw);
  if (!r.ok) return r.state;
  return done(admin, h, "Email notifications", await saveEmailSettings(r.data), "integrations");
}

export async function saveTurnstile(_prev: SettingsFormState, f: FormData): Promise<SettingsFormState> {
  const { admin, h } = await guard();
  const raw = { enabled: flag(f, "turnstileEnabled"), siteKey: text(f, "siteKey") };
  const r = await check(turnstileSchema, raw);
  if (!r.ok) return fail(Object.fromEntries(Object.entries(r.state?.errors ?? {}).map(([k, m]) => [k === "enabled" ? "turnstileEnabled" : k, m])), raw);
  return done(admin, h, "Bot protection", await saveTurnstileSettings(r.data), "integrations");
}

/** Send a test message to the notification addresses. Needs RESEND_API_KEY (a Cloudflare secret); at most 5 tests per 10 minutes. */
export async function sendTestEmail(): Promise<void> {
  const { admin, h } = await guard();
  if ((await countHit(getDb(), `settings-test-email:${admin.id}`, 600)) > 5) redirect(`${BASE}/integrations?n=test_limited`);
  const res = await sendTestMessage();
  await audit({ action: "settings.test_email", userId: admin.id, userEmail: admin.email, entityType: "settings", entityId: "integrations", summary: `Test email: ${res.reason}`, ipHash: await ipHash(h) });
  redirect(`${BASE}/integrations?n=${res.ok ? "test_sent" : `test_${res.reason}`}`);
}

export type { SectionName };
