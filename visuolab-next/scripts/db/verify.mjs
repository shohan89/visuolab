// Verifies the CMS database: migrations, seed, constraints, indexes and the read queries.
//
//   node scripts/db/verify.mjs                  builds a fresh in-memory SQLite database from migrations/ and db/seed/content.sql
//   node scripts/db/verify.mjs --local          checks the local D1 used by `npm run dev` (read-only): seed and queries only
//   node scripts/db/verify.mjs --preview        same for the database used by `npm run preview`
//   node scripts/db/verify.mjs --db <file>      same for any SQLite file
//
// D1 is SQLite, so this runs the same SQL the Worker runs. The read queries in src/lib/server/cms.ts are executed through a
// small D1-shaped adapter and their results are compared, field for field, with the typed content the pages render today.
import { DatabaseSync } from "node:sqlite";
import { deepStrictEqual } from "node:assert";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const args = process.argv.slice(2);
// --local finds the SQLite file wrangler uses for the local D1 (npm run dev); --preview does the same for npm run preview
const localFile = (base) => {
  const dir = join(ROOT, base, ".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  const f = readdirSync(dir).filter((n) => n.endsWith(".sqlite")).map((n) => join(dir, n));
  if (!f.length) throw new Error("no local D1 file in " + dir);
  return f[0];
};
const dbFile = args.includes("--db") ? args[args.indexOf("--db") + 1] : args.includes("--local") ? localFile(".") : args.includes("--preview") ? localFile(join("dist", "server")) : null;
const readOnly = !!dbFile;

const db = new DatabaseSync(dbFile ?? ":memory:", dbFile ? { readOnly: true } : {});
db.exec("PRAGMA foreign_keys = ON");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };
const rejects = (name, sql, pattern) => {
  try { db.exec(sql); check(name, false, "statement was accepted"); } catch (e) { check(name, pattern.test(String(e.message)), String(e.message).slice(0, 90)); }
};
const q = (sql, ...a) => db.prepare(sql).all(...a);
const one = (sql, ...a) => db.prepare(sql).get(...a);

// ---- build ---------------------------------------------------------------------------------------------------
const migrations = readdirSync(join(ROOT, "migrations")).filter((f) => f.endsWith(".sql")).sort();
if (!readOnly) {
  for (const f of migrations) {
    if (f.startsWith("0008")) {
      // rows written before the rename must survive it
      db.exec("INSERT INTO submissions (id, name, email, message, status, source, created_at, updated_at) VALUES ('legacy-1', 'Old Row', 'old@example.com', 'sent before the rename', 'read', 'contact-page', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')");
    }
    db.exec(readFileSync(join(ROOT, "migrations", f), "utf8"));
  }
  check(`${migrations.length} migrations apply in order on an empty database`, true, migrations.map((m) => m.slice(0, 4)).join(" "));
  check("rename keeps existing contact rows (submissions -> contact_submissions)", one("SELECT COUNT(*) n FROM contact_submissions WHERE id = 'legacy-1'").n === 1 && !one("SELECT name FROM sqlite_master WHERE name = 'submissions'"));
  const seed = readFileSync(join(ROOT, "db", "seed", "content.sql"), "utf8");
  db.exec(seed);
  const counts1 = Object.fromEntries(q("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'").map((t) => [t.name, one(`SELECT COUNT(*) n FROM "${t.name}"`).n]));
  db.exec(seed);
  const counts2 = Object.fromEntries(Object.keys(counts1).map((t) => [t, one(`SELECT COUNT(*) n FROM "${t}"`).n]));
  check("seed applies, and applying it twice gives the same rows (it replaces, never duplicates)", JSON.stringify(counts1) === JSON.stringify(counts2));
}

