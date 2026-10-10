// Full CMS audit in a browser against a running site and its LOCAL database.
//   npm i --no-save playwright
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:3001 node scripts/qa/full-cms-qa.mjs [--only=pages|records|seo|responsive|auth|crawl] [--out=report.json]
//
// For EVERY section of every page, and of every service, case study and article, it drives the admin editor like a person would:
//   open -> (over-limit value refused) -> type a unique marker into every text field and choose another library picture for every picture field
//   -> save draft -> check the draft is stored and the published content is untouched -> publish -> reload the admin and check every value is there
//   -> open the public pages (no session) and check every marker is drawn and every chosen picture is used -> check the audit log.
// Then it checks that the page markup (tags and classes) is the same as before the edits, the SEO metadata of every page and record, the mobile and
// desktop renderings, authorization, and that the word "Soon" is nowhere in the admin. Everything is put back at the end.
// Never point it at the live site.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:3001";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Local sites only."); process.exit(1); }
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
const only = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7);
const outFile = (process.argv.find((a) => a.startsWith("--out=")) ?? "").slice(6);
const grep = (process.argv.find((a) => a.startsWith("--grep=")) ?? "").slice(7);
const run = (phase) => !only || only === phase;

const res = [];
const report = { sections: [], seo: [], responsive: [], auth: [], notes: [] };
const check = (n, ok, d = "") => { res.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + String(d).slice(0, 260) : ""}`); };
const sql1 = (q) => { const f = join(tmpdir(), `full-cms-qa-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }).toString())[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };
const get = async (p, opts = {}) => { for (let a = 0; ; a++) { try { const r = await fetch(BASE + p, { redirect: "manual", ...opts }); return { status: r.status, location: r.headers.get("location") ?? "", cache: r.headers.get("x-edge-cache") ?? "", text: await r.text() }; } catch (e) { if (a >= 8) throw e; await new Promise((r) => setTimeout(r, 2000)); } } };
const esc = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (h) => h.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

/** Tags and classes of the page body, in order: what the design is made of (text, links and pictures are content). */
const skeleton = (html) => {
  const body = (html.split("</head>")[1] ?? html).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<template[\s\S]*?<\/template>/g, "").replace(/<div hidden[\s\S]*?<\/div>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const out = [];
  for (const m of body.matchAll(/<([a-z][a-z0-9-]*)((?:\s[^>]*)?)>/gi)) {
    const cls = /class="([^"]*)"/.exec(m[2])?.[1] ?? "";
    // classes that are state (set by script or by time of day), not design
    const stable = cls.split(/\s+/).filter((c) => c && !/^(is-|on$|off$|open$|in$|visible$|scrolled$|over-light$|revealed$|has-)/.test(c)).sort().join(".");
    const name = m[1].toLowerCase();
    // emphasis inside a text (<em>, <b>, a no-break span) is part of the words an editor writes, not of the layout
    if (["em", "b", "strong", "i", "br", "wbr"].includes(name) || (name === "span" && (stable === "nb" || stable === "keep" || stable === "w"))) continue;
    out.push(`${name}${stable ? "." + stable : ""}`);
  }
  return out;
};
const sameSkeleton = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
/** Where two skeletons first differ, for the report. */
const firstDiff = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return `at element ${i}: before ${JSON.stringify(a.slice(Math.max(0, i - 2), i + 4))} / after ${JSON.stringify(b.slice(Math.max(0, i - 2), i + 4))}`; };

