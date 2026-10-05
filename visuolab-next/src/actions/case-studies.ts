"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import {
  caseReferences, caseSlugInUse, checkCaseReferences, createCaseStudy, deleteCaseStudy, getCaseRecord, moveCaseStudy, setCaseFeatured, setCaseStatus, updateCaseStudy,
} from "@/lib/server/case-studies-admin";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";
import { slugify } from "@/lib/slug";
import { STATUSES, caseStudySchema, toErrors, type CaseStudyInput } from "@/lib/validation/case-study";

/** Same two checks as every admin action: the request comes from this site, and the session belongs to an admin. */
async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();
  return { admin, h };
}

const ID_RE = /^case_[0-9a-f-]{8,40}$|^case_[a-z0-9-]{2,70}$/;
const LIST = "/admin/case-studies";

/** `nonce` is new on every answer, so the form knows to show the returned values again. */
export type CaseFormState = { errors: Record<string, string>; values?: Record<string, unknown>; nonce: number } | undefined;
const fail = (errors: Record<string, string>, values: Record<string, unknown>): CaseFormState => ({ errors, values, nonce: Date.now() + Math.random() });

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const json = (f: FormData, k: string, fallback: unknown) => {
  try {
    return JSON.parse(text(f, k)) ?? fallback;
  } catch {
    return fallback;
  }
};

/** The submitted fields as one object in the shape of CaseStudyInput (not yet checked). Also what the form shows again after an error. */
function readForm(f: FormData): Record<string, unknown> {
  return {
    title: text(f, "title"), slug: text(f, "slug"), status: text(f, "status"), featured: f.get("featured") === "on",
    clientName: text(f, "clientName"), clientFull: text(f, "clientFull"), industry: text(f, "industry"), services: text(f, "services"), year: text(f, "year"), timeline: text(f, "timeline"),
    typeLine: text(f, "typeLine"), shortKind: text(f, "shortKind"), cardTags: json(f, "cardTags", []), filters: f.getAll("filters").map(String),
    cardImage: text(f, "cardImage"), cardImageAlt: text(f, "cardImageAlt"), coverImage: text(f, "coverImage"), coverImageAlt: text(f, "coverImageAlt"),
    metaTitle: text(f, "metaTitle"), metaDescription: text(f, "metaDescription"),
    aboutLabel: text(f, "aboutLabel"), description: text(f, "description"), stats: json(f, "stats", []),
    galleryA: json(f, "galleryA", []),
    process: { label: text(f, "processLabel"), title: text(f, "processTitle"), steps: json(f, "processSteps", []) },
    galleryB: json(f, "galleryB", []),
    challenges: { label: text(f, "challengesLabel"), title: text(f, "challengesTitle"), items: json(f, "challengesItems", []) },
    wide: { media: text(f, "wideMedia"), caption: text(f, "wideCaption"), alt: text(f, "wideAlt"), position: text(f, "widePosition") },
    results: { label: text(f, "resultsLabel"), title: text(f, "resultsTitle"), items: json(f, "resultsItems", []) },
    more: { label: text(f, "moreLabel"), title: text(f, "moreTitle"), slugs: json(f, "moreSlugs", []) },
    showcase: {
      title: text(f, "showcaseTitle"), tags: json(f, "showcaseTags", []), variant: text(f, "showcaseVariant"),
      results: json(f, "showcaseResults", []),
      quote: { source: text(f, "quoteSource"), text: text(f, "quoteText"), avatar: text(f, "quoteAvatar"), name: text(f, "quoteName"), role: text(f, "quoteRole") },
    },
    serviceIds: f.getAll("serviceIds").map(String),
  };
}