// ---- schema -------------------------------------------------------------------------------------------------
const WANTED = ["users", "sessions", "services", "case_studies", "case_study_images", "blog_posts", "blog_categories", "blog_tags", "blog_post_tags", "contact_submissions", "media", "site_settings", "navigation_items", "integrations", "audit_logs"];
const tables = q("SELECT name FROM sqlite_master WHERE type = 'table'").map((t) => t.name);
check("all 15 requested tables exist", WANTED.every((t) => tables.includes(t)), WANTED.filter((t) => !tables.includes(t)).join(",") || "ok");
check("extra tables are only the join tables and helpers", tables.filter((t) => !WANTED.includes(t) && !/^(sqlite_|_cf_|d1_migrations)/.test(t)).sort().join(",") === "app_meta,rate_limits,service_case_studies,slug_redirects", tables.filter((t) => !WANTED.includes(t) && !/^(sqlite_|_cf_|d1_migrations)/.test(t)).sort().join(","));
const cols = (t) => q(`PRAGMA table_info("${t}")`).map((c) => c.name);
for (const t of ["services", "case_studies", "blog_posts", "blog_categories", "blog_tags", "media"]) {
  const need = ["id", "slug", "title", "status", "created_at", "updated_at", "published_at"];
  check(`${t}: has id, slug, title, status, createdAt, updatedAt, publishedAt`, need.every((c) => cols(t).includes(c)), need.filter((c) => !cols(t).includes(c)).join(",") || "ok");
}
{
  const need = ["id", "slug", "title", "status", "created_at", "updated_at"]; // an integration is never "published", so it has no publish date
  check("integrations: has id, slug, title, status, createdAt, updatedAt", need.every((c) => cols("integrations").includes(c)));
}
const fks = (t) => q(`PRAGMA foreign_key_list("${t}")`).map((f) => `${f.from}->${f.table}(${f.on_delete})`);
const fkCount = WANTED.concat(["service_case_studies"]).reduce((n, t) => n + fks(t).length, 0);
check(`foreign keys declared (${fkCount})`, fkCount >= 19, [`case_study_images: ${fks("case_study_images").join(" ")}`, `blog_posts: ${fks("blog_posts").join(" ")}`].join(" | "));
const uniques = q("SELECT m.name AS tbl, i.name AS idx FROM sqlite_master m, pragma_index_list(m.name) i WHERE m.type = 'table' AND i.\"unique\" = 1 AND i.origin <> 'pk'").length;
check(`unique constraints/indexes declared (${uniques})`, uniques >= 12);
const idxCount = q("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'").length;
check(`secondary indexes (${idxCount})`, idxCount >= 18);

// ---- seed: counts ----------------------------------------------------------------------------------------------
const expectCount = { media: 28, case_studies: 8, case_study_images: 40, services: 4, service_case_studies: 12, blog_categories: 5, blog_posts: 6, blog_tags: 0, blog_post_tags: 0, site_settings: 22, navigation_items: 45, integrations: 3 };
for (const [t, n] of Object.entries(expectCount)) check(`seed rows: ${t} = ${n}`, one(`SELECT COUNT(*) n FROM ${t}`).n === n, String(one(`SELECT COUNT(*) n FROM ${t}`).n));
check("every seeded content row is published (nothing hidden by accident)", q("SELECT 1 FROM services WHERE status <> 'published' UNION ALL SELECT 1 FROM case_studies WHERE status <> 'published' UNION ALL SELECT 1 FROM blog_posts WHERE status <> 'published'").length === 0);
check("no secret is stored in integrations", q("SELECT config_json FROM integrations").every((r) => !/key|secret|token|password/i.test(r.config_json)), q("SELECT slug, secret_name FROM integrations").map((r) => `${r.slug}:${r.secret_name}`).join(" "));

// ---- read queries == the content the pages render today ----------------------------------------------------
const d1 = {
  prepare(sql) {
    const st = db.prepare(sql);
    const make = (a) => ({
      bind: (...b) => make(b),
      first: async () => st.get(...a) ?? null,
      all: async () => ({ results: st.all(...a).map((r) => ({ ...r })) }),
      run: async () => { st.run(...a); return { success: true }; },
    });
    return make([]);
  },
};
const cms = await imp("src/lib/server/cms.ts");
const plain = (x) => JSON.parse(JSON.stringify(x));
const same = (name, actual, expected) => {
  try { deepStrictEqual(plain(actual), plain(expected)); check(name, true); } catch (e) {
    const a = plain(actual), b = plain(expected);
    let where = "";
    const walk = (x, y, p) => { if (where) return; if (JSON.stringify(x) === JSON.stringify(y)) return; if (x && y && typeof x === "object" && typeof y === "object") { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], `${p}.${k}`); } else where = `${p}: db=${JSON.stringify(x)?.slice(0, 70)} code=${JSON.stringify(y)?.slice(0, 70)}`; };
    walk(a, b, "");
    check(name, false, where);
  }
};
const { services } = await imp("src/content/services.ts");
const { caseStudies, worksOrder } = await imp("src/content/cases.ts");
const { blogPosts, blogOrder, blogTopics } = await imp("src/content/blog.ts");
const { reviews } = await imp("src/content/reviews.ts");
const { trustedBy } = await imp("src/content/logos.ts");
const navData = await imp("src/content/nav-data.ts");

