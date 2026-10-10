// Checks that the public pages really draw from the page CMS (D1): it changes a section in the LOCAL database, looks at the page, and puts it back.
//   npm i --no-save playwright
//   BASE=http://localhost:3001 node scripts/qa/page-cms-qa.mjs
// Never point it at the live site. Design parity (the pages look exactly as before) is checked by page-parity.mjs; this checks the wiring.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:3001";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Local sites only."); process.exit(1); }
const res = [];
const check = (n, ok, d = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + String(d).slice(0, 220) : ""}`); };
const sql1 = (q) => { const f = join(tmpdir(), `page-cms-qa-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results; }; // a file, not --command: the SQL holds quotes and <em>
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } }; // wrangler occasionally crashes on Windows: retry
const html = async (p) => { for (let a = 0; ; a++) { try { return (await (await fetch(BASE + p)).text()).replace(/<!--[\s\S]*?-->/g, ""); } catch (e) { if (a >= 5) throw e; await new Promise((r) => setTimeout(r, 1500)); } } }; // the dev server restarts its worker when the database file changes underneath it
const read = (id) => JSON.parse(sql(`SELECT content FROM page_sections WHERE id = '${id}'`)[0].content);
const lit = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'`;
/** Runs `fn` with a section's content changed (and enabled/disabled), and always puts the original back. */
async function withSection(id, change, fn, enabled = 1) {
  const before = sql(`SELECT content, is_enabled FROM page_sections WHERE id = '${id}'`)[0];
  const next = change(JSON.parse(before.content));
  sql(`UPDATE page_sections SET content = ${lit(next)}, is_enabled = ${enabled} WHERE id = '${id}'`);
  try { await fn(); } finally { sql(`UPDATE page_sections SET content = '${before.content.replace(/'/g, "''")}', is_enabled = ${before.is_enabled} WHERE id = '${id}'`); }
}
const has = (h, s) => h.includes(s);

sql("DELETE FROM rate_limits");
check("pages and sections are seeded", sql("SELECT COUNT(*) n FROM pages")[0].n === 9 && sql("SELECT COUNT(*) n FROM page_sections")[0].n === 36);

// ---- Home
await withSection("sec_home_hero", (c) => ({ ...c, eyebrow: "CMS EYEBROW", primaryCta: { label: "CMS CALL", href: "/contact" }, secondaryCta: null }), async () => {
  const h = await html("/");
  check("home: hero words come from the CMS (eyebrow, button text and link)", has(h, "CMS EYEBROW") && has(h, 'href="/contact" class="pill"') && has(h, "CMS CALL"));
  check("home: a hero second link set to null is not drawn", !has(h, 'href="#work" class="arrow-link"'));
});
await withSection("sec_home_process", (c) => c, async () => check("home: a section switched off is not drawn (process)", !has(await html("/"), 'id="process"')), 0);
await withSection("sec_home_services", (c) => ({ ...c, title: "First clause, <em>and the rest</em>" }), async () => {
  const h = await html("/");
  check("home: the first words of the services heading stay together (.keep)", has(h, '<span class="keep">First clause,</span>'));
});
await withSection("sec_home_work", (c) => ({ ...c, caseIds: ["case_kite", "case_orbit"] }), async () => {
  const h = await html("/");
  const order = [...h.matchAll(/href="\/works\/([a-z]+)" class="case-panel"/g)].map((m) => m[1]);
  check("home: the chosen case studies are shown in the chosen order", order.join() === "kite,orbit", order.join());
});
await withSection("sec_shared_reviews", (c) => { c.items[0].quote = "CMS REVIEW QUOTE"; return c; }, async () => check("home: the shared reviews come from the CMS", has(await html("/"), "CMS REVIEW QUOTE")));
await withSection("sec_shared_rating", (c) => ({ score: "4.9", text: "99 reviews somewhere" }), async () => { const h = await html("/"); check("home: the shared rating line comes from the CMS", has(h, "4.9") && has(h, "99 reviews somewhere")); });
await withSection("sec_shared_logos", (c) => { c.items[0].text = "CMSLOGO"; return c; }, async () => check("home: the shared logo names come from the CMS", has(await html("/"), "CMSLOGO")));
await withSection("sec_home_showreel", (c) => ({ ...c, tag: "CMS TAG", time: "09:99" }), async () => { const h = await html("/"); check("home: showreel tag and label come from the CMS, the video file from the media library", has(h, "CMS TAG") && has(h, "09:99") && has(h, 'src="/assets/showreel.mp4"')); });
// a section that no longer passes its schema must never break the page: the default is drawn instead
await withSection("sec_home_why", (c) => ({ ...c, stats: c.stats.slice(0, 2) }), async () => { const h = await html("/"); check("home: a damaged section is replaced by its default and the page still renders", has(h, "years in business") && has(h, "industries served")); });

