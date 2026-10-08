// End-to-end test of the section visibility controls (Enabled / Disabled) against a running local site and its LOCAL database.
//   npm i --no-save playwright
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:3001 node scripts/qa/visibility-qa.mjs
// For blocks of the static pages and of a service, a case study and an article: the switch, the confirmation before an important section is switched
// off, that the content stays stored, that the public page stops drawing the block and draws it again when it is switched on, the audit log, and
// that the server refuses to switch off an important section without the confirmation. Everything is put back afterwards. Never point it at the live site.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:3001";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Local sites only."); process.exit(1); }
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
const res = [];
const check = (n, ok, d = "") => { res.push(!!ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + String(d).slice(0, 240) : ""}`); };
const sql1 = (q) => { const f = join(tmpdir(), `visibility-qa-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };
const html = async (p) => { for (let a = 0; ; a++) { try { return (await (await fetch(BASE + p)).text()).replace(/<!--[\s\S]*?-->/g, ""); } catch (e) { if (a >= 5) throw e; await new Promise((r) => setTimeout(r, 1500)); } } };
/** Polls a public page until the condition holds (the cached HTML is refreshed by the content version). */
const until = async (path, cond, ms = 15000) => { const end = Date.now() + ms; let h = ""; do { h = await html(path); if (cond(h)) return true; await new Promise((r) => setTimeout(r, 700)); } while (Date.now() < end); return false; };
const esc = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`);

const SVC = "svc_brand-identity", CASE = "case_orbit", POST = "post_design-systems-that-survive";
const snap = {
  sections: sql("SELECT id, is_enabled, content, updated_at FROM page_sections"),
  svc: sql(`SELECT * FROM services WHERE id = '${SVC}'`)[0], case: sql(`SELECT * FROM case_studies WHERE id = '${CASE}'`)[0], post: sql(`SELECT * FROM blog_posts WHERE id = '${POST}'`)[0],
};
const row = (table, id) => JSON.stringify(sql(`SELECT * FROM ${table} WHERE id = '${id}'`)[0]);
const hiddenRows = () => sql("SELECT entity_type, entity_id, section_key FROM entity_hidden_sections");
sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions"); sql("DELETE FROM entity_hidden_sections");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); await page.waitForTimeout(300); };
const card = (name) => page.locator("ol.section-cards li").filter({ has: page.locator("h3", { hasText: new RegExp(`^${name.replace(/[()]/g, "\\$&")}$`) }) });
const sw = (name) => card(name).locator("button[role=switch]");
const posted = [];
page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) posted.push(r); });
const settle = async () => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(800); };

const strip = (s) => s.replace(/"updated_at":"[^"]*"|"updated_by":(null|"[^"]*")/g, "");
const noFlag = (s) => strip(s).replace(/"is_enabled":\d/g, "");
/** One block: switch it off (through the confirmation when it is important), check, switch it on, check. */
async function exercise({ label, admin, name, important, publicPath, marker, stored, beforeStored, inRecord = false }) {
  await go(admin);
  check(`${label}: the card has a switch and starts Enabled`, (await sw(name).count()) === 1 && (await sw(name).getAttribute("aria-checked")) === "true" && (await card(name).innerText()).includes("Enabled"));
  check(`${label}: the page draws it`, await until(publicPath, (h) => marker(h)));
  const before = beforeStored();
  await sw(name).click();
  if (important) {
    const dlg = page.locator("dialog[open]");
    check(`${label}: an important section asks first, saying what visitors lose and that nothing is deleted`, (await dlg.count()) === 1 && /Switch off/.test(await dlg.innerText()) && (await dlg.innerText()).length > 120 && /Nothing is deleted/.test(await dlg.innerText()));
    await dlg.getByRole("button", { name: "Keep it on" }).click();
    await settle();
    check(`${label}: "Keep it on" changes nothing`, stored() === before && (await sw(name).getAttribute("aria-checked")) === "true" && marker(await html(publicPath)));
    await sw(name).click();
    await page.locator("dialog[open]").getByRole("button", { name: "Switch off" }).click();
  } else {
    check(`${label}: an ordinary section switches off without a question`, (await page.locator("dialog[open]").count()) === 0);
  }
  await settle();
  check(`${label}: it shows as Disabled with its card dimmed`, (await sw(name).getAttribute("aria-checked")) === "false" && (await card(name).innerText()).includes("Disabled") && /is-off/.test((await card(name).getAttribute("class")) ?? ""));
  check(`${label}: it stays stored: ${inRecord ? "only its switch changed, the content is untouched" : "the record is not touched at all (a row in the hidden list says it is off)"}`, noFlag(stored()) === noFlag(before) && (inRecord ? stored() !== before : stored() === before));
  check(`${label}: the public page no longer draws it, and still renders`, await until(publicPath, (h) => !marker(h) && h.includes("</html>")));
  await sw(name).click(); // enabling never asks
  await settle();
  check(`${label}: switching it on again does not ask, and the block is back`, (await page.locator("dialog[open]").count()) === 0 && (await sw(name).getAttribute("aria-checked")) === "true" && (await until(publicPath, (h) => marker(h))));
  check(`${label}: after on and off again the stored record is as it was`, strip(stored()) === strip(before));
}

const pageRow = (id) => () => JSON.stringify(sql(`SELECT is_enabled, content FROM page_sections WHERE id = '${id}'`)[0]);
const pageStored = (id) => () => JSON.stringify(sql(`SELECT * FROM page_sections WHERE id = '${id}'`)[0]);
void pageRow;

try {
  await page.goto(BASE + "/admin/login"); await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !/\/login/.test(u.pathname)), page.click('button[type="submit"]')]);

  // ---------------------------------------------------------------- static pages
  const S = (id) => pageStored(id);
  const pg = [
    { label: "Home / Why us", admin: "/admin/pages/home", name: "Why us and numbers", important: false, publicPath: "/", marker: (h) => h.includes('id="why"'), stored: S("sec_home_why") },
    { label: "Home / Hero", admin: "/admin/pages/home", name: "Hero", important: true, publicPath: "/", marker: (h) => h.includes('class="scroll-sequence"'), stored: S("sec_home_hero") },
    { label: "Home / Services", admin: "/admin/pages/home", name: "Services", important: true, publicPath: "/", marker: (h) => h.includes('id="services"'), stored: S("sec_home_services") },
    { label: "Home / Our cases", admin: "/admin/pages/home", name: "Our cases", important: true, publicPath: "/", marker: (h) => h.includes('id="work"'), stored: S("sec_home_work") },
    { label: "About / Hero", admin: "/admin/pages/about", name: "Hero", important: true, publicPath: "/about", marker: (h) => h.includes('class="about-hero"'), stored: S("sec_about_hero") },
    { label: "About / Careers", admin: "/admin/pages/about", name: "Careers", important: true, publicPath: "/about", marker: (h) => h.includes('id="careers"'), stored: S("sec_about_careers") },
    { label: "Works / Case study grid", admin: "/admin/pages/works", name: "Case study grid", important: true, publicPath: "/works", marker: (h) => h.includes("works-grid-sec"), stored: S("sec_works_grid") },
    { label: "Works / Hero and filters", admin: "/admin/pages/works", name: "Hero and filters", important: true, publicPath: "/works", marker: (h) => h.includes('class="works-hero"'), stored: S("sec_works_hero") },
    { label: "Blog / Featured article", admin: "/admin/pages/blog", name: "Featured article", important: false, publicPath: "/blog", marker: (h) => h.includes("featured-sec"), stored: S("sec_blog_featured") },
    { label: "Blog / Article grid", admin: "/admin/pages/blog", name: "Article grid", important: true, publicPath: "/blog", marker: (h) => h.includes("posts-sec"), stored: S("sec_blog_grid") },
    { label: "Contact / Form", admin: "/admin/pages/contact", name: "Form", important: true, publicPath: "/contact", marker: (h) => h.includes('id="form"'), stored: S("sec_contact_form") },
    { label: "Contact / Intro", admin: "/admin/pages/contact", name: "Intro", important: true, publicPath: "/contact", marker: (h) => h.includes('class="contact-intro"'), stored: S("sec_contact_intro") },
    { label: "Shared / Closing call to action", admin: "/admin/pages/shared", name: "Closing call to action", important: true, publicPath: "/about", marker: (h) => h.includes('<section class="cta"'), stored: S("sec_shared_cta") },
  ];
  for (const t of pg) await exercise({ ...t, beforeStored: t.stored, inRecord: true });

  // locked: not blocks
  await go("/admin/pages/shared");
  const lockedNames = ["Reviews", "Trusted-by names", "Rating line", "Footer extras"];
  check("shared lists and the footer extras are not blocks: no switch, and the card says why", (await Promise.all(lockedNames.map(async (n) => (await sw(n).count()) === 0 && /always/.test(await card(n).innerText())))).every(Boolean));
  await go("/admin/pages/case-study-detail");
  check("the page-label sets have no switch", (await page.locator("ol.section-cards li button[role=switch]").count()) === 0);

  // the server insists on the confirmation (a request that skips the dialog)
  await go("/admin/pages/home");
  await sw("Why us and numbers").click();
  await settle();
  const req = posted.filter((r) => r.url().includes("/admin/pages/home")).at(-1);
  const raw = req.postDataBuffer().toString("utf8");
  await sw("Why us and numbers").click(); // on again
  await settle();
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const hdr = { "content-type": req.headers()["content-type"], "next-action": req.headers()["next-action"], origin: BASE, host: new URL(BASE).host, cookie };
  const heroBody = Buffer.from(raw.replace(/(name="[_0-9]*key"\r\n\r\n)why(\r\n)/, "$1hero$2"));
  check("the replayed request really asks for the hero", heroBody.toString().includes("\r\n\r\nhero\r\n"));
  await fetch(BASE + "/admin/pages/home", { method: "POST", redirect: "manual", headers: hdr, body: heroBody });
  check("server: switching off an important section without the confirmation is refused, the section stays on", sql("SELECT is_enabled e FROM page_sections WHERE id = 'sec_home_hero'")[0].e === 1);
  const whyBody = Buffer.from(raw);
  await fetch(BASE + "/admin/pages/home", { method: "POST", redirect: "manual", headers: hdr, body: whyBody });
  check("positive control: the same request for an ordinary section (no confirmation needed) does switch it off", sql("SELECT is_enabled e FROM page_sections WHERE id = 'sec_home_why'")[0].e === 0);
  sql("UPDATE page_sections SET is_enabled = 1 WHERE id = 'sec_home_why'");

  // audit
  {
    const au = sql("SELECT summary FROM audit_logs WHERE action = 'cms.section.toggle' ORDER BY created_at DESC LIMIT 40").map((r) => r.summary);
    check("every switch is in the audit log: who/what, hidden or shown", au.some((s) => /hidden$/.test(s)) && au.some((s) => /shown$/.test(s)));
  }

  // ---------------------------------------------------------------- case study
  const caseBase = `/admin/case-studies/${CASE}`;
  const cs = () => row("case_studies", CASE);
  const imgs = () => JSON.stringify(sql(`SELECT * FROM case_study_images WHERE case_study_id = '${CASE}' ORDER BY id`));
  const csStored = () => cs() + imgs();
  const caseTests = [
    { label: "Case study / Challenge", name: "Challenge", important: false, marker: (h) => h.includes('id="challenges-title"') },
    { label: "Case study / Results", name: "Results", important: false, marker: (h) => h.includes('id="results-title"') },
    { label: "Case study / Introduction", name: "Introduction", important: false, marker: (h) => h.includes('id="about-title"') },
    { label: "Case study / Approach", name: "Approach", important: false, marker: (h) => h.includes('id="chapters-title"') },
    { label: "Case study / Related work", name: "Related work", important: false, marker: (h) => h.includes('id="more-title"') },
    { label: "Case study / Wide image", name: "Wide image", important: false, marker: (h) => h.includes('class="wide-sec"') },
    { label: "Case study / Project details", name: "Project details", important: false, marker: (h) => h.includes('<dl class="meta') },
    { label: "Case study / Hero", name: "Hero", important: true, marker: (h) => h.includes('id="case-title"') },
  ];
  for (const t of caseTests) await exercise({ ...t, admin: caseBase, publicPath: "/works/orbit", stored: csStored, beforeStored: csStored });
  {
    await go(caseBase);
    const gal = (h) => (h.match(/class="gallery-sec"/g) ?? []).length;
    const n0 = gal(await html("/works/orbit"));
    const imgCount = sql(`SELECT COUNT(*) n FROM case_study_images WHERE case_study_id = '${CASE}'`)[0].n;
    await sw("First gallery").click(); await settle();
    check("Case study / First gallery: switching it off removes one of the two galleries, the pictures stay stored", await until("/works/orbit", (h) => gal(h) === n0 - 1) && sql(`SELECT COUNT(*) n FROM case_study_images WHERE case_study_id = '${CASE}'`)[0].n === imgCount);
    await sw("First gallery").click(); await settle();
    check("Case study / First gallery: and back", await until("/works/orbit", (h) => gal(h) === n0));
    await sw("Second gallery").click(); await settle();
    check("Case study / Second gallery: switching it off removes the other gallery", await until("/works/orbit", (h) => gal(h) === n0 - 1));
    await sw("Second gallery").click(); await settle();
  }
  await go(caseBase);
  check("a case study's cards, service links and search settings are not blocks of the page: no switch, and they say why", (await Promise.all(["Card on the Works page", "Card on service pages and Home", "Shown on service pages", "Search engines (SEO)"].map(async (n) => (await sw(n).count()) === 0 && /always/.test(await card(n).innerText())))).every(Boolean));
  check("nothing is left hidden after the case study tests", hiddenRows().filter((r) => r.entity_type === "case_study").length === 0);

  // ---------------------------------------------------------------- service
  const svcBase = `/admin/services/${SVC}`;
  const svcStored = () => row("services", SVC);
  for (const t of [
    { label: "Service / Overview", name: "Overview", important: false, marker: (h) => h.includes('id="ov-title"') },
    { label: "Service / Outcomes", name: "Outcomes", important: false, marker: (h) => h.includes('id="out-title"') },
    { label: "Service / What is included", name: "What is included", important: false, marker: (h) => h.includes('id="incl-title"') },
    { label: "Service / Process", name: "Process", important: false, marker: (h) => h.includes('id="proc-title"') },
    { label: "Service / Case studies", name: "Case studies", important: false, marker: (h) => h.includes('id="cases-title"') },
    { label: "Service / Hero", name: "Hero", important: true, marker: (h) => h.includes('id="svc-title"') },
  ]) await exercise({ ...t, admin: svcBase, publicPath: "/services/brand-identity", stored: svcStored, beforeStored: svcStored });
  {
    await go(svcBase);
    check("Service: 'What we fix' (it has its own flag) is still hidden and switches on through the same control", (await sw("What we fix").getAttribute("aria-checked")) === "false");
    await sw("What we fix").click(); await settle();
    check("Service: switching 'What we fix' on sets its flag and the page draws it visibly", sql(`SELECT show_problems p FROM services WHERE id = '${SVC}'`)[0].p === 1 && (await until("/services/brand-identity", (h) => !/prob-sec"[^>]*hidden/.test(h))));
    await sw("What we fix").click(); await settle();
    check("Service: and off again", sql(`SELECT show_problems p FROM services WHERE id = '${SVC}'`)[0].p === 0);
  }
  await go(svcBase);
  check("a service's search settings are not a block: no switch", (await sw("Search engines (SEO)").count()) === 0);
  check("nothing is left hidden after the service tests", hiddenRows().filter((r) => r.entity_type === "service").length === 0);

  // ---------------------------------------------------------------- article
  const postBase = `/admin/blog/${POST}`;
  const postStored = () => row("blog_posts", POST);
    for (const t of [
    { label: "Article / Opening paragraph", name: "Opening paragraph", important: false, marker: (h) => h.includes('class="post-lead"') },
    { label: "Article / Closing line", name: "Closing line", important: false, marker: (h) => h.includes('class="outro"') },
    { label: "Article / More from the studio", name: "More from the studio", important: false, marker: (h) => h.includes('id="more-title"') },
    { label: "Article / Cover picture", name: "Cover picture", important: false, marker: (h) => h.includes('class="post-cover') },
    { label: "Article / Article body", name: "Article body", important: true, marker: (h) => (h.match(/<h2 id=/g) ?? []).length > 1 },
    { label: "Article / Headline and byline", name: "Headline and byline", important: true, marker: (h) => h.includes('class="post-hero"') },
  ]) await exercise({ ...t, admin: postBase, publicPath: "/blog/design-systems-that-survive", stored: postStored, beforeStored: postStored });
  await go(postBase);
  check("an article's listing card and search settings are not blocks of the article: no switch", (await Promise.all(["Listing card and tags", "Search engines (SEO)"].map(async (n) => (await sw(n).count()) === 0))).every(Boolean));

  // the section editor of a hidden section says so; and it can still be edited
  await sw("Closing line").click(); await settle();
  await go(`${postBase}/closing-line`);
  check("a hidden section can still be edited, and its screen says it is hidden on the website", (await page.locator("body").innerText()).includes("hidden on the website") && (await page.locator("form.cms-editor").count()) === 1);
  await go(postBase);
  await sw("Closing line").click(); await settle();

  // server insists for entities too
  await go(caseBase);
  await sw("Challenge").click(); await settle();
  const ereq = posted.filter((r) => r.url().includes("/admin/case-studies")).at(-1);
  const eraw = ereq.postDataBuffer().toString("utf8");
  await sw("Challenge").click(); await settle();
  const ehdr = { "content-type": ereq.headers()["content-type"], "next-action": ereq.headers()["next-action"], origin: BASE, host: new URL(BASE).host, cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ") };
  await fetch(BASE + caseBase, { method: "POST", redirect: "manual", headers: ehdr, body: Buffer.from(eraw.replace(/(name="[_0-9]*key"\r\n\r\n)challenges(\r\n)/, "$1hero$2")) });
  check("server: an important case study section is not switched off without the confirmation", hiddenRows().filter((r) => r.entity_type === "case_study" && r.section_key === "hero").length === 0);
  await fetch(BASE + caseBase, { method: "POST", redirect: "manual", headers: ehdr, body: Buffer.from(eraw.replace(/(name="[_0-9]*key"\r\n\r\n)challenges(\r\n)/, "$1seo$2")) });
  check("server: a locked section (search settings) cannot be switched off at all", hiddenRows().length === 0);
  await fetch(BASE + caseBase, { method: "POST", redirect: "manual", headers: { ...ehdr, cookie: "" }, body: Buffer.from(eraw) });
  check("server: without a session nothing changes", hiddenRows().length === 0);
  {
    const au = sql("SELECT summary FROM audit_logs WHERE action = 'case_study.section.toggle' ORDER BY created_at DESC LIMIT 30").map((r) => r.summary);
    check("entity switches are in the audit log", au.some((s) => /Challenge: hidden$/.test(s)) && au.some((s) => /Challenge: shown$/.test(s)), au[0]);
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await go(caseBase);
  await sw("Results").click(); await settle();
  check("on a phone the overview does not scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await sw("Hero").click();
  check("on a phone the confirmation fits the screen", await page.evaluate(() => { const d = document.querySelector("dialog[open]"); if (!d) return false; const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }));
  await page.locator("dialog[open]").getByRole("button", { name: "Keep it on" }).click();
  check("no JavaScript errors in the browser", errors.length === 0, errors.join(" | "));
} finally {
  sql("DELETE FROM entity_hidden_sections");
  for (const s of snap.sections) sql(`UPDATE page_sections SET is_enabled = ${s.is_enabled}, content = ${esc(s.content)}, updated_at = ${esc(s.updated_at)} WHERE id = ${esc(s.id)}`);
  for (const [table, r] of [["services", snap.svc], ["case_studies", snap.case], ["blog_posts", snap.post]]) sql(`UPDATE ${table} SET ${Object.entries(r).filter(([k]) => k !== "id").map(([k, v]) => `${k} = ${esc(v)}`).join(", ")} WHERE id = ${esc(r.id)}`);
  sql("DELETE FROM rate_limits");
}
await browser.close();
check("everything restored", JSON.stringify([sql("SELECT id, is_enabled, content FROM page_sections ORDER BY id"), sql("SELECT * FROM entity_hidden_sections")]) === JSON.stringify([snap.sections.map(({ id, is_enabled, content }) => ({ id, is_enabled, content })).sort((a, b) => (a.id < b.id ? -1 : 1)), []]));
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
