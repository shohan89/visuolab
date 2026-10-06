// Needs playwright, pngjs and pixelmatch (npm i --no-save playwright pngjs pixelmatch). Run from visuolab-next with the original site in ../referance-website and the production build running (see docs/PERFORMANCE.md).
// Pixel comparison of the original static site against the Next.js app (full-page screenshots, motion off, same freeze rules on both sides).
//   PAGES="index:/:index.html,about:/about:about.html" WIDTHS=1440,768,390 NEWBASE=http://localhost:8788 node scripts/qa/compare.mjs     (NOSRCSET=1 compares with the original picture files instead of the responsive copies)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const REF = path.resolve(process.env.REF || "../referance-website"); // the original static site
const OUT = process.env.OUT || "./qa-shots";
fs.mkdirSync(OUT, { recursive: true });

const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  const f = path.join(REF, u === "/" ? "index.html" : u);
  if (!f.startsWith(REF) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
}).listen(4100);

const pages = (process.env.PAGES || "index:/,about:/about").split(",").map((p) => p.split(":"));
const widths = (process.env.WIDTHS || "1440,900,390").split(",").map(Number);
const motion = process.env.MOTION || "reduce";
const browser = await chromium.launch();
const results = [];

async function shot(url, w, name) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: motion, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  if (process.env.NOSRCSET) await page.evaluate(() => { document.querySelectorAll("img[srcset]").forEach((i) => { i.removeAttribute("srcset"); i.removeAttribute("sizes"); i.loading = "eager"; }); });
  await page.waitForTimeout(1500);
  // walk the page so lazy images and below-the-fold content are loaded before the screenshot
  await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(1200);
  // freeze anything time-driven so both sides are comparable
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} .clock .time,.clock .offset,.clock .status span{visibility:hidden!important} video{visibility:hidden!important} canvas{visibility:hidden!important}" });
  // make sure reveals are resolved
  await page.evaluate(() => document.querySelectorAll(".reveal").forEach((e) => e.classList.add("in")));
  await page.waitForTimeout(300);
  const file = path.join(OUT, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  const errors = [];
  await ctx.close();
  return file;
}

for (const [name, route, refPath] of pages) {
  const refUrl = `http://localhost:4100/${refPath || (name === "index" ? "index.html" : name + ".html")}`;
  const newUrl = `${process.env.NEWBASE || "http://localhost:3001"}${route}`;
  for (const w of widths) {
    const a = await shot(refUrl, w, `${name.replace(/W/g,"_")}-${w}-ref`);
    const b = await shot(newUrl, w, `${name.replace(/W/g,"_")}-${w}-new`);
    const A = PNG.sync.read(fs.readFileSync(a)), B = PNG.sync.read(fs.readFileSync(b));
    const h = Math.min(A.height, B.height);
    const diff = new PNG({ width: A.width, height: h });
    const crop = (img) => { const o = new PNG({ width: img.width, height: h }); PNG.bitblt(img, o, 0, 0, img.width, h, 0, 0); return o; };
    const n = A.width === B.width ? pixelmatch(crop(A).data, crop(B).data, diff.data, A.width, h, { threshold: 0.1 }) : -1;
    fs.writeFileSync(path.join(OUT, `${name.replace(/W/g,"_")}-${w}-diff.png`), PNG.sync.write(diff));
    results.push({ page: name, width: w, refH: A.height, newH: B.height, diffPx: n, diffPct: n < 0 ? "width-mismatch" : ((n / (A.width * h)) * 100).toFixed(3) + "%" });
    console.log(JSON.stringify(results.at(-1)));
  }
}
await browser.close();
server.close();
