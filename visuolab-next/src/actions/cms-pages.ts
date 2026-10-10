"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";
import { TEMPLATES, slotOf, templateSlug, type SectionErrors } from "@/lib/cms/registry";
import { discardPageDrafts, getRevisionContent, hasDrafts, publishPageDrafts, savePageSeo, saveSectionContent, saveSectionDraft, setPageStatus, setSectionEnabled } from "@/lib/cms/store";
import type { PageTemplate } from "@/lib/cms/types";

/*
 * Server actions of the page CMS. No screen calls them yet; they are the one door to the content: the request must come from this site, the
 * session must belong to an admin (read from the database on every call), and the content is checked against the strict schema of its section
 * (src/lib/cms/sections) before anything is written.
 */

/** `nonce` is new on every answer, so a form knows to show the returned errors again. */
export type CmsFormState =
  | { ok: true; updatedAt: string; nonce: number; /** saved as a draft (not live) */ draft?: boolean }
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
  if (hasDrafts(template)) {
    // a page with its own address: the change is a DRAFT; the public page keeps showing the published content until it is published
    const d = await saveSectionDraft(getDb(), { template, key, content, expectedUpdatedAt: text(f, "expectedUpdatedAt"), userId: admin.id });
    if (!d.ok) return d.kind === "invalid" ? { ok: false, kind: "invalid", errors: d.errors, nonce: nonce() } : { ok: false, kind: d.kind, nonce: nonce() };
    await audit({
      action: "cms.section.draft", userId: admin.id, userEmail: admin.email, entityType: "page_section", entityId: `${template}.${key}`,
      summary: `${TEMPLATES[template].label} / ${key}: ${d.draft ? `saved as a draft; changed ${d.changedFields.join(", ") || "nothing"}` : "draft cleared (same as the published content)"}`, ipHash: await ipHash(h),
    });
    return { ok: true, updatedAt: d.updatedAt, nonce: nonce(), draft: d.draft };
  }
  const res = await saveSectionContent(getDb(), { template, key, content, expectedUpdatedAt: text(f, "expectedUpdatedAt"), userId: admin.id });
  if (!res.ok) return res.kind === "invalid" ? { ok: false, kind: "invalid", errors: res.errors, nonce: nonce() } : { ok: false, kind: res.kind, nonce: nonce() };
  await audit({
    action: "cms.section.update", userId: admin.id, userEmail: admin.email, entityType: "page_section", entityId: `${template}.${key}`,
    summary: `${TEMPLATES[template].label} / ${key}: ${res.changedFields.length ? `changed ${res.changedFields.join(", ")}` : "saved, nothing changed"}`, ipHash: await ipHash(h),
  });
  refreshPublic(template);
  return { ok: true, updatedAt: res.updatedAt, nonce: nonce() };
}

/**
 * Puts an earlier version of a section back: fields `template`, `key`, `revisionId` and `expectedUpdatedAt`. It is an ordinary save of that content
 * (same checks, same version token, the current content is kept as a new previous version) marked as a restore, and it is audited.
 */
export async function restoreSection(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template)) return bad("Unknown page.");
  const key = text(f, "key");
  const rev = await getRevisionContent(getDb(), template, key, text(f, "revisionId"));
  if (!rev) return bad("That version can no longer be restored: it is not a version of this section, or it does not fit the section any more.");
  const res = await saveSectionContent(getDb(), { template, key, content: rev.content, expectedUpdatedAt: text(f, "expectedUpdatedAt"), userId: admin.id, kind: "restore" });
  if (!res.ok) return res.kind === "invalid" ? { ok: false, kind: "invalid", errors: res.errors, nonce: nonce() } : { ok: false, kind: res.kind, nonce: nonce() };
  await audit({
    action: "cms.section.restore", userId: admin.id, userEmail: admin.email, entityType: "page_section", entityId: `${template}.${key}`,
    summary: `${TEMPLATES[template].label} / ${key}: restored the version replaced on ${rev.replacedAt.slice(0, 16).replace("T", " ")} UTC${res.changedFields.length ? `; changed ${res.changedFields.join(", ")}` : "; nothing changed"}`, ipHash: await ipHash(h),
  });
  if (hasDrafts(template)) await discardPageDrafts(getDb(), template, [key]); // the restored content is the published content now
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
  const slot = slotOf(template, key);
  // an important section is only switched off when the editor confirmed (the screen asks; this is the check that counts)
  if (!enabled && slot?.confirm && text(f, "confirm") !== "1") redirect(`${back}?n=section_confirm`);
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

