// Verifies the page CMS: migration 0016, the registry (templates, section types, schemas), the typed defaults and the store (save/load).
//
//   node --no-warnings scripts/db/verify-pages.mjs        builds an in-memory SQLite database from migrations/ and db/seed/content.sql
//
// It proves that the current website copy (src/lib/cms/defaults.ts) passes the schemas, that the database refuses what the model forbids
// (unknown types, a second page per template, content that is not an object, a reference to nothing, deleting a file or case study in use),
// and that the lookup tables written by the migration are the registry in code.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { SECTION_TYPES, SECTION_TYPE_NAMES, TEMPLATES, TEMPLATE_NAMES, checkSection, refsOf } = await imp("src/lib/cms/registry.ts");
const { PAGE_DEFAULTS, defaultContent } = await imp("src/lib/cms/defaults.ts");
const store = await imp("src/lib/cms/store.ts");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 160) : ""}`); };

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
const q = (sql, ...a) => db.prepare(sql).all(...a);
const one = (sql, ...a) => db.prepare(sql).get(...a);
const rejects = (name, sql, pattern) => {
  try { db.exec(sql); check(name, false, "statement was accepted"); } catch (e) { check(name, pattern.test(String(e.message)), String(e.message)); }
};
const NOW = "'2026-10-08T00:00:00.000Z'";

// ---- build ------------------------------------------------------------------------------------------------------
const migrations = readdirSync(join(ROOT, "migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const f of migrations) {
  if (f.startsWith("0008")) db.exec("INSERT INTO submissions (id, name, email, message, status, source, created_at, updated_at) VALUES ('legacy-1', 'Old Row', 'old@example.com', 'sent before the rename', 'read', 'contact-page', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')");
  db.exec(readFileSync(join(ROOT, "migrations", f), "utf8"));
}
db.exec(readFileSync(join(ROOT, "db", "seed", "content.sql"), "utf8"));
check(`${migrations.length} migrations apply in order, then the content seed`, migrations.includes("0016_page_cms.sql"));

// ---- the lookup tables are the registry --------------------------------------------------------------------------
const dbTemplates = q("SELECT template, label, route FROM page_templates ORDER BY template");
check("page_templates holds exactly the templates of the registry, with their label and route", JSON.stringify(dbTemplates.map((t) => [t.template, t.label, t.route])) === JSON.stringify([...TEMPLATE_NAMES].sort().map((n) => [n, TEMPLATES[n].label, TEMPLATES[n].route])));
const dbTypes = q("SELECT type, label, version FROM page_section_types ORDER BY type");
check(`page_section_types holds exactly the ${SECTION_TYPE_NAMES.length} section types of the registry, with label and version`, JSON.stringify(dbTypes.map((t) => [t.type, t.label, t.version])) === JSON.stringify([...SECTION_TYPE_NAMES].sort().map((n) => [n, SECTION_TYPES[n].label, SECTION_TYPES[n].version])),
  dbTypes.map((t) => t.type).filter((t) => !SECTION_TYPE_NAMES.includes(t)).concat(SECTION_TYPE_NAMES.filter((t) => !dbTypes.some((d) => d.type === t))).join(","));

// ---- the registry is consistent ---------------------------------------------------------------------------------
let slotsOk = true, anchorsOk = true, typesUsed = new Set();
for (const t of TEMPLATE_NAMES) {
  const keys = TEMPLATES[t].sections.map((s) => s.key);
  if (new Set(keys).size !== keys.length) slotsOk = false;
  const anchors = TEMPLATES[t].sections.map((s) => s.anchor).filter(Boolean);
  if (new Set(anchors).size !== anchors.length) anchorsOk = false;
  for (const s of TEMPLATES[t].sections) typesUsed.add(s.type);
}
check("section keys are unique within each template, and anchors too", slotsOk && anchorsOk);
check("every section type is used by at least one template section", SECTION_TYPE_NAMES.every((n) => typesUsed.has(n)), SECTION_TYPE_NAMES.filter((n) => !typesUsed.has(n)).join(","));
check("every template section has a default, and every default is a section of its template",
  TEMPLATE_NAMES.every((t) => TEMPLATES[t].sections.every((s) => PAGE_DEFAULTS[t][s.key] !== undefined) && Object.keys(PAGE_DEFAULTS[t]).every((k) => TEMPLATES[t].sections.some((s) => s.key === k))));

// ---- the current website copy passes its schemas ----------------------------------------------------------------
const failures = [];
const refCounts = {};
for (const t of TEMPLATE_NAMES) for (const s of TEMPLATES[t].sections) {
  const r = checkSection(t, s.key, PAGE_DEFAULTS[t][s.key]);
  if (!r.ok) failures.push(`${t}.${s.key}: ${Object.entries(r.errors).map(([k, m]) => `${k}: ${m}`).join("; ")}`);
  else refCounts[s.type] = (refCounts[s.type] ?? 0) + r.refs.length;
}
check(`all ${Object.values(PAGE_DEFAULTS).reduce((n, p) => n + Object.keys(p).length, 0)} default sections (the current copy of the website) pass their schemas`, failures.length === 0, failures.join(" | "));
check("every media/case path the registry declares finds a reference in the current content (no typo in a path)",
  SECTION_TYPE_NAMES.every((n) => (SECTION_TYPES[n].media.length + SECTION_TYPES[n].cases.length === 0) || (refCounts[n] ?? 0) > 0), SECTION_TYPE_NAMES.filter((n) => SECTION_TYPES[n].media.length + SECTION_TYPES[n].cases.length > 0 && !(refCounts[n] > 0)).join(","));

// ---- store pages and sections the way the seed step will ----------------------------------------------------------
let n = 0;
for (const t of TEMPLATE_NAMES) {
  db.prepare("INSERT INTO pages (id, slug, title, status, template, created_at, updated_at) VALUES (?, ?, ?, 'published', ?, ?, ?)").run(`page_${t}`, t.replace(/_/g, "-"), TEMPLATES[t].label, t, "2026-10-08T00:00:00.000Z", "2026-10-08T00:00:00.000Z");
  TEMPLATES[t].sections.forEach((s, i) => {
    const r = checkSection(t, s.key, PAGE_DEFAULTS[t][s.key]);
    const id = `sec_${t}_${s.key}`;
    db.prepare("INSERT INTO page_sections (id, page_id, section_key, section_type, position, is_enabled, content, schema_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?, ?)").run(id, `page_${t}`, s.key, s.type, i, JSON.stringify(r.content), "2026-10-08T00:00:00.000Z", "2026-10-08T00:00:00.000Z");
    for (const ref of r.refs) {
      db.prepare("INSERT INTO page_section_refs (section_id, field_path, kind, media_id, case_study_id) VALUES (?, ?, ?, ?, ?)").run(id, ref.path, ref.kind, ref.kind === "media" ? ref.id : null, ref.kind === "case_study" ? ref.id : null);
    }
    n++;
  });
}
check(`${n} sections and their references are stored (every referenced media file and case study exists: the foreign keys accept them)`, one("SELECT COUNT(*) c FROM page_sections").c === n && one("SELECT COUNT(*) c FROM page_section_refs").c > 20, `${one("SELECT COUNT(*) c FROM page_section_refs").c} references`);
check("sections are read back in page order with their content intact",
  JSON.stringify(JSON.parse(one("SELECT content FROM page_sections WHERE id = 'sec_home_hero'").content)) === JSON.stringify(checkSection("home", "hero", PAGE_DEFAULTS.home.hero).content)
  && q("SELECT section_key FROM page_sections WHERE page_id = 'page_home' ORDER BY position").map((r) => r.section_key).join() === TEMPLATES.home.sections.map((s) => s.key).join());
check("one section is changed on its own: the page and the other sections are untouched",
  (() => {
    const before = q("SELECT id, updated_at FROM page_sections WHERE id <> 'sec_home_hero'").map((r) => r.updated_at).join();
    db.prepare("UPDATE page_sections SET content = ?, updated_at = '2026-10-09T00:00:00.000Z' WHERE id = 'sec_home_hero'").run(JSON.stringify({ ...JSON.parse(one("SELECT content FROM page_sections WHERE id = 'sec_home_hero'").content), eyebrow: "Changed" }));
    return q("SELECT id, updated_at FROM page_sections WHERE id <> 'sec_home_hero'").map((r) => r.updated_at).join() === before && one("SELECT updated_at u FROM pages WHERE id = 'page_home'").u === "2026-10-08T00:00:00.000Z";
  })());
db.prepare("UPDATE page_sections SET content = ?, updated_at = '2026-10-08T00:00:00.000Z' WHERE id = 'sec_home_hero'").run(JSON.stringify(checkSection("home", "hero", PAGE_DEFAULTS.home.hero).content));

// ---- what the database refuses -------------------------------------------------------------------------------------
const section = (over = {}) => ({ id: "s_x", page_id: "page_home", section_key: "extra", section_type: "home_hero", position: 99, content: "{}", ...over });
const insertSection = (o) => { const s = section(o); return `INSERT INTO page_sections (id, page_id, section_key, section_type, position, content, created_at, updated_at) VALUES ('${s.id}', '${s.page_id}', '${s.section_key}', '${s.section_type}', ${s.position}, '${s.content}', ${NOW}, ${NOW})`; };
rejects("a section type that is not in the list is refused", insertSection({ section_type: "free_html" }), /FOREIGN KEY/);
rejects("a section must belong to an existing page", insertSection({ page_id: "page_nope" }), /FOREIGN KEY/);
rejects("a page cannot have two sections with the same key", insertSection({ section_key: "hero" }), /UNIQUE/);
rejects("section content must be valid JSON", insertSection({ content: "{not json" }), /CHECK/);
rejects("section content must be a JSON object, not a list or text", insertSection({ content: "[1,2]" }), /CHECK/);
rejects("a section key with capitals or spaces is refused", insertSection({ section_key: "Hero Block" }), /CHECK/);
rejects("a position cannot be negative", insertSection({ position: -1 }), /CHECK/);
rejects("a second page for the same template is refused (the set of pages is fixed)", `INSERT INTO pages (id, slug, title, template, created_at, updated_at) VALUES ('p2', 'home-two', 'x', 'home', ${NOW}, ${NOW})`, /UNIQUE/);
rejects("a page needs a known template", `INSERT INTO pages (id, slug, title, template, created_at, updated_at) VALUES ('p3', 'landing', 'x', 'landing', ${NOW}, ${NOW})`, /FOREIGN KEY/);
rejects("a page slug cannot hold capitals, spaces or slashes", `INSERT INTO pages (id, slug, title, template, created_at, updated_at) VALUES ('p4', 'About Us/x', 'x', 'about', ${NOW}, ${NOW})`, /CHECK|UNIQUE/);
rejects("a page status outside draft/published/archived is refused", "UPDATE pages SET status = 'live' WHERE id = 'page_home'", /CHECK/);
rejects("a canonical address must be https or a path", "UPDATE pages SET canonical_url = 'http://example.com/x' WHERE id = 'page_home'", /CHECK/);
rejects("a share picture must be a media file", "UPDATE pages SET og_image_id = 'media_nope' WHERE id = 'page_home'", /FOREIGN KEY/);
rejects("a reference must point at an existing media file", "INSERT INTO page_section_refs (section_id, field_path, kind, media_id) VALUES ('sec_home_hero', 'x', 'media', 'media_nope')", /FOREIGN KEY/);
rejects("a reference must point at an existing case study", "INSERT INTO page_section_refs (section_id, field_path, kind, case_study_id) VALUES ('sec_home_hero', 'x', 'case_study', 'case_nope')", /FOREIGN KEY/);
rejects("a reference is exactly one of media or case study", "INSERT INTO page_section_refs (section_id, field_path, kind, media_id, case_study_id) VALUES ('sec_home_hero', 'x', 'media', 'media_earth', 'case_orbit')", /CHECK/);
rejects("a reference's kind and its id must match", "INSERT INTO page_section_refs (section_id, field_path, kind, case_study_id) VALUES ('sec_home_hero', 'x', 'media', 'case_orbit')", /CHECK/);
rejects("a media file used by a section cannot be deleted", "DELETE FROM media WHERE id = 'media_showreel'", /FOREIGN KEY/);
rejects("a case study used by a section cannot be deleted", "DELETE FROM case_studies WHERE id = 'case_verdant'", /FOREIGN KEY/);
{
  const refs = one("SELECT COUNT(*) c FROM page_section_refs WHERE section_id = 'sec_home_work'").c;
  db.exec("DELETE FROM page_sections WHERE id = 'sec_home_work'");
  check(`deleting a section removes its references (${refs})`, refs === 4 && one("SELECT COUNT(*) c FROM page_section_refs WHERE section_id = 'sec_home_work'").c === 0);
  db.exec("DELETE FROM pages WHERE id = 'page_about'");
  check("deleting a page removes its sections and their references", one("SELECT COUNT(*) c FROM page_sections WHERE page_id = 'page_about'").c === 0 && one("SELECT COUNT(*) c FROM page_section_refs WHERE section_id LIKE 'sec_about_%'").c === 0);
}

// ---- what the schemas refuse -------------------------------------------------------------------------------------------
const clone = (t, k) => structuredClone(PAGE_DEFAULTS[t][k]);
const bad = (name, t, k, mutate, pattern) => {
  const c = clone(t, k); mutate(c);
  const r = checkSection(t, k, c);
  check(name, !r.ok && (!pattern || Object.entries(r.errors).some(([p, m]) => pattern.test(`${p} ${m}`))), r.ok ? "accepted" : Object.entries(r.errors).map(([p, m]) => `${p}: ${m}`).join("; "));
};
check("a section the template does not have is refused", !checkSection("home", "sidebar", {}).ok && /no section/.test(checkSection("home", "sidebar", {}).errors.form));
bad("a key the schema does not name is refused (no free-form fields)", "home", "hero", (c) => { c.extra = "x"; }, /extra|Unrecognized/i);
bad("home: the four numbers cannot be three", "home", "why", (c) => { c.stats.pop(); }, /stats/);
bad("home: three service columns, not four", "home", "services", (c) => { c.columns.push(structuredClone(c.columns[0])); }, /columns/);
bad("home: the case showcase needs at least two cases", "home", "work", (c) => { c.caseIds = ["case_orbit"]; }, /caseIds/);
bad("home: a case study can be chosen once", "home", "work", (c) => { c.caseIds = ["case_orbit", "case_orbit"]; }, /once/);
bad("home: process steps are 3 to 6 (one step would break the rail)", "home", "process", (c) => { c.steps = c.steps.slice(0, 1); }, /steps/);
bad("home: a title may use <em> and <b> only", "home", "hero", (c) => { c.title = "Hello <script>x</script>"; }, /title/);
bad("home: an <em> must be closed", "home", "hero", (c) => { c.title = "Hello <em>world"; }, /title/);
bad("home: a link of the form javascript:… is refused", "home", "hero", (c) => { c.primaryCta.href = "javascript:alert(1)"; }, /primaryCta\.href/);
bad("home: a link to another host without https is refused", "home", "hero", (c) => { c.primaryCta.href = "//evil.example"; }, /primaryCta\.href/);
bad("home: text over its length limit is refused", "home", "hero", (c) => { c.eyebrow = "x".repeat(41); }, /eyebrow/);
bad("home: angle brackets in plain text are refused", "home", "industries", (c) => { c.items[0].title = "<b>SaaS</b>"; }, /items\.0\.title/);
bad("about: the timeline has five milestones", "about", "story", (c) => { c.items.pop(); }, /items/);
bad("about: an office needs a real time zone", "about", "places", (c) => { c.items[0].timeZone = "Mars/Olympus"; }, /timeZone/);
bad("about: a flag that is not drawn in code is refused", "about", "places", (c) => { c.items[0].flag = "FR"; }, /flag/);
bad("about: the headline has at most three lines", "about", "hero", (c) => { c.title = "a\nb\nc\nd"; }, /title/);
bad("about: the FAQ needs at least three questions", "about", "faq", (c) => { c.items = c.items.slice(0, 2); }, /items/);
bad("contact: an option list cannot repeat an option", "contact", "form", (c) => { c.needOptions[1] = c.needOptions[0].toUpperCase(); }, /twice/);
bad("contact: the form keeps between three and seven options", "contact", "form", (c) => { c.budgetOptions = ["a", "b"]; }, /budgetOptions/);
bad("shared: the closing band has exactly four floating pictures", "shared", "cta", (c) => { c.floaters.pop(); }, /floaters/);
bad("shared: a review dot must be a #rrggbb colour", "shared", "reviews", (c) => { c.items[0].dot = "red"; }, /dot/);
bad("shared: a logo style outside the four is refused", "shared", "logos", (c) => { c.items[0].style = "script"; }, /style/);
bad("shared: the footer has the six badges, no more", "shared", "footer", (c) => { c.badges.medium = { line1: "a", line2: "b" }; }, /badges/);
bad("works: the five filter chips keep their keys", "works", "hero", (c) => { delete c.chipLabels.motion; }, /chipLabels/);

// ---- what the schemas accept ---------------------------------------------------------------------------------------------
{
  const c = clone("home", "hero"); c.secondaryCta = null;
  check("an optional part can be switched off with null (home: no second link)", checkSection("home", "hero", c).ok);
  const f = clone("about", "faq"); f.cta = null; f.lead = "";
  check("optional text can be left empty (about FAQ without the button or the intro)", checkSection("about", "faq", f).ok);
  const e = clone("contact", "intro"); e.direct[0].text = "{email}";
  check("{email} is allowed as text (the site's contact e-mail is put in when the page is drawn)", checkSection("contact", "intro", e).ok);
  const refs = refsOf("reviews_collection", clone("shared", "reviews"));
  check("references are read from list items (reviews: one photo per review, path items.N.avatar.id)", refs.length === 5 && refs.every((r) => r.kind === "media" && /^items\.\d\.avatar\.id$/.test(r.path)));
  const r2 = refsOf("cta_band", clone("shared", "cta"));
  check("references are read from lists of ids (CTA band: 3 photos + 4 pictures)", r2.length === 7);
}

// ---- the store: load with fallback, save with checks ------------------------------------------------------------------------------
const d1 = {
  prepare(sql) {
    const st = db.prepare(sql);
    const make = (a) => ({
      bind: (...b) => make(b),
      first: async () => st.get(...a) ?? null,
      all: async () => ({ results: st.all(...a).map((r) => ({ ...r })) }),
      run: async () => { const r = st.run(...a); return { success: true, meta: { changes: Number(r.changes) } }; },
    });
    return make([]);
  },
  batch: async (stmts) => {
    db.exec("BEGIN");
    try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; }
  },
};
const seedSection = (tpl, key, i) => {
  const r = checkSection(tpl, key, PAGE_DEFAULTS[tpl][key]);
  const id = `sec_${tpl}_${key}`;
  db.prepare("INSERT INTO page_sections (id, page_id, section_key, section_type, position, is_enabled, content, schema_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, 1, ?, ?)").run(id, `page_${tpl}`, key, r.type, i, JSON.stringify(r.content), "2026-10-08T00:00:00.000Z", "2026-10-08T00:00:00.000Z");
  for (const ref of r.refs) db.prepare("INSERT INTO page_section_refs (section_id, field_path, kind, media_id, case_study_id) VALUES (?, ?, ?, ?, ?)").run(id, ref.path, ref.kind, ref.kind === "media" ? ref.id : null, ref.kind === "case_study" ? ref.id : null);
};
const T0 = "2026-10-08T00:00:00.000Z";
const loadedAbout = await store.loadPage(d1, "about"); // the About page was deleted above: nothing seeded
check("a page that is not seeded is drawn entirely from the defaults, with no error", loadedAbout.page === null && loadedAbout.issues.length === 0 && JSON.stringify(loadedAbout.content) === JSON.stringify(PAGE_DEFAULTS.about) && Object.values(loadedAbout.enabled).every(Boolean));
const loadedHome = await store.loadPage(d1, "home"); // 'work' was deleted above
check("a section whose row is missing is replaced by its default and reported", loadedHome.issues.length === 1 && /home\.work: no row/.test(loadedHome.issues[0]) && JSON.stringify(loadedHome.content.work) === JSON.stringify(PAGE_DEFAULTS.home.work));
seedSection("home", "work", 5);
{
  const l = await store.loadPage(d1, "home");
  check("a fully seeded page loads exactly the stored content, in the template's shape, with nothing reported", l.page?.template === "home" && l.issues.length === 0 && Object.keys(l.content).join() === TEMPLATES.home.sections.map((s) => s.key).join() && JSON.stringify(l.content.why) === JSON.stringify(PAGE_DEFAULTS.home.why));
  const bad3 = structuredClone(PAGE_DEFAULTS.home.why); bad3.stats.pop();
  db.prepare("UPDATE page_sections SET content = ? WHERE id = 'sec_home_why'").run(JSON.stringify(bad3));
  const l2 = await store.loadPage(d1, "home");
  check("a stored section that no longer passes its schema is replaced by its default and reported", l2.issues.length === 1 && /home\.why: .*schema.*stats/.test(l2.issues[0]) && l2.content.why.stats.length === 4, l2.issues.join(" | "));
  db.prepare("UPDATE page_sections SET content = ? WHERE id = 'sec_home_why'").run(JSON.stringify(PAGE_DEFAULTS.home.why));
  db.prepare("UPDATE page_sections SET section_type = 'manifesto' WHERE id = 'sec_home_why'").run();
  const l3 = await store.loadPage(d1, "home");
  check("a row of the wrong type for its place is replaced by the default and reported", l3.issues.length === 1 && /home\.why: type is manifesto/.test(l3.issues[0]));
  db.prepare("UPDATE page_sections SET section_type = 'why_stats' WHERE id = 'sec_home_why'").run();
}

const stamp = (id) => one("SELECT updated_at u FROM page_sections WHERE id = ?", id).u;
const refsOfSection = (id) => q("SELECT field_path, kind, media_id, case_study_id FROM page_section_refs WHERE section_id = ? ORDER BY field_path", id);
const save = (key, content, expected, tpl = "home") => store.saveSectionContent(d1, { template: tpl, key, content, expectedUpdatedAt: expected, userId: "u1" });
db.exec(`INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at) VALUES ('u1', 'editor@example.com', 'Ed', 'x', 'admin', ${NOW}, ${NOW})`);
{
  const next = structuredClone(PAGE_DEFAULTS.home.showreel); next.poster = { id: "media_earth", alt: "A globe" }; next.tag = "Showreel 2027";
  const r = await save("showreel", next, T0);
  const row = one("SELECT content, schema_version v, updated_by u, updated_at ua FROM page_sections WHERE id = 'sec_home_showreel'");
  check("saving a valid section writes its content, version, time and editor", r.ok && JSON.parse(row.content).tag === "Showreel 2027" && row.v === 1 && row.u === "u1" && row.ua === r.updatedAt && r.updatedAt > T0);
  check("the save reports which fields changed (names only)", r.ok && r.changedFields.join() === "poster,tag", r.changedFields?.join());
  check("the section's references are rewritten with it (the poster now points at the new file)", JSON.stringify(refsOfSection("sec_home_showreel").map((x) => [x.field_path, x.media_id])) === JSON.stringify([["poster.id", "media_earth"], ["video.id", "media_showreel"]]));
  check("saving one section leaves the page and the other sections as they were", one("SELECT updated_at u FROM pages WHERE id = 'page_home'").u === T0 && stamp("sec_home_hero") === T0 && stamp("sec_home_why") === T0);
  const again = await save("showreel", next, T0); // the stale token
  check("a save made from an older version is refused as a conflict and changes nothing", !again.ok && again.kind === "conflict" && JSON.parse(one("SELECT content FROM page_sections WHERE id = 'sec_home_showreel'").content).tag === "Showreel 2027");
  {
    // another editor saves between the check and the write: the guarded update must lose, and the reference rows must not change either
    const racing = { prepare: (s) => d1.prepare(s), batch: async (stmts) => { db.prepare("UPDATE page_sections SET updated_at = '2099-01-01T00:00:00.000Z' WHERE id = 'sec_home_why'").run(); return d1.batch(stmts); } };
    const keep = JSON.stringify(refsOfSection("sec_home_why")) + one("SELECT content FROM page_sections WHERE id = 'sec_home_why'").content;
    const c = structuredClone(PAGE_DEFAULTS.home.why); c.title = "Changed <em>title</em>";
    const lost = await store.saveSectionContent(racing, { template: "home", key: "why", content: c, expectedUpdatedAt: stamp("sec_home_why"), userId: "u1" });
    check("two saves at the same moment: the later write loses atomically (no content, no reference change)", !lost.ok && lost.kind === "conflict" && JSON.stringify(refsOfSection("sec_home_why")) + one("SELECT content FROM page_sections WHERE id = 'sec_home_why'").content === keep);
    db.prepare("UPDATE page_sections SET updated_at = ? WHERE id = 'sec_home_why'").run(T0);
  }
  const ok2 = await save("showreel", PAGE_DEFAULTS.home.showreel, r.updatedAt);
  check("a save made from the current version is accepted (the token moves on)", ok2.ok && ok2.updatedAt > r.updatedAt);
}
{
  const before = JSON.stringify(refsOfSection("sec_home_services"));
  const stampBefore = stamp("sec_home_services");
  const c = structuredClone(PAGE_DEFAULTS.home.services); c.columns.pop();
  const r1 = await save("services", c, stampBefore);
  check("an invalid section is refused with the field path and nothing is written", !r1.ok && r1.kind === "invalid" && "columns" in r1.errors && stamp("sec_home_services") === stampBefore && JSON.stringify(refsOfSection("sec_home_services")) === before);
  const c2 = structuredClone(PAGE_DEFAULTS.home.services); c2.bookBar.avatar = { id: "media_nope", alt: "" };
  const r2 = await save("services", c2, stampBefore);
  check("a picture that is not in the media library is refused", !r2.ok && r2.kind === "invalid" && /library/.test(r2.errors["bookBar.avatar.id"]) && stamp("sec_home_services") === stampBefore);
  const c3 = structuredClone(PAGE_DEFAULTS.home.showreel); c3.video = { id: "media_earth", alt: "" };
  const r3 = await save("showreel", c3, stamp("sec_home_showreel"));
  check("a video field refuses an image (the file must be the kind the field needs)", !r3.ok && r3.kind === "invalid" && /video/.test(r3.errors["video.id"]));
  const c4 = structuredClone(PAGE_DEFAULTS.home.showreel); c4.poster = { id: "media_showreel", alt: "" };
  const r4 = await save("showreel", c4, stamp("sec_home_showreel"));
  check("an image field refuses a video", !r4.ok && r4.kind === "invalid" && /image/.test(r4.errors["poster.id"]));
  const c5 = structuredClone(PAGE_DEFAULTS.home.work); c5.caseIds = ["case_orbit", "case_does_not_exist"];
  const r5 = await save("work", c5, stamp("sec_home_work"));
  check("a case study that does not exist is refused", !r5.ok && r5.kind === "invalid" && /no longer exists/.test(r5.errors["caseIds.1"]));
  const r6 = await save("sidebar", {}, T0);
  check("a section the template does not have is refused", !r6.ok && r6.kind === "invalid" && /no section/.test(r6.errors.form));
  const r7 = await save("hero", structuredClone(PAGE_DEFAULTS.about.hero), T0, "about");
  check("a section of a page that has not been seeded is reported missing", !r7.ok && r7.kind === "missing");
  const r8 = await save("hero", { ...structuredClone(PAGE_DEFAULTS.home.hero), injected: "x" }, stamp("sec_home_hero"));
  check("an unknown field is refused on save (nothing can be added to a section)", !r8.ok && r8.kind === "invalid" && /Unrecognized/.test(r8.errors.form));
  const r9 = await save("hero", null, stamp("sec_home_hero"));
  check("content that is not an object is refused", !r9.ok && r9.kind === "invalid");
}

{
  const off = await store.setSectionEnabled(d1, "home", "logos", false, "u1");
  const l = await store.loadPage(d1, "home");
  check("a section that may be hidden is hidden, its content kept", off.ok && l.enabled.logos === false && JSON.stringify(l.content.logos) === JSON.stringify(PAGE_DEFAULTS.home.logos));
  const on = await store.setSectionEnabled(d1, "home", "logos", true, "u1");
  check("and shown again", on.ok && (await store.loadPage(d1, "home")).enabled.logos === true);
  // every block drawn on a public page can be switched off and on again, and its content is kept; copy that is not a block cannot
  // on a fresh database with every page and section seeded
  const vdb = new DatabaseSync(":memory:");
  vdb.exec("PRAGMA foreign_keys = ON");
  for (const f of migrations) {
    if (f.startsWith("0008")) vdb.exec("INSERT INTO submissions (id, name, email, message, status, source, created_at, updated_at) VALUES ('legacy-1', 'Old Row', 'old@example.com', 'sent before the rename', 'read', 'contact-page', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')");
    vdb.exec(readFileSync(join(ROOT, "migrations", f), "utf8"));
  }
  vdb.exec(readFileSync(join(ROOT, "db", "seed", "content.sql"), "utf8"));
  vdb.exec(readFileSync(join(ROOT, "db", "seed", "pages.sql"), "utf8"));
  const vd1 = { prepare(sql) { const st = vdb.prepare(sql); const make = (x) => ({ bind: (...y) => make(y), first: async () => st.get(...x) ?? null, all: async () => ({ results: st.all(...x).map((r) => ({ ...r })) }), run: async () => { const r = st.run(...x); return { success: true, meta: { changes: Number(r.changes) } }; } }); return make([]); }, batch: async (stmts) => { vdb.exec("BEGIN"); try { const out = []; for (const s of stmts) out.push(await s.run()); vdb.exec("COMMIT"); return out; } catch (e) { vdb.exec("ROLLBACK"); throw e; } } };
  vdb.exec(`INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at) VALUES ('u1', 'editor@example.com', 'Ed', 'x', 'admin', ${NOW}, ${NOW})`);
  const vone = (sql, ...x) => vdb.prepare(sql).get(...x);
  let blocks = 0, kept = true, lockedOk = true, missingNote = [];
  for (const tpl of TEMPLATE_NAMES) {
    for (const sl of TEMPLATES[tpl].sections) {
      const row = vone("SELECT content FROM page_sections WHERE page_id = ? AND section_key = ?", `page_${tpl}`, sl.key);
      if (sl.canDisable) {
        blocks++;
        const o = await store.setSectionEnabled(vd1, tpl, sl.key, false, "u1");
        const hidden = (await store.loadPage(vd1, tpl)).enabled[sl.key] === false;
        const stored = vone("SELECT is_enabled e, content c FROM page_sections WHERE page_id = ? AND section_key = ?", `page_${tpl}`, sl.key);
        const i = await store.setSectionEnabled(vd1, tpl, sl.key, true, "u1");
        if (!(o.ok && hidden && stored.e === 0 && stored.c === row.content && i.ok && (await store.loadPage(vd1, tpl)).enabled[sl.key] === true)) kept = false;
      } else {
        const o = await store.setSectionEnabled(vd1, tpl, sl.key, false, "u1");
        if (o.ok || o.kind !== "locked" || !sl.lock) lockedOk = false;
        if (!sl.lock) missingNote.push(`${tpl}.${sl.key}`);
      }
    }
  }
  vdb.close();
  check(`every block of a public page (${blocks} sections) can be switched off and on: the row stays in the database with its content, only the flag changes`, blocks >= 25 && kept);
  check("a section that is not a block (page labels, shared lists, the footer extras) cannot be switched off, and says why", lockedOk && missingNote.length === 0, missingNote.join());
  const important = TEMPLATE_NAMES.flatMap((tpl) => TEMPLATES[tpl].sections.filter((sl) => sl.confirm).map((sl) => `${tpl}.${sl.key}`));
  check("the important sections ask for confirmation, each saying what visitors lose; they are all switchable", important.length >= 12 && TEMPLATE_NAMES.every((tpl) => TEMPLATES[tpl].sections.every((sl) => !sl.confirm || (sl.canDisable && sl.confirm.length > 30))) && ["home.hero", "about.careers", "contact.form", "works.grid", "shared.cta"].every((k) => important.includes(k)), important.join());
  check("every heading section (the one with the page's <h1>) asks for confirmation", ["home.hero", "about.hero", "works.hero", "blog.hero", "contact.intro"].every((k) => important.includes(k)));
  const nope = await store.setSectionEnabled(d1, "home", "sidebar", false, "u1");
  check("hiding a section the template does not have is refused", !nope.ok && nope.kind === "missing");
}

{
  const tok = () => one("SELECT updated_at u FROM pages WHERE id = 'page_home'").u;
  const seo = { seoTitle: "Visuolab — Digital product design", seoDescription: "Visuolab is a design agency that unites brand, website and product into one story.", ogImageId: "media_earth", canonicalUrl: "", noindex: false, nofollow: false };
  const r = await store.savePageSeo(d1, "home", seo, tok(), "u1");
  const row = one("SELECT seo_title, seo_description, og_image_id, canonical_url, noindex FROM pages WHERE id = 'page_home'");
  check("page SEO is saved; empty text is stored as NULL (use the default)", r.ok && row.seo_title === seo.seoTitle && row.og_image_id === "media_earth" && row.canonical_url === null && row.noindex === 0);
  const cleared = await store.savePageSeo(d1, "home", { seoTitle: "", seoDescription: "", ogImageId: "", canonicalUrl: "", noindex: true, nofollow: true }, tok(), "u1");
  const row2 = one("SELECT seo_title, seo_description, og_image_id, noindex, nofollow FROM pages WHERE id = 'page_home'");
  check("clearing the fields goes back to the defaults, and noindex can be set", cleared.ok && row2.seo_title === null && row2.seo_description === null && row2.og_image_id === null && row2.noindex === 1 && row2.nofollow === 1);
  const stale = await store.savePageSeo(d1, "home", seo, T0, "u1");
  check("page SEO saved from an older version is a conflict", !stale.ok && stale.kind === "conflict");
  const badSeo = [
    ["a description under 20 characters", { ...seo, seoDescription: "Too short" }, "seoDescription"],
    ["a title over 70 characters", { ...seo, seoTitle: "x".repeat(71) }, "seoTitle"],
    ["markup in the title", { ...seo, seoTitle: "<b>x</b>" }, "seoTitle"],
    ["a canonical address that is http", { ...seo, canonicalUrl: "http://example.com" }, "canonicalUrl"],
    ["a canonical address that is javascript:", { ...seo, canonicalUrl: "javascript:alert(1)" }, "canonicalUrl"],
    ["a share picture that is not in the library", { ...seo, ogImageId: "media_nope" }, "ogImageId"],
    ["a share picture that is a video", { ...seo, ogImageId: "media_showreel" }, "ogImageId"],
    ["an unknown field", { ...seo, robots: "all" }, "form"],
    ["a missing nofollow value", (({ nofollow, ...rest }) => rest)(seo), "nofollow"],
  ];
  for (const [name, input, field] of badSeo) {
    const x = await store.savePageSeo(d1, "home", input, tok(), "u1");
    check(`page SEO: ${name} is refused`, !x.ok && x.kind === "invalid" && field in x.errors, x.errors ? Object.entries(x.errors).map(([k, m]) => `${k}: ${m}`).join("; ") : x.kind);
  }
  const shared = await store.savePageSeo(d1, "shared", seo, T0, "u1");
  check("a template without a page of its own has no SEO settings", !shared.ok && shared.kind === "invalid");
}

// ---- the seed file (db/seed/pages.sql) -----------------------------------------------------------------------------------------------
{
  const fresh = new DatabaseSync(":memory:");
  fresh.exec("PRAGMA foreign_keys = ON");
  for (const f of migrations) {
    if (f.startsWith("0008")) fresh.exec("INSERT INTO submissions (id, name, email, message, status, source, created_at, updated_at) VALUES ('legacy-1', 'Old Row', 'old@example.com', 'sent before the rename', 'read', 'contact-page', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')");
    fresh.exec(readFileSync(join(ROOT, "migrations", f), "utf8"));
  }
  fresh.exec(readFileSync(join(ROOT, "db", "seed", "content.sql"), "utf8"));
  const seedSql = readFileSync(join(ROOT, "db", "seed", "pages.sql"), "utf8");
  fresh.exec(seedSql);
  const n = (sql) => fresh.prepare(sql).get().c;
  check("the page seed applies on a database that has the content seed: 9 pages, 36 sections, with their references", n("SELECT COUNT(*) c FROM pages") === TEMPLATE_NAMES.length && n("SELECT COUNT(*) c FROM page_sections") === 36 && n("SELECT COUNT(*) c FROM page_section_refs") > 20);
  let current = true, which = "";
  for (const t of TEMPLATE_NAMES) for (const s of TEMPLATES[t].sections) {
    const row = fresh.prepare("SELECT content, position FROM page_sections WHERE id = ?").get(`sec_${t}_${s.key}`);
    const want = checkSection(t, s.key, PAGE_DEFAULTS[t][s.key]);
    if (!row || JSON.stringify(JSON.parse(row.content)) !== JSON.stringify(want.content) || row.position !== TEMPLATES[t].sections.indexOf(s)) { current = false; which = `${t}.${s.key}`; }
  }
  check("every seeded section is exactly the typed default (the seed file is up to date: run db:seed:pages:generate after changing defaults.ts)", current, which);
  fresh.exec("UPDATE page_sections SET content = '{\"edited\":true}' WHERE id = 'sec_home_hero'");
  fresh.exec("DELETE FROM page_sections WHERE id = 'sec_home_logos'");
  fresh.exec(seedSql);
  check("running the seed again never overwrites an editor's change, and puts back a section that is missing", fresh.prepare("SELECT content FROM page_sections WHERE id = 'sec_home_hero'").get().content === '{"edited":true}' && n("SELECT COUNT(*) c FROM page_sections WHERE id = 'sec_home_logos'") === 1 && n("SELECT COUNT(*) c FROM page_sections") === 36);
  fresh.close();
}

// ---- the admin forms describe the sections completely ------------------------------------------------------------------------------
{
  const { blank, blankItem } = await imp("src/lib/cms/fields.ts");
  const { fieldsFor } = await imp("src/lib/cms/describe.ts");
  const FIELDS = Object.fromEntries(SECTION_TYPE_NAMES.map((n) => [n, fieldsFor(n)]));
  const problems = [];
  /** Every key of the content must be a field of the form, every field must be in the content, and each value must have the shape its field kind edits. */
  const walk = (fields, value, path) => {
    const keys = fields.map((f) => f.key);
    if (value === null || typeof value !== "object" || Array.isArray(value)) { problems.push(`${path}: not an object`); return; }
    for (const k of Object.keys(value)) if (!keys.includes(k)) problems.push(`${path}.${k}: in the content, not in the form`);
    for (const f of fields) {
      const v = value[f.key], at = `${path}.${f.key}`;
      if (!(f.key in value)) { problems.push(`${at}: in the form, not in the content`); continue; }
      const shape = {
        text: () => typeof v === "string", rich: () => typeof v === "string", href: () => typeof v === "string", colour: () => typeof v === "string", timezone: () => typeof v === "string",
        select: () => f.options.some((o) => o.value === v), bool: () => typeof v === "boolean",
        media: () => (v === null && f.optional) || (v && typeof v.id === "string" && typeof v.alt === "string" && Object.keys(v).length === 2),
        cases: () => Array.isArray(v) && v.every((x) => typeof x === "string"),
        group: () => (v === null && f.optional) || (v && typeof v === "object" && !Array.isArray(v)),
        list: () => Array.isArray(v),
      }[f.kind];
      if (!shape()) problems.push(`${at}: wrong shape for a ${f.kind} field`);
      if (f.kind === "group" && v) walk(f.fields, v, at);
      if (f.kind === "list" && Array.isArray(v)) {
        if (v.length < f.min || v.length > f.max) problems.push(`${at}: ${v.length} items, the form says ${f.min}-${f.max}`);
        v.forEach((it, i) => { if ("leaf" in f.of) { const sub = { ...f.of.leaf, key: "x" }; walk([sub], { x: it }, `${at}.${i}`); } else walk(f.of.fields, it, `${at}.${i}`); });
        // a blank item must have the keys of a real one (what "Add" puts in)
        const b = blankItem(f);
        if (!("leaf" in f.of) && JSON.stringify(Object.keys(b)) !== JSON.stringify(f.of.fields.map((x) => x.key))) problems.push(`${at}: blank item has other keys`);
      }
    }
  };
  for (const t of TEMPLATE_NAMES) for (const s of TEMPLATES[t].sections) walk(FIELDS[s.type], PAGE_DEFAULTS[t][s.key], `${t}.${s.key}`);
  check("every section's form, built from its schema, fits exactly the fields of its current content (none missing, none extra, counts and shapes right)", problems.length === 0, problems.slice(0, 4).join(" | "));
  check("every section type has a form", SECTION_TYPE_NAMES.every((n) => Array.isArray(FIELDS[n]) && FIELDS[n].length > 0));
  // a blank value of every kind of field is what the schema's "empty" is, so adding an item never produces a key the schema rejects
  check("a blank media field is {id, alt}, a blank optional group is null", JSON.stringify(blank({ kind: "media", key: "m", label: "m", media: "image" })) === '{"id":"","alt":""}' && blank({ kind: "group", key: "g", label: "g", fields: [], optional: true }) === null);
}

// ---- what the admin screens read ---------------------------------------------------------------------------------------------------
{
  const pages = await store.listPages(d1);
  check("the page list has every template, with its address, section count and whether it is seeded", pages.length === TEMPLATE_NAMES.length && pages.find((p) => p.template === "home").route === "/" && pages.find((p) => p.template === "home").sections === 9 && pages.find((p) => p.template === "home").seeded && !pages.find((p) => p.template === "about").seeded, pages.map((p) => `${p.template}:${p.seeded}`).join(" "));
  db.prepare("UPDATE pages SET seo_title = NULL, seo_description = NULL, og_image_id = NULL, canonical_url = NULL, noindex = 0, nofollow = 0 WHERE id = 'page_home'").run(); // earlier checks changed it
  const pages2 = await store.listPages(d1);
  const byT = (x) => pages2.find((p) => p.template === x);
  check("the page list gives each page its id, status and SEO status (default, custom, hidden from search); copy that is not a page has none", byT("home").id === "page_home" && byT("home").status === "published" && byT("home").seo === "default" && byT("shared").seo === null && byT("service_detail").seo === null);
  db.prepare("UPDATE pages SET seo_title = 'Own title' WHERE id = 'page_home'").run();
  const seoCustom = (await store.listPages(d1)).find((p) => p.template === "home").seo;
  db.prepare("UPDATE pages SET noindex = 1 WHERE id = 'page_home'").run();
  const seoNo = (await store.listPages(d1)).find((p) => p.template === "home").seo;
  db.prepare("UPDATE pages SET seo_title = NULL, noindex = 0 WHERE id = 'page_home'").run();
  check("SEO status follows the page: its own title makes it custom, noindex wins", seoCustom === "custom" && seoNo === "noindex" && (await store.listPages(d1)).find((p) => p.template === "home").seo === "default");
  const { templateFromParam } = await imp("src/lib/cms/registry.ts");
  check("an admin address names a page by slug or by id", templateFromParam("home") === "home" && templateFromParam("page_home") === "home" && templateFromParam("service-detail") === "service_detail" && templateFromParam("page_service_detail") === "service_detail" && templateFromParam("nope") === undefined);
  const ls = await store.listSections(d1, "home");
  check("a page's sections are listed in the template's order with their type label and whether they can be hidden", ls.sections.map((x) => x.key).join() === TEMPLATES.home.sections.map((x) => x.key).join() && ls.sections[0].typeLabel === "Home hero" && ls.sections[0].canDisable === true && ls.sections[0].confirm !== undefined && ls.sections.find((x) => x.key === "logos").canDisable === true && ls.page?.template === "home");
  const un = await store.listSections(d1, "about");
  check("a page that is not seeded lists its sections with no row and no page", un.page === null && un.sections.length === 9 && un.sections.every((x) => x.updatedAt === null));
  db.prepare("UPDATE page_sections SET content = '{\"bad\":1}' WHERE id = 'sec_home_why'").run();
  check("a section whose saved content no longer passes is marked damaged", (await store.listSections(d1, "home")).sections.find((x) => x.key === "why").damaged === true && (await store.listSections(d1, "home")).sections.find((x) => x.key === "hero").damaged === false);
  const forEdit = await store.readSectionForEdit(d1, "home", "why");
  check("a damaged section opens in the editor with its default content and a way to tell the editor", forEdit.damaged && JSON.stringify(forEdit.content) === JSON.stringify(PAGE_DEFAULTS.home.why));
  db.prepare("UPDATE page_sections SET content = ? WHERE id = 'sec_home_why'").run(JSON.stringify(PAGE_DEFAULTS.home.why));
  const good = await store.readSectionForEdit(d1, "home", "hero");
  check("a good section opens with its saved content and its version", !good.damaged && good.type === "home_hero" && typeof good.updatedAt === "string" && JSON.stringify(good.content) === JSON.stringify(PAGE_DEFAULTS.home.hero));
  check("a section that has no row, or does not exist, cannot be opened", (await store.readSectionForEdit(d1, "about", "hero")) === null && (await store.readSectionForEdit(d1, "home", "sidebar")) === null);
}


// ---- earlier versions of a section -----------------------------------------------------------------------------------------------------
{
  const revs = (id) => q("SELECT content, saved_at, replaced_at FROM page_section_revisions WHERE section_id = ? ORDER BY replaced_at DESC, id DESC", id);
  const base = structuredClone(PAGE_DEFAULTS.works.grid);
  const stampOf = () => one("SELECT updated_at u FROM page_sections WHERE id = 'sec_works_grid'").u;
  const before = revs("sec_works_grid").length;
  const r1 = await save("grid", { emptyText: "Version A" }, stampOf(), "works");
  check("a save keeps the content it replaces as an earlier version", r1.ok && revs("sec_works_grid").length === before + 1 && JSON.parse(revs("sec_works_grid")[0].content).emptyText === base.emptyText);
  const n1 = revs("sec_works_grid").length;
  const same = await save("grid", { emptyText: "Version A" }, stampOf(), "works");
  check("saving the same content again does not add a version", same.ok && revs("sec_works_grid").length === n1);
  const stale = await save("grid", { emptyText: "Version B" }, "2020-01-01T00:00:00.000Z", "works");
  check("a refused save (stale version) adds no version", !stale.ok && revs("sec_works_grid").length === n1);
  const bad = await save("grid", { emptyText: "" }, stampOf(), "works");
  check("an invalid save adds no version", !bad.ok && revs("sec_works_grid").length === n1);
  for (let i = 0; i < 13; i++) await save("grid", { emptyText: `Edit ${i}` }, stampOf(), "works");
  check("only the last 10 versions are kept", revs("sec_works_grid").length === 10, String(revs("sec_works_grid").length));
  const list = await store.listRevisions(d1, "works", "grid");
  check("the versions are listed newest first, with their content, when saved and who saved them", list.length === 10 && list[0].content.emptyText === "Edit 11" && list[1].content.emptyText === "Edit 10" && list.every((x) => x.savedAt && x.replacedAt) && list[0].by === "Ed", list.map((x) => x.content?.emptyText).join(","));
  // a revision records the whole change: previous content, new content, who changed it and when, and whether it was a restore
  const top = q("SELECT content, new_content, changed_by, replaced_at, kind FROM page_section_revisions WHERE section_id = 'sec_works_grid' ORDER BY replaced_at DESC, id DESC LIMIT 1")[0];
  check("a revision stores the previous content, the new content, who made the change, when, and that it was an edit", JSON.parse(top.content).emptyText === "Edit 11" && JSON.parse(top.new_content).emptyText === "Edit 12" && top.changed_by === "u1" && !!top.replaced_at && top.kind === "edit");
  check("the list names the change's author, its kind and the fields it touched", list[0].by === "Ed" && list[0].kind === "edit" && list[0].changedFields.join() === "emptyText");
  const wanted = list[1];
  const got = await store.getRevisionContent(d1, "works", "grid", (q("SELECT id FROM page_section_revisions WHERE section_id = 'sec_works_grid' ORDER BY replaced_at DESC, id DESC LIMIT 1 OFFSET 1")[0]).id);
  check("an earlier version can be fetched to be put back", got?.content.emptyText === wanted.content.emptyText && !!got.replacedAt);
  check("a version of another section, or an unknown one, cannot be fetched through this section", (await store.getRevisionContent(d1, "works", "hero", q("SELECT id FROM page_section_revisions WHERE section_id = 'sec_works_grid' LIMIT 1")[0].id)) === null && (await store.getRevisionContent(d1, "works", "grid", "rev_nope")) === null);
  const rest = await store.saveSectionContent(d1, { template: "works", key: "grid", content: got.content, expectedUpdatedAt: stampOf(), userId: "u1", kind: "restore" });
  const rtop = q("SELECT content, new_content, kind FROM page_section_revisions WHERE section_id = 'sec_works_grid' ORDER BY replaced_at DESC, id DESC LIMIT 1")[0];
  check("restoring is a checked save marked as a restore: the content it replaced is kept as a new version", rest.ok && one("SELECT content FROM page_sections WHERE id = 'sec_works_grid'").content === JSON.stringify(got.content) && rtop.kind === "restore" && JSON.parse(rtop.content).emptyText === "Edit 12" && JSON.parse(rtop.new_content).emptyText === wanted.content.emptyText && revs("sec_works_grid").length === 10);
  check("the list marks the restore", (await store.listRevisions(d1, "works", "grid"))[0].kind === "restore");
  const recent = await store.listRecentPageRevisions(d1, 5);
  check("recent changes lists the latest revisions across pages, newest first, with where, which section and the address", recent.length === 5 && recent[0].where === "Works" && recent[0].section === "Case study grid" && recent[0].kind === "restore" && recent[0].href === "/admin/pages/works/grid" && recent.every((x, i) => i === 0 || recent[i - 1].at >= x.at));
  rejects("a revision's kind must be edit or restore", "UPDATE page_section_revisions SET kind = 'other'", /CHECK/);
  rejects("a revision's new content must be a JSON object", "UPDATE page_section_revisions SET new_content = '[1]'", /CHECK/);
  db.prepare("UPDATE page_section_revisions SET content = '{\"nope\":1}' WHERE id = (SELECT id FROM page_section_revisions WHERE section_id = 'sec_works_grid' ORDER BY replaced_at DESC, id DESC LIMIT 1)").run();
  check("a version that no longer passes the schema is listed without content (it cannot be loaded)", (await store.listRevisions(d1, "works", "grid"))[0].content === null);
  check("a section that does not exist has no versions", (await store.listRevisions(d1, "works", "nope")).length === 0 && (await store.listRevisions(d1, "about", "hero")).length === 0);
  const rid = revs("sec_works_grid").length;
  db.exec("DELETE FROM page_sections WHERE id = 'sec_works_grid'");
  check("deleting a section deletes its versions", rid > 0 && q("SELECT COUNT(*) c FROM page_section_revisions WHERE section_id = 'sec_works_grid'")[0].c === 0);
  check("every section has a name for the admin", TEMPLATE_NAMES.every((t) => TEMPLATES[t].sections.every((s) => typeof s.name === "string" && s.name.length > 0)));
}

// ---- the generated forms use the right controls and limits -------------------------------------------------------------------------------------
{
  const { fieldsFor } = await imp("src/lib/cms/describe.ts");
  const hero = fieldsFor("home_hero");
  const hf = (k) => hero.find((f) => f.key === k);
  check("generated: text fields carry their limit and optional flag from the schema; rich text is a rich field", hf("eyebrow").kind === "text" && hf("eyebrow").max === 40 && !hf("eyebrow").optional && hf("title").kind === "rich" && hf("sceneLabel").optional === true);
  check("generated: a button is a group of text and link; a nullable group is optional", hf("primaryCta").kind === "group" && hf("primaryCta").fields.map((x) => x.kind).join() === "text,href" && hf("secondaryCta").optional === true && !hf("primaryCta").optional);
  const reel = fieldsFor("showreel");
  check("generated: the showreel video is a video picker, the poster an image picker", reel.find((f) => f.key === "video").kind === "media" && reel.find((f) => f.key === "video").media === "video" && reel.find((f) => f.key === "poster").media === "image");
  const why = fieldsFor("why_stats");
  const wi = why.find((f) => f.key === "items"), ws = why.find((f) => f.key === "stats");
  check("generated: a list gets its limits, its noun and whether its count is fixed, from the schema", wi.min === 3 && wi.max === 8 && !wi.fixed && wi.noun === "reason" && ws.fixed === true && ws.min === 4);
  const offices = fieldsFor("office_clocks").find((f) => f.key === "items").of.fields;
  check("generated: a choice is a select with the words for each value; a time zone has its own control", offices.find((f) => f.key === "flag").kind === "select" && offices.find((f) => f.key === "flag").options.map((o) => `${o.value}=${o.label}`).join() === "PT=Portugal,CA=Canada,SG=Singapore,AU=Australia" && offices.find((f) => f.key === "timeZone").kind === "timezone");
  const cs = fieldsFor("case_showcase").find((f) => f.key === "caseIds");
  check("generated: case studies are chosen with the case picker, with the schema's minimum and maximum", cs.kind === "cases" && cs.min === 2 && cs.max === 6);
  const logos = fieldsFor("logos_collection").find((f) => f.key === "items").of.fields;
  check("generated: a yes/no is a switch; an optional picture in a list item is an optional media field", logos.find((f) => f.key === "dot").kind === "bool" && fieldsFor("reviews_collection").find((f) => f.key === "items").of.fields.find((f) => f.key === "avatar").optional === true);
  check("generated: a list of plain strings has a text field as its item; a list of pictures has media items", fieldsFor("process_steps").find((f) => f.key === "facts").of.leaf.kind === "text" && fieldsFor("cta_band").find((f) => f.key === "avatars").of.leaf.kind === "media" && fieldsFor("cta_band").find((f) => f.key === "avatars").fixed === true);
  // every limit shown in a form is the limit the schema enforces: a text of exactly `max` characters passes, one more fails
  let limitsOk = true, which = "";
  const probe = (type, content) => SECTION_TYPES[type].schema.safeParse(content).success;
  for (const [t, key] of [["home_hero", "eyebrow"], ["about_hero", "lead"], ["contact_form", "note"], ["footer_extras", "copyright"]]) {
    const f = fieldsFor(t).find((x) => x.key === key);
    const tpl = TEMPLATE_NAMES.find((n) => TEMPLATES[n].sections.some((s) => s.type === t));
    const slot = TEMPLATES[tpl].sections.find((s) => s.type === t);
    const ok = structuredClone(PAGE_DEFAULTS[tpl][slot.key]); ok[key] = "a".repeat(f.max);
    const over = structuredClone(ok); over[key] = "a".repeat(f.max + 1);
    if (!(probe(t, ok) && !probe(t, over))) { limitsOk = false; which = `${t}.${key}`; }
  }
  check("generated: the limit in the form is the limit the schema enforces (max characters pass, one more is refused)", limitsOk, which);
}


// ---- robots, SEO guidance and the SEO fields -----------------------------------------------------------------------------------------------
{
  const g = await imp("src/lib/cms/seo-guidance.ts");
  const bands = [g.titleBand(0).level, g.titleBand(10).level, g.titleBand(45).level, g.titleBand(65).level, g.titleBand(71).level].join();
  check("title guidance: empty, short (under 30), good (30 to 60), long (61 to 70), over (past 70)", bands === "empty,short,good,long,over", bands);
  const dbands = [g.descriptionBand(0).level, g.descriptionBand(30).level, g.descriptionBand(120).level, g.descriptionBand(180).level, g.descriptionBand(201).level].join();
  check("description guidance: empty, short (under 70), good (70 to 160), long (161 to 200), over (past 200)", dbands === "empty,short,good,long,over", dbands);
  check("the guidance gives a sentence for each band, naming the numbers", g.titleBand(10).message.includes("30 to 60") && g.descriptionBand(201).message.includes("200"));
  const { pageMetadata } = await imp("src/lib/seo/metadata.ts");
  const robots = (o) => JSON.stringify(pageMetadata({ title: "t", description: "d", path: "/x", ...o }).robots);
  check("robots meta: index and follow by default", robots({}) === '{"index":true,"follow":true}');
  check("robots meta: noindex alone keeps following links", robots({ noindex: true, nofollow: false }) === '{"index":false,"follow":true}');
  check("robots meta: nofollow alone keeps indexing", robots({ nofollow: true }) === '{"index":true,"follow":false}');
  check("robots meta: both", robots({ noindex: true, nofollow: true }) === '{"index":false,"follow":false}');
  check("robots meta: a page kept out of results without a nofollow choice (as every page was before) does not follow either", robots({ noindex: true }) === '{"index":false,"follow":false}');
  db.prepare("UPDATE pages SET nofollow = 1 WHERE id = 'page_home'").run();
  check("SEO status shows links not followed", (await store.listPages(d1)).find((p) => p.template === "home").seo === "nofollow");
  db.prepare("UPDATE pages SET nofollow = 0 WHERE id = 'page_home'").run();
  rejects("nofollow must be 0 or 1", "UPDATE pages SET nofollow = 2 WHERE id = 'page_home'", /CHECK/);
  const rec = (await store.loadPage(d1, "home")).page;
  check("a page record carries its robots choices", rec.noindex === false && rec.nofollow === false);
}


// ---- draft and published content ---------------------------------------------------------------------------------------------------------
{
  // the page and its sections exist as seeded (earlier checks deleted some)
  db.prepare("INSERT OR IGNORE INTO pages (id, slug, title, status, template, created_at, updated_at) VALUES ('page_works', 'works', 'Works', 'published', 'works', ?, ?)").run(T0, T0);
  db.prepare("DELETE FROM page_sections WHERE id = 'sec_works_grid'").run();
  seedSection("works", "grid", 99);
  const live = (id) => one("SELECT content, updated_at u FROM page_sections WHERE id = ?", id);
  const drafts = (owner = "page_works") => q("SELECT section_key, content, updated_at FROM content_drafts WHERE scope = 'page' AND owner_id = ?", owner);
  check("pages with their own address have drafts; copy used on several pages does not", store.hasDrafts("works") && store.hasDrafts("home") && !store.hasDrafts("shared") && !store.hasDrafts("service_detail"));
  const before = live("sec_works_grid");
  const d1r = await store.saveSectionDraft(d1, { template: "works", key: "grid", content: { emptyText: "Draft A" }, expectedUpdatedAt: before.u, userId: "u1" });
  check("saving a draft writes content_drafts and leaves the published section, its version and its revisions alone", d1r.ok && d1r.draft === true && live("sec_works_grid").content === before.content && live("sec_works_grid").u === before.u && drafts().length === 1);
  check("the public loader never sees a draft; the preview loader does, and lists which sections it drew", (await store.loadPage(d1, "works")).content.grid.emptyText !== "Draft A" && (await store.loadPage(d1, "works", { drafts: true })).content.grid.emptyText === "Draft A" && (await store.loadPage(d1, "works", { drafts: true })).drafted.join() === "grid" && (await store.loadPage(d1, "works")).drafted.length === 0);
  check("the section list marks the draft and the editor starts from it with the draft's own version token", (await store.listSections(d1, "works")).sections.find((x) => x.key === "grid").draft === true && (await store.readSectionForEdit(d1, "works", "grid")).draft === true && (await store.readSectionForEdit(d1, "works", "grid")).content.emptyText === "Draft A" && (await store.readSectionForEdit(d1, "works", "grid")).updatedAt === d1r.updatedAt);
  check("the page list counts the draft", (await store.listPages(d1)).find((x) => x.template === "works").drafts === 1);
  const stale = await store.saveSectionDraft(d1, { template: "works", key: "grid", content: { emptyText: "Draft B" }, expectedUpdatedAt: before.u, userId: "u1" });
  check("a draft is saved against the draft's own version: the published version's token is a conflict once there is a draft", !stale.ok && stale.kind === "conflict");
  const bad = await store.saveSectionDraft(d1, { template: "works", key: "grid", content: { emptyText: "" }, expectedUpdatedAt: d1r.updatedAt, userId: "u1" });
  check("a draft is checked by the same strict schema as a live save", !bad.ok && bad.kind === "invalid" && drafts().length === 1);
  const d2r = await store.saveSectionDraft(d1, { template: "works", key: "grid", content: { emptyText: "Draft B" }, expectedUpdatedAt: d1r.updatedAt, userId: "u1" });
  check("saving again replaces the draft and moves its version", d2r.ok && d2r.updatedAt > d1r.updatedAt && drafts().length === 1 && JSON.parse(drafts()[0].content).emptyText === "Draft B");
  const same = await store.saveSectionDraft(d1, { template: "works", key: "grid", content: JSON.parse(before.content), expectedUpdatedAt: d2r.updatedAt, userId: "u1" });
  check("content equal to the published content removes the draft", same.ok && same.draft === false && drafts().length === 0 && same.updatedAt === before.u);
  const shared = await store.saveSectionDraft(d1, { template: "shared", key: "rating", content: { score: "5.0", text: "x" }, expectedUpdatedAt: "x", userId: "u1" });
  check("a template without drafts refuses them (it publishes on save)", !shared.ok && shared.kind === "invalid");
  const revBefore = q("SELECT COUNT(*) c FROM page_section_revisions WHERE section_id = 'sec_works_grid'")[0].c;
  const a1 = await store.saveSectionDraft(d1, { template: "works", key: "grid", content: { emptyText: "Publish me" }, expectedUpdatedAt: before.u, userId: "u1" });
  const pub = await store.publishPageDrafts(d1, "works", "u1");
  const revAfter = q("SELECT content, new_content, changed_by, kind FROM page_section_revisions WHERE section_id = 'sec_works_grid' ORDER BY replaced_at DESC, id DESC LIMIT 1")[0];
  check("publishing writes the draft into the published section through the checked save, keeps a revision (who, previous, new) and deletes the draft", a1.ok && pub.ok && pub.published.join() === "grid" && JSON.parse(live("sec_works_grid").content).emptyText === "Publish me" && drafts().length === 0 && JSON.parse(revAfter.new_content).emptyText === "Publish me" && revAfter.changed_by === "u1" && revAfter.kind === "edit" && q("SELECT COUNT(*) c FROM page_section_revisions WHERE section_id = 'sec_works_grid'")[0].c >= Math.min(10, revBefore + 1));
  check("publishing with nothing to publish is a no-op", (await store.publishPageDrafts(d1, "works", "u1")).published.length === 0);
  await store.saveSectionDraft(d1, { template: "works", key: "grid", content: { emptyText: "Throw me away" }, expectedUpdatedAt: live("sec_works_grid").u, userId: "u1" });
  const gone = await store.discardPageDrafts(d1, "works");
  check("discarding removes the draft and changes nothing published", gone.join() === "grid" && drafts().length === 0 && JSON.parse(live("sec_works_grid").content).emptyText === "Publish me");
  // a draft that no longer passes is not published and is reported; the others are
  db.prepare("INSERT INTO content_drafts (scope, owner_id, section_key, content, updated_at, updated_by) VALUES ('page', 'page_works', 'grid', '{\"emptyText\":5}', '2026-10-09T00:00:00.000Z', 'u1')").run();
  const broken = await store.publishPageDrafts(d1, "works", "u1");
  check("a draft that no longer fits its section is not published and is reported; it stays a draft", !broken.ok && !!broken.errors.grid && drafts().length === 1 && JSON.parse(live("sec_works_grid").content).emptyText === "Publish me");
  check("a broken draft is ignored by the preview loader (the published content is drawn)", (await store.loadPage(d1, "works", { drafts: true })).content.grid.emptyText === "Publish me");
  await store.discardPageDrafts(d1, "works");
  // page status
  const off = await store.setPageStatus(d1, "works", "draft", "u1");
  check("a page can be unpublished and published again; its status is stored on the page", off.ok && off.changed && one("SELECT status s FROM pages WHERE id = 'page_works'").s === "draft" && (await store.setPageStatus(d1, "works", "published", "u1")).ok && one("SELECT status s FROM pages WHERE id = 'page_works'").s === "published");
  check("the front page cannot be unpublished, and copy used on several pages has no status", (await store.setPageStatus(d1, "home", "draft", "u1")).kind === "locked" && (await store.setPageStatus(d1, "shared", "draft", "u1")).kind === "locked");
  rejects("a draft needs a known scope", "INSERT INTO content_drafts (scope, owner_id, section_key, content, updated_at) VALUES ('other', 'x', 'y', '{}', 'z')", /CHECK/);
  rejects("a draft's content must be a JSON object", "INSERT INTO content_drafts (scope, owner_id, section_key, content, updated_at) VALUES ('page', 'x', 'y', '[1]', 'z')", /CHECK/);
  rejects("one draft per section", "INSERT INTO content_drafts (scope, owner_id, section_key, content, updated_at) VALUES ('page', 'page_works', 'grid', '{}', 'z'), ('page', 'page_works', 'grid', '{}', 'z')", /UNIQUE|PRIMARY/);
  db.exec("DELETE FROM content_drafts");
  // a deleted record takes its drafts with it
  const post = one("SELECT id FROM blog_posts LIMIT 1").id;
  db.prepare("INSERT INTO content_drafts (scope, owner_id, section_key, content, updated_at) VALUES ('blog_post', ?, 'intro', '{}', 'z')").run(post);
  db.prepare("INSERT INTO content_drafts (scope, owner_id, section_key, content, updated_at) VALUES ('page', 'page_home', 'hero', '{}', 'z')").run();
  db.prepare("DELETE FROM blog_posts WHERE id = ?").run(post);
  check("deleting a record deletes its drafts, and only its own", q("SELECT COUNT(*) c FROM content_drafts WHERE owner_id = ?", post)[0].c === 0 && q("SELECT COUNT(*) c FROM content_drafts WHERE owner_id = 'page_home'")[0].c === 1);
  db.exec("DELETE FROM content_drafts");
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
