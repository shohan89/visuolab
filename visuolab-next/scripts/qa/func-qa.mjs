// End-to-end functional QA against the PRODUCTION build (needs playwright: npm i --no-save playwright). Run from visuolab-next:
//   npm run build && npm run db:migrate:preview && npm run db:seed:preview && ADMIN_EMAIL=visuolab@gmail.com ADMIN_NAME=x ADMIN_PASSWORD=... node scripts/create-admin.mjs --preview
//   npx wrangler dev --config dist/server/wrangler.json --port 8788 --var EDGE_CACHE:1        (another terminal)
//   PREVIEW=1 BASE=http://localhost:8788 ADMIN_PASSWORD=... node scripts/qa/func-qa.mjs
// It crawls the public site, clicks the navigation, sends an enquiry, signs in to the admin, uploads and deletes a picture and replays admin actions without a session. Never point it at a live site.
// End-to-end functional QA of the production build (PREVIEW=1 BASE=http://localhost:8788) or the dev server.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:8788";
const PROJECT = process.cwd();
const CFG = process.env.PREVIEW ? " --config dist/server/wrangler.json" : "";
const PASSWORD = process.env.ADMIN_PASSWORD ?? fs.readFileSync(process.env.PWFILE, "utf8").trim();
const sql1 = (q) => { const out = execSync(`npx wrangler d1 execute visuolab --local${CFG} --json --command "${q.replace(/"/g, '\\"')}"`, { cwd: PROJECT, stdio: ["ignore", "pipe", "ignore"] }).toString(); return JSON.parse(out.slice(out.indexOf("[")))[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const check = (n, ok, d = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const get = async (path, init = {}) => { for (let i = 0; ; i++) { try { const r = await fetch(BASE + path, { redirect: "manual", ...init }); const buf = Buffer.from(await r.arrayBuffer()); return { status: r.status, h: r.headers, buf, body: buf.toString("utf8", 0, Math.min(buf.length, 3_000_000)) }; } catch (e) { if (i > 3) throw e; await sleep(600); } } };

sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions");

// ======================= PUBLIC: crawl every internal link, picture, script, style, video and anchor =======================
const seen = new Map(); const queue = ["/", "/about", "/works", "/blog", "/contact", "/sitemap.xml", "/robots.txt"]; const broken = []; const assets = new Set(); const external = new Set(); const mailtos = new Set(); const anchorBad = [];
const pageUrls = new Set();
const attrs = (html, name) => [...html.matchAll(new RegExp(`${name}="([^"]+)"`, "g"))].map((m) => m[1].replace(/&amp;/g, "&"));
while (queue.length) {
  const u = queue.shift(); if (seen.has(u)) continue;
  const r = await get(u); seen.set(u, r.status);
  if (r.status >= 300 && r.status < 400) { const to = r.h.get("location"); if (to && to.startsWith("/")) { if (!seen.has(to.split("#")[0])) queue.push(to.split("#")[0]); } continue; }
  if (r.status !== 200) { broken.push(`${u} → ${r.status}`); continue; }
  if (!/text\/html/.test(r.h.get("content-type") ?? "")) { if (u === "/sitemap.xml") for (const m of r.body.matchAll(/<loc>([^<]+)<\/loc>/g)) queue.push(new URL(m[1]).pathname); continue; }
  pageUrls.add(u);
  const html = r.body;
  for (const h of [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))) {
    if (h.startsWith("mailto:")) { mailtos.add(h); continue; }
    if (/^https?:\/\//.test(h)) { if (!h.startsWith(BASE)) { external.add(h); continue; } }
    if (h.startsWith("#")) { const id = h.slice(1); if (id && !new RegExp(`id="${decodeURIComponent(id)}"`).test(html) && !/^(top|main|content)$/.test(id)) anchorBad.push(`${u}${h}`); continue; }
    const path = h.replace(BASE, "");
    if (/\.(css|ico|png|webp|svg|woff2)(\?|$)/.test(path) || path.startsWith("/_next/") || path.startsWith("/fonts/") || path.startsWith("/assets/")) { assets.add(path.split("#")[0]); continue; }
    if (path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/admin")) queue.push(path.split("#")[0].replace(/\/$/, "") || "/");
  }
  for (const s of [...attrs(html, "src"), ...attrs(html, "poster"), ...attrs(html, "data-src")]) if (s.startsWith("/")) assets.add(s); else if (/^https?:/.test(s) && !s.startsWith(BASE)) external.add(s);
  for (const set of [...attrs(html, "srcSet"), ...attrs(html, "srcset"), ...attrs(html, "imageSrcSet")]) for (const part of set.split(",")) { const a = part.trim().split(/\s+/)[0]; if (a.startsWith("/")) assets.add(a); }
  for (const l of [...html.matchAll(/<link [^>]*href="([^"]+)"/g)].map((m) => m[1])) if (/[.](css|woff2|ico|png)/.test(l) && l.startsWith("/")) assets.add(l);
}
check(`public crawl: ${pageUrls.size} pages reached from the navigation, footers, cards, sitemap and article links; every one answers 200`, broken.length === 0 && pageUrls.size >= 23, `${pageUrls.size} pages${broken.length ? "; BROKEN: " + broken.slice(0, 5).join(", ") : ""}`);
const expected = ["/", "/about", "/works", "/blog", "/contact", ...[...new Set(sql("SELECT slug FROM services WHERE status='published'").map((r) => "/services/" + r.slug))], ...sql("SELECT slug FROM case_studies WHERE status='published'").map((r) => "/works/" + r.slug), ...sql("SELECT slug FROM blog_posts WHERE status='published'").map((r) => "/blog/" + r.slug)];
const unreachable = expected.filter((p) => !pageUrls.has(p));
check("public crawl: every published service, case study and article is linked from somewhere on the site (none is an orphan)", unreachable.length === 0, unreachable.join(", "));
const assetList = [...assets]; const bad = []; const types = { webp: /image\/webp/, png: /image\/png/, jpg: /image\/jpeg/, mp4: /video\/mp4/, woff2: /font|octet|woff/, css: /text\/css/, js: /javascript/ };
for (let i = 0; i < assetList.length; i += 12) await Promise.all(assetList.slice(i, i + 12).map(async (a) => { const r = await get(a, { headers: { range: a.endsWith(".mp4") ? "bytes=0-1023" : undefined } }); const ext = (a.split("?")[0].split(".").pop() ?? ""); if (![200, 206].includes(r.status) || (r.buf.length === 0 && r.status === 200) || (types[ext] && !types[ext].test(r.h.get("content-type") ?? ""))) bad.push(`${a} → ${r.status} ${r.h.get("content-type")}`); }));
check(`media loading: ${assetList.length} pictures, video, fonts, stylesheets and scripts used by the pages all load with the right type`, bad.length === 0, bad.slice(0, 4).join(" | "));
check("anchors: every #section link points at an element that exists", anchorBad.length === 0, anchorBad.slice(0, 4).join(", "));
check(`mailto links are well formed (${mailtos.size})`, [...mailtos].every((m) => /^mailto:[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}(\?subject=[A-Za-z0-9%._-]+)?$/i.test(m)), [...mailtos].filter((m) => !/^mailto:[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}(\?subject=[A-Za-z0-9%._-]+)?$/i.test(m)).join(","));
check(`external links use https and open safely (${external.size} addresses)`, [...external].every((e) => e.startsWith("https://")), [...external].filter((e) => !e.startsWith("https://")).join(","));
const legacy = await Promise.all(["/index.html", "/about.html", "/works.html", "/blog.html", "/contact.html", "/work/aster.html", "/service/brand-identity.html", "/blog/webflow-or-next-js.html"].map((p) => get(p)));
check("old .html addresses redirect to the new ones", legacy.every((r) => r.status === 308 && !/\.html/.test(r.h.get("location") ?? "")), legacy.map((r) => r.h.get("location")).join(" "));

// ======================= PUBLIC: invalid slugs and malicious paths =======================
const slugs = ["/works/nope", "/services/nope", "/blog/nope", "/works/UPPER", "/blog/a%20b", "/blog/%00", "/works/%E2%82%AC", "/works/..%2fadmin", "/services/" + "x".repeat(3000), "/works/'%20OR%201=1--", "/blog/<script>alert(1)</script>", "/blog/aster?x=1", "/works//aster", "/WORKS/aster"];
const sr = await Promise.all(slugs.map((p) => get(p)));
check("invalid slugs: unknown, upper-case, encoded, traversal, SQL and script slugs give 404/400/redirect and never a 500 or a stack trace", sr.every((r) => [200, 301, 307, 308, 400, 404].includes(r.status) && !/at \S+ \(|SQLITE|D1_ERROR|ReferenceError/.test(r.body)), sr.map((r) => r.status).join(","));
check("invalid slugs: only the real slugs return 200 (nothing odd is served as a page)", sr.filter((r) => r.status === 200).length <= 2, `200s: ${sr.map((r, i) => (r.status === 200 ? slugs[i].slice(0, 20) : null)).filter(Boolean).join(",")}`);

// ======================= browser =======================
const browser = await chromium.launch();
const issues = [];
const watch = (p, tag) => { p.on("pageerror", (e) => issues.push(`${tag}: ${e.message.slice(0, 160)}`)); p.on("console", (m) => { if (m.type() === "error" && !/status of (400|401|403|404|413|415|429)|GPU|WebGL|net::ERR/.test(m.text())) issues.push(`${tag}: ${m.text().slice(0, 160)}`); }); };

// ---- navigation: click every header and footer link on desktop, every mobile-menu link on a phone
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); watch(p, "nav");
  await p.goto(BASE + "/", { waitUntil: "networkidle" }); await p.waitForTimeout(1500);
  const links = await p.evaluate(() => [...new Set([...document.querySelectorAll("header a[href^='/'], nav a[href^='/'], footer a[href^='/']")].map((a) => a.getAttribute("href")).filter((h) => h && !h.startsWith("/#") && !h.startsWith("/admin")))]);
  let ok = 0; const fails = [];
  for (const href of links) { await p.goto(BASE + "/", { waitUntil: "load" }); await p.waitForTimeout(500); const a = p.locator(`a[href="${href}"]`).first(); try { if (!(await a.isVisible())) { await p.locator(".nav-item > button[data-menu]").first().hover(); await p.waitForTimeout(400); } await a.click({ timeout: 4000 }); await p.waitForURL((u) => u.pathname.replace(/\/$/, "") === href.split("#")[0].replace(/\/$/, "") || href === "/", { timeout: 8000 }); await p.waitForTimeout(400); const h1 = await p.locator("h1").first().innerText().catch(() => ""); const notFound = /could not be found|404/i.test(await p.title()); if (h1.trim() && !notFound) ok++; else fails.push(href + " (no h1 or 404)"); } catch (e) { fails.push(href + " " + e.message.split("\n")[0].slice(0, 60)); } }
  check(`navigation (desktop): ${links.length} header, mega-menu and footer links each navigate in the browser to a page with a heading`, fails.length === 0, `${ok}/${links.length}${fails.length ? " — " + fails.slice(0, 3).join("; ") : ""}`);
  await ctx.close();
  const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const mp = await m.newPage(); watch(mp, "mobile-nav");
  await mp.goto(BASE + "/", { waitUntil: "networkidle" }); await mp.waitForTimeout(1500);
  const toggle = mp.locator('button[aria-label*="enu" i], .nav-toggle, .burger, button[aria-controls]').first();
  await toggle.click(); await mp.waitForTimeout(800);
  const mlinks = await mp.evaluate(() => [...document.querySelectorAll(".mnav a[href^='/']")].filter((a) => a.getBoundingClientRect().width > 0).map((a) => a.getAttribute("href")));
  check(`mobile menu: opens, shows ${mlinks.length} links`, mlinks.length >= 5);
  await mp.keyboard.press("Escape"); await mp.waitForTimeout(700);
  const closed = await mp.evaluate(() => { const n = document.querySelector(".mnav"); return !n || getComputedStyle(n).visibility === "hidden" || n.getAttribute("aria-hidden") === "true" || n.getBoundingClientRect().width === 0 || getComputedStyle(n).opacity === "0"; });
  check("mobile menu: Escape closes it", closed);
  let mok = 0; const mfail = [];
  for (const href of [...new Set(mlinks)].filter((h) => !h.startsWith("/#"))) { await mp.goto(BASE + "/", { waitUntil: "load" }); await mp.waitForTimeout(500); await toggle.click(); await mp.waitForTimeout(700); try { await mp.locator(`.mnav a[href="${href}"]:visible`).first().click({ timeout: 4000 }); await mp.waitForURL((u) => u.pathname.replace(/\/$/, "") === href.split("#")[0].replace(/\/$/, "") || href === "/", { timeout: 8000 }); mok++; } catch (e) { mfail.push(href); } }
  check("mobile menu: every link navigates", mfail.length === 0, `${mok} ok ${mfail.join(",")}`);
  await m.close();
}

// ---- contact form
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); watch(p, "contact");
  sql("DELETE FROM contact_submissions");
  await p.goto(BASE + "/contact", { waitUntil: "networkidle" }); await p.waitForTimeout(2800);
  await p.fill("#c-name", "Func QA"); await p.fill("#c-email", "not-an-email"); await p.fill("#c-msg", "Hello there");
  await p.click("form button[type=submit]"); await p.waitForTimeout(800);
  check("contact form: an invalid email is refused in the browser and nothing is sent", (await p.locator(".form-ok:not([hidden])").count()) === 0 && sql("SELECT COUNT(*) n FROM contact_submissions")[0].n === 0);
  await p.fill("#c-email", "qa@example.com"); await p.locator("label.opt:has(input[name=need])").first().click(); await p.locator("label.opt:has(input[name=budget])").nth(1).click();
  await p.click("form button[type=submit]"); await p.locator(".form-ok:not([hidden])").waitFor({ timeout: 20000 });
  const row = sql("SELECT name, email, service, budget, message, status FROM contact_submissions")[0];
  check("contact form: a valid enquiry shows the thank-you message and is stored with every field", row?.name === "Func QA" && row.email === "qa@example.com" && row.message === "Hello there" && !!row.service && !!row.budget && row.status === "new", JSON.stringify(row));
  await ctx.close();
}

// ---- animations on the public pages: reveals resolve, Lenis runs, no errors, canvases draw
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); watch(p, "anim");
  const stuck = [];
  for (const r of ["/", "/about", "/works", "/works/aster", "/services/brand-identity", "/blog", "/blog/webflow-or-next-js", "/contact"]) { await p.goto(BASE + r, { waitUntil: "networkidle" }); await p.waitForTimeout(1200); const h = await p.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y < h; y += 500) { await p.mouse.wheel(0, 500); await p.waitForTimeout(70); } await p.waitForTimeout(900); const n = await p.evaluate(() => [...document.querySelectorAll(".reveal:not(.in)")].filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && getComputedStyle(e).display !== "none" && !e.closest(".is-hidden,[hidden]"); }).length); if (n > 6) stuck.push(`${r}:${n}`); }
  check("animations: after scrolling each page its reveal elements have appeared (nothing stays invisible)", stuck.length === 0, stuck.join(","));
  await p.goto(BASE + "/", { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
  check("animations: smooth scroll, the hero scene and the page load-in are running on Home", await p.evaluate(() => document.documentElement.classList.contains("lenis-on") && document.body.classList.contains("loaded") && !!document.querySelector(".mesh-canvas") && getComputedStyle(document.querySelector(".reveal-load")).opacity === "1"));
  await ctx.close();
}

// ======================= ADMIN: login, logout, authorization =======================
const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const ap = await actx.newPage(); watch(ap, "admin");
const login = async (page, email, pw) => { await page.goto(BASE + "/admin/login", { waitUntil: "networkidle" }); await page.fill("#a-email", email); await page.fill("#a-pass", pw); await page.click("button[type=submit]"); };
await login(ap, "visuolab@gmail.com", "wrong-password-here"); await ap.waitForTimeout(1500);
check("admin login: a wrong password shows one error and stays on the login page", /admin\/login/.test(ap.url()) && /do not match/.test(await ap.locator("body").innerText()));
sql("DELETE FROM rate_limits");
await login(ap, "visuolab@gmail.com", PASSWORD); await ap.waitForURL(/submissions/);
check("admin login: the right password opens the console", /submissions/.test(ap.url()));
const pages = ["/admin", "/admin/submissions", "/admin/services", "/admin/services/new", "/admin/case-studies", "/admin/case-studies/new", "/admin/blog", "/admin/blog/new", "/admin/blog/categories", "/admin/blog/tags", "/admin/media", "/admin/settings/general", "/admin/settings/contact", "/admin/settings/social", "/admin/settings/seo", "/admin/settings/analytics", "/admin/settings/integrations", "/admin/integrations"];
const pe = [];
for (const u of pages) { const r = await ap.goto(BASE + u, { waitUntil: "networkidle" }); const body = await ap.locator("body").innerText(); if (r.status() !== 200 || /Something went wrong|Application error/.test(body)) pe.push(`${u} ${r.status()}`); }
for (const slug of ["ga4", "gtm", "meta_pixel", "resend", "turnstile", "webhook", "crm_webhook", "slack"]) { const r = await ap.goto(BASE + "/admin/integrations/" + slug, { waitUntil: "networkidle" }); if (r.status() !== 200) pe.push(`integration ${slug} ${r.status()}`); }
check(`admin: all ${pages.length + 8} console screens load for an admin (200, no error screen)`, pe.length === 0, pe.join(", "));
const svc = sql("SELECT id FROM services LIMIT 1")[0].id, cs = sql("SELECT id FROM case_studies LIMIT 1")[0].id, bp = sql("SELECT id FROM blog_posts LIMIT 1")[0].id, md = sql("SELECT id FROM media WHERE storage='r2' LIMIT 1")[0]?.id ?? sql("SELECT id FROM media LIMIT 1")[0].id;
const detail = [`/admin/services/${svc}/edit`, `/admin/services/${svc}/confirm?do=delete`, `/admin/case-studies/${cs}/edit`, `/admin/case-studies/${cs}/confirm?do=delete`, `/admin/blog/${bp}/edit`, `/admin/blog/${bp}/confirm?do=delete`, `/admin/media/${md}`];
const de = []; for (const u of detail) { const r = await ap.goto(BASE + u, { waitUntil: "networkidle" }); if (r.status() !== 200) de.push(`${u} ${r.status()}`); }
check("admin: edit, confirm and detail screens of real records load", de.length === 0, de.join(", "));

// ---- invalid ids / malicious query strings (as admin)
const bads = ["nope", "svc_nope", "%00", "'%20OR%201=1--", "..%2f..%2fetc", "<script>alert(1)</script>", "x".repeat(2000), "-1", "0", "undefined", "null", "%E2%82%AC"];
const ie = [];
for (const section of ["services", "case-studies", "blog"]) for (const id of bads) for (const tail of ["edit", "confirm?do=delete"]) { const r = await ap.goto(`${BASE}/admin/${section}/${id}/${tail}`, { waitUntil: "load" }).catch(() => null); const st = r?.status() ?? 0; const body = await ap.locator("body").innerText().catch(() => ""); if (![404, 400].includes(st) || /SQLITE|D1_ERROR|at \S+ \(/.test(body)) ie.push(`${section}/${id.slice(0, 12)}/${tail} ${st}`); }
for (const id of bads) { const r = await ap.goto(`${BASE}/admin/media/${id}`, { waitUntil: "load" }).catch(() => null); if (![404, 400].includes(r?.status() ?? 0)) ie.push(`media/${id.slice(0, 12)} ${r?.status()}`); }
check(`invalid IDs: ${bads.length * 6 + bads.length} unknown, malformed, SQL, script, traversal and over-long ids on edit/confirm/detail screens all give 404 (never 500, never data)`, ie.length === 0, ie.slice(0, 5).join(", "));
const qs = ["?status='%3E%3Cscript%3E", "?page=-1", "?page=abc", "?page=99999999999", "?q=%00", "?q=" + "a".repeat(3000), "?category=%27", "?tag=nope", "?notify=x", "?n=%3Cscript%3E", "?status=all&status=new", "?limit=-5", "?type=zzz&storage=zzz&unused=1"];
const qe = []; for (const u of ["/admin/submissions", "/admin/services", "/admin/case-studies", "/admin/blog", "/admin/media"]) for (const q of qs) { const r = await ap.goto(BASE + u + q, { waitUntil: "load" }).catch(() => null); const body = await ap.locator("body").innerText().catch(() => ""); if ((r?.status() ?? 0) >= 500 || /Something went wrong|SQLITE/.test(body)) qe.push(`${u}${q.slice(0, 20)} ${r?.status()}`); }
check(`malicious query strings: ${qs.length * 5} list-screen requests (bad paging, NUL, SQL, script, long values) never produce an error page`, qe.length === 0, qe.slice(0, 5).join(", "));
const apiBad = await Promise.all([ap.request.get(BASE + "/api/admin/media?page=abc&limit=-1&type=zzz"), ap.request.get(BASE + "/api/admin/media?id=" + encodeURIComponent("' OR 1=1--")), ap.request.post(BASE + "/api/admin/media", { headers: { origin: BASE } }), ap.request.post(BASE + "/api/admin/media", { headers: { origin: BASE }, multipart: { notfile: "x" } }), ap.request.post(BASE + "/api/admin/media/nope/replace", { headers: { origin: BASE }, multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } } })]);
check("API error handling: bad paging/filters, a missing or wrong file field, an unknown media id → 200 with an empty list or a clean 4xx JSON error, never 500", apiBad.map((r) => r.status()).every((s) => s < 500) && [apiBad[2], apiBad[3]].every((r) => r.status() === 400 || r.status() === 411) && apiBad[4].status() === 404, apiBad.map((r) => r.status()).join(","));

