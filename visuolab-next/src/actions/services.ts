"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { publishEntityDrafts, saveRecordAsDrafts, workingRecord } from "@/lib/server/entity-sections";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";
import {
  checkReferences, createService, deleteService, getServiceRecord, moveService, serviceReferences, setServiceStatus, slugInUse,
} from "@/lib/server/services-admin";
import { slugify } from "@/lib/slug";
import { STATUSES, serviceSchema, toErrors, type ServiceErrors, type ServiceInput } from "@/lib/validation/service";

/** Same two checks as every admin action: the request comes from this site, and the session belongs to an admin. */
async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();
  return { admin, h };
}

const ID_RE = /^svc_[0-9a-f-]{8,40}$|^svc_[a-z0-9-]{2,70}$/;
const LIST = "/admin/services";

/* ---- the form ------------------------------------------------------------------------------------------------- */

/** `nonce` is new on every answer, so the form knows to show the returned values again. */
export type ServiceFormState = { errors: ServiceErrors; values?: Record<string, unknown>; nonce: number } | undefined;
const fail = (errors: ServiceErrors, values: Record<string, unknown>): ServiceFormState => ({ errors, values, nonce: Date.now() + Math.random() });

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const json = (f: FormData, k: string, fallback: unknown) => {
  try {
    const v = JSON.parse(text(f, k));
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

/** The submitted fields as one object in the shape of ServiceInput (not yet checked). Also what the form shows again after an error. */
function readForm(f: FormData): Record<string, unknown> {
  return {
    title: text(f, "title"), slug: text(f, "slug"), status: text(f, "status"),
    metaTitle: text(f, "metaTitle"), metaDescription: text(f, "metaDescription"),
    heroTitle: text(f, "heroTitle"), heroLead: text(f, "heroLead"), heroCtaLabel: text(f, "heroCtaLabel"), heroCtaHref: text(f, "heroCtaHref"),
    heroImageA: text(f, "heroImageA"), heroImageAAlt: text(f, "heroImageAAlt"), heroImageB: text(f, "heroImageB"), heroImageBAlt: text(f, "heroImageBAlt"),
    showProblems: f.get("showProblems") === "on",
    problems: { label: text(f, "problemsLabel"), title: text(f, "problemsTitle"), items: json(f, "problemsItems", []) },
    overview: { label: text(f, "overviewLabel"), title: text(f, "overviewTitle"), blocks: json(f, "overviewBlocks", []) },
    outcomes: { label: text(f, "outcomesLabel"), title: text(f, "outcomesTitle"), items: json(f, "outcomesItems", []) },
    showBand: f.get("showBand") === "on",
    band: { text: text(f, "bandText"), ctaLabel: text(f, "bandCtaLabel"), ctaHref: text(f, "bandCtaHref") },
    included: { label: text(f, "includedLabel"), title: text(f, "includedTitle"), items: json(f, "includedItems", []) },
    process: { label: text(f, "processLabel"), title: text(f, "processTitle"), steps: json(f, "processSteps", []) },
    casesLabel: text(f, "casesLabel"), casesTitle: text(f, "casesTitle"), caseIds: json(f, "caseIds", []),
  };
}

/** Create (no id) or save (id) a service. Checks everything on the server; the browser's checks are only a convenience. */
export async function saveService(_prev: ServiceFormState, formData: FormData): Promise<ServiceFormState> {
  const { admin, h } = await guard();
  const id = text(formData, "id");
  const raw = readForm(formData);
  if (id && !ID_RE.test(id)) return fail({ form: "Unknown service." }, raw);

  const existing = id ? await getServiceRecord(id) : null;
  if (id && !existing) return fail({ form: "This service no longer exists. It may have been deleted in another window." }, raw);
  // The status of an existing service changes only through Publish / Unpublish / Archive, which have their own checks and confirmations.
  if (existing) raw.status = existing.input.status;
  else if (!(STATUSES as readonly string[]).includes(String(raw.status)) || raw.status === "archived") raw.status = "draft";
  raw.slug = slugify(String(raw.slug)) || String(raw.slug).trim().toLowerCase();

  const parsed = serviceSchema.safeParse(raw);
  const errors: ServiceErrors = parsed.success ? {} : toErrors(parsed.error);
  if (parsed.success) {
    if (await slugInUse(parsed.data.slug, id || undefined)) errors.slug = "Another service already uses this slug";
    Object.assign(errors, await checkReferences(parsed.data));
  } else if (typeof raw.slug === "string" && raw.slug && !errors.slug && (await slugInUse(String(raw.slug), id || undefined))) {
    errors.slug = "Another service already uses this slug";
  }
  if (Object.keys(errors).length) return fail(errors, raw);

  const input = parsed.data as ServiceInput;
  const ip = await ipHash(h);
  if (existing) {
    // the full form saves like the section editors: the parts of the page become drafts, the basics (slug, featured flag, ...) are written at once
    const r = await saveRecordAsDrafts({ kind: "service", id: existing.id, input: input as unknown as Record<string, unknown>, userId: admin.id });
    if (!r.ok) return fail(r.errors, raw);
    const oldSlug = r.oldSlug;
    const drafts = r.drafted.length ? `; draft changes in ${r.drafted.join(", ")}` : "";
    await audit({ action: r.basics.length ? "service.update" : "service.draft", userId: admin.id, userEmail: admin.email, entityType: "service", entityId: existing.id, summary: (oldSlug ? `Updated "${input.title}"; slug ${oldSlug} to ${input.slug}` : `Updated "${input.title}"`) + drafts, ipHash: ip });
    redirect(`${LIST}/${existing.id}/edit?n=${r.drafted.length || r.cleared.length ? "draft_saved" : "saved"}`);
  }
  const newId = await createService(input);
  await audit({ action: "service.create", userId: admin.id, userEmail: admin.email, entityType: "service", entityId: newId, summary: `Created "${input.title}" (${input.status})`, ipHash: ip });
  redirect(`${LIST}/${newId}/edit?n=created`);
}

/* ---- status, order, delete ------------------------------------------------------------------------------------ */

const idOf = (f: FormData) => {
  const id = text(f, "id");
  return ID_RE.test(id) ? id : null;
};

/** Publish: the stored content must pass the same checks as the form, so an incomplete draft cannot go live. */
export async function publishService(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getServiceRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  // publishing publishes the draft changes with it, so the whole page as the editor sees it must pass the same checks as the form
  const working = await workingRecord("service", id);
  const check = serviceSchema.safeParse({ ...(working?.input ?? rec.input), status: "published" });
  const refs = check.success ? await checkReferences(check.data) : {};
  if (!check.success || Object.keys(refs).length) redirect(`${LIST}/${id}/edit?n=cannot_publish`);
  const pub = await publishEntityDrafts({ kind: "service", id, userId: admin.id });
  if (Object.keys(pub.errors).length) redirect(`${LIST}/${id}/edit?n=cannot_publish`);
  await setServiceStatus(id, "published");
  await audit({ action: "service.publish", userId: admin.id, userEmail: admin.email, entityType: "service", entityId: id, summary: `Published "${rec.input.title}"${pub.published.length ? ` with the changes in ${pub.published.join(", ")}` : ""}`, ipHash: await ipHash(h) });
  redirect(`${text(formData, "back") === "edit" ? `${LIST}/${id}/edit` : text(formData, "back") === "overview" ? `${LIST}/${id}` : LIST}?n=published`);
}

/**
 * Hide a published service (back to draft, or archive). Its public address stops working, so when anything links to it the
 * editor must type the slug first; the check is repeated here, not only in the browser.
 */
export async function unpublishService(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getServiceRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const to = text(formData, "to") === "archived" ? "archived" : "draft";
  if (rec.input.status === "published") {
    const refs = await serviceReferences(rec.input.slug, id);
    if (refs.length > 0 && text(formData, "confirmSlug").trim() !== rec.input.slug) redirect(`${LIST}/${id}/confirm?do=unpublish&to=${to}&n=confirm_needed`);
  }
  await setServiceStatus(id, to);
  await audit({ action: "service.unpublish", userId: admin.id, userEmail: admin.email, entityType: "service", entityId: id, summary: `Set "${rec.input.title}" to ${to}`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=unpublished`);
}

/** Delete a service for good. A published service, or one that is linked from elsewhere, needs its slug typed first (enforced here). */
export async function removeService(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getServiceRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const refs = await serviceReferences(rec.input.slug, id);
  if ((rec.input.status === "published" || refs.length > 0) && text(formData, "confirmSlug").trim() !== rec.input.slug) redirect(`${LIST}/${id}/confirm?do=delete&n=confirm_needed`);
  await deleteService(id);
  await audit({ action: "service.delete", userId: admin.id, userEmail: admin.email, entityType: "service", entityId: id, summary: `Deleted "${rec.input.title}" (${rec.input.slug}, was ${rec.input.status}, ${refs.length} link(s))`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=removed`);
}

export async function reorderService(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const dir = text(formData, "dir") === "up" ? "up" : "down";
  if (!id) redirect(`${LIST}?n=failed`);
  const moved = await moveService(id, dir);
  if (moved) await audit({ action: "service.reorder", userId: admin.id, userEmail: admin.email, entityType: "service", entityId: id, summary: `Moved ${dir}`, ipHash: await ipHash(h) });
  redirect(moved ? `${LIST}?n=moved` : LIST);
}