// ---- About
await withSection("sec_about_hero", (c) => ({ ...c, title: "Line one\n<em>line two</em>\nline three" }), async () => {
  const h = await html("/about");
  check("about: a newline in the headline is a line break", /Line one<br\/?>(<!-- -->)?<em>line two<\/em>(<!-- -->)?<br\/?>(<!-- -->)?line three/.test(h) || /Line one<br\/?><em>line two<\/em><br\/?>line three/.test(h));
});
await withSection("sec_about_faq", (c) => { c.items[0].question = "CMS QUESTION?"; c.cta = null; return c; }, async () => { const h = await html("/about"); check("about: FAQ questions come from the CMS; the button can be left out", has(h, "CMS QUESTION?") && !has(h, "Ask us anything")); });
await withSection("sec_about_principles", (c) => c, async () => check("about: a section switched off is not drawn (principles)", !has(await html("/about"), 'id="principles"')), 0);
await withSection("sec_about_places", (c) => { c.items[1].city = "Montreal"; return c; }, async () => check("about: office names come from the CMS", has(await html("/about"), "Montreal")));
await withSection("sec_about_mosaic", (c) => ({ ...c, caseIds: ["case_fold", "case_aster", "case_halcyon"] }), async () => {
  const h = await html("/about");
  const tiles = [...h.matchAll(/class="mosaic-track">([\s\S]*?)<\/div><\/section>/g)][0]?.[1].match(/<figure>/g)?.length ?? 0;
  check("about: the strip shows the chosen case studies, repeated to an even number of tiles (the loop slides by half)", has(h, "Fold — Banking app") && tiles % 2 === 0 && tiles >= 16, `${tiles} tiles`);
});
await withSection("sec_about_careers", (c) => { c.items[0].subject = "A subject & more"; return c; }, async () => check("about: the open roles' mail subject is encoded", has(await html("/about"), "subject=A%20subject%20%26%20more")));
await withSection("sec_about_careers", (c) => c, async () => check("about: Careers can be switched off (the editor confirms first): a row marked off is not drawn", !has(await html("/about"), 'id="careers"')), 0);

// ---- Works
await withSection("sec_works_hero", (c) => ({ ...c, label: "CMS WORKS", title: "CMS <em>headline</em>", allLabel: "Everything", chipLabels: { ...c.chipLabels, web: "Websites" } }), async () => {
  const h = await html("/works");
  check("works: hero words and chip labels come from the CMS; chip keys and counts stay as they are", has(h, "CMS WORKS") && has(h, "CMS <em>headline</em>") && has(h, "Everything") && /data-filter="web"[^>]*>Websites <i>/.test(h));
});
await withSection("sec_works_grid", (c) => ({ ...c, emptyText: "CMS NOTHING HERE" }), async () => check("works: the 'no match' text comes from the CMS", has(await html("/works"), "CMS NOTHING HERE")));
await withSection("sec_works_reviews", (c) => c, async () => check("works: the reviews section can be switched off", !has(await html("/works"), 'id="reviews"')), 0);
await withSection("sec_works_reviews", (c) => ({ ...c, label: "CMS TESTIMONIALS" }), async () => check("works: the reviews label comes from the CMS", has(await html("/works"), "CMS TESTIMONIALS")));

// ---- Blog
await withSection("sec_blog_hero", (c) => ({ ...c, label: "CMS BLOG", lead: "", allLabel: "Every post" }), async () => {
  const h = await html("/blog");
  check("blog: hero words come from the CMS; an empty intro leaves the paragraph out", has(h, "CMS BLOG") && has(h, "Every post") && !has(h, "No thought leadership"));
});
await withSection("sec_blog_featured", (c) => ({ ...c, linkLabel: "CMS READ MORE" }), async () => check("blog: the featured card's link text comes from the CMS", has(await html("/blog"), "CMS READ MORE")));
await withSection("sec_blog_grid", (c) => ({ ...c, emptyText: "CMS NO POSTS" }), async () => check("blog: the 'no match' text comes from the CMS", has(await html("/blog"), "CMS NO POSTS")));