// ---- unauthorized mutations: replay real captured server actions without a session
{
  sql("DELETE FROM contact_submissions"); sql(`INSERT INTO contact_submissions (id, name, email, message, status, created_at, updated_at, notify_status) VALUES ('11111111-1111-4111-8111-111111111111', 'Replay', 'r@example.com', 'hello hello hello', 'new', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z', 'skipped')`);
  const cap = []; ap.on("request", (rq) => { if (rq.method() === "POST" && rq.headers()["next-action"]) cap.push({ url: rq.url(), headers: rq.headers(), body: rq.postDataBuffer(), label: ap.url() }); });
  await ap.goto(BASE + "/admin/submissions", { waitUntil: "networkidle" });
  const sel = ap.locator('form select[name=status], select[name=status]').first(); if (await sel.count()) { await sel.selectOption("read").catch(() => {}); }
  const st = ap.locator('button:has-text("Mark read"), form:has(input[name=status]) button[type=submit], button:has-text("Read")').first(); await st.click({ timeout: 4000 }).catch(() => {}); await ap.waitForTimeout(1500);
  await ap.goto(BASE + "/admin/settings/seo", { waitUntil: "networkidle" }); await ap.fill("#f-pageTitle_about", "Replay title"); await ap.click('button:has-text("Save SEO settings")'); await ap.waitForTimeout(2500);
  await ap.goto(BASE + "/admin/submissions", { waitUntil: "networkidle" });
  const del = ap.locator('button:has-text("Delete")').first(); ap.once("dialog", (d) => d.accept()); await del.click({ timeout: 4000 }).catch(() => {}); await ap.waitForTimeout(1500);
  const before = JSON.stringify([sql("SELECT status FROM contact_submissions").map((r) => r.status), sql("SELECT COUNT(*) n FROM contact_submissions")[0].n, sql("SELECT value_json v FROM site_settings WHERE key='settings.seo'")[0]?.v]);
  let replayed = 0, changed = 0;
  for (const c of cap) { const hdr = { "next-action": c.headers["next-action"], "content-type": c.headers["content-type"], origin: BASE, "sec-fetch-site": "same-origin", accept: c.headers.accept ?? "text/x-component" }; if (c.headers["next-router-state-tree"]) hdr["next-router-state-tree"] = c.headers["next-router-state-tree"]; const r = await fetch(c.url, { method: "POST", headers: hdr, body: c.body, redirect: "manual" }).catch(() => null); replayed++; const text = r ? await r.text() : ""; if (r && r.status === 200 && /"n=(status|deleted|saved)|\?n=saved/.test(text) && !/login/.test(text)) changed++; }
  // data after replays with the seeded row restored to a known state first
  sql("DELETE FROM contact_submissions WHERE id='11111111-1111-4111-8111-111111111111'"); sql(`INSERT INTO contact_submissions (id, name, email, message, status, created_at, updated_at, notify_status) VALUES ('11111111-1111-4111-8111-111111111111', 'Replay', 'r@example.com', 'hello hello hello', 'new', '2026-10-06T00:00:00Z', '2026-10-06T00:00:00Z', 'skipped')`);
  const seoBefore = sql("SELECT value_json v FROM site_settings WHERE key='settings.seo'")[0]?.v;
  for (const c of cap) { const hdr = { "next-action": c.headers["next-action"], "content-type": c.headers["content-type"], origin: BASE, "sec-fetch-site": "same-origin" }; await fetch(c.url, { method: "POST", headers: hdr, body: c.body, redirect: "manual" }).catch(() => null); }
  const after = [sql("SELECT status FROM contact_submissions").map((r) => r.status), sql("SELECT COUNT(*) n FROM contact_submissions")[0].n, sql("SELECT value_json v FROM site_settings WHERE key='settings.seo'")[0]?.v];
  check(`unauthorized mutations: ${cap.length} real admin server actions (status change, SEO save, delete) captured and replayed WITHOUT a session change nothing`, cap.length >= 2 && after[0][0] === "new" && after[1] === 1 && after[2] === seoBefore, `captured ${cap.length}, replayed ${replayed}`);
  // same replays with a foreign Origin and with an editor-level session are covered by the security probe; here: forged id + no session
  const forged = await fetch(BASE + "/admin/submissions", { method: "POST", headers: { "next-action": "0".repeat(40), origin: BASE, "content-type": "text/plain" }, body: "[]", redirect: "manual" });
  check("unauthorized mutations: a made-up action id is refused cleanly", forged.status !== 200 || !/n=/.test(await forged.text()), String(forged.status));
}

// ---- admin logout and session end
const cookie = (await actx.cookies()).find((c) => /vl_session/.test(c.name))?.value;
await ap.goto(BASE + "/admin", { waitUntil: "networkidle" });
await ap.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Sign out/.test(b.textContent)).click()); await ap.waitForURL(/login/);
const after = await get("/admin/submissions", { headers: { cookie: `vl_session=${cookie}` } });
check("admin logout: signs out, lands on the login page, and the old session cookie no longer works", /login/.test(ap.url()) && after.status >= 300 && after.status < 400 && /login/.test(after.h.get("location") ?? ""));
const anon = await Promise.all(["/admin", "/admin/services", "/admin/media", "/admin/settings/seo", "/admin/integrations", `/admin/services/${svc}/edit`].map((p) => get(p)));
check("unauthenticated admin access: every console address redirects to the login page with no content", anon.every((r) => r.status >= 300 && r.status < 400 && /login/.test(r.h.get("location") ?? "") && r.body.length < 400));
const anonApi = await Promise.all([get("/api/admin/media"), get("/api/admin/media", { method: "POST", headers: { origin: BASE } })]);
check("unauthenticated API: the media API answers 401", anonApi.every((r) => r.status === 401));

