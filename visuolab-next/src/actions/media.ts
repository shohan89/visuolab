"use server";

import { redirect } from "next/navigation";
import { audit } from "@/lib/server/audit";
import { requireAdmin } from "@/lib/server/auth";
import { deleteMedia, getMedia, updateMediaMeta } from "@/lib/server/media";
import { ipHash, requestHeaders, strictSameOrigin } from "@/lib/server/request";

/** Same two checks as every admin action: the request comes from this site, and the session belongs to an admin. */
async function guard() {
  const h = await requestHeaders();
  if (!strictSameOrigin(h)) throw new Error("bad origin");
  const admin = await requireAdmin();
  return { admin, h };
}

const ID_RE = /^media_[a-z0-9-]{2,80}$/;
const LIST = "/admin/media";
const text = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const plain = (v: string) => !/[<>]/.test(v);

/** Save the title, description (alt text) and caption of a file. */
export async function saveMedia(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = String(formData.get("id") ?? "");
  const item = ID_RE.test(id) ? await getMedia(id) : null;
  if (!item) redirect(`${LIST}?n=failed`);
  const title = text(formData, "title", 120);
  const alt = text(formData, "alt", 200);
  const caption = text(formData, "caption", 200);
  if (title.length < 1 || !plain(title) || !plain(alt) || !plain(caption)) redirect(`${LIST}/${id}?n=invalid_media`);
  await updateMediaMeta(id, { title, alt, caption });
  await audit({ action: "media.update", userId: admin.id, userEmail: admin.email, entityType: "media", entityId: id, summary: `Updated "${title}"`, ipHash: await ipHash(h) });
  redirect(`${LIST}/${id}?n=saved`);
}

/** Delete an uploaded file. Refused while any content uses it, and for files that ship with the website. */
export async function removeMedia(formData: FormData): Promise<void> {
  const { admin, h } = await guard();
  const id = String(formData.get("id") ?? "");
  const item = ID_RE.test(id) ? await getMedia(id) : null;
  if (!item) redirect(`${LIST}?n=failed`);
  const res = await deleteMedia(id);
  if (!res.ok) redirect(`${LIST}/${id}?n=${res.reason === "static" ? "static_media" : "media_in_use"}`);
  await audit({ action: "media.delete", userId: admin.id, userEmail: admin.email, entityType: "media", entityId: id, summary: `Deleted "${item.title}" (${item.mime}, ${item.bytes} bytes)`, ipHash: await ipHash(h) });
  redirect(`${LIST}?n=removed`);
}
