import { audit } from "@/lib/server/audit";
import { listMedia, uploadImage } from "@/lib/server/media";
import { guardApi, json, readUpload, toPublic, uploadAllowed } from "@/lib/server/media-api";

export const dynamic = "force-dynamic";

/** List or search the media library (admin only). `?id=` returns one file. Used by the library and by the MediaPicker. */
export async function GET(request: Request) {
  const auth = await guardApi({ write: false });
  if ("response" in auth) return auth.response;
  const q = new URL(request.url).searchParams;
  const type = q.get("type");
  const storage = q.get("storage");
  const result = await listMedia({
    q: q.get("q") ?? undefined,
    type: type === "image" || type === "video" || type === "file" ? type : undefined,
    storage: storage === "static" || storage === "r2" ? storage : undefined,
    unused: q.get("unused") === "1",
    page: Number(q.get("page")) || 1,
    limit: Number(q.get("limit")) || 24,
    id: q.get("id") ?? undefined,
  });
  return json({ items: result.items.map(toPublic), total: result.total, page: result.page, pages: result.pages });
}

/** Upload one picture (multipart field "file"; optional "title", "alt", "caption"). The browser never sees storage credentials: the Worker writes to R2. */
export async function POST(request: Request) {
  const auth = await guardApi({ write: true });
  if ("response" in auth) return auth.response;
  if (!(await uploadAllowed(auth.admin.id))) return json({ error: "Too many uploads this hour. Try again later." }, 429);
  const up = await readUpload(request);
  if ("response" in up) return up.response;
  const text = (k: string) => String(up.form.get(k) ?? "");
  const res = await uploadImage(up.file, auth.admin.id, { title: text("title"), alt: text("alt"), caption: text("caption") });
  if (!res.ok) return json({ error: res.error }, res.status);
  if (!res.duplicate) await audit({ action: "media.upload", userId: auth.admin.id, userEmail: auth.admin.email, entityType: "media", entityId: res.item.id, summary: `Uploaded "${res.item.title}" (${res.item.mime}, ${res.item.bytes} bytes)` });
  return json({ item: toPublic(res.item), duplicate: res.duplicate }, res.duplicate ? 200 : 201);
}
