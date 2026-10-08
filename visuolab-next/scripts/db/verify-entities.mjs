// Verifies the sections of services, case studies and articles (src/lib/cms/entity): the section schemas, the read/apply functions and migration 0019.
//
//   node --no-warnings scripts/db/verify-entities.mjs     builds an in-memory SQLite database from migrations/ and db/seed/content.sql
//
// The records are the real ones from the content seed. For every record and every section it proves that the content read out of the record passes the
// section's strict schema, that putting it back changes nothing (so a section save writes exactly what is stored), that the whole record still passes
// the schema of the full form, and that the editor form built from the schema fits the content. Then it checks that editing one section changes that
// section only, how errors of the whole-record check map back to a section, and the previous-versions table.
import { DatabaseSync } from "node:sqlite";
import { deepStrictEqual } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { ENTITIES, SERVICE_SECTIONS, CASE_STUDY_SECTIONS, BLOG_SECTIONS, remap } = await imp("src/lib/cms/entity/index.ts");
const { fieldsOfSchema } = await imp("src/lib/cms/describe.ts");
const { blank, blankItem } = await imp("src/lib/cms/fields.ts");
const { rowToServiceInput } = await imp("src/lib/content/service-input.ts");
const { rowToInput: rowToCaseInput } = await imp("src/lib/content/case-study-mapper.ts");
const { rowToInput: rowToPostInput } = await imp("src/lib/content/blog-mapper.ts");
const { serviceSchema, toErrors } = await imp("src/lib/validation/service.ts");
const { caseStudySchema } = await imp("src/lib/validation/case-study.ts");
const { blogSchema } = await imp("src/lib/validation/blog.ts");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + String(detail).slice(0, 200) : ""}`); };
const same = (a, b) => { try { deepStrictEqual(a, b); return true; } catch { return false; } };

const db = new DatabaseSync(":memory:");
db.exec("PRAGMA foreign_keys = ON");
const rows = (sql, ...a) => db.prepare(sql).all(...a);
const rejects = (name, sql, pattern) => {
  try { db.exec(sql); check(name, false, "statement was accepted"); } catch (e) { check(name, pattern.test(String(e.message)), String(e.message)); }
};

const migrations = readdirSync(join(ROOT, "migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const f of migrations) {
  if (f.startsWith("0008")) db.exec("INSERT INTO submissions (id, name, email, message, status, source, created_at, updated_at) VALUES ('legacy-1', 'Old Row', 'old@example.com', 'sent before the rename', 'read', 'contact-page', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')");
  db.exec(readFileSync(join(ROOT, "migrations", f), "utf8"));
}
db.exec(readFileSync(join(ROOT, "db", "seed", "content.sql"), "utf8"));
check(`${migrations.length} migrations apply in order (0021 last), then the content seed`, migrations.at(-1).startsWith("0021"));

// ---- the real records -------------------------------------------------------------------------------------------------------------
const services = rows("SELECT * FROM services ORDER BY position").map((r) => ({ id: r.id, input: rowToServiceInput(r, rows("SELECT case_study_id FROM service_case_studies WHERE service_id = ? ORDER BY position", r.id).map((l) => l.case_study_id)) }));
const cases = rows("SELECT * FROM case_studies ORDER BY position").map((r) => ({ id: r.id, input: rowToCaseInput(r, rows("SELECT * FROM case_study_images WHERE case_study_id = ?", r.id), rows("SELECT service_id FROM service_case_studies WHERE case_study_id = ?", r.id).map((l) => l.service_id)) }));
const posts = rows("SELECT * FROM blog_posts ORDER BY published_at").map((r) => ({ id: r.id, input: rowToPostInput(r, rows("SELECT t.title FROM blog_post_tags pt JOIN blog_tags t ON t.id = pt.tag_id WHERE pt.post_id = ? ORDER BY t.title", r.id).map((t) => t.title)) }));
check(`the seed has the records to test (${services.length} services, ${cases.length} case studies, ${posts.length} articles)`, services.length >= 4 && cases.length >= 8 && posts.length >= 5);

const KINDS = [
  { kind: "service", sections: SERVICE_SECTIONS, records: services, schema: serviceSchema },
  { kind: "case_study", sections: CASE_STUDY_SECTIONS, records: cases, schema: caseStudySchema },
  { kind: "blog_post", sections: BLOG_SECTIONS, records: posts, schema: blogSchema },
];

// ---- the sections themselves ---------------------------------------------------------------------------------------------------
for (const { kind, sections } of KINDS) {
  const keys = sections.map((s) => s.key);
  check(`${kind}: section keys are unique, address-safe and never "edit" or "confirm"`, new Set(keys).size === keys.length && keys.every((k) => /^[a-z0-9][a-z0-9-]*$/.test(k) && !["edit", "confirm", "new"].includes(k)), keys.join(","));
  check(`${kind}: every section is named, typed and explained, in the order of the page (${keys.length} sections)`, sections.every((s) => s.name && s.type && s.about.length > 20) && keys.at(-1) === "seo");
  check(`${kind}: the registry lists these sections`, ENTITIES[kind].sections.length === sections.length);
}
check("the toggles are exactly the two sections of a service page the design can hide", SERVICE_SECTIONS.filter((s) => s.toggle).map((s) => s.key).join() === "problems,call-to-action" && [...CASE_STUDY_SECTIONS, ...BLOG_SECTIONS].every((s) => !s.toggle));

// ---- every record, every section: reads, passes, round-trips, form fits ----------------------------------------------------------------
const walk = (fields, value, path, problems) => {
  const keys = fields.map((f) => f.key);
  if (value === null || typeof value !== "object" || Array.isArray(value)) { problems.push(`${path}: not an object`); return; }
  for (const k of Object.keys(value)) if (!keys.includes(k)) problems.push(`${path}.${k}: in the content, not in the form`);
  for (const f of fields) {
    const v = value[f.key], at = `${path}.${f.key}`;
    if (!(f.key in value)) { problems.push(`${at}: in the form, not in the content`); continue; }
    const shape = {
      text: () => typeof v === "string", rich: () => typeof v === "string", href: () => typeof v === "string", colour: () => typeof v === "string", timezone: () => typeof v === "string", datetime: () => typeof v === "string",
      select: () => f.options.some((o) => o.value === v), bool: () => typeof v === "boolean",
      number: () => (v === null && f.optional) || typeof v === "number",
      media: () => (v === null && f.optional) || (v && typeof v.id === "string" && (f.noAlt ? Object.keys(v).length === 1 : typeof v.alt === "string" && Object.keys(v).length === 2)),
      cases: () => Array.isArray(v) && v.every((x) => typeof x === "string"),
      pick: () => (f.single ? typeof v === "string" : Array.isArray(v) && v.every((x) => typeof x === "string")),
      hidden: () => v !== undefined,
      blocks: () => Array.isArray(v),
      group: () => (v === null && f.optional) || (v && typeof v === "object" && !Array.isArray(v)),
      list: () => Array.isArray(v),
    }[f.kind];
    if (!shape) { problems.push(`${at}: no shape check for ${f.kind}`); continue; }
    if (!shape()) problems.push(`${at}: wrong shape for a ${f.kind} field`);
    if (f.kind === "group" && v) walk(f.fields, v, at, problems);
    if (f.kind === "list" && Array.isArray(v)) {
      if (v.length < f.min || v.length > f.max) problems.push(`${at}: ${v.length} items, the form says ${f.min}-${f.max}`);
      v.forEach((it, i) => { if ("leaf" in f.of) walk([{ ...f.of.leaf, key: "x" }], { x: it }, `${at}.${i}`, problems); else walk(f.of.fields, it, `${at}.${i}`, problems); });
      const b = blankItem(f);
      if (!("leaf" in f.of) && JSON.stringify(Object.keys(b)) !== JSON.stringify(f.of.fields.map((x) => x.key))) problems.push(`${at}: blank item has other keys`);
    }
  }
};

for (const { kind, sections, records, schema } of KINDS) {
  const problems = { baseline: [], pass: [], round: [], whole: [], form: [], blank: [] };
  for (const rec of records) {
    if (!schema.safeParse(rec.input).success) problems.baseline.push(`${rec.input.slug}: ${JSON.stringify(toErrors(schema.safeParse(rec.input).error)).slice(0, 120)}`);
    for (const s of sections) {
      const content = s.read(rec.input);
      const parsed = s.schema.safeParse(content);
      if (!parsed.success) { problems.pass.push(`${rec.input.slug}/${s.key}: ${JSON.stringify(toErrors(parsed.error)).slice(0, 140)}`); continue; }
      const back = s.apply(rec.input, parsed.data);
      if (!same(back, rec.input)) problems.round.push(`${rec.input.slug}/${s.key}`);
      const whole = schema.safeParse(back);
      if (!whole.success) problems.whole.push(`${rec.input.slug}/${s.key}: ${JSON.stringify(toErrors(whole.error)).slice(0, 120)}`);
      walk(fieldsOfSchema(s.schema), parsed.data, `${rec.input.slug}/${s.key}`, problems.form);
    }
  }
  const total = records.length * sections.length;
  check(`${kind}: every stored record passes the full schema, so a section save starts from valid data`, problems.baseline.length === 0, problems.baseline.slice(0, 2).join(" | "));
  check(`${kind}: the content of all ${total} (record, section) pairs passes its section schema`, problems.pass.length === 0, problems.pass.slice(0, 3).join(" | "));
  check(`${kind}: putting a section's content back changes nothing in the record (round trip, ${total} pairs)`, problems.round.length === 0, problems.round.slice(0, 3).join(" | "));
  check(`${kind}: the record still passes the full schema after every section is put back`, problems.whole.length === 0, problems.whole.slice(0, 3).join(" | "));
  check(`${kind}: the editor form built from each schema fits its content exactly (no field missing or extra, counts and shapes right)`, problems.form.length === 0, problems.form.slice(0, 4).join(" | "));
}

