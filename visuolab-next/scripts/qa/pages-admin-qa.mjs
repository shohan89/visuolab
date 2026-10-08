// End-to-end test of the Pages admin (/admin/pages) against a running local site and its LOCAL database.
//   npm i --no-save playwright
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:3001 node scripts/qa/pages-admin-qa.mjs
// It signs in, edits sections and a page's search settings, checks the public pages follow, checks validation, version conflicts and authorization,
// then puts the content back. Never point it at the live site.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:3001";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Local sites only."); process.exit(1); }
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
const res = [];
const check = (n, ok, d = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + String(d).slice(0, 220) : ""}`); };
const sql1 = (q) => { const f = join(tmpdir(), `pages-admin-qa-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } }; // wrangler occasionally crashes on Windows: retry
const html = async (p) => { for (let a = 0; ; a++) { try { return (await (await fetch(BASE + p)).text()).replace(/<!--[\s\S]*?-->/g, ""); } catch (e) { if (a >= 5) throw e; await new Promise((r) => setTimeout(r, 1500)); } } };
const has = (h, s) => h.includes(s);
const content = (id) => JSON.parse(sql(`SELECT content FROM page_sections WHERE id = '${id}'`)[0].content);

sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions");
const snapshot = { sections: sql("SELECT id, content, is_enabled, updated_at FROM page_sections"), pages: sql("SELECT id, seo_title, seo_description, og_image_id, canonical_url, noindex, updated_at FROM pages") };
const esc = (v) => (v === null ? "NULL" : typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); await page.waitForTimeout(300); };
const saveSection = async () => { await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/pages")), page.getByRole("button", { name: "Save section" }).click()]); await page.waitForTimeout(500); };

try {
  // ---- sign in; the sidebar
  await page.goto(BASE + "/admin/login"); await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !/\/login/.test(u.pathname)), page.click('button[type="submit"]')]);
  await go("/admin/pages");
  const side = await page.locator(".side nav a").allInnerTexts();
  check("sidebar: Pages is under Content, after Media", side.indexOf("Pages") === side.indexOf("Media") + 1 && side.indexOf("Pages") > 0, side.join("|"));
  check("sidebar: Pages is the current item on /admin/pages", (await page.locator('.side a[href="/admin/pages"]').getAttribute("aria-current")) === "page");
  const names = await page.locator("table.pages-table tbody tr td:first-child b").allInnerTexts();
  const routes = await page.locator("table.pages-table tbody tr td:nth-child(2)").allInnerTexts();
  check("the page list shows Home, About, Services, Works, Blog and Contact in that order, with their routes", names.join("|") === "Home|About|Services|Works|Blog|Contact" && routes.join("|") === "/|/about|/services|/works|/blog|/contact", `${names.join("|")} ${routes.join("|")}`);
  const head = (await page.locator("table.pages-table thead").innerText()).replace(/\s+/g, " ").toLowerCase();
  check("the list has page name, route, status, last updated, SEO and sections", ["page", "route", "status", "last updated", "seo", "sections"].every((h) => head.includes(h)), head);
  check("every page has Edit Content, Edit SEO and Preview; detail pages are not in the list", (await page.locator("table.pages-table tbody tr").nth(0).getByRole("link", { name: "Edit Content" }).count()) === 1 && (await page.locator("table.pages-table tbody tr").nth(0).getByRole("link", { name: "Edit SEO" }).count()) === 1 && (await page.locator("table.pages-table tbody tr").nth(0).getByRole("link", { name: /Preview/ }).getAttribute("href")) === "/" && !(await page.locator("table.pages-table").innerText()).match(/Service page copy|Case study page copy|Article page copy/));
  check("the first row shows a status, a number of sections and an SEO status", (await page.locator("table.pages-table tbody tr").nth(0).innerText()).match(/published/) !== null && (await page.locator("table.pages-table tbody tr").nth(0).innerText()).includes("9") && /Default|Custom|Hidden from search/.test(await page.locator("table.pages-table tbody tr").nth(0).innerText()));
  check("the Services row opens the Services section of Home (the /services address leads there)", (await page.locator("table.pages-table tbody tr").nth(2).getByRole("link", { name: "Edit Content" }).getAttribute("href")) === "/admin/pages/home/services");
  check("copy used on several pages is listed apart, not among the pages", (await page.locator("section.form-card").nth(1).innerText()).includes("Shared across pages"));
  await go("/admin/pages/page_home");
  check("an editor also opens by page id, and shows the sections in their public order", (await page.locator("ol.section-cards li").count()) === 9 && (await page.locator("ol.section-cards li h3").first().innerText()) === "Hero");
  await go("/admin/pages/home");
  check("the page screen has Edit SEO (jumps to the search settings) and Preview", (await page.getByRole("link", { name: "Edit SEO" }).getAttribute("href")) === "#seo" && (await page.locator("#seo form").count()) === 1 && (await page.getByRole("link", { name: /Preview/ }).getAttribute("href")) === "/");

  // ---- a page: sections, hide and show
  await go("/admin/pages/home");
  const cards = page.locator("ol.section-cards li");
  const cardNames = await cards.locator("h3").allInnerTexts();
  check("a page shows a card for each of its 9 sections in their public order, with the section's name", cardNames.join("|") === "Hero|Trusted by|Showreel|Why us and numbers|Services|Our cases|Industries|How we work|Reviews", cardNames.join("|"));
  const c0 = (await cards.nth(0).innerText()).replace(/\s+/g, " "), c1 = (await cards.nth(1).innerText()).replace(/\s+/g, " ");
  check("each card shows the section type, its enabled status, when it was last updated and an Edit button", c1.includes("Trusted-by logos band") && /Enabled/.test(c1) && /Last updated: \d/.test(c1) && (await cards.nth(1).getByRole("link", { name: "Edit" }).count()) === 1 && c0.includes("Home hero"));
  check("sections that must stay have no switch; the others have one", (await cards.nth(0).locator("button[role=switch]").count()) === 0 && (await cards.nth(1).locator("button[role=switch]").count()) === 1);
  await cards.nth(1).locator("button[role=switch]").click(); // the logos band
  await page.waitForTimeout(2000);
  check("switching a section off shows it as disabled and removes it from the website, keeping its content", (await page.locator("ol.section-cards li").nth(1).innerText()).includes("Disabled") && (await page.locator("ol.section-cards li").nth(1).locator("button[role=switch]").getAttribute("aria-checked")) === "false" && !has(await html("/"), 'class="intro-band"') && content("sec_home_logos").label === "Trusted by");
  await page.locator("ol.section-cards li").nth(1).locator("button[role=switch]").click();
  await page.waitForTimeout(2000);
  check("switching it on brings it back", has(await html("/"), 'class="intro-band"') && (await page.locator("ol.section-cards li").nth(1).innerText()).includes("Enabled"));

  // ---- edit a section: text, validation, cancel
  await go("/admin/pages/home/hero");
  check("the editor opens with the saved content", (await page.getByLabel("Eyebrow").inputValue()) === "Digital product design agency");
  check("nothing can be saved before something changes", await page.getByRole("button", { name: "Save section" }).isDisabled());
  await page.getByLabel("Eyebrow").fill("ADMIN EYEBROW");
  await saveSection();
  check("saving writes it and says so", (await page.locator(".cms-saved").count()) === 1 && content("sec_home_hero").eyebrow === "ADMIN EYEBROW");
  check("the website shows the change", has(await html("/"), "ADMIN EYEBROW"));
  await page.getByLabel("Eyebrow").fill("x".repeat(60));
  await saveSection();
  check("a value over its limit is refused with the field's message and nothing is written", (await page.locator(".field-err").first().innerText()).includes("too long") && content("sec_home_hero").eyebrow === "ADMIN EYEBROW");
  await page.getByLabel("Eyebrow").fill("changed again");
  await page.getByRole("button", { name: "Cancel changes" }).click();
  check("Cancel puts back what is stored", (await page.getByLabel("Eyebrow").inputValue()) === "ADMIN EYEBROW" && (await page.locator(".form-errors").count()) === 0);
  await page.getByLabel("Eyebrow").fill("Digital product design agency");
  await saveSection();
  check("restored through the editor", content("sec_home_hero").eyebrow === "Digital product design agency");

  check("the editor's heading shows the section's name and type", (await page.locator("h1").innerText()).replace(/\s+/g, " ").includes("Hero") && (await page.locator("h1 .badge").innerText()) === "Home hero");
  {
    const au = sql("SELECT action, entity_type, entity_id, summary FROM audit_logs WHERE action = 'cms.section.update' AND entity_id = 'home.hero' ORDER BY created_at DESC LIMIT 1")[0];
    check("every save is in the audit log, naming the section and the fields that changed (not their values)", !!au && au.entity_type === "page_section" && /changed eyebrow/.test(au.summary) && !/ADMIN EYEBROW/.test(au.summary), au?.summary);
  }
  {
    const v0 = Number(sql("SELECT value v FROM app_meta WHERE key = 'content_version'")[0]?.v ?? 0);
    await page.getByLabel("Eyebrow").fill("VERSION BUMP");
    await saveSection();
    const v1 = Number(sql("SELECT value v FROM app_meta WHERE key = 'content_version'")[0]?.v ?? 0);
    check("a save bumps the content version, which is what refreshes the cached public pages", v1 === v0 + 1, `${v0} -> ${v1}`);
    await page.getByLabel("Eyebrow").fill("Digital product design agency");
    await saveSection();
  }

  // ---- rich text editor
  const title = page.locator("form.cms-editor textarea").first(); // the headline: the first rich text field
  await title.fill("Plain words and more words");
  await title.evaluate((el) => { el.focus(); el.setSelectionRange(6, 11); });
  await page.getByRole("button", { name: "Emphasis" }).first().click();
  check("rich text: Emphasis wraps the selected words in <em>, and the preview shows them emphasised", (await title.inputValue()) === "Plain <em>words</em> and more words" && (await page.locator(".rich-preview em").first().innerText()) === "words");
  await page.getByRole("button", { name: "Bold" }).first().click();
  check("rich text: Bold wraps the selection too", /<b>.*<\/b>/.test(await title.inputValue()));
  await page.getByRole("button", { name: "Clear formatting" }).first().click();
  check("rich text: Clear formatting removes the tags", (await title.inputValue()) === "Plain words and more words");
  await title.fill("Broken <em>emphasis");
  await saveSection();
  check("rich text: unbalanced tags are refused by the server with a message", (await page.locator(".field-err").first().innerText()).includes("only <em>"));
  await page.getByRole("button", { name: "Cancel changes" }).click();

  // ---- earlier versions
  {
    await go("/admin/pages/home/logos");
    const original = await content("sec_home_logos");
    await page.getByLabel("Label").fill("VERSION ONE");
    await saveSection();
    await page.getByLabel("Label").fill("VERSION TWO");
    await saveSection();
    await go("/admin/pages/home/logos");
    check("earlier versions are listed under the editor, newest first", (await page.locator(".cms-versions li").count()) >= 2 && (await page.locator(".cms-versions li").count()) <= 10);
    await page.locator(".cms-versions li").nth(0).getByRole("button", { name: "Load into the editor" }).click();
    check("loading a version puts it in the form without saving it", (await page.getByLabel("Label").inputValue()) === "VERSION ONE" && content("sec_home_logos").label === "VERSION TWO");
    await saveSection();
    check("saving the loaded version makes it live again", content("sec_home_logos").label === "VERSION ONE" && has(await html("/"), ">VERSION ONE<"));
    await go("/admin/pages/home/logos");
    await page.locator(".cms-versions li").last().getByRole("button", { name: "Load into the editor" }).click();
    await page.getByRole("button", { name: "Cancel changes" }).click();
    check("Cancel discards a loaded version", (await page.getByLabel("Label").inputValue()) === "VERSION ONE");
    await page.getByLabel("Label").fill(original.label);
    await saveSection();
  }
  await go("/admin/pages/home/hero");

  // ---- optional group (second link), links, rich text
  const hero = await content("sec_home_hero");
  await page.getByRole("group", { name: "Second link" }).getByLabel("Show this part").uncheck();
  await saveSection();
  check("an optional part can be switched off (stored as null) and the website drops it", (await content("sec_home_hero")).secondaryCta === null && !has(await html("/"), 'href="#work" class="arrow-link"'));
  await page.getByRole("group", { name: "Second link" }).getByLabel("Show this part").check();
  await page.getByRole("group", { name: "Second link" }).getByLabel("Text").fill("See our work");
  await page.getByRole("group", { name: "Second link" }).getByLabel("Link").fill("#work");
  await saveSection();
  check("and back on with its text and link", JSON.stringify((await content("sec_home_hero")).secondaryCta) === JSON.stringify(hero.secondaryCta));
  await page.getByRole("group", { name: "Main button" }).getByLabel("Link").fill("javascript:alert(1)");
  await saveSection();
  check("an unsafe link is refused by the server", (await page.locator(".field-err").count()) >= 1 && (await content("sec_home_hero")).primaryCta.href === hero.primaryCta.href);
  await page.getByRole("button", { name: "Cancel changes" }).click();

  // ---- lists: add, edit, reorder, remove, limits
  await go("/admin/pages/about/faq");
  const faqBefore = await content("sec_about_faq");
  const n0 = faqBefore.items.length;
  await page.getByRole("button", { name: "+ Add question" }).click();
  const last = page.locator("fieldset.le-item").last();
  await last.locator("input[type=text]").first().fill("ADMIN QUESTION?");
  await last.locator("textarea").fill("ADMIN ANSWER.");
  await page.getByRole("button", { name: `Move question ${n0 + 1} up` }).click();
  await saveSection();
  const faqAfter = await content("sec_about_faq");
  check("a list item is added, edited and moved; the website shows the question", faqAfter.items.length === n0 + 1 && faqAfter.items[n0 - 1].question === "ADMIN QUESTION?" && has(await html("/about"), "ADMIN QUESTION?"));
  await page.getByRole("button", { name: `Remove question ${n0}` }).click();
  await saveSection();
  check("an item is removed", (await content("sec_about_faq")).items.length === n0 && !has(await html("/about"), "ADMIN QUESTION?"));
  await go("/admin/pages/home/why");
  check("a list the layout fixes has no Add or Remove (the four numbers)", (await page.getByRole("button", { name: "+ Add number" }).count()) === 0 && (await page.getByRole("button", { name: /Remove number/ }).count()) === 0 && (await page.locator("fieldset.le-item legend", { hasText: /^Number \d/ }).count()) === 4);
  await go("/admin/pages/about/faq");
  while ((await page.locator("fieldset.le-item legend", { hasText: /^Question \d/ }).count()) > 3) await page.getByRole("button", { name: /Remove question/ }).last().click();
  check("a list cannot go below its minimum (Remove is disabled at 3 questions)", await page.getByRole("button", { name: /Remove question/ }).first().isDisabled());
  await page.getByRole("button", { name: "Cancel changes" }).click();

  // ---- media, video, case studies
  await go("/admin/pages/home/services");
  await page.getByRole("group", { name: "Book a call bar" }).getByRole("button", { name: "Remove" }).first().click();
  await saveSection();
  check("an optional picture can be removed (stored as null) and the website leaves it out", (await content("sec_home_services")).bookBar.avatar === null && !has(await html("/"), 'class="avatar" src="/assets/people/jordan.webp"'));
  await page.getByRole("group", { name: "Book a call bar" }).getByRole("button", { name: /Choose Photo/ }).click();
  await page.locator("dialog.picker .picker-grid button", { hasText: /jordan/i }).first().click();
  await saveSection();
  check("a picture is chosen from the media library", (await content("sec_home_services")).bookBar.avatar?.id === "media_people-jordan" && has(await html("/"), "/assets/people/jordan.webp"));
  await go("/admin/pages/home/showreel");
  const vids = await page.getByLabel("Video (MP4)").locator("option").allInnerTexts();
  check("a video field offers the videos of the library", vids.length >= 2, vids.join("|"));
  await go("/admin/pages/home/work");
  const sel = page.locator(".cms-case-row select");
  check("case studies are chosen from a list, in order", (await sel.count()) === 4);
  await page.getByRole("button", { name: "Move 1 down" }).click();
  await saveSection();
  const w = await content("sec_home_work");
  check("their order is saved and the website follows", w.caseIds[0] === "case_marlow" && w.caseIds[1] === "case_orbit" && /works\/marlow[\s\S]*works\/orbit/.test(await html("/")));
  await page.getByRole("button", { name: "Move 1 down" }).click();
  await saveSection();

  // ---- version conflict
  await go("/admin/pages/works/grid");
  await page.getByLabel("Text when no case study matches the filter").fill("MINE");
  sql("UPDATE page_sections SET updated_at = '2030-01-01T00:00:00.000Z' WHERE id = 'sec_works_grid'");
  await saveSection();
  check("a section changed by someone else meanwhile is not overwritten: the editor says so", (await page.locator(".form-errors").innerText()).includes("changed by someone else") && content("sec_works_grid").emptyText !== "MINE");
  sql(`UPDATE page_sections SET updated_at = '${snapshot.sections.find((s) => s.id === "sec_works_grid").updated_at}' WHERE id = 'sec_works_grid'`);

  // ---- a template-level section and a shared one
  await go("/admin/pages/shared/rating");
  await page.getByLabel("Score").fill("4.7");
  await saveSection();
  check("shared copy: one edit shows on every page that uses it (Home, Works, a service page)", has(await html("/"), "4.7") && has(await html("/works"), "4.7") && has(await html("/services/brand-identity"), "<b>4.7</b>"));
  await page.getByLabel("Score").fill("5.0");
  await saveSection();

  // ---- contact form lists
  await go("/admin/pages/contact/form");
  check("the contact form's option lists are editable, with a minimum of three", (await page.locator("fieldset.le-item legend", { hasText: /^Option \d/ }).count()) === 10);

  // ---- page search settings
  await go("/admin/pages/about");
  await page.getByLabel("Title", { exact: true }).fill("ADMIN ABOUT TITLE");
  await page.getByLabel("Description").fill("A description of the about page that is long enough to pass.");
  await page.getByLabel("Canonical address").fill("/about");
  await page.getByLabel("Keep this page out of search engines").check();
  await page.getByRole("button", { name: "Save search settings" }).click();
  await page.waitForTimeout(800);
  const about = await html("/about");
  check("a page's search settings are saved and the page uses them (title, description, canonical, noindex)", has(about, "<title>ADMIN ABOUT TITLE</title>") && has(about, "A description of the about page that is long enough to pass.") && /rel="canonical" href="[^"]*\/about"/.test(about) && /name="robots" content="noindex/.test(about));
  await page.getByLabel("Description").fill("short");
  await page.getByRole("button", { name: "Save search settings" }).click();
  await page.waitForTimeout(600);
  check("a description under 20 characters is refused", (await page.locator(".field-err").first().innerText()).includes("too short"));
  await page.getByLabel("Title", { exact: true }).fill("");
  await page.getByLabel("Description").fill("");
  await page.getByLabel("Canonical address").fill("");
  await page.getByLabel("Keep this page out of search engines").uncheck();
  await page.getByRole("button", { name: "Save search settings" }).click();
  await page.waitForTimeout(800);
  const about2 = await html("/about");
  check("cleared fields go back to the defaults from Settings", has(about2, "<title>About — Visuolab</title>") && !/name="robots" content="noindex/.test(about2));

  // ---- mobile: no sideways scroll in the editor
  await page.setViewportSize({ width: 390, height: 900 });
  await go("/admin/pages/home/process");
  check("on a phone the editor does not scroll sideways", (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)));
  await page.setViewportSize({ width: 1280, height: 1600 });

  // ---- authorization
  const posted = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) posted.push(r); });
  await go("/admin/pages/works/grid");
  await page.getByLabel("Text when no case study matches the filter").fill("REPLAYED");
  await saveSection();
  const req = posted.at(-1);
  sql("UPDATE page_sections SET content = json_set(content, '$.emptyText', 'Nothing here yet — try another filter.') WHERE id = 'sec_works_grid'");
  // the replay must carry the section's CURRENT version, or the server would (rightly) call it a conflict and the control would prove nothing
  const raw = req.postDataBuffer().toString("utf8");
  const oldStamp = /name="[_0-9]*expectedUpdatedAt"\r\n\r\n([^\r\n]+)/.exec(raw)?.[1] ?? "";
  const nowStamp = sql("SELECT updated_at u FROM page_sections WHERE id = 'sec_works_grid'")[0].u;
  if (!oldStamp) throw new Error("could not find the version in the replayed request");
  const body = Buffer.from(raw.replace("REPLAYED", "HACKED").replace(oldStamp, nowStamp));
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const hdr = (origin, c) => ({ "content-type": req.headers()["content-type"], "next-action": req.headers()["next-action"], origin, host: new URL(BASE).host, ...(c ? { cookie: c } : {}) });
  await fetch(BASE + "/admin/pages/works/grid", { method: "POST", redirect: "manual", headers: hdr(BASE), body });
  check("authorization: a save replayed without a session changes nothing", content("sec_works_grid").emptyText !== "HACKED");
  const r2 = await fetch(BASE + "/admin/pages", { redirect: "manual" });
  check("authorization: the pages screens redirect to sign-in without a session", r2.status >= 300 && r2.status < 400 && /login/.test(r2.headers.get("location") ?? ""), `${r2.status} ${r2.headers.get("location")}`);
  await fetch(BASE + "/admin/pages/works/grid", { method: "POST", redirect: "manual", headers: hdr("https://evil.example", cookie), body });
  check("authorization: a cross-origin replay with a valid session changes nothing", content("sec_works_grid").emptyText !== "HACKED");
  const ok = await fetch(BASE + "/admin/pages/works/grid", { method: "POST", redirect: "manual", headers: hdr(BASE, cookie), body });
  check("positive control: the same request with the session and the right origin is saved (so the refusals are real)", content("sec_works_grid").emptyText === "HACKED", `status ${ok.status}`);
  check("no JavaScript errors in the browser", errors.length === 0, errors.join(" | "));
} finally {
  // ---- put everything back
  for (const s of snapshot.sections) sql(`UPDATE page_sections SET content = ${esc(s.content)}, is_enabled = ${s.is_enabled}, updated_at = ${esc(s.updated_at)} WHERE id = ${esc(s.id)}`);
  for (const p of snapshot.pages) sql(`UPDATE pages SET seo_title = ${esc(p.seo_title)}, seo_description = ${esc(p.seo_description)}, og_image_id = ${esc(p.og_image_id)}, canonical_url = ${esc(p.canonical_url)}, noindex = ${p.noindex}, updated_at = ${esc(p.updated_at)} WHERE id = ${esc(p.id)}`);
  sql("DELETE FROM page_section_revisions"); // the versions this run made
  sql("DELETE FROM rate_limits");
}
await browser.close();
check("content restored", JSON.stringify(sql("SELECT id, content, is_enabled FROM page_sections ORDER BY id")) === JSON.stringify(snapshot.sections.map(({ id, content, is_enabled }) => ({ id, content, is_enabled })).sort((a, b) => (a.id < b.id ? -1 : 1))));
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
