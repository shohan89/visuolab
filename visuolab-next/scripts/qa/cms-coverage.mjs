// Coverage audit: is every piece of visible text on every public page editable somewhere in the admin?
//   BASE=http://localhost:3001 node scripts/qa/cms-coverage.mjs [--json]
// It fetches the public pages (no session), takes every visible text node, and looks for it in the content the admin edits: the page sections, the
// shared copy, the site settings, the navigation, the services, the case studies and the articles of the LOCAL database. Text that is in none of them is
// listed: it is either interface text that is part of the design (a button's "Send", a date, "min read") or copy that is NOT editable. The list is
// printed so a person can judge; the allow-list below is only for text that is plainly not content (punctuation, numbers, dates).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE || "http://localhost:3001";
const sql1 = (q) => { const f = join(tmpdir(), `coverage-${process.pid}.sql`); writeFileSync(f, q); return JSON.parse(execSync(`npx wrangler d1 execute visuolab --local --json --file "${f}"`, { stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }).toString())[0].results; };
const sql = (q) => { for (let a = 0; ; a++) { try { return sql1(q); } catch (e) { if (a >= 3) throw e; } } };

const norm = (s) => s.replace(/<\/?(em|b|strong|i)>/g, "").replace(/\*\*|`/g, "").replace(/\s+/g, " ").trim().toLowerCase();

// ---- everything the admin can edit, as one big list of normalised strings
const pool = new Set();
const addString = (v) => {
  if (typeof v !== "string" || !v.trim()) return;
  pool.add(norm(v));
  // a rich text is drawn as several text nodes (before, inside and after its <em> or <b>): each piece counts
  if (/<\/?(em|b|strong)>/.test(v)) for (const piece of v.split(/<\/?(?:em|b|strong)>/)) if (piece.trim()) pool.add(norm(piece));
};
const walk = (v) => {
  if (typeof v === "string") { addString(v); for (const line of v.split("\n")) addString(line); return; }
  if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
};
const rowsToPool = (rows, jsonCols = []) => {
  for (const r of rows) for (const [k, v] of Object.entries(r)) {
    if (jsonCols.includes(k) || (typeof v === "string" && /^[[{]/.test(v))) { try { walk(JSON.parse(v)); continue; } catch { /* plain text */ } }
    if (typeof v === "string") addString(v);
  }
};
rowsToPool(sql("SELECT content FROM page_sections"), ["content"]);
rowsToPool(sql("SELECT value_json FROM site_settings"), ["value_json"]);
rowsToPool(sql("SELECT label, description, tag FROM navigation_items"));
rowsToPool(sql("SELECT * FROM services"));
rowsToPool(sql("SELECT * FROM case_studies"));
rowsToPool(sql("SELECT * FROM case_study_images"));
rowsToPool(sql("SELECT * FROM blog_posts"));
rowsToPool(sql("SELECT title FROM blog_categories"));
rowsToPool(sql("SELECT title FROM blog_tags"));
rowsToPool(sql("SELECT * FROM media"));
rowsToPool(sql("SELECT seo_title, seo_description FROM pages"));
const poolList = [...pool];
const words = new Set(poolList.flatMap((p) => p.split(/[\s—–]+/).map((w) => w.replace(/[.,;:!?()]/g, ""))));
const settings = Object.fromEntries(sql("SELECT key, value_json FROM site_settings").map((r) => [r.key, JSON.parse(r.value_json)]));
const email = (settings["site.contact"] ?? settings["contact"] ?? {}).email ?? "";

// ---- visible text of a public page
const visibleText = (html) => {
  const body = (html.split("</head>")[1] ?? html).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<noscript[\s\S]*?<\/noscript>/g, "").replace(/<template[\s\S]*?<\/template>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<div hidden[\s\S]*?<\/div>/g, "");
  const out = [];
  for (const m of body.split(/<[^>]+>/)) {
    const t = m.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&rarr;/g, "→").replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  return out;
};
/** Text that is plainly not content: numbers and punctuation only, dates, counters, and the time shown by the office clocks. */
const NOT_CONTENT = [/^[\d\s.,:;%+\-–—×x/·•→←↗↑↓&|()'"“”‘’!?#*]+$/, /^\d{1,2}\s\w{3,9}\s\d{4}$/, /^\d+ min read$/, /^\(\d+\)$/, /^\d{1,2}:\d{2}(\s?[ap]m)?$/i, /^[a-z]{3,9} \d{1,2}, \d{4}$/i];

const PAGES = ["/", "/about", "/works", "/blog", "/contact", ...sql("SELECT slug FROM services WHERE status = 'published'").map((r) => `/services/${r.slug}`), ...sql("SELECT slug FROM case_studies WHERE status = 'published'").slice(0, 2).map((r) => `/works/${r.slug}`), ...sql("SELECT slug FROM blog_posts WHERE status = 'published'").slice(0, 2).map((r) => `/blog/${r.slug}`)];
const report = {};
for (const path of PAGES) {
  const html = await (await fetch(BASE + path)).text();
  const texts = [...new Set(visibleText(html))];
  const missing = [];
  for (const t of texts) {
    if (NOT_CONTENT.some((re) => re.test(t))) continue;
    const n = norm(t.replaceAll(email, "{email}"));
    const n2 = norm(t);
    // the manifesto draws every word in its own element: a lone word that is a word of editable text is that text
    if (/^[\p{L}\d'’.,;:!?—–()-]+$/u.test(t) && words.has(n.replace(/[.,;:!?—–()]/g, ""))) continue;
    // short text must be an editable string (or a piece of one) exactly; long text may be a part of a longer editable string
    if (pool.has(n) || pool.has(n2) || (n.length >= 25 && poolList.some((p) => p.includes(n) || p.includes(n2)))) continue;
    missing.push(t);
  }
  report[path] = { texts: texts.length, missing };
}
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 1));
else {
  let total = 0;
  for (const [path, r] of Object.entries(report)) {
    console.log(`\n${path}: ${r.texts} text items, ${r.missing.length} not found in editable content`);
    for (const t of r.missing) console.log(`   · ${t.slice(0, 140)}`);
    total += r.missing.length;
  }
  console.log(`\n${PAGES.length} pages, ${total} items not found in editable content`);
}