// ---- Service, case study and article pages: the words that are the same on every one
await withSection("sec_service_detail_logos", (c) => ({ ...c, label: "CMS TRUSTED" }), async () => check("service pages: the 'Trusted by' label comes from the CMS", has(await html("/services/brand-identity"), ">CMS TRUSTED<")));
await withSection("sec_service_detail_logos", (c) => c, async () => check("service pages: the 'Trusted by' band can be switched off", !has(await html("/services/brand-identity"), 'class="logos reveal"')), 0);
await withSection("sec_service_detail_reviews", (c) => ({ ...c, title: "CMS <em>reviews</em> heading" }), async () => check("service pages: the reviews heading comes from the CMS", has(await html("/services/product-design"), "CMS <em>reviews</em> heading")));
await withSection("sec_shared_rating", (c) => ({ score: "4.8", text: "12 reviews" }), async () => { const h = await html("/services/motion-3d"); check("service pages: the hero rating badge and the reviews rating line share one source", has(h, "<b>4.8</b> · 12 reviews") && has(h, "<b>4.8</b>") && has(h, "12 reviews")); });
await withSection("sec_case_study_detail_chrome", (c) => ({ breadcrumbRoot: "CMS WORKS", allProjectsLabel: "CMS ALL PROJECTS" }), async () => { const h = await html("/works/orbit"); check("case study pages: the first breadcrumb and the 'All projects' button come from the CMS", has(h, ">CMS WORKS<") && has(h, "CMS ALL PROJECTS")); });
await withSection("sec_article_detail_chrome", (c) => ({ ...c, tocLabel: "CMS TOC", shareLabel: "CMS SHARE", relatedTitle: "CMS <em>related</em>", relatedAllLabel: "CMS ALL ARTICLES" }), async () => { const h = await html("/blog/design-systems-that-survive"); check("article pages: contents, share and 'more' labels come from the CMS", has(h, 'aria-label="CMS TOC"') && has(h, ">CMS TOC<") && has(h, ">CMS SHARE<") && has(h, "CMS <em>related</em>") && has(h, "CMS ALL ARTICLES")); });

