// End-to-end test of the Navigation CMS against a running site (dev server or preview) and its LOCAL database.
//   npm i --no-save playwright
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... BASE=http://localhost:3001 node scripts/qa/navigation-qa.mjs
// It signs in, edits the header and footer menus in the admin, checks the public header (desktop and mobile) and footer after each save,
// checks the server-side validation and authorization, then puts the menus back as they were. Never point it at the live site.
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = process.env.BASE || "http://localhost:3001";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Local sites only."); process.exit(1); }
const EMAIL = process.env.ADMIN_EMAIL, PASSWORD = process.env.ADMIN_PASSWORD;
const res = [];
const check = (n, ok, d = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + String(d).slice(0, 200) : ""}`); };
const sql1 = (q) => JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --command "${q.replace(/"/g, '\\"')}"`, { stdio: ["ignore", "pipe", "ignore"] }).toString())[0].results;
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } }; // wrangler occasionally crashes on Windows: retry

sql("DELETE FROM rate_limits"); sql("DELETE FROM sessions");
const snapshot = sql("SELECT * FROM navigation_items ORDER BY menu, position");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// ---- sign in
await page.goto(BASE + "/admin/login");
await page.waitForLoadState("networkidle");
await page.fill('input[name="email"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await Promise.all([page.waitForURL((u) => !/\/login/.test(u.pathname)), page.click('button[type="submit"]')]);
await page.goto(BASE + "/admin/navigation"); await page.waitForLoadState("networkidle");
check("sidebar: Navigation is a link and the Soon badge is gone", (await page.locator('.side a[href="/admin/navigation"]').count()) === 1 && (await page.locator(".side .is-soon").count()) === 0 && !(await page.locator(".side").innerText()).includes("Soon"));
check("page has the HEADER and FOOTER sections", (await page.locator(".nav-title").allInnerTexts()).join("|").toLowerCase() === "header navigation|footer navigation");

const go = async (path) => { await page.goto(BASE + path); await page.waitForLoadState("networkidle"); }; // typing before the page has hydrated would be lost
const header = () => page.locator("form.nav-editor").nth(0);
const footer = () => page.locator("form.nav-editor").nth(1);
const save = async (form) => { await Promise.all([page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/admin/navigation")), form.locator('button[type="submit"]').click()]); await page.waitForLoadState("networkidle"); await page.waitForTimeout(400); };
const publicHtml = async (path = "/") => (await fetch(BASE + path)).text();
const section = (f, title) => f.locator("section.form-card", { has: page.locator("h3", { hasText: title }) });

// ---- add an internal and an external primary link
let primary = section(header(), "Primary links");
await primary.getByRole("button", { name: "+ Add link" }).click();
await primary.locator(".nav-row").nth(3).locator('input[id$="-label"]').fill("Pricing");
await primary.locator(".nav-row").nth(3).locator('input[id$="-href"]').fill("/about");
await primary.getByRole("button", { name: "+ Add link" }).click();
const ext = primary.locator(".nav-row").nth(4);
await ext.locator('input[id$="-label"]').fill("Partner");
await ext.locator("select").first().selectOption("external");
check("choosing External turns on 'Open in new tab'", await ext.getByLabel("Open in new tab").isChecked());
await ext.locator('input[id$="-href"]').fill("https://example.com/partner");
check("Cancel is enabled after a change", await header().getByRole("button", { name: "Cancel changes" }).isEnabled());
await save(header());
let html = await publicHtml();
check("adding items: internal link shows in the public header", /<a href="\/about">Pricing<\/a>/.test(html));
check("adding items: external link opens in a new tab safely", /<a href="https:\/\/example.com\/partner" target="_blank" rel="noopener noreferrer">Partner<\/a>/.test(html));
check("internal link has no target attribute", !/<a href="\/about" target/.test(html));

// ---- edit
primary = section(header(), "Primary links");
await primary.locator(".nav-row").nth(3).locator('input[id$="-label"]').fill("Pricing & plans");
await save(header());
html = await publicHtml();
check("editing a label shows on the website", html.includes(">Pricing &amp; plans</a>") && !html.includes(">Pricing</a>"));

// ---- reorder with the arrows, and by dragging
primary = section(header(), "Primary links");
await primary.locator(".nav-row").nth(4).getByRole("button", { name: /Move Partner up/ }).click();
await primary.locator(".nav-row").nth(3).getByRole("button", { name: /Move Partner up/ }).click();
await save(header());
html = await publicHtml();
primary = section(header(), "Primary links");
const labelsNow = await primary.locator(".nav-row").evaluateAll((rs) => rs.map((r) => r.querySelector('input[id$="-label"]').value));
check("reorder with arrows: editor order after save", labelsNow.join(",") === "Works,Blog,Partner,About,Pricing & plans", labelsNow.join(","));
check("reorder with arrows: the website shows the same order", html.indexOf(">Blog</a>") < html.indexOf(">Partner</a>") && html.indexOf(">Partner</a>") < html.indexOf(">About</a>") && html.indexOf(">About</a>") < html.indexOf(">Pricing &amp; plans</a>"));
// drag the last row's handle onto the first row
const rows = primary.locator(".nav-row");
await rows.last().locator(".nav-handle").dragTo(rows.first(), { targetPosition: { x: 40, y: 8 } });
const afterDrag = await primary.locator(".nav-row").evaluateAll((rs) => rs.map((r) => r.querySelector('input[id$="-label"]').value));
check("drag and drop moves a row", afterDrag[0] === "Pricing & plans", afterDrag.join(","));
await save(header());
html = await publicHtml();
check("drag and drop order is saved", html.indexOf(">Pricing &amp; plans</a>") < html.indexOf(">Works</a>"));

// ---- disable
primary = section(header(), "Primary links");
await primary.locator(".nav-row", { has: page.locator('input[value="Partner"]') }).getByLabel("Visible").uncheck();
await save(header());
html = await publicHtml();
check("disabling an item hides it on the website", !html.includes(">Partner</a>") && html.includes(">Pricing &amp; plans</a>"));
primary = section(header(), "Primary links");
check("a disabled item stays in the admin, unchecked", await primary.locator(".nav-row.is-hidden").count() === 1);

// ---- cancel / revert
await primary.locator(".nav-row").first().locator('input[id$="-label"]').fill("SHOULD NOT SAVE");
await primary.getByRole("button", { name: "+ Add link" }).click();
await header().getByRole("button", { name: "Cancel changes" }).click();
check("Cancel changes puts back the stored menu", !(await primary.locator('input[value="SHOULD NOT SAVE"]').count()) && (await primary.locator(".nav-row").count()) === 5);

// ---- delete
await primary.locator(".nav-row", { has: page.locator('input[value="Partner"]') }).getByRole("button", { name: /Delete Partner/ }).click();
await primary.locator(".nav-row", { has: page.locator('input[value="Pricing & plans"]') }).getByRole("button", { name: /Delete/ }).click();
check("delete is not applied before Save", (await publicHtml()).includes(">Pricing &amp; plans</a>"));
await save(header());
html = await publicHtml();
check("deleting items removes them from the website", !html.includes("Partner") && !html.includes("Pricing"));
check("deleted rows are gone from the database", sql("SELECT COUNT(*) n FROM navigation_items WHERE label IN ('Partner','Pricing & plans')")[0].n === 0);

// ---- validation (server side: the form does not block these)
primary = section(header(), "Primary links");
const bad = async (label, type, href, expect) => {
  await primary.getByRole("button", { name: "+ Add link" }).click();
  const row = primary.locator(".nav-row").last();
  await row.locator('input[id$="-label"]').fill(label);
  await row.locator("select").first().selectOption(type);
  await row.locator('input[id$="-href"]').fill(href);
  await header().locator('button[type="submit"]').click();
  await header().locator(".form-errors").waitFor();
  const msg = await header().locator(".form-errors").innerText();
  check(`validation: ${expect.name}`, expect.re.test(msg), msg.replace(/\s+/g, " "));
  await header().getByRole("button", { name: "Cancel changes" }).click();
  primary = section(header(), "Primary links");
};
await bad("Evil", "external", "javascript:alert(1)", { name: "javascript: address refused", re: /External URL must be a full https/ });
await bad("Evil", "internal", "//evil.com", { name: "protocol-relative address refused", re: /Internal URL must start with/ });
await bad("Evil", "internal", "about", { name: "internal URL without a leading slash refused", re: /Internal URL must start with/ });
await bad("", "internal", "/about", { name: "empty label refused", re: /Label is required/ });
await bad("<b>x</b>", "internal", "/about", { name: "angle brackets in a label refused", re: /cannot contain/ });
await bad("Ok", "external", "https://", { name: "address without a host refused", re: /External URL must be a full https/ });
check("nothing was saved by the invalid submissions", sql("SELECT COUNT(*) n FROM navigation_items WHERE menu = 'primary'")[0].n === 3);

// ---- Contact button + Services dropdown (desktop)
await go("/admin/navigation");
const cta = section(header(), "Contact button").locator(".nav-row").first();
await cta.locator('input[id$="-label"]').fill("Talk to us");
const col = section(header(), "Services dropdown: columns").locator(".nav-row.is-group").first();
await col.getByRole("button", { name: /Add link to/ }).click();
const kid = col.locator(".nav-children .nav-row").last();
await kid.locator('input[id$="-label"]').fill("Brand audit");
await kid.locator('input[id$="-href"]').fill("/services/brand-identity");
await save(header());
html = await publicHtml();
check("contact button label is read from the database", html.includes("Talk to us"));
check("a new link in a dropdown column shows in the header", html.includes(">Brand audit</a>"));

// ---- mobile navigation
const m = await browser.newContext({ viewport: { width: 390, height: 800 } });
const mp = await m.newPage();
await mp.goto(BASE + "/");
await mp.waitForLoadState("networkidle");
await mp.click(".nav-burger");
await mp.locator("#mnav.is-open").waitFor();
const mnav = await mp.locator("#mnav").innerText();
check("mobile menu shows the contact button text from the database", /Talk to us/.test(mnav));
await mp.locator(".mnav-toggle").click();
check("mobile menu shows the new dropdown link", (await mp.locator("#mnav-svc").innerText()).includes("Brand audit"));
check("mobile menu links: Works, Blog, About present", /Works/.test(mnav) && /Blog/.test(mnav) && /About/.test(mnav));
await mp.click('#mnav a:has-text("About")');
await mp.waitForURL(/\/about/);
check("mobile menu link navigates and the menu closes", (await mp.locator("#mnav.is-open").count()) === 0);
await m.close();

// ---- desktop navigation: the dropdown opens and links work
await page.goto(BASE + "/");
await page.hover(".nav-item");
check("desktop: Services dropdown is visible on hover with the new link", await page.locator('.mega a:has-text("Brand audit")').isVisible());
await page.click('.nav-links a:has-text("Blog")');
await page.waitForURL(/\/blog/);
check("desktop: a primary link navigates", /\/blog/.test(page.url()));

// ---- footer
await go("/admin/navigation");
const fcol = footer().locator(".nav-row.is-group", { has: page.locator('input[value="Company"]') });
await fcol.getByRole("button", { name: /Add link to/ }).click();
const fk = fcol.locator(".nav-children .nav-row").last();
await fk.locator('input[id$="-label"]').fill("Press");
await fk.locator("select").first().selectOption("external");
await fk.locator('input[id$="-href"]').fill("https://example.com/press");
const fkids = fcol.locator(".nav-children .nav-row");
await fkids.nth(0).getByLabel("Visible").uncheck(); // hide "Works"
await fkids.nth(1).getByRole("button", { name: /Move .* down/ }).click(); // Process below Reviews
await save(footer());
let f = (await publicHtml("/about")).slice((await publicHtml("/about")).indexOf("<footer"));
check("footer: new external link, new tab", /<a href="https:\/\/example.com\/press" target="_blank" rel="noopener noreferrer">Press<\/a>/.test(f));
check("footer: hidden item is not rendered", !f.includes(">Works</a>"));
check("footer: reorder is reflected", f.indexOf(">Reviews</a>") < f.indexOf(">Process</a>"));
check("footer: own-page anchor rule still applies on /about (careers is a bare anchor)", f.includes('href="#careers"'));
f = (await publicHtml("/")).slice((await publicHtml("/")).indexOf("<footer"));
check("footer: on the home page process/reviews are bare anchors", f.includes('href="#process"') && f.includes('href="#reviews"') && f.includes('href="/about#careers"'));
// hide a whole column
await go("/admin/navigation");
await footer().locator(".nav-row.is-group", { has: page.locator('input[value="Industries"]') }).getByLabel("Visible").first().uncheck();
await save(footer());
f = await publicHtml("/about");
check("footer: hiding a column hides its heading and links", !f.includes("<h4>Industries</h4>") && !f.includes(">Fintech<"));

// ---- authorization: replay the save without a session
const posted = [];
page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) posted.push(r); });
await go("/admin/navigation");
await header().locator(".nav-row").first().locator('input[id$="-label"]').fill("Works");
await header().locator('input[id$="-label"]').first().fill("Works2");
await save(header());
const req = posted.at(-1);
const raw = Buffer.from(req.postDataBuffer().toString("utf8").replace("Works2", "HACKED"));
const hdrs = (origin) => ({ "content-type": req.headers()["content-type"], "next-action": req.headers()["next-action"], origin, host: new URL(BASE).host });
await fetch(BASE + "/admin/navigation", { method: "POST", redirect: "manual", headers: hdrs(BASE), body: raw });
const after = sql("SELECT COUNT(*) n, MAX(updated_at) u FROM navigation_items WHERE label = 'HACKED'")[0];
check("authorization: a save replayed without a session changes nothing", after.n === 0, JSON.stringify(after));
const r2 = await fetch(BASE + "/admin/navigation", { redirect: "manual" });
check("authorization: the page redirects to sign-in without a session", r2.status >= 300 && r2.status < 400 && /login/.test(r2.headers.get("location") ?? ""), `${r2.status} ${r2.headers.get("location")}`);
const cookie = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
const hacked = () => sql("SELECT COUNT(*) n FROM navigation_items WHERE label = 'HACKED'")[0].n;
await fetch(BASE + "/admin/navigation", { method: "POST", redirect: "manual", headers: { ...hdrs("https://evil.example"), cookie }, body: raw });
check("authorization: a cross-origin replay WITH a valid session changes nothing", hacked() === 0);
await fetch(BASE + "/admin/navigation", { method: "POST", redirect: "manual", headers: { ...hdrs(BASE), cookie }, body: raw });
check("positive control: the same request with the session and the right origin is saved (so the refusals above are real)", hacked() === 1);
check("no JavaScript errors in the browser", errors.length === 0, errors.join(" | "));

// ---- put everything back
sql("DELETE FROM navigation_items");
for (const r of [...snapshot.filter((x) => !x.parent_id), ...snapshot.filter((x) => x.parent_id)]) { // parents first (foreign key)
  const cols = Object.keys(r), vals = cols.map((c) => (r[c] === null ? "NULL" : typeof r[c] === "number" ? r[c] : `'${String(r[c]).replace(/'/g, "''")}'`));
  sql(`INSERT INTO navigation_items (${cols.join(",")}) VALUES (${vals.join(",")})`);
}
check("menus restored", sql("SELECT COUNT(*) n FROM navigation_items")[0].n === snapshot.length);
await browser.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
process.exit(res.every(Boolean) ? 0 : 1);