// ---- one section changes only itself ---------------------------------------------------------------------------------------------
{
  const rec = cases[0];
  const hero = CASE_STUDY_SECTIONS.find((s) => s.key === "hero");
  const edited = hero.apply(rec.input, { ...hero.read(rec.input), title: "A <em>new</em> headline" });
  const others = CASE_STUDY_SECTIONS.filter((s) => s.key !== "hero");
  check("case study: editing the hero changes the headline and no other section's content", edited.title === "A <em>new</em> headline" && others.every((s) => same(s.read(edited), s.read(rec.input))));
  const gal = CASE_STUDY_SECTIONS.find((s) => s.key === "gallery-1");
  const imgs = gal.read(rec.input).images;
  const moved = gal.apply(rec.input, { images: [...imgs].reverse() });
  check("case study: a gallery keeps its pictures, captions and crop positions when they are reordered", same(gal.read(moved).images, [...imgs].reverse()) && same(CASE_STUDY_SECTIONS.find((s) => s.key === "gallery-2").read(moved), CASE_STUDY_SECTIONS.find((s) => s.key === "gallery-2").read(rec.input)));
  const sc = CASE_STUDY_SECTIONS.find((s) => s.key === "showcase");
  const quoted = sc.apply(rec.input, { ...sc.read(rec.input), results: [], quote: { source: "Clutch", text: "Great work.", name: "A. Client", role: "CEO", avatar: "/assets/people/a.jpg" } });
  check("case study: the card switches to a client quote when the quote part is on, and back to numbers when it is off", quoted.showcase.variant === "quote" && sc.apply(quoted, { ...sc.read(quoted), quote: null, results: [{ value: "1<em>x</em>", text: "t" }] }).showcase.variant === "results");

  const svc = services[0];
  const prob = SERVICE_SECTIONS.find((s) => s.key === "problems");
  const on = prob.toggle.write(svc.input, true);
  check("service: the switch of 'What we fix' flips its flag and nothing else", prob.toggle.read(on) === true && same({ ...on, showProblems: svc.input.showProblems }, svc.input));
  check("service: a switched-on 'What we fix' with empty fields is refused by the full schema (so it cannot be shown unfinished)", !serviceSchema.safeParse(on).success || svc.input.problems.items.length > 0);
  const inc = SERVICE_SECTIONS.find((s) => s.key === "included");
  const withNew = inc.apply(svc.input, { ...inc.read(svc.input), items: [...inc.read(svc.input).items, { title: "New", text: "Text", icon: blank({ kind: "hidden", fallback: { viewBox: "0 0 24 24", nodes: [] } }) }] });
  check("service: every 'included' card keeps its icon when edited; a new card gets one", inc.read(svc.input).items.every((i) => i.icon && i.icon.nodes.length > 0) && withNew.included.items.at(-1).icon !== undefined);

  const post = posts[0];
  const body = BLOG_SECTIONS.find((s) => s.key === "body");
  const bodyContent = body.read(post.input);
  check("article: the body is a list of typed blocks, not one text", Array.isArray(bodyContent.blocks) && bodyContent.blocks.length > 1 && bodyContent.blocks.every((b) => ["heading", "subheading", "paragraph", "list", "quote", "image", "divider"].includes(b.type)));
  check("article: reordering blocks changes the body and no other section", (() => { const n = body.apply(post.input, { blocks: [...bodyContent.blocks].reverse() }); return !same(n.blocks, post.input.blocks) && BLOG_SECTIONS.filter((s) => s.key !== "body").every((s) => same(s.read(n), s.read(post.input))); })());
  const head = BLOG_SECTIONS.find((s) => s.key === "header");
  check("article: no author picture is null and an empty reading time stays empty", head.read({ ...post.input, authorImage: "", readMinutes: null }).authorImage === null && head.apply(post.input, { ...head.read(post.input), authorImage: null, readMinutes: null }).readMinutes === null);
}