same("getServices() = the four service pages (every field, in order)", await cms.getServices(d1), services);
same("getCaseStudies() = the eight case studies (every field, in /works order)", await cms.getCaseStudies(d1), worksOrder.map((s) => caseStudies.find((c) => c.slug === s)));
const CMS_EXTRAS = ["featured", "tags", "canonicalUrl", "ogImage", "publishedAtIso", "updatedAtIso"]; // fields the CMS adds on top of the typed content
same("getBlogPosts() = the six articles (every field, newest first)", (await cms.getBlogPosts(d1)).map((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !CMS_EXTRAS.includes(k)))), blogOrder.map((s) => blogPosts.find((p) => p.slug === s)));
same("getBlogCategories() = the five blog topics", await cms.getBlogCategories(d1), blogTopics);
same("setting 'reviews' = the review list", await cms.getSetting(d1, "reviews"), reviews);
same("setting 'trusted_by' = the logo marquee", await cms.getSetting(d1, "trusted_by"), trustedBy);
const nav = await cms.getNavigation(d1);
same("navigation: primary links", nav.primary, navData.mainLinks.map((l) => ({ label: l.label, href: l.href })));
same("navigation: contact button", nav.cta, navData.cta);
same("navigation: mega-menu cards", nav.megaCards, navData.serviceCardData.map((c) => ({ label: c.title, href: c.href, description: c.desc, icon: c.icon })));
same("navigation: design sprint promo", nav.promo, { label: navData.promo.title, href: navData.promo.href, description: navData.promo.desc, tag: navData.promo.tag });
same("navigation: mega-menu columns", nav.megaColumns, navData.serviceGroups.map((g) => ({ label: g.label, links: g.links.map((l) => ({ label: l.label, href: l.href })) })));
check("navigation: footer has 3 columns of 5, 5 and 6 links", nav.footer.length === 3 && nav.footer.map((g) => g.links.length).join(",") === "5,5,6", nav.footer.map((g) => `${g.label}(${g.links.length})`).join(" "));
const all = await cms.getAllSettings(d1);
const lens = { "about.faq": all["about.faq"]?.items?.length, "about.principles": all["about.principles"]?.items?.length, "about.milestones": all["about.milestones"]?.items?.length, "about.offices": all["about.offices"]?.items?.length, "about.roles": all["about.roles"]?.items?.length, "about.mission_vision": all["about.mission_vision"]?.length, "home.why": all["home.why"]?.items?.length, "home.stats": all["home.stats"]?.length, "home.industries": all["home.industries"]?.items?.length, "home.process": all["home.process"]?.steps?.length, "home.work": all["home.work"]?.slugs?.length, "site.footer.badges": all["site.footer"]?.badges?.length, "site.contact.facts": all["site.contact"]?.facts?.length };
const wantLens = { "about.faq": 6, "about.principles": 5, "about.milestones": 5, "about.offices": 4, "about.roles": 4, "about.mission_vision": 2, "home.why": 6, "home.stats": 4, "home.industries": 4, "home.process": 4, "home.work": 4, "site.footer.badges": 6, "site.contact.facts": 3 };
check("page lists in site_settings have the same lengths as the pages", JSON.stringify(lens) === JSON.stringify(wantLens), JSON.stringify(lens));
check("home work slugs are the four cards on the home page, in order", JSON.stringify(all["home.work"]?.slugs) === JSON.stringify(["orbit", "marlow", "kite", "verdant"]));
check("featured case studies are the four shown on the home page", JSON.stringify(db.prepare("SELECT slug FROM case_studies WHERE featured = 1 ORDER BY position").all().map((r) => r.slug)) === JSON.stringify(all["home.work"]?.slugs));

// ---- assets ---------------------------------------------------------------------------------------------------
const mediaUrls = new Set(q("SELECT url FROM media").map((m) => m.url));
const referenced = new Set();
for (const row of q("SELECT value_json AS j FROM site_settings UNION ALL SELECT hero_shots_json FROM services UNION ALL SELECT showcase_json FROM case_studies")) for (const m of row.j.matchAll(/"(\/assets\/[^"]+)"/g)) referenced.add(m[1]);
const missing = [...referenced].filter((u) => !mediaUrls.has(u));
check(`every /assets file named inside content documents has a media row (${referenced.size} checked)`, missing.length === 0, missing.join(",") || "ok");
check("media rows have real sizes", q("SELECT 1 FROM media WHERE kind = 'image' AND (width IS NULL OR height IS NULL OR bytes IS NULL)").length === 0 && q("SELECT 1 FROM media WHERE bytes IS NULL OR bytes = 0").length === 0);
const sample = one("SELECT width, height, bytes FROM media WHERE slug = 'earth'");
check("image sizes were read from the files (earth.webp)", sample.width > 0 && sample.height > 0 && sample.bytes > 400000, JSON.stringify(sample));
const unused = q("SELECT slug FROM media WHERE id NOT IN (SELECT card_image_id FROM case_studies UNION SELECT cover_image_id FROM case_studies UNION SELECT media_id FROM case_study_images UNION SELECT hero_image_a_id FROM services UNION SELECT hero_image_b_id FROM services UNION SELECT cover_image_id FROM blog_posts UNION SELECT author_image_id FROM blog_posts)").map((r) => r.slug);
console.log(`INFO  media used only by page code or settings (hero art, logos, showreel, avatars): ${unused.join(", ")}`);

