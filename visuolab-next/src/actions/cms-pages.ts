"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";
import { TEMPLATES, templateSlug, type SectionErrors } from "@/lib/cms/registry";
import { savePageSeo, saveSectionContent, setSectionEnabled } from "@/lib/cms/store";
import type { PageTemplate } from "@/lib/cms/types";

/*
 * Server actions of the page CMS. No screen calls them yet; they are the one door to the content: the request must come from this site, the
 * session must belong to an admin (read from the database on every call), and the content is checked against the strict schema of its section
 * (src/lib/cms/sections) before anything is written.
 */

/** `nonce` is new on every answer, so a form knows to show the returned errors again. */
export type CmsFormState =
  | { ok: true; updatedAt: string; nonce: number }
  | { ok: false; kind: "invalid"; errors: SectionErrors; nonce: number }
  | { ok: false; kind: "conflict" | "missing" | "locked"; nonce: number }
  | undefined;
const nonce = () => Date.now() + Math.random();

async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();
  return { admin, h };
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const json = (f: FormData, k: string): unknown => {
  try { return JSON.parse(text(f, k)); } catch { return undefined; }
};
/**
 * Tells Next that the public pages that show this content changed. What actually refreshes the Worker's cached HTML is the content version that the
 * audit entry below bumps (src/lib/server/audit.ts); this also drops Next's own route cache for the same pages. It never fails a save.
 */
function refreshPublic(template: PageTemplate) {
  try {
    const route = TEMPLATES[template].route;
    if (route) revalidatePath(route);
    else if (template === "service_detail") revalidatePath("/services/[slug]", "page");
    else if (template === "case_study_detail") revalidatePath("/works/[slug]", "page");
    else if (template === "article_detail") revalidatePath("/blog/[slug]", "page");
    else revalidatePath("/", "layout"); // shared copy: every page
  } catch { /* the content version already invalidates the cache */ }
}

const isTemplate = (v: string): v is PageTemplate => Object.prototype.hasOwnProperty.call(TEMPLATES, v);
const bad = (message: string): CmsFormState => ({ ok: false, kind: "invalid", errors: { form: message }, nonce: nonce() });

/** Saves the content of one section: fields `template`, `key`, `content` (JSON) and `expectedUpdatedAt`. */
export async function saveSection(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template)) return bad("Unknown page.");
  const content = json(f, "content");
  if (content === undefined) return bad("The content could not be read. Reload the page and try again.");
  const key = text(f, "key");
  const res = await saveSectionContent(getDb(), { template, key, content, expectedUpdatedAt: text(f, "expectedUpdatedAt"), userId: admin.id });
  if (!res.ok) return res.kind === "invalid" ? { ok: false, kind: "invalid", errors: res.errors, nonce: nonce() } : { ok: false, kind: res.kind, nonce: nonce() };
  await audit({
    action: "cms.section.update", userId: admin.id, userEmail: admin.email, entityType: "page_section", entityId: `${template}.${key}`,
    summary: `${TEMPLATES[template].label} / ${key}: ${res.changedFields.length ? `changed ${res.changedFields.join(", ")}` : "saved, nothing changed"}`, ipHash: await ipHash(h),
  });
  refreshPublic(template);
  return { ok: true, updatedAt: res.updatedAt, nonce: nonce() };
}

/** Shows or hides a section that may be hidden: fields `template`, `key`, `enabled` ("1" or "0"). Goes back to the page's screen with a message. */
export async function setSectionVisibility(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template)) redirect("/admin/pages?n=failed");
  const key = text(f, "key");
  const enabled = text(f, "enabled") === "1";
  const back = `/admin/pages/${templateSlug(template)}`;
  const res = await setSectionEnabled(getDb(), template, key, enabled, admin.id);
  if (!res.ok) redirect(`${back}?n=${res.kind === "locked" ? "section_locked" : "failed"}`);
  await audit({
    action: "cms.section.toggle", userId: admin.id, userEmail: admin.email, entityType: "page_section", entityId: `${template}.${key}`,
    summary: `${TEMPLATES[template].label} / ${key}: ${enabled ? "shown" : "hidden"}`, ipHash: await ipHash(h),
  });
  refreshPublic(template);
  redirect(`${back}?n=${enabled ? "section_shown" : "section_hidden"}`);
}

/** Saves a page's search settings: fields `template`, `seo` (JSON) and `expectedUpdatedAt`. */
export async function savePageSeoAction(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template)) return bad("Unknown page.");
  const seo = json(f, "seo");
  if (seo === undefined) return bad("The settings could not be read. Reload the page and try again.");
  const res = await savePageSeo(getDb(), template, seo, text(f, "expectedUpdatedAt"), admin.id);
  if (!res.ok) return res.kind === "invalid" ? { ok: false, kind: "invalid", errors: res.errors, nonce: nonce() } : { ok: false, kind: res.kind, nonce: nonce() };
  await audit({
    action: "cms.page.seo", userId: admin.id, userEmail: admin.email, entityType: "page", entityId: template,
    summary: `${TEMPLATES[template].label}: search settings ${res.changedFields.length ? `changed ${res.changedFields.join(", ")}` : "saved, nothing changed"}`, ipHash: await ipHash(h),
  });
  refreshPublic(template);
  return { ok: true, updatedAt: res.updatedAt, nonce: nonce() };
}
