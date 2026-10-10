// End-to-end test of content revisions (previous versions, restore, recent changes) against a running local site and its LOCAL database.
//   npm i --no-save playwright
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:3001 node scripts/qa/revisions-qa.mjs
// A page section (Home / Hero) and a case study section (Orbit / Hero) are changed twice; each change stores the previous content, the new content, who
// changed it and when. The previous version is then restored from the admin: it must be an ordinary checked save, kept as a new version, and audited.
// Never point it at the live site.
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
const sql1 = (q) => { const f = join(tmpdir(), `revisions-qa-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };
const html = async (p) => { for (let a = 0; ; a++) { try { return (await (await fetch(BASE + p)).text()).replace(/<!--[\s\S]*?-->/g, ""); } catch (e) { if (a >= 5) throw e; await new Promise((r) => setTimeout(r, 1500)); } } };
const esc = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`);

const CASE = "case_orbit";
const snap = { hero: sql("SELECT * FROM page_sections WHERE id = 'sec_home_hero'")[0], case: sql(`SELECT * FROM case_studies WHERE id = '${CASE}'`)[0] };
sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions"); sql("DELETE FROM page_section_revisions"); sql("DELETE FROM entity_section_revisions");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); await page.waitForTimeout(300); };
const publishIfDraft = async () => { const pub = page.getByRole("button", { name: "Publish this section" }); if ((await pub.count()) && (await pub.isEnabled())) { await pub.click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); } }; // a save is a draft; the tests check the published result
const save = async () => { await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/")), page.getByRole("button", { name: /^Save (draft|section)$/ }).click()]); await page.waitForTimeout(600); await publishIfDraft(); };
const L = (name) => page.getByLabel(new RegExp("^" + name + "( optional)?$"));
const heroContent = () => JSON.parse(sql("SELECT content FROM page_sections WHERE id = 'sec_home_hero'")[0].content);
const caseTitle = () => sql(`SELECT title FROM case_studies WHERE id = '${CASE}'`)[0].title;
const posted = [];
page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) posted.push(r); });

