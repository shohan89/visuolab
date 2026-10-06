// Needs playwright, pngjs and pixelmatch (npm i --no-save playwright pngjs pixelmatch). Run from visuolab-next with the original site in ../referance-website and the production build running (see docs/PERFORMANCE.md).
// Computed-style parity: walks both DOMs in parallel and lists every element whose typography, spacing, colour, border, radius or (with ANIM=1) transition/animation properties differ.
//   PAGESFILE=pages.txt WIDTHS=1440,768,390 NEWBASE=http://localhost:8788 OUTJSON=parity.json node scripts/qa/parity.mjs
// Computed-style parity: walks both DOMs in parallel and reports every element whose computed typography / spacing / colour / border / radius differs.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const REF = path.resolve(process.env.REF || "../referance-website"); // the original static site
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]); const f = path.join(REF, u === "/" ? "index.html" : u);
  if (!f.startsWith(REF) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(4100);

const NEW = process.env.NEWBASE || "http://localhost:8788";
const PAGES = (process.env.PAGES || fs.readFileSync(process.env.PAGESFILE, "utf8").trim()).split(",").map((p) => p.split(":"));
const WIDTHS = (process.env.WIDTHS || "1440,768,390").split(",").map(Number);
const ANIM = ["transition-property", "transition-duration", "transition-delay", "transition-timing-function", "animation-name", "animation-duration", "animation-delay", "animation-timing-function", "animation-iteration-count", "animation-fill-mode", "will-change", "scroll-behavior", "mix-blend-mode", "pointer-events"];
const PROPS = process.env.ANIM ? ANIM : ["font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-transform", "text-align", "text-decoration-line", "color", "background-color", "background-image", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-color", "border-top-style", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius", "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right", "margin-bottom", "margin-left", "width", "height", "display", "position", "gap", "box-shadow", "opacity", "transform", "object-fit", "filter", "backdrop-filter", "overflow-x", "overflow-y", "flex-direction", "justify-content", "align-items", "z-index", "cursor"];
const browser = await chromium.launch();

async function snapshot(url, w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: process.env.ANIM ? "no-preference" : "reduce", deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); });
  if (!process.env.ANIM) await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
  if (!process.env.ANIM) await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in")));
  await page.waitForTimeout(400);
  const data = await page.evaluate((props) => {
    const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "LINK", "META", "TITLE", "TEMPLATE", "NEXT-ROUTE-ANNOUNCER"]);
    const els = [...document.body.querySelectorAll("*")].filter((e) => !skip.has(e.tagName) && !e.closest("noscript,template,next-route-announcer") && !(e.tagName === "SPAN" && e.className === "" && e.parentElement?.tagName === "BODY"));
    const norm = (v) => v.replace(/https?:\/\/[^/)"']+/g, "").replace(/\/assets\/([a-z-]+\/)?([a-z0-9-]+?)(-\d+w)?\.(webp|png|jpg)/g, "/assets/$1$2.$4");
    return els.map((e) => {
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      const o = {}; for (const p of props) o[p] = norm(cs.getPropertyValue(p));
      const own = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(" ").slice(0, 40);
      return { id: e.tagName.toLowerCase() + (typeof e.className === "string" && e.className ? "." + e.className.trim().split(/\s+/).slice(0, 3).join(".") : ""), text: own, x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), s: o, hidden: r.width === 0 && r.height === 0 };
    });
  }, PROPS);
  await ctx.close();
  return data;
}

const out = {};
for (const [name, route, refPath] of PAGES) {
  for (const w of WIDTHS) {
    const a = await snapshot(`http://localhost:4100/${refPath}`, w);
    const b = await snapshot(`${NEW}${route}`, w);
    const rec = { refN: a.length, newN: b.length, mism: {}, geo: 0, firstGeo: null };
    // align by identical tag.class sequence: walk with two pointers, resyncing on id mismatch
    let i = 0, j = 0, aligned = 0, skipped = 0;
    while (i < a.length && j < b.length) {
      if (a[i].id !== b[j].id) { // resync: look ahead a little in either list
        let found = false;
        for (let k = 1; k <= 6 && !found; k++) { if (a[i + k] && a[i + k].id === b[j].id) { i += k; found = true; } else if (b[j + k] && b[j + k].id === a[i].id) { j += k; found = true; } }
        if (!found) { skipped++; i++; j++; continue; }
        skipped++;
      }
      aligned++;
      for (const p of PROPS) {
        if (p === "width" || p === "height") continue; // geometry compared separately
        if (a[i].s[p] !== b[j].s[p]) { const k = p; (rec.mism[k] ??= []).push({ el: a[i].id, text: a[i].text, ref: a[i].s[p].slice(0, 80), now: b[j].s[p].slice(0, 80), y: a[i].y }); }
      }
      if (!process.env.ANIM && Math.abs(a[i].x - b[j].x) > 1 || Math.abs(a[i].y - b[j].y) > 1 || Math.abs(a[i].w - b[j].w) > 1 || Math.abs(a[i].h - b[j].h) > 1) { rec.geo++; rec.firstGeo ??= { el: a[i].id, text: a[i].text, ref: [a[i].x, a[i].y, a[i].w, a[i].h], now: [b[j].x, b[j].y, b[j].w, b[j].h] }; }
      i++; j++;
    }
    rec.aligned = aligned; rec.skipped = skipped;
    out[`${name}@${w}`] = rec;
    const props = Object.entries(rec.mism).map(([k, v]) => `${k}:${v.length}`).join(" ");
    console.log(`${(name + "@" + w).padEnd(24)} ref ${a.length} new ${b.length} aligned ${aligned} skipped ${skipped} geometry-diffs ${rec.geo} | ${props || "no style differences"}`);
  }
}
fs.writeFileSync(process.env.OUTJSON || "parity.json", JSON.stringify(out, null, 1));
await browser.close(); server.close();
