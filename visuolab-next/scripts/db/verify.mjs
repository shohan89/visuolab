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
check("extra tables are only the join tables and helpers", tables.filter((t) => !WANTED.includes(t) && !/^(sqlite_|_cf_|d1_migrations)/.test(t)).sort().join(",") === "app_meta,entity_hidden_sections,entity_section_revisions,integration_events,page_section_refs,page_section_revisions,page_section_types,page_sections,page_templates,pages,rate_limits,service_case_studies,slug_redirects", tables.filter((t) => !WANTED.includes(t) && !/^(sqlite_|_cf_|d1_migrations)/.test(t)).sort().join(","));
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
const expectCount = { media: 28, case_studies: 8, case_study_images: 40, services: 4, service_case_studies: 12, blog_categories: 5, blog_posts: 6, blog_tags: 0, blog_post_tags: 0, site_settings: 27, navigation_items: 45, integrations: 3 };
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
same("getCaseStudies() = the eight case studies (every field, in /works order)", (await cms.getCaseStudies(d1)).map((c) => Object.fromEntries(Object.entries(c).filter(([k]) => k !== "publishedAtIso" && k !== "updatedAtIso"))), worksOrder.map((s) => caseStudies.find((c) => c.slug === s)));
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
same("navigation: footer columns", nav.footer, navData.footerGroups.map((g) => ({ label: g.label, links: g.links.map((l) => ({ label: l.label, href: l.href })) })));
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
  rejects("a link type outside internal/external/group is refused", `INSERT INTO navigation_items (id, menu, position, label, href, type, created_at, updated_at) VALUES ('n2', 'primary', 9, 'x', '/x', 'popup', ${NOW}, ${NOW})`, /CHECK/);
  rejects("visibility must be 0 or 1", `INSERT INTO navigation_items (id, menu, position, label, href, is_visible, created_at, updated_at) VALUES ('n2', 'primary', 9, 'x', '/x', 2, ${NOW}, ${NOW})`, /CHECK/);
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

