import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

/**
 * Serves an uploaded picture from R2 at /media/<object key>. Used when no media domain (MEDIA_BASE_URL) is configured; with one,
 * pages link straight to that domain and this route is only a fallback. Only keys the upload code creates are served, so the
 * route cannot be used to read anything else in the bucket.
 */
const KEY = /^uploads\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|gif|avif)$/;

async function serve(request: Request, ctx: { params: Promise<{ key: string[] }> }, head: boolean) {
  const key = (await ctx.params).key.join("/");
  if (!KEY.test(key)) return new Response("Not found", { status: 404 });
  const object = await env.MEDIA.get(key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers({
    "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
    "Cache-Control": object.httpMetadata?.cacheControl ?? "public, max-age=31536000, immutable",
    ETag: object.httpEtag,
    "Content-Length": String(object.size),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox", // a picture opened directly can never run script
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  if (request.headers.get("if-none-match") === object.httpEtag) return new Response(null, { status: 304, headers });
  return new Response(head ? null : object.body, { status: 200, headers });
}

export const GET = (request: Request, ctx: { params: Promise<{ key: string[] }> }) => serve(request, ctx, false);
export const HEAD = (request: Request, ctx: { params: Promise<{ key: string[] }> }) => serve(request, ctx, true);
