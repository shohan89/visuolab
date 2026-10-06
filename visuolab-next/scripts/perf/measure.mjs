// Lab measurements of a running copy of the site: TTFB, FCP, LCP, CLS, INP (slowest interaction), total blocking time, and the JavaScript / CSS /
// image / font / video payload (transferred bytes; JS and CSS also as brotli, which is what Cloudflare sends), at load and after scrolling the page.
//   Needs playwright (npm i --no-save playwright). Use the PRODUCTION build, not npm run dev:
//     npm run build && npm run db:migrate:preview && npm run db:seed:preview
//     npx wrangler dev --config dist/server/wrangler.json --port 8788 --var EDGE_CACHE:1        (another terminal; EDGE_CACHE:1 = page cache on, as in production)
//     BASE=http://127.0.0.1:8788 node scripts/perf/measure.mjs after          (writes perf-after.json next to this file; prints a table)
//   ROUTES=/about,/blog RUNS=3 limits what is measured (on Git Bash set MSYS_NO_PATHCONV=1 so "/about" is not turned into a Windows path).
// Profiles: mobile = 390x844 at 2x, 4x CPU slowdown, 1.6 Mbit/s, 150 ms RTT (a slow-4G phone); desktop = 1440x900, 10 Mbit/s, 40 ms RTT.
// Lab caveat: headless Chrome draws WebGL in software, so total blocking time on the pages with a 3D scene (/ and /about) is far higher than on a real GPU.
import { chromium } from "playwright";
import zlib from "node:zlib";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:8787";
const LABEL = process.argv[2] || "run";
const RUNS = Number(process.env.RUNS || 3);
const ROUTES = (process.env.ROUTES || "/,/about,/works,/works/aster,/services/brand-identity,/blog,/blog/design-systems-that-survive,/contact").split(",");
const PROFILES = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, cpu: 4, net: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 } },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpu: 1, net: { latency: 40, downloadThroughput: (10 * 1024 * 1024) / 8, uploadThroughput: (5 * 1024 * 1024) / 8 } },
};
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const kb = (n) => Math.round(n / 102.4) / 10;

const browser = await chromium.launch();

async function once(route, p) {
  const ctx = await browser.newContext({ viewport: p.viewport, deviceScaleFactor: p.deviceScaleFactor, isMobile: p.isMobile, hasTouch: p.hasTouch, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", { offline: false, ...p.net });
  if (p.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
  const reqs = new Map();
  cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type, status: e.response.status, mime: e.response.mimeType, enc: 0, headers: e.response.headers }));
  cdp.on("Network.loadingFinished", (e) => { const r = reqs.get(e.requestId); if (r) r.enc = e.encodedDataLength; });
  await page.addInitScript(() => {
    window.__m = { lcp: 0, cls: 0, inp: 0, fcp: 0, longTasks: 0, tbt: 0, tbtScroll: 0 };
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__m.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") window.__m.fcp = e.startTime; }).observe({ type: "paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__m.longTasks++; if (e.duration > 50) { if (e.startTime < 5000) window.__m.tbt += e.duration - 50; else window.__m.tbtScroll += e.duration - 50; } } }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__m.inp = Math.max(window.__m.inp, e.duration); }).observe({ type: "event", durationThreshold: 16, buffered: true });
  });
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForTimeout(2500); // let LCP settle and motion start
  const kindOf = (t) => (t === "Script" ? "js" : t === "Stylesheet" ? "css" : t === "Image" ? "img" : t === "Font" ? "font" : t === "Media" ? "media" : t === "Document" ? "doc" : "other");
  const initial = { js: 0, css: 0, img: 0, font: 0, media: 0, doc: 0, other: 0 };
  for (const r of reqs.values()) initial[kindOf(r.type)] += r.enc; // everything fetched by the time the first screen has settled (before any scrolling)
  // a real scroll through the page (lazy images, scroll-driven motion), then a few interactions for INP
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += p.viewport.height * 0.8) { await page.mouse.wheel(0, p.viewport.height * 0.8); await page.waitForTimeout(120); }
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const taps = [".nav-toggle, .burger, button[aria-label*=enu]", "a.pill, button.pill", "summary, .faq button, [aria-expanded]"];
  for (const sel of taps) { const el = page.locator(sel).first(); if (await el.count()) { try { await el.click({ timeout: 1500, trial: false, noWaitAfter: true }); } catch { /* not clickable here */ } await page.waitForTimeout(300); } }
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { ttfb: n.responseStart, dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
  const m = await page.evaluate(() => window.__m);
  // sizes: transferred bytes as reported by the network stack; for text types also the brotli size of the body (what Cloudflare's edge sends)
  const by = { js: 0, css: 0, img: 0, font: 0, media: 0, doc: 0, other: 0 };
  const raw = { js: 0, css: 0 };
  const br = { js: 0, css: 0 };
  let count = 0, thirdParty = 0;
  for (const r of reqs.values()) {
    count++;
    const host = new URL(r.url).host;
    if (host !== new URL(BASE).host) thirdParty += r.enc;
    const k = r.type === "Script" ? "js" : r.type === "Stylesheet" ? "css" : r.type === "Image" ? "img" : r.type === "Font" ? "font" : r.type === "Media" ? "media" : r.type === "Document" ? "doc" : "other";
    by[k] += r.enc;
    if ((k === "js" || k === "css") && r.status === 200) {
      try { const body = Buffer.from(await (await fetch(r.url)).arrayBuffer()); raw[k] += body.length; br[k] += zlib.brotliCompressSync(body).length; } catch { /* external */ }
    }
  }
  const inline = await page.evaluate(() => [...document.querySelectorAll("script:not([src])")].reduce((n, s) => n + s.textContent.length, 0));
  await ctx.close();
  return { initial, ttfb: nav.ttfb, fcp: m.fcp, lcp: m.lcp, cls: m.cls, inp: m.inp, tbt: m.tbt, tbtScroll: m.tbtScroll, longTasks: m.longTasks, requests: count, by, raw, br, thirdParty, inlineJs: inline };
}

