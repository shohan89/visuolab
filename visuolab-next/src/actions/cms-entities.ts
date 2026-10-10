"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ENTITIES, type EntityKind } from "@/lib/cms/entity";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { discardEntityDrafts, entitySection, getEntityRevision, loadEntity, publishEntityDrafts, saveEntitySection, saveEntitySectionLive, setEntitySectionEnabled } from "@/lib/server/entity-sections";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";
import type { CmsFormState } from "./cms-pages";

/*
 * Server actions of the section editors of services, case studies and articles. Same doors as every admin action: the request must come from this
 * site, the session must belong to an admin, and the content is checked by the section's strict schema and then by the schema of the whole record
 * (src/lib/server/entity-sections.ts) before anything is written.
 */

const nonce = () => Date.now() + Math.random();
const text = (f: FormData, k: string) => String(f.get(k) ?? "");

async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();
  return { admin, h };
}

const ID_PREFIX: Record<EntityKind, string> = { service: "svc_", case_study: "case_", blog_post: "post_" };
const isKind = (v: string): v is EntityKind => Object.prototype.hasOwnProperty.call(ENTITIES, v);
const validId = (kind: EntityKind, id: string) => id.startsWith(ID_PREFIX[kind]) && /^[A-Za-z0-9_-]{4,90}$/.test(id);
const bad = (message: string): CmsFormState => ({ ok: false, kind: "invalid", errors: { form: message }, nonce: nonce() });

/** Tells Next that the pages that show this record changed (the content version bumped by the audit entry is what refreshes the cached HTML). */
function refreshPublic(kind: EntityKind, slug: string | null) {
  try {
    const info = ENTITIES[kind];
    if (slug) revalidatePath(info.route(slug));
    revalidatePath(info.listing);
    revalidatePath("/"); // cards on Home
    if (kind === "case_study") revalidatePath("/services/[slug]", "page"); // the case study card on service pages
  } catch { /* the content version already invalidates the cache */ }
}

/** Saves the content of one section as a DRAFT (the website keeps showing the published content): fields `kind`, `id`, `key`, `content` (JSON) and `expectedUpdatedAt`. */
export async function saveEntitySectionAction(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const kind = text(f, "kind");
  const id = text(f, "id");
  const key = text(f, "key");
  if (!isKind(kind) || !validId(kind, id) || !entitySection(kind, key)) return bad("Unknown page or section.");
  let content: unknown;
  try { content = JSON.parse(text(f, "content")); } catch { return bad("The content could not be read. Reload the page and try again."); }

  const res = await saveEntitySection({ kind, id, key, content, expectedUpdatedAt: text(f, "expectedUpdatedAt"), userId: admin.id });
  if (!res.ok) return res.kind === "invalid" ? { ok: false, kind: "invalid", errors: res.errors, nonce: nonce() } : { ok: false, kind: res.kind, nonce: nonce() };

  const rec = await loadEntity(kind, id);
  const info = ENTITIES[kind];
  const sec = entitySection(kind, key);
  await audit({
    action: `${info.auditType}.section.draft`, userId: admin.id, userEmail: admin.email, entityType: info.auditType, entityId: id,
    summary: `${rec?.input.slug ?? id} / ${sec?.name ?? key}: ${res.draft ? `saved as a draft; changed ${res.changedFields.join(", ") || "nothing"}` : "draft cleared (same as the published content)"}`, ipHash: await ipHash(h),
  });
  return { ok: true, updatedAt: res.updatedAt, nonce: nonce(), draft: !!res.draft };
}

/** Puts an earlier version of a section back: fields `kind`, `id`, `key`, `revisionId`, `expectedUpdatedAt`. An ordinary save of that content, marked as a restore, and audited. */
export async function restoreEntitySectionAction(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const kind = text(f, "kind");
  const id = text(f, "id");
  const key = text(f, "key");
  if (!isKind(kind) || !validId(kind, id) || !entitySection(kind, key)) return bad("Unknown page or section.");
  const rev = await getEntityRevision(kind, id, key, text(f, "revisionId"));
  if (!rev) return bad("That version can no longer be restored: it is not a version of this section, or it does not fit the section any more.");
  const res = await saveEntitySectionLive({ kind, id, key, content: rev.content, expectedUpdatedAt: text(f, "expectedUpdatedAt"), userId: admin.id, mode: "restore" });
  if (!res.ok) return res.kind === "invalid" ? { ok: false, kind: "invalid", errors: res.errors, nonce: nonce() } : { ok: false, kind: res.kind, nonce: nonce() };
  await discardEntityDrafts(kind, id, [key]); // the restored content is the published content now
  const rec = await loadEntity(kind, id);
  const info = ENTITIES[kind];
  await audit({
    action: `${info.auditType}.section.restore`, userId: admin.id, userEmail: admin.email, entityType: info.auditType, entityId: id,
    summary: `${rec?.input.slug ?? id} / ${entitySection(kind, key)?.name ?? key}: restored the version replaced on ${rev.replacedAt.slice(0, 16).replace("T", " ")} UTC${res.changedFields.length ? `; changed ${res.changedFields.join(", ")}` : "; nothing changed"}`, ipHash: await ipHash(h),
  });
  refreshPublic(kind, rec?.input.slug ?? null);
  return { ok: true, updatedAt: res.updatedAt, nonce: nonce() };
}

/**
 * Shows or hides a section: fields `kind`, `id`, `key`, `enabled` ("1" or "0") and, for important sections, `confirm` ("1"). The section's content is
 * never touched. Goes back to the record's screen with a message.
 */
