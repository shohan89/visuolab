// Generates db/seed/content.sql: the current website content as rows, for the CMS tables.
//
//   node scripts/db/generate-seed.mjs
//
// Sources (nothing is invented):
//   - src/content/{services,cases,blog,reviews,logos}.ts   typed content already extracted from the static site
//   - ../referance-website/index.html, about.html           the home and About lists (FAQ, timeline, offices, ...) and the footer
//   - ../referance-website/assets                           every image and video (size, type, dimensions read from the files)
// The output is deterministic: same inputs, same bytes. Ids are readable (svc_brand-identity, case_orbit, ...).
import { parseDocument } from "htmlparser2";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const REF = join(ROOT, "..", "referance-website");
const SEED_AT = "2026-10-04T00:00:00.000Z"; // creation time of all seeded rows
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);

const { services } = await imp("src/content/services.ts");
const { caseStudies, worksOrder } = await imp("src/content/cases.ts");
const { blogPosts, blogOrder, blogTopics } = await imp("src/content/blog.ts");
const { reviews } = await imp("src/content/reviews.ts");
const { trustedBy } = await imp("src/content/logos.ts");

// ---- small helpers -------------------------------------------------------------------------------------------------
const q = (v) => (v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const j = (v) => q(JSON.stringify(v));
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rows = [];
const insert = (table, cols) => rows.push(`INSERT INTO ${table} (${Object.keys(cols).join(", ")}) VALUES (${Object.values(cols).join(", ")});`);
const section = (title) => rows.push("", `-- ${title}`);

const kids = (n) => n.children || [];
const elems = (n) => kids(n).filter((c) => c.type === "tag");
const hasClass = (n, c) => (n.attribs?.class || "").split(/\s+/).includes(c);
const find = (n, pred) => { for (const c of kids(n)) { if (c.type === "tag" && pred(c)) return c; const r = c.children && find(c, pred); if (r) return r; } return null; };
const findAll = (n, pred, out = []) => { for (const c of kids(n)) { if (c.type === "tag") { if (pred(c)) out.push(c); findAll(c, pred, out); } } return out; };
const cls = (c) => (n) => n.type === "tag" && hasClass(n, c);
const tag = (t) => (n) => n.type === "tag" && n.name === t;
const norm = (s) => s.replace(/\s+/g, " ").trim();
const text = (n) => (n.type === "text" ? n.data : kids(n).map(text).join(""));
const rich = (n) => norm(kids(n).map((c) => (c.type === "text" ? c.data : c.name === "em" ? `<em>${text(c)}</em>` : c.name === "br" ? " " : text(c))).join(""));
const page = (file) => { const doc = parseDocument(readFileSync(join(REF, file), "utf8"), { lowerCaseTags: false, lowerCaseAttributeNames: false }); return find(doc, tag("body")); };
const assetPath = (s) => "/" + s.replace(/^(\.\.\/)+/, "").replace(/\?v=\d+$/, "");

// ---- 1. media: every file in assets ------------------------------------------------------------------------------
const mimeOf = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4" };
function dimensions(buf, ext) {
  try {
    if (ext === ".png") return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    if (ext === ".webp") {
      const t = buf.toString("ascii", 12, 16);
      if (t === "VP8X") return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
      if (t === "VP8L") { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)]; }
      if (t === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    }
    if (ext === ".jpg") {
      let i = 2;
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
        i += 2 + buf.readUInt16BE(i + 2);
      }
    }
  } catch { /* fall through */ }
  return [null, null];
}
const files = [];
const walk = (d) => readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push(join(d, e.name))));
walk(join(REF, "assets"));
const mediaIdByUrl = {};
const humanize = (s) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const mediaTitle = (rel) => {
  const [dir, name] = rel.includes("/") ? rel.split("/") : ["", rel];
  const base = name.replace(/\.[^.]+$/, "");
  if (dir === "cases") return `${humanize(base)} case study image`;
  if (dir === "covers") return `Blog cover: ${humanize(base)}`;
  if (dir === "people") return `Portrait: ${humanize(base)}`;
  return humanize(base);
};
section("media: every image and video of the site (static files)");
for (const f of files) {
  const rel = relative(join(REF, "assets"), f).split(sep).join("/");
  const ext = "." + rel.split(".").pop();
  const url = `/assets/${rel}`;
  const slug = rel.replace(/\.[^.]+$/, "").replace(/\//g, "-");
  const buf = readFileSync(f);
  const [w, h] = mimeOf[ext].startsWith("image") ? dimensions(buf, ext) : [null, null];
  const id = `media_${slug}`;
  mediaIdByUrl[url] = id;
  insert("media", { id: q(id), slug: q(slug), title: q(mediaTitle(rel)), status: q("published"), kind: q(mimeOf[ext].startsWith("video") ? "video" : "image"), mime: q(mimeOf[ext]), storage: q("static"), url: q(url), r2_key: "NULL", width: q(w), height: q(h), bytes: q(statSync(f).size), alt_text: q(""), focal_x: "NULL", focal_y: "NULL", uploaded_by: "NULL", created_at: q(SEED_AT), updated_at: q(SEED_AT), published_at: q(SEED_AT) });
}
const mid = (url) => { const id = mediaIdByUrl[url]; if (!id) throw new Error("no media row for " + url); return id; };

// ---- 2. case studies --------------------------------------------------------------------------------------------
const byCase = Object.fromEntries(caseStudies.map((c) => [c.slug, c]));
// the card shown on the home page and the service pages: identical wherever a case appears (checked), taken from the service pages
const showcase = {};
for (const s of services) for (const it of s.cases.items) {
  const slug = it.href.replace("/works/", "");
  const card = { title: it.title, tags: it.tags, ...(it.quote ? { quote: it.quote } : {}), ...(it.results ? { results: it.results } : {}) };
  if (showcase[slug] && JSON.stringify(showcase[slug]) !== JSON.stringify(card)) throw new Error("showcase card differs between service pages: " + slug);
  showcase[slug] ??= card;
}
// the same cards on the home page must equal them
const home = page("index.html");
const homeCards = findAll(home, cls("case-panel")).map((a) => {
  const slug = a.attribs.href.replace(/^work\//, "").replace(/\.html$/, "");
  const rv = find(a, cls("review"));
  const who = find(rv, cls("who"));
  return { slug, card: { title: rich(find(a, cls("h3"))), tags: findAll(a, (n) => n.name === "li" && n.parent?.attribs?.class === "tags").map((l) => norm(text(l))),
    quote: { source: norm(text(find(rv, cls("src"))).replace("★★★★★", "")), text: norm(text(find(rv, tag("q")))), avatar: assetPath(find(who, tag("img")).attribs.src), name: norm(text(find(who, tag("b")))), role: norm(text(find(find(who, tag("div")), tag("span")))) } } };
});
for (const h of homeCards) if (JSON.stringify(showcase[h.slug]) !== JSON.stringify(h.card)) throw new Error("home card differs from service card: " + h.slug);
// short label under the thumbnail in "More work" (consistent wherever it appears)
const kind = {};
for (const c of caseStudies) for (const m of c.more.items) {
  if (m.name !== byCase[m.slug].card.name || m.image !== byCase[m.slug].card.image.src) throw new Error("more-work item differs from the case: " + m.slug);
  if (kind[m.slug] && kind[m.slug] !== m.kind) throw new Error("kind differs: " + m.slug);
  kind[m.slug] = m.kind;
}
section("case_studies");
const caseId = (slug) => `case_${slug}`;
worksOrder.forEach((slug, i) => {
  const c = byCase[slug];
  if (!kind[slug]) throw new Error("no short kind for " + slug);
  insert("case_studies", {
    id: q(caseId(slug)), slug: q(slug), title: q(c.hero.title), status: q("published"), position: q(i), featured: q(homeCards.some((h) => h.slug === slug) ? 1 : 0), // featured = shown on the home page
    meta_title: q(c.meta.title), meta_description: q(c.meta.description),
    client_name: q(c.card.name), year: q(c.card.year), type_line: q(c.card.type), short_kind: q(kind[slug]),
    card_tags_json: j(c.card.tags), filters_json: j(c.card.filters),
    card_image_id: q(mid(c.card.image.src)), card_image_alt: q(c.card.image.alt),
    cover_image_id: q(mid(c.cover.src)), cover_image_alt: q(c.cover.alt),
    facts_json: j(c.hero.facts), about_label: q(c.about.label), about_lead: q(c.about.lead), stats_json: j(c.about.stats),
    showcase_json: j(showcase[slug]),
    process_json: j(c.process), challenges_json: j(c.challenges), results_json: j(c.results),
    more_json: j({ label: c.more.label, title: c.more.title, slugs: c.more.items.map((m) => m.slug) }),
    created_at: q(SEED_AT), updated_at: q(SEED_AT), published_at: q(SEED_AT),
  });
});
section("case_study_images: the two galleries and the wide image of every case study");
for (const slug of worksOrder) {
  const c = byCase[slug];
  const add = (role, list) => list.forEach((f, i) => insert("case_study_images", { id: q(`img_${slug}_${role}_${i}`), case_study_id: q(caseId(slug)), media_id: q(mid(f.src)), role: q(role), position: q(i), caption: q(f.caption), alt_text: q(f.alt), object_position: q(f.position), created_at: q(SEED_AT), updated_at: q(SEED_AT) }));
  add("gallery_a", c.galleryA); add("gallery_b", c.galleryB); add("wide", [c.wide]);
}

// ---- 3. services -------------------------------------------------------------------------------------------------
section("services");
const svcId = (slug) => `svc_${slug}`;
services.forEach((s, i) => {
  const [a, b] = s.hero.shots;
  insert("services", {
    id: q(svcId(s.slug)), slug: q(s.slug), title: q(s.meta.title.replace(/ — Visuolab$/, "")), status: q("published"), position: q(i),
    meta_title: q(s.meta.title), meta_description: q(s.meta.description),
    hero_title: q(s.hero.title), hero_lead: q(s.hero.lead), hero_cta_label: q(s.hero.cta.label), hero_cta_href: q(s.hero.cta.href),
    hero_image_a_id: q(mid(a.src)), hero_image_b_id: q(mid(b.src)),
    hero_shots_json: j(s.hero.shots.map(({ alt, width, height, priority, lazy }) => ({ alt, width, height, priority: !!priority, lazy: !!lazy }))),
    show_problems: q(s.problems.hidden ? 0 : 1),
    problems_json: j({ label: s.problems.label, title: s.problems.title, items: s.problems.items }),
    overview_json: j(s.overview), outcomes_json: j(s.outcomes),
    show_band: q(s.band.hidden ? 0 : 1), band_json: j({ text: s.band.text, cta: s.band.cta }),
    included_json: j(s.included), process_json: j(s.process), cases_json: j({ label: s.cases.label, title: s.cases.title }),
    created_at: q(SEED_AT), updated_at: q(SEED_AT), published_at: q(SEED_AT),
  });
});
section("service_case_studies: which case studies each service page shows");
for (const s of services) s.cases.items.forEach((it, i) => insert("service_case_studies", { service_id: q(svcId(s.slug)), case_study_id: q(caseId(it.href.replace("/works/", ""))), position: q(i) }));

// ---- 4. blog ---------------------------------------------------------------------------------------------------
section("blog_categories (the blog has no tags today, so blog_tags and blog_post_tags stay empty)");
const catId = (name) => `cat_${slugify(name)}`;
blogTopics.forEach((name, i) => insert("blog_categories", { id: q(catId(name)), slug: q(slugify(name)), title: q(name), status: q("published"), position: q(i), created_at: q(SEED_AT), updated_at: q(SEED_AT), published_at: q(SEED_AT) }));
section("blog_posts");
const postsInOrder = blogOrder.map((s) => blogPosts.find((p) => p.slug === s));
postsInOrder.forEach((p, i) => insert("blog_posts", {
  id: q(`post_${p.slug}`), slug: q(p.slug), title: q(p.title), status: q("published"), category_id: q(catId(p.category)),
  meta_title: q(p.meta.title), meta_description: q(p.meta.description), excerpt: q(p.excerpt ?? null), featured: q(i === 0 ? 1 : 0),
  lead: q(p.lead), body_json: j(p.body), outro_json: j(p.outro), related_json: j(p.related), read_minutes: q(p.readMinutes),
  author_name: q(p.author.name), author_image_id: q(mid(p.author.avatar)), cover_image_id: q(mid(p.cover.src)), cover_alt: q(p.cover.alt),
  created_at: q(SEED_AT), updated_at: q(SEED_AT), published_at: q(`${p.publishedAt}T00:00:00.000Z`),
}));

// ---- 5. site settings (documents) -----------------------------------------------------------------------------
const about = page("about.html");
const settings = [];
const setting = (key, title, value) => settings.push({ key, title, value });

setting("reviews", "Client reviews (carousel)", reviews);
setting("trusted_by", "Trusted-by logo marquee", trustedBy);

const heroBanner = find(home, cls("copy"));
setting("home.hero", "Home: hero", { eyebrow: norm(text(find(heroBanner, cls("eyebrow")))), title: rich(find(heroBanner, cls("title"))), actions: findAll(heroBanner, (n) => n.name === "a").map((a) => ({ label: norm(text(a)), href: a.attribs.href })) });
const why = find(home, cls("why-body"));
setting("home.why", "Home: why Visuolab", { label: norm(text(find(home, (n) => n.name === "section" && n.attribs.id === "why") && find(find(home, (n) => n.name === "section" && n.attribs.id === "why"), cls("label")))), title: rich(find(why, cls("h2"))), items: findAll(why, (n) => n.name === "li").map((li) => ({ text: norm(text(find(li, tag("a")))), href: find(li, tag("a")).attribs.href })) });
setting("home.stats", "Home: statistics", findAll(find(home, (n) => n.name === "section" && n.attribs.id === "why"), cls("stat")).map((s) => ({ value: rich(find(s, tag("b"))), label: norm(text(find(s, tag("span")))) })));
const svcSec = find(home, (n) => n.name === "section" && n.attribs.id === "services");
setting("home.services", "Home: services section", {
  label: norm(text(find(svcSec, cls("label")))), title: rich(find(svcSec, cls("h2"))), lead: norm(text(find(svcSec, cls("lead")))),
  columns: findAll(svcSec, cls("svc")).map((c) => ({ title: norm(text(find(c, tag("h3")))), links: findAll(c, (n) => n.name === "li").map((l) => norm(text(l))) })),
  bookBar: { name: norm(text(find(find(svcSec, cls("book-bar")), tag("b")))), role: norm(text(find(find(find(svcSec, cls("book-bar")), cls("who")), tag("span")))), text: norm(text(find(find(svcSec, cls("book-bar")), tag("p")))), cta: norm(text(find(find(svcSec, cls("book-bar")), cls("pill")))) },
});
const workSec = find(home, (n) => n.name === "section" && n.attribs.id === "work");
setting("home.work", "Home: our cases", { label: norm(text(find(workSec, cls("label")))), title: rich(find(workSec, cls("h2"))), slugs: homeCards.map((h) => h.slug), allLabel: norm(text(find(workSec, cls("pill")))) });
const indSec = find(home, (n) => n.name === "section" && n.attribs.id === "industries");
setting("home.industries", "Home: industries", { label: norm(text(find(indSec, cls("label")))), title: rich(find(indSec, cls("h2"))), lead: norm(text(find(indSec, cls("lead")))), items: findAll(indSec, cls("ind-card")).map((c, i) => ({ icon: `industry-${i + 1}`, title: norm(text(find(c, tag("h3")))), text: norm(text(find(c, tag("p")))) })) });
const procSec = find(home, (n) => n.name === "section" && n.attribs.id === "process");
setting("home.process", "Home: how we work", {
  label: norm(text(find(procSec, cls("label")))), title: rich(find(procSec, cls("h2"))), lead: norm(text(find(procSec, cls("lead")))),
  facts: findAll(find(procSec, cls("facts")), tag("li")).map((l) => norm(text(l))), cta: norm(text(find(procSec, cls("pill")))),
  steps: findAll(procSec, cls("step")).map((st) => ({ label: norm(text(find(st, cls("label")))), title: rich(find(st, tag("h3"))), text: norm(text(find(find(st, cls("step-body")), (n) => n.name === "p" && !hasClass(n, "label")))), outputs: findAll(find(st, cls("out")), (n) => n.name === "li" && !hasClass(n, "when")).map((l) => norm(text(l))), when: norm(text(find(find(st, cls("out")), cls("when")))) })),
});

const ps = find(about, (n) => n.name === "section" && n.attribs.id === "principles");
setting("about.principles", "About: principles", { label: norm(text(find(ps, cls("label")))), title: rich(find(ps, cls("h2"))), lead: norm(text(find(ps, cls("lead")))), items: findAll(ps, cls("principle")).map((p) => ({ num: norm(text(find(p, cls("num")))), title: norm(text(find(p, tag("h3")))), text: norm(text(find(p, tag("p")))) })) });
setting("about.mission_vision", "About: mission and vision", findAll(about, cls("mv-card")).map((c) => ({ tag: norm(text(find(c, cls("tag")))), title: norm(text(find(c, tag("h3")))), text: norm(text(find(c, tag("p")))) })));
const story = find(about, (n) => n.name === "section" && n.attribs.id === "story");
setting("about.milestones", "About: our story timeline", { label: norm(text(find(story, cls("label")))), title: rich(find(story, cls("h2"))), items: findAll(story, cls("milestone")).map((m) => ({ year: norm(text(find(m, cls("year")))), title: norm(text(find(m, tag("h3")))), text: norm(text(find(m, tag("p")))) })) });
const mani = find(about, (n) => n.name === "section" && n.attribs.id === "manifesto");
setting("about.manifesto", "About: manifesto", { label: norm(text(find(mani, cls("label")))), text: rich(find(mani, (n) => n.attribs?.["data-scroll-words"] !== undefined)) });
const places = find(about, (n) => n.name === "section" && n.attribs.id === "places");
setting("about.offices", "About: where we work", { label: norm(text(find(places, cls("label")))), title: rich(find(places, cls("h2"))), lead: norm(text(find(places, cls("lead")))), items: findAll(places, cls("clock")).map((c) => ({ tz: c.attribs["data-tz"], city: norm(text(find(c, cls("city")))), country: norm(text(kids(find(c, cls("country")))[0])), flag: find(c, tag("svg")).attribs["aria-label"] })) });
const faq = find(about, (n) => n.name === "section" && n.attribs.id === "faq");
setting("about.faq", "About: frequently asked questions", { label: norm(text(find(faq, cls("label")))), title: rich(find(faq, cls("h2"))), lead: norm(text(find(faq, cls("lead")))), cta: norm(text(find(faq, cls("pill")))), items: findAll(faq, cls("qa")).map((qa) => ({ id: find(qa, cls("qa-a")).attribs.id, q: norm(text(find(qa, cls("qa-q")))), a: norm(text(find(find(qa, cls("qa-a")), tag("p")))) })) });
const careers = find(about, (n) => n.name === "section" && n.attribs.id === "careers");
setting("about.roles", "About: open roles", { label: norm(text(find(careers, cls("label")))), title: rich(find(careers, cls("h2"))), items: findAll(careers, cls("role")).map((r) => ({ title: norm(text(find(r, tag("b")))), meta: norm(text(find(r, tag("span")))), subject: decodeURIComponent((r.attribs.href.split("subject=")[1] ?? "")) })) });
const hero = find(about, cls("about-hero"));
setting("about.hero", "About: hero", { label: norm(text(find(hero, cls("label")))), title: rich(find(hero, cls("h1"))), lead: norm(text(find(hero, cls("lead")))), facts: findAll(find(hero, cls("facts")), tag("li")).map((l) => norm(text(l))) });

const reel = find(home, cls("reel"));
setting("home.showreel", "Home: showreel", { tag: norm(text(find(reel, cls("reel-tag")))), time: norm(text(find(reel, cls("reel-time")))), video: assetPath(find(reel, tag("source")).attribs.src), poster: assetPath(find(reel, tag("video")).attribs.poster) });
const revSec = find(home, (n) => n.name === "section" && n.attribs.id === "reviews");
setting("home.reviews", "Home: reviews heading", { label: norm(text(find(revSec, cls("label")))), title: rich(find(revSec, cls("h2"))), rating: norm(text(find(revSec, cls("rating")))) });
const ctaSec = find(home, (n) => n.name === "section" && hasClass(n, "cta"));
setting("site.cta", "Closing call-to-action band", { title: rich(find(ctaSec, cls("h2"))), lead: norm(text(find(ctaSec, cls("lead")))), actions: findAll(find(ctaSec, cls("actions")), tag("a")).map((a) => ({ label: norm(text(a)), href: a.attribs.href })), floaters: findAll(ctaSec, cls("floater")).map((fl) => assetPath(find(fl, tag("img")).attribs.src)), avatars: findAll(find(ctaSec, cls("avatars")), tag("img")).map((i) => assetPath(i.attribs.src)) });
const contact = page("contact.html");
const intro = find(contact, cls("contact-intro"));
setting("site.contact", "Contact details", {
  email: "hello@visuolab.studio", label: norm(text(find(intro, cls("label")))), title: rich(find(intro, tag("h1"))),
  whoAnswers: { name: norm(text(find(find(intro, cls("who-answers")), tag("b")))), role: norm(text(find(find(intro, cls("who-answers")), tag("span")))), avatar: assetPath(find(find(intro, cls("who-answers")), tag("img")).attribs.src) },
  direct: findAll(find(intro, cls("contact-direct")), tag("li")).map((li) => ({ label: norm(text(find(li, cls("label")))), text: norm(text(find(li, tag("a")))), href: find(li, tag("a")).attribs.href })),
  facts: findAll(find(intro, cls("contact-facts")), tag("li")).map((l) => norm(text(l))),
});
const footer = find(home, tag("footer"));
setting("site.footer", "Footer: newsletter, legal, social, badges", {
  newsletter: norm(text(find(find(footer, cls("newsletter")), tag("p")))), emailPlaceholder: find(find(footer, cls("newsletter")), tag("input")).attribs.placeholder,
  legal: findAll(find(footer, cls("legal")), tag("a")).map((a) => ({ label: norm(text(a)), href: a.attribs.href })),
  social: findAll(find(footer, cls("social")), tag("a")).map((a) => ({ label: a.attribs["aria-label"], href: a.attribs.href })),
  copyright: norm(text(findAll(find(footer, cls("footer-bottom")), tag("span")).at(-1))),
  badges: findAll(footer, cls("badge-card")).map((b) => ({ mark: ["clutch", "dribbble", "awwwards", "webflow", "goodfirms", "behance"][findAll(footer, cls("badge-card")).indexOf(b)], text: kids(find(b, tag("p"))).map((n) => (n.type === "text" ? n.data : " ")).join("").replace(/\s+/g, " ").trim() })),
});

section("site_settings: JSON documents");
settings.forEach((s) => insert("site_settings", { id: q(`set_${s.key.replace(/\./g, "_")}`), key: q(s.key), title: q(s.title), status: q("published"), value_json: j(s.value), created_at: q(SEED_AT), updated_at: q(SEED_AT), updated_by: "NULL" }));

// ---- 6. navigation ---------------------------------------------------------------------------------------------
section("navigation_items");
let nav = 0;
const navItem = (menu, id, parent, position, label, href, extra = {}) => insert("navigation_items", { id: q(id), menu: q(menu), parent_id: q(parent), position: q(position), label: q(label), href: q(href), description: q(extra.description ?? null), tag: q(extra.tag ?? null), icon_key: q(extra.icon ?? null), status: q("published"), created_at: q(SEED_AT), updated_at: q(SEED_AT) });
const navData = await imp("src/content/nav-data.ts");
navData.mainLinks.forEach((l, i) => navItem("primary", `nav_primary_${slugify(l.label)}`, null, i, l.label, l.href));
navItem("cta", "nav_cta_contact", null, 0, navData.cta.label, navData.cta.href);
navData.serviceCardData.forEach((c, i) => navItem("mega_cards", `nav_card_${slugify(c.title)}`, null, i, c.title, c.href, { description: c.desc, icon: c.icon }));
navItem("mega_promo", "nav_promo_design-sprint", null, 0, navData.promo.title, navData.promo.href, { description: navData.promo.desc, tag: navData.promo.tag });
const group = (menu, prefix, i, label, links) => {
  navItem(menu, `${prefix}_${slugify(label)}`, null, i, label, null);
  links.forEach(([l, h], k) => navItem(menu, `${prefix}_${slugify(label)}_${k}`, `${prefix}_${slugify(label)}`, k, l, h));
};
navData.serviceGroups.forEach((g, i) => group("mega_columns", "nav_mega", i, g.label, g.links.map((l) => [l.label, l.href])));
const footerCols = findAll(footer, (n) => n.name === "div" && n.parent && hasClass(n.parent, "footer-top") && !hasClass(n, "newsletter"));
const footerHref = (h) => (h === "#" ? "#" : "/" + h.replace(/^\/?/, "").replace(/^index\.html/, "").replace(/^(about|works|contact)\.html/, "$1").replace(/^service\/(.+)\.html/, "services/$1").replace(/^#process$/, "#process"));
footerCols.forEach((col, i) => {
  const label = norm(text(find(col, tag("h4"))));
  const links = findAll(col, tag("a")).map((a) => [norm(text(a)), a.attribs.href]).map(([l, h]) => [l, label === "Company" && h === "#process" ? "/#process" : label === "Company" && h === "#reviews" ? "/#reviews" : label === "Company" && h === "about.html#careers" ? "/about#careers" : footerHref(h)]);
  group("footer", "nav_footer", i, label, links);
});

// ---- 7. integrations --------------------------------------------------------------------------------------------
section("integrations (no secret is stored: secret_name is the name of the Worker secret)");
[
  ["resend", "Resend (notification e-mail)", "disabled", { from: "Visuolab <onboarding@resend.dev>", to: "visuolab@gmail.com" }, "RESEND_API_KEY"],
  ["turnstile", "Cloudflare Turnstile (spam check)", "disabled", {}, "TURNSTILE_SECRET"],
  ["analytics", "Analytics", "disabled", {}, null],
].forEach(([slug, title, status, config, secret]) => insert("integrations", { id: q(`int_${slug}`), slug: q(slug), title: q(title), status: q(status), config_json: j(config), secret_name: q(secret), last_checked_at: "NULL", last_error: "NULL", created_at: q(SEED_AT), updated_at: q(SEED_AT), updated_by: "NULL" }));

// ---- write ---------------------------------------------------------------------------------------------------
const header = `-- Website content as rows. GENERATED by scripts/db/generate-seed.mjs: edit the source content, not this file.
--
-- WARNING: this file replaces the content tables (media, services, case studies, blog, settings, navigation, integrations).
-- It does not touch users, sessions, contact_submissions, rate_limits or audit_logs. Run it on a new database, or when you
-- really want to go back to the original site content. Once editors work in the admin, do not run it again.

DELETE FROM service_case_studies;
DELETE FROM case_study_images;
DELETE FROM blog_post_tags;
DELETE FROM blog_posts;
DELETE FROM blog_tags;
DELETE FROM blog_categories;
DELETE FROM services;
DELETE FROM case_studies;
DELETE FROM navigation_items;
DELETE FROM site_settings;
DELETE FROM integrations;
DELETE FROM media;
`;
mkdirSync(join(ROOT, "db", "seed"), { recursive: true });
writeFileSync(join(ROOT, "db", "seed", "content.sql"), header + rows.join("\n") + "\n");
const count = (t) => rows.filter((r) => r.startsWith(`INSERT INTO ${t} `)).length;
console.log(["media", "case_studies", "case_study_images", "services", "service_case_studies", "blog_categories", "blog_posts", "site_settings", "navigation_items", "integrations"].map((t) => `${t}: ${count(t)}`).join(", "));
