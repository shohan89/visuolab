/*
 * The Worker's entry point: vinext's own handler, with a page cache in front of it.
 *
 * Public pages are read from D1 for every visit, which is the slowest part of a request on the edge (a few round trips to the database
 * before the first byte). This cache keeps the finished HTML of the public pages in Cloudflare's cache (the Cache API of the data centre
 * that served it) and answers repeat visits from there without touching D1 or rendering.
 *
 * How it stays correct:
 *   - The cache key contains the build id (so a new deploy never serves HTML that points at the previous deploy's hashed files) and a content version (a counter in D1, `app_meta.content_version`) that every admin change bumps (see
 *     server/audit.ts). A saved change therefore changes the key and the next visit renders fresh. The counter is read at most once
 *     every 5 seconds per Worker instance, so an admin change is live everywhere within about 5 seconds.
 *   - Entries also expire after 5 minutes, which covers the one change nobody saves: a scheduled article reaching its publish time.
 *   - A visitor who is signed in to the admin (session cookie) is never served from the cache and never fills it, so draft previews
 *     cannot leak. Only plain page GETs are cached: no query string, no client-navigation (RSC) requests, no server actions, no Range.
 *   - Only 200 answers that set no cookie are stored. The browser still receives the same headers as before (no-store).
 * Switch off with EDGE_CACHE=0 (local development and the test suites do). The answer says which way it went in `X-Edge-Cache`.
 */
import handler from "vinext/server/fetch-handler";
export * from "vinext/server/fetch-handler";

declare const __BUILD_ID__: string; // set at build time (vite.config.ts)

type WorkerEnv = Cloudflare.Env & { EDGE_CACHE?: string };

const TTL_SECONDS = 300;
const VERSION_MEMO_MS = 5000;

/** The public pages, the sitemap and robots.txt. Everything else (admin, API, media, assets, actions) goes straight to the app. */
const CACHEABLE = /^\/(?:|about|contact|works|blog|(?:works|services|blog)\/[a-z0-9][a-z0-9-]*|sitemap\.xml|robots\.txt)\/?$/;
const SESSION_COOKIE = /(?:^|;\s*)(?:__Host-)?vl_session=/;
/** Headers a client-side navigation or an action sends; such requests want a different answer than the page HTML. */
const VARIANT_HEADERS = ["rsc", "next-action", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "x-vinext-rsc-render-mode", "range", "x-nextjs-data"];

let versionMemo: { value: string; at: number } | null = null;

async function contentVersion(env: WorkerEnv): Promise<string> {
  const now = Date.now();
  if (versionMemo && now - versionMemo.at < VERSION_MEMO_MS) return versionMemo.value;
  let value = "0";
  try {
    const row = await env.DB.prepare("SELECT value FROM app_meta WHERE key = 'content_version'").first<{ value: string }>();
    value = row?.value ?? "0";
  } catch {
    return "x" + now; // the database is unreachable: do not use or fill the cache this time
  }
  versionMemo = { value, at: now };
  return value;
}

function eligible(request: Request): boolean {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.search || !CACHEABLE.test(url.pathname)) return false;
  if (SESSION_COOKIE.test(request.headers.get("cookie") ?? "")) return false;
  return !VARIANT_HEADERS.some((h) => request.headers.has(h));
}

const mark = (res: Response, state: string): Response => {
  const out = new Response(res.body, res);
  out.headers.set("X-Edge-Cache", state);
  return out;
};

const worker = {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const app = handler as unknown as { fetch: (request: Request, env: WorkerEnv, ctx: ExecutionContext) => Promise<Response> };
    if (env.EDGE_CACHE !== "1" || !eligible(request)) return app.fetch(request, env, ctx);

    const version = await contentVersion(env);
    if (version.startsWith("x")) return mark(await app.fetch(request, env, ctx), "BYPASS");
    const url = new URL(request.url);
    const key = new Request(`${url.origin}${url.pathname.replace(/\/+$/, "") || "/"}?__cv=${version}&__b=${typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev"}`, { method: "GET" });
    const cache = (caches as unknown as { default: Cache }).default;

    const hit = await cache.match(key);
    if (hit) {
      const out = new Response(hit.body, hit);
      out.headers.set("Cache-Control", out.headers.get("X-Origin-Cache-Control") ?? "no-store");
      out.headers.delete("X-Origin-Cache-Control");
      out.headers.set("X-Edge-Cache", "HIT");
      return out;
    }

    const res = await app.fetch(request, env, ctx);
    if (res.status !== 200 || res.headers.has("set-cookie")) return mark(res, "BYPASS");
    const keep = res.clone();
    const stored = new Response(keep.body, keep);
    stored.headers.set("X-Origin-Cache-Control", res.headers.get("Cache-Control") ?? "no-store");
    stored.headers.set("Cache-Control", `public, max-age=${TTL_SECONDS}`);
    stored.headers.delete("Vary");
    ctx.waitUntil(cache.put(key, stored).catch(() => {}));
    return mark(res, "MISS");
  },
};

export default worker;