export async function setEntitySectionVisibility(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const kind = text(f, "kind");
  const id = text(f, "id");
  const key = text(f, "key");
  if (!isKind(kind) || !validId(kind, id)) redirect("/admin?n=failed");
  const info = ENTITIES[kind];
  const back = `${info.admin}/${id}`;
  const enabled = text(f, "enabled") === "1";
  const res = await setEntitySectionEnabled({ kind, id, key, on: enabled, confirmed: text(f, "confirm") === "1", userId: admin.id });
  if (!res.ok) redirect(`${back}?n=${res.kind === "locked" ? "section_locked" : res.kind === "confirm" ? "section_confirm" : res.kind === "invalid" ? "section_incomplete" : "failed"}`);
  if (res.changed) {
    const rec = await loadEntity(kind, id);
    await audit({
      action: `${info.auditType}.section.toggle`, userId: admin.id, userEmail: admin.email, entityType: info.auditType, entityId: id,
      summary: `${rec?.input.slug ?? id} / ${entitySection(kind, key)?.name ?? key}: ${enabled ? "shown" : "hidden"}`, ipHash: await ipHash(h),
    });
    refreshPublic(kind, rec?.input.slug ?? null);
  }
  redirect(`${back}?n=${enabled ? "section_shown" : "section_hidden"}`);
}

/* ---- publishing and discarding drafts ---------------------------------------------------------------------------------------- */

const firstMessage = (errors: Record<string, unknown>): string => {
  for (const [k, v] of Object.entries(errors)) {
    if (v === "conflict") return `${k}: it was changed by someone else.`;
    if (v === "missing") return `${k}: it no longer exists.`;
    if (v && typeof v === "object") { const e = Object.entries(v as Record<string, string>)[0]; if (e) return `${k}: ${e[1]}`; }
  }
  return "Nothing could be published.";
};

async function publishCore(kind: EntityKind, id: string, keys: readonly string[] | undefined, admin: { id: string; email: string }, h: Headers) {
  const res = await publishEntityDrafts({ kind, id, userId: admin.id, ...(keys ? { keys } : {}) });
  if (res.published.length) {
    const rec = await loadEntity(kind, id);
    const info = ENTITIES[kind];
    await audit({
      action: `${info.auditType}.publish_changes`, userId: admin.id, userEmail: admin.email, entityType: info.auditType, entityId: id,
      summary: `${rec?.input.slug ?? id}: published ${res.published.join(", ")}${Object.keys(res.errors).length ? `; not published: ${Object.keys(res.errors).join(", ")}` : ""}`, ipHash: await ipHash(h),
    });
    refreshPublic(kind, rec?.input.slug ?? null);
  }
  return res;
}

/** Publishes the draft of one section: fields `kind`, `id`, `key`. Used by the section editor. */
export async function publishEntitySectionAction(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const kind = text(f, "kind");
  const id = text(f, "id");
  const key = text(f, "key");
  if (!isKind(kind) || !validId(kind, id) || !entitySection(kind, key)) return bad("Unknown page or section.");
  const res = await publishCore(kind, id, [key], admin, h);
  if (Object.keys(res.errors).length) return bad(`Could not publish: ${firstMessage(res.errors)}`);
  if (!res.published.length) return bad("This section has no unpublished changes.");
  return { ok: true, updatedAt: "", nonce: nonce() };
}

/** Throws away the draft of one section: fields `kind`, `id`, `key`. */
export async function discardEntitySectionAction(_prev: CmsFormState, f: FormData): Promise<CmsFormState> {
  const { admin, h } = await guard();
  const kind = text(f, "kind");
  const id = text(f, "id");
  const key = text(f, "key");
  if (!isKind(kind) || !validId(kind, id) || !entitySection(kind, key)) return bad("Unknown page or section.");
  const gone = await discardEntityDrafts(kind, id, [key]);
  if (gone.length) {
    const rec = await loadEntity(kind, id);
    await audit({ action: `${ENTITIES[kind].auditType}.section.draft.discard`, userId: admin.id, userEmail: admin.email, entityType: ENTITIES[kind].auditType, entityId: id, summary: `${rec?.input.slug ?? id} / ${entitySection(kind, key)?.name ?? key}: draft discarded`, ipHash: await ipHash(h) });
  }
  return { ok: true, updatedAt: "", nonce: nonce() };
}

/** Publishes every draft of a record (it keeps its status): fields `kind`, `id`. */
export async function publishEntityChangesAction(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const kind = text(f, "kind");
  const id = text(f, "id");
  if (!isKind(kind) || !validId(kind, id)) redirect("/admin?n=failed");
  const res = await publishCore(kind, id, undefined, admin, h);
  redirect(`${ENTITIES[kind].admin}/${id}?n=${Object.keys(res.errors).length ? "publish_failed" : res.published.length ? "changes_published" : "nothing_to_publish"}`);
}

/** Throws away every draft of a record: fields `kind`, `id`. */
export async function discardEntityChangesAction(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const kind = text(f, "kind");
  const id = text(f, "id");
  if (!isKind(kind) || !validId(kind, id)) redirect("/admin?n=failed");
  const gone = await discardEntityDrafts(kind, id);
  if (gone.length) {
    const rec = await loadEntity(kind, id);
    await audit({ action: `${ENTITIES[kind].auditType}.draft.discard`, userId: admin.id, userEmail: admin.email, entityType: ENTITIES[kind].auditType, entityId: id, summary: `${rec?.input.slug ?? id}: discarded the drafts of ${gone.join(", ")}`, ipHash: await ipHash(h) });
  }
  redirect(`${ENTITIES[kind].admin}/${id}?n=draft_discarded`);
}