// ---- notifications: delivery records, idempotency, and the email provider abstraction ------------------------------------------------
{
  const resendMod = await imp("src/lib/integrations/email/resend.ts");
  const reg = await imp("src/lib/integrations/email/registry.ts");
  const del = await imp("src/lib/integrations/email/delivery.ts");
  const types = await imp("src/lib/integrations/email/types.ts");
  const KEY = "re_TESTKEY_abcdefghijklmnopqrstuvwxyz";
  const msg = { from: "Visuolab <hello@visuolab.studio>", to: ["a@b.co", "c@d.co"], replyTo: "visitor@x.co", subject: "New enquiry from Ann", text: "Hello" };
  const fakeFetch = (handler) => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return handler(url, init); }; f.calls = calls; return f; };
  const respond = (status, body) => new Response(JSON.stringify(body ?? {}), { status, headers: { "content-type": "application/json" } });

  // the provider abstraction: one interface, a registry, and "none"
  check("the registry knows Resend, and the settings can also choose 'none'", reg.providerFor("resend")?.id === "resend" && reg.providerFor("none") === null && reg.providerFor("sendgrid") === null && types.EMAIL_PROVIDER_IDS.includes("none") && reg.listProviders().every((p) => typeof p.send === "function" && /^[A-Z][A-Z0-9_]+$/.test(p.secretName)));

  // Resend: exactly what it sends
  const ok = fakeFetch(() => respond(200, { id: "msg_123" }));
  const r1 = await resendMod.resend.send(msg, { apiKey: KEY, timeoutMs: 1000, fetchImpl: ok });
  const call = ok.calls[0];
  const sent = JSON.parse(call.init.body);
  check("Resend request: POST to /emails, the key only in the Authorization header, plain text, reply-to as the visitor", r1.ok && r1.messageId === "msg_123" && call.url === "https://api.resend.com/emails" && call.init.method === "POST" && call.init.headers.authorization === `Bearer ${KEY}` && !call.init.body.includes(KEY) && sent.reply_to === "visitor@x.co" && sent.to.length === 2 && sent.text === "Hello" && !("html" in sent));
  const proxied = fakeFetch(() => respond(200, {}));
  await resendMod.resend.send(msg, { apiKey: KEY, baseUrl: "https://mail-proxy.example.com/", timeoutMs: 1000, fetchImpl: proxied });
  check("a different base address (a proxy or test server) is used when configured", proxied.calls[0].url === "https://mail-proxy.example.com/emails");
  const noId = await resendMod.resend.send(msg, { apiKey: KEY, timeoutMs: 1000, fetchImpl: fakeFetch(() => new Response("ok", { status: 200 })) });
  check("an accepted message without a readable id is still accepted", noId.ok && noId.messageId === undefined);
  const classify = async (status) => resendMod.resend.send(msg, { apiKey: KEY, timeoutMs: 1000, fetchImpl: fakeFetch(() => respond(status, { message: `secret detail ${KEY}` })) });
  const [e401, e422, e429, e500] = await Promise.all([classify(401), classify(422), classify(429), classify(503)]);
  check("a bad key or rejected sender (4xx) is not retryable; rate limit and server errors are", !e401.ok && !e401.retryable && !e422.ok && !e422.retryable && !e429.ok && e429.retryable && !e500.ok && e500.retryable);
  check("the stored reason is short and never contains the provider's answer or the key", [e401, e422, e429, e500].every((r) => !r.ok && /^mail provider answered \d{3}$/.test(r.reason) && !r.reason.includes(KEY)));
  const slow = await resendMod.resend.send(msg, { apiKey: KEY, timeoutMs: 30, fetchImpl: (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))) });
  check("a provider that does not answer in time is a retryable 'timeout' (the request is abandoned)", !slow.ok && slow.reason === "timeout" && slow.retryable);
  const down = await resendMod.resend.send(msg, { apiKey: KEY, timeoutMs: 1000, fetchImpl: async () => { throw new TypeError("fetch failed " + KEY); } });
  check("a network failure is a retryable failure whose reason carries nothing from the error", !down.ok && down.retryable && down.reason === "could not reach the mail provider");

  // the delivery step: any provider, one outcome shape; it never throws
  const fake = { id: "fakemail", label: "Fake", secretName: "FAKE_KEY", send: async (m, c) => (c.apiKey === "good" ? { ok: true, messageId: "fm_1" } : { ok: false, retryable: false, reason: "rejected" }) };
  const o1 = await del.attempt(fake, "good", msg);
  const o2 = await del.attempt(fake, "bad", msg);
  const o3 = await del.attempt({ ...fake, send: async () => { throw new Error("provider bug"); } }, "good", msg);
  check("another provider plugs in without any other change (sent, failed, and a throwing provider)", o1.status === "sent" && o1.provider === "fakemail" && o1.messageId === "fm_1" && o2.status === "failed" && o2.error === "rejected" && o2.retryable === false && o3.status === "failed" && o3.error === "mail provider error");
  check("skipped outcomes carry their reason; the admin wording is clear for each state", del.skipped("not configured").status === "skipped" && del.describe("sent", null) === "Notification sent" && /API key is not set/.test(del.describe("skipped", "not configured")) && /switched off/.test(del.describe("skipped", "disabled")) && /spam/.test(del.describe("skipped", "spam")) && /did not answer in time/.test(del.describe("failed", "timeout")) && /answered 500/.test(del.describe("failed", "mail provider answered 500")) && /not sent yet/.test(del.describe("pending", null)));

  // the database: columns, idempotency, checks, and the migration of existing rows
  if (!readOnly) {
    const NOW = "'2026-10-05T00:00:00.000Z'";
    const ins = (id, extra = "", vals = "") => `INSERT INTO contact_submissions (id, name, email, message, created_at, updated_at${extra}) VALUES ('${id}', 'n', 'n@x.co', 'a message', ${NOW}, ${NOW}${vals})`;
    db.exec(ins("n1", ", idempotency_key", ", '11111111-1111-4111-8111-111111111111'"));
    rejects("the same idempotency key cannot be stored twice (unique index)", ins("n2", ", idempotency_key", ", '11111111-1111-4111-8111-111111111111'"), /UNIQUE/);
    db.exec(ins("n3")); db.exec(ins("n4"));
    check("rows without a key (older enquiries, scripted posts) are not affected by the unique index", one("SELECT COUNT(*) n FROM contact_submissions WHERE id IN ('n3', 'n4')").n === 2);
    rejects("an idempotency key must be 16 to 64 characters", ins("n5", ", idempotency_key", ", 'short'"), /CHECK/);
    rejects("a content fingerprint must be 32 characters", ins("n6", ", content_hash", ", 'abc'"), /CHECK/);
    rejects("a notification status must be one of pending, sent, failed, skipped", ins("n7", ", notify_status", ", 'maybe'"), /CHECK/);
    check("a new enquiry starts as pending with no attempts", one("SELECT notify_status s, notify_attempts a FROM contact_submissions WHERE id = 'n3'").s === "pending" && one("SELECT notify_attempts a FROM contact_submissions WHERE id = 'n3'").a === 0);
    db.exec("DELETE FROM contact_submissions WHERE id LIKE 'n_'");
    check("the enquiry stored before delivery tracking (legacy row) becomes pending with 0 attempts", one("SELECT notify_status s FROM contact_submissions WHERE id = 'legacy-1'").s === "pending");
    check("indexes exist for the status filter, the key and the fingerprint", ["idx_contact_notify", "uq_contact_idempotency", "idx_contact_content_hash"].every((n) => one("SELECT COUNT(*) n FROM sqlite_master WHERE type = 'index' AND name = ?", n).n === 1));

    // migrate rows that existed before: build a database at migration 0012, add rows, apply 0013
    const old = new DatabaseSync(":memory:");
    for (const f of migrations.filter((m) => m < "0013")) {
      if (f.startsWith("0008")) old.exec("INSERT INTO submissions (id, name, email, message, status, source, created_at, updated_at) VALUES ('legacy-1', 'Old Row', 'old@example.com', 'sent before the rename', 'read', 'contact-page', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')");
      old.exec(readFileSync(join(ROOT, "migrations", f), "utf8"));
    }
    const at = "'2026-01-01T00:00:00.000Z'";
    const row = (id, status, notified, error) => `INSERT INTO contact_submissions (id, name, email, message, status, notified_at, notify_error, created_at, updated_at) VALUES ('${id}', 'n', 'n@x.co', 'm', '${status}', ${notified ? at : "NULL"}, ${error ? `'${error}'` : "NULL"}, ${at}, ${at})`;
    old.exec([row("a-sent", "new", true, null), row("b-spam", "spam", false, null), row("c-notcfg", "new", false, "not configured"), row("d-fail", "new", false, "mail provider answered 500"), row("e-none", "new", false, null)].join(";"));
    old.exec(readFileSync(join(ROOT, "migrations", "0013_notification_delivery.sql"), "utf8"));
    const s = Object.fromEntries(old.prepare("SELECT id, notify_status s, notify_attempts a FROM contact_submissions").all().map((r) => [r.id, `${r.s}/${r.a}`]));
    check("migration 0013 turns recorded results into statuses: sent, skipped (spam, not configured), failed, pending", s["a-sent"] === "sent/1" && s["b-spam"] === "skipped/0" && s["c-notcfg"] === "skipped/1" && s["d-fail"] === "failed/1" && s["e-none"] === "pending/0" && s["legacy-1"] === "pending/0", JSON.stringify(s));
  }
}