// ---- integrity ---------------------------------------------------------------------------------------------
check("PRAGMA integrity_check", one("PRAGMA integrity_check").integrity_check === "ok");
check("PRAGMA foreign_key_check finds nothing", q("PRAGMA foreign_key_check").length === 0);
const plan = (sql) => q(`EXPLAIN QUERY PLAN ${sql}`).map((r) => r.detail).join(" | ");
const uses = (name, sql, idx) => { const p = plan(sql); check(`index used: ${name}`, p.includes(idx), p.slice(0, 110)); };
uses("published case studies by position", "SELECT * FROM case_studies WHERE status = 'published' ORDER BY position", "idx_case_studies_status_position");
uses("published services by position", "SELECT * FROM services WHERE status = 'published' ORDER BY position", "idx_services_status_position");
uses("latest published articles", "SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC", "idx_blog_posts_status_published");
uses("articles of one category", "SELECT * FROM blog_posts WHERE category_id = 'cat_brand'", "idx_blog_posts_category");
uses("a case study by slug", "SELECT * FROM case_studies WHERE slug = 'orbit'", "sqlite_autoindex_case_studies");
uses("images of one case study", "SELECT * FROM case_study_images WHERE case_study_id = 'case_orbit' AND role = 'gallery_a'", "sqlite_autoindex_case_study_images");
uses("cases shown on a service page", "SELECT * FROM service_case_studies WHERE service_id = 'svc_brand-identity' ORDER BY position", "sqlite_autoindex_service_case_studies");
uses("services that show a case study", "SELECT * FROM service_case_studies WHERE case_study_id = 'case_orbit'", "idx_service_case_studies_case");
uses("posts with a tag", "SELECT post_id FROM blog_post_tags WHERE tag_id = 't'", "idx_blog_post_tags_tag");
uses("a menu in order", "SELECT * FROM navigation_items WHERE menu = 'primary' ORDER BY position", "idx_navigation_menu_position");
uses("children of a menu group", "SELECT * FROM navigation_items WHERE parent_id = 'x'", "idx_navigation_parent");
uses("a setting by key", "SELECT * FROM site_settings WHERE key = 'reviews'", "sqlite_autoindex_site_settings");
uses("contact messages by status, newest first", "SELECT * FROM contact_submissions WHERE status = 'new' ORDER BY created_at DESC", "idx_contact_status_created");
uses("contact messages from one address", "SELECT * FROM contact_submissions WHERE email = 'a@b.c'", "idx_contact_email");
uses("media by kind and status", "SELECT * FROM media WHERE kind = 'image' AND status = 'published'", "idx_media_kind_status");
uses("sessions of a user", "SELECT * FROM sessions WHERE user_id = 'u'", "idx_sessions_user");
uses("expired sessions", "SELECT id FROM sessions WHERE expires_at < 'x'", "idx_sessions_expires");
uses("recent audit entries", "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20", "idx_audit_created");
uses("audit entries for one record", "SELECT * FROM audit_logs WHERE entity_type = 'service' AND entity_id = 'x'", "idx_audit_entity");

