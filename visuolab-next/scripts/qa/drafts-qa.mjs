// End-to-end test of draft / published content and the admin preview against a running local site and its LOCAL database.
//   npm i --no-save playwright
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:3001 node scripts/qa/drafts-qa.mjs
// A page section (Home / Hero), a whole page (About), a case study (Orbit), a service and an article: saving is a draft, the public website shows only
// published content, a preview needs an admin session and draws the draft through the same public components, publish and discard work, and an
// unpublished page answers "not found". Everything is put back afterwards. Never point it at the live site.
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
const sql1 = (q) => { const f = join(tmpdir(), `drafts-qa-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };
/** A replayed request; the dev server drops the connection of some refused requests, which is a refusal too. */
const post = async (url, opts) => { for (let a = 0; a < 3; a++) { const r = await fetch(url, opts).catch(() => null); if (r) return r; await new Promise((x) => setTimeout(x, 800)); } return null; };
const get = async (p, opts = {}) => { for (let a = 0; ; a++) { try { const r = await fetch(BASE + p, { redirect: "manual", ...opts }); return { status: r.status, location: r.headers.get("location") ?? "", text: (await r.text()).replace(/<!--[\s\S]*?-->/g, "") }; } catch (e) { if (a >= 5) throw e; await new Promise((r) => setTimeout(r, 1500)); } } };
const until = async (path, cond, ms = 15000) => { const end = Date.now() + ms; do { const r = await get(path); if (cond(r)) return true; await new Promise((r) => setTimeout(r, 700)); } while (Date.now() < end); return false; };
const esc = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`);

const CASE = "case_orbit", SVC = "svc_brand-identity", POST = "post_design-systems-that-survive";
const snap = {
  sections: sql("SELECT id, is_enabled, content, updated_at, updated_by FROM page_sections"),
  pages: sql("SELECT id, status, updated_at FROM pages"),
  case: sql(`SELECT * FROM case_studies WHERE id = '${CASE}'`)[0], svc: sql(`SELECT * FROM services WHERE id = '${SVC}'`)[0], post: sql(`SELECT * FROM blog_posts WHERE id = '${POST}'`)[0],
  images: sql(`SELECT * FROM case_study_images WHERE case_study_id = '${CASE}'`),
};
sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions"); sql("DELETE FROM content_drafts");
const draftRows = (scope, owner) => sql(`SELECT section_key, content, updated_at FROM content_drafts WHERE scope = '${scope}' AND owner_id = '${owner}'`);
const heroContent = () => JSON.parse(sql("SELECT content FROM page_sections WHERE id = 'sec_home_hero'")[0].content);
const original = heroContent().eyebrow;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); await page.waitForTimeout(300); };
const L = (name) => page.getByLabel(new RegExp("^" + name + "( optional)?$"));
const saveDraft = async () => { await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/")), page.getByRole("button", { name: "Save draft" }).click()]); await page.waitForTimeout(700); };
const settle = async () => { await page.waitForLoadState("networkidle"); await page.waitForTimeout(1500); };
const posted = [];
page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) posted.push(r); });
const version = () => Number(sql("SELECT value v FROM app_meta WHERE key = 'content_version'")[0]?.v ?? 0);