// ---- site settings: what may be stored, what the website starts with, and that no secret is ever a setting -------------------------
{
  const S = await imp("src/lib/settings/schema.ts");
  const mail = await imp("src/lib/mail/build.ts");
  const ok = (schema, v) => schema.safeParse(v).success;
  const msg = (schema, v) => { const r = schema.safeParse(v); return r.success ? "" : r.error.issues.map((i) => i.message).join(" | "); };

  // defaults = the values the site had before settings existed; each default passes its own schema
  check("every section's defaults pass its own schema", ok(S.generalSchema, S.DEFAULTS.general) && ok(S.contactSchema, S.DEFAULTS.contact) && ok(S.socialSchema, S.DEFAULTS.social) && ok(S.seoSchema, S.DEFAULTS.seo) && ok(S.analyticsSchema, S.DEFAULTS.analytics));
  const rows = Object.fromEntries(db.prepare("SELECT key, value_json FROM site_settings WHERE key LIKE 'settings.%'").all().map((r) => [r.key, JSON.parse(r.value_json)]));
  check("the five settings documents are seeded with the defaults", Object.keys(S.SETTINGS_KEYS).every((n) => JSON.stringify(rows[S.SETTINGS_KEYS[n]]) === JSON.stringify(S.DEFAULTS[n])));
  check("the default logos exist as media rows and the default e-mail is the one the pages had", one("SELECT COUNT(*) n FROM media WHERE id IN ('media_logo', 'media_logo-dark')").n === 2 && S.DEFAULTS.contact.email === "hello@visuolab.studio");

  // nothing secret in settings, in the seed or in the integrations table
  const everything = db.prepare("SELECT value_json v FROM site_settings UNION ALL SELECT config_json FROM integrations").all().map((r) => r.v).join("\n");
  check("no secret-looking value in any settings document or integration config", !S.looksLikeSecret(everything), (everything.match(/re_[A-Za-z0-9_]{16,}/) ?? [""])[0]);
  check("integration rows hold only the NAME of a secret", db.prepare("SELECT secret_name FROM integrations WHERE secret_name IS NOT NULL").all().every((r) => /^[A-Z][A-Z0-9_]+$/.test(r.secret_name)));
  check("the email integration is enabled with a provider, a sender and recipients as a list", (() => { const c = JSON.parse(one("SELECT config_json c FROM integrations WHERE slug = 'resend'").c); return one("SELECT status s FROM integrations WHERE slug = 'resend'").s === "enabled" && c.provider === "resend" && /@/.test(c.from) && Array.isArray(c.to) && c.to.length === 1; })());

  // secrets pasted into a field are refused, in every text field
  const SECRETS = ["re_123456789012345678901234567890", "sk_live_abcdefghijklmnop", "AKIAABCDEFGHIJKLMNOP", "Bearer abcdefghijklmnopqrstuvwxyz0123", "api_key = abcdef1234567890", "-----BEGIN PRIVATE KEY-----"];
  check("a Resend / Stripe / AWS / bearer / private key typed into any text field is refused", SECRETS.every((s) => /secret key/.test(msg(S.generalSchema, { ...S.DEFAULTS.general, description: s })) && /secret key/.test(msg(S.contactSchema, { ...S.DEFAULTS.contact, address: s })) && /secret key/.test(msg(S.seoSchema, { ...S.DEFAULTS.seo, defaultDescription: s })) && /secret key/.test(msg(S.emailSchema, { provider: "resend", from: s, to: ["a@b.co"], enabled: true }))));
  check("ordinary text is not mistaken for a secret", !S.looksLikeSecret("We design brands, websites and products. Call +31 20 123 4567 or write to hello@visuolab.studio.") && !S.looksLikeSecret("Mon–Fri 09:00–17:30"));

  // formats
  const bad = (label, schema, v, re) => check(label, !ok(schema, v) && re.test(msg(schema, v)), msg(schema, v));
  bad("a site name is required", S.generalSchema, { ...S.DEFAULTS.general, siteName: " " }, /required/);
  bad("angle brackets are refused in plain settings", S.generalSchema, { ...S.DEFAULTS.general, description: "<script>x</script>" }, /cannot contain/);
  bad("a media field accepts only a media id", S.generalSchema, { ...S.DEFAULTS.general, logo: "/etc/passwd" }, /media library/);
  bad("an invalid e-mail is refused", S.contactSchema, { ...S.DEFAULTS.contact, email: "not an email" }, /valid e-mail/);
  bad("a phone number with letters is refused", S.contactSchema, { ...S.DEFAULTS.contact, phone: "call me" }, /digits/);
  bad("an address longer than 5 lines is refused", S.contactSchema, { ...S.DEFAULTS.contact, address: "1\n2\n3\n4\n5\n6" }, /at most 5 lines/);
  bad("a social address must be https", S.socialSchema, { ...S.DEFAULTS.social, instagram: "http://instagram.com/x" }, /https/);
  bad("javascript: is refused as a profile", S.socialSchema, { ...S.DEFAULTS.social, x: "javascript:alert(1)" }, /https/);
  bad("a profile must be on its own network's domain", S.socialSchema, { ...S.DEFAULTS.social, linkedin: "https://evil.example/linkedin.com" }, /linkedin\.com/);
  bad("a look-alike host is refused (notinstagram.com)", S.socialSchema, { ...S.DEFAULTS.social, instagram: "https://notinstagram.com/x" }, /instagram\.com/);
  check("real profile addresses pass (www and subdomains too)", ok(S.socialSchema, { ...S.DEFAULTS.social, instagram: "https://www.instagram.com/visuolab", x: "https://twitter.com/visuolab", youtube: "https://youtu.be/abc", others: [{ label: "Dribbble", url: "https://dribbble.com/visuolab" }] }));
  bad("a robots path must start with /", S.seoSchema, { ...S.DEFAULTS.seo, disallow: ["private"] }, /starts with \//);
  bad("a robots path with spaces is refused", S.seoSchema, { ...S.DEFAULTS.seo, disallow: ["/a b"] }, /starts with \//);
  bad("a Google Analytics ID must look like G-XXXXXXXXXX", S.analyticsSchema, { ...S.DEFAULTS.analytics, ga4: "UA-1234-1" }, /G-XXXXXXXXXX/);
  bad("a Tag Manager ID must look like GTM-XXXXXXX", S.analyticsSchema, { ...S.DEFAULTS.analytics, gtm: "GTM-'; alert(1)//" }, /GTM-XXXXXXX/);
  bad("a Meta Pixel ID is digits only", S.analyticsSchema, { ...S.DEFAULTS.analytics, metaPixel: "12ab" }, /number/);
  bad("notification addresses must be valid and between 1 and 5", S.emailSchema, { provider: "resend", from: "a@b.co", to: [], enabled: true }, /at least one/);
  bad("the sender must be an address", S.emailSchema, { provider: "resend", from: "no address here", to: ["a@b.co"], enabled: true }, /From must be/);
  check("a named sender passes (Name <a@b.co>)", ok(S.emailSchema, { provider: "resend", from: "Visuolab <hello@visuolab.studio>", to: ["a@b.co", "c@d.co"], enabled: true }));

  // a stored document can never break a page: bad fields fall back to the default, good ones are kept
  const mixed = S.resolveSection("contact", { email: "new@visuolab.studio", phone: "call me", address: 42 });
  check("a damaged document keeps its valid fields and defaults the rest", mixed.email === "new@visuolab.studio" && mixed.phone === "" && mixed.address === "");
  check("a missing document gives the defaults", JSON.stringify(S.resolveSection("seo", undefined)) === JSON.stringify(S.DEFAULTS.seo) && JSON.stringify(S.resolveSection("social", "nonsense")) === JSON.stringify(S.DEFAULTS.social));

  // analytics: only on a real https site, snippets carry the ID and nothing else
  const on = { enabled: true, ga4: "G-ABC123DEF4", gtm: "", metaPixel: "" };
  check("analytics are off on localhost, over http and when switched off or empty", !S.analyticsActive("http://localhost:3001", on) && !S.analyticsActive("https://localhost", on) && !S.analyticsActive("http://visuolab.studio", on) && !S.analyticsActive("https://visuolab.studio", { ...on, enabled: false }) && !S.analyticsActive("https://visuolab.studio", { enabled: true, ga4: "", gtm: "", metaPixel: "" }));
  check("analytics are on for an enabled https site with an ID", S.analyticsActive("https://visuolab.studio", on));
  check("the snippets contain the ID and call the three providers' own hosts only", S.gtagSnippet("G-ABC123DEF4").includes("'config','G-ABC123DEF4'") && S.gtmSnippet("GTM-ABCD12").includes("googletagmanager.com/gtm.js") && S.gtmSnippet("GTM-ABCD12").endsWith("'GTM-ABCD12');") && S.pixelSnippet("1234567890").includes("fbq('init','1234567890')") && S.pixelSnippet("1234567890").includes("connect.facebook.net"));

  // the email that would be sent
  const en = mail.enquiryEmail({ from: "Visuolab <hello@visuolab.studio>", to: ["a@b.co", "c@d.co"] }, { id: "x1", name: "Ann\r\nBcc: evil@x.co", email: "ann@x.co", message: "Hi <b>there</b>" });
  check("the enquiry email goes from and to the configured addresses, reply-to is the visitor", en.from === "Visuolab <hello@visuolab.studio>" && en.to.length === 2 && en.replyTo === "ann@x.co");
  check("a visitor cannot inject headers through the name; the message stays plain text", !/[\r\n]/.test(en.subject) && /Hi <b>there<\/b>/.test(en.text) && !("html" in en));
  check("the email request never contains an API key", !/re_|Bearer|authorization/i.test(JSON.stringify(en)) && !/re_|Bearer/.test(JSON.stringify(mail.testEmail({ from: "a@b.co", to: ["c@d.co"] }, "Visuolab"))));
}

// ---- SEO utilities: metadata and structured data builders ----------------------------------------------------------------------------
{
  const M = await imp("src/lib/seo/metadata.ts");
  const J = await imp("src/lib/seo/jsonld.ts");
  const S = await imp("src/lib/settings/schema.ts");
  const site = { name: "Visuolab", ogImage: { src: "/assets/default-og.webp", alt: "Visuolab" }, twitterSite: "@visuolab" };
  const ok = (schema, v) => schema.safeParse(v).success;
  const msg = (schema, v) => { const r2 = schema.safeParse(v); return r2.success ? "" : r2.error.issues.map((i) => i.message).join(" | "); };
  const bad = (label, schema, v, re) => check(label, !ok(schema, v) && re.test(msg(schema, v)), msg(schema, v));

  check("plain() removes headline markup and collapses spaces; clip() shortens at a word boundary with an ellipsis, short text untouched", M.plain("A <em>calm</em>   headline") === "A calm headline" && M.clip("short text", 50) === "short text" && /^[^\s].*…$/.test(M.clip("one two three four five six seven eight nine ten", 25)) && M.clip("one two three four five six seven eight nine ten", 25).length <= 25);
  check("twitterHandle() reads @handle from x.com and twitter.com profiles only", M.twitterHandle("https://x.com/visuolab") === "@visuolab" && M.twitterHandle("https://twitter.com/visuolab/") === "@visuolab" && M.twitterHandle("https://evil.example/visuolab") === undefined && M.twitterHandle("https://x.com/") === undefined && M.twitterHandle("not a url") === undefined);
  check("absoluteUrl() resolves paths and keeps full addresses", M.absoluteUrl("https://v.studio/", "/blog/x") === "https://v.studio/blog/x" && M.absoluteUrl("https://v.studio", "https://cdn.example/a.webp") === "https://cdn.example/a.webp");

  const md = M.pageMetadata({ site, title: "Brand <em>identity</em> — Visuolab", description: "A description", path: "/services/brand-identity", image: { src: "/assets/hero.webp", alt: "Hero", width: 1200, height: 900 } });
  check("a page gets title, description, canonical, robots index/follow, Open Graph (website) and a large Twitter card with the site handle", md.title === "Brand identity — Visuolab" && md.description === "A description" && md.alternates.canonical === "/services/brand-identity" && md.robots.index === true && md.robots.follow === true && md.openGraph.type === "website" && md.openGraph.url === "/services/brand-identity" && md.openGraph.siteName === "Visuolab" && md.openGraph.locale === "en_GB" && md.twitter.card === "summary_large_image" && md.twitter.site === "@visuolab" && md.twitter.title === md.openGraph.title);
  check("the share picture carries its size and description; without one the default is used, and without both the card is 'summary'", md.openGraph.images[0].width === 1200 && md.openGraph.images[0].height === 900 && md.openGraph.images[0].alt === "Hero" && M.pageMetadata({ site, title: "T", description: "D", path: "/x" }).openGraph.images[0].url === "/assets/default-og.webp" && M.pageMetadata({ title: "T", description: "D", path: "/x" }).twitter.card === "summary" && !("images" in M.pageMetadata({ title: "T", description: "D", path: "/x" }).openGraph));
  const art = M.pageMetadata({ site, title: "T", description: "D", path: "/blog/a", canonical: "https://orig.example/a", keywords: ["a", "b"], noindex: true, article: { publishedTime: "2026-01-01T00:00:00.000Z", modifiedTime: "2026-02-01T00:00:00.000Z", authors: ["Ann"], section: "Brand" } });
  check("an article: og:type article with times, author and section; a custom canonical wins; keywords; noindex when asked", art.openGraph.type === "article" && art.openGraph.publishedTime === "2026-01-01T00:00:00.000Z" && art.openGraph.modifiedTime === "2026-02-01T00:00:00.000Z" && art.openGraph.authors[0] === "Ann" && art.openGraph.section === "Brand" && art.alternates.canonical === "https://orig.example/a" && art.openGraph.url === "https://orig.example/a" && art.keywords.length === 2 && art.robots.index === false && art.robots.follow === false);

  // JSON-LD
  const SU = "https://visuolab.studio";
  const org = J.organizationNode(SU, { general: { siteName: "Visuolab", description: "Desc", logoUrl: "/assets/logo.png" }, contact: { email: "hello@visuolab.studio", phone: "", address: "A\nB", hours: "Mon–Fri" }, social: { instagram: "", facebook: "https://facebook.com/v", linkedin: "", x: "", youtube: "", others: [{ url: "https://dribbble.com/v" }] } });
  check("Organization: id, name, logo (absolute), contact facts, sameAs; empty fields are left out", org["@type"] === "Organization" && org["@id"] === `${SU}/#organization` && org.logo.url === `${SU}/assets/logo.png` && org.address.streetAddress === "A, B" && org.sameAs.length === 2 && !("telephone" in org));
  const web = J.websiteNode(SU, { general: { siteName: "Visuolab", description: "Desc" } });
  check("WebSite: id, url, name, language, published by the organization (no SearchAction: the site has no search)", web["@type"] === "WebSite" && web.publisher["@id"] === `${SU}/#organization` && web.inLanguage === "en-GB" && !("potentialAction" in web));
  const bc = J.breadcrumbNode(SU, "Visuolab", [{ name: "Works", path: "/works" }, { name: "Orbit <em>app</em>", path: "/works/orbit" }], "/works/orbit");
  check("BreadcrumbList: Home first, positions 1..n, absolute addresses, markup removed from names", bc.itemListElement.length === 3 && bc.itemListElement.map((i) => i.position).join() === "1,2,3" && bc.itemListElement[0].item === `${SU}/` && bc.itemListElement[1].item === `${SU}/works` && bc.itemListElement[2].name === "Orbit app");
  const svc = J.serviceNode(SU, { name: "Brand identity", slug: "brand-identity", description: "D", image: "/assets/a.webp", offers: ["Naming", "Guidelines"] });
  check("Service: provider is the organization, address, image, offer catalog from what is included", svc["@type"] === "Service" && svc.provider["@id"] === `${SU}/#organization` && svc.url === `${SU}/services/brand-identity` && svc.hasOfferCatalog.itemListElement.length === 2 && svc.hasOfferCatalog.itemListElement[0].itemOffered.name === "Naming");
  const ar = J.articleNode(SU, { type: "BlogPosting", path: "/blog/x", headline: "H".repeat(200), description: "D", published: "2026-01-01T00:00:00.000Z", modified: "2026-02-01T00:00:00.000Z", authorName: "Ann", keywords: ["a", "b"], canonical: "https://orig.example/x" });
  check("Article / BlogPosting: dates, author as Person, publisher, headline limited to 110 characters, original address as mainEntityOfPage", ar["@type"] === "BlogPosting" && ar.headline.length === 110 && ar.author["@type"] === "Person" && ar.publisher["@id"] === `${SU}/#organization` && ar.mainEntityOfPage === "https://orig.example/x" && ar.keywords === "a, b" && ar.datePublished && ar.dateModified);
  check("a case study is an Article about its client, authored by the organization", (() => { const n = J.articleNode(SU, { type: "Article", path: "/works/orbit", headline: "H", description: "D", about: "Orbit" }); return n["@type"] === "Article" && n.about.name === "Orbit" && n.author["@id"] === `${SU}/#organization` && !("datePublished" in n); })());
  const col = J.collectionNode(SU, { path: "/blog", name: "Blog", description: "D", items: [{ name: "A", path: "/blog/a" }, { name: "B", path: "/blog/b" }] });
  check("CollectionPage lists its items with positions", col["@type"] === "CollectionPage" && col.mainEntity.itemListElement.length === 2 && col.mainEntity.itemListElement[1].url === `${SU}/blog/b`);
  check("AboutPage and ContactPage nodes refer to the website and the organization", ["AboutPage", "ContactPage"].every((t) => { const n = J.pageNode(SU, { type: t, path: "/x", name: "N", description: "D" }); return n["@type"] === t && n.isPartOf["@id"] === `${SU}/#website` && n.about["@id"] === `${SU}/#organization`; }));
  const hostile = J.jsonLdScript([J.articleNode(SU, { type: "Article", path: "/x", headline: "</script><script>alert(1)</script>", description: "a" + String.fromCharCode(0x2028) + "b" })]);
  check("serialised structured data can never close its script tag or break it, and still parses back to the same text", !hostile.includes("</script") && !hostile.includes("<script") && !hostile.includes(String.fromCharCode(0x2028)) && JSON.parse(hostile)["@graph"][0].headline.startsWith("</script>"));
  check("a list of nodes becomes one @graph document with one @context", JSON.parse(J.jsonLdScript([org, web]))["@graph"].length === 2 && JSON.parse(J.jsonLdScript(org))["@context"] === "https://schema.org");

  // page metadata settings
  check("the SEO settings carry the five fixed pages' titles and descriptions as they were hard-coded, and every default passes", S.SEO_PAGES.join() === "home,about,works,blog,contact" && S.SEO_PAGES.every((k) => S.DEFAULTS.seo.pages[k].title.length > 3 && S.DEFAULTS.seo.pages[k].description.length >= 20 && S.DEFAULTS.seo.pages[k].noindex === false) && ok(S.seoSchema, S.DEFAULTS.seo));
  const partial = S.resolveSection("seo", { pages: { about: { title: "About us" } } });
  check("a stored SEO document with only some pages or fields is completed page by page from the defaults", partial.pages.about.title === "About us" && partial.pages.about.description === S.DEFAULTS.seo.pages.about.description && partial.pages.home.title === S.DEFAULTS.seo.pages.home.title);
  bad("a page title is required and limited to 70 characters; a description needs 20", S.seoSchema, { ...S.DEFAULTS.seo, pages: { ...S.DEFAULTS.seo.pages, home: { title: "", description: "short", noindex: false } } }, /required|at least|too/i);
  check("a page description that looks like a secret key is refused", /secret key/.test(msg(S.seoSchema, { ...S.DEFAULTS.seo, pages: { ...S.DEFAULTS.seo.pages, blog: { title: "Blog", description: "re_123456789012345678901234567890 is the key", noindex: false } } })));
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

// ---- integration layer: states, catalog, settings checks, outgoing messages ---------------------------------------------------------------
{
  const C = await imp("src/lib/integrations/core.ts");
  const O = await imp("src/lib/integrations/outbound.ts");
  check("the catalog lists the eight integrations once each: GA4, GTM, Meta Pixel, email, Turnstile, webhook, CRM webhook, Slack", C.CATALOG.map((d) => d.slug).join() === C.SLUGS.join() && C.SLUGS.length === 8 && new Set(C.SLUGS).size === 8);
  check("every integration has a label, summary, effect, test description and a settings schema; the outgoing ones start with a default that passes it", C.CATALOG.every((d) => d.label && d.summary && d.effect && d.testLabel && typeof d.schema.safeParse === "function") && ["webhook", "crm_webhook", "slack"].every((s) => C.catalogEntry(s).schema.safeParse(C.defaultConfig(s)).success));
  check("the four states are worded Connected, Disconnected, Configuration required, Error", C.STATE_LABEL.connected === "Connected" && C.STATE_LABEL.disconnected === "Disconnected" && C.STATE_LABEL.configuration_required === "Configuration required" && C.STATE_LABEL.error === "Error");
  const st = (enabled, problems, lastError = null) => C.deriveState({ enabled, problems, lastError }).state;
  check("state rules: off is Disconnected whatever is missing; on with something missing is Configuration required; on and complete is Connected; on, complete and the last run failed is Error", st(false, ["x"], "boom") === "disconnected" && st(true, ["x"], "boom") === "configuration_required" && st(true, []) === "connected" && st(true, [], "answered 500") === "error");
  check("the reasons say what is wrong: the missing items, or the last failure", C.deriveState({ enabled: true, problems: ["a", "b"], lastError: null }).reasons.join() === "a,b" && C.deriveState({ enabled: true, problems: [], lastError: "timeout" }).reasons[0] === "timeout");
  const slack = C.catalogEntry("slack");
  const none = { secretsSet: {}, siteIsHttps: true };
  check("a switched-on Slack integration without its Cloudflare secret needs configuration and names the secret; with it, nothing is missing", C.problemsFor(slack, { events: ["contact.submitted"] }, none).join().includes("SLACK_WEBHOOK_URL is not set") && C.problemsFor(slack, { events: ["contact.submitted"] }, { secretsSet: { SLACK_WEBHOOK_URL: true }, siteIsHttps: true }).length === 0);
  check("an optional secret (the webhook signing key) is never required; with no event chosen the webhook needs configuration", C.problemsFor(C.catalogEntry("webhook"), { events: ["contact.submitted"] }, { secretsSet: { WEBHOOK_URL: true }, siteIsHttps: true }).length === 0 && C.problemsFor(C.catalogEntry("webhook"), { events: [] }, { secretsSet: { WEBHOOK_URL: true }, siteIsHttps: true }).join().includes("event"));
  check("an unusable secret value is reported; analytics also needs a public https site address", C.problemsFor(slack, { events: ["contact.submitted"] }, { secretsSet: { SLACK_WEBHOOK_URL: true }, secretProblems: { SLACK_WEBHOOK_URL: "Cloudflare secret SLACK_WEBHOOK_URL must start with https://" }, siteIsHttps: true }).length === 1 && C.problemsFor(C.catalogEntry("ga4"), { id: "G-ABCDEF1234" }, { secretsSet: {}, siteIsHttps: false }).join().includes("SITE_URL"));
  const pc = (slug, raw) => C.parseConfig(C.catalogEntry(slug), raw);
  check("analytics IDs: wrong shapes and an injection attempt are refused with the expected format; right shapes pass", !pc("ga4", { id: "UA-1" }).ok && /G-XXXXXXXXXX/.test(pc("ga4", { id: "UA-1" }).errors.id) && !pc("gtm", { id: "GTM-'; alert(1)//" }).ok && !pc("meta_pixel", { id: "abc" }).ok && pc("ga4", { id: "G-ABC123DEF4" }).ok && pc("meta_pixel", { id: "1234567890123456" }).ok && pc("gtm", { id: "" }).ok);
  check("email settings: a sender that is not an address, no recipient, or more than 5 are refused; a normal setup passes and addresses are lower-cased", !pc("resend", { provider: "resend", from: "nope", to: ["a@b.co"] }).ok && !pc("resend", { provider: "resend", from: "a@b.co", to: [] }).ok && !pc("resend", { provider: "resend", from: "a@b.co", to: Array.from({ length: 6 }, (_, i) => `u${i}@b.co`) }).ok && pc("resend", { provider: "resend", from: "Visuolab <hello@b.co>", to: ["Owner@B.co"] }).config.to[0] === "owner@b.co");
  check("a webhook's events are limited to the known ones and de-duplicated", !pc("slack", { events: ["nope"] }).ok && pc("slack", { events: ["contact.submitted", "contact.submitted"] }).config.events.length === 1);
  check("a pasted key or webhook address is refused as a setting (it belongs in Cloudflare secrets)", !pc("turnstile", { siteKey: "re_abcdefghijklmnopqrstuvwx" }).ok && !C.looksSecret("0x4AAAAAAAabc") && C.looksSecret("https://hooks.slack.com/services/T000/B000/XXXX") && C.looksSecret("https://crm.example.com/hook?token=abc") && C.looksSecret("xoxb-1234567890-abc"));

  const A = { allowInsecure: false };
  check("webhook addresses: https only, no login in the address, no local or private hosts, Slack only on slack.com", O.addressProblem("https://example.com/hook", A) === null && O.addressProblem("http://example.com/hook", A) !== null && O.addressProblem("https://user:pw@example.com/", A) !== null && ["https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x", "https://192.168.1.1/x", "https://169.254.169.254/x", "https://db.internal/x", "https://[::1]/x"].every((u) => O.addressProblem(u, A) !== null) && O.addressProblem("https://hooks.slack.com/services/T/B/X", { hosts: ["slack.com"] }) === null && O.addressProblem("https://evil.example.com/", { hosts: ["slack.com"] }) !== null && O.addressProblem("not a url") !== null);
  check("development override: with allowInsecure an http or local address is accepted (never set in production)", O.addressProblem("http://127.0.0.1:4300/hook", { allowInsecure: true }) === null && O.addressProblem("ftp://x", { allowInsecure: true }) !== null);

  const enquiry = { id: "sub_1", name: "Ann <b>Lee</b>", email: "ann@x.co", company: "Acme & Co", service: "Web", budget: "20k", message: "Hi <!channel> see <https://evil.example|click> & more", createdAt: "2026-10-05T10:00:00.000Z" };
  const ev = { event: "contact.submitted", id: "sub_1:contact.submitted", createdAt: enquiry.createdAt, siteName: "Visuolab", data: enquiry };
  const sm = O.slackMessage(ev).text;
  check("Slack message: visitor text cannot become markup, a mention or a link (& < > are escaped), long text is cut", !/<!channel>|<https:/.test(sm) && sm.includes("&lt;!channel&gt;") && sm.includes("Acme &amp; Co") && O.slackMessage({ ...ev, data: { ...enquiry, message: "x".repeat(3000) } }).text.length < 800);
  const wb = O.webhookBody(ev), crm = O.crmBody(ev);
  check("webhook body is stable (event, id, createdAt, site, data); CRM body is a flat lead", wb.event === "contact.submitted" && wb.id === "sub_1:contact.submitted" && wb.site === "Visuolab" && wb.data.email === "ann@x.co" && crm.lead.email === "ann@x.co" && crm.lead.need === "Web" && crm.lead.source === "website contact form");
  const sig = await O.sign("topsecret", "1700000000", '{"a":1}');
  check("the signature is HMAC-SHA256 of timestamp.body (hex, 64 characters) and changes with the secret and the body", /^[0-9a-f]{64}$/.test(sig) && sig === (await import("node:crypto")).createHmac("sha256", "topsecret").update('1700000000.{"a":1}').digest("hex") && sig !== await O.sign("other", "1700000000", '{"a":1}') && sig !== await O.sign("topsecret", "1700000000", '{"a":2}'));

  const seen = [];
  const fake = (status) => async (url, init) => { seen.push({ url, init }); return new Response("secret answer text", { status }); };
  const t0 = { slug: "webhook", url: "https://hooks.example.com/in", secret: "topsecret" };
  const ok1 = await O.sendEvent(t0, ev, { fetchImpl: fake(200), now: () => 1700000000000 });
  const h1 = seen[0].init.headers;
  check("a webhook send: POST JSON with event, delivery id, timestamp and signature headers; the signing secret is not in the body; redirects are not followed", ok1.ok && seen[0].init.method === "POST" && h1["x-visuolab-event"] === "contact.submitted" && h1["x-visuolab-delivery"] === "sub_1:contact.submitted" && h1["x-visuolab-timestamp"] === "1700000000" && /^sha256=[0-9a-f]{64}$/.test(h1["x-visuolab-signature"]) && !seen[0].init.body.includes("topsecret") && seen[0].init.redirect === "manual");
  seen.length = 0;
  await O.sendEvent({ slug: "crm_webhook", url: "https://crm.example.com/h", token: "tok123" }, ev, { fetchImpl: fake(200) });
  const crmReq = seen[0];
  seen.length = 0;
  await O.sendEvent({ slug: "slack", url: "https://hooks.slack.com/services/T/B/X" }, ev, { fetchImpl: fake(200) });
  check("a CRM send carries the token only as a Bearer header; Slack gets {text} and no signature", crmReq.init.headers.authorization === "Bearer tok123" && !crmReq.init.body.includes("tok123") && JSON.parse(seen[0].init.body).text.includes("New enquiry") && !seen[0].init.headers["x-visuolab-signature"]);
  const f500 = await O.sendEvent(t0, ev, { fetchImpl: fake(500) }), f404 = await O.sendEvent(t0, ev, { fetchImpl: fake(404) }), f302 = await O.sendEvent(t0, ev, { fetchImpl: fake(302) });
  check("failures: 5xx and 429 are retryable, 4xx is not, a redirect is refused; the reason is short and never contains the receiver's answer or the address", !f500.ok && f500.retryable && f500.reason === "answered 500" && !f404.ok && !f404.retryable && !f302.ok && /redirects/.test(f302.reason) && ![f500, f404, f302].some((r) => /secret answer|hooks\.example/.test(JSON.stringify(r))));
  const down = await O.sendEvent(t0, ev, { fetchImpl: async () => { throw new TypeError("connect ECONNREFUSED hooks.example.com"); } });
  const slow = await O.sendEvent(t0, ev, { timeoutMs: 30, fetchImpl: (u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))) });
  check("an unreachable receiver and a receiver that does not answer in time are failed runs with short safe reasons (no host name leaks)", !down.ok && down.reason === "could not reach the address" && !slow.ok && slow.reason === "timeout");
}
check("integration_events exists (integration, event, status, http status, reason, duration, ref) and integrations has last_success_at", !!one("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'integration_events'") && ["integration", "event", "status", "http_status", "error", "duration_ms", "ref", "created_at"].every((c) => db.prepare("PRAGMA table_info(integration_events)").all().some((r) => r.name === c)) && db.prepare("PRAGMA table_info(integrations)").all().some((r) => r.name === "last_success_at"));
if (!readOnly) {
  rejects("an activity row with an unknown status is refused", "INSERT INTO integration_events (id, integration, event, status, created_at) VALUES ('e1', 'slack', 'x', 'weird', '2026-01-01')", /CHECK/);
  db.exec("INSERT INTO integration_events (id, integration, event, status, error, created_at) VALUES ('e2', 'slack', 'contact.submitted', 'failed', 'answered 500', '2026-01-01')");
  check("an activity row can be stored and read back", one("SELECT error FROM integration_events WHERE id = 'e2'").error === "answered 500");
  db.exec("DELETE FROM integration_events WHERE id = 'e2'");
}

console.log(`\n${pass}/${pass + fail} checks passed${fail ? ` — ${fail} FAILED` : ""}`);
process.exit(fail ? 1 : 0);
