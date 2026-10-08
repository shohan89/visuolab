// Design parity of the Next.js site against ITSELF before and after a change (used while the pages move from hard-coded content to the page CMS).
//   npm i --no-save playwright pngjs pixelmatch
//   node scripts/qa/page-parity.mjs save <dir>      records every page: server-rendered markup, links, media, scroll behaviour, full-page screenshots at 1440 / 768 / 390
//   node scripts/qa/page-parity.mjs diff <dir>      records again and compares with what `save` recorded; exits 1 on any difference
// ROUTES=/,/about narrows the pages, WIDTHS=1440,768,390 the widths, BASE=http://localhost:3001 the site (local sites only).
//
// What is compared, and why it is enough:
//  - the server-rendered <head> (title, meta, canonical) and <body> markup, with scripts and React's text separators removed: the same markup with the
//    same CSS and scripts is the same design;
//  - every link (address, target, rel, text) and every picture and video (address, srcset, alt, size, whether it loaded) after the page has run;
//  - scroll behaviour: which reveal elements are shown and the values the scroll scripts write (--p, --reach), at three scroll positions, with motion on;
//  - full-page screenshots at three widths with motion frozen (the same freeze rules as compare.mjs): zero differing pixels.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const [mode, dirArg] = process.argv.slice(2);
if (!["save", "diff"].includes(mode) || !dirArg) { console.error("usage: page-parity.mjs save|diff <dir>"); process.exit(2); }
const BASE = process.env.BASE || "http://localhost:3001";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error("Local sites only."); process.exit(2); }
const DIR = path.resolve(dirArg);
const WIDTHS = (process.env.WIDTHS || "1440,768,390").split(",").map(Number);
const ALL = ["/", "/about", "/works", "/contact", "/blog",
  "/services/brand-identity", "/services/product-design", "/services/web-design-build", "/services/motion-3d",
  "/works/orbit", "/works/marlow", "/works/kite", "/works/verdant", "/works/halcyon", "/works/northwind", "/works/aster", "/works/fold",
  "/blog/design-systems-that-survive", "/blog/designing-for-trust-in-fintech", "/blog/motion-that-earns-its-place", "/blog/the-brief-that-writes-itself", "/blog/webflow-or-next-js", "/blog/what-a-rebrand-actually-costs"];
