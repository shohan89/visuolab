// Checks a running PRODUCTION build: no console error or hydration warning on any page, the stylesheets a page loads first and the rest after idle, and that moving between
// pages in the browser leaves the stylesheets switched exactly as after loading the page directly. Needs playwright (npm i --no-save playwright).
//   BASE=http://127.0.0.1:8788 node scripts/perf/check-perf.mjs
import { chromium } from "playwright";
const BASE = process.env.BASE || "http://localhost:8787";
const b = await chromium.launch();
const routes = ["/", "/about", "/works", "/works/aster", "/services/brand-identity", "/blog", "/blog/design-systems-that-survive", "/contact"];
let bad = 0;
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
for (const r of routes) {
  const p = await ctx.newPage(); const msgs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/webgl|GPU stall|Failed to load resource.*(404|net::)/i.test(m.text())) msgs.push(m.type() + ": " + m.text().slice(0, 200)); });
  p.on("pageerror", (e) => msgs.push("pageerror: " + e.message.slice(0, 200)));
  await p.addInitScript(() => { window.__first = 0; new MutationObserver((ms) => { for (const m of ms) if (!window.__first && m.target.classList?.contains("reveal") && m.target.classList.contains("in")) window.__first = performance.now(); }).observe(document, { attributes: true, subtree: true, attributeFilter: ["class"] }); });
  await p.goto(BASE + r, { waitUntil: "domcontentloaded" });
  const early = await p.evaluate(() => document.querySelectorAll(".reveal.in").length);
  const sheetsAtLoad = await p.evaluate(() => [...document.querySelectorAll("link[data-sheet]")].map((l) => l.dataset.sheet + ":" + l.media).join(" "));
  await p.waitForLoadState("load"); await p.waitForTimeout(3500);
  const sheetsAfter = await p.evaluate(() => [...document.querySelectorAll("link[data-sheet]")].map((l) => l.dataset.sheet + ":" + l.media).join(" "));
  const info = await p.evaluate(() => { const fw = performance.getEntriesByType("resource").filter((e) => /framework|vinext-/.test(e.name)).map((e) => e.responseEnd); return { first: Math.round(window.__first), fwEnd: Math.round(Math.max(0, ...fw)) }; });
  console.log(r.padEnd(34), `reveals.in at DCL: ${early}  first .in at ${info.first}ms (framework JS finished ${info.fwEnd}ms)`, "| sheets at load:", sheetsAtLoad.replace(/ /g, ",").slice(0, 80), "| after:", sheetsAfter.split(" ").length);
  if (msgs.length) { bad++; console.log("   CONSOLE:", msgs.slice(0, 3)); }
  await p.close();
}
// client-side navigation keeps the styles right
const p = await ctx.newPage(); await p.goto(BASE + "/", { waitUntil: "load" }); await p.waitForTimeout(3500);
const media = async () => p.evaluate(() => Object.fromEntries([...document.querySelectorAll("link[data-sheet]")].map((l) => [l.dataset.sheet, l.media])));
const seq = [["/about", 'a[href="/about"]'], ["/works", 'a[href="/works"]'], ["/", 'a[href="/"]']];
for (const [path, sel] of seq) {
  await p.locator(sel).first().click({ force: true }); await p.waitForURL((u) => u.pathname === path, { timeout: 8000 }); await p.waitForTimeout(800);
  const direct = await ctx.newPage(); await direct.goto(BASE + path, { waitUntil: "load" }); await direct.waitForTimeout(3500);
  const a = JSON.stringify(await media()), d = JSON.stringify(await direct.evaluate(() => Object.fromEntries([...document.querySelectorAll("link[data-sheet]")].map((l) => [l.dataset.sheet, l.media]))));
  const order = await p.evaluate(() => [...document.querySelectorAll("link[data-sheet]")].map((l) => l.dataset.sheet).join(","));
  console.log("client nav to", path.padEnd(8), "sheets switched like a direct load:", a === d, "| order:", order);
  if (a !== d) bad++;
  await direct.close();
}
console.log(bad ? "PROBLEMS: " + bad : "no console errors, hydration warnings or style differences");
await b.close();