/* ---- publishing, discarding and the status of a page ---------------------------------------------------------------------------- */

async function publishCore(template: PageTemplate, keys: readonly string[] | undefined, admin: { id: string; email: string }, h: Headers) {
  const res = await publishPageDrafts(getDb(), template, admin.id, keys);
  if (res.published.length) {
    await audit({
      action: "cms.page.publish", userId: admin.id, userEmail: admin.email, entityType: "page", entityId: template,
      summary: `${TEMPLATES[template].label}: published ${res.published.join(", ")}${res.ok ? "" : `; not published: ${Object.keys(res.errors).join(", ")}`}`, ipHash: await ipHash(h),
    });
    refreshPublic(template);
  }
  return res;
}

const firstMessage = (errors: Record<string, unknown>): string => {
  for (const [k, v] of Object.entries(errors)) {
    if (v === "conflict") return `${k}: it was changed by someone else.`;
    if (v === "missing") return `${k}: it is not in the database.`;
    if (v && typeof v === "object") { const e = Object.entries(v as Record<string, string>)[0]; if (e) return `${k}: ${e[1]}`; }
  }
  return "Nothing could be published.";
};

/** Publishes the draft of one section: fields `template`, `key`. Used by the section editor. */
export async function publishSectionAction(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template) || !hasDrafts(template)) return bad("Unknown page.");
  const key = text(f, "key");
  const res = await publishCore(template, [key], admin, h);
  if (!res.ok) return bad(`Could not publish: ${firstMessage(res.errors)}`);
  if (!res.published.length) return bad("This section has no unpublished changes.");
  return { ok: true, updatedAt: "", nonce: nonce() };
}

/** Throws away the draft of one section: fields `template`, `key`. Used by the section editor. */
export async function discardSectionAction(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template) || !hasDrafts(template)) return bad("Unknown page.");
  const key = text(f, "key");
  const gone = await discardPageDrafts(getDb(), template, [key]);
  if (gone.length) await audit({ action: "cms.section.draft.discard", userId: admin.id, userEmail: admin.email, entityType: "page_section", entityId: `${template}.${key}`, summary: `${TEMPLATES[template].label} / ${key}: draft discarded`, ipHash: await ipHash(h) });
  return { ok: true, updatedAt: "", nonce: nonce() };
}

/** Publishes every draft of a page: field `template`. Goes back to the page's screen with a message. */
export async function publishPageAction(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template) || !hasDrafts(template)) redirect("/admin/pages?n=failed");
  const res = await publishCore(template, undefined, admin, h);
  redirect(`/admin/pages/${templateSlug(template)}?n=${!res.ok ? "publish_failed" : res.published.length ? "changes_published" : "nothing_to_publish"}`);
}

/** Throws away every draft of a page: field `template`. */
export async function discardPageAction(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template) || !hasDrafts(template)) redirect("/admin/pages?n=failed");
  const gone = await discardPageDrafts(getDb(), template);
  if (gone.length) await audit({ action: "cms.page.draft.discard", userId: admin.id, userEmail: admin.email, entityType: "page", entityId: template, summary: `${TEMPLATES[template].label}: discarded the drafts of ${gone.join(", ")}`, ipHash: await ipHash(h) });
  redirect(`/admin/pages/${templateSlug(template)}?n=draft_discarded`);
}

/** Publishes or unpublishes a page: fields `template`, `status` ("published" or "draft") and, for unpublishing, `confirm` ("1"). */
export async function setPageStatusAction(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const template = text(f, "template");
  if (!isTemplate(template)) redirect("/admin/pages?n=failed");
  const status = text(f, "status") === "published" ? "published" : "draft";
  const back = `/admin/pages/${templateSlug(template)}`;
  if (status === "draft" && text(f, "confirm") !== "1") redirect(`${back}?n=section_confirm`);
  const res = await setPageStatus(getDb(), template, status, admin.id);
  if (!res.ok) redirect(`${back}?n=${res.kind === "locked" ? "page_locked" : "failed"}`);
  if (res.changed) {
    await audit({ action: "cms.page.status", userId: admin.id, userEmail: admin.email, entityType: "page", entityId: template, summary: `${TEMPLATES[template].label}: ${status === "published" ? "published" : "unpublished"}`, ipHash: await ipHash(h) });
    refreshPublic(template);
  }
  redirect(`${back}?n=${status === "published" ? "page_published" : "page_unpublished"}`);
}