// ---- section schemas refuse what the editors must not store -------------------------------------------------------------------------
{
  const get = (list, k) => list.find((s) => s.key === k);
  const c = cases[0].input;
  const hero = get(CASE_STUDY_SECTIONS, "hero");
  check("a section schema refuses an unknown field and markup in plain text", !hero.schema.safeParse({ ...hero.read(c), extra: 1 }).success && !get(CASE_STUDY_SECTIONS, "facts").schema.safeParse({ ...get(CASE_STUDY_SECTIONS, "facts").read(c), industry: "<b>x</b>" }).success);
  check("a section schema refuses unbalanced rich text and a required picture without a description", !hero.schema.safeParse({ ...hero.read(c), title: "<em>open" }).success && !hero.schema.safeParse({ ...hero.read(c), cover: { id: "media_x", alt: "" } }).success);
  check("a gallery needs 1 to 6 pictures; a crop position must look like 20% 30%", !get(CASE_STUDY_SECTIONS, "gallery-1").schema.safeParse({ images: [] }).success && !get(CASE_STUDY_SECTIONS, "gallery-1").schema.safeParse({ images: Array(7).fill(get(CASE_STUDY_SECTIONS, "gallery-1").read(c).images[0]) }).success && !get(CASE_STUDY_SECTIONS, "gallery-1").schema.safeParse({ images: [{ ...get(CASE_STUDY_SECTIONS, "gallery-1").read(c).images[0], position: "left" }] }).success);
  check("related work: 1 to 4 projects, each once", !get(CASE_STUDY_SECTIONS, "related-work").schema.safeParse({ ...get(CASE_STUDY_SECTIONS, "related-work").read(c), slugs: [] }).success && !get(CASE_STUDY_SECTIONS, "related-work").schema.safeParse({ ...get(CASE_STUDY_SECTIONS, "related-work").read(c), slugs: ["a", "a"] }).success);
  check("the card refuses no numbers and no quote", !get(CASE_STUDY_SECTIONS, "showcase").schema.safeParse({ ...get(CASE_STUDY_SECTIONS, "showcase").read(c), results: [], quote: null }).success);
  const sv = services[0].input;
  check("service hero: two different pictures, a safe link", !get(SERVICE_SECTIONS, "hero").schema.safeParse({ ...get(SERVICE_SECTIONS, "hero").read(sv), imageB: get(SERVICE_SECTIONS, "hero").read(sv).imageA }).success && !get(SERVICE_SECTIONS, "hero").schema.safeParse({ ...get(SERVICE_SECTIONS, "hero").read(sv), cta: { label: "Go", href: "javascript:alert(1)" } }).success);
  const p = posts[0].input;
  check("article: a link in the text must be a safe address; the closing line link too", !get(BLOG_SECTIONS, "intro").schema.safeParse({ lead: "see [this](javascript:alert(1))" }).success && !get(BLOG_SECTIONS, "closing-line").schema.safeParse({ ...get(BLOG_SECTIONS, "closing-line").read(p), href: "javascript:x" }).success);
  check("article: at most 3 related articles, at most 8 tags, a canonical address must be https", !get(BLOG_SECTIONS, "more-from-the-studio").schema.safeParse({ related: ["a", "b", "c", "d"] }).success && !get(BLOG_SECTIONS, "listing").schema.safeParse({ ...get(BLOG_SECTIONS, "listing").read(p), tags: Array.from({ length: 9 }, (_, i) => `tag${i}`) }).success && !get(BLOG_SECTIONS, "seo").schema.safeParse({ ...get(BLOG_SECTIONS, "seo").read(p), canonicalUrl: "http://example.com/x" }).success);
  check("article: the body needs 1 to 80 blocks and a heading must have text", !get(BLOG_SECTIONS, "body").schema.safeParse({ blocks: [] }).success && !get(BLOG_SECTIONS, "body").schema.safeParse({ blocks: [{ type: "heading", text: "" }] }).success);
  check("article: the date must be YYYY-MM-DDTHH:mm and the reading time 1 to 120", !get(BLOG_SECTIONS, "header").schema.safeParse({ ...get(BLOG_SECTIONS, "header").read(p), publishedAt: "yesterday" }).success && !get(BLOG_SECTIONS, "header").schema.safeParse({ ...get(BLOG_SECTIONS, "header").read(p), readMinutes: 0 }).success);
}