try {
  await page.goto(BASE + "/admin/login"); await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !/\/login/.test(u.pathname)), page.click('button[type="submit"]')]);
  const admin = sql(`SELECT id, name FROM users WHERE email = '${EMAIL}'`)[0];
  const original = heroContent().eyebrow;

  // ---------------------------------------------------------------- a page section
  await go("/admin/pages/home/hero");
  check("a section nobody changed yet says so, and shows the last saved version", /Last saved version/.test(await page.locator(".cms-versions").innerText()) && (await page.locator(".cms-versions li").count()) === 0);
  await L("Eyebrow").fill("REV ONE"); await save();
  await L("Eyebrow").fill("REV TWO"); await save();
  const revs = sql("SELECT * FROM page_section_revisions ORDER BY replaced_at DESC, id DESC");
  check("each change stores the section, the previous content, the new content, who changed it and when", revs.length === 2 && revs[0].section_id === "sec_home_hero" && JSON.parse(revs[0].content).eyebrow === "REV ONE" && JSON.parse(revs[0].new_content).eyebrow === "REV TWO" && revs[0].changed_by === admin.id && /^20\d\d-/.test(revs[0].replaced_at) && revs[0].kind === "edit", JSON.stringify(revs[0]).slice(0, 200));
  check("the first change kept the original as its previous content", JSON.parse(revs[1].content).eyebrow === original && JSON.parse(revs[1].new_content).eyebrow === "REV ONE");
  await go("/admin/pages/home/hero");
  const items = page.locator(".cms-versions li");
  const t0 = await items.nth(0).innerText();
  check("the admin sees the last saved version, the previous version and the earlier one, with who and when", (await items.count()) === 2 && /Previous version/.test(t0) && /Earlier version/.test(await items.nth(1).innerText()) && t0.includes(admin.name) && /eyebrow/.test(t0) && /Last saved version/.test(await page.locator(".cms-versions").innerText()), t0);
  await L("Eyebrow").fill("UNSAVED");
  check("restoring is not offered while there are unsaved changes", await items.nth(0).getByRole("button", { name: "Restore this version" }).isDisabled());
  await page.getByRole("button", { name: "Cancel changes" }).click();
  await items.nth(0).getByRole("button", { name: "Restore this version" }).click();
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
  check("restoring the previous version puts its content back (the section is checked and saved like any edit)", heroContent().eyebrow === "REV ONE");
  const r3 = sql("SELECT * FROM page_section_revisions ORDER BY replaced_at DESC, id DESC");
  check("the restore is itself a revision: the version it replaced is kept, the restore is marked", r3.length === 3 && r3[0].kind === "restore" && JSON.parse(r3[0].content).eyebrow === "REV TWO" && JSON.parse(r3[0].new_content).eyebrow === "REV ONE" && r3[0].changed_by === admin.id);
  check("the website shows the restored content", (await html("/")).includes("REV ONE"));
  check("the screen shows the restored content and the new list of versions", (await L("Eyebrow").inputValue()) === "REV ONE" && (await page.locator(".cms-versions li").count()) === 3 && /by a restore/.test(await page.locator(".cms-versions li").first().innerText()));
  {
    const au = sql("SELECT action, entity_id, summary FROM audit_logs WHERE action = 'cms.section.restore' ORDER BY created_at DESC LIMIT 1")[0];
    check("the restore is in the audit log (names the section and the fields, not the content)", !!au && au.entity_id === "home.hero" && /restored the version replaced on/.test(au.summary) && /eyebrow/.test(au.summary) && !/REV/.test(au.summary), au?.summary);
  }
  // a stale version token
  await go("/admin/pages/home/hero");
  sql("UPDATE page_sections SET updated_at = '2031-01-01T00:00:00.000Z' WHERE id = 'sec_home_hero'");
  await page.locator(".cms-versions li").nth(1).getByRole("button", { name: "Restore this version" }).click();
  await page.waitForTimeout(1200);
  check("restoring from an old screen is a conflict: nothing is overwritten", (await page.locator(".form-errors").innerText()).includes("changed by someone else") && heroContent().eyebrow === "REV ONE");
  // a version that does not fit the section any more
  sql("UPDATE page_sections SET updated_at = '2026-10-09T00:00:00.000Z' WHERE id = 'sec_home_hero'");
  sql(`INSERT INTO page_section_revisions (id, section_id, content, schema_version, saved_at, replaced_at) VALUES ('rev_qa_broken', 'sec_home_hero', '{"eyebrow":1}', 1, '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`);
  await go("/admin/pages/home/hero");
  check("a version that no longer fits the section cannot be restored, and says so", /Cannot be restored/.test(await page.locator(".cms-versions").innerText()));
  // a restore of a version that belongs to another section is refused (replayed request)
  const goodRev = sql("SELECT id FROM page_section_revisions WHERE section_id = 'sec_home_hero' AND id <> 'rev_qa_broken' ORDER BY replaced_at DESC LIMIT 1")[0].id;
  await page.locator(".cms-versions li").filter({ hasText: "Previous version" }).getByRole("button", { name: "Restore this version" }).click();
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(1200);
  const req = posted.at(-1);
  const raw = req.postDataBuffer().toString("utf8");
  sql("INSERT INTO page_section_revisions (id, section_id, content, schema_version, saved_at, replaced_at) SELECT 'rev_qa_other', id, '{\"label\":\"OTHER SECTION\",\"x\":1}', 1, '2026-10-01T00:00:00.000Z', '2026-10-03T00:00:00.000Z' FROM page_sections WHERE id = 'sec_home_logos'");
  const stamp = sql("SELECT updated_at u FROM page_sections WHERE id = 'sec_home_hero'")[0].u;
  const oldStamp = /name="[_0-9]*expectedUpdatedAt"\r\n\r\n([^\r\n]+)/.exec(raw)?.[1] ?? "";
  const revId = /name="[_0-9]*revisionId"\r\n\r\n([^\r\n]+)/.exec(raw)?.[1] ?? "";
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const hdr = { "content-type": req.headers()["content-type"], "next-action": req.headers()["next-action"], origin: BASE, host: new URL(BASE).host, cookie };
  const before = heroContent().eyebrow;
  await fetch(BASE + "/admin/pages/home/hero", { method: "POST", redirect: "manual", headers: hdr, body: Buffer.from(raw.replace(revId, "rev_qa_other").replace(oldStamp, stamp)) });
  check("server: a version of another section cannot be restored here", heroContent().eyebrow === before && !JSON.stringify(sql("SELECT content FROM page_sections WHERE id = 'sec_home_hero'")).includes("OTHER SECTION"), revId);
  await fetch(BASE + "/admin/pages/home/hero", { method: "POST", redirect: "manual", headers: { ...hdr, cookie: "" }, body: Buffer.from(raw.replace(oldStamp, stamp)) });
  check("server: without a session a restore changes nothing", heroContent().eyebrow === before);
  void goodRev;

  // ---------------------------------------------------------------- a record (case study)
  const originalTitle = caseTitle();
  await go(`/admin/case-studies/${CASE}/hero`);
  await L("Headline").fill("REV <em>one</em>"); await save();
  await L("Headline").fill("REV <em>two</em>"); await save();
  const er = sql("SELECT * FROM entity_section_revisions WHERE entity_id = '" + CASE + "' ORDER BY replaced_at DESC, rowid DESC");
  check("a record's section change stores the previous content, the new content, who changed it, when and the kind", er.length === 2 && JSON.parse(er[0].content).title === "REV <em>one</em>" && JSON.parse(er[0].new_content).title === "REV <em>two</em>" && er[0].replaced_by === admin.id && er[0].kind === "edit" && JSON.parse(er[1].content).title === originalTitle);
  await go(`/admin/case-studies/${CASE}/hero`);
  await page.locator(".cms-versions li").first().getByRole("button", { name: "Restore this version" }).click();
  await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500);
  check("restoring the previous version of a record's section puts it back and the website follows", caseTitle() === "REV <em>one</em>" && (await html("/works/orbit")).includes("REV"));
  const er3 = sql("SELECT kind, content, new_content FROM entity_section_revisions WHERE entity_id = '" + CASE + "' ORDER BY replaced_at DESC, rowid DESC");
  check("the restore is kept as a revision and marked", er3.length === 3 && er3[0].kind === "restore" && JSON.parse(er3[0].content).title === "REV <em>two</em>");
  {
    const au = sql("SELECT summary FROM audit_logs WHERE action = 'case_study.section.restore' ORDER BY created_at DESC LIMIT 1")[0];
    check("and audited", !!au && /Hero: restored the version replaced on/.test(au.summary), au?.summary);
  }

  // ---------------------------------------------------------------- recent changes
  await go("/admin/revisions");
  const side = await page.locator(".side nav a").allInnerTexts();
  check("the sidebar has Recent changes under Content", side.includes("Recent changes"));
  const text = await page.locator("table.data").innerText();
  check("Recent changes lists page and record changes, newest first, with who, where, the section and what changed", /Home/.test(text) && /Case study: Orbit/.test(text) && /Hero/.test(text) && /eyebrow/.test(text) && /title/.test(text) && (text.includes(admin.name) || text.includes(EMAIL)), text.slice(0, 200).replace(/\s+/g, " "));
  check("restores are marked, and each row links to the section", (await page.locator("table.data .badge", { hasText: "restore" }).count()) >= 2 && (await page.locator('table.data a[href="/admin/pages/home/hero"]').count()) >= 1 && (await page.locator(`table.data a[href="/admin/case-studies/${CASE}/hero"]`).count()) >= 1);
  await page.setViewportSize({ width: 390, height: 900 });
  await go("/admin/revisions");
  check("on a phone the page does not scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await go("/admin/pages/home/hero");
  check("on a phone the versions panel does not scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check("no JavaScript errors in the browser", errors.length === 0, errors.join(" | "));
} finally {
  sql(`UPDATE page_sections SET content = ${esc(snap.hero.content)}, updated_at = ${esc(snap.hero.updated_at)}, updated_by = ${esc(snap.hero.updated_by)} WHERE id = 'sec_home_hero'`);
  sql(`UPDATE case_studies SET ${Object.entries(snap.case).filter(([k]) => k !== "id").map(([k, v]) => `${k} = ${esc(v)}`).join(", ")} WHERE id = ${esc(snap.case.id)}`);
  sql("DELETE FROM page_section_revisions"); sql("DELETE FROM entity_section_revisions"); sql("DELETE FROM rate_limits");
}
await browser.close();
check("content restored", JSON.stringify(sql("SELECT content FROM page_sections WHERE id = 'sec_home_hero'")) === JSON.stringify([{ content: snap.hero.content }]) && JSON.stringify(sql(`SELECT title FROM case_studies WHERE id = '${CASE}'`)) === JSON.stringify([{ title: snap.case.title }]));
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