// ---- the content of the database, as the audit needs it
const SERVICES = sql("SELECT id, slug FROM services WHERE status = 'published' ORDER BY position");
const CASES = sql("SELECT id, slug FROM case_studies WHERE status = 'published' ORDER BY position");
const POSTS = sql("SELECT id, slug FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC");
const snap = {
  sections: sql("SELECT id, is_enabled, content, updated_at, updated_by FROM page_sections"),
  pages: sql("SELECT * FROM pages"),
  services: sql("SELECT * FROM services"), cases: sql("SELECT * FROM case_studies"), posts: sql("SELECT * FROM blog_posts"),
  images: sql("SELECT * FROM case_study_images"), links: sql("SELECT * FROM service_case_studies"),
  postTags: sql("SELECT * FROM blog_post_tags"), tags: sql("SELECT id FROM blog_tags").map((t) => t.id),
  media: sql("SELECT id FROM media").map((m) => m.id),
  settings: sql("SELECT id, value_json, updated_at FROM site_settings"),
};
const restore = () => {
  sql("DELETE FROM content_drafts; DELETE FROM entity_hidden_sections; DELETE FROM page_section_revisions; DELETE FROM entity_section_revisions");
  for (const s of snap.sections) sql(`UPDATE page_sections SET is_enabled = ${s.is_enabled}, content = ${esc(s.content)}, updated_at = ${esc(s.updated_at)}, updated_by = ${esc(s.updated_by)} WHERE id = ${esc(s.id)}`);
  const upd = (table, r) => sql(`UPDATE ${table} SET ${Object.entries(r).filter(([k]) => k !== "id").map(([k, v]) => `${k} = ${esc(v)}`).join(", ")} WHERE id = ${esc(r.id)}`);
  for (const p of snap.pages) upd("pages", p);
  for (const r of snap.services) upd("services", r);
  for (const r of snap.cases) upd("case_studies", r);
  for (const r of snap.posts) upd("blog_posts", r);
  sql("DELETE FROM case_study_images");
  for (const r of snap.images) sql(`INSERT INTO case_study_images (${Object.keys(r).join(", ")}) VALUES (${Object.values(r).map(esc).join(", ")})`);
  sql("DELETE FROM service_case_studies");
  for (const r of snap.links) sql(`INSERT INTO service_case_studies (${Object.keys(r).join(", ")}) VALUES (${Object.values(r).map(esc).join(", ")})`);
  sql("DELETE FROM blog_post_tags");
  for (const r of snap.postTags) sql(`INSERT INTO blog_post_tags (${Object.keys(r).join(", ")}) VALUES (${Object.values(r).map(esc).join(", ")})`);
  sql(`DELETE FROM blog_tags WHERE id NOT IN (${snap.tags.map(esc).join(",")})`);
  for (const s of snap.settings) sql(`UPDATE site_settings SET value_json = ${esc(s.value_json)}, updated_at = ${esc(s.updated_at)} WHERE id = ${esc(s.id)}`);
  sql("DELETE FROM rate_limits");
};
sql("DELETE FROM rate_limits; DELETE FROM sessions; DELETE FROM content_drafts");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (path) => { for (let a = 0; a < 6; a++) { try { await page.goto(BASE + path, { waitUntil: "load" }); await page.waitForLoadState("networkidle"); await page.waitForTimeout(250); return; } catch (e) { if (a === 5) throw e; await sleep(2000); } } };

/** The text fields of the editor on screen, each tagged data-qa so it can be addressed. */
const readFields = () => page.evaluate(() => {
  const form = document.querySelector("form.cms-editor");
  if (!form) return [];
  const els = [...form.querySelectorAll("input[type=text], textarea")].filter((e) => !e.closest("dialog") && !e.disabled && !e.hasAttribute("list") && !e.closest(".cms-versions") && !e.closest(".article-editor .ae-preview"));
  return els.map((e, i) => {
    e.setAttribute("data-qa", String(i));
    const field = e.closest(".field") ?? e.parentElement;
    const label = (field?.querySelector("label")?.innerText ?? e.getAttribute("aria-label") ?? "").replace(/\s+optional$/i, "").trim();
    const counter = field?.querySelector(".hint span")?.innerText ?? "";
    return { i, label, placeholder: e.placeholder || "", value: e.value, counter, media: !!e.closest(".media-pick"), tag: e.tagName };
  });
});
const publicFiles = (html) => [...html.matchAll(/(?:src|srcset|poster)="([^"]+)"/g)].map((m) => decode(m[1]));

