// End-to-end test of the Pages admin (/admin/pages) against a running local site and its LOCAL database.
//   npm i --no-save playwright
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:3001 node scripts/qa/pages-admin-qa.mjs
// It signs in, edits sections and a page's search settings, checks the public pages follow, checks validation, version conflicts and authorization,
// then puts the content back. Never point it at the live site.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { PNG } from "pngjs";
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
const refsSnapshot = sql("SELECT section_id, field_path, kind, media_id, case_study_id FROM page_section_refs");
const mediaBefore = sql("SELECT id FROM media").map((m) => m.id);
const snapshot = { sections: sql("SELECT id, content, is_enabled, updated_at FROM page_sections"), pages: sql("SELECT id, seo_title, seo_description, og_image_id, canonical_url, noindex, nofollow, updated_at FROM pages") };
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
  check("the page screen has Edit SEO (opens the SEO editor) and Preview", (await page.getByRole("link", { name: "Edit SEO" }).first().getAttribute("href")) === "/admin/pages/home/seo" && (await page.getByRole("link", { name: /Preview/ }).getAttribute("href")) === "/");

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

  // ---- media library in the editor: details, modal, filters, upload, replace, alt, remove, public rendering
  await go("/admin/pages/home/services");
  const bar = page.getByRole("group", { name: "Book a call bar" });
  const infoText = (await bar.locator(".media-info").innerText()).replace(/\s+/g, " ");
  check("an image field shows the file's name, size, dimensions and library description", /File\s*jordan/i.test(infoText) && /Size\s*[\d.]+ (KB|MB|B)/.test(infoText) && /\d+×\d+ px/.test(infoText) && /Library description/.test(infoText), infoText);
  const avatarStyle = async () => page.evaluate(async () => { const r = await fetch("/"); const d = new DOMParser().parseFromString(await r.text(), "text/html"); return d.querySelector(".book-bar img.avatar")?.getAttribute("src") ?? null; });
  const css = async () => { const c = await ctx.newPage(); await c.goto(BASE + "/"); await c.waitForLoadState("networkidle"); const v = await c.evaluate(() => { const e = document.querySelector(".book-bar img.avatar"); if (!e) return null; const s = getComputedStyle(e); return { w: s.width, h: s.height, fit: s.objectFit, radius: s.borderRadius, attrW: e.getAttribute("width"), attrH: e.getAttribute("height") }; }); await c.close(); return v; };
  const cssBefore = await css();
  await bar.getByRole("button", { name: /Change Photo/ }).click();
  const dlg = page.locator("dialog.picker");
  await dlg.locator(".picker-grid li").first().waitFor();
  const cardText = (await dlg.locator(".picker-grid li").first().innerText()).replace(/\s+/g, " ");
  check("the library modal shows each file's thumbnail, title, file name, dimensions, size and description", (await dlg.locator(".picker-grid li").first().locator("img").count()) === 1 && /\.(webp|png|jpe?g|avif|gif)/i.test(cardText) && /\d+×\d+ · [\d.]+ (KB|MB|B)/.test(cardText) && /No description|[A-Za-z]/.test(cardText), cardText);
  const total0 = await dlg.locator(".picker-count").innerText();
  await dlg.getByLabel("Search the media library").fill("jordan");
  await page.waitForTimeout(900);
  const cardsSearch = await dlg.locator(".picker-grid li").count();
  check("search narrows the list (by title, description or file name)", cardsSearch >= 1 && cardsSearch < 10 && (await dlg.locator(".picker-grid li").first().innerText()).toLowerCase().includes("jordan"), `${total0} -> ${cardsSearch}`);
  await dlg.getByLabel("Search the media library").fill("");
  await dlg.getByLabel("Filter by source").selectOption("r2");
  await page.waitForTimeout(900);
  const uploadedOnly = await dlg.locator(".picker-count").innerText();
  await dlg.getByLabel("Filter by source").selectOption("static");
  await page.waitForTimeout(900);
  const staticOnly = await dlg.locator(".picker-count").innerText();
  check("filters: the source filter changes what is listed (uploaded vs shipped with the site)", uploadedOnly !== staticOnly && Number(staticOnly.match(/^(\d+)/)[1]) > 0, `${uploadedOnly} / ${staticOnly}`);
  await dlg.getByLabel("Filter by source").selectOption("all");
  await page.waitForTimeout(900);
  const cardsAll = await dlg.locator(".picker-grid li").count();
  await dlg.getByLabel("Filter by shape").selectOption("portrait");
  await page.waitForTimeout(500);
  const portraitCount = await dlg.locator(".picker-grid li").count();
  await dlg.getByLabel("Filter by shape").selectOption("square");
  await page.waitForTimeout(500);
  const squareCount = await dlg.locator(".picker-grid li").count();
  check("filters: the shape filter keeps only pictures of that shape (the library has landscape pictures, so portrait and square lists are shorter than the whole)", portraitCount < cardsAll && squareCount < cardsAll, `${portraitCount} portrait, ${squareCount} square of ${cardsAll}`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  // upload new: a tall picture and a wide one, made here
  const png = (w, h, rgb) => { const p = new PNG({ width: w, height: h }); for (let i = 0; i < w * h; i++) { p.data[i * 4] = rgb[0]; p.data[i * 4 + 1] = rgb[1]; p.data[i * 4 + 2] = rgb[2]; p.data[i * 4 + 3] = 255; } return PNG.sync.write(p); };
  const stamp = Date.now();
  const tall = join(tmpdir(), `cms-qa-tall-${stamp}.png`), wide = join(tmpdir(), `cms-qa-wide-${stamp}.png`);
  writeFileSync(tall, png(60, 120, [200, 30, 90])); writeFileSync(wide, png(200, 60, [30, 120, 200]));
  await bar.getByRole("button", { name: /Upload new Photo/ }).click();
  await page.waitForTimeout(500);
  check("Upload new opens the library on its Upload tab", (await page.locator("dialog.picker [role=tab][aria-selected=true]").innerText()) === "Upload");
  await page.locator('dialog.picker input[type=file]').setInputFiles(tall);
  await page.locator("dialog.picker").waitFor({ state: "hidden", timeout: 20000 });
  const up1 = sql(`SELECT id, storage, mime, width, height, original_name, url FROM media WHERE original_name = 'cms-qa-tall-${stamp}.png'`)[0];
  check("an uploaded picture goes to the library (stored in R2, only its details in D1) and is chosen in the field", !!up1 && up1.storage === "r2" && up1.width === 60 && up1.height === 120 && /^\/media\//.test(up1.url), JSON.stringify(up1));
  const infoUp = (await bar.locator(".media-info").innerText()).replace(/\s+/g, " ");
  check("the field now shows the uploaded file's name and dimensions", infoUp.includes(`cms-qa-tall-${stamp}.png`) && infoUp.includes("60×120 px"), infoUp);
  await bar.getByLabel("Description for screen readers (leave empty if it is only decoration)").fill("A tall test picture");
  await saveSection();
  const sv = await content("sec_home_services");
  check("only the media id and the description are stored in the section (no URL, no file data)", JSON.stringify(sv.bookBar.avatar) === JSON.stringify({ id: up1.id, alt: "A tall test picture" }) && !JSON.stringify(sv).includes("/media/") && JSON.stringify(sv).length < 6000);
  const home1 = await html("/");
  const srcUp = /class="avatar" src="([^"]+)" alt="A tall test picture"|src="([^"]+)" alt="A tall test picture"[^>]*class="avatar"|class="avatar"[^>]*src="([^"]+)"[^>]*alt="A tall test picture"/.exec(home1);
  check("the public page resolves the reference to the media address and uses the page's description as alt", !!srcUp && /\/media\/|media\./.test(srcUp[1] ?? srcUp[2] ?? srcUp[3] ?? ""), srcUp?.[0]?.slice(0, 160));
  const cssAfter = await css();
  check("the picture is drawn exactly like before: same size, same object-fit, same rounding, no width/height attributes", JSON.stringify(cssAfter) === JSON.stringify(cssBefore) && cssAfter.fit === "cover", `${JSON.stringify(cssBefore)} vs ${JSON.stringify(cssAfter)}`);
  const cssFloat = async () => { const c = await ctx.newPage(); await c.goto(BASE + "/about"); await c.waitForLoadState("networkidle"); const v = await c.evaluate(() => { const e = document.querySelector(".floater img"); if (!e) return null; const s = getComputedStyle(e); return { w: s.width, h: s.height, fit: s.objectFit }; }); await c.close(); return v; };
  const floatBefore = await cssFloat();

  // replace file: same library entry, new picture, every page follows
  await bar.getByRole("button", { name: /Replace file of Photo/ }).waitFor();
  page.once("dialog", (d) => d.accept());
  await bar.locator('input[type=file][aria-label="Choose the new file"]').setInputFiles(wide);
  await page.waitForTimeout(2500);
  const rep = sql(`SELECT id, width, height, original_name, url FROM media WHERE id = '${up1.id}'`)[0];
  check("Replace file keeps the library entry (same id) and gives it the new file", rep.id === up1.id && rep.width === 200 && rep.height === 60 && rep.url !== up1.url, JSON.stringify(rep));
  check("the field shows the new file's details and says so", (await bar.locator(".media-info").innerText()).includes("200×60 px") && (await bar.locator(".cms-saved").innerText()).includes("File replaced"));
  const home2 = await html("/");
  check("the public page now serves the replaced file under the same reference (no section change needed)", home2.includes(rep.url.replace("/media/", "")) && !home2.includes(up1.url.replace("/media/", "")));
  const cssWide = await css();
  check("a picture of another shape is still drawn at the same size with object-fit: cover", JSON.stringify(cssWide) === JSON.stringify(cssBefore), `${JSON.stringify(cssWide)}`);

  // use the same wide picture in the CTA band (every page) and check the floating picture keeps its box
  await go("/admin/pages/shared/cta");
  const firstFloater = page.locator("fieldset.le-item").filter({ has: page.locator("legend", { hasText: /^Picture 1$/ }) }).first();
  await firstFloater.getByRole("button", { name: /Change Floating picture/ }).click();
  await page.locator("dialog.picker .picker-grid li").first().waitFor();
  await page.locator("dialog.picker .picker-grid li", { hasText: `cms-qa-wide-${stamp}.png` }).first().click().catch(async () => { await page.locator("dialog.picker").getByLabel("Search the media library").fill(`cms-qa-wide-${stamp}`); await page.waitForTimeout(900); await page.locator("dialog.picker .picker-grid li").first().click(); });
  await saveSection();
  const floatAfter = await cssFloat();
  check("the CTA band's floating picture keeps its size and object-fit with a differently shaped picture", JSON.stringify(floatAfter) === JSON.stringify(floatBefore) && floatAfter?.fit === "cover", `${JSON.stringify(floatBefore)} vs ${JSON.stringify(floatAfter)}`);

  // the library knows where the file is used, and refuses to delete it
  await go(`/admin/media/${up1.id}`);
  const usage = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  check("the media library lists the page sections that use a file (Home / Services)", /Home \/ Services/.test(usage), usage.slice(0, 200));

  // alt text: use the library description, edit, remove
  await go("/admin/pages/home/services");
  await bar.getByLabel("Description for screen readers (leave empty if it is only decoration)").fill("");
  await saveSection();
  check("the description can be emptied (decoration): stored empty, alt=\"\" on the page", (await content("sec_home_services")).bookBar.avatar.alt === "" && /<img[^>]*class="avatar"[^>]*alt=""|<img[^>]*alt=""[^>]*class="avatar"/.test((await html("/")).split("book-bar")[1] ?? ""));
  await bar.getByRole("button", { name: /Remove Photo/ }).click();
  check("Remove clears the picture in the form and drops its description field", (await bar.locator(".media-info").count()) === 0 && (await bar.getByLabel("Description for screen readers (leave empty if it is only decoration)").count()) === 0);
  await saveSection();
  check("after saving, the optional picture is null in the section and gone from the public page", (await content("sec_home_services")).bookBar.avatar === null && !(await html("/")).includes('class="avatar"'.concat(' src="/media/')));
  await bar.getByRole("button", { name: /Choose Photo/ }).click();
  await page.locator("dialog.picker .picker-grid li", { hasText: /jordan/i }).first().click();
  const libAlt = sql("SELECT alt_text FROM media WHERE id = 'media_people-jordan'")[0].alt_text;
  if (libAlt) {
    await bar.getByRole("button", { name: "Use as description here" }).click();
    check("\"Use as description here\" copies the library description into the field", (await bar.getByLabel("Description for screen readers (leave empty if it is only decoration)").inputValue()) === libAlt);
  }
  await page.getByRole("button", { name: "Cancel changes" }).click();
  await go("/admin/pages/home/showreel");
  await page.getByRole("button", { name: /Change Video/ }).click();
  await page.locator("dialog.picker .picker-grid li").first().waitFor();
  const vcards = await page.locator("dialog.picker .picker-grid li").allInnerTexts();
  check("a video field opens the library on the videos only (no upload tab), with name, size and description", vcards.length >= 1 && /showreel/i.test(vcards.join(" ")) && (await page.locator('dialog.picker[open] [role=tab]').count()) === 1 && (await page.locator("dialog.picker[open] .picker-grid img").count()) === 0, vcards.join(" | ").replace(/\s+/g, " "));
  await page.keyboard.press("Escape");
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

  // ---- the SEO editor
  await go("/admin/pages");
  check("the list's Edit SEO opens the page's own SEO editor", (await page.locator("table.pages-table tbody tr").nth(1).getByRole("link", { name: "Edit SEO" }).getAttribute("href")) === "/admin/pages/about/seo" && (await page.locator("table.pages-table tbody tr").nth(2).getByRole("link", { name: "Edit SEO" }).getAttribute("href")) === "/admin/pages/home/seo");
  await go("/admin/pages/about/seo");
  check("the SEO editor has SEO title, SEO description, Canonical URL, Open Graph image, Indexing and Links", (await page.getByLabel("SEO title").count()) === 1 && (await page.getByLabel("SEO description").count()) === 1 && (await page.getByLabel("Canonical URL").count()) === 1 && (await page.getByRole("button", { name: /Open Graph image/ }).count()) >= 1 && (await page.getByLabel("Indexing").count()) === 1 && (await page.getByLabel("Links").count()) === 1);
  const headline = async () => (await html("/about")).match(/<h1[^>]*id="about-title"[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const h1Before = await headline();
  const guide = async (id) => page.locator(`#${id} .seo-guide`);
  await page.getByLabel("SEO title").fill("Tiny");
  check("title guidance: a short title is flagged short, with its count", /is-short/.test((await (await guide("seo-title-guide")).getAttribute("class")) ?? "") && (await (await guide("seo-title-guide")).innerText()).includes("4/70"));
  await page.getByLabel("SEO title").fill("A good length title for the about page of the website");
  check("title guidance: 30 to 60 characters is good", /is-good/.test((await (await guide("seo-title-guide")).getAttribute("class")) ?? ""));
  await page.getByLabel("SEO title").fill("x".repeat(66));
  check("title guidance: past 60 is long (search engines may cut it)", /is-long/.test((await (await guide("seo-title-guide")).getAttribute("class")) ?? ""));
  await page.getByLabel("SEO title").fill("x".repeat(72));
  check("title guidance: past 70 is over the limit", /is-over/.test((await (await guide("seo-title-guide")).getAttribute("class")) ?? ""));
  await page.getByLabel("SEO description").fill("Too short");
  check("description guidance: under 70 is flagged short", /is-short/.test((await (await guide("seo-desc-guide")).getAttribute("class")) ?? ""));
  await page.getByLabel("SEO description").fill("d".repeat(120));
  check("description guidance: 70 to 160 is good", /is-good/.test((await (await guide("seo-desc-guide")).getAttribute("class")) ?? ""));
  await page.getByLabel("SEO description").fill("d".repeat(190));
  check("description guidance: 161 to 200 is long", /is-long/.test((await (await guide("seo-desc-guide")).getAttribute("class")) ?? ""));
  await page.getByLabel("SEO title").fill("ADMIN ABOUT TITLE");
  await page.getByLabel("SEO description").fill("A description of the about page that is long enough to pass the schema check.");
  check("the search result preview follows what is typed", (await page.locator(".sp-title").innerText()) === "ADMIN ABOUT TITLE" && (await page.locator(".sp-desc").innerText()).startsWith("A description of the about page"));
  await page.getByLabel("Canonical URL").fill("/about");
  await page.getByLabel("Indexing").selectOption("noindex");
  await page.getByLabel("Links").selectOption("nofollow");
  check("the robots result is spelled out", (await page.locator("code", { hasText: "noindex, nofollow" }).count()) === 1);
  await page.getByRole("button", { name: "Save SEO" }).click();
  await page.waitForTimeout(900);
  const about = await html("/about");
  check("the page's metadata is generated from the stored values (title, description, canonical, robots noindex + nofollow, Open Graph title)", has(about, "<title>ADMIN ABOUT TITLE</title>") && has(about, "A description of the about page that is long enough to pass the schema check.") && /rel="canonical" href="[^"]*\/about"/.test(about) && /name="robots" content="noindex, nofollow"/.test(about) && /property="og:title" content="ADMIN ABOUT TITLE"/.test(about));
  check("the page's own headline is separate from the SEO title (the H1 did not change)", (await headline()) === h1Before && !h1Before.includes("ADMIN ABOUT TITLE"), h1Before);
  {
    const visible = (about.split("</head>")[1] ?? "").replace(/<title>[\s\S]*?<\/title>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    check("SEO fields are not shown as visible content (the title and description appear only in the head, not in the page text)", !visible.includes("ADMIN ABOUT TITLE") && !visible.includes("A description of the about page that is long enough"));
  }
  await page.getByLabel("Indexing").selectOption("index");
  await page.getByRole("button", { name: "Save SEO" }).click();
  await page.waitForTimeout(900);
  check("index and follow are independent: noindex off, nofollow still on", /name="robots" content="index, nofollow"/.test(await html("/about")));
  await page.getByLabel("Links").selectOption("follow");
  await page.getByLabel("Indexing").selectOption("noindex");
  await page.getByRole("button", { name: "Save SEO" }).click();
  await page.waitForTimeout(900);
  check("and the other way round: noindex with links followed", /name="robots" content="noindex, follow"/.test(await html("/about")));
  await page.getByLabel("SEO description").fill("short");
  await page.getByRole("button", { name: "Save SEO" }).click();
  await page.waitForTimeout(600);
  check("a description under 20 characters is refused by the server", (await page.locator(".field-err").first().innerText()).includes("too short"));
  await page.getByLabel("SEO description").fill("A description of the about page that is long enough to pass the schema check.");
  // the Open Graph image, chosen from the media library
  await page.getByRole("button", { name: /Choose Open Graph image/ }).click();
  await page.locator("dialog.picker[open] .picker-grid li", { hasText: /Earth/ }).first().click();
  check("the Open Graph image is chosen from the media library and shown in the share card preview", (await page.locator(".share-card img").count()) === 1 && (await page.locator(".media-info").innerText()).includes("earth.webp"));
  await page.getByLabel("Indexing").selectOption("index");
  await page.getByRole("button", { name: "Save SEO" }).click();
  await page.waitForTimeout(900);
  const about3 = await html("/about");
  check("the Open Graph image reaches the page's metadata (og:image and twitter:image)", /property="og:image" content="[^"]*earth[^"]*"/.test(about3) && /name="twitter:image" content="[^"]*earth/.test(about3));
  await go("/admin/pages/about/seo");
  await page.getByLabel("SEO title").fill("");
  await page.getByLabel("SEO description").fill("");
  await page.getByLabel("Canonical URL").fill("");
  await page.getByLabel("Links").selectOption("follow");
  await page.getByRole("button", { name: /Remove Open Graph image/ }).click();
  await page.getByRole("button", { name: "Save SEO" }).click();
  await page.waitForTimeout(900);
  const about2 = await html("/about");
  check("cleared fields go back to the defaults from Settings, and robots to index, follow", has(about2, "<title>About — Visuolab</title>") && /name="robots" content="index, follow"/.test(about2) && !/property="og:image" content="[^"]*earth/.test(about2));
  const au = sql("SELECT summary FROM audit_logs WHERE action = 'cms.page.seo' ORDER BY created_at DESC LIMIT 1")[0];
  check("an SEO save is in the audit log, naming the fields and not their values", !!au && /changed/.test(au.summary) && !/ADMIN ABOUT TITLE/.test(au.summary), au?.summary);
  await go("/admin/pages/service-detail/seo").catch(() => {});
  check("copy that is not a page (shared, labels) has no SEO editor", (await fetch(BASE + "/admin/pages/shared/seo", { redirect: "manual", headers: { cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } })).status === 404);

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
  for (const p of snapshot.pages) sql(`UPDATE pages SET seo_title = ${esc(p.seo_title)}, seo_description = ${esc(p.seo_description)}, og_image_id = ${esc(p.og_image_id)}, canonical_url = ${esc(p.canonical_url)}, noindex = ${p.noindex}, nofollow = ${p.nofollow}, updated_at = ${esc(p.updated_at)} WHERE id = ${esc(p.id)}`);
  sql("DELETE FROM page_section_revisions"); // the versions this run made
  sql("DELETE FROM page_section_refs");
  for (const r of refsSnapshot) sql(`INSERT INTO page_section_refs (section_id, field_path, kind, media_id, case_study_id) VALUES (${esc(r.section_id)}, ${esc(r.field_path)}, ${esc(r.kind)}, ${esc(r.media_id)}, ${esc(r.case_study_id)})`);
  sql(`DELETE FROM media WHERE id NOT IN (${mediaBefore.map(esc).join(",")})`); // the pictures this run uploaded
  sql("DELETE FROM rate_limits");
}
await browser.close();
check("content restored", JSON.stringify(sql("SELECT id, content, is_enabled FROM page_sections ORDER BY id")) === JSON.stringify(snapshot.sections.map(({ id, content, is_enabled }) => ({ id, content, is_enabled })).sort((a, b) => (a.id < b.id ? -1 : 1))));
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
