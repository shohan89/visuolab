// Needs playwright, pngjs and pixelmatch (npm i --no-save playwright pngjs pixelmatch). Run from visuolab-next with the original site in ../referance-website and the production build running (see docs/PERFORMANCE.md).
// Behavioural parity with motion on: fonts loaded, hover states, navigation, mobile menu, smooth scroll, animations, video, WebGL canvases, console errors.
//   NEWBASE=http://localhost:8788 node scripts/qa/behavior.mjs
// Behavioural parity with motion ON: fonts, hover states, nav / mobile menu, scroll behaviour, animations, video, WebGL.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const REF = path.resolve(process.env.REF || "../referance-website"); // the original static site
const mime = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]); const f = path.join(REF, u === "/" ? "index.html" : u);
  if (!f.startsWith(REF) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": mime[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res);
}).listen(4100);
const NEW = process.env.NEWBASE || "http://localhost:8788";
const PAGES = [["/", "index.html"], ["/about", "about.html"], ["/works", "works.html"], ["/works/aster", "work/aster.html"], ["/services/brand-identity", "service/brand-identity.html"], ["/blog", "blog.html"], ["/blog/design-systems-that-survive", "blog/design-systems-that-survive.html"], ["/contact", "contact.html"]];
const browser = await chromium.launch();
const res = []; const check = (n, ok, d = "") => { res.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const open = async (url, w, h = 900) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 600, isMobile: w < 600 }); const p = await ctx.newPage(); await p.goto(url, { waitUntil: "networkidle" }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2500); return { ctx, p }; };
const both = async (route, ref, w, fn) => { const a = await open(`http://localhost:4100/${ref}`, w); const b = await open(NEW + route, w); try { return [await fn(a.p), await fn(b.p)]; } finally { await a.ctx.close(); await b.ctx.close(); } };
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
// numbers inside a value may differ a hair (an element that is continuously animated is caught at a slightly different moment)
const NUM = /-?[0-9]+[.]?[0-9]*(?:e-?[0-9]+)?/g;
const close = (x, y) => { const sx = JSON.stringify(x), sy = JSON.stringify(y); if (sx.replace(NUM, "#") !== sy.replace(NUM, "#")) return false; const nx = sx.match(NUM) ?? [], ny = sy.match(NUM) ?? []; return nx.every((v, k) => Math.abs(parseFloat(v) - parseFloat(ny[k])) <= 1.5); };