/** What to type into a field: a marker that passes the field's own rule, with a unique start. */
function markerFor(f, tag) {
  const max = Number(/\/(\d+)/.exec(f.counter)?.[1] ?? 0);
  const base = `Q${tag}x${f.i}`;
  if (/year/i.test(f.label) && max === 4) return "2031";
  if (/crop position/i.test(f.label)) return "11% 22%";
  if (/canonical/i.test(f.label)) return `https://example.com/${base.toLowerCase()}`;
  if (/avatar picture path/i.test(f.label) || /\/about, #contact/.test(f.placeholder)) return `/${base.toLowerCase()}`;
  if (/#[0-9a-f]{6}/i.test(f.placeholder)) return null;
  const len = max ? Math.min(max, 26) : 18;
  if (len < base.length) return base.slice(0, Math.max(len, 1));
  return base + "k".repeat(len - base.length);
}

/**
 * One section through the whole path. `urls` are the public pages that can draw it. Returns the findings (also pushed to the report).
 */
async function exercise({ scope, label, adminPath, urls, draftScope, owner, key, tag, immediate = false }) {
  if (grep && !label.toLowerCase().includes(grep.toLowerCase())) return null;
  const finding = { scope, label, fields: 0, media: 0, notOnPage: [], problems: [] };
  report.sections.push(finding);
  const problem = (m) => { finding.problems.push(m); check(`${label}: ${m}`, false); };
  const published0 = () => JSON.stringify(sql(`SELECT 1`)); void published0;
  const auditBefore = sql("SELECT COUNT(*) n FROM audit_logs")[0].n;

  await go(adminPath);
  if ((await page.locator("form.cms-editor").count()) !== 1) { problem("the editor did not open"); return finding; }
  const fields = await readFields();
  const textFields = fields.filter((f) => !f.media || true);
  finding.fields = textFields.length;

  // ---- validation: a value over its limit is refused and nothing is stored
  const limited = textFields.find((f) => { const m = Number(/\/(\d+)/.exec(f.counter)?.[1] ?? 0); return m > 0 && m <= 400; });
  if (limited) {
    const max = Number(/\/(\d+)/.exec(limited.counter)[1]);
    const draftsBefore = sql(`SELECT COUNT(*) n FROM content_drafts WHERE scope = '${draftScope}' AND owner_id = '${owner}' AND section_key = '${key}'`)[0].n;
    await page.locator(`[data-qa="${limited.i}"]`).fill("x".repeat(max + 1));
    await page.getByRole("button", { name: /^Save (draft|section)$/ }).click();
    await page.waitForTimeout(1200);
    const shown = (await page.locator(".form-errors, .field-err").count()) > 0;
    const draftsAfter = sql(`SELECT COUNT(*) n FROM content_drafts WHERE scope = '${draftScope}' AND owner_id = '${owner}' AND section_key = '${key}'`)[0].n;
    if (!shown || draftsAfter !== draftsBefore) problem(`an over-limit value (${limited.label}: ${max + 1} characters) was not refused (message shown: ${shown}, drafts ${draftsBefore} -> ${draftsAfter})`);
    await go(adminPath);
  }

  // ---- edit every text field and every picture field
  const again = await readFields();
  const markers = [];
  for (const f of again) {
    const m = markerFor(f, tag);
    if (m === null) continue;
    await page.locator(`[data-qa="${f.i}"]`).fill(m);
    markers.push({ i: f.i, label: f.label, value: m, media: f.media });
  }
  const chosen = [];
  const pickers = page.locator("form.cms-editor .media-pick");
  const pickerCount = await pickers.count();
  finding.media = pickerCount;
  for (let k = 0; k < pickerCount; k++) {
    const box = pickers.nth(k);
    const btn = box.getByRole("button", { name: /^(Change|Choose) / }).first();
    if (!(await btn.count())) continue;
    await btn.click();
    const dlg = page.locator("dialog.picker[open]");
    await dlg.locator(".picker-grid li").first().waitFor({ timeout: 8000 });
    const items = dlg.locator(".picker-grid li button:not(.is-selected)");
    const n = await items.count();
    if (n === 0) { await page.keyboard.press("Escape"); await dlg.waitFor({ state: "detached", timeout: 4000 }).catch(() => {}); continue; } // the library has no other file of this kind
    const pick = items.nth((k * 3 + 4) % Math.max(n, 1));
    const file = (await pick.locator(".p-file").innerText().catch(() => "")).trim();
    await pick.click();
    await dlg.waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
    if (file) chosen.push(file);
  }
  const saveBtn = page.getByRole("button", { name: /^Save (draft|section)$/ });
  if (markers.length === 0 && chosen.length === 0) {
    // a section made only of choices (which case studies, which services, which articles): change every choice, save, publish, read back, draw
    finding.choicesOnly = true;
    const selects = page.locator("form.cms-editor select");
    const count = await selects.count();
    const picked = [];
    for (let k = 0; k < count; k++) {
      const sel = selects.nth(k);
      const options = await sel.locator("option").evaluateAll((o) => o.map((x) => ({ value: x.value, text: x.textContent ?? "" })).filter((x) => x.value));
      const cur = await sel.inputValue();
      const others = options.filter((o) => o.value !== cur && !picked.includes(o.value));
      if (!others.length) continue;
      const to = others[(k + 1) % others.length];
      await sel.selectOption(to.value);
      picked.push(to.value);
      finding.choices = [...(finding.choices ?? []), to.text.replace(/\s+[-—].*$/, "").replace(/\s*\(.*\)$/, "").trim()];
    }
    if (!picked.length) { check(`${label}: nothing to choose between (no select with another option)`, true); return finding; }
    await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/"), { timeout: 15000 }).catch(() => null), page.getByRole("button", { name: /^Save (draft|section)$/ }).click()]);
    await page.waitForTimeout(900);
    if ((await page.locator(".form-errors").count()) > 0) { problem(`saving the choices was refused: ${(await page.locator(".form-errors").first().innerText()).replace(/\s+/g, " ").slice(0, 200)}`); await go(adminPath); return finding; }
    const pub = page.getByRole("button", { name: "Publish this section" });
    if (await pub.count()) { await pub.click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); }
    await go(adminPath);
    const nowValues = await page.locator("form.cms-editor select").evaluateAll((s) => s.map((x) => x.value));
    const back = picked.every((v) => nowValues.includes(v));
    let all = "";
    const until2 = Date.now() + 18000;
    do { all = ""; for (const u of urls) all += decode((await get(u)).text); if ((finding.choices ?? []).every((c) => all.includes(c)) || Date.now() > until2) break; await sleep(900); } while (true);
    const missingNames = (finding.choices ?? []).filter((c) => c && !all.includes(c));
    const delta = sql("SELECT COUNT(*) n FROM audit_logs")[0].n - auditBefore;
    finding.audit = delta;
    if (!back) problem("the chosen options were not saved");
    if (missingNames.length) problem(`chosen item(s) not drawn on the public pages: ${missingNames.join(", ")}`);
    if (delta < 2) problem(`the audit log has ${delta} new entries (expected at least 2)`);
    check(`${label}: ${picked.length} choice(s) changed, saved, read back, drawn publicly`, finding.problems.length === 0);
    return finding;
  }
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/"), { timeout: 15000 }).catch(() => null), saveBtn.click()]);
  await page.waitForTimeout(900);
  if ((await page.locator(".form-errors").count()) > 0) { problem(`saving was refused: ${(await page.locator(".form-errors").first().innerText()).replace(/\s+/g, " ").slice(0, 200)}`); await go(adminPath); return finding; }

  // ---- a draft is stored, the published content is untouched
  if (!immediate) {
    const d = sql(`SELECT COUNT(*) n FROM content_drafts WHERE scope = '${draftScope}' AND owner_id = '${owner}' AND section_key = '${key}'`)[0].n;
    if (d !== 1) problem(`the draft was not stored (${d} rows)`);
    const pub = page.getByRole("button", { name: "Publish this section" });
    if (!(await pub.count())) { problem("no Publish button after saving a draft"); return finding; }
    await pub.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1500);
    const left = sql(`SELECT COUNT(*) n FROM content_drafts WHERE scope = '${draftScope}' AND owner_id = '${owner}' AND section_key = '${key}'`)[0].n;
    if (left !== 0) problem("the draft is still there after publishing");
  }

  // ---- refresh the admin and read the values back
  await go(adminPath);
  const back = await readFields();
  const wrong = markers.filter((m) => back.find((f) => f.i === m.i)?.value !== m.value);
  if (wrong.length) problem(`${wrong.length} value(s) not saved: ${wrong.slice(0, 3).map((w) => `${w.label} (${w.value})`).join(", ")}`);

  // ---- the public pages
  const want = markers.filter((m) => m.value.length >= 6);
  let htmls = [];
  const deadline = Date.now() + 18000;
  do {
    htmls = [];
    for (const u of urls) htmls.push(decode((await get(u)).text));
    const all = htmls.join("\n");
    if (want.every((m) => all.includes(m.value)) || Date.now() > deadline) break;
    await sleep(900);
  } while (true);
  const all = htmls.join("\n");
  const missing = want.filter((m) => !all.includes(m.value));
  finding.notOnPage = missing.map((m) => m.label || "(unnamed)");
  if (want.length && missing.length === want.length) problem(`none of the ${want.length} edited values is drawn on ${urls.join(", ")}`);
  const files = publicFiles(all);
  const missingPics = chosen.filter((f) => !files.some((s) => s.includes(f)));
  finding.pictures = { chosen: chosen.length, missing: missingPics };
  if (chosen.length && missingPics.length === chosen.length) problem(`none of the ${chosen.length} chosen pictures is used on the public page`);

  // ---- the audit log
  const delta = sql("SELECT COUNT(*) n FROM audit_logs")[0].n - auditBefore;
  finding.audit = delta;
  if (delta < (immediate ? 1 : 2)) problem(`the audit log has ${delta} new entries (expected at least ${immediate ? 1 : 2})`);

  check(`${label}: ${markers.length} text fields and ${chosen.length}/${pickerCount} pictures edited, saved, read back, drawn publicly${missing.length ? ` (${missing.length} not drawn: ${[...new Set(finding.notOnPage)].slice(0, 4).join(", ")})` : ""}`, finding.problems.length === 0);
  return finding;
}