try {
  await page.goto(BASE + "/admin/login"); await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !/\/login/.test(u.pathname)), page.click('button[type="submit"]')]);
  const admin = sql(`SELECT id FROM users WHERE email = '${EMAIL}'`)[0];

  // ================================================================ a page section
  await go("/admin/pages/home/hero");
  check("a page with its own address saves drafts: the button says Save draft and there is no draft yet", (await page.getByRole("button", { name: "Save draft" }).count()) === 1 && (await page.locator(".draft-banner").count()) === 0 && (await page.getByRole("link", { name: /Preview draft/ }).count()) === 1);
  const v0 = version();
  await L("Eyebrow").fill("DRAFT EYEBROW");
  await saveDraft();
  check("saving writes a DRAFT: the published section is untouched", heroContent().eyebrow === original && draftRows("page", "page_home").length === 1 && JSON.parse(draftRows("page", "page_home")[0].content).eyebrow === "DRAFT EYEBROW" && draftRows("page", "page_home")[0].section_key === "hero");
  check("and says so; the section shows it is a draft with Publish and Discard", /Draft saved/.test(await page.locator(".cms-saved").innerText()) && (await page.locator(".draft-banner").count()) === 1 && (await page.getByRole("button", { name: "Publish this section" }).count()) === 1);
  check("a draft is not a revision and does not refresh the public cache (the content version did not move)", sql("SELECT COUNT(*) n FROM page_section_revisions")[0].n === 0 && version() === v0);
  { const au = sql("SELECT summary FROM audit_logs WHERE action = 'cms.section.draft' ORDER BY created_at DESC LIMIT 1")[0]; check("the draft is in the audit log (field names only)", /saved as a draft; changed eyebrow/.test(au?.summary ?? "") && !/DRAFT EYEBROW/.test(au.summary), au?.summary); }
  const anon = await get("/");
  check("the public website shows only the published content", anon.status === 200 && !anon.text.includes("DRAFT EYEBROW") && anon.text.includes(original));
  const anonPreview = await get("/?preview=1");
  check("a preview without an admin session is sent to sign-in and reveals nothing", anonPreview.status >= 300 && anonPreview.status < 400 && /\/admin\/login/.test(anonPreview.location) && !anonPreview.text.includes("DRAFT EYEBROW"), `${anonPreview.status} ${anonPreview.location}`);
  await go("/?preview=1");
  const previewHtml = await page.content();
  check("an admin's preview draws the draft through the public page, with the preview bar", previewHtml.includes("DRAFT EYEBROW") && /Preview: Home with its draft changes/.test(await page.locator("body").innerText()) && (await page.locator('link[rel="stylesheet"]').count()) > 0);
  const normal = await (async () => { await go("/"); return page.content(); })();
  check("the same admin on the normal address still sees the published page, without the bar", !normal.includes("DRAFT EYEBROW") && normal.includes(original) && !/Preview: Home/.test(await page.locator("body").innerText()));
  await go("/admin/pages/home");
  check("the page screen marks the section as a draft and offers Preview draft, Publish changes and Discard drafts", (await page.locator("ol.section-cards li", { hasText: "Hero" }).first().locator(".badge.draft").count()) === 1 && (await page.getByRole("link", { name: /Preview draft/ }).first().getAttribute("href")) === "/?preview=1" && (await page.getByRole("button", { name: /Publish changes \(1\)/ }).count()) === 1 && (await page.getByRole("button", { name: "Discard drafts" }).count()) === 1);
  await go("/admin/pages/home/hero");
  check("the editor opens on the draft", (await L("Eyebrow").inputValue()) === "DRAFT EYEBROW" && (await page.locator(".draft-banner").count()) === 1);
  // a stale token
  await L("Eyebrow").fill("DRAFT EYEBROW 2");
  sql("UPDATE content_drafts SET updated_at = '2031-01-01T00:00:00.000Z' WHERE owner_id = 'page_home'");
  await saveDraft();
  check("saving over a draft someone else changed is a conflict: nothing is overwritten", (await page.locator(".form-errors").innerText()).includes("changed by someone else") && JSON.parse(draftRows("page", "page_home")[0].content).eyebrow === "DRAFT EYEBROW");
  // equal to published clears the draft
  await go("/admin/pages/home/hero");
  await L("Eyebrow").fill(original);
  await saveDraft();
  check("saving content equal to the published content removes the draft", draftRows("page", "page_home").length === 0 && (await page.locator(".draft-banner").count()) === 0 && /same as the published/.test(await page.locator(".cms-saved").innerText()));
  // discard
  await L("Eyebrow").fill("TO DISCARD"); await saveDraft();
  await page.getByRole("button", { name: "Discard draft" }).click(); await settle();
  check("Discard draft throws the draft away; the published section is unchanged", draftRows("page", "page_home").length === 0 && heroContent().eyebrow === original && (await L("Eyebrow").inputValue()) === original);
  check("and it is audited", /draft discarded/.test(sql("SELECT summary FROM audit_logs WHERE action = 'cms.section.draft.discard' ORDER BY created_at DESC LIMIT 1")[0]?.summary ?? ""));
  // publish
  await L("Eyebrow").fill("PUBLISHED EYEBROW"); await saveDraft();
  const v1 = version();
  await page.getByRole("button", { name: "Publish this section" }).click(); await settle();
  check("Publish this section writes the draft into the published content and removes the draft", heroContent().eyebrow === "PUBLISHED EYEBROW" && draftRows("page", "page_home").length === 0);
  const rev = sql("SELECT content, new_content, kind, changed_by FROM page_section_revisions ORDER BY replaced_at DESC LIMIT 1")[0];
  check("publishing keeps a revision (previous and new content, who) and refreshes the public cache", JSON.parse(rev.content).eyebrow === original && JSON.parse(rev.new_content).eyebrow === "PUBLISHED EYEBROW" && rev.changed_by === admin.id && rev.kind === "edit" && version() > v1);
  check("the public website now shows it", await until("/", (r) => r.text.includes("PUBLISHED EYEBROW")));
  check("publishing is audited", /published hero/.test(sql("SELECT summary FROM audit_logs WHERE action = 'cms.page.publish' ORDER BY created_at DESC LIMIT 1")[0]?.summary ?? ""));
  // two drafts, publish the page
  await go("/admin/pages/home/hero"); await L("Eyebrow").fill("TWO ONE"); await saveDraft();
  await go("/admin/pages/home/logos"); const lab = await L("Label").inputValue(); await L("Label").fill("TWO LABEL"); await saveDraft();
  await go("/admin/pages/home");
  check("two drafts: Publish changes (2)", (await page.getByRole("button", { name: /Publish changes \(2\)/ }).count()) === 1);
  await page.getByRole("button", { name: /Publish changes \(2\)/ }).click(); await settle();
  check("Publish changes publishes every draft of the page", heroContent().eyebrow === "TWO ONE" && JSON.parse(sql("SELECT content FROM page_sections WHERE id = 'sec_home_logos'")[0].content).label === "TWO LABEL" && draftRows("page", "page_home").length === 0, lab);
  await go("/admin/pages/home/hero"); await L("Eyebrow").fill("D1"); await saveDraft();
  await go("/admin/pages/home");
  await page.getByRole("button", { name: "Discard drafts" }).click();
  await page.locator("dialog[open]").getByRole("button", { name: "Discard drafts" }).click(); await settle();
  check("Discard drafts (asks first) throws every draft of the page away", draftRows("page", "page_home").length === 0 && heroContent().eyebrow === "TWO ONE");

  // ================================================================ unpublish a page
  await go("/admin/pages/about");
  check("Home cannot be unpublished (no button); About can", (await (async () => { await go("/admin/pages/home"); return page.getByRole("button", { name: "Unpublish page" }).count(); })()) === 0);
  await go("/admin/pages/about");
  await page.getByRole("button", { name: "Unpublish page" }).click();
  check("unpublishing asks first and says what happens", /not-found page/.test(await page.locator("dialog[open]").innerText()));
  await page.locator("dialog[open]").getByRole("button", { name: "Unpublish page" }).click(); await settle();
  check("an unpublished page is a draft: visitors get not-found, the sitemap leaves it out", sql("SELECT status s FROM pages WHERE id = 'page_about'")[0].s === "draft" && (await until("/about", (r) => r.status === 404)) && !(await get("/sitemap.xml")).text.includes("/about</loc>"));
  await go("/about?preview=1");
  check("an admin can still preview an unpublished page", /Preview: About/.test(await page.locator("body").innerText()));
  const unpub = posted.filter((r) => r.url().includes("/admin/pages/about")).at(-1);
  const raw = unpub.postDataBuffer().toString("utf8");
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const hdr = { "content-type": unpub.headers()["content-type"], "next-action": unpub.headers()["next-action"], origin: BASE, host: new URL(BASE).host, cookie };
  await post(BASE + "/admin/pages/home", { method: "POST", redirect: "manual", headers: hdr, body: Buffer.from(raw.replace(/(name="[_0-9]*template"\r\n\r\n)about(\r\n)/, "$1home$2")) });
  check("server: Home cannot be unpublished even by a replayed request", sql("SELECT status s FROM pages WHERE id = 'page_home'")[0].s === "published");
  await go("/admin/pages/about");
  await page.getByRole("button", { name: "Publish page" }).click(); await settle();
  check("Publish page makes it public again", sql("SELECT status s FROM pages WHERE id = 'page_about'")[0].s === "published" && (await until("/about", (r) => r.status === 200)));
  check("both are audited", sql("SELECT COUNT(*) n FROM audit_logs WHERE action = 'cms.page.status'")[0].n >= 2);

  // shared copy has no drafts
  await go("/admin/pages/shared");
  const sharedLink = await page.locator("ol.section-cards li", { hasText: "Rating line" }).getByRole("link", { name: "Edit" }).getAttribute("href");
  await go(sharedLink);
  check("copy used on several pages is published as soon as it is saved: Save section, no draft", (await page.getByRole("button", { name: "Save section" }).count()) === 1 && (await page.getByRole("button", { name: "Save draft" }).count()) === 0);

  // ================================================================ a case study
  const orig = snap.case;
  await go(`/admin/case-studies/${CASE}/hero`);
  await L("Headline").fill("DRAFT <em>headline</em>"); await saveDraft();
  check("a record's section saves a draft too: the record is not changed", sql(`SELECT title FROM case_studies WHERE id = '${CASE}'`)[0].title === orig.title && draftRows("case_study", CASE).length === 1);
  const a1 = await get("/works/orbit");
  check("the public page shows only the published case study", a1.status === 200 && !a1.text.includes("DRAFT") && a1.text.includes("Orbit"));
  const a2 = await get("/works/orbit?preview=1");
  check("a preview without a session is refused", a2.status >= 300 && a2.status < 400 && /login/.test(a2.location));
  await go("/works/orbit?preview=1");
  check("the admin's preview draws the draft headline with the same page and the preview bar", (await page.locator("h1#case-title").innerText()).includes("DRAFT headline") && /Preview: this case study/.test(await page.locator("body").innerText()));
  await go("/works/orbit");
  check("and the normal address is unchanged for the same admin", !(await page.locator("h1#case-title").innerText()).includes("DRAFT"));
  await go(`/admin/case-studies/${CASE}`);
  check("the overview shows the draft and offers Preview draft / Publish changes / Discard", (await page.locator("ol.section-cards li", { hasText: "Hero" }).first().locator(".badge.draft").count()) === 1 && (await page.getByRole("button", { name: /Publish changes \(1\)/ }).count()) === 1 && (await page.getByRole("link", { name: /Preview draft/ }).first().getAttribute("href")) === "/works/orbit?preview=1");
  // the full form
  await go(`/admin/case-studies/${CASE}/edit`);
  check("the full form edits the working copy (the draft headline is in it)", (await page.locator("#f-title, input[name=title]").first().inputValue()).includes("DRAFT"));
  await page.locator('input[name="industry"]').fill("DRAFT INDUSTRY");
  const wasFeatured = await page.locator('input[name="featured"]').isChecked();
  await page.locator('input[name="featured"]').setChecked(!wasFeatured);
  await Promise.all([page.waitForURL(/n=/), page.getByRole("button", { name: /Save changes/ }).click()]);
  await page.waitForLoadState("networkidle");
  const sawDraftToast = await page.getByText(/Saved as a draft/).first().waitFor({ timeout: 4000 }).then(() => true, () => false);
  const nowRow = sql(`SELECT industry_x FROM (SELECT facts_json AS industry_x FROM case_studies WHERE id = '${CASE}')`)[0].industry_x;
  check("the full form saves the parts of the page as drafts and the basics at once", !nowRow.includes("DRAFT INDUSTRY") && draftRows("case_study", CASE).some((d) => d.section_key === "facts") && sql(`SELECT featured f FROM case_studies WHERE id = '${CASE}'`)[0].f === (wasFeatured ? 0 : 1));
  check("and says it saved a draft", sawDraftToast);
  await go(`/admin/case-studies/${CASE}`);
  await page.getByRole("button", { name: /Publish changes \(2\)/ }).click(); await settle();
  const pubRow = sql(`SELECT title, facts_json FROM case_studies WHERE id = '${CASE}'`)[0];
  check("Publish changes publishes both drafts of the case study", pubRow.title === "DRAFT <em>headline</em>" && pubRow.facts_json.includes("DRAFT INDUSTRY") && draftRows("case_study", CASE).length === 0);
  check("each publish is a revision and the website follows", sql(`SELECT COUNT(*) n FROM entity_section_revisions WHERE entity_id = '${CASE}'`)[0].n === 2 && (await until("/works/orbit", (r) => r.text.includes("DRAFT") )));
  check("publishing is audited", /published .*hero/.test(sql("SELECT summary FROM audit_logs WHERE action = 'case_study.publish_changes' ORDER BY created_at DESC LIMIT 1")[0]?.summary ?? ""));

  // ================================================================ a service and an article
  await go(`/admin/services/${SVC}/overview`);
  await L("Small label").fill("DRAFT LABEL"); await saveDraft();
  check("service: a draft leaves the service unchanged and the public page too", !sql(`SELECT overview_json o FROM services WHERE id = '${SVC}'`)[0].o.includes("DRAFT LABEL") && !(await get(`/services/${snap.svc.slug}`)).text.includes("DRAFT LABEL") && draftRows("service", SVC).length === 1);
  const svcSlug = snap.svc.slug;
  await go(`/services/${svcSlug}?preview=1`);
  check("service: the admin's preview draws it", (await page.content()).includes("DRAFT LABEL") && /Preview: this service/.test(await page.locator("body").innerText()));
  await go(`/admin/blog/${POST}/closing-line`);
  await L("Link text").fill("DRAFT LINK"); await saveDraft();
  const postSlug = snap.post.slug;
  check("article: a draft leaves the article unchanged for visitors", !(await get(`/blog/${postSlug}`)).text.includes("DRAFT LINK") && draftRows("blog_post", POST).length === 1);
  await go(`/blog/${postSlug}?preview=1`);
  check("article: the admin's preview draws it", (await page.content()).includes("DRAFT LINK") && /Preview: this article/.test(await page.locator("body").innerText()));

  // a record that is not published yet: publishing it publishes its draft with it
  sql(`UPDATE blog_posts SET status = 'draft' WHERE id = '${POST}'`);
  check("an unpublished article is not found by visitors", (await get(`/blog/${postSlug}`)).status === 404);
  await go(`/admin/blog/${POST}`);
  check("an unpublished record offers Publish (with its draft changes)", (await page.getByRole("button", { name: /Publish \(with 1 draft change\)/ }).count()) === 1);
  await page.getByRole("button", { name: /Publish \(with 1 draft change\)/ }).click(); await settle();
  check("Publish makes the article public and publishes its draft", sql(`SELECT status s FROM blog_posts WHERE id = '${POST}'`)[0].s === "published" && draftRows("blog_post", POST).length === 0 && (await until(`/blog/${postSlug}`, (r) => r.status === 200 && r.text.includes("DRAFT LINK"))));

  // authorization of the new actions
  await go("/admin/pages/home/hero"); await L("Eyebrow").fill("AUTH DRAFT"); await saveDraft();
  const pubReq = (await (async () => { await page.getByRole("button", { name: "Publish this section" }).click(); await settle(); return posted.filter((r) => r.url().includes("/admin/pages/home/hero")).at(-1); })());
  const praw = pubReq.postDataBuffer().toString("utf8");
  await go("/admin/pages/home/hero"); await L("Eyebrow").fill("AUTH DRAFT 2"); await saveDraft();
  const phdr = { "content-type": pubReq.headers()["content-type"], "next-action": pubReq.headers()["next-action"], origin: BASE, host: new URL(BASE).host };
  await post(BASE + "/admin/pages/home/hero", { method: "POST", redirect: "manual", headers: phdr, body: Buffer.from(praw) });
  check("authorization: publishing without a session changes nothing", heroContent().eyebrow === "AUTH DRAFT" && draftRows("page", "page_home").length === 1);
  await post(BASE + "/admin/pages/home/hero", { method: "POST", redirect: "manual", headers: { ...phdr, origin: "https://evil.example", cookie }, body: Buffer.from(praw) }).catch(() => null); // the dev server may drop the connection of a foreign origin: that is a refusal too
  check("authorization: publishing from another origin changes nothing", heroContent().eyebrow === "AUTH DRAFT" && draftRows("page", "page_home").length === 1);
  await post(BASE + "/admin/pages/home/hero", { method: "POST", redirect: "manual", headers: { ...phdr, cookie }, body: Buffer.from(praw) });
  check("positive control: the same request with the session and the right origin publishes", heroContent().eyebrow === "AUTH DRAFT 2" && draftRows("page", "page_home").length === 0);

  await page.setViewportSize({ width: 390, height: 900 });
  await go("/admin/pages/home");
  check("on a phone the screens do not scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check("no JavaScript errors in the browser", errors.length === 0, errors.join(" | "));
} finally {
  sql("DELETE FROM content_drafts");
  for (const s of snap.sections) sql(`UPDATE page_sections SET is_enabled = ${s.is_enabled}, content = ${esc(s.content)}, updated_at = ${esc(s.updated_at)}, updated_by = ${esc(s.updated_by)} WHERE id = ${esc(s.id)}`);
  for (const p of snap.pages) sql(`UPDATE pages SET status = ${esc(p.status)}, updated_at = ${esc(p.updated_at)} WHERE id = ${esc(p.id)}`);
  for (const [table, r] of [["case_studies", snap.case], ["services", snap.svc], ["blog_posts", snap.post]]) sql(`UPDATE ${table} SET ${Object.entries(r).filter(([k]) => k !== "id").map(([k, v]) => `${k} = ${esc(v)}`).join(", ")} WHERE id = ${esc(r.id)}`);
  sql(`DELETE FROM case_study_images WHERE case_study_id = '${CASE}'`);
  for (const r of snap.images) sql(`INSERT INTO case_study_images (${Object.keys(r).join(", ")}) VALUES (${Object.values(r).map(esc).join(", ")})`);
  sql("DELETE FROM page_section_revisions"); sql("DELETE FROM entity_section_revisions"); sql("DELETE FROM rate_limits");
}
await browser.close();
check("everything restored", JSON.stringify([sql("SELECT id, status FROM pages ORDER BY id"), sql("SELECT COUNT(*) n FROM content_drafts")[0].n]) === JSON.stringify([snap.pages.map(({ id, status }) => ({ id, status })).sort((a, b) => (a.id < b.id ? -1 : 1)), 0]) && heroContent().eyebrow === original);
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