/** Create (no id) or save (id) a case study. Everything is checked here; the browser's checks are only a convenience. */
export async function saveCaseStudy(_prev: CaseFormState, formData: FormData): Promise<CaseFormState> {
  const { admin, h } = await guard();
  const id = text(formData, "id");
  const raw = readForm(formData);
  if (id && !ID_RE.test(id)) return fail({ form: "Unknown case study." }, raw);

  const existing = id ? await getCaseRecord(id) : null;
  if (id && !existing) return fail({ form: "This case study no longer exists. It may have been deleted in another window." }, raw);
  // The status of an existing case study changes only through Publish / Unpublish / Archive, which have their own checks and confirmations.
  if (existing) raw.status = existing.input.status;
  else if (!(STATUSES as readonly string[]).includes(String(raw.status)) || raw.status === "archived") raw.status = "draft";
  if (existing && Array.isArray(raw.filters)) {
    // keep the order the filters already had (it is the order of the data-tags on the card); new ones go last
    const picked = raw.filters as string[];
    const had: string[] = existing.input.filters;
    raw.filters = [...had.filter((x) => picked.includes(x)), ...picked.filter((x) => !had.includes(x))];
  }
  raw.slug = slugify(String(raw.slug)) || String(raw.slug).trim().toLowerCase();

  const parsed = caseStudySchema.safeParse(raw);
  const errors: Record<string, string> = parsed.success ? {} : toErrors(parsed.error);
  if (parsed.success) {
    if (await caseSlugInUse(parsed.data.slug, id || undefined)) errors.slug = "Another case study already uses this slug";
    Object.assign(errors, await checkCaseReferences(parsed.data));
  } else if (typeof raw.slug === "string" && raw.slug && !errors.slug && (await caseSlugInUse(String(raw.slug), id || undefined))) {
    errors.slug = "Another case study already uses this slug";
  }
  if (Object.keys(errors).length) return fail(errors, raw);

  const input = parsed.data as CaseStudyInput;
  const ip = await ipHash(h);
  if (existing) {
    const { oldSlug } = await updateCaseStudy(existing.id, input);
    await audit({ action: "case.update", userId: admin.id, userEmail: admin.email, entityType: "case_study", entityId: existing.id, summary: oldSlug ? `Updated "${input.clientName}"; slug ${oldSlug} to ${input.slug}` : `Updated "${input.clientName}"`, ipHash: ip });
    redirect(`${LIST}/${existing.id}/edit?n=saved`);
  }
  const newId = await createCaseStudy(input);
  await audit({ action: "case.create", userId: admin.id, userEmail: admin.email, entityType: "case_study", entityId: newId, summary: `Created "${input.clientName}" (${input.status})`, ipHash: ip });
  redirect(`${LIST}/${newId}/edit?n=created`);
}

/* ---- status, featured, order, delete -------------------------------------------------------------------------- */

const idOf = (f: FormData) => {
  const id = text(f, "id");
  return ID_RE.test(id) ? id : null;
};
const back = (f: FormData, id: string) => (text(f, "back") === "edit" ? `${LIST}/${id}/edit` : LIST);

/** Publish: the stored content must pass the same checks as the form, so an incomplete draft cannot go live. */
export async function publishCaseStudy(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getCaseRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const check = caseStudySchema.safeParse({ ...rec.input, status: "published" });
  const refs = check.success ? await checkCaseReferences(check.data) : {};
  if (!check.success || Object.keys(refs).length) redirect(`${LIST}/${id}/edit?n=cannot_publish`);
  await setCaseStatus(id, "published");
  await audit({ action: "case.publish", userId: admin.id, userEmail: admin.email, entityType: "case_study", entityId: id, summary: `Published "${rec.input.clientName}"`, ipHash: await ipHash(h) });
  redirect(`${back(formData, id)}?n=published`);
}

/** Hide a published case study (draft or archive). Its address stops working, so when anything links to it the slug must be typed first. */
export async function unpublishCaseStudy(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getCaseRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const to = text(formData, "to") === "archived" ? "archived" : "draft";
  if (rec.input.status === "published") {
    const refs = await caseReferences(rec.input.slug, id);
    if (refs.length > 0 && text(formData, "confirmSlug").trim() !== rec.input.slug) redirect(`${LIST}/${id}/confirm?do=unpublish&to=${to}&n=confirm_needed`);
  }
  await setCaseStatus(id, to);
  await audit({ action: "case.unpublish", userId: admin.id, userEmail: admin.email, entityType: "case_study", entityId: id, summary: `Set "${rec.input.clientName}" to ${to}`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=unpublished`);
}

/** Delete for good. A published case study, or one that is linked from elsewhere, needs its slug typed first (enforced here). */
export async function removeCaseStudy(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getCaseRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const refs = await caseReferences(rec.input.slug, id);
  if ((rec.input.status === "published" || refs.length > 0) && text(formData, "confirmSlug").trim() !== rec.input.slug) redirect(`${LIST}/${id}/confirm?do=delete&n=confirm_needed`);
  await deleteCaseStudy(id);
  await audit({ action: "case.delete", userId: admin.id, userEmail: admin.email, entityType: "case_study", entityId: id, summary: `Deleted "${rec.input.clientName}" (${rec.input.slug}, was ${rec.input.status}, ${refs.length} link(s))`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=removed`);
}

export async function toggleFeatured(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getCaseRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const next = !rec.input.featured;
  await setCaseFeatured(id, next);
  await audit({ action: "case.featured", userId: admin.id, userEmail: admin.email, entityType: "case_study", entityId: id, summary: `${next ? "Featured" : "Unfeatured"} "${rec.input.clientName}"`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=${next ? "featured" : "unfeatured"}`);
}

export async function reorderCaseStudy(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const dir = text(formData, "dir") === "up" ? "up" : "down";
  if (!id) redirect(`${LIST}?n=failed`);
  const moved = await moveCaseStudy(id, dir);
  if (moved) await audit({ action: "case.reorder", userId: admin.id, userEmail: admin.email, entityType: "case_study", entityId: id, summary: `Moved ${dir}`, ipHash: await ipHash(h) });
  redirect(moved ? `${LIST}?n=moved` : LIST);
}