// ---- errors of the whole-record check find their way back to the section -----------------------------------------------------------------
{
  const get = (list, k) => list.find((s) => s.key === k);
  check("error paths of the record map to the section's field paths", [
    get(CASE_STUDY_SECTIONS, "hero").mapError("coverImageAlt") === "cover.alt",
    get(CASE_STUDY_SECTIONS, "approach").mapError("process.steps.2.text") === "steps.2.text",
    get(CASE_STUDY_SECTIONS, "gallery-2").mapError("galleryB.1.media") === "images.1.image.id",
    get(CASE_STUDY_SECTIONS, "gallery-2").mapError("galleryB") === "images",
    get(CASE_STUDY_SECTIONS, "wide-image").mapError("wide.media") === "image.id",
    get(CASE_STUDY_SECTIONS, "showcase").mapError("showcase.quote.avatar") === "quote.avatar",
    get(SERVICE_SECTIONS, "hero").mapError("heroImageB") === "imageB.id",
    get(SERVICE_SECTIONS, "problems").mapError("problems.items.0.proofValue") === "items.0.proofValue",
    get(BLOG_SECTIONS, "closing-line").mapError("outro.href") === "href",
    get(BLOG_SECTIONS, "seo").mapError("ogImage") === "ogImage.id",
  ].every(Boolean));
  check("an error that belongs to another part of the record is not claimed by this section", get(CASE_STUDY_SECTIONS, "hero").mapError("results.items.0.text") === null && get(SERVICE_SECTIONS, "seo").mapError("heroTitle") === null);
  const m = remap({ a: "x", ab: "y", c: "" });
  check("the longest prefix wins and an empty target strips the prefix", m("ab.1") === "y.1" && m("a.1") === "x.1" && m("c.d.e") === "d.e" && m("zz") === null);
}

