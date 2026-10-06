import "server-only";
import { requireAdminApi, type AdminUser } from "./auth";
import { getDb } from "./db";
import type { MediaItem } from "./media";
import { MAX_BYTES } from "@/lib/media/sniff";
import { countHit } from "./rate-limit";
import { requestHeaders, strictSameOrigin } from "./request";

/** JSON answers for the media API: never cached, never sniffed. */
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });

/** What the picker and the library need to show a file. Public URL, never a storage key or credential. */
export const toPublic = (m: MediaItem) => ({
  id: m.id, title: m.title, url: m.publicUrl, alt: m.altText, caption: m.caption, width: m.width, height: m.height, bytes: m.bytes, mime: m.mime,
  kind: m.kind, storage: m.storage, createdAt: m.createdAt, originalName: m.originalName,
});

/**
 * The checks every media API call starts with, answered as JSON (an API must not redirect to a login page):
 * a signed-in admin, and a request that comes from this site (CSRF) when it changes something.
 */
export async function guardApi(opts: { write: boolean }): Promise<{ admin: AdminUser } | { response: Response }> {
  if (opts.write && !strictSameOrigin(await requestHeaders())) return { response: json({ error: "This request must come from the admin pages." }, 403) };
  const auth = await requireAdminApi();
  if ("response" in auth) return auth;
  return auth;
}

/** Uploads per admin per hour: a stolen session cannot be used to fill the bucket. */
export async function uploadAllowed(adminId: string): Promise<boolean> {
  return (await countHit(getDb(), `media-upload:${adminId}`, 3600)) <= 200;
}

/**
 * Reads the uploaded file from a multipart request. The size is checked from the header first, so an oversized body is refused
 * before it is read, and again on the bytes. Returns the file or the response to send.
 */
export async function readUpload(request: Request): Promise<{ file: { name: string; bytes: Uint8Array }; form: FormData } | { response: Response }> {
  const declared = request.headers.get("content-length");
  // a body with no declared size (chunked) cannot be checked before it is read, so it is refused: browsers always declare it for a FormData upload
  if (declared === null || declared.trim() === "" || !Number.isInteger(Number(declared)) || Number(declared) < 0) return { response: json({ error: "The upload must declare its size." }, 411) };
  const length = Number(declared);
  if (length > MAX_BYTES + 1024 * 1024) return { response: json({ error: `The upload is too large. The limit is ${MAX_BYTES / 1048576} MB per picture.` }, 413) };
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { response: json({ error: "The upload could not be read." }, 400) };
  }
  const f = form.get("file");
  if (!(f instanceof File)) return { response: json({ error: "Choose a picture to upload." }, 400) };
  if (f.size > MAX_BYTES) return { response: json({ error: `The file is too large (${(f.size / 1048576).toFixed(1)} MB). The limit is ${MAX_BYTES / 1048576} MB.` }, 413) };
  return { file: { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }, form };
}