const ROUTES = (process.env.ROUTES ? process.env.ROUTES.split(",") : ALL);
const name = (r) => (r === "/" ? "home" : r.slice(1).replace(/\//g, "_"));
const OUT = mode === "save" ? DIR : path.join(DIR, "_current");
fs.mkdirSync(OUT, { recursive: true });

/** Server-rendered markup without what changes on every build or render: scripts, React's text separators, build hashes. */
function normalise(html) {
  const head = /<head[^>]*>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? "";
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
  const clean = (s) => s.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").replace(/(href|src)="([^"]*?)(\?v=[a-z0-9]+|-[A-Za-z0-9_-]{8}\.(css|js))"/g, '$1="$2"');
  const meta = [...head.matchAll(/<(title|meta|link)\b[^>]*>(?:[^<]*<\/title>)?/g)].map((m) => m[0]).filter((s) => !/rel="(preload|stylesheet|modulepreload)"|\/fonts\/|\.css|\.js/.test(s)).sort().join("\n");
  return { head: clean(meta), body: clean(body).replace(/></g, ">\n<") };
}

const browser = await chromium.launch();
const summary = [];

async function shot(route, w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} .clock .time,.clock .offset,.clock .status span,.clock .status i{visibility:hidden!important} video{visibility:hidden!important} canvas{visibility:hidden!important}" });
  await page.evaluate(() => document.querySelectorAll(".reveal,.reveal-load").forEach((e) => e.classList.add("in")));
  await page.waitForTimeout(300);
  const file = path.join(OUT, `${name(route)}-${w}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  return file;
}

async function behaviour(route) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(m.text().slice(0, 160)); });
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const facts = await page.evaluate(() => {
    const abs = (u) => (u ? new URL(u, location.href).pathname + new URL(u, location.href).search : "");
    return {
      links: [...document.querySelectorAll("a")].map((a) => [a.getAttribute("href"), a.target, a.rel, a.textContent.replace(/\s+/g, " ").trim()]),
      images: [...document.querySelectorAll("img")].map((i) => [i.getAttribute("src"), i.getAttribute("srcset"), i.getAttribute("alt"), i.getAttribute("width"), i.getAttribute("height"), i.getAttribute("loading")]),
      videos: [...document.querySelectorAll("video")].map((v) => [v.getAttribute("poster"), [...v.querySelectorAll("source")].map((s) => s.getAttribute("src")), v.muted, v.loop, v.getAttribute("preload")]),
      counts: { reveal: document.querySelectorAll(".reveal").length, revealLoad: document.querySelectorAll(".reveal-load").length, sections: document.querySelectorAll("section").length, ids: [...document.querySelectorAll("[id]")].map((e) => e.id).sort().join(",") },
      abs: abs(location.href),
    };
  });
  // scroll behaviour with motion on: three positions
  const scroll = [];
  const height = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const f of [0, 0.4, 0.8]) {
    await page.mouse.wheel(0, 0);
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(height * f));
    await page.waitForTimeout(1600);
    scroll.push(await page.evaluate(() => ({
      shown: [...document.querySelectorAll(".reveal,.reveal-load")].map((e) => (e.classList.contains("in") ? 1 : 0)).join(""),
      vars: [...document.querySelectorAll(".banner,.reel,.case-panel,.stairs,.timeline")].map((e) => ["--p", "--reach", "--o"].map((v) => (e.style.getPropertyValue(v) || getComputedStyle(e).getPropertyValue(v)).trim()).join("/")).join("|"),
      nav: document.getElementById("nav")?.className ?? "",
    })));
  }
  // every picture must have loaded (a broken one has no width)
  const broken = await page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute("src")));
  await ctx.close();
  return { ...facts, scroll, broken, errors: [...new Set(errors)].filter((e) => !/Download the React DevTools|favicon|\[vite\]|HMR|GL Driver Message|WebGL/i.test(e)) };
}

let failed = 0;
for (const route of ROUTES) {
  const res = await fetch(BASE + route);
  const html = await res.text();
  const rec = { status: res.status, ...normalise(html), behaviour: await behaviour(route) };
  const widths = [];
  for (const w of WIDTHS) widths.push([w, await shot(route, w)]);
  const n = name(route);
  const file = path.join(OUT, `${n}.json`);
  fs.writeFileSync(file, JSON.stringify(rec, null, 1));
  fs.writeFileSync(path.join(OUT, `${n}.body.txt`), rec.body);
  if (mode === "save") { console.log(`saved ${route} (${res.status}, ${rec.behaviour.links.length} links, ${rec.behaviour.images.length} images)`); continue; }

  // ---- compare with what was saved
  const base = JSON.parse(fs.readFileSync(path.join(DIR, `${n}.json`), "utf8"));
  const problems = [];
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const unstream = (s) => s.replace(/<template id="P:\d+">\s*<\/template>\s*<\/div>\s*<div hidden id="S:\d+">\s*/g, ""); // React's streaming placeholders: they appear or not depending on timing
  const firstDiff = (a, b) => { const x = a.split("\n"), y = b.split("\n"); for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `line ${i + 1}: before ${JSON.stringify((x[i] ?? "∅").slice(0, 140))} / after ${JSON.stringify((y[i] ?? "∅").slice(0, 140))}`; return ""; };
  if (base.status !== rec.status) problems.push(`status ${base.status} -> ${rec.status}`);
  if (base.head !== rec.head) problems.push(`head: ${firstDiff(base.head, rec.head)}`);
  if (unstream(base.body) !== unstream(rec.body)) problems.push(`markup: ${firstDiff(unstream(base.body), unstream(rec.body))}`);
  for (const k of ["links", "images", "videos", "counts"]) if (!eq(base.behaviour[k], rec.behaviour[k])) problems.push(`${k} differ`);
  // the hero banner's reach value follows the smooth-scroll animation and differs between runs of the same code: only the other scroll-driven values are compared
  const steady = (sc) => sc.map((s) => ({ ...s, vars: route === "/" ? s.vars.split("|").slice(1).join("|") : s.vars }));
  if (!eq(steady(base.behaviour.scroll), steady(rec.behaviour.scroll))) problems.push("scroll behaviour differs: " + base.behaviour.scroll.map((s, i) => [["shown", s.shown, rec.behaviour.scroll[i].shown], ["vars", s.vars, rec.behaviour.scroll[i].vars], ["nav", s.nav, rec.behaviour.scroll[i].nav]].filter(([, a, b]) => a !== b).map(([k, a, b]) => `@${i} ${k}: ${a.slice(0, 90)} -> ${b.slice(0, 90)}`).join("; ")).filter(Boolean).join(" | "));
  if (rec.behaviour.broken.length) problems.push(`broken pictures: ${rec.behaviour.broken.join(", ")}`);
  const newErrors = rec.behaviour.errors.filter((e) => !base.behaviour.errors.includes(e));
  if (newErrors.length) problems.push(`new console errors: ${newErrors.join(" | ").slice(0, 200)}`);
  for (const [w, cur] of widths) {
    const A = PNG.sync.read(fs.readFileSync(path.join(DIR, `${n}-${w}.png`))), B = PNG.sync.read(fs.readFileSync(cur));
    if (A.width !== B.width || A.height !== B.height) { problems.push(`${w}px: size ${A.width}x${A.height} -> ${B.width}x${B.height}`); continue; }
    const diff = new PNG({ width: A.width, height: A.height });
    const px = pixelmatch(A.data, B.data, diff.data, A.width, A.height, { threshold: 0.1 });
    if (px > 0) { fs.writeFileSync(path.join(OUT, `${n}-${w}-diff.png`), PNG.sync.write(diff)); problems.push(`${w}px: ${px} pixels differ`); }
  }
  console.log(`${problems.length ? "FAIL" : "PASS"}  ${route}${problems.length ? "  — " + problems.join("; ") : ""}`);
  summary.push(problems.length);
  if (problems.length) failed++;
}
await browser.close();
if (mode === "diff") { console.log(`\n${ROUTES.length - failed}/${ROUTES.length} pages identical`); process.exit(failed ? 1 : 0); }