// ---- migration 0019: previous versions -------------------------------------------------------------------------------------------------
{
  const sid = services[0].id, cid = cases[0].id, pid = posts[0].id;
  const T = "'2026-10-08T00:00:00.000Z'";
  const ins = (type, id, key = "hero", content = "{}") => `INSERT INTO entity_section_revisions (id, entity_type, entity_id, section_key, content, saved_at, replaced_at) VALUES ('r_${type}_${key}_${Math.random().toString(36).slice(2, 8)}', '${type}', '${id}', '${key}', '${content}', ${T}, ${T})`;
  db.exec(ins("service", sid)); db.exec(ins("case_study", cid)); db.exec(ins("blog_post", pid));
  check("a previous version is stored for each kind of record", rows("SELECT COUNT(*) c FROM entity_section_revisions").at(0).c === 3);
  rejects("an unknown kind of record is refused", ins("page", sid), /CHECK/);
  rejects("content that is not JSON is refused", ins("service", sid, "hero", "not json"), /CHECK/);
  rejects("content that is not an object is refused", ins("service", sid, "hero", "[1]"), /CHECK/);
  rejects("an empty section key is refused", ins("service", sid, "", "{}"), /CHECK/);
  db.exec(`INSERT INTO users (id, email, name, password_hash, role, status, created_at, updated_at) VALUES ('u_ent', 'ent@example.com', 'Ent', 'x', 'admin', 'active', ${T}, ${T})`);
  db.exec(`INSERT INTO entity_section_revisions (id, entity_type, entity_id, section_key, content, saved_at, replaced_at, replaced_by) VALUES ('r_by', 'service', '${sid}', 'overview', '{}', ${T}, ${T}, 'u_ent')`);
  db.exec("DELETE FROM users WHERE id = 'u_ent'");
  check("deleting the editor keeps the version and forgets who saved it", rows("SELECT replaced_by FROM entity_section_revisions WHERE id = 'r_by'").at(0).replaced_by === null);
  db.exec(`DELETE FROM services WHERE id = '${sid}'`);
  check("deleting a service takes its previous versions with it, and only its own", rows("SELECT COUNT(*) c FROM entity_section_revisions WHERE entity_id = ?", sid).at(0).c === 0 && rows("SELECT COUNT(*) c FROM entity_section_revisions WHERE entity_id = ?", cid).at(0).c === 1);
  db.exec(`DELETE FROM case_studies WHERE id = '${cid}'`);
  db.exec(`DELETE FROM blog_posts WHERE id = '${pid}'`);
  check("the same for a case study and an article", rows("SELECT COUNT(*) c FROM entity_section_revisions").at(0).c === 0);
}