// ---- Shared closing band and footer (every page)
await withSection("sec_shared_cta", (c) => ({ ...c, title: "CMS <em>closing</em> line", lead: "", primary: { label: "CMS BUTTON", href: "/contact" } }), async () => {
  const h = await html("/about");
  check("shared: the closing band's heading and button come from the CMS; an empty text leaves the paragraph out", has(h, "CMS <em>closing</em> line") && has(h, 'href="/contact" class="pill">CMS BUTTON') && !has(h, "We'll come back within a day"));
  check("shared: the same band appears on every page but Contact", has(await html("/blog"), "CMS <em>closing</em> line") && !has(await html("/contact"), "CMS <em>closing</em> line"));
});
await withSection("sec_shared_cta", (c) => ({ ...c, avatars: [c.avatars[2], c.avatars[1], c.avatars[0]] }), async () => { const h = await html("/about"); check("shared: the band's photos come from the media library, in the chosen order", h.indexOf("/assets/people/aiko.webp") < h.indexOf("/assets/people/jordan.webp") && /class="avatars[^"]*"[\s\S]*?aiko[\s\S]*?team-2[\s\S]*?jordan/.test(h)); });
await withSection("sec_shared_footer", (c) => ({ ...c, newsletterText: "CMS NEWSLETTER", copyright: "© CMS 2099", legal: [{ label: "CMS PRIVACY", href: "/privacy" }], badges: { ...c.badges, clutch: { line1: "CMS 1", line2: "CMS 2" } } }), async () => {
  const h = await html("/works");
  check("shared: footer newsletter text, badge captions, legal links and copyright come from the CMS", has(h, "CMS NEWSLETTER") && has(h, "© CMS 2099") && has(h, '<a href="/privacy">CMS PRIVACY</a>') && !has(h, "Cookie policy") && /CMS 1<br\/?>CMS 2/.test(h));
});
{
  const r = await fetch(BASE + "/services", { redirect: "manual" });
  check("services listing: /services still redirects to the Services section of the home page", r.status === 308 && r.headers.get("location") === "/#services", `${r.status} ${r.headers.get("location")}`);
}

// ---- Contact
await withSection("sec_contact_intro", (c) => ({ ...c, label: "CMS CONTACT", direct: [{ label: "Mail", text: "{email}", mailSubject: "Hi there" }], facts: [] }), async () => {
  const h = await html("/contact");
  check("contact: intro words come from the CMS; {email} becomes the contact address; a subject is encoded", has(h, "CMS CONTACT") && has(h, "hello@visuolab.studio") && has(h, "?subject=Hi%20there"));
  check("contact: an empty list of facts leaves the list out", !has(h, 'class="contact-facts'));
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
// the filter chips still filter (client behaviour is unchanged)
{
  await page.goto(BASE + "/works");
  await page.waitForLoadState("networkidle");
  const total = await page.locator(".wcard").count();
  await page.locator('.chip[data-filter="packaging"]').click();
  await page.waitForTimeout(400);
  const visible = await page.locator(".wcard:not(.is-hidden)").count();
  const chipCount = Number(await page.locator('.chip[data-filter="packaging"] i').innerText());
  check("works: a filter chip shows only the matching case studies, and the chip's count is that number", visible === chipCount && visible > 0 && visible < total, `${visible} of ${total}, chip says ${chipCount}`);
  await page.goto(BASE + "/blog");
  await page.waitForLoadState("networkidle");
  const gridTotal = await page.locator(".post").count();
  const chipCounts = await page.locator(".chip i").allInnerTexts();
  const pick = chipCounts.findIndex((c, k) => k > 0 && Number(c) > 0 && Number(c) < Number(chipCounts[0]));
  if (pick > 0) { await page.locator(".chip").nth(pick).click(); await page.waitForTimeout(400); }
  const gridShown = await page.locator(".post:not(.is-hidden)").count();
  check("blog: a topic chip filters the article grid (the featured article is outside the grid)", pick > 0 && gridShown > 0 && gridShown <= gridTotal && gridShown <= Number(chipCounts[pick]), `${gridShown} of ${gridTotal}, chip ${chipCounts[pick]}`);
}
const submitOnce = async (pick) => {
  await page.goto(BASE + "/contact");
  await page.waitForLoadState("networkidle");
  await page.fill("#c-name", "CMS Test");
  await page.fill("#c-email", "cms-test@example.com");
  await page.fill("#c-msg", "This is a test message from the page CMS check.");
  if (pick) await pick();
  await page.waitForTimeout(3200); // the form ignores messages sent within a few seconds of appearing
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
};
try {
  await withSection("sec_contact_form", (c) => ({ ...c, budgetOptions: ["Tiny", "Small", "Large"], needOptions: ["Logo", "Website", "Not sure yet"], success: "CMS THANKS", note: "CMS NOTE" }), async () => {
    await page.goto(BASE + "/contact");
    await page.waitForLoadState("networkidle");
    const labels = await page.locator(".opts .opt span").allInnerTexts();
    check("contact: the option lists come from the CMS", labels.join("|") === "Logo|Website|Not sure yet|Tiny|Small|Large", labels.join("|"));
    check("contact: the note under the form comes from the CMS", (await page.locator(".form-note").innerText()) === "CMS NOTE");
    await submitOnce(async () => { await page.locator("label.opt", { hasText: "Logo" }).click(); await page.locator("label.opt", { hasText: "Small" }).click(); });
    check("contact: a message with the new options is accepted and the success text comes from the CMS", (await page.locator(".form-ok").isVisible()) && (await page.locator(".form-ok").innerText()) === "CMS THANKS");
    const stored = sql("SELECT service, budget FROM contact_submissions WHERE email = 'cms-test@example.com'");
    check("contact: the choices are stored as chosen", stored.length === 1 && stored[0].service === "Logo" && stored[0].budget === "Small", JSON.stringify(stored));
    sql("DELETE FROM contact_submissions WHERE email = 'cms-test@example.com'"); sql("DELETE FROM rate_limits");
    // an option that is no longer offered is refused by the server, even if the browser is made to send it
    await page.goto(BASE + "/contact");
    await page.waitForLoadState("networkidle");
    await page.fill("#c-name", "CMS Test"); await page.fill("#c-email", "cms-test@example.com"); await page.fill("#c-msg", "A message with an option that does not exist any more.");
    await page.evaluate(() => { const r = document.querySelector('input[name="budget"]'); r.value = "€20–50k"; r.checked = true; });
    await page.waitForTimeout(3200);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    check("contact: an option the CMS no longer offers is refused (nothing stored, no success)", !(await page.locator(".form-ok").isVisible()) && sql("SELECT COUNT(*) n FROM contact_submissions WHERE email = 'cms-test@example.com'")[0].n === 0);
  });
} finally {
  sql("DELETE FROM contact_submissions WHERE email = 'cms-test@example.com'"); sql("DELETE FROM rate_limits");
}
await browser.close();

// ---- everything is back as it was
check("everything is back on (no section left switched off)", sql("SELECT COUNT(*) n FROM page_sections WHERE is_enabled = 0")[0].n === 0);
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