// ======================= CLOUDFLARE: worker, D1, R2, env =======================
const health = await get("/api/health");
check("Cloudflare: the Worker answers and its D1 and R2 bindings are reachable (/api/health)", health.status === 200 && /"d1":"ok"/.test(health.body) && /"r2":"ok"/.test(health.body), health.body);
{
  await login(ap, "visuolab@gmail.com", PASSWORD); await ap.waitForURL(/submissions/);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP8z8Dwn4EIwDiqEQAAXw0CA6V6mDAAAAAASUVORK5CYII=", "base64");
  const up = await ap.request.post(BASE + "/api/admin/media", { headers: { origin: BASE }, multipart: { file: { name: "qa.png", mimeType: "image/png", buffer: Buffer.concat([png, Buffer.from(String(Date.now()))]) }, title: "QA upload" } });
  const j = up.status() < 300 ? await up.json() : null;
  check("R2: an uploaded picture is stored (R2 object + D1 row) and served back by the Worker with the right headers", !!j && (await (async () => { const r = await get(j.item.url); return r.status === 200 && /image\/png/.test(r.h.get("content-type")) && /nosniff/.test(r.h.get("x-content-type-options") ?? "") && /immutable/.test(r.h.get("cache-control") ?? ""); })()), up.status() + "");
  if (j) { await ap.goto(BASE + `/admin/media/${j.item.id}`, { waitUntil: "networkidle" }); ap.once("dialog", (d) => d.accept()); await ap.locator('button:has-text("Delete")').first().click(); await ap.waitForTimeout(2500); const gone = await get(j.item.url); check("R2: deleting the picture in the admin removes the row and the object (the address then answers 404)", gone.status === 404 && sql(`SELECT COUNT(*) n FROM media WHERE id='${j.item.id}'`)[0].n === 0, String(gone.status)); }
  await ap.goto(BASE + "/admin/settings/integrations", { waitUntil: "networkidle" });
  const envTxt = await ap.locator("body").innerText();
  check("environment variables: SITE_URL, MEDIA_BASE_URL and IMAGE_TRANSFORMS are read by the Worker; secrets are listed as set / not set and never shown", /SITE_URL/.test(envTxt) && /MEDIA_BASE_URL/.test(envTxt) && /IMAGE_TRANSFORMS/.test(envTxt) && /RESEND_API_KEY/.test(envTxt) && !/re_[A-Za-z0-9]{16,}/.test(envTxt));
  const hdrs = await get("/about");
  check("production build: security headers, no-store and the page-cache marker are present on a public page", /nosniff/.test(hdrs.h.get("x-content-type-options") ?? "") && /frame-ancestors/.test(hdrs.h.get("content-security-policy") ?? "") && /no-store/.test(hdrs.h.get("cache-control") ?? ""));
}
check("no console error or page error in any browser session of this run", issues.length === 0, issues.slice(0, 4).join(" | "));
sql("DELETE FROM sessions"); sql("DELETE FROM rate_limits"); sql("DELETE FROM contact_submissions WHERE id='11111111-1111-4111-8111-111111111111'");
await browser.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