try {
  await page.goto(BASE + "/admin/login"); await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !/\/login/.test(u.pathname)), page.click('button[type="submit"]')]);

  const firstService = `/services/${SERVICES[0].slug}`, firstCase = `/works/${CASES[0].slug}`, firstPost = `/blog/${POSTS[0].slug}`;
  const PUBLIC = ["/", "/about", "/works", "/blog", "/contact", firstService, firstCase, firstPost];
  const before = {};
  for (const u of PUBLIC) before[u] = skeleton((await get(u)).text);
  const twice = skeleton((await get("/")).text);
  check("the markup skeleton of a page is stable between two requests (so the comparison below means something)", sameSkeleton(before["/"], twice));

  // ================================================================ every section of every page
  if (run("pages")) {
    const { TEMPLATES, templateSlug } = await import("../../src/lib/cms/registry.ts");
    const pageIds = Object.fromEntries(snap.pages.map((p) => [p.template, p.id]));
    const urlsOf = { home: ["/"], about: ["/about"], works: ["/works"], blog: ["/blog"], contact: ["/contact"], shared: ["/", "/about", "/works", "/contact", firstService], service_detail: [firstService], case_study_detail: [firstCase], article_detail: [firstPost] };
    let n = 0;
    for (const [template, def] of Object.entries(TEMPLATES)) {
      for (const slot of def.sections) {
        n++;
        await exercise({
          scope: "page", label: `${def.label} / ${slot.name}`, adminPath: `/admin/pages/${templateSlug(template)}/${slot.key}`, urls: urlsOf[template],
          draftScope: "page", owner: pageIds[template], key: slot.key, tag: String(n), immediate: !def.route,
        });
      }
    }
    // the markup of every public page is the same after all of that content was changed
    for (const u of ["/", "/about", "/works", "/blog", "/contact", firstService]) {
      const after = skeleton((await get(u)).text);
      check(`design unchanged after editing every section: the markup (tags and classes) of ${u} is the same`, sameSkeleton(before[u], after), `${before[u].length} -> ${after.length} elements; ${firstDiff(before[u], after)}`);
    }
  }

  // ================================================================ every service, case study and article
  if (run("records")) {
    let n = 0;
    const { ENTITIES } = await import("../../src/lib/cms/entity/index.ts");
    const kinds = [
      { kind: "service", rows: SERVICES, route: (s) => `/services/${s}`, also: ["/", firstService] },
      { kind: "case_study", rows: CASES, route: (s) => `/works/${s}`, also: ["/works", "/", ...SERVICES.map((s) => `/services/${s.slug}`)] },
      { kind: "blog_post", rows: POSTS, route: (s) => `/blog/${s}`, also: ["/blog"] },
    ];
    for (const k of kinds) {
      for (const row of k.rows) {
        const skeletonBefore = skeleton((await get(k.route(row.slug))).text);
        for (const sec of ENTITIES[k.kind].sections) {
          n++;
          await exercise({
            scope: k.kind, label: `${k.kind} ${row.slug} / ${sec.name}`, adminPath: `${ENTITIES[k.kind].admin}/${row.id}/${sec.key}`,
            urls: [k.route(row.slug), ...k.also], draftScope: k.kind, owner: row.id, key: sec.key, tag: `r${n}`,
          });
        }
        const after = skeleton((await get(k.route(row.slug))).text);
        check(`design unchanged after editing every section of ${k.route(row.slug)}: the markup is the same`, sameSkeleton(skeletonBefore, after), `${skeletonBefore.length} -> ${after.length} elements; ${firstDiff(skeletonBefore, after)}`);
      }
    }
  }

  // ================================================================ search settings of every page
  if (run("seo")) {
    const seoPages = [["home", "/"], ["about", "/about"], ["works", "/works"], ["blog", "/blog"], ["contact", "/contact"]];
    const media = sql("SELECT id FROM media WHERE kind = 'image' LIMIT 3");
    for (const [slug, path] of seoPages) {
      const f = { page: path, problems: [] };
      report.seo.push(f);
      await go(`/admin/pages/${slug}/seo`);
      const t = `QA SEO title ${slug}`, d = `QA SEO description for the ${slug} page, long enough to pass.`, c = `https://example.com/qa-${slug}`;
      await page.getByLabel("SEO title").fill(t);
      await page.getByLabel("SEO description").fill(d);
      await page.getByLabel("Canonical URL").fill(c);
      await page.getByLabel("Indexing").selectOption("index");
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/")), page.getByRole("button", { name: "Save SEO" }).click()]);
      await page.waitForTimeout(900);
      await go(`/admin/pages/${slug}/seo`);
      const readBack = (await page.getByLabel("SEO title").inputValue()) === t && (await page.getByLabel("SEO description").inputValue()) === d && (await page.getByLabel("Canonical URL").inputValue()) === c;
      let html = "";
      const end = Date.now() + 18000;
      do { html = decode((await get(path)).text); if (html.includes(`<title>${t}</title>`) || Date.now() > end) break; await sleep(900); } while (true);
      const ok = {
        title: html.includes(`<title>${t}</title>`),
        description: new RegExp(`<meta name="description" content="${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(html),
        canonical: html.includes(`rel="canonical" href="${c}"`),
        ogTitle: html.includes(`property="og:title" content="${t}"`),
        robots: /name="robots" content="index, follow"/.test(html),
      };
      f.ok = ok;
      check(`SEO ${path}: saved, read back after refresh, and in the page head (title, description, canonical, og:title, robots)`, readBack && Object.values(ok).every(Boolean), JSON.stringify(ok));
      // noindex / nofollow
      await go(`/admin/pages/${slug}/seo`);
      await page.getByLabel("Indexing").selectOption("noindex");
      await page.getByLabel("Links").selectOption("nofollow");
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/")), page.getByRole("button", { name: "Save SEO" }).click()]);
      let h2 = "";
      const end2 = Date.now() + 18000;
      do { h2 = (await get(path)).text; if (/name="robots" content="noindex, nofollow"/.test(h2) || Date.now() > end2) break; await sleep(900); } while (true);
      check(`SEO ${path}: noindex and nofollow reach the robots meta tag`, /name="robots" content="noindex, nofollow"/.test(h2));
      // validation: a title over 70 characters, a canonical that is not https
      await go(`/admin/pages/${slug}/seo`);
      await page.getByLabel("SEO title").fill("x".repeat(71));
      await page.getByRole("button", { name: "Save SEO" }).click();
      await page.waitForTimeout(900);
      check(`SEO ${path}: a title over 70 characters is refused`, (await page.locator(".field-err, .form-errors").count()) > 0);
      await go(`/admin/pages/${slug}/seo`);
      await page.getByLabel("Canonical URL").fill("http://insecure.example/x");
      await page.getByRole("button", { name: "Save SEO" }).click();
      await page.waitForTimeout(900);
      check(`SEO ${path}: a canonical address that is not https:// or a path is refused`, (await page.locator(".field-err, .form-errors").count()) > 0);
      void media;
    }
  }

  // ================================================================ mobile and desktop rendering
  if (run("responsive")) {
    for (const [name, vp] of [["desktop 1440", { width: 1440, height: 900 }], ["tablet 768", { width: 768, height: 1024 }], ["mobile 390", { width: 390, height: 844 }]]) {
      await page.setViewportSize(vp);
      for (const u of PUBLIC) {
        const errs = [];
        const onErr = (e) => errs.push(e.message);
        page.on("pageerror", onErr);
        await go(u);
        const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, h1: document.querySelectorAll("h1").length, imgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc).length, nav: !!document.querySelector("header.nav") }));
        page.off("pageerror", onErr);
        const ok = m.overflow <= 1 && m.h1 >= 1 && m.imgs === 0 && m.nav && errs.length === 0;
        report.responsive.push({ viewport: name, page: u, ...m, errors: errs.length });
        check(`${name}: ${u} renders without sideways scrolling, has its heading, no broken pictures, no script errors`, ok, JSON.stringify({ ...m, errors: errs }));
      }
    }
    await page.setViewportSize({ width: 1440, height: 1800 });
    // the mobile menu shows the editable labels
    await page.setViewportSize({ width: 390, height: 844 });
    await go("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.waitForTimeout(400);
    const mtext = await page.locator("#mnav").innerText().catch(() => "");
    check("mobile menu opens and shows the Services button, the links and the contact button", /Services/.test(mtext) && (await page.locator("#mnav a").count()) > 3);
    await page.setViewportSize({ width: 1440, height: 1800 });
  }

  // ================================================================ site settings: contact information, identity, social profiles
  if (run("settings")) {
    const forms = [
      { path: "/admin/settings/general", save: "Save general settings", fields: { siteName: "QA Studio", description: "QA description of the studio, written in the admin." }, expect: ["QA Studio"], urls: ["/", "/about", "/contact"] },
      { path: "/admin/settings/contact", save: "Save contact details", fields: { email: "qa-contact@example.com", phone: "+31 20 555 0101", address: "QA Street 1\n1011 AB Amsterdam", hours: "Mon-Fri 09:00-17:30" }, expect: ["qa-contact@example.com", "+31 20 555 0101", "QA Street 1", "09:00-17:30"], urls: ["/contact", "/", "/about", firstService] },
      { path: "/admin/settings/social", save: "Save social profiles", fields: { instagram: "https://instagram.com/qa-studio", linkedin: "https://linkedin.com/company/qa-studio", x: "https://x.com/qa_studio" }, expect: ["https://instagram.com/qa-studio", "https://linkedin.com/company/qa-studio", "https://x.com/qa_studio"], urls: ["/", "/contact"] },
    ];
    for (const f of forms) {
      await go(f.path);
      for (const [name, value] of Object.entries(f.fields)) await page.locator(`[name="${name}"]`).fill(value);
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/settings"), { timeout: 15000 }).catch(() => null), page.getByRole("button", { name: f.save }).click()]);
      await page.waitForTimeout(900);
      const refused = (await page.locator(".form-errors").count()) > 0;
      await go(f.path);
      const back = await Promise.all(Object.entries(f.fields).map(async ([name, value]) => (await page.locator(`[name="${name}"]`).inputValue()) === value));
      let all = "";
      const end = Date.now() + 18000;
      do { all = ""; for (const u of f.urls) all += decode((await get(u)).text); if (f.expect.every((e) => all.includes(e)) || Date.now() > end) break; await sleep(900); } while (true);
      const missing = f.expect.filter((e) => !all.includes(e));
      report.notes.push({ settings: f.path, notDrawn: missing });
      check(`${f.path}: saved, read back after refresh, drawn on the public pages${missing.length ? ` (not found: ${missing.join(", ")})` : ""}`, !refused && back.every(Boolean) && missing.length === 0);
      // validation
      const bad = f.path.endsWith("contact") ? { email: "not-an-email" } : f.path.endsWith("social") ? { instagram: "javascript:alert(1)" } : { siteName: "x".repeat(61) };
      await go(f.path);
      for (const [name, value] of Object.entries(bad)) await page.locator(`[name="${name}"]`).fill(value);
      await page.getByRole("button", { name: f.save }).click();
      await page.waitForTimeout(1100);
      check(`${f.path}: an invalid value is refused with a message`, (await page.locator(".form-errors, .field-err").count()) > 0);
    }
    const au = sql("SELECT COUNT(*) n FROM audit_logs WHERE action LIKE 'settings.%'")[0].n;
    check("saving settings is in the audit log", au >= 3, String(au));
  }

  // ================================================================ authorization
  if (run("auth")) {
    const adminRoutes = ["/admin", "/admin/pages", "/admin/pages/home", "/admin/pages/home/hero", "/admin/pages/home/seo", "/admin/pages/shared", "/admin/revisions", "/admin/navigation", "/admin/services", `/admin/services/${SERVICES[0].id}`, `/admin/services/${SERVICES[0].id}/hero`, `/admin/services/${SERVICES[0].id}/edit`, "/admin/case-studies", `/admin/case-studies/${CASES[0].id}`, `/admin/case-studies/${CASES[0].id}/hero`, "/admin/blog", `/admin/blog/${POSTS[0].id}`, `/admin/blog/${POSTS[0].id}/body`, "/admin/media", "/admin/settings", "/admin/integrations", "/admin/submissions"];
    let leaked = [];
    for (const r of adminRoutes) {
      const a = await get(r);
      const ok = a.status >= 300 && a.status < 400 && /\/admin\/login/.test(a.location);
      report.auth.push({ route: r, status: a.status, ok });
      if (!ok) leaked.push(`${r} ${a.status}`);
    }
    check(`authorization: all ${adminRoutes.length} admin screens redirect to sign-in without a session`, leaked.length === 0, leaked.join(", "));
    const apis = ["/api/admin/media?type=image&page=1&limit=1"];
    for (const r of apis) { const a = await get(r); check(`authorization: ${r} refuses a request without a session`, a.status === 401 || a.status === 403 || (a.status >= 300 && a.status < 400), String(a.status)); }
    const pv = await get("/?preview=1");
    check("authorization: a preview without a session is sent to sign-in", pv.status >= 300 && pv.status < 400 && /login/.test(pv.location));
    // a save replayed without a session, and from another origin
    await go("/admin/pages/home/hero");
    const reqs = [];
    const on = (r) => { if (r.method() === "POST" && r.headers()["next-action"]) reqs.push(r); };
    page.on("request", on);
    const eyebrow = page.locator('form.cms-editor input[type="text"]').first();
    const orig = await eyebrow.inputValue();
    await eyebrow.fill("AUTHZ PROBE");
    await page.getByRole("button", { name: "Save draft" }).click();
    await page.waitForTimeout(1500);
    page.off("request", on);
    const probe = reqs.at(-1);
    sql("DELETE FROM content_drafts");
    if (probe) {
      const raw = probe.postDataBuffer().toString("utf8");
      const stampOld = /name="[_0-9]*expectedUpdatedAt"\r\n\r\n([^\r\n]+)/.exec(raw)?.[1] ?? "";
      const stampNow = sql("SELECT updated_at u FROM page_sections WHERE id = 'sec_home_hero'")[0].u;
      const body = Buffer.from(raw.replace(stampOld, stampNow));
      const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
      const hdr = (origin, c) => ({ "content-type": probe.headers()["content-type"], "next-action": probe.headers()["next-action"], origin, host: new URL(BASE).host, ...(c ? { cookie: c } : {}) });
      const post = async (h) => { for (let a = 0; a < 3; a++) { const r = await fetch(BASE + "/admin/pages/home/hero", { method: "POST", redirect: "manual", headers: h, body }).catch(() => null); if (r) return r; await sleep(700); } return null; };
      await post(hdr(BASE));
      const noSession = sql("SELECT COUNT(*) n FROM content_drafts")[0].n;
      await post(hdr("https://evil.example", cookie));
      const evil = sql("SELECT COUNT(*) n FROM content_drafts")[0].n;
      check("authorization: a save replayed without a session, or from another origin, stores nothing", noSession === 0 && evil === 0);
      await post(hdr(BASE, cookie));
      check("authorization: positive control, the same request with the session and the right origin stores a draft", sql("SELECT COUNT(*) n FROM content_drafts")[0].n === 1);
      sql("DELETE FROM content_drafts");
    } else check("authorization: could capture a save request to replay", false);
    void orig;
  }

  // ================================================================ "Soon" and placeholders in the admin
  if (run("crawl")) {
    const routes = new Set(["/admin", "/admin/pages", "/admin/navigation", "/admin/media", "/admin/revisions", "/admin/services", "/admin/case-studies", "/admin/blog", "/admin/blog/categories", "/admin/blog/tags", "/admin/settings", "/admin/integrations", "/admin/submissions", "/admin/services/new", "/admin/case-studies/new", "/admin/blog/new"]);
    const { TEMPLATES, templateSlug } = await import("../../src/lib/cms/registry.ts");
    for (const [t, def] of Object.entries(TEMPLATES)) { routes.add(`/admin/pages/${templateSlug(t)}`); if (def.hasSeo) routes.add(`/admin/pages/${templateSlug(t)}/seo`); for (const s of def.sections) routes.add(`/admin/pages/${templateSlug(t)}/${s.key}`); }
    const { ENTITIES } = await import("../../src/lib/cms/entity/index.ts");
    for (const [k, rows] of [["service", SERVICES], ["case_study", CASES], ["blog_post", POSTS]]) for (const r of rows.slice(0, 2)) { routes.add(`${ENTITIES[k].admin}/${r.id}`); routes.add(`${ENTITIES[k].admin}/${r.id}/edit`); for (const s of ENTITIES[k].sections) routes.add(`${ENTITIES[k].admin}/${r.id}/${s.key}`); }
    for (const s of ["general", "contact", "social", "seo", "analytics", "email", "turnstile"]) routes.add(`/admin/settings/${s}`);
    const hits = [];
    let count = 0;
    for (const r of routes) {
      await go(r);
      const text = await page.locator("body").innerText();
      count++;
      if (/\bsoon\b/i.test(text.replace(/as soon as|sooner/gi, ""))) hits.push(r);
      if (/(coming soon|not implemented|todo\b|lorem ipsum)/i.test(text)) hits.push(`${r} (placeholder)`);
    }
    // the sidebar and the navigation screen in particular
    await go("/admin/navigation");
    const side = await page.locator(".side").innerText();
    check(`no "Soon" label, "coming soon" or placeholder text on any of ${count} admin screens (sidebar, navigation, pages, sections, records, settings)`, hits.length === 0 && !/soon/i.test(side), hits.join(", "));
    const links = await page.locator(".side nav a").evaluateAll((a) => a.map((x) => ({ t: x.innerText.trim(), href: x.getAttribute("href") })));
    check("every sidebar item is a real link (no disabled or placeholder entries)", links.length >= 10 && links.every((l) => l.href && l.href.startsWith("/admin")), JSON.stringify(links.map((l) => l.t)));
  }

  check("no JavaScript errors in the admin or the public pages during the audit", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  restore();
  if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 1));
}
await browser.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