const out = {};
for (const [pname, p] of Object.entries(PROFILES)) {
  for (const route of ROUTES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await once(route, p));
    const med = (f) => median(runs.map(f));
    out[`${pname} ${route}`] = {
      ttfb: med((r) => r.ttfb), fcp: med((r) => r.fcp), lcp: med((r) => r.lcp), cls: Math.round(med((r) => r.cls) * 1000) / 1000, inp: med((r) => r.inp), tbt: med((r) => r.tbt), tbtScroll: med((r) => r.tbtScroll),
      requests: med((r) => r.requests), jsBr: med((r) => r.br.js), jsRaw: med((r) => r.raw.js), cssBr: med((r) => r.br.css), cssRaw: med((r) => r.raw.css), img: med((r) => r.by.img), font: med((r) => r.by.font), media: med((r) => r.by.media), doc: med((r) => r.by.doc), thirdParty: med((r) => r.thirdParty), inlineJs: med((r) => r.inlineJs),
      total: med((r) => Object.values(r.by).reduce((a, b) => a + b, 0)),
      init: Object.fromEntries(["js", "css", "img", "font", "media"].map((k) => [k, med((r) => r.initial[k])])),
    };
    const o = out[`${pname} ${route}`];
    console.log(`${pname.padEnd(8)} ${route.padEnd(36)} TTFB ${String(Math.round(o.ttfb)).padStart(4)}  FCP ${String(Math.round(o.fcp)).padStart(5)}  LCP ${String(Math.round(o.lcp)).padStart(5)}  CLS ${o.cls}  INP ${Math.round(o.inp)}  TBT ${Math.round(o.tbt)} (+${Math.round(o.tbtScroll)} scroll) | JS ${kb(o.jsBr)}KB br (${kb(o.jsRaw)} raw)  CSS ${kb(o.cssBr)}KB br  img ${kb(o.img)}KB  font ${kb(o.font)}KB  media ${kb(o.media)}KB  3p ${kb(o.thirdParty)}KB  reqs ${o.requests} | at load: img ${kb(o.init.img)}KB font ${kb(o.init.font)}KB media ${kb(o.init.media)}KB`);
  }
}
fs.writeFileSync(new URL(`./perf-${LABEL}.json`, import.meta.url), JSON.stringify(out, null, 1));
await browser.close();