// ---- constraints (write tests, on the in-memory copy only) -----------------------------------------------------
if (!readOnly) {
  const NOW = "'2026-10-04T00:00:00.000Z'";
  const svc = (id, slug, extra = "") => `INSERT INTO services (id, slug, title, status, meta_title, meta_description, hero_title, hero_lead, hero_cta_label, hero_cta_href, hero_shots_json, problems_json, overview_json, outcomes_json, band_json, included_json, process_json, cases_json, created_at, updated_at ${extra ? ", " + extra.split("|")[0] : ""}) VALUES ('${id}', '${slug}', 't', 'draft', 'm', 'd', 'h', 'l', 'c', '/c', '[]', '{}', '{}', '{}', '{}', '{}', '{}', '{}', ${NOW}, ${NOW} ${extra ? ", " + extra.split("|")[1] : ""})`;
  db.exec(svc("t1", "test-service"));
  check("a new service can be saved as a draft (no publish date needed)", one("SELECT status, published_at FROM services WHERE id = 't1'").status === "draft");
  rejects("duplicate service slug is refused (UNIQUE)", svc("t2", "test-service"), /UNIQUE/);
  rejects("duplicate case study slug is refused", `INSERT INTO case_studies (id, slug, title, status, meta_title, meta_description, client_name, year, type_line, short_kind, card_tags_json, filters_json, card_image_id, card_image_alt, cover_image_id, cover_image_alt, facts_json, about_label, about_lead, stats_json, showcase_json, process_json, challenges_json, results_json, more_json, created_at, updated_at) SELECT 'dup', slug, title, 'draft', meta_title, meta_description, client_name, year, type_line, short_kind, card_tags_json, filters_json, card_image_id, card_image_alt, cover_image_id, cover_image_alt, facts_json, about_label, about_lead, stats_json, showcase_json, process_json, challenges_json, results_json, more_json, created_at, updated_at FROM case_studies WHERE slug = 'orbit'`, /UNIQUE/);
  rejects("duplicate blog post slug is refused", "INSERT INTO blog_posts (id, slug, title, category_id, meta_title, meta_description, lead, body_json, outro_json, related_json, read_minutes, author_name, cover_image_id, created_at, updated_at) SELECT 'dup', slug, title, category_id, meta_title, meta_description, lead, body_json, outro_json, related_json, read_minutes, author_name, cover_image_id, created_at, updated_at FROM blog_posts LIMIT 1", /UNIQUE/);
  rejects("duplicate media url is refused", `INSERT INTO media (id, slug, title, kind, mime, url, created_at, updated_at) VALUES ('m2', 'x2', 'x', 'image', 'image/webp', '/assets/earth.webp', ${NOW}, ${NOW})`, /UNIQUE/);
  rejects("duplicate integration slug is refused", `INSERT INTO integrations (id, slug, title, created_at, updated_at) VALUES ('i2', 'resend', 'x', ${NOW}, ${NOW})`, /UNIQUE/);
  rejects("duplicate settings key is refused", `INSERT INTO site_settings (id, key, title, value_json, created_at, updated_at) VALUES ('s2', 'reviews', 'x', '[]', ${NOW}, ${NOW})`, /UNIQUE/);
  rejects("user e-mail is unique, ignoring upper/lower case", `INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES ('u1', 'A@X.COM', 'a', 'h', ${NOW}, ${NOW}); INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES ('u2', 'a@x.com', 'a', 'h', ${NOW}, ${NOW})`, /UNIQUE/);
  db.exec("DELETE FROM users");
  rejects("a status outside draft/published/archived is refused", svc("t3", "bad-status").replace("'draft'", "'live'"), /CHECK/);
  rejects("a published row needs a publish date", svc("t4", "no-date").replace("'draft'", "'published'"), /CHECK/);
  rejects("JSON columns must be valid JSON", svc("t5", "bad-json").replace("'[]'", "'{oops'"), /CHECK/);
  rejects("a gallery image must point at an existing case study (foreign key)", `INSERT INTO case_study_images (id, case_study_id, media_id, role, created_at, updated_at) VALUES ('x', 'nope', 'media_earth', 'gallery_a', ${NOW}, ${NOW})`, /FOREIGN KEY/);
  rejects("a gallery image must point at an existing media row", `INSERT INTO case_study_images (id, case_study_id, media_id, role, position, created_at, updated_at) VALUES ('x', 'case_orbit', 'nope', 'gallery_a', 99, ${NOW}, ${NOW})`, /FOREIGN KEY/);
  rejects("an image role must be one of the three", `INSERT INTO case_study_images (id, case_study_id, media_id, role, created_at, updated_at) VALUES ('x', 'case_orbit', 'media_earth', 'banner', ${NOW}, ${NOW})`, /CHECK/);
  rejects("two images cannot share a slot of the same case study", `INSERT INTO case_study_images (id, case_study_id, media_id, role, position, created_at, updated_at) VALUES ('x', 'case_orbit', 'media_earth', 'gallery_a', 0, ${NOW}, ${NOW})`, /UNIQUE/);
  rejects("a blog post needs an existing category", "UPDATE blog_posts SET category_id = 'cat_nope' WHERE slug = 'webflow-or-next-js'", /FOREIGN KEY/);
  rejects("a media file in use cannot be deleted (RESTRICT)", "DELETE FROM media WHERE id = 'media_cases-orbit'", /FOREIGN KEY/);
  rejects("a category with articles cannot be deleted", "DELETE FROM blog_categories WHERE id = 'cat_brand'", /FOREIGN KEY/);
  rejects("an r2 media row needs an r2 key", `INSERT INTO media (id, slug, title, kind, mime, storage, url, created_at, updated_at) VALUES ('m3', 'r2-no-key', 'x', 'image', 'image/png', 'r2', '/media/x', ${NOW}, ${NOW})`, /CHECK/);
  rejects("a menu position holds one item, including top-level ones", `INSERT INTO navigation_items (id, menu, position, label, href, created_at, updated_at) VALUES ('n2', 'primary', 0, 'dup', '/x', ${NOW}, ${NOW})`, /UNIQUE/);
  db.exec("INSERT INTO slug_redirects (id, kind, old_slug, new_slug, created_at) VALUES ('r1', 'service', 'old-name', 'brand-identity', '2026-10-04T00:00:00.000Z')");
  rejects("an old address can redirect only once per kind", "INSERT INTO slug_redirects (id, kind, old_slug, new_slug, created_at) VALUES ('r2', 'service', 'old-name', 'motion-3d', '2026-10-04T00:00:00.000Z')", /UNIQUE/);
  rejects("a redirect cannot point at itself", "INSERT INTO slug_redirects (id, kind, old_slug, new_slug, created_at) VALUES ('r3', 'service', 'same', 'same', '2026-10-04T00:00:00.000Z')", /CHECK/);
  rejects("a redirect needs a known kind", "INSERT INTO slug_redirects (id, kind, old_slug, new_slug, created_at) VALUES ('r4', 'page', 'a', 'b', '2026-10-04T00:00:00.000Z')", /CHECK/);
  db.exec("DELETE FROM slug_redirects");
  rejects("a canonical URL must be https", "UPDATE blog_posts SET canonical_url = 'http://example.com/x' WHERE slug = 'webflow-or-next-js'", /CHECK/);
  rejects("an Open Graph image must be a media file", "UPDATE blog_posts SET og_image_id = 'media_nope' WHERE slug = 'webflow-or-next-js'", /FOREIGN KEY/);
  db.exec("UPDATE blog_posts SET published_at = '2999-01-01T00:00:00.000Z' WHERE slug = 'webflow-or-next-js'");
  check("a published article dated in the future is scheduled: not in the live list, still stored", one("SELECT COUNT(*) n FROM blog_posts p WHERE p.status = 'published' AND p.published_at <= ?", "2026-10-05T00:00:00.000Z").n === 5 && one("SELECT COUNT(*) n FROM blog_posts WHERE status = 'published'").n === 6);
  db.exec("UPDATE blog_posts SET published_at = '2026-07-16T00:00:00.000Z' WHERE slug = 'webflow-or-next-js'");
  rejects("a menu name outside the list is refused", `INSERT INTO navigation_items (id, menu, position, label, created_at, updated_at) VALUES ('n3', 'sidebar', 9, 'x', ${NOW}, ${NOW})`, /CHECK/);
  rejects("a contact message status outside the list is refused", `INSERT INTO contact_submissions (id, name, email, message, status, created_at, updated_at) VALUES ('c1', 'a', 'a@b.c', 'm', 'maybe', ${NOW}, ${NOW})`, /CHECK/);
  rejects("a user role outside admin/editor is refused", `INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at) VALUES ('u3', 'r@x.com', 'a', 'h', 'owner', ${NOW}, ${NOW})`, /CHECK/);
  rejects("a session needs an existing user", `INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES ('s', 'ghost', ${NOW}, ${NOW}, ${NOW})`, /FOREIGN KEY/);

  // cascades
  db.exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES ('u9', 'cascade@example.com', 'C', 'h', ${NOW}, ${NOW});
           INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at) VALUES ('sess9', 'u9', ${NOW}, ${NOW}, ${NOW});
           INSERT INTO audit_logs (id, user_id, user_email, action, entity_type, summary, created_at) VALUES ('a9', 'u9', 'cascade@example.com', 'update', 'service', 'edited', ${NOW});
           UPDATE media SET uploaded_by = 'u9' WHERE id = 'media_logo'`);
  db.exec("DELETE FROM users WHERE id = 'u9'");
  check("deleting a user removes their sessions", one("SELECT COUNT(*) n FROM sessions WHERE id = 'sess9'").n === 0);
  check("deleting a user keeps the audit entry (user cleared, e-mail kept)", (() => { const r = one("SELECT user_id, user_email FROM audit_logs WHERE id = 'a9'"); return r.user_id === null && r.user_email === "cascade@example.com"; })());
  check("deleting a user keeps the media they uploaded", one("SELECT uploaded_by FROM media WHERE id = 'media_logo'").uploaded_by === null);
  const before = { img: one("SELECT COUNT(*) n FROM case_study_images WHERE case_study_id = 'case_fold'").n, link: one("SELECT COUNT(*) n FROM service_case_studies WHERE case_study_id = 'case_fold'").n };
  db.exec("DELETE FROM case_studies WHERE id = 'case_fold'");
  check("deleting a case study removes its images and its service links", before.img === 5 && before.link === 2 && one("SELECT COUNT(*) n FROM case_study_images WHERE case_study_id = 'case_fold'").n === 0 && one("SELECT COUNT(*) n FROM service_case_studies WHERE case_study_id = 'case_fold'").n === 0, JSON.stringify(before));
  check("...and left the media files alone", one("SELECT COUNT(*) n FROM media WHERE slug = 'cases-fold'").n === 1);
  db.exec(`INSERT INTO blog_tags (id, slug, title, created_at, updated_at) VALUES ('tag1', 'systems', 'Systems', ${NOW}, ${NOW});
           INSERT INTO blog_post_tags (post_id, tag_id) VALUES ('post_webflow-or-next-js', 'tag1')`);
  check("a post can have tags (join table works)", (await cms.getBlogTagsForPost(d1, "webflow-or-next-js")).join() === "Systems");
  rejects("the same tag cannot be added twice to a post", "INSERT INTO blog_post_tags (post_id, tag_id) VALUES ('post_webflow-or-next-js', 'tag1')", /UNIQUE/);
  db.exec("DELETE FROM blog_tags WHERE id = 'tag1'");
  check("deleting a tag removes only the link", one("SELECT COUNT(*) n FROM blog_post_tags").n === 0 && one("SELECT COUNT(*) n FROM blog_posts").n === 6);
  db.exec("DELETE FROM navigation_items WHERE id = 'nav_footer_services'");
  check("deleting a menu group removes its links", one("SELECT COUNT(*) n FROM navigation_items WHERE parent_id = 'nav_footer_services'").n === 0 && one("SELECT COUNT(*) n FROM navigation_items WHERE menu = 'footer'").n === 13);
  db.exec(`UPDATE services SET status = 'published', published_at = ${NOW} WHERE id = 't1'`);
  check("a draft becomes published once it has a publish date", one("SELECT status FROM services WHERE id = 't1'").status === "published");
  db.exec("DELETE FROM services WHERE id = 't1'");
}

// ---- media: what the upload code accepts, and where pictures load from ------------------------------------------------
{
  const { sniffImage, MAX_BYTES } = await imp("src/lib/media/sniff.ts");
  const urls = await imp("src/lib/media/url.ts");
  const bytes = (...parts) => Uint8Array.from(parts.flat());
  const be32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const pngHeader = (w, h) => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), [0x49, 0x48, 0x44, 0x52], be32(w), be32(h), [8, 6, 0, 0, 0], be32(0));

  // every shipped picture is read from its own header and must agree with the seed (type and size)
  let files = 0;
  const bad = [];
  for (const m of db.prepare("SELECT slug, url, mime, width, height FROM media WHERE kind = 'image' AND storage = 'static'").all()) {
    const path = join(ROOT, "public", m.url);
    if (!existsSync(path)) { bad.push(m.slug + " (missing)"); continue; }
    const r = sniffImage(readFileSync(path));
    files++;
    if (!r.ok || r.image.mime !== m.mime || r.image.width !== m.width || r.image.height !== m.height) bad.push(m.slug + ": " + (r.ok ? `${r.image.mime} ${r.image.width}x${r.image.height} vs ${m.mime} ${m.width}x${m.height}` : r.error));
  }
  check(`the file headers of all ${files} shipped pictures give the same type and size as the seed`, files > 0 && bad.length === 0, bad.slice(0, 3).join("; "));

  const no = (name, input, re) => { const r = sniffImage(input); check(name, !r.ok && re.test(r.error), r.ok ? "accepted" : r.error); };
  no("an empty file is refused", new Uint8Array(0), /empty/);
  no("plain text named like a picture is refused", new TextEncoder().encode("hello, I am not a picture"), /not a supported picture/);
  no("an SVG is refused (it can carry script)", new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), /SVG/);
  no("HTML is refused", new TextEncoder().encode("<html><body><script>alert(1)</script></body></html>"), /not a supported picture/);
  no("a PNG cut off after its signature is refused", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), /damaged|incomplete/);
  no("a picture with no size is refused", pngHeader(0, 0), /no size/);
  no("a side longer than 12000 px is refused", pngHeader(13000, 10), /too large/);
  no("more than 100 megapixels is refused", pngHeader(11000, 11000), /too many pixels/);
  check("a valid PNG header is read (640x480)", (() => { const r = sniffImage(pngHeader(640, 480)); return r.ok && r.image.mime === "image/png" && r.image.ext === "png" && r.image.width === 640 && r.image.height === 480; })());
  check("GIF and JPEG headers are read", (() => {
    const g = sniffImage(bytes([...new TextEncoder().encode("GIF89a"), 20, 0, 10, 0, 0, 0, 0]));
    const j = sniffImage(bytes([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 100, 0, 200, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]));
    return g.ok && g.image.width === 20 && g.image.height === 10 && j.ok && j.image.mime === "image/jpeg" && j.image.width === 200 && j.image.height === 100;
  })());
  check("a JPEG turned by EXIF (orientation 6) reports width and height swapped", (() => {
    const exif = [...new TextEncoder().encode("Exif"), 0, 0, 0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0];
    const j = sniffImage(bytes([0xff, 0xd8], [0xff, 0xe1, 0, exif.length + 2], exif, [0xff, 0xc0, 0, 17, 8, 0, 100, 0, 200, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]));
    return j.ok && j.image.width === 100 && j.image.height === 200;
  })());
  check("an AVIF header is read (ispe box, 320x200) and a WebP header too", (() => {
    const a = sniffImage(bytes(be32(24), [...new TextEncoder().encode("ftypavif")], [0, 0, 0, 0], [...new TextEncoder().encode("avifmif1")], be32(20), [...new TextEncoder().encode("ispe")], [0, 0, 0, 0], be32(320), be32(200)));
    const lossless = sniffImage(bytes([...new TextEncoder().encode("RIFF"), 0, 0, 0, 0], [...new TextEncoder().encode("WEBPVP8L")], [0, 0, 0, 0], [0x2f], [0x3f, 0xc1, 0x31, 0x00])); // VP8L: (320 - 1) and (200 - 1) packed in 14 bits each
    return a.ok && a.image.mime === "image/avif" && a.image.width === 320 && a.image.height === 200 && lossless.ok && lossless.image.mime === "image/webp" && lossless.image.width === 320 && lossless.image.height === 200;
  })());
  check("the size limit is 10 MB", MAX_BYTES === 10 * 1024 * 1024);

  urls.configureMedia("", "0");
  check("without a media domain an upload keeps its own path, shipped files too", urls.publicMediaUrl("/media/uploads/2026/10/a.webp") === "/media/uploads/2026/10/a.webp" && urls.publicMediaUrl("/assets/cases/orbit.webp") === "/assets/cases/orbit.webp");
  urls.configureMedia("https://media.example.com/", "0");
  check("with a media domain uploads load from it; shipped files do not move", urls.publicMediaUrl("/media/uploads/2026/10/a.webp") === "https://media.example.com/uploads/2026/10/a.webp" && urls.publicMediaUrl("/assets/cases/orbit.webp") === "/assets/cases/orbit.webp");
  urls.configureMedia("http://insecure.example.com", "0");
  check("a media domain that is not https is ignored", urls.publicMediaUrl("/media/uploads/a.webp") === "/media/uploads/a.webp");
  urls.configureMedia("https://media.example.com", "1");
  check("image transformations (when enabled) go through /cdn-cgi/image", urls.transformUrl("/media/uploads/a.webp", { width: 360 }) === "/cdn-cgi/image/width=360,quality=82,format=auto,fit=scale-down/https://media.example.com/uploads/a.webp");
  urls.configureMedia("", "0");
  check("transformations off: the original address", urls.transformUrl("/media/uploads/a.webp", { width: 360 }) === "/media/uploads/a.webp");
}

if (!readOnly) {
  const NOW = "'2026-10-05T00:00:00.000Z'";
  const ins = (sha) => `INSERT INTO media (id, slug, title, kind, mime, storage, url, r2_key, width, height, bytes, created_at, updated_at${sha ? ", sha256" : ""}) VALUES ('mx', 'mx', 'x', 'image', 'image/webp', 'r2', '/media/uploads/2026/10/x.webp', 'uploads/2026/10/x.webp', 10, 10, 100, ${NOW}, ${NOW}${sha ? ", " + sha : ""})`;
  rejects("a media fingerprint must be 64 characters", ins("'abc'"), /CHECK/);
  db.exec(ins(`'${"a".repeat(64)}'`));
  check("an uploaded picture row keeps its object key and has caption and fingerprint columns", one("SELECT r2_key FROM media WHERE id = 'mx'").r2_key === "uploads/2026/10/x.webp" && one("SELECT caption c FROM media WHERE id = 'mx'").c === "" && one("SELECT sha256 s FROM media WHERE id = 'mx'").s.length === 64);
  db.exec("DELETE FROM media WHERE id = 'mx'");
}

console.log(`\n${pass}/${pass + fail} checks passed${fail ? ` — ${fail} FAILED` : ""}`);
process.exit(fail ? 1 : 0);
