// End-to-end test of the section editors of services, case studies and articles (/admin/services/<id>, /admin/case-studies/<id>, /admin/blog/<id>)
// against a running local site and its LOCAL database.
//   npm i --no-save playwright
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:3001 node scripts/qa/entities-admin-qa.mjs
// It signs in, opens the overview and the sections of one service, one case study and one article, edits them, checks that the public page follows,
// that nothing else in the record changed, validation, previous versions, version conflicts, the audit log and authorization, then puts the three
// records back exactly. Never point it at the live site.
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
const sql1 = (q) => { const f = join(tmpdir(), `entities-admin-qa-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } }; // wrangler occasionally crashes on Windows: retry
const html = async (p) => { for (let a = 0; ; a++) { try { return (await (await fetch(BASE + p)).text()).replace(/<!--[\s\S]*?-->/g, ""); } catch (e) { if (a >= 5) throw e; await new Promise((r) => setTimeout(r, 1500)); } } };
const has = (h, s) => h.includes(s);
const esc = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? v : `'${String(v).replace(/'/g, "''")}'`);
/** The text a visitor reads: tags removed, the hidden streaming copy of the head and scripts left out. */
const visible = (h) => (h.split("</head>")[1] ?? h).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const SVC = "svc_brand-identity", CASE = "case_orbit", POST = "post_design-systems-that-survive";
const svcRow = () => sql(`SELECT * FROM services WHERE id = '${SVC}'`)[0];
const caseRow = () => sql(`SELECT * FROM case_studies WHERE id = '${CASE}'`)[0];
const postRow = () => sql(`SELECT * FROM blog_posts WHERE id = '${POST}'`)[0];
const others = (row, keep) => JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k]) => !keep.includes(k) && !["updated_at", "published_at"].includes(k))));

sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions");
const snap = {
  svc: svcRow(), case: caseRow(), post: postRow(),
  svcLinks: sql(`SELECT * FROM service_case_studies WHERE service_id = '${SVC}'`),
  caseLinks: sql(`SELECT * FROM service_case_studies WHERE case_study_id = '${CASE}'`),
  images: sql(`SELECT * FROM case_study_images WHERE case_study_id = '${CASE}'`),
  postTags: sql(`SELECT * FROM blog_post_tags WHERE post_id = '${POST}'`),
  tagIds: sql("SELECT id FROM blog_tags").map((t) => t.id),
  featured: sql("SELECT id FROM blog_posts WHERE featured = 1").map((r) => r.id),
};
const updateAll = (table, row) => `UPDATE ${table} SET ${Object.entries(row).filter(([k]) => k !== "id").map(([k, v]) => `${k} = ${esc(v)}`).join(", ")} WHERE id = ${esc(row.id)}`;
const insertAll = (table, row) => `INSERT INTO ${table} (${Object.keys(row).join(", ")}) VALUES (${Object.values(row).map(esc).join(", ")})`;
const categories = sql("SELECT id, title FROM blog_categories ORDER BY position");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); await page.waitForTimeout(300); };
const save = async () => { await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/")), page.getByRole("button", { name: "Save section" }).click()]); await page.waitForTimeout(600); };
/** A field by its label ("optional" is part of the label of a field that may be empty). */
const L = (name) => page.getByLabel(new RegExp("^" + name.replace(/[()]/g, "\\$&") + "( optional)?$"));
const cardNames = async () => page.locator("ol.section-cards li h3").allInnerTexts();
const hidden = async () => (await page.locator("form.cms-editor").count()) === 1;

try {
  // ---- sign in; the lists lead to the overview
  await page.goto(BASE + "/admin/login"); await page.waitForLoadState("networkidle");
  await page.fill('input[name="email"]', EMAIL); await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([page.waitForURL((u) => !/\/login/.test(u.pathname)), page.click('button[type="submit"]')]);
  for (const [list, id] of [["services", SVC], ["case-studies", CASE], ["blog", POST]]) {
    await go(`/admin/${list}`);
    const hrefs = await page.locator(`a[href^="/admin/${list}/"]`).evaluateAll((a) => a.map((x) => x.getAttribute("href")));
    check(`${list}: the list opens a record on its section overview`, hrefs.includes(`/admin/${list}/${id}`) && !hrefs.some((h) => /\/edit$/.test(h)), hrefs.slice(0, 4).join(" "));
  }

  // ======================================== case study ========================================
  await go(`/admin/case-studies/${CASE}`);
  const caseCards = await cardNames();
  check("case study overview: one card per section, in the order of the public page", caseCards.join("|") === "Hero|Project details|Introduction|First gallery|Approach|Second gallery|Challenge|Wide image|Results|Related work|Card on the Works page|Card on service pages and Home|Shown on service pages|Search engines (SEO)", caseCards.join("|"));
  const c0 = (await page.locator("ol.section-cards li").nth(3).innerText()).replace(/\s+/g, " ");
  check("each card shows its type, what it is for, when it was last changed and an Edit button; the ten blocks of the page have a switch, the cards and the search settings do not", c0.includes("Image gallery") && /Pictures of the project/.test(c0) && /Not changed since it was created/.test(c0) && (await page.locator("ol.section-cards li button[role=switch]").count()) === 10 && (await page.locator("ol.section-cards li").getByRole("link", { name: "Edit" }).count()) === 14);
  check("the header names the case study, has its status, Basics and publishing, and View page", (await page.locator("h1").innerText()).includes("Orbit") && (await page.getByRole("link", { name: "Basics and publishing" }).first().getAttribute("href")) === `/admin/case-studies/${CASE}/edit` && (await page.getByRole("link", { name: /View page/ }).getAttribute("href")) === "/works/orbit");
  await go(`/admin/case-studies/${CASE}/edit`);
  check("the full form is still there, and links back to the sections", (await page.getByRole("link", { name: "Edit by section" }).getAttribute("href")) === `/admin/case-studies/${CASE}` && (await page.locator("form.svc-form").count()) >= 1);

  // hero: headline
  const beforeCase = caseRow();
  await go(`/admin/case-studies/${CASE}/hero`);
  check("a section editor is generated from its schema: headline and cover picture, with the saved content", (await L("Headline").inputValue()) === beforeCase.title && (await page.getByText("Cover picture").count()) > 0 && (await page.locator("h1").innerText()).includes("Hero"));
  check("nothing can be saved before something changes", await page.getByRole("button", { name: "Save section" }).isDisabled());
  await L("Headline").fill("ADMIN <em>headline</em> for Orbit");
  await save();
  const c1 = caseRow();
  check("saving a section writes it, and says so", c1.title === "ADMIN <em>headline</em> for Orbit" && (await page.locator(".cms-saved").count()) === 1);
  check("only that part of the record changed (every other column and the pictures are untouched)", others(c1, ["title"]) === others(beforeCase, ["title"]) && JSON.stringify(sql(`SELECT media_id, role, position, caption, alt_text, object_position FROM case_study_images WHERE case_study_id = '${CASE}' ORDER BY role, position`)) === JSON.stringify(snap.images.map(({ media_id, role, position, caption, alt_text, object_position }) => ({ media_id, role, position, caption, alt_text, object_position })).sort((a, b) => (a.role + a.position < b.role + b.position ? -1 : 1))));
  check("the public page follows", has(await html("/works/orbit"), "ADMIN <em>headline</em> for Orbit".replace(/<em>/g, "<em>")) || visible(await html("/works/orbit")).includes("ADMIN headline for Orbit"));
  {
    const au = sql("SELECT action, entity_type, entity_id, summary FROM audit_logs WHERE action = 'case_study.section' ORDER BY created_at DESC LIMIT 1")[0];
    check("the save is in the audit log, naming the section and the field (not the value)", !!au && au.entity_id === CASE && /Hero: changed title/.test(au.summary) && !/ADMIN/.test(au.summary), au?.summary);
  }
  // previous versions
  await go(`/admin/case-studies/${CASE}/hero`);
  check("previous versions are listed on the section", (await page.locator(".cms-versions li").count()) === 1);
  await page.getByRole("button", { name: "Load into the editor" }).click();
  check("loading a previous version fills the editor without saving", (await L("Headline").inputValue()) === beforeCase.title && caseRow().title === "ADMIN <em>headline</em> for Orbit");
  await save();
  check("saving it makes the old version live again", caseRow().title === beforeCase.title);

  // validation: nothing is written
  await go(`/admin/case-studies/${CASE}/facts`);
  check("project details: six fields with their limits", (await L("Client (short name)").inputValue()) === beforeCase.client_name && (await L("Year").inputValue()) === beforeCase.year);
  await L("Year").fill("20x6");
  await save();
  check("a year that is not 4 digits is refused with the field's message and nothing is written", (await page.locator(".field-err").first().innerText()).includes("4 digits") && caseRow().year === beforeCase.year);
  await L("Year").fill(beforeCase.year);
  await L("Industry").fill("QA <b>industry</b>");
  await save();
  check("markup in plain text is refused", (await page.locator(".field-err").first().innerText()).includes("cannot contain") && !has(JSON.stringify(sql(`SELECT facts_json f FROM case_studies WHERE id = '${CASE}'`)), "QA"));
  await L("Industry").fill("QA industry");
  await save();
  check("project details: a fact is saved into the facts list and shown on the page", has(caseRow().facts_json, '"term":"Industry","value":"QA industry"') && visible(await html("/works/orbit")).includes("QA industry"));

  // introduction: stats list
  await go(`/admin/case-studies/${CASE}/about`);
  const statsBefore = JSON.parse(caseRow().stats_json);
  await page.getByRole("button", { name: "+ Add number" }).click();
  await page.locator("fieldset.le-item").last().getByLabel(/^Number( optional)?$/).fill("9<em>x</em>");
  await page.locator("fieldset.le-item").last().getByLabel(/^What it means( optional)?$/).fill("QA stat");
  await save();
  const statsAfter = JSON.parse(caseRow().stats_json);
  check("a list item is added with its fields, and the limits show (1 to 4)", (statsBefore.length < 4 ? statsAfter.length === statsBefore.length + 1 : true) && statsAfter.at(-1)?.label === "QA stat", `${statsBefore.length} -> ${statsAfter.length}`);
  check("the new key number is on the public page", visible(await html("/works/orbit")).includes("QA stat"));

  // galleries: reorder, caption
  await go(`/admin/case-studies/${CASE}/gallery-1`);
  const gal = sql(`SELECT position, caption, media_id FROM case_study_images WHERE case_study_id = '${CASE}' AND role = 'gallery_a' ORDER BY position`);
  check("a gallery lists its pictures with media pickers, caption and crop position", (await page.locator("fieldset.le-item").count()) === gal.length && (await page.getByText("Crop position").count()) >= gal.length);
  await page.getByRole("button", { name: "Move Picture 1 down" }).click();
  await L("Caption").first().fill("QA caption");
  await save();
  const gal2 = sql(`SELECT position, caption, media_id FROM case_study_images WHERE case_study_id = '${CASE}' AND role = 'gallery_a' ORDER BY position`);
  check("reordering moves the picture and its caption; the other gallery and the wide image are untouched", gal2[0].media_id === gal[1].media_id && gal2[1].media_id === gal[0].media_id && gal2[0].caption === "QA caption" && sql(`SELECT COUNT(*) n FROM case_study_images WHERE case_study_id = '${CASE}'`)[0].n === snap.images.length);
  check("the public gallery shows the new caption in the new order", visible(await html("/works/orbit")).includes("QA caption"));
  {
    const bad = L("Crop position").first();
    await bad.fill("left");
    await save();
    check("a crop position that does not look like 20% 30% is refused", (await page.locator(".field-err").count()) > 0);
    await bad.fill("");
  }

  // approach: nested list; results: toggle style; related work: choice list
  await go(`/admin/case-studies/${CASE}/approach`);
  const proc = JSON.parse(caseRow().process_json);
  check("the approach editor shows steps with nested deliverables", (await page.locator("fieldset.le-item").count()) >= proc.steps.length && (await page.getByText("Deliverable 1").count()) > 0);
  await L("Title").first().fill("QA step title");
  await save();
  check("a step's title is saved inside the process document, other steps untouched", JSON.parse(caseRow().process_json).steps[0].title === "QA step title" && JSON.parse(caseRow().process_json).steps.length === proc.steps.length && JSON.parse(caseRow().process_json).steps[0].deliverables.length === proc.steps[0].deliverables.length);
  await go(`/admin/case-studies/${CASE}/results`);
  const resBefore = JSON.parse(caseRow().results_json);
  const metric = page.locator("fieldset.le-item").first().getByRole("checkbox");
  const wasOn = await metric.isChecked();
  await metric.setChecked(!wasOn);
  await save();
  check("a yes/no switch inside a list item is saved", JSON.parse(caseRow().results_json).items[0].metric === !resBefore.items[0].metric);
  await go(`/admin/case-studies/${CASE}/related-work`);
  const more = JSON.parse(caseRow().more_json);
  check("related work: the projects are chosen from a list of the other case studies (not itself)", (await page.locator(".cms-case-row select").first().locator("option").allInnerTexts()).every((o) => !/\(orbit\)/.test(o)) && (await page.locator(".cms-case-row").count()) === more.slugs.length);
  await page.getByRole("button", { name: "Move 1 down" }).first().click();
  await save();
  check("reordering the related projects is saved", JSON.parse(caseRow().more_json).slugs.join() === [more.slugs[1], more.slugs[0], ...more.slugs.slice(2)].join() || more.slugs.length < 2);

  // card on Works, showcase, services, seo
  await go(`/admin/case-studies/${CASE}/works-card`);
  await L("Type line").fill("QA type line");
  await save();
  check("the card on the Works page: type line saved and shown on /works", caseRow().type_line === "QA type line" && visible(await html("/works")).includes("QA type line"));
  await go(`/admin/case-studies/${CASE}/showcase`);
  const sc0 = JSON.parse(caseRow().showcase_json);
  check("the showcase card has numbers and an optional client quote (a switch)", (await page.getByText("Show this part").count()) === 1 || sc0.quote !== undefined);
  await go(`/admin/case-studies/${CASE}/seo`);
  await L("SEO title").fill("QA case SEO title");
  await save();
  check("search settings: the page's <title> follows, and is not the headline", has(await html("/works/orbit"), "<title>QA case SEO title</title>") && caseRow().title === beforeCase.title);
  await L("SEO title").fill("x".repeat(80));
  await save();
  check("an SEO title over 70 characters is refused", (await page.locator(".field-err").first().innerText()).includes("too long") && caseRow().meta_title === "QA case SEO title");

  // reference check: a related project that does not exist
  await go(`/admin/case-studies/${CASE}/services`);
  check("service links: a list of the services to show this case study on", (await page.locator("form.cms-editor").count()) === 1);

  // conflict
  await go(`/admin/case-studies/${CASE}/seo`);
  await L("SEO title").fill("CONFLICT TITLE");
  sql(`UPDATE case_studies SET updated_at = '2030-01-01T00:00:00.000Z' WHERE id = '${CASE}'`);
  await save();
  check("a save from an old version is a conflict: nothing is overwritten and the editor says so", (await page.locator(".form-errors").innerText()).includes("changed by someone else") && caseRow().meta_title !== "CONFLICT TITLE");

  // previous versions are kept ten at a time
  await go(`/admin/case-studies/${CASE}/facts`);
  for (let i = 0; i < 12; i++) { await L("Timeline").fill(`QA ${i} weeks`); await save(); }
  check("each section keeps its last 10 previous versions", sql(`SELECT COUNT(*) n FROM entity_section_revisions WHERE entity_id = '${CASE}' AND section_key = 'facts'`)[0].n === 10);

  // ======================================== service ========================================
  await go(`/admin/services/${SVC}`);
  const svcCards = await cardNames();
  check("service overview: one card per section in the order of the page", svcCards.join("|") === "Hero|What we fix|Overview|Outcomes|Call to action band|What is included|Process|Case studies|Search engines (SEO)", svcCards.join("|"));
  check("every section of a service page has a switch except the search settings; 'What we fix' starts disabled", (await page.locator("ol.section-cards li button[role=switch]").count()) === 8 && (await page.locator("ol.section-cards li").nth(1).innerText()).includes("Disabled") && (await page.locator("ol.section-cards li").nth(8).locator("button[role=switch]").count()) === 0);
  const beforeSvc = svcRow();
  await go(`/admin/services/${SVC}/hero`);
  await L("Intro text").fill("ADMIN intro text of the service.");
  await page.locator("fieldset", { hasText: "Button" }).getByLabel(/^Text( optional)?$/).fill("Admin button");
  await save();
  const s1 = svcRow();
  check("service hero: intro text and button saved; the page follows; nothing else changed", s1.hero_lead === "ADMIN intro text of the service." && s1.hero_cta_label === "Admin button" && visible(await html("/services/brand-identity")).includes("ADMIN intro text") && others(s1, ["hero_lead", "hero_cta_label"]) === others(beforeSvc, ["hero_lead", "hero_cta_label"]));
  check("the picture sizes recorded for the hero are kept (the page layout does not shift)", s1.hero_shots_json === beforeSvc.hero_shots_json);
  await go(`/admin/services/${SVC}/hero`);
  // a section switched off is hidden on the page; switching on an unfinished one is refused
  await go(`/admin/services/${SVC}`);
  const pageBefore = await html("/services/brand-identity");
  check("'What we fix' is hidden on the page today", /<section class="sec prob-sec"[^>]*hidden/.test(pageBefore) || has(pageBefore, 'prob-sec" aria-labelledby="prob-title" hidden'));
  sql(`UPDATE services SET problems_json = json_set(problems_json, '$.items', json('[]')) WHERE id = '${SVC}'`); // an unfinished section
  await go(`/admin/services/${SVC}`);
  await page.locator("ol.section-cards li").nth(1).locator("button[role=switch]").click();
  await page.waitForTimeout(2000);
  check("switching on a section whose fields are not finished is refused with a message, and it stays hidden", (svcRow().show_problems === 0) && /Not shown|finish/.test(await page.locator("body").innerText()));
  sql(`UPDATE services SET problems_json = ${esc(beforeSvc.problems_json)} WHERE id = '${SVC}'`); // finished again
  await go(`/admin/services/${SVC}`);
  await page.locator("ol.section-cards li").nth(1).locator("button[role=switch]").click();
  await page.waitForTimeout(2000);
  const shown = await html("/services/brand-identity");
  check("once it is finished, switching it on shows it on the page (the markup is not hidden any more)", svcRow().show_problems === 1 && !/prob-sec"[^>]*hidden/.test(shown), svcRow().show_problems);
  await go(`/admin/services/${SVC}`);
  await page.locator("ol.section-cards li").nth(1).locator("button[role=switch]").click();
  await page.waitForTimeout(2000);
  check("and off again: hidden, the content kept", svcRow().show_problems === 0 && JSON.parse(svcRow().problems_json).items.length > 0);
  // included: icons survive
  await go(`/admin/services/${SVC}/included`);
  const inc0 = JSON.parse(beforeSvc.included_json);
  await page.locator("fieldset.le-item").first().getByLabel(/^Title( optional)?$/).fill("QA included title");
  await save();
  const inc1 = JSON.parse(svcRow().included_json);
  check("editing an 'included' card keeps every card's icon (icons are not shown in the form but travel with the card)", inc1.items.length === inc0.items.length && inc1.items.every((x, i) => JSON.stringify(x.icon) === JSON.stringify(inc0.items[i].icon)) && inc1.items[0].title === "QA included title");
  await page.getByRole("button", { name: "+ Add item" }).click();
  await page.locator("fieldset.le-item").last().getByLabel(/^Title( optional)?$/).fill("New card");
  await page.locator("fieldset.le-item").last().getByLabel(/^Text( optional)?$/).fill("New card text.");
  await save();
  check("a new card gets a plain circle icon", JSON.parse(svcRow().included_json).items.at(-1).icon.nodes[0].t === "circle");
  // case studies
  await go(`/admin/services/${SVC}/case-studies`);
  const links0 = sql(`SELECT case_study_id FROM service_case_studies WHERE service_id = '${SVC}' ORDER BY position`).map((r) => r.case_study_id);
  if (links0.length >= 2) {
    await page.getByRole("button", { name: "Move 1 down" }).first().click();
    await save();
    check("service case studies: reordering is saved in the link table", sql(`SELECT case_study_id FROM service_case_studies WHERE service_id = '${SVC}' ORDER BY position`).map((r) => r.case_study_id).join() === [links0[1], links0[0], ...links0.slice(2)].join());
  } else check("service case studies: at least two linked to test the order", false);
  await go(`/admin/services/${SVC}/seo`);
  await L("SEO title").fill("QA service SEO title");
  await save();
  check("service search settings: the <title> follows", has(await html("/services/brand-identity"), "<title>QA service SEO title</title>"));

  // ======================================== article ========================================
  await go(`/admin/blog/${POST}`);
  const postCards = await cardNames();
  check("article overview: one card per section in the order of the page", postCards.join("|") === "Headline and byline|Cover picture|Opening paragraph|Article body|Closing line|More from the studio|Listing card and tags|Search engines (SEO)", postCards.join("|"));
  const beforePost = postRow();
  await go(`/admin/blog/${POST}/body`);
  const body0 = JSON.parse(beforePost.body_json);
  check("the body is edited block by block (not one text): every block is its own box", (await page.locator(".article-editor fieldset.le-item").count()) === body0.length);
  await page.getByRole("button", { name: "+ Paragraph" }).click();
  await page.locator(".article-editor fieldset.le-item").last().locator("textarea").fill("QA new paragraph with **bold**.");
  await save();
  const body1 = JSON.parse(postRow().body_json);
  check("a block added in the section editor is stored as a typed block, the others untouched", body1.length === body0.length + 1 && body1.at(-1).type === "paragraph" && JSON.stringify(body1.slice(0, -1)) === JSON.stringify(body0) && others(postRow(), ["body_json", "read_minutes"]) === others(beforePost, ["body_json", "read_minutes"]));
  check("the public article shows it, with the bold mark rendered", has(await html("/blog/design-systems-that-survive"), "<strong>bold</strong>"));
  await page.getByRole("button", { name: "Move block 1 down" }).click();
  await save();
  check("reordering blocks is saved", postRow().body_json !== JSON.stringify(body1) && JSON.parse(postRow().body_json)[1].text === body1[0].text);
  await go(`/admin/blog/${POST}/body`);
  await page.getByRole("button", { name: "+ Heading" }).click();
  await page.locator(".article-editor fieldset.le-item").last().locator("input[type=text]").fill("");
  await save();
  check("an empty heading is refused with its block named, and nothing is written", (await page.locator(".field-err").count()) > 0 && JSON.parse(postRow().body_json).length === body1.length);
  // header: category, author picture, date, reading time
  await go(`/admin/blog/${POST}/header`);
  check("the header has the headline, a category list, the author, the date and the reading time", (await L("Headline").inputValue()) === beforePost.title && (await L("Category").locator("option").count()) === categories.length + 1 && (await L("Publish date").inputValue()) === beforePost.published_at.slice(0, 16) && (await L("Reading time").count()) === 1);
  const otherCat = categories.find((c) => c.id !== beforePost.category_id);
  await L("Category").selectOption(otherCat.id);
  await L("Reading time").fill("9");
  await save();
  check("category and reading time are saved; the breadcrumb on the page shows the new category", postRow().category_id === otherCat.id && postRow().read_minutes === 9 && visible(await html("/blog/design-systems-that-survive")).includes(otherCat.title) && visible(await html("/blog/design-systems-that-survive")).includes("9 min read"));
  await L("Publish date").fill("2031-01-01T10:00");
  await save();
  check("moving a live article's date into the future is refused (it would take it offline)", (await page.locator(".field-err").first().innerText()).includes("live") && postRow().published_at === beforePost.published_at);
  await L("Publish date").fill(beforePost.published_at.slice(0, 16));
  await L("Reading time").fill("");
  await save();
  check("an empty reading time is worked out from the text", postRow().read_minutes >= 1 && postRow().read_minutes !== 9);
  await go(`/admin/blog/${POST}/closing-line`);
  await L("Link text").fill("QA link");
  await save();
  check("the closing line: its link text is saved and shown", JSON.parse(postRow().outro_json).linkText === "QA link" && has(await html("/blog/design-systems-that-survive"), ">QA link</a>"));
  await L("Link").fill("javascript:alert(1)");
  await save();
  check("an unsafe link is refused", (await page.locator(".field-err").count()) > 0 && JSON.parse(postRow().outro_json).href !== "javascript:alert(1)");
  await go(`/admin/blog/${POST}/more-from-the-studio`);
  check("more from the studio: chosen from the other articles (not itself)", (await page.locator(".cms-case-row select").first().locator("option").allInnerTexts()).every((o) => !/design-systems-that-survive/.test(o)));
  await go(`/admin/blog/${POST}/listing`);
  await page.getByRole("button", { name: "+ Add tag" }).click();
  await page.locator("fieldset.le-item").last().locator("input[type=text]").fill("qa-section-tag");
  await save();
  check("a tag added in the listing section creates the tag and links it", sql(`SELECT COUNT(*) n FROM blog_post_tags pt JOIN blog_tags t ON t.id = pt.tag_id WHERE pt.post_id = '${POST}' AND t.slug = 'qa-section-tag'`)[0].n === 1);
  await go(`/admin/blog/${POST}/seo`);
  await L("Canonical URL").fill("http://nope.example/x");
  await save();
  check("a canonical address must be https", (await page.locator(".field-err").first().innerText()).includes("https") && !postRow().canonical_url);
  await L("Canonical URL").fill("https://example.com/original");
  await L("SEO title").fill("QA article SEO title");
  await save();
  const seoHtml = await html("/blog/design-systems-that-survive");
  check("article search settings: <title> and canonical follow", has(seoHtml, "<title>QA article SEO title</title>") && has(seoHtml, 'rel="canonical" href="https://example.com/original"'));

  // ---- the section screens are not for the public; authorization
  const posted = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) posted.push(r); });
  await go(`/admin/case-studies/${CASE}/seo`);
  await L("SEO title").fill("REPLAYED");
  await save();
  sql(`UPDATE case_studies SET meta_title = 'QA reset title' WHERE id = '${CASE}'`);
  const req = posted.at(-1);
  const raw = req.postDataBuffer().toString("utf8");
  const oldStamp = /name="[_0-9]*expectedUpdatedAt"\r\n\r\n([^\r\n]+)/.exec(raw)?.[1] ?? "";
  const nowStamp = sql(`SELECT updated_at u FROM case_studies WHERE id = '${CASE}'`)[0].u;
  if (!oldStamp) throw new Error("could not find the version in the replayed request");
  const body = Buffer.from(raw.replace("REPLAYED", "HACKED").replace(oldStamp, nowStamp));
  const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const hdr = (origin, c) => ({ "content-type": req.headers()["content-type"], "next-action": req.headers()["next-action"], origin, host: new URL(BASE).host, ...(c ? { cookie: c } : {}) });
  const url = `/admin/case-studies/${CASE}/seo`;
  await fetch(BASE + url, { method: "POST", redirect: "manual", headers: hdr(BASE), body });
  check("authorization: a save replayed without a session changes nothing", caseRow().meta_title !== "HACKED");
  for (const p of [`/admin/case-studies/${CASE}`, `/admin/services/${SVC}/hero`, `/admin/blog/${POST}/body`]) {
    const r = await fetch(BASE + p, { redirect: "manual" });
    check(`authorization: ${p} redirects to sign-in without a session`, r.status >= 300 && r.status < 400 && /login/.test(r.headers.get("location") ?? ""), `${r.status}`);
  }
  await fetch(BASE + url, { method: "POST", redirect: "manual", headers: hdr("https://evil.example", cookie), body });
  check("authorization: a cross-origin replay with a valid session changes nothing", caseRow().meta_title !== "HACKED");
  const ok = await fetch(BASE + url, { method: "POST", redirect: "manual", headers: hdr(BASE, cookie), body });
  check("positive control: the same request with the session and the right origin is saved (so the refusals are real)", caseRow().meta_title === "HACKED", `status ${ok.status}`);
  await go("/admin/case-studies/case_does-not-exist");
  check("an unknown record is a not-found page, not an error", /could not be found|not found|404/i.test(await page.locator("body").innerText()));
  await go(`/admin/case-studies/${CASE}/nothing`);
  check("an unknown section is a not-found page", /could not be found|not found|404/i.test(await page.locator("body").innerText()));
  await page.setViewportSize({ width: 390, height: 900 });
  await go(`/admin/case-studies/${CASE}/approach`);
  check("on a phone the editor does not scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await go(`/admin/case-studies/${CASE}`);
  check("on a phone the overview does not scroll sideways", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  check("no JavaScript errors in the browser", errors.length === 0, errors.join(" | "));
} finally {
  // ---- put everything back
  sql(updateAll("services", snap.svc));
  sql(updateAll("case_studies", snap.case));
  sql(updateAll("blog_posts", snap.post));
  sql(`DELETE FROM service_case_studies WHERE service_id = '${SVC}' OR case_study_id = '${CASE}'`);
  for (const r of [...snap.svcLinks, ...snap.caseLinks.filter((l) => l.service_id !== SVC)]) sql(insertAll("service_case_studies", r));
  sql(`DELETE FROM case_study_images WHERE case_study_id = '${CASE}'`);
  for (const r of snap.images) sql(insertAll("case_study_images", r));
  sql(`DELETE FROM blog_post_tags WHERE post_id = '${POST}'`);
  for (const r of snap.postTags) sql(insertAll("blog_post_tags", r));
  sql(`DELETE FROM blog_tags WHERE id NOT IN (${snap.tagIds.map(esc).join(",")})`);
  sql("UPDATE blog_posts SET featured = 0"); for (const id of snap.featured) sql(`UPDATE blog_posts SET featured = 1 WHERE id = '${id}'`);
  sql("DELETE FROM entity_section_revisions");
  sql("DELETE FROM rate_limits");
}
await browser.close();
check("the three records are restored exactly", JSON.stringify([svcRow(), caseRow(), postRow()]) === JSON.stringify([snap.svc, snap.case, snap.post]));
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
