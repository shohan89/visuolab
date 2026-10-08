"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ENTITIES, type EntityKind } from "@/lib/cms/entity";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { entitySection, loadEntity, saveEntitySection, setEntitySectionEnabled } from "@/lib/server/entity-sections";
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

/** Saves the content of one section: fields `kind`, `id`, `key`, `content` (JSON) and `expectedUpdatedAt`. */
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
    action: `${info.auditType}.section`, userId: admin.id, userEmail: admin.email, entityType: info.auditType, entityId: id,
    summary: `${rec?.input.slug ?? id} / ${sec?.name ?? key}: ${res.changedFields.length ? `changed ${res.changedFields.join(", ")}` : "saved, nothing changed"}`, ipHash: await ipHash(h),
  });
  refreshPublic(kind, rec?.input.slug ?? null);
  return { ok: true, updatedAt: res.updatedAt, nonce: nonce() };
}

/** Shows or hides a section the design can hide: fields `kind`, `id`, `key`, `enabled` ("1" or "0"). Goes back to the record's screen with a message. */
export async function setEntitySectionVisibility(f: FormData): Promise<void> {
  const { admin, h } = await guard();
  const kind = text(f, "kind");
  const id = text(f, "id");
  const key = text(f, "key");
  if (!isKind(kind) || !validId(kind, id)) redirect("/admin?n=failed");
  const info = ENTITIES[kind];
  const back = `${info.admin}/${id}`;
  const enabled = text(f, "enabled") === "1";
  const res = await setEntitySectionEnabled(kind, id, key, enabled);
  if (!res.ok) redirect(`${back}?n=${res.kind === "locked" ? "section_locked" : res.kind === "invalid" ? "section_incomplete" : "failed"}`);
  const rec = await loadEntity(kind, id);
  await audit({
    action: `${info.auditType}.section.toggle`, userId: admin.id, userEmail: admin.email, entityType: info.auditType, entityId: id,
    summary: `${rec?.input.slug ?? id} / ${entitySection(kind, key)?.name ?? key}: ${enabled ? "shown" : "hidden"}`, ipHash: await ipHash(h),
  });
  refreshPublic(kind, rec?.input.slug ?? null);
  redirect(`${back}?n=${enabled ? "section_shown" : "section_hidden"}`);
}