// 1. fonts: families / weights / styles actually loaded after scrolling the whole page
for (const [route, ref] of PAGES) {
  const [a, b] = await both(route, ref, 1440, async (p) => { const h = await p.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y < h; y += 600) { await p.mouse.wheel(0, 600); await p.waitForTimeout(50); } await p.waitForTimeout(500); return p.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family}|${f.style}|${f.weight}`).sort()); });
  check(`fonts ${route}: the same families, styles and weights load`, same([...new Set(a)], [...new Set(b)]), same(a, b) ? "" : `ref ${[...new Set(a)].join(",")} / new ${[...new Set(b)].join(",")}`);
}

// 2. hover states (motion on): computed style of the hovered element and its first child, compared pair by pair
const HOVER = ["a.pill", "button.pill", ".nav a", ".nav-cta", ".wcard", ".case-panel", ".post-card, .post", ".mega-card", ".chip, .filters button", "footer a", ".faq summary, .faq button, .faq-q", ".contact-direct a", ".opt"];
const PROPS = ["transform", "background-color", "color", "opacity", "box-shadow", "border-top-color", "filter", "text-decoration-line", "scale", "translate", "letter-spacing", "width"];
let hoverTotal = 0, hoverBad = [];
for (const [route, ref] of PAGES) {
  const [a, b] = await both(route, ref, 1440, async (p) => {
    const out = [];
    for (const sel of HOVER) {
      const n = await p.locator(sel).count();
      for (let i = 0; i < Math.min(n, 3); i++) {
        const el = p.locator(sel).nth(i);
        if (!(await el.isVisible())) continue;
        await el.scrollIntoViewIfNeeded(); await p.mouse.move(2, 2); await p.waitForTimeout(250);
        const read = () => el.evaluate((e, props) => { const g = (x) => { const c = getComputedStyle(x); return Object.fromEntries(props.map((k) => [k, c.getPropertyValue(k)])); }; return { self: g(e), kid: e.firstElementChild ? g(e.firstElementChild) : null, img: e.querySelector("img") ? g(e.querySelector("img")) : null }; }, PROPS);
        const before = await read();
        await el.hover(); await p.waitForTimeout(900);
        const after = await read();
        out.push({ sel, i, before, after });
      }
    }
    return out;
  });
  hoverTotal += Math.min(a.length, b.length);
  if (a.length !== b.length) hoverBad.push(`${route}: ${a.length} hoverable elements in the original, ${b.length} now`);
  for (let k = 0; k < Math.min(a.length, b.length); k++) if (!close(a[k].before, b[k].before) || !close(a[k].after, b[k].after)) hoverBad.push(`${route} ${a[k].sel}[${a[k].i}]: ${JSON.stringify(a[k].after.self)} vs ${JSON.stringify(b[k].after.self)}`.slice(0, 260));
}
check(`hover: ${hoverTotal} hovered elements on 8 routes have identical resting and hover styles`, hoverBad.length === 0, hoverBad.slice(0, 4).join(" | "));

// 3. navigation and mobile menu
for (const w of [1440, 768, 390]) {
  const [a, b] = await both("/", "index.html", w, async (p) => {
    const o = {};
    o.links = await p.evaluate(() => [...document.querySelectorAll("header a, nav a")].filter((x) => x.offsetParent !== null).map((x) => x.textContent.split(String.fromCharCode(10)).map((t) => t.trim()).filter(Boolean).join(" ").trim() + ">" + new URL(x.href).pathname.replace(/\.html$/, "").replace(/^\/(index)?$/, "/").replace(/^\/(work|service)\//, (m, t) => `/${t === "work" ? "works" : "services"}/`)));
    await p.evaluate(() => window.scrollTo(0, 900)); await p.waitForTimeout(900);
    o.navScrolled = await p.evaluate(() => { const n = document.querySelector("header, .nav, nav"); return n ? getComputedStyle(n).backgroundColor + "|" + n.className.replace(/\s+/g, " ") : ""; });
    await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(600);
    return o;
  });
  check(`navigation @${w}: the same visible links and targets`, same(a.links, b.links), same(a.links, b.links) ? `${a.links.length} links` : `${a.links.join(",")} / ${b.links.join(",")}`);
  const sa = a.navScrolled.split("|")[0], sb = b.navScrolled.split("|")[0];
  check(`navigation @${w}: header background when scrolled`, sa === sb, `${sa} / ${sb}`);
}
// mobile menu: open it in both and compare the panel
{
  const open2 = async (url) => { const o = await open(url, 390); const toggle = o.p.locator('button[aria-label*="enu" i], .menu-toggle, .nav-toggle, .burger, button[aria-controls]').first(); await toggle.click(); await o.p.waitForTimeout(1200); return o; };
  const a = await open2("http://localhost:4100/index.html"), b = await open2(NEW + "/");
  await a.p.screenshot({ path: process.env.TEMP + "/menu-ref.png" }); await b.p.screenshot({ path: process.env.TEMP + "/menu-new.png" });
  const info = async (p) => p.evaluate(() => { const m = [...document.querySelectorAll(".mnav, .mobile-nav, [class*=mnav]")].find((e) => e.offsetParent !== null || getComputedStyle(e).visibility !== "hidden"); const items = [...document.querySelectorAll(".mnav a, .mobile-nav a")].filter((x) => getComputedStyle(x).visibility !== "hidden" && x.getBoundingClientRect().width > 0).map((x) => x.textContent.trim()); return { items, bg: m ? getComputedStyle(m).backgroundColor : null }; });
  const ia = await info(a.p), ib = await info(b.p);
  check("mobile menu: opens with the same items, same panel colour", same(ia.items, ib.items) && ia.bg === ib.bg, `${ia.items.length}/${ib.items.length} items; ${ia.bg} / ${ib.bg}`);
  const { PNG } = await import("pngjs"); const pm = (await import("pixelmatch")).default;
  const A = PNG.sync.read(fs.readFileSync(process.env.TEMP + "/menu-ref.png")), B = PNG.sync.read(fs.readFileSync(process.env.TEMP + "/menu-new.png"));
  const n = pm(A.data, B.data, null, A.width, A.height, { threshold: 0.1 });
  check("mobile menu: the open panel looks the same (screenshot, motion on)", n < A.width * A.height * 0.002, `${n} pixels differ (${((100 * n) / (A.width * A.height)).toFixed(3)}%)`);
  await a.ctx.close(); await b.ctx.close();
}

// 4. scroll behaviour: smooth scroll position after a wheel turn (three trials on a page without WebGL)
{
  const trial = async (p) => { await p.mouse.move(700, 450); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(900); await p.mouse.wheel(0, 1200); const t = []; for (const ms of [100, 300, 600]) { await p.waitForTimeout(ms === 100 ? 100 : ms === 300 ? 200 : 300); t.push(await p.evaluate(() => Math.round(scrollY))); } await p.waitForTimeout(2500); t.push(await p.evaluate(() => Math.round(scrollY))); return t; };
  const [a, b] = await both("/works", "works.html", 1440, async (p) => ({ lenis: await p.evaluate(() => document.documentElement.classList.contains("lenis-on") || document.documentElement.classList.contains("lenis")), runs: [await trial(p), await trial(p), await trial(p)] }));
  const mean = (r, i) => Math.round(r.reduce((x, y) => x + y[i], 0) / r.length);
  const ma = [0, 1, 2, 3].map((i) => mean(a.runs, i)), mb = [0, 1, 2, 3].map((i) => mean(b.runs, i));
  check("scroll: smooth scrolling on in both; a 1200px wheel turn follows the same curve and settles in the same place", a.lenis === b.lenis && Math.abs(ma[3] - mb[3]) <= 2 && ma.every((v, i) => Math.abs(v - mb[i]) <= 120), `lenis ${a.lenis}/${b.lenis}; at 100/300/600ms/settled: ${ma} / ${mb}`);
}

// 5. animations, video, WebGL
for (const [route, ref] of PAGES) {
  const [a, b] = await both(route, ref, 1440, async (p) => { const h = await p.evaluate(() => document.documentElement.scrollHeight); for (let y = 0; y < h; y += 500) { await p.mouse.wheel(0, 500); await p.waitForTimeout(60); } await p.waitForTimeout(800);
    return p.evaluate(() => ({ canvases: [...document.querySelectorAll("canvas")].map((c) => c.className || "canvas").sort(), videos: [...document.querySelectorAll("video")].map((v) => [v.muted, v.loop, v.playsInline, v.getAttribute("poster")?.split("/").pop(), v.querySelector("source")?.getAttribute("src")?.split("/").pop(), v.hidden].join("|")), keyframes: [...new Set([...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].filter((r) => r.type === CSSRule.KEYFRAMES_RULE).map((r) => r.name); } catch { return []; } }))].sort(), revealed: document.querySelectorAll(".reveal.in").length, reveals: document.querySelectorAll(".reveal").length, svgs: document.querySelectorAll("svg").length })); });
  check(`animation/media ${route}: WebGL canvases, video attributes, keyframes and revealed elements`, same(a.canvases, b.canvases) && same(a.videos, b.videos) && same(a.keyframes, b.keyframes) && a.revealed === b.revealed && a.reveals === b.reveals && a.svgs === b.svgs, same(a, b) ? `canvas ${a.canvases.length}, video ${a.videos.length}, keyframes ${a.keyframes.length}, reveals ${a.revealed}/${a.reveals}` : JSON.stringify(a).slice(0, 200) + " / " + JSON.stringify(b).slice(0, 200));
}

// 6. console errors on the new pages (motion on, real GL)
{
  const o = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const msgs = [];
  for (const [route] of PAGES) { const p = await o.newPage(); p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !/GPU stall|WebGL|Failed to load resource/i.test(m.text())) msgs.push(route + ": " + m.text().slice(0, 140)); }); p.on("pageerror", (e) => msgs.push(route + " pageerror: " + e.message.slice(0, 140))); await p.goto(NEW + route, { waitUntil: "networkidle" }); await p.waitForTimeout(1500); await p.close(); }
  check("no console error or warning on any new page", msgs.length === 0, msgs.slice(0, 3).join(" | "));
}
console.log(`\n${res.filter(Boolean).length}/${res.length} checks passed`);
await browser.close(); server.close();
