"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import {
  categorySlugInUse, checkPostReferences, createCategory, createPost, deleteCategory, deletePost, deleteTag, getPostRecord, listCategories, moveCategory, postReferences,
  postSlugInUse, publishPost, renameTag, setPostFeatured, setPostStatus, tagSlugInUse, updateCategory, visibilityOf,
} from "@/lib/server/blog-admin";
import { publishEntityDrafts, saveRecordAsDrafts, workingRecord } from "@/lib/server/entity-sections";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";
import { slugify } from "@/lib/slug";
import { STATUSES, blogSchema, toErrors, type BlogInput } from "@/lib/validation/blog";

/** Same two checks as every admin action: the request comes from this site, and the session belongs to an admin. */
async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();
  return { admin, h };
}

const ID_RE = /^post_[0-9a-f-]{8,40}$|^post_[a-z0-9-]{2,80}$/;
const LIST = "/admin/blog";

/** `nonce` is new on every answer, so the form knows to show the returned values again. */
export type BlogFormState = { errors: Record<string, string>; values?: Record<string, unknown>; nonce: number } | undefined;
const fail = (errors: Record<string, string>, values: Record<string, unknown>): BlogFormState => ({ errors, values, nonce: Date.now() + Math.random() });

const text = (f: FormData, k: string) => String(f.get(k) ?? "");
const json = (f: FormData, k: string, fallback: unknown) => {
  try {
    return JSON.parse(text(f, k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const localNow = () => new Date().toISOString().slice(0, 16);

/** The submitted fields as one object in the shape of BlogInput (not yet checked). Also what the form shows again after an error. */
function readForm(f: FormData): Record<string, unknown> {
  const minutes = text(f, "readMinutes").trim();
  return {
    title: text(f, "title"), slug: text(f, "slug"), status: text(f, "status"), featured: f.get("featured") === "on", categoryId: text(f, "categoryId"), tags: json(f, "tags", []),
    excerpt: text(f, "excerpt"), lead: text(f, "lead"), blocks: json(f, "blocks", []),
    outro: { before: text(f, "outroBefore"), linkText: text(f, "outroLinkText"), href: text(f, "outroHref"), after: text(f, "outroAfter") },
    related: json(f, "related", []),
    coverImage: text(f, "coverImage"), coverAlt: text(f, "coverAlt"), ogImage: text(f, "ogImage"), canonicalUrl: text(f, "canonicalUrl"),
    metaTitle: text(f, "metaTitle"), metaDescription: text(f, "metaDescription"), authorName: text(f, "authorName"), authorImage: text(f, "authorImage"),
    readMinutes: minutes === "" ? null : Number(minutes), publishedAt: text(f, "publishedAt"),
  };
}

/** Create (no id) or save (id) an article. Everything is checked here; the browser's checks are only a convenience. */
export async function saveBlogPost(_prev: BlogFormState, formData: FormData): Promise<BlogFormState> {
  const { admin, h } = await guard();
  const id = text(formData, "id");
  const raw = readForm(formData);
  if (id && !ID_RE.test(id)) return fail({ form: "Unknown article." }, raw);

  const existing = id ? await getPostRecord(id) : null;
  if (id && !existing) return fail({ form: "This article no longer exists. It may have been deleted in another window." }, raw);
  // The status of an existing article changes only through Publish / Unpublish / Archive, which have their own checks and confirmations.
  if (existing) raw.status = existing.input.status;
  else if (!(STATUSES as readonly string[]).includes(String(raw.status)) || raw.status === "archived") raw.status = "draft";
  if (!existing && raw.status === "published" && !raw.publishedAt) raw.publishedAt = localNow();
  raw.slug = slugify(String(raw.slug)).slice(0, 80) || String(raw.slug).trim().toLowerCase();

  const parsed = blogSchema.safeParse(raw);
  const errors: Record<string, string> = parsed.success ? {} : toErrors(parsed.error);
  if (parsed.success) {
    if (await postSlugInUse(parsed.data.slug, id || undefined)) errors.slug = "Another article already uses this slug";
    Object.assign(errors, await checkPostReferences(parsed.data));
    // moving a live article's date into the future would take it offline without the usual confirmation
    if (existing && visibilityOf(existing.input.status, existing.publishedAt) === "live" && parsed.data.publishedAt && `${parsed.data.publishedAt}:00.000Z` > new Date().toISOString()) {
      errors.publishedAt = "This article is live. To take it offline use Unpublish; a future date is only for articles that are not live yet";
    }
  } else if (typeof raw.slug === "string" && raw.slug && !errors.slug && (await postSlugInUse(String(raw.slug), id || undefined))) {
    errors.slug = "Another article already uses this slug";
  }
  if (Object.keys(errors).length) return fail(errors, raw);

  const input = parsed.data as BlogInput;
  const ip = await ipHash(h);
  if (existing) {
    // the full form saves like the section editors: the parts of the page become drafts, the basics (slug, featured flag, ...) are written at once
    const r = await saveRecordAsDrafts({ kind: "blog_post", id: existing.id, input: input as unknown as Record<string, unknown>, userId: admin.id });
    if (!r.ok) return fail(r.errors, raw);
    const oldSlug = r.oldSlug;
    const drafts = r.drafted.length ? `; draft changes in ${r.drafted.join(", ")}` : "";
    await audit({ action: r.basics.length ? "blog.update" : "blog.draft", userId: admin.id, userEmail: admin.email, entityType: "blog_post", entityId: existing.id, summary: (oldSlug ? `Updated "${input.title}"; slug ${oldSlug} to ${input.slug}` : `Updated "${input.title}"`) + drafts, ipHash: ip });
    redirect(`${LIST}/${existing.id}/edit?n=${r.drafted.length || r.cleared.length ? "draft_saved" : "saved"}`);
  }
  const newId = await createPost(input);
  await audit({ action: "blog.create", userId: admin.id, userEmail: admin.email, entityType: "blog_post", entityId: newId, summary: `Created "${input.title}" (${input.status})`, ipHash: ip });
  redirect(`${LIST}/${newId}/edit?n=created`);
}

/* ---- status, featured, delete --------------------------------------------------------------------------------- */

const idOf = (f: FormData) => {
  const id = text(f, "id");
  return ID_RE.test(id) ? id : null;
};
const back = (f: FormData, id: string) => (text(f, "back") === "edit" ? `${LIST}/${id}/edit` : text(f, "back") === "overview" ? `${LIST}/${id}` : LIST);

/** Publish: the saved article must pass the same checks as the form. With a future publish date it is scheduled and appears by itself. */
export async function publishBlogPost(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getPostRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  // publishing publishes the draft changes with it, so the whole article as the editor sees it must pass the same checks as the form
  const working = (await workingRecord("blog_post", id))?.input as BlogInput | undefined;
  const planned = working?.publishedAt || rec.input.publishedAt || localNow();
  const check = blogSchema.safeParse({ ...(working ?? rec.input), status: "published", publishedAt: planned });
  const refs = check.success ? await checkPostReferences(check.data) : {};
  if (!check.success || Object.keys(refs).length) redirect(`${LIST}/${id}/edit?n=cannot_publish`);
  const pub = await publishEntityDrafts({ kind: "blog_post", id, userId: admin.id });
  if (Object.keys(pub.errors).length) redirect(`${LIST}/${id}/edit?n=cannot_publish`);
  await publishPost(id);
  const scheduled = `${planned}:00.000Z` > new Date().toISOString();
  await audit({ action: scheduled ? "blog.schedule" : "blog.publish", userId: admin.id, userEmail: admin.email, entityType: "blog_post", entityId: id, summary: `${scheduled ? "Scheduled" : "Published"} "${rec.input.title}"${scheduled ? ` for ${planned} UTC` : ""}`, ipHash: await ipHash(h) });
  redirect(`${back(formData, id)}?n=${scheduled ? "scheduled" : "published"}`);
}

/** Take a live article offline (draft or archive). When anything links to it the slug must be typed first; checked here again. */
export async function unpublishBlogPost(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getPostRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const to = text(formData, "to") === "archived" ? "archived" : "draft";
  if (visibilityOf(rec.input.status, rec.publishedAt) === "live") {
    const refs = await postReferences(rec.input.slug, id);
    if (refs.length > 0 && text(formData, "confirmSlug").trim() !== rec.input.slug) redirect(`${LIST}/${id}/confirm?do=unpublish&to=${to}&n=confirm_needed`);
  }
  await setPostStatus(id, to);
  await audit({ action: "blog.unpublish", userId: admin.id, userEmail: admin.email, entityType: "blog_post", entityId: id, summary: `Set "${rec.input.title}" to ${to}`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=unpublished`);
}

/** Delete for good. A live article, or one that is linked from elsewhere, needs its slug typed first (enforced here). */
export async function removeBlogPost(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getPostRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const refs = await postReferences(rec.input.slug, id);
  const live = visibilityOf(rec.input.status, rec.publishedAt) === "live";
  if ((live || refs.length > 0) && text(formData, "confirmSlug").trim() !== rec.input.slug) redirect(`${LIST}/${id}/confirm?do=delete&n=confirm_needed`);
  await deletePost(id);
  await audit({ action: "blog.delete", userId: admin.id, userEmail: admin.email, entityType: "blog_post", entityId: id, summary: `Deleted "${rec.input.title}" (${rec.input.slug}, was ${rec.input.status}, ${refs.length} link(s))`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=removed`);
}

export async function toggleFeaturedPost(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = idOf(formData);
  const rec = id ? await getPostRecord(id) : null;
  if (!id || !rec) redirect(`${LIST}?n=failed`);
  const next = !rec.input.featured;
  await setPostFeatured(id, next);
  await audit({ action: "blog.featured", userId: admin.id, userEmail: admin.email, entityType: "blog_post", entityId: id, summary: `${next ? "Featured" : "Unfeatured"} "${rec.input.title}"`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=${next ? "featured" : "unfeatured"}`);
}

/* ---- categories and tags -------------------------------------------------------------------------------------- */

const CATS = `${LIST}/categories`;
const TAGS = `${LIST}/tags`;
const CAT_ID = /^cat_[a-z0-9-]{2,60}$/;
const TAG_ID = /^tag_[a-z0-9-]{2,60}$/;
const name = (f: FormData, k: string, max: number) => text(f, k).trim().replace(/\s+/g, " ").slice(0, max);
const nameOk = (v: string) => v.length >= 2 && !/[<>]/.test(v);

export async function addCategory(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const title = name(formData, "title", 40);
  const slug = slugify(text(formData, "slug") || title);
  if (!nameOk(title) || slug.length < 2) redirect(`${CATS}?n=invalid`);
  if (await categorySlugInUse(slug)) redirect(`${CATS}?n=exists`);
  await createCategory(title, slug);
  await audit({ action: "blog.category.create", userId: admin.id, userEmail: admin.email, entityType: "blog_category", summary: `Created category "${title}"`, ipHash: await ipHash(h) });
  redirect(`${CATS}?n=created`);
}

export async function saveCategory(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = text(formData, "id");
  const cat = CAT_ID.test(id) ? (await listCategories()).find((c) => c.id === id) : undefined;
  if (!cat) redirect(`${CATS}?n=failed`);
  const title = name(formData, "title", 40);
  const slug = slugify(text(formData, "slug") || title);
  const status = (["published", "draft", "archived"] as const).find((x) => x === text(formData, "status")) ?? "published";
  if (!nameOk(title) || slug.length < 2) redirect(`${CATS}?n=invalid`);
  if (await categorySlugInUse(slug, id)) redirect(`${CATS}?n=exists`);
  if (status !== "published" && cat.posts > 0) redirect(`${CATS}?n=in_use`); // its articles would lose their filter chip
  await updateCategory(id, title, slug, status);
  await audit({ action: "blog.category.update", userId: admin.id, userEmail: admin.email, entityType: "blog_category", entityId: id, summary: `Updated category "${title}"`, ipHash: await ipHash(h) });
  redirect(`${CATS}?n=saved`);
}

export async function reorderCategory(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = text(formData, "id");
  if (!CAT_ID.test(id)) redirect(`${CATS}?n=failed`);
  const moved = await moveCategory(id, text(formData, "dir") === "up" ? "up" : "down");
  if (moved) await audit({ action: "blog.category.reorder", userId: admin.id, userEmail: admin.email, entityType: "blog_category", entityId: id, summary: "Moved category", ipHash: await ipHash(h) });
  redirect(moved ? `${CATS}?n=moved` : CATS);
}

export async function removeCategory(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = text(formData, "id");
  const cat = CAT_ID.test(id) ? (await listCategories()).find((c) => c.id === id) : undefined;
  if (!cat) redirect(`${CATS}?n=failed`);
  if (cat.posts > 0) redirect(`${CATS}?n=in_use`); // the database refuses too (RESTRICT); this gives a clear message
  await deleteCategory(id);
  await audit({ action: "blog.category.delete", userId: admin.id, userEmail: admin.email, entityType: "blog_category", entityId: id, summary: `Deleted category "${cat.title}"`, ipHash: await ipHash(h) });
  redirect(`${CATS}?n=removed`);
}

export async function saveTag(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = text(formData, "id");
  const title = name(formData, "title", 30);
  const slug = slugify(title);
  if (!TAG_ID.test(id) || !nameOk(title) || slug.length < 2) redirect(`${TAGS}?n=invalid`);
  if (await tagSlugInUse(slug, id)) redirect(`${TAGS}?n=exists`);
  await renameTag(id, title, slug);
  await audit({ action: "blog.tag.update", userId: admin.id, userEmail: admin.email, entityType: "blog_tag", entityId: id, summary: `Renamed tag to "${title}"`, ipHash: await ipHash(h) });
  redirect(`${TAGS}?n=saved`);
}

export async function removeTag(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = text(formData, "id");
  if (!TAG_ID.test(id)) redirect(`${TAGS}?n=failed`);
  await deleteTag(id);
  await audit({ action: "blog.tag.delete", userId: admin.id, userEmail: admin.email, entityType: "blog_tag", entityId: id, summary: "Deleted tag", ipHash: await ipHash(h) });
  redirect(`${TAGS}?n=removed`);
}
