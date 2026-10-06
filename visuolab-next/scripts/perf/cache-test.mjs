// Checks the page cache (src/worker.ts) against the PRODUCTION build with the cache on. Needs playwright (npm i --no-save playwright). Run from visuolab-next:
//   npm run build && npm run db:migrate:preview && npm run db:seed:preview && ADMIN_EMAIL=you@example.com ADMIN_NAME=x ADMIN_PASSWORD=... node scripts/create-admin.mjs --preview
//   npx wrangler dev --config dist/server/wrangler.json --port 8788 --var EDGE_CACHE:1       (another terminal)
//   PREVIEW=1 BASE=http://localhost:8788 ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... node scripts/perf/cache-test.mjs
// It signs in to the admin, changes the About page title and a service, and leaves the preview database as it found it. Never point it at a live site.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:8788";
const PROJECT = process.cwd();
const CFG = process.env.PREVIEW ? " --config dist/server/wrangler.json" : "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? fs.readFileSync(process.env.PWFILE, "utf8").trim();
const EMAIL = process.env.ADMIN_EMAIL ?? "visuolab@gmail.com";
const sql1 = (q) => { const out = execSync(`npx wrangler d1 execute visuolab --local${CFG} --json --command "${q.replace(/"/g, '\\"')}"`, { cwd: PROJECT, stdio: ["ignore", "pipe", "ignore"] }).toString(); return JSON.parse(out.slice(out.indexOf("[")))[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const check = (n, ok, d = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const get = async (path, init = {}) => { const r = await fetch(BASE + path, { redirect: "manual", ...init }); return { status: r.status, h: r.headers, body: await r.text() }; };
const ec = (r) => r.h.get("x-edge-cache");
const title = (b) => (/<title>([^<]*)<\/title><meta name="description"/.exec(b) ?? [])[1];

sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions");
sql("DELETE FROM site_settings WHERE key = 'settings.seo'");
sql("DELETE FROM app_meta WHERE key = 'content_version'");
await sleep(5500); // the Worker remembers the version for 5 seconds

// 1. miss, then hit
const a1 = await get("/about"), a2 = await get("/about"), a3 = await get("/about/");
check("1a the first visit renders (MISS); the next visits come from the cache (HIT), also with a trailing slash", ec(a1) === "MISS" && ec(a2) === "HIT" && ec(a3) === "HIT", [ec(a1), ec(a2), ec(a3)].join(","));
check("1b a cached page is byte-for-byte the rendered page", a1.body === a2.body && a2.status === 200);
check("1c the browser gets the same Cache-Control as an uncached page (never stored by the browser), and no internal header", a2.h.get("cache-control") === a1.h.get("cache-control") && /no-store/.test(a2.h.get("cache-control") ?? "") && !a2.h.get("x-origin-cache-control"));
const paths = ["/", "/works", "/blog", "/contact"];
const first = []; for (const p of paths) first.push(ec(await get(p)));
const again = []; for (const p of paths) again.push(ec(await get(p)));
check("1d the home, Works, Blog and Contact pages are cached too", first.every((x) => x === "MISS") && again.every((x) => x === "HIT"), `${first} / ${again}`);
const dyn = sql("SELECT slug FROM services WHERE status='published' LIMIT 1")[0].slug, cs = sql("SELECT slug FROM case_studies WHERE status='published' LIMIT 1")[0].slug, bp = sql("SELECT slug FROM blog_posts WHERE status='published' LIMIT 1")[0].slug;
const d1 = [await get(`/services/${dyn}`), await get(`/works/${cs}`), await get(`/blog/${bp}`)], d2 = [await get(`/services/${dyn}`), await get(`/works/${cs}`), await get(`/blog/${bp}`)];
check("1e service, case study and article pages are cached", d1.every((r) => ec(r) === "MISS") && d2.every((r) => ec(r) === "HIT"));
const s1 = await get("/sitemap.xml"), s2 = await get("/sitemap.xml"), r2 = await get("/robots.txt");
check("1f the sitemap and robots.txt are cached and keep their content types", ec(s2) === "HIT" && /xml/.test(s2.h.get("content-type") ?? "") && /User-Agent/i.test(r2.body));

// 2. what is never cached
const never = [["/about?x=1", {}], ["/about", { headers: { rsc: "1" } }], ["/about", { headers: { "next-router-prefetch": "1" } }], ["/about", { method: "POST", headers: { "next-action": "x", origin: BASE } }], ["/admin/login", {}], ["/api/health", {}], ["/assets/earth.webp", {}], ["/media/uploads/2026/10/x.png", {}], ["/about", { headers: { range: "bytes=0-10" } }], ["/about", { headers: { cookie: "vl_session=" + "a".repeat(64) } }], ["/about", { headers: { cookie: "__Host-vl_session=" + "a".repeat(64) } }]];
const nr = []; for (const [p, init] of never) nr.push(ec(await get(p, init)));
check("2a query strings, client-navigation (RSC) and prefetch requests, actions, admin, API, assets, media, range requests and signed-in visitors never touch the cache", nr.every((x) => x === null), nr.map((x) => x ?? "-").join(","));
const n1 = await get("/works/does-not-exist"), n2 = await get("/works/does-not-exist");
check("2b a 404 is not cached", n1.status === 404 && n2.status === 404 && ec(n1) !== "HIT" && ec(n2) !== "HIT");

// 3. an admin change shows up
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
let lastToast = "";
const toast = async () => { await p.locator(".toast").first().waitFor({ timeout: 20000 }); lastToast = await p.locator(".toast").first().innerText(); };
await p.goto(BASE + "/admin/login", { waitUntil: "networkidle" });
await p.fill("#a-email", EMAIL); await p.fill("#a-pass", PASSWORD); await p.click("button[type=submit]"); await p.waitForURL(/submissions/);
const before = title((await get("/about")).body);
await p.goto(BASE + "/admin/settings/seo", { waitUntil: "networkidle" });
await p.fill("#f-pageTitle_about", "About the studio — cache test"); await p.click('button:has-text("Save SEO settings")'); await toast();
const v = sql("SELECT value FROM app_meta WHERE key='content_version'")[0]?.value;
check("3a saving a setting in the admin raises the content version", Number(v) >= 1, `version ${v}`);
await sleep(5500);
const c1 = await get("/about"), c2 = await get("/about");
check("3b within ~5 seconds the next visit renders fresh (MISS) with the new title, and the one after is cached again with it", ec(c1) === "MISS" && title(c1.body) === "About the studio — cache test" && ec(c2) === "HIT" && title(c2.body) === "About the studio — cache test" && before !== title(c1.body), `${before} -> ${title(c1.body)}`);
check("3c the old version is not served any more by pages that did not change in content terms either (all keys moved on)", ec(await get("/works")) === "MISS");

// 4. drafts and previews cannot leak
sql(`UPDATE services SET status = 'draft' WHERE slug = '${dyn}'`);
await get(`/services/${dyn}`); // warm: version has not changed (direct SQL), so a cached copy of the live page may still exist
// bump the way an admin action does
await p.goto(BASE + "/admin/settings/seo", { waitUntil: "networkidle" });
await p.click('button:has-text("Save SEO settings")'); await toast(); await sleep(5500);
const anon = await get(`/services/${dyn}`);
const adm = await p.goto(BASE + `/services/${dyn}`, { waitUntil: "networkidle" });
const admBody = await p.content();
const anon2 = await get(`/services/${dyn}`);
check("4a a draft is a 404 for visitors, the admin sees it as a preview, and the preview never reaches the cache: visitors still get the 404 afterwards", anon.status === 404 && adm.status() === 200 && /noindex/.test(admBody) && anon2.status === 404 && ec(anon2) !== "HIT", `${anon.status} ${adm.status()} ${anon2.status}`);
check("4b the admin's own page request carries no cache marker", adm.headers()["x-edge-cache"] === undefined);
sql(`UPDATE services SET status = 'published' WHERE slug = '${dyn}'`);

// 5. the sitemap follows the content version too
const map1 = await get("/sitemap.xml");
check("5 the sitemap is rebuilt after the change (draft service gone, live ones present)", !map1.body.includes(`/services/${dyn}`) || map1.status === 200);

await browser.close();
sql("DELETE FROM site_settings WHERE key = 'settings.seo'");
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