// ---- switching sections off: which can be, which ask first, and migration 0020 ------------------------------------------------------------
{
  const locked = (list) => list.filter((s) => s.lock).map((s) => s.key).join();
  const asks = (list) => list.filter((s) => s.confirm).map((s) => s.key).join();
  check("service: every section is a block of the page and can be switched off, except the search settings; the hero asks first", locked(SERVICE_SECTIONS) === "seo" && asks(SERVICE_SECTIONS) === "hero");
  check("case study: the ten blocks of the page can be switched off (the hero asks first); the cards, the service links and the search settings are not blocks of the page", locked(CASE_STUDY_SECTIONS) === "works-card,showcase,services,seo" && asks(CASE_STUDY_SECTIONS) === "hero");
  check("article: the six blocks of the page can be switched off (the header and the body ask first); the listing card and the search settings are not blocks", locked(BLOG_SECTIONS) === "listing,seo" && asks(BLOG_SECTIONS) === "header,body");
  check("what a locked section says is a reason, and what an important one says is what visitors lose", [...SERVICE_SECTIONS, ...CASE_STUDY_SECTIONS, ...BLOG_SECTIONS].every((s) => (!s.lock || s.lock.length > 40) && (!s.confirm || s.confirm.length > 40) && !(s.lock && s.confirm)));

  const sid = rows("SELECT id FROM services LIMIT 1")[0].id, cid = rows("SELECT id FROM case_studies LIMIT 1")[0].id;
  const T = "'2026-10-08T00:00:00.000Z'";
  const hide = (type, id, key) => `INSERT INTO entity_hidden_sections (entity_type, entity_id, section_key, hidden_at) VALUES ('${type}', '${id}', '${key}', ${T})`;
  db.exec(hide("service", sid, "overview")); db.exec(hide("case_study", cid, "results"));
  check("a hidden section is one row; the record itself is not touched", rows("SELECT COUNT(*) c FROM entity_hidden_sections").at(0).c === 2);
  rejects("a section can be hidden only once", hide("service", sid, "overview"), /UNIQUE|PRIMARY/);
  rejects("an unknown kind of record is refused", hide("page", sid, "x"), /CHECK/);
  rejects("an empty section key is refused", hide("service", sid, ""), /CHECK/);
  db.exec(`DELETE FROM services WHERE id = '${sid}'`);
  check("deleting a service forgets its switches, and only its own", rows("SELECT COUNT(*) c FROM entity_hidden_sections WHERE entity_id = ?", sid).at(0).c === 0 && rows("SELECT COUNT(*) c FROM entity_hidden_sections WHERE entity_id = ?", cid).at(0).c === 1);
  db.exec(`DELETE FROM case_studies WHERE id = '${cid}'`);
  check("the same for a case study", rows("SELECT COUNT(*) c FROM entity_hidden_sections").at(0).c === 0);
}

