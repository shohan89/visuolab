import { safeRoute } from "@/lib/server/safe";
import { audit } from "@/lib/server/audit";
import { replaceImage } from "@/lib/server/media";
import { guardApi, json, readUpload, toPublic, uploadAllowed } from "@/lib/server/media-api";

export const dynamic = "force-dynamic";

/** Replace the picture behind a media file (multipart field "file"). The file keeps its id, so every page that uses it follows. */
async function postHandler(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await guardApi({ write: true });
  if ("response" in auth) return auth.response;
  const { id } = await ctx.params;
  if (!/^media_[a-z0-9-]{2,80}$/.test(id)) return json({ error: "Unknown media file." }, 404);
  if (!(await uploadAllowed(auth.admin.id))) return json({ error: "Too many uploads this hour. Try again later." }, 429);
  const up = await readUpload(request);
  if ("response" in up) return up.response;
  const res = await replaceImage(id, up.file, auth.admin.id);
  if (!res.ok) return json({ error: res.error }, res.status);
  await audit({ action: "media.replace", userId: auth.admin.id, userEmail: auth.admin.email, entityType: "media", entityId: id, summary: `Replaced the file of "${res.item.title}" (${res.item.mime}, ${res.item.bytes} bytes)` });
  return json({ item: toPublic(res.item) });
}

export const POST = safeRoute(postHandler);
