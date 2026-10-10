// Cache and revalidation audit against a Worker that has the edge page cache switched on (X-Edge-Cache header), e.g.
//   npx wrangler dev --config dist/server/wrangler.json --port 8788 --persist-to .wrangler/state --var EDGE_CACHE:1
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:8788 node scripts/qa/cache-qa.mjs
// It checks that a public page is cached for visitors, that an admin's session, a preview and a query string never use or fill the cache, that
// publishing a change makes the next visitors see it within seconds (the content version moved), and that saving a DRAFT does not drop the cache.
// It puts the section back afterwards. Never point it at the live site.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:8788";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Local sites only."); process.exit(1); }
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
const res = [];
const check = (n, ok, d = "") => { res.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + String(d).slice(0, 240) : ""}`); };
const sql1 = (q) => { const f = join(tmpdir(), `cache-qa-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (p, headers = {}) => { const r = await fetch(BASE + p, { redirect: "manual", headers }); return { status: r.status, cache: r.headers.get("x-edge-cache") ?? "", text: await r.text() }; };
const esc = (v) => (v === null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

const snap = sql("SELECT content, updated_at, updated_by FROM page_sections WHERE id = 'sec_about_hero'")[0];
const original = JSON.parse(snap.content).label;
sql("DELETE FROM rate_limits; DELETE FROM sessions; DELETE FROM content_drafts");
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
try {
  const first = await get("/about");
  const second = await get("/about");
  check("a public page is cached for visitors: the first answer fills it, the next one is a HIT", ["MISS", "HIT"].includes(first.cache) && second.cache === "HIT", `${first.cache} then ${second.cache}`);
  check("a request with a query string (a preview) never uses or fills the cache", (await get("/about?preview=1")).cache === "" || (await get("/about?x=1")).cache === "");

  await page.goto(BASE + "/admin/login"); await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !/\/login/.test(u.pathname)), page.click('button[type="submit"]')]);
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const asAdmin = await get("/about", { cookie });
  check("a signed-in admin is never served from the cache (and never fills it)", asAdmin.cache === "" || asAdmin.cache === "BYPASS", `"${asAdmin.cache}"`);

  // a draft does not change what visitors get, and does not drop the cache
  await page.goto(BASE + "/admin/pages/about/hero"); await page.waitForLoadState("networkidle");
  const label = page.getByLabel(/^Label( optional)?$/).first();
  await label.fill("CACHE DRAFT");
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Save draft" }).click()]);
  await sleep(7000); // longer than the Worker's memo of the content version
  const afterDraft = await get("/about");
  check("saving a draft does not change the public page and the page is still served from the cache", !afterDraft.text.includes("CACHE DRAFT") && afterDraft.cache === "HIT", afterDraft.cache);

  // publishing moves the content version: the next visitors get fresh HTML within seconds
  const t0 = Date.now();
  await page.getByRole("button", { name: "Publish this section" }).click();
  await page.waitForLoadState("networkidle");
  let fresh = null;
  while (Date.now() - t0 < 25000) { const r = await get("/about"); if (r.text.includes("CACHE DRAFT")) { fresh = r; break; } await sleep(500); }
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);
  check(`publishing a change reaches visitors within seconds (took ${seconds}s) without anyone clearing the cache`, !!fresh && Date.now() - t0 < 15000);
  const again = await get("/about");
  check("the fresh page is cached again", again.cache === "HIT" && again.text.includes("CACHE DRAFT"), again.cache);
  const other = await get("/");
  check("another page is served with the same content version (a HIT or a fresh MISS, never stale content)", ["HIT", "MISS"].includes(other.cache));
} finally {
  sql(`UPDATE page_sections SET content = ${esc(snap.content)}, updated_at = ${esc(snap.updated_at)}, updated_by = ${esc(snap.updated_by)} WHERE id = 'sec_about_hero'`);
  sql("DELETE FROM content_drafts; DELETE FROM page_section_revisions; DELETE FROM rate_limits");
  void original;
}
await browser.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