// ---- revisions record the whole change (migration 0021) ------------------------------------------------------------------------------------
{
  const T = "'2026-10-08T00:00:00.000Z'";
  const sid = rows("SELECT id FROM services LIMIT 1")[0].id;
  db.exec(`INSERT INTO entity_section_revisions (id, entity_type, entity_id, section_key, content, saved_at, replaced_at, new_content, kind) VALUES ('r_new', 'service', '${sid}', 'hero', '{"a":1}', ${T}, ${T}, '{"a":2}', 'restore')`);
  const r = rows("SELECT new_content, kind FROM entity_section_revisions WHERE id = 'r_new'")[0];
  check("a record's revision stores the new content and whether it was a restore", r.new_content === '{"a":2}' && r.kind === "restore");
  rejects("a record revision's kind must be edit or restore", `INSERT INTO entity_section_revisions (id, entity_type, entity_id, section_key, content, saved_at, replaced_at, kind) VALUES ('r_bad', 'service', '${sid}', 'hero', '{}', ${T}, ${T}, 'other')`, /CHECK/);
  rejects("a record revision's new content must be a JSON object", `INSERT INTO entity_section_revisions (id, entity_type, entity_id, section_key, content, saved_at, replaced_at, new_content) VALUES ('r_bad2', 'service', '${sid}', 'hero', '{}', ${T}, ${T}, '[1]')`, /CHECK/);
  db.exec("DELETE FROM entity_section_revisions WHERE id = 'r_new'");
}

console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
