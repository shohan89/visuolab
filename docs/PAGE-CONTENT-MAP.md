# Page content map

Audit of every public page of the website, section by section, as the input to a **controlled section-based CMS**: every existing design section gets a predefined editable schema. This is not a page builder. Editors fill fields; they never add, remove or reorder sections or change markup, classes or layout.

Status: **audit only.** Nothing in the website was changed to produce this document. The existing design is the source of truth; no section is redesigned, simplified or removed.

Audited against the running site (rendered HTML at `localhost:3001`), the component source in `visuolab-next/src`, the content files, the D1 migrations and seed, and the original site in `referance-website`.

## How to read this document

Each page part lists its sections in visual order. For every section: source file, root class/id, section type, every text field (with current value), image, video, link/CTA, repeater (current count and the count the design tolerates), dynamic relationship, SEO fields, and where the content lives today.

Storage legend used in the tables:

| Tag | Meaning |
|---|---|
| **ALREADY-IN-DB** | stored in D1 and read by the website at run time |
| **IN-CODE-ONLY** | lives in `src/content/*.ts` (or similar), not in D1 |
| **HARDCODED-JSX** | typed directly into a component |
| **SEEDED-NOT-READ** | a D1 `site_settings` row exists (from the seed) but no run-time code reads it |

Field classes: **REQUIRED** (section breaks or is meaningless without it), **OPTIONAL** (may be empty or the section may be hidden without breaking the design), **FIXED** (must stay in code for design integrity: decorative SVG, animation hooks, 3D/mesh/stars, aria wiring, layout-driving counts, class names, anchor ids).

## Pages and routes

| # | Page | Route | Source of content today | Part |
|---|---|---|---|---|
| 1 | Home | `/` | all copy hardcoded in JSX; case cards from D1 | Part 1 |
| 2 | About | `/about` | all copy hardcoded in JSX; seeded rows not read | Part 2 |
| 3 | Services (overview) | `/services` | does not render: 308 redirect to `/#services` | Part 3 |
| 4 | Service detail | `/services/[slug]` | D1 (`services`), edited in the Service admin form; reviews/logos in code | Part 3 |
| 5 | Works | `/works` | page copy hardcoded; cards from D1 | Part 4 |
| 6 | Case study detail | `/works/[slug]` | D1 (`case_studies`), edited in the Case study admin form | Part 4 |
| 7 | Blog | `/blog` | hero copy hardcoded; articles from D1 | Part 5 |
| 8 | Article detail | `/blog/[slug]` | D1 (`blog_posts`), edited in the Blog admin | Part 5 |
| 9 | Contact | `/contact` | copy hardcoded; option lists in code | Part 6 |
| 10 | Shared chrome (header, closing CTA band, footer, reviews, logo marquee) | every page | navigation in D1; the rest hardcoded or in code | Part 7 |
| 11 | Other routes (robots, sitemap, media, health, not-found, legal links) | various | technical; no content schema except legal pages that do not exist yet | Part 8 |

Pages that are already "CMS-driven" (services, case studies, blog) are edited as records. This audit adds the **page-level and section-level copy around those records** (hero headings, labels, section headings, CTA copy) that is still hardcoded.

## Cross-cutting findings

1. **Home and About are 100% hardcoded JSX.** The seed already holds D1 rows for most of their lists (`home.*`, `about.*`, `site.cta`, `site.contact`, `site.footer`, `reviews`, `home.reviews`, `trusted_by`), but **no run-time code reads them** (`getSetting()` has callers only in `scripts/db/verify.mjs`) and there are no validation schemas or admin editors for them. The seed can be the starting point for the section schemas, but it is not authoritative: the audit found drift (for example the seeded About hero title lacks the two `<br>` breaks that the JSX has; the case-study `title` in D1 carries `<em>` that the Home cards do not).
2. **Home and About include whole sections inside "Run" components** (`HomeIntroRun`, `HomeWorkRun`, `AboutHeroRun`, `AboutFaqRun`), so the section boundaries in the code do not match the section boundaries on the page. The inventories below follow what the visitor sees.
3. **Reviews and the logo marquee exist in several copies.** Home has its own inline copies; services and works use `src/content/reviews.ts` / `logos.ts`; a seeded `reviews` setting exists but is not read. One schema per shared block, fed to every page that shows it, is needed.
4. **Layout-driving counts are baked into CSS**, and current validation is looser than the CSS. Examples found: the About timeline is 5 columns, the clocks grid 4, mission/vision 2 cards, the hero mosaic loops via `translateX(-50%)` (16 tiles = 4 items x 4); service and case "Stairs" process rails divide by `--n - 1` so **1 step breaks** while validation allows 1-8 / 1-10; case stats validate 1-4 but the layout is 3 columns; challenges, results, more-work and galleries use 3-, 3-, 3- and 2-column grids; service grids are tuned to 4 problems, 3 outcomes and 3/6 included items. Section schemas must set min/max to what the design tolerates.
5. **Dead and missing public links.** The footer legal links (Privacy policy, Cookie policy, Terms) and the empty social links are `href="#"`; `/privacy`, `/terms`, `/cookies` and `/careers` return 404; there is no custom not-found or error page; the newsletter form only calls `preventDefault()`.
6. **Settings that have no slot in the design.** Contact phone, address and hours (Settings > Contact) are never shown on `/contact` or in the footer, because the design has no place for them.
7. **Duplicated lists to unify.** The discipline list exists in WorksPage, the validation enum and the form; the contact `NEEDS` / `BUDGETS` option lists exist in `src/content/contact.ts` and in the Zod schema.
8. **Data drift in the live database** (not a schema issue, but to fix before the CMS goes live): Orbit gallery A holds 3 images where 2 are designed; Kite shows only 1 "More work" card where 3 are designed; Home case image alt text says "placeholder from Dribbble".
9. **Unverified:** whether the Article JSON-LD headline strips `<em>`; to check when blog SEO is touched.
10. **Anchors that must survive any edit** (used by footer, header and CTAs): `#top`, `#contact`, `#work`, `#process`, `#reviews`, `#services`, `#careers`. A section that owns one of them cannot be hidden without breaking links.

## Design rules for the section schemas (proposed, to confirm before implementation)

- One schema per existing section, defined in code; the section's position and presence are fixed unless the inventory marks the whole section OPTIONAL (for example the two services sections that are hidden today).
- Text fields are plain text or the existing restricted rich text (`<em>` / `<b>` only), with a max length that the layout tolerates.
- Repeaters have a fixed min and max taken from the design, not from today's loose validation.
- Images and videos are chosen from the media library (D1 `media`), with alt text required for informative images and empty for decorative ones; width/height come from the media row.
- Links are internal path, anchor, or external https, validated as in Navigation; anchors that other pages depend on stay fixed.
- Decorative SVGs, animation hooks, class names, aria wiring and section ids are never editable.
- SEO fields (title, description, OG image, canonical, robots) stay in the existing SEO settings and the per-record SEO fields; the inventory notes where a page has none yet.

---

# Part 1. Home `/`

### 0. Page-level facts (read first)

- Route `/` = `src/app/(site)/page.tsx`. It renders, in JSX order: `HomeHero`, `HomeIntroRun`, `HomeServices`, `HomeWorkRun`, `HomeReviews`. The layout adds `Nav` before and `ShellFooter` (= `CtaBand` + `Footer variant="home"`) after.
- Real rendered section order (curl localhost:3001): `#top` hero -> `.intro-band` (logos) -> `#showreel` -> `#why` (+ stats) -> `#services` -> `#work` -> `#industries` -> `#process` -> `#reviews` -> `#contact` (CTA band) -> footer.
- `#industries` and `#process` live inside `HomeWorkRun.tsx` (not separate files). `#work`, `#industries`, `#process` share one dark wrapper `div.blue-run.blue-run-2`. `.intro-band`, `#showreel`, `#why` share `div.blue-run`. Wrappers are FIXED (the continuous blue background).
- No contact form on `/`. The "contact" section is the CTA band `section.cta#contact` from `src/components/site/chrome/CtaBand.tsx` (rendered by layout `ShellFooter`, every page except `/contact`).
- KEY FINDING: **every visible string/image on Home is HARDCODED-JSX** (HomeHero, HomeIntroRun, HomeServices, HomeWorkRun, HomeReviews are generated markup). The D1 seed (`db/seed/content.sql` lines 138-157, from `scripts/db/generate-seed.mjs`) already contains matching settings rows `home.hero`, `home.why`, `home.stats`, `home.services`, `home.work`, `home.industries`, `home.process`, `home.showreel`, `home.reviews`, `site.cta`, `reviews`, `trusted_by`, but **no runtime code reads them** (grep: only generate-seed.mjs/verify.mjs reference them; `cms.getSetting/getAllSettings` exist in `src/lib/server/cms.ts` but Home never calls them). `src/lib/settings/schema.ts` has NO schema for `home.*` (only general/contact/social/seo/analytics + `SEO_PAGES`). So status below: "SEEDED-IN-DB, NOT WIRED" = row exists in D1 seed, JSX ignores it. `reviews` and `trusted_by` also exist as TS (`src/content/reviews.ts`, `logos.ts`) and as DB rows, but Home does NOT import them (Home JSX has its own copy); Works and Service pages do via `ReviewsSection`/`LogoMarquee`.
- Home-case cards: the 4 slugs are in `home.work.slugs` (`orbit, marlow, kite, verdant`) and are the `case_studies` rows with `featured=1` (verify.mjs asserts this). Home card review/tags probably come from `case_studies.showcase_json` (migration comment: "the card on the home page and the service pages"), `case_studies.title` (has `<em>` in DB, e.g. "Orbit cut onboarding drop-off by <em>41%</em>..."), `card_image_id`/`card_image_alt`. Home JSX currently ignores them and renders the title without `<em>` (visual diff between DB title and JSX: DB has emphasis, page has none; AMBIGUOUS which is intended).
- Legend: R=required, O=optional (empty/hidden does not break design), F=fixed for design integrity.

### SEO (page `/`)

| field | current | source today |
|---|---|---|
| title | "Visuolab — Digital product design agency" | `settings.seo.pages.home.title` (D1 `site_settings` key `settings.seo`; default in `schema.ts` L145), via `fixedPageSeo("home")` in `src/lib/server/seo.ts` L46-60 |
| description | "Visuolab is a design agency that unites brand, website and product into one story." | same, `pages.home.description` |
| robots | `index, follow` | `pages.home.noindex` + global `seo.indexing` |
| canonical | `http://localhost:3001` (site URL, no trailing slash) | `getSiteUrl()` (`src/lib/site.ts`) |
| OG/Twitter | og:title/description/url/type=website/site_name/locale en_GB; twitter:card=summary (summary_large_image if `seo.ogImageUrl`) | layout `generateMetadata` + `settings.seo.ogImageUrl`, `settings.social.x` |
| JSON-LD | Organization (in layout `<head>`, `organizationNode`) + WebSite node (page, `websiteNode`; `seo.jsonLd`) | `src/lib/seo/jsonld.ts`, built from settings (name, logo, email, description). No BreadcrumbList on home. |
All ALREADY-IN-DB and editable in Settings -> SEO. No separate OG image per page (global only). Recommend title required, description required, noindex optional.

---

### 1. Hero (scroll-driven hands)  — order 1

- Root: `<section class="scroll-sequence" id="top" aria-label="Introduction">` containing `HeroBanner` `div.banner.reaching`. File `src/components/site/home/HomeHero.tsx`. Type: hero (pinned scroll stage + copy).
- FIXED: `id="top"` (footer brand link `#top`), aria-label "Introduction" (R-text but keep), `MeshFlow` + 5 `span.m1..m5`, `<Stars/>`, `.stage .scene .orb-layer`, `span.contact-wave[aria-hidden]`, `.reach-hand.reach-left/right`, `.reveal-load` + `--i` stagger. `HeroBanner` (`src/lib/motion/hero.ts`) writes `--reach` etc. from scroll; DOM structure/classes must not change.
- Scene a11y: `div.scene role="img" aria-label="Two human hands reach toward each other in front of a glowing sphere. Scrolling brings the fingertips together."` (carries copy; HARDCODED; O/editable text, role=F).

| key | type | current | stored | flag |
|---|---|---|---|---|
| hero.eyebrow | text, <=40 | "Digital product design agency" | `home.hero.eyebrow` | R, SEEDED-NOT-WIRED |
| hero.title | rich (`<em>` only), <=110 | "The design partner that unites *brand*, *website* and *product* into one story." (em on brand, website, product) | `home.hero.title` | R. NOTE JSX wraps `<em>brand</em>,` in `span.nb` (no-break so comma sticks); seed title has `<em>brand</em>,` without nb and hero seed HTML shows only website/product em. Keep `.nb` as renderer logic (wrap em + following punctuation). |
| hero.cta1.label / href | text / link | "Book a call" / `#contact` (internal anchor) | `home.hero.actions[0]` | label R, href R (default `#contact`) |
| hero.cta2.label / href | text / link | "See our work" / `#work` | `home.hero.actions[1]` | O (could hide; `.arrow-link`), keep default `#work` |
| hero.scene.ariaLabel | text | (above) | JSX | O |
- Pill CTA includes `span.badge` with 2 duplicated arrow SVGs (hover slide) = FIXED. Arrow-link SVG = FIXED.
- Images (all decorative, `alt=""`, `draggable=false`, `fetchPriority=high`, via `Img` responsive):
  - `/assets/earth.webp` 1600x1600, class `orb`, sizes `(max-width:600px) 31vw,(max-width:1000px) 24vw,270px`
  - `/assets/reach-left.webp` 887x887, `/assets/reach-right.webp` 887x887, sizes 78vw/59vw/655px.
  - All 3 are part of the scroll-animation art: FIXED (not editable; optionally swappable only if same dimensions/transparent cutout).
- Constraint: copy sits on pinned stage; long titles overflow the stage height. Keep title <=~110 chars, 3 lines max at desktop. Reveal-load fires on page load only.

### 2. Logos band "Trusted by" — order 2

- Root `<section class="intro-band"><div class="wrap"><div class="logos">` in `HomeIntroRun.tsx` (inside `div.blue-run`). Type: label + infinite marquee.
- `p.label` "Trusted by": text, <=30, O (SEEDED? not in any `home.*` key; HARDCODED-JSX).
- Marquee `div.marquee[aria-hidden=true] > .marquee-track` (CSS animation 38s linear infinite, pauses on hover; track = list repeated twice for seamless loop = FIXED mechanism).
- Repeater `logos` (item: `text` text <=24, `style` enum caps|serif|mono|plain, `dot` bool shows `<i>` dot). Current 10 items: NORTHWIND(caps), halcyon(dot), Marlow & Co.(serif), orbit_(mono), ASTER LABS(caps), Kite, Verdant(serif), fold.(dot), quill(mono), TESSEL(caps). Source: DB `trusted_by` setting (ALREADY-IN-DB, seeded) AND `src/content/logos.ts` (used by `LogoMarquee.tsx` on other pages) -- but Home JSX does not use either; it has its own hardcoded copy. Home should be wired to `trusted_by`. Items are TEXT wordmarks, not images; no img/alt. Tolerance: 6-14 items (needs enough width that duplicated set > viewport; below ~6 the loop shows gaps; render the list twice or thrice if fewer). Rendering the duplicate set is FIXED (code, not editable).
- Whole logos area is `aria-hidden` (decorative).

### 3. Showreel — order 3

- Root `<section class="showreel" id="showreel" aria-label="Showreel"><div class="wrap">` + `Reel` (`src/components/motion/Reel.tsx`) `div.reel` style `--p:0`. Type: video panel with scroll-scale (74% -> 100%).
- Video: `video.reel-video playsInline muted loop preload="none" poster="/assets/showreel-poster.jpg"`, `<source src="/assets/showreel.mp4" type="video/mp4">` (container `div.reel-media[aria-hidden=true]`). Reel.tsx lazy-loads at 800px, plays only when 20% visible. File ~1.6 MB.
- Fields: `video` (url, mp4, R), `poster` (url, R, LCP-safe), both seeded in `home.showreel.video/poster` (SEEDED-NOT-WIRED; HARDCODED-JSX). Attributes muted/loop/playsInline/preload=none/aria-hidden = FIXED (autoplay policy + perf).
- `span.reel-tag` "<i></i>Showreel ’26" (text <=24, O) = `home.showreel.tag`; `span.reel-time` "00:16" (text <=8, O) = `home.showreel.time` (purely a label, not tied to video length). `<i>` dot FIXED.
- Section id `showreel`, aria-label "Showreel" FIXED/R. Whole section could be O (hide) but then `.blue-run` flows from logos to `#why`.

### 4. Why Visuolab + stats — order 4

- Root `<section class="sec why seam-bottom" id="why"><div class="wrap">` (`HomeIntroRun.tsx`). Type: split label + heading + link list, then stats row.
- `p.label.reveal` "Why Visuolab" (text <=24, R) = `home.why.label`.
- `h2.h2` "*Visuolab* is the right call when you need" (rich, em on first word, <=80) = `home.why.title`.
- Repeater `why.items` (`ul.why-list`; item = {text <=48, href}, ends with FIXED arrow-up-right SVG). Current 6: "Senior designers from day one", "A start within one week", "Guaranteed on-time deliverables", "One team for brand, product and web", "Motion built in, not bolted on", "Clean handoff to any stack"; all href `#contact` (internal anchor). Min 3 / max 8 (2-col grid; even count looks best; 6 current). Seeded `home.why.items` (SEEDED-NOT-WIRED).
- Stats repeater `stats` (`div.stats.reveal-group`, 4 `div.stat`; item = {value: rich with `<em>` suffix, <=6 chars e.g. "9<em>+</em>", label <=28}). Current: "9+ years in business", "140+ products launched", "5.0 average client rating", "30+ industries served". Layout: CSS grid `repeat(4,1fr)`, 2 cols under 900px -> **exactly 4 (or 2) items** is FIXED-count; do not allow arbitrary count. Seeded `home.stats` (NOT WIRED). Note the same figures are repeated in prose ("140+ products" in book-bar, "30+ industries" in industries lead, "60+ reviews" in reviews rating) -> consider shared `site.facts` or keep independent text; AMBIGUOUS.
- `seam-bottom` class and `.sec-grid` FIXED.

### 5. Services — order 5

- Root `<section class="sec light services seam-top seam-bottom" id="services" data-light-offset="320">` (`HomeServices.tsx`). Type: heading + 3-column link lists + "book bar". `light` + `data-light-offset` drive the dark->light nav/theme switch (FIXED; 320 is tuned).
- `p.label` "Services" (R) = `home.services.label`.
- `h2` "<span.keep>Brand, product and web,</span> *designed as one*" (rich: `.keep` = no-break span + `<em>`; seed has title "Brand, product and web, <em>designed as one</em>"; renderer must re-add `.keep` for first clause). <=60.
- `p.lead` "One tight team carries the idea from workshop to launch, so it looks and feels the same on every surface it touches." (textarea <=160) = `home.services.lead`.
- Repeater `columns` (`div.svc-cols`, 3 `.svc`): item = {title <=24, links[] of text <=28 (5 each), icon FIXED per column}. Current: Branding [Brand strategy, Naming, Visual identity, Art direction, Brand guidelines]; Product design [UX research, UI design, Mobile app design, Design systems, Prototyping]; Web & motion [Web design, Webflow development, Next.js sites, Motion design, 3D & illustration]. Layout: 3 columns grid -> **exactly 3 columns**; 4-7 links each tolerated (5 current; keep columns similar length). Each icon pair (`span.svc-ico` arrow + `span.fill` star / monitor / code glyph) = FIXED decorative SVG (per column; if allowing icon choice, use a fixed enum of the 3 existing glyphs).
- Every link `<a href="#contact">` with down-right arrow SVG: href currently all `#contact`. Seeded as plain strings (no hrefs) in `home.services.columns[].links`. DYNAMIC OPPORTUNITY: could link to `services` table pages (`/services/<slug>`, 4 services rows in D1: see `services` table) -- today they are NOT linked to services pages. AMBIGUOUS whether intended; keep `#contact` default, add optional `href`.
- Book bar `div.book-bar.reveal`: avatar `Img.avatar` `/assets/people/jordan.webp` alt="" (decorative, O image); name "Jordan Ellis" (text), role "Founder & Creative Director" (text); `p` "Grow your brand with a team that has shipped 140+ products — and stays until yours is live." (textarea <=140); CTA `a.pill.dark` "Book a call" -> `#contact` (label R, href R). Seeded `home.services.bookBar` {name, role, text, cta} (no avatar/href stored). The `.pill` badge SVG pair FIXED.

### 6. Our cases (CaseStack) — order 6

- Root `<section class="sec seam-top" id="work">` (`HomeWorkRun.tsx`) in `div.blue-run.blue-run-2`. Type: sticky stacking case panels. `#work` anchor FIXED (hero CTA + footer + nav use `/#work`).
- `p.label` "Our cases"; `h2` "Work that *moved the needle*" (rich, <=40) = `home.work.label/title` (SEEDED-NOT-WIRED).
- `CaseStack` (`div.cases#cases`, `src/components/motion/CaseStack.tsx`): desktop (>=901px) sets `--p` on each `.case-panel` to dim/blur the one underneath as the next slides up. CONSTRAINTS: needs >=2 panels to show the effect; last panel gets no --p; sticky stacking is CSS; each panel should be roughly viewport-height. Design tolerates 2-6 (4 designed); `#cases` id FIXED.
- Repeater `cases` (4 `article.case > a.case-panel` linking `/works/<slug>`): DYNAMIC. Slugs from `home.work.slugs` = [orbit, marlow, kite, verdant] = `case_studies` where featured=1 (order by `position`). Item shape (what a panel shows):
  - `ul.tags` 3 `li` (Orbit: Fintech, Series B, Product design; Marlow: Furniture, Rebrand, Packaging; Kite: Dev tools, Launch site, Motion; Verdant: Skincare, Naming, Packaging). Note `case_studies.card_tags_json` is `["Product","Motion"]` (2 tags) so the 3-tag home chips differ -> likely from `showcase_json` (AMBIGUOUS; verify in `src/lib/server/cms.ts`/`showcase_json`).
  - `h3.h3` title: "Orbit cut onboarding drop-off by 41% with a calmer money app" / "A century-old furniture maker gets an identity with as much craft as its chairs" / "Kite's launch site turned a quiet beta into a 12,000-person waitlist" / "Verdant went from name to shelf in ten weeks and sold out its first run". DB `case_studies.title` has `<em>` on key phrase; JSX has none. <=90.
  - `div.review`: `div.src` "Clutch ★★★★★" (label text + stars FIXED glyph string), `<q>` quote (<=160; e.g. "They tailor their solutions to our specific needs and goals. The onboarding redesign paid for itself within a quarter."), `.who` avatar (`/assets/people/maya|harriet|ingrid|aiko.webp`, alt="" decorative, lazy), `<b>` name, `<span>` role.
  - `div.case-media` `Img` `/assets/cases/orbit|marlow|kite|verdant.webp` with alt (e.g. "Pesse fintech app screens — placeholder from Dribbble") -> from `case_studies.card_image_id` + `card_image_alt` (DB). Alt texts currently mention "placeholder from Dribbble" and do not match client names (AMBIGUOUS content debt). `span.case-open[aria-hidden]` arrow SVG FIXED.
- Home status: all 4 panels HARDCODED-JSX; data exists in D1 (`case_studies`, `home.work`). Editor model: section shows "pick featured case studies (ordered, 2-6)" + per-case "home panel" override fields (tags, quote, reviewer name/role/avatar).
- Footer of section: `div.cases-foot` `Link.pill.ghost` "View all projects" -> `/works` (internal; label <=24 = `home.work.allLabel`; href FIXED or R).

### 7. Industries — order 7

- Root `<section class="sec industries" id="industries" aria-labelledby="industries-title">` (inside `HomeWorkRun.tsx`, same `.blue-run-2`). Type: heading + 4-card icon grid.
- `p.label` "Industries we serve"; `h2#industries-title` "Deep in the markets that *move fastest*" (id FIXED for aria-labelledby); `p.lead` "We've shipped brands, products and sites across 30+ industries. These are the four we know best — where our playbooks are sharpest and the results come quickest." (textarea <=220). All = `home.industries.*` (SEEDED-NOT-WIRED).
- Repeater `industries` (`div.ind-grid`, 4 `article.ind-card.reveal`): item {title <=24, text <=140, icon fixed key}. Current: "SaaS & B2B", "Fintech", "Health & wellness", "E-commerce & retail" (+ 1-sentence descriptions). Icons = 4 decorative inline SVG art (`.ind-ico[aria-hidden]`; keys industry-1..4 in seed) = FIXED, bound to card position. Grid is 4 columns (likely 2 on tablet) -> **exactly 4 cards** FIXED count. The lead says "the four we know best" -> copy references the count.

### 8. Process "How we work" — order 8

- Root `<section class="sec process seam-bottom" id="process">` (inside `HomeWorkRun.tsx`). `#process` FIXED (nav/footer use `/#process`). Type: sticky intro + 4-step vertical timeline.
- Intro (`div.intro`): `p.label` "How we work"; `h2` "A process built for *momentum*"; `p.lead` "Four steps, one team, no big reveals. You see the work as it happens and decide on real things — not slide decks." (<=160); `ul.facts` 3 `li` ("8–14 week engagements", "Weekly working sessions", "One shared design file"; text <=32; 2-4 tolerated); CTA `a.pill` "Book an intro call" -> `#contact` (label R, href R). All in `home.process.*` (SEEDED-NOT-WIRED; JSX hardcoded).
- Repeater `steps` (`ol.steps`, 4 `li.step`; `span.node[aria-hidden]` timeline dot = FIXED): item {label <=16, title rich with one `<em>` <=48, text <=170, outputs[] 3x text <=24, when <=14}. Current: Discover ("Understand *before* we design", "1–2 weeks"), Define ("Agree on the *destination*", "1–2 weeks"), Design ("Craft, *in the open*", "4–8 weeks"), Deliver ("Ship it, then *keep going*", "2–4 weeks"); outputs e.g. Research readout/Audit/Success metrics. Rendering: the `when` is the 4th `li.when` inside `ul.out`. Count: copy says "Four steps" and CSS rail height is per-step; tolerate 3-6 but "Four steps" lead must be edited with it -> treat as 4 (min 3, max 6). Outputs 2-4 chips.
- Seed type: `steps[].outputs` + `when`.

### 9. Reviews carousel — order 9

- Root `<section class="sec light reviews seam-top" id="reviews" data-light-offset="220">` (`HomeReviews.tsx`; NOT `ReviewsSection` -- that shared component is used by Works/Service and renders an extra `<Aurora/>`; Home uses its own markup). `#reviews` + light-offset FIXED.
- Heading: `p.label` "Verified reviews"; `h2` "What our *clients* say" (rich); `div.rating` "**5.0** ★★★★★ 60+ reviews on Clutch" (rating text, <=40: `b`=5.0, stars fixed glyphs, trailing text). Seed `home.reviews` {label, title, rating:"5.0 ★★★★★ 60+ reviews on Clutch"} (NOT WIRED). Rating b/stars markup FIXED.
- `CarouselNav` (`div.carousel-nav`): 2 `button.round-btn[data-carousel=prev|next]` with `aria-label="Previous"`/`"Next"` + arrow SVGs. FIXED (JS reads `[data-carousel]` and `#carousel`; scrolls by card width+16).
- Track `div.carousel#carousel` (horizontal scroll-snap; `id="carousel"` FIXED). Repeater `reviews` (5 `article.review-card`), item {avatar (img src, alt="", lazy), company <=24 (`span.logo`, with `<i>` coloured dot via inline `background`: #ffb86b, #8a4dff, #1fa88a, #0b0b0e; Orbit uses default dot), quote <=120, name <=28, role <=44, city <=24}. `span.mark[aria-hidden]` "“" FIXED. Current: Maya Rao (Head of Product, Orbit, New York NY), Harriet Marlow (Managing Director, Marlow & Co., London UK), Ingrid Halvorsen (Co-founder, Kite, Berlin DE), Aiko Sato (Founder, Verdant, Tokyo JP), Rosa Almeida (VP Marketing, Northwind, Lisbon PT). Quotes: "They tailor their solutions to our specific needs and goals." / "They organized their work and internal management was outstanding." / "Working with them was a great experience. It's the site our investors forward." / "Meticulous attention to detail and creative problem-solving from the first workshop." / "The rare agency that cares as much about the handoff as the pitch."
- Source: ALREADY-IN-DB `site_settings` key `reviews` + `src/content/reviews.ts` (`ReviewSeed`: avatar, company, dot?, quote, name, role, city) -- same list shared by Home (hardcoded copy), Works, services. Min 3 / max ~10 (overflow scroll; <3 leaves empty track, fewer than visible cards disables meaning of arrows). Quotes in home case panels are longer variants of the same first sentence (case showcase), kept separate.
- Rating line "60+ reviews on Clutch" duplicates across Works/Service pages (ReviewsSection hardcodes it). One shared field recommended.

### 10. Closing CTA / #contact — order 10 (layout-level, not in home/*)

- Root `<section class="cta" id="contact">` in `src/components/site/chrome/CtaBand.tsx`, rendered by `ShellFooter` on every page except `/contact`. Type: CTA band. `#contact` anchor FIXED: Home hero, why list (6), services links (15), book bar, process CTA all point to it; footer/nav also.
- Fields:

| key | type | current | stored | flag |
|---|---|---|---|---|
| cta.title | rich | "Ready to discuss your *project* with us?" (em: project) | seeded `site.cta.title` (NOT WIRED; JSX hardcoded) | R |
| cta.lead | textarea <=160 | "Tell us where you are and where you want to be. We'll come back within a day with how we'd get you there." | `site.cta.lead` (NOT WIRED) | R |
| cta.action1 | label+href | "Book a call" -> `mailto:{email}` | label hardcoded; EMAIL = `settings.contact.email` via `useSiteConfig().email` (ALREADY-IN-DB, wired) | label R, href derived (mailto) |
| cta.action2 | arrow-link | "{email} " -> `mailto:{email}` + arrow | email from `settings.contact.email` (wired) | derived, F |
| cta.avatars | image list | 3 avatars (`/assets/people/jordan.webp`, `team-2.webp`, `aiko.webp`, alt="") + `span.plus` "+" + `span.you` "You" | seed `site.cta.avatars` (NOT WIRED) | images O (2-4); "+"/"You" text FIXED/O |
| cta.floaters | image list | 4 `div.floater.f1..f4`, `aria-hidden`, lazy: `/assets/cases/orbit|kite|marlow|verdant.webp` alt="" | seed `site.cta.floaters` | FIXED count 4 (CSS positions f1..f4); images swappable |
- Dynamic: floaters reuse case-study card images; email from site settings. The CTA is shared by all pages, so a Home-only override would be new (currently one global CTA, `site.cta` seed key).

### 11. Footer (home variant) — layout-level, context only

`Footer variant="home"`: brand link `#top`, light logo; menus from `navigation_items` (D1, `getNavigation`), links to own page become anchors (`/#process` -> `#process`); site settings (name, logo, email, socials) from `settings.*`; newsletter form (`NewsletterForm`) text in `site.footer` seed. Outside the Home schema; managed by Navigation/Settings. Anchors it needs on Home: `#top`, `#work`, `#process`, `#contact`, `#services`, `#reviews`, `#showreel`, `#why`, `#industries` -> all section ids FIXED.

---

### Fixed-for-integrity summary (Home)

- Section order and wrappers (`blue-run`, `blue-run-2`), all section ids (`top, showreel, why, services, work, industries, process, reviews, contact`), `seam-top/seam-bottom`, `light` + `data-light-offset` (theme switch positions).
- Hero art, MeshFlow/Stars, hand/orb images and sizes, `.reveal`/`.reveal-load`/`--i` hooks, `.pill` badge SVG pairs, arrow SVGs, `.svc-ico` glyphs, `.ind-ico` art, `.node` dots, `mark` quote glyph, carousel nav wiring (`data-carousel`, `#carousel`), `#cases`, video attributes.
- Counts that drive layout: stats = 4 (grid), service columns = 3, industries = 4, CTA floaters = 4, hero CTA = 2 (second optional).
- Flexible with limits: why list 3-8, services links 4-7/column, cases 2-6 (CaseStack needs >=2), process steps 3-6 (copy says four), reviews 3-10, logos 6-14, facts 2-4, outputs 2-4.
- Optional sections (hide-able): showreel, logos band, industries, process, reviews (but #why anchors/footer links to `#process`, `#reviews` would dangle -> nav must tolerate; `.blue-run` continuity if first/last section in a wrapper is removed).

### Animation/length constraints

- Hero title: pinned stage, <=3 lines; reveal-load stagger only on load.
- Reel: video must be mp4, poster required; scroll scaling via `--p`; preload none until 800px away.
- CaseStack: >=2 `.case-panel`, desktop only; mobile (<901px) is a plain stack.
- Marquee: 38s loop, needs the list rendered twice; very few items leaves visible gap.
- Carousel: card width read from first `.review-card` (+16px gap); needs >=1 card.
- Reveal: `.reveal` elements fade on intersection; `.reveal-group` children staggered via inline `--i` (indexes 0..n; renderer must keep generating `--i`).

### Ambiguities / issues

1. No `home.*` key is read anywhere at runtime; D1 seed content equals the JSX but is dead data.
2. Home has its own hardcoded reviews/logos copy instead of `reviews`/`trusted_by` settings or `ReviewsSection`/`LogoMarquee` (drift risk).
3. Case title `<em>` exists in DB but not in Home JSX.
4. Seed `home.hero.title` lost the `.nb` wrapper and `<em>brand</em>`'s trailing comma handling.
5. Case image alts say "placeholder from Dribbble" and name other brands (Pesse, Hovra, Lumina, Leafora).
6. Settings schema (`src/lib/settings/schema.ts`) has no `home.*` validators; there is no admin editor for them yet.

---

# Part 2. About `/about`

### 0. Page overview /about

- Route: `src/app/(site)/about/page.tsx`. Renders (in order): `JsonLd` then `AboutHeroRun`, `AboutPrinciples`, `AboutMission`, `AboutStory`, `AboutManifesto`, `AboutPlaces`, `AboutFaqRun` (FAQ + Careers). Layout then appends `ShellFooter` = `CtaBand` (`#contact`) + `Footer` (variant "about").
- **KEY FINDING: every About section is HARDCODED-JSX today.** None of the components read the DB. The D1 `site_settings` rows `about.hero`, `about.principles`, `about.mission_vision`, `about.milestones`, `about.manifesto`, `about.offices`, `about.faq`, `about.roles` exist in `db/seed/content.sql` (lines 147-154, generated by `scripts/db/generate-seed.mjs` lines 217-230 from the original about.html), and `scripts/db/verify.mjs:135` checks their item counts (faq 6, principles 5, milestones 5, offices 4, roles 4, mission_vision 2). But `grep` finds NO reader in `src/` (not in `src/lib/server/cms.ts`, `site-config.ts`, `src/lib/settings/schema.ts`; no zod schema, no admin editor). So: ALREADY-IN-DB = seeded rows only (unused); the render path is HARDCODED-JSX. Status tag below: "DB-seeded (unused)" means the value exists in the seed JSON under the named key but the page ignores it.
- Seed JSON shapes already designed (reuse as the section schemas):
  - `about.hero` {label, title(rich with `<em>`), lead, facts[]}
  - `about.principles` {label, title, lead, items[{num,title,text}]}
  - `about.mission_vision` [{tag,title,text}] (array of 2)
  - `about.milestones` {label, title, items[{year,title,text}]}
  - `about.manifesto` {label, text(rich `<em>`)}
  - `about.offices` {label, title, lead, items[{tz,city,country,flag}]} (flag = name only, SVG is in JSX)
  - `about.faq` {label, title, lead, cta, items[{id,q,a}]}
  - `about.roles` {label, title, items[{title,meta,subject}]}
  - Not in seed: hero mosaic items, hero image/3D, #careers/FAQ structure beyond the above, CTA band copy.
- Rich-text convention: titles use `<em>x</em>` for the serif-italic accent. Hero h1 also has two `<br/>` line breaks (not in seed JSON: seed title is "Design that carries <em>one idea</em> from sketch to launch." with no br; JSX has `<br/>` after "carries", after "from", so the br must be restored by the renderer or kept as a `\n`/rich tag).
- Dev-server rendered HTML confirms all text below verbatim (cases `/assets/cases/*.webp`, flags are inline SVG, clocks render `--:--` on the server and tick on the client).

### 1. SEO (page-level)

| Item | Current value | Where stored | Status |
|---|---|---|---|
| title | "About — Visuolab" | site_settings `seo` -> `pages.about.title` (schema.ts line 100, default line 146), max 70 | ALREADY-IN-DB (editable via SEO settings) |
| description | "Visuolab is an independent design agency. What started as two designers in 2017 now ships brands, products and websites for teams on four continents." (max 200, min 20) | `seo.pages.about.description` | ALREADY-IN-DB |
| robots/noindex | `index, follow`; `seo.pages.about.noindex` bool; global `seo.indexing` false also forces noindex | seo settings | ALREADY-IN-DB |
| canonical | `{siteUrl}/about` (path fixed in `PATHS` seo.ts:49) | derived | FIXED |
| OG/Twitter | og:title/description = page title/desc; og:url, og:site_name "Visuolab", og:type website, locale en_GB; twitter:card "summary" (summary_large_image only if global `seo.ogImage` set); no per-page OG image (`fixedPageSeo` called without `image`) | seo settings + layout generateMetadata | Page-specific OG image: not supported today (could be added; OPTIONAL) |
| JSON-LD | Organization (layout, from site settings) + `AboutPage` node {name=title, description} + `BreadcrumbList` (About) via `fixedPageSeo` seo.ts:52-66 | derived from the seo fields | FIXED (auto from title/description) |

Note: FAQ content is NOT emitted as FAQPage JSON-LD today (not in seo.ts). Could be derived from the FAQ repeater (optional enhancement).

### 2. Hero  (order 1)

- Root: `div.hero-run.has-aurora` > `section.about-hero#top[aria-labelledby=about-title]`. File: `src/components/site/about/AboutHeroRun.tsx`. Type: hero (copy + 3D scene) followed by a mosaic marquee (section 2b). Aurora `div.aurora[aria-hidden]` with `span.s1`/`.s2`: FIXED decorative.

| key | type | current | stored | req |
|---|---|---|---|---|
| hero.label | text (<=30) | "About Visuolab" | HARDCODED-JSX; DB-seeded (unused) `about.hero.label` | required |
| hero.title | rich (<=90; `<em>` + line breaks) | "Design that carries⏎**one idea** from⏎sketch to launch." (`<em>one idea</em>` is emphasised; `<br/>` x2; h1#about-title, inline `margin-top:18px` fixed) | HARDCODED-JSX; seed `about.hero.title` (no `<br>`) | required |
| hero.lead | textarea (<=220) | "Fourteen designers, strategists and design engineers across four continents. No account managers, no hand-offs — the people you meet on the first call do the work." | HARDCODED-JSX; seed `about.hero.lead` | required |
| hero.facts | list of text (chips, each <=24) | "Founded 2017", "14 people, one team", "Lisbon & remote", "140+ launches" | HARDCODED-JSX; seed `about.hero.facts` | optional list; 2-5 items (flex-wrap pills tolerate 0-6) |

- 3D scene: `<AboutScene style="--i:1">` (`src/components/motion/AboutScene.tsx`) renders `div.about-3d.reveal[aria-hidden]`; lazy-imports `@/lib/motion/scene` (three.js) at idle. No editable fields. FIXED (decorative, aria-hidden, size set in CSS `.about-3d`).
- Animation: `.reveal` with `--i` stagger values (0,1,2) are FIXED.
- FIXED: `id="top"`, `aria-labelledby`, h1 element, `.reveal` classes, `--i` indexes.
- Mobile: facts wrap; title with forced `<br>` should be tolerated; keep title <= ~3 lines.

### 2b. Hero mosaic marquee  (order 1b)

- Root: `section.mosaic[aria-label="Selected projects"]` > `div.mosaic-track` (in `AboutHeroRun.tsx`). Type: infinite horizontal marquee (CSS `@keyframes mosaic` 60s linear, translateX(-50%), pause on hover; none under reduced motion).
- 16 `<a>` tiles = a 4-item sequence repeated 4x: Orbit, Marlow, Kite, Verdant. Each: `Link href=/works/{slug}` > `figure` > `Img src=/assets/cases/{slug}.webp alt="{Name} — {Kind}" loading=lazy` + `figcaption` `<b>Name</b><span>Kind</span>`.

| item | href | src | alt | figcaption |
|---|---|---|---|---|
| 1 | /works/orbit | /assets/cases/orbit.webp (srcset 128..1600w, sizes "(max-width: 900px) 100vw, 760px") | "Orbit — Fintech app" | Orbit / Fintech app |
| 2 | /works/marlow | /assets/cases/marlow.webp | "Marlow & Co. — Rebrand" | Marlow & Co. / Rebrand |
| 3 | /works/kite | /assets/cases/kite.webp | "Kite — Launch site" | Kite / Launch site |
| 4 | /works/verdant | /assets/cases/verdant.webp | "Verdant — Packaging" | Verdant / Packaging |

- Status: HARDCODED-JSX (no seed key). Dynamic relationship: these are the case studies (D1 `case_studies`: slug, title, client_name, type_line/short_kind, card_image). Best modelled as a "featured case studies" picker (reference by slug; name/kind/image derived from the case study; alt derived), NOT free text.
- Constraints: the marquee needs the track to be a seamless loop: `translateX(-50%)` means the sequence MUST be duplicated an even number of times (group repeated, the second half identical to the first). The renderer should repeat the chosen N items to fill >= 2x viewport width in two identical halves. Today = 4 items x 4 = 16 tiles (tile width clamp(224px,25.2vw,420px), 4:3). Tolerated picks: 3-8 (repeat to keep two equal halves; with few items increase repetitions). Animation duration 60s is fixed (speed would change with item count unless adapted: FIXED).
- Optional: whole mosaic section may be hidden (OPTIONAL section toggle). Figure dims fixed by CSS (aspect 4/3); no width/height attrs on img.
- FIXED: `aria-label`, hover-pause, duplication logic, figcaption styling.

### 3. Principles  (order 2)

- Root: `section.sec#principles[aria-labelledby=principles-title]` > `.wrap > .principles`. File: `AboutPrinciples.tsx`. Type: split heading + numbered list (`.principle-list`).

| key | type | current | stored | req |
|---|---|---|---|---|
| principles.label | text | "How we think" | JSX; seed `about.principles.label` | optional |
| principles.title | rich (`<em>`) | "The principles **behind** the work" | JSX; seed `.title` | required |
| principles.lead | textarea (<=120) | "Five things we won't compromise on, whatever the brief." | JSX; seed `.lead` | optional |
| principles.items[] | repeater | 5 items {num, title (<=40), text (<=140)} | JSX; seed `.items` | min 3 / max ~6 (layout is a vertical list; stagger `--i` = index, tolerates growth) |

Items: 01 "Craft over volume" — "We take on a handful of projects at a time so senior people stay on yours from kickoff to launch."; 02 "One idea, every surface" — "Brand, product and web are designed by the same hands, so the story doesn't drift between them."; 03 "Motion is meaning" — "Animation earns its place by explaining, guiding or delighting — never by default."; 04 "Decide on real things" — "Concepts, prototypes and working files replace slide decks. You see the work as it happens."; 05 "Ship, then keep going" — "Launch is a milestone, not the finish line. We stay to measure, learn and iterate."

- `num` ("01".."05") should be auto-generated from index (pad 2), not editable (derived; also seeded as a field, ambiguous). Lead says "Five things" (copy depends on item count: editor note).
- Links: none. Images: none. FIXED: id `principles`, `.reveal` + `--i` indexing, h3 per item.

### 4. Mission and Vision  (order 3)

- Root: `section.sec[aria-label="Mission and vision"]` (no id) > `.mv` two `div.mv-card.reveal`. File: `AboutMission.tsx`. Type: two light cards (2-col grid, 1-col mobile).

| key | type | current | stored | req |
|---|---|---|---|---|
| mission.tag | text (<=30) | "The image of the future" | JSX; seed `about.mission_vision[0].tag` | optional |
| mission.title | text (<=16, big h3 40-68px) | "Mission" | same | required |
| mission.text | textarea (<=260) | "To design brands, products and websites that carry one idea faithfully from the first sketch to the last screen — with small senior teams, honest advice, and the patience to stay past launch and keep improving what we shipped." | same | required |
| vision.tag | text | "Our ambition" | seed `[1].tag` | optional |
| vision.title | text | "Vision" | | required |
| vision.text | textarea (<=260) | "To be the studio founders call first — trusted with the work that defines a company, still around when it's time to evolve it, and a place where every launch raises the bar for the next one." | | required |

- Fixed 2-card pair (design is a 2-col grid): FIXED count = 2 (not a repeater for editors; a 3rd card would break the grid). h3 has `em` CSS style but no `<em>` used today (title plain text). No section heading/label: section has no visible heading, only aria-label (aria-label "Mission and vision" FIXED or optional text).

### 5. Story timeline  (order 4)

- Root: `section.sec.story.has-aurora.glow-right#story[aria-labelledby=story-title]`. File: `AboutStory.tsx`. Type: heading + 5-column horizontal timeline (`ol.timeline.reveal-group`). Aurora decorative FIXED.

| key | type | current | stored | req |
|---|---|---|---|---|
| story.label | text | "Our story" | JSX; seed `about.milestones.label` | optional |
| story.title | rich (<=100) | "From **two laptops** in Lisbon to a studio on four continents" | JSX; seed `.title` | required |
| story.items[] | repeater | 5 {year (<=4), title (<=36), text (<=150)} | JSX; seed `.items` | see constraint |

Items: 2017 "Two designers, one desk" — "Visuolab starts as a two-person brand studio in a shared Lisbon workspace. First client: a seed-stage fintech that is still with us."; 2019 "Product joins brand" — "The first product-design retainer turns a brand shop into a full design studio. Five people, first Clutch reviews."; 2021 "Remote by design" — "We go fully distributed, with teammates in Toronto and Singapore, and become a Webflow professional partner."; 2023 "The hundredth launch" — "Design engineering and motion become core disciplines. First Awwwards Site of the Day."; 2026 "Today" — "Fourteen people across four continents, 140+ launches — and still no account managers between you and the work."

- CONSTRAINT: CSS `.timeline{grid-template-columns:repeat(5,...)}` hard-codes 5 columns (3 at <=1100px, 1 col vertical at mobile). Layout-driving count: 5 exact is the safe value; 3-5 would leave empty columns; 6 wraps to a second row; recommend min 5 / max 5 (or make `repeat(N)` dynamic via `--n` which needs a CSS change = design change). Mark count FIXED=5 unless CSS is parameterised. The progress line (`::after`, scroll `animation-timeline:view()`) is FIXED.

### 6. Manifesto  (order 5)

- Root: `section.sec.manifesto#manifesto[aria-labelledby=manifesto-title]`. File: `AboutManifesto.tsx` + `src/components/motion/ScrollWords.tsx`. Type: scroll-driven word highlight paragraph.

| key | type | current | stored | req |
|---|---|---|---|---|
| manifesto.label | text | "Why Visuolab exists" (it is the `p.label#manifesto-title`, doubling as aria-labelledby target) | JSX; seed `about.manifesto.label` | required (aria target; or fall back to fixed text) |
| manifesto.text | rich (`<em>` only; <=420) | "We started Visuolab because we were tired of watching **good ideas** get diluted between the deck, the design and the build. So we built a studio where **the same people** carry an idea from the first sketch to the last screen — and stay accountable for how it performs. Small on purpose. Senior by default. **Honest** about what will and won't move the needle." (3 `<em>` spans) | JSX; seed `about.manifesto.text` (HTML string) | required |

- Constraint: `ScrollWords` splits text into per-word `<span class=w>` and sets `--o` per word on scroll (progress = scroll through the paragraph; any text length works, ramp is proportional to word count). Only plain text and `<em>` are supported (the splitter walks strings and elements recursively; other tags would also work but `<br>` is untested). Design width `max-width:38ch`, font clamp(26px,3.3vw,54px); keep roughly 40-80 words (today ~66) so it does not overflow the viewport-height scroll. Needs to be passed as React children, so the CMS rich string must be parsed to nodes (render HTML safely, not dangerouslySetInnerHTML-as-single-blob, because words must be wrapped).
- FIXED: `data-scroll-words`, `.manifesto-text` classes, id `manifesto`.

### 7. Where we work (clocks)  (order 6)

- Root: `section.sec.places#places[aria-labelledby=places-title]`. File: `AboutPlaces.tsx` + `src/components/motion/Clock.tsx`. Type: heading + 4-up live clock grid (`div.clocks.reveal-group`; 4 cols, 2 at <=1100px, 1 at mobile).

| key | type | current | stored | req |
|---|---|---|---|---|
| places.label | text | "Where we work" | JSX; seed `about.offices.label` | optional |
| places.title | rich | "Four continents. **One working day.**" | seed `.title` | required |
| places.lead | textarea (<=240) | "Lisbon is home. Toronto, Singapore and Sydney keep the sun up on your project — whatever your timezone, there are at least four shared hours a day and a designer who's awake." | seed `.lead` | optional |
| places.items[] | repeater {tz (IANA select), city (<=20), country (<=24), flag (select from a fixed flag-SVG set or upload)} | Lisbon / Europe/Lisbon / "Portugal · HQ" / PT flag; Toronto / America/Toronto / "Canada"; Singapore / Asia/Singapore / "Singapore"; Sydney / Australia/Sydney / "Australia" | JSX (flags are inline SVG components in JSX, aria-label = country name); seed `.items` stores only flag name | see below |

- Clock behaviour (FIXED, not editable): client component reads `Intl.DateTimeFormat(tz)`; ticks every 1s; server renders `--:--` placeholder; status text "Working now"/"After hours"/"Weekend" (working = Mon-Fri 09:00-18:00 local; strings and thresholds are hardcoded in `Clock.tsx`); the `off` class dims the card; `data-tz` attribute. `offset` text (GMT+1) is generated.
- Count constraint: grid is `repeat(4,...)`; 4 is the design count (counts of 2-3 leave blank space; 8 wraps to two rows fine). Recommended min 2 / max 8, ideal multiples of 4 (or 2 at tablet). Title "Four continents" and lead text depend on count/content (editor must align copy).
- Flag: SVG `viewBox 0 0 30 20`, `role=img aria-label={country}` with `<title>`. Needs an asset field: either a curated flag library keyed by ISO code (recommended, FIXED SVG set) or an image upload (alt required). Today HARDCODED-JSX (4 hand-drawn flags).
- FIXED: id `places`, `.reveal-group`, per-card `--i` index.

### 8. FAQ  (order 7a)

- Root: `div.faq-run.has-aurora.glow-left` wraps TWO sections (FAQ and Careers) with an `aurora` decoration (FIXED). FAQ: `section.sec.faq#faq[aria-labelledby=faq-title]` > `.wrap > .faq-grid`: left `.faq-intro` (label, h2, lead, pill CTA) + right `Faq` accordion. File: `AboutFaqRun.tsx` + `src/components/motion/Faq.tsx`. Type: FAQ accordion.

| key | type | current | stored | req |
|---|---|---|---|---|
| faq.label | text | "FAQ" | JSX; seed `about.faq.label` | optional |
| faq.title | rich | "Questions **we get** a lot" | seed `.title` | required |
| faq.lead | text | "Can't find yours? Write to us — a real person answers within a day." | seed `.lead` | optional |
| faq.cta.label | text (<=24) | "Ask us anything" | seed `.cta` | optional (hide pill if empty) |
| faq.cta.href | link | `mailto:{site email}` (email = `getSiteConfig().contact.email` = hello@visuolab.studio) | site_settings `site.contact` (contact.email) | derived; allow override |
| faq.items[] | repeater {id, q (<=80), a (<=320, plain text)} | 6 items | JSX; seed `.items` (also has `id` qa-1..qa-6) | min 3 / max ~10; first item opens by default |

Items: (1) "What does a typical engagement look like?" — "Most projects run six to fourteen weeks: a brand or product sprint first…"; (2) "How do you price?" — "A fixed price per scope for defined projects and a flat monthly rate for retainers…"; (3) "Who will actually work on our project?" — "The people you meet in the first call. A lead designer, a design engineer and a strategist…"; (4) "Do you work with early-stage startups?" — "Yes — about a third of our launches are pre-Series A…"; (5) "Do you build what you design?" — "Yes. Webflow for marketing sites, Next.js when the product needs it…"; (6) "What happens after launch?" — "We stay. Most clients keep us on for a few months of measuring, learning and iterating — and 72% come back for the next thing."

- `Faq` behaviour (FIXED): React state, one open at a time, clicking open item closes it; item 0 starts open; `aria-expanded`/`aria-controls`/`id` wiring generated from `item.id` (ids must be unique `qa-N`: generate from index, not editable); the `+` icon `<i aria-hidden>` is decorative; answer body is plain `<p>` (no rich text). `index={1}` is the `--i` stagger. Answer panel animates height by CSS (answers 2-4 lines tolerated).
- Intro right-column pill: `a.pill` with two duplicate arrow SVGs in `span.badge` (FIXED decorative).
- Not FAQPage JSON-LD today (see SEO).

### 9. Careers / Open roles  (order 7b)  — anchor #careers

- Root: `section.sec#careers[aria-labelledby=careers-title]` (inside the same `.faq-run`). File: `AboutFaqRun.tsx`. Type: list of linked rows (`.roles` > `a.role`). Footer/nav link `/about#careers` points here (nav-data.ts line 61): id `careers` FIXED.

| key | type | current | stored | req |
|---|---|---|---|---|
| careers.label | text | "Careers" | JSX; seed `about.roles.label` | optional |
| careers.title | rich | "Open **roles**" | seed `.title` | required |
| careers.items[] | repeater {title (<=48, `<b>`), meta (<=40, `<span>`), subject (mail subject)} | 4 | JSX; seed `.items` | min 0 (hide section) / max ~10 |

Items: "Senior Product Designer" / "Lisbon or remote · Full-time" / subject "Senior Product Designer"; "Design Engineer (Webflow / Next.js)" / "Remote · Full-time" / "Design Engineer"; "Brand Designer" / "Lisbon · Full-time" / "Brand Designer"; "Don't see your role? Write to us anyway" / "Open application" / "Open application".

- Link: each row href = `mailto:{contact.email}?subject={encodeURIComponent(subject)}` (external mailto). Email comes from site settings `contact.email`. Better modelled as: item link type = email (auto) or custom URL (optional). The last row is the "open application" fallback (could be a separate fixed-last item).
- Icon: `svg` arrow-up-right, FIXED decorative. Heading block has inline `margin-bottom:clamp(28px,4vh,40px)` FIXED.
- Dynamic relationship: none (no `jobs` table). If zero roles, hide the whole section; nav link "Careers" (`/about#careers`) would then hit a missing anchor: warn editor or keep the section with an "open application" only.

### 10. CTA band (shared, rendered below page)  (order 8)

- Root: `section.cta#contact` in `src/components/site/chrome/CtaBand.tsx` via `ShellFooter` (hidden on /contact only). Same on every page. Type: CTA band with floating thumbnails and avatars.
- Fields (all HARDCODED-JSX, NO seed key; shared across pages): h2 "Ready to discuss your **project** with us?" ; lead "Tell us where you are and where you want to be. We'll come back within a day with how we'd get you there."; pill "Book a call" -> `mailto:{email}`; arrow-link "`{email}`" -> `mailto:{email}` (label = email text, from site settings `contact.email` via `useSiteConfig().email`).
- Images: 4 `.floater` images `/assets/cases/{orbit,kite,marlow,verdant}.webp` alt="" (decorative, aria-hidden group); 3 avatars `/assets/people/{jordan,team-2,aiko}.webp` alt="" + `+` and "You" chips. Treat as FIXED decorative (or global-CMS "CTA band" section, not an About-specific field).
- Anchor `#contact` is used by nav/footer links: FIXED.
- Recommend: belongs to a global/shared CTA settings (not About-specific). Not in scope of the about.* keys.

### 11. Footer (shared)

- `Footer variant="about"`: darkLogo true; footer links pointing into the current page are converted to bare anchors (`/about#careers` -> `#careers`) (Footer.tsx lines 7-21). Content from the `site.footer` / navigation settings (D1 navigation tables, migration 0015). Not About-owned; FIXED for this audit.

### 12. Fixed-for-design-integrity checklist (About)

| Item | Reason |
|---|---|
| Section ids: `top` (hero), `principles`, `story`, `manifesto`, `places`, `faq`, `careers`, `contact` | anchor links (nav `/about#careers`, footer, in-page) and aria-labelledby targets |
| `aria-labelledby` ids `about-title`, `principles-title`, `story-title`, `manifesto-title`, `places-title`, `faq-title`, `careers-title` | a11y wiring |
| `.reveal`, `.reveal-group`, `--i` stagger values | reveal-on-scroll observer + early-reveal script (layout.tsx) |
| `.aurora` + `.s1/.s2`, `.glow-left/.glow-right`, `.has-aurora` | decorative backgrounds |
| `AboutScene` / `.about-3d` (three.js) | decorative 3D, aria-hidden |
| Flag SVG internals, arrow SVGs (`.badge` double arrow, `.role` arrow) | decorative icons |
| Timeline column count 5; clocks column count 4; mv-card count 2 | CSS grids hard-code those counts |
| Mosaic duplication x4 / `translateX(-50%)` loop, 60s duration | seamless marquee |
| Clock status text/hours, tick logic | component logic |
| Faq state logic (one open, first open), ids pattern | accordion behaviour and aria-controls |
| Manifesto word-split + `--o` scroll ramp | scroll animation |
| Hero `<br/>` positions in h1 | design line breaks (keep as optional soft line-break marker) |

### 13. Optional / required summary

- Whole-section hide-able (no anchors elsewhere): Mosaic (2b), Principles, Mission/Vision, Story, Manifesto, Places. Hiding Careers breaks nav `/about#careers`; hiding FAQ intro CTA pill is safe; hiding FAQ section is safe but Careers shares `.faq-run` wrapper (keep wrapper if either present).
- Required inside each present section: heading (title) and body/items. Eyebrow labels and leads are optional (layout tolerates missing `<p class=label>`/`.lead` except manifesto label which is the aria target).

### 14. Ambiguities / notes

- `about.hero` etc. exist in D1 seed but there is no loader or zod schema for them: building the CMS means writing schemas that match the seed JSON and switching the components to read them (no design change).
- Hero seed title lacks the `<br>` line breaks present in JSX.
- Principles `num` and FAQ `id` are seeded as data but are derivable from index.
- Mosaic/CTA band case images are static asset paths, not media-library ids; the media library (`mediaId` pattern in schema.ts) is the likely target.
- No per-page OG image support in `fixedPageSeo` for About.

---

# Part 3. Services `/services` and `/services/[slug]`

### 0. Routes and storage overview

- `/services` (`src/app/(site)/services/page.tsx`): renders nothing. `permanentRedirect("/#services")` (verified: HTTP 308 to `/#services`). No fields. There is no services index page in the original either; "Services" in the nav only opens the mega menu. The home page has its own "Services" section/cards (other audit).
- `/services/[slug]` (`src/app/(site)/services/[slug]/page.tsx`): `force-dynamic`, reads D1 via `getServiceBySlug()` (src/lib/server/cms.ts:174, `getServices` at :47). Published services for everybody. Unknown slug: `slug_redirects` (kind `service`) gives 308; else admin-only preview of draft/archived (noindex, no JSON-LD); else 404. Renders `ServicePage` (src/components/site/service/ServicePage.tsx) and `JsonLd`.
- Storage: table `services` (migrations/0005_services_case_studies.sql). Real columns: `slug, title, status, position, meta_title, meta_description, hero_title, hero_lead, hero_cta_label, hero_cta_href, hero_image_a_id, hero_image_b_id, show_problems, show_band`. JSON columns: `hero_shots_json, problems_json, overview_json, outcomes_json, band_json, included_json, process_json, cases_json`. Link table `service_case_studies (service_id, case_study_id, position)`. Images come from `media` by id.
- `src/content/services.ts` (1516 lines) is NOT read by the routes any more (docs/SERVICES-CMS.md); only used by `db:verify` and as seed source. Content in D1 equals the seed (rendered text checked against the seed for all four services).
- Admin: `/admin/services` (+ `new`, `[id]/edit`, confirm). Form: `src/components/admin/ServiceForm.tsx`; validation `src/lib/validation/service.ts`; persistence `src/lib/server/services-admin.ts`.
- Legend: ALREADY-IN-DB (stored in D1 AND editable in the existing Service form unless marked "DB, not editable"), IN-CODE-ONLY (src/content/*.ts), HARDCODED-JSX.
- Template wrapper: `<div class="svc-page">` (FIXED: the original put this class on `<body>`; all service CSS is descendant selectors of it). Hero + problems + overview are wrapped in `<div class="svc-run hero-run has-aurora">` with `<Aurora/>` (FIXED decorative glow; the run lets the aurora span three sections).
- Reveal animation: every `.reveal` element carries `style="--i:N"` stagger index. FIXED (animation hook, set by the component from list index, `i % 3` for 3-col grids).
- Page order (verified in rendered HTML): hero, problems (hidden), overview, outcomes, band (hidden), included, process, cases, reviews, then the global CTA band (`<section class="cta" id="contact">`, from the layout `CtaBand.tsx`), then footer.

Services in D1 (position order): brand-identity, product-design, web-design-build, motion-3d. All four have status published, identical shape (see the counts table at the end).

---

### 1. Hero `section.svc-hero#top` (aria-labelledby `svc-title`)

Source: ServicePage.tsx lines ~22-57. Type: hero (two-column copy + two stacked images) + "Trusted by" marquee. Order 1. Inside `.wrap > .svc-lead-grid > (.svc-copy, .svc-shot)`.

| field key | type | current value (brand-identity; others in section 11) | where | rule |
|---|---|---|---|---|
| title (`hero_title`) | rich (`<em>` and `<b>` allowed) | "A brand that still makes sense when the company `<em>doubles in size</em>`" (h1#svc-title, class `h1 reveal`) | DB, editable (`heroTitle`, max 200) | REQUIRED. CSS `.svc-hero .h1` max-width 16ch desktop / 20ch tablet, clamp 38-72px: keep under ~100 chars to stay within 4 lines. One `<em>` phrase per headline in all 4 current services |
| lead (`hero_lead`) | textarea | "Name, look, voice and the rules that keep them consistent — built from…" (`p.lead`) | DB, editable (`heroLead`, max 400) | REQUIRED |
| cta.label (`hero_cta_label`) | text | "Start a project" (all 4) | DB, editable (`heroCtaLabel`, max 40) | REQUIRED |
| cta.href (`hero_cta_href`) | link (internal path / #anchor / mailto / https) | "/contact" (all 4), rendered with `.pill` + `PillBadge` arrow | DB, editable (`heroCtaHref`, max 300) | REQUIRED. Pill arrow badge FIXED (decorative) |
| rating badge | HARDCODED-JSX | stars "★★★★★" + "**5.0** · 60+ reviews on Clutch" (`.rev-badge`) | HARDCODED-JSX | Not editable today. Same copy repeats in the reviews section and on Home. Recommend making it a global site-level "Clutch rating" setting (optional/hideable) rather than per-service. Stars glyphs FIXED |
| shot A image (`hero_image_a_id`) | image (media id) | brand-identity: `/assets/cases/marlow.webp` 1200x900, `fetchPriority="high"` (LCP) | DB, editable (`heroImageA`, required, picker from media table) | REQUIRED. width/height auto-filled from media row (or kept if unchanged); `priority` is forced true for A, `lazy` true for B by `columns()` in services-admin.ts. FIXED: priority/lazy flags |
| shot A alt (`hero_shots_json[0].alt`) | text | "" (empty for all 4) | DB, editable (`heroImageAAlt`, optional, max 200) | OPTIONAL. The whole `.svc-shot` is `aria-hidden="true"`, so alt is not announced; keep empty/decorative. Note SEO uses alt only for og:image:alt (falls back to hero title text) |
| shot B image (`hero_image_b_id`) | image | brand-identity `/assets/cases/verdant.webp` 1200x900, `loading=lazy` | DB, editable (`heroImageB`, must differ from A) | REQUIRED. Exactly 2 images: `figure.a` and `figure.b` (FIXED layout: stacked/offset pair; do not allow 1 or 3) |
| shot B alt | text | "" | DB, editable (`heroImageBAlt`) | OPTIONAL |
| `.svc-shot` aria-hidden | FIXED | decorative wrapper | | FIXED a11y |

Image notes: `Img` component outputs a srcSet of `-128w…-1600w` webp variants and `sizes="(max-width: 900px) 100vw, 760px"`; variants derive from the media file name (media pipeline, docs/MEDIA.md). Images are all case-study covers reused (marlow, verdant, orbit, halcyon, kite, northwind, aster, fold). No video.

"Trusted by" sub-block (`.logos.reveal`, `--i:3`, inside `.wrap` after `.svc-lead-grid`):
- label `<p class="label">Trusted by</p>`: HARDCODED-JSX. Optional/global.
- `<LogoMarquee/>` (`.marquee`, aria-hidden, track holds the list twice for seamless CSS loop): data from `src/content/logos.ts` `trustedBy` (IN-CODE-ONLY). 10 items: NORTHWIND (caps), halcyon (dot), Marlow & Co. (serif), orbit_ (mono), ASTER LABS (caps), Kite, Verdant (serif), fold. (dot), quill (mono), TESSEL (caps). Fields per item: `text`, `cls` (caps/serif/mono), `dot`. Same list on every page using the marquee (shared global component, not per-service). FIXED: doubled track, aria-hidden, animation. Recommend a global "logos" list editor (min ~6, max ~14: the loop duration is CSS-driven, long lists just run slower/longer).

SEO overlap: hero image A (first shot) is the og:image (see SEO section).

---

### 2. "What we fix" `section.sec.prob-sec` (aria-labelledby `prob-title`), HIDDEN today

Type: 4-column card grid with proof stat. Order 2 (inside `.svc-run` aurora wrapper). Rendered in HTML with `hidden=""` on all 4 services (`show_problems = 0`; `display:none` via UA `[hidden]`, no CSS override).

| field | type | current value | where | rule |
|---|---|---|---|---|
| `show_problems` / `problems.hidden` | toggle | OFF on all 4 | DB, editable (checkbox `showProblems`) | OPTIONAL section (whole section can be off). When ON, label/title/>=1 item all required and every item field required (validation.ts superRefine) |
| label (`problems.label`) | text | "What we fix" (`p.label.reveal`) | DB, editable (max 60) | required when on |
| title (`problems.title`) | rich | "The problems that `<em>bring people here</em>`" (`h2#prob-title`; same on all 4) | DB, editable (max 200) | required when on. Centered (`.prob-sec .sec-grid` centre line) |
| items[] repeater `problems.items` | list | 4 items (all services) | DB, editable via ListEditor (0-8 per validation) | `.probs` is `grid-template-columns: repeat(4, 1fr)` so the design is tuned to 4 (or multiples of 4). 1-3 items leave empty cells; 5-8 wrap onto a second row. Recommend CMS limit 4 (or 4/8). Stagger `--i = i % 3` is hardcoded (a quirk, FIXED) |
| item.title | text (rendered bold `<b>`) | "Looks like the competition" | DB, editable (max 100) | required when on |
| item.text | textarea | "Three companies in your category use the same blue and the same grotesk…" | DB, editable (max 400) | required when on |
| item.proofValue | rich | "3`<em>→</em>1"`, "32`<em>px</em>`", "1", "100`<em>%</em>`" (`.proof > b`) | DB, editable (max 40) | required when on. The `<em>` marks the unit/glyph in accent colour |
| item.proofLabel | text | "directions, then a decision" | DB, editable (max 100) | required when on |

Other services' items: product-design (Users drop off in onboarding / Every squad ships differently / Support carries the design debt / Research nobody uses; proofs 2w, 40%, 1, 8+); web-design-build (Reads like a brochure / Every change needs an engineer / Slow on the devices that matter / Traffic without conversion; proofs 90+, 1.2s, 0, 100%); motion-3d (Motion as decoration / Every team times it differently / Heavy hero, slow page / A mechanism nobody gets; proofs 60fps, 120kb, 1, 4x).

React key = item title: duplicate titles within one service would produce duplicate keys (editor should enforce unique titles, or the component should key on index).

---

### 3. Overview `section.sec.svc-intro` (aria-labelledby `ov-title`)

Type: split (sticky label+heading left, stacked text blocks right). Order 3. Always visible.

| field | type | current value | where | rule |
|---|---|---|---|---|
| label (`overview.label`) | text | "Overview" (all 4) | DB, editable (max 60) | REQUIRED |
| title (`overview.title`) | rich | brand: "Built for the rollout, `<em>not the reveal</em>`"; product: "Designed for people `<em>in a hurry</em>`"; web: "A story told at `<em>scroll speed</em>`"; motion: "Motion that has to `<em>earn its place</em>`" (`h2.h2.overview-title#ov-title`) | DB, editable (max 200) | REQUIRED |
| blocks[] repeater `overview.blocks` | list | 4 blocks in all services, titles always "Why it matters" / "How we do it" / "Why choose us" / "Our experience" | DB, editable (1-8) | Design tolerates a vertical stack of any count (1-8 fine); 4 is the designed rhythm. `--i = index` stagger |
| block.title | text (`h3`) | "Why it matters" | DB, editable (max 100) | REQUIRED |
| block.text | textarea (`p`) | 165-300 chars (brand 276/288/267/221) e.g. "Most identity work fails in the rollout, not the reveal…" | DB, editable (max 600) | REQUIRED. Keep ~150-320 chars to match the rhythm; plain text only |

---

### 4. Outcomes `section.sec.out-sec` (aria-labelledby `out-title`)

Type: stats / 3-column metric cards. Order 4. Sits OUTSIDE the `.svc-run` wrapper (after it).

| field | type | current | where | rule |
|---|---|---|---|---|
| label (`outcomes.label`) | text | "What changes" (all 4) | DB, editable (max 60) | REQUIRED |
| title (`outcomes.title`) | rich | "Numbers from `<em>real projects</em>`" (all 4; `h2#out-title`) | DB, editable (max 200) | REQUIRED |
| items[] repeater `outcomes.items` | list | 3 items on every service | DB, editable (1-8) | `.outs` is `repeat(3, 1fr)`: designed for exactly 3 (or 6). 1-2 leave empty columns; 4-5 leave an orphan row. Recommend CMS fixed at 3 (allow 6 at most). Stagger `--i = index` |
| item.value | rich (`<b><Rich/>`) | brand: "62`<em>%</em>`", "3`<em>×</em>`", "18`<em></em>`" (note: empty `<em></em>` in seed on 3 values, harmless) ; product "41%", "2.3×", "4.8"; web "2.4×", "12k", "98"; motion "2.2×", "44%", "60fps" | DB, editable (max 40) | REQUIRED. Big display number, short |
| item.text | textarea | "more direct traffic in the six months after a rebrand" (30-55 chars) | DB, editable (max 300) | REQUIRED; keep short (one-two lines) |

---

### 5. Inline CTA band `section.sec.band-sec` (aria-label "Start a project"), HIDDEN today

Type: CTA band. Order 5. `hidden=""` on all 4 (`show_band = 0`). aria-label `"Start a project"` is HARDCODED-JSX (FIXED, a11y; mismatch risk if button copy changes).

| field | type | current | where | rule |
|---|---|---|---|---|
| show_band | toggle | OFF | DB, editable (`showBand`) | OPTIONAL section |
| band.text | rich | brand: "Need an identity that survives the rollout? `<em>We can help.</em>`"; product "Need a product people can actually get through? …"; web "Need a site that loads fast and earns its keep? …"; motion "Need motion that explains rather than decorates? …" | DB, editable (`bandText`, max 200) | required when on |
| band.cta.label | text | "Book a call" (all 4) | DB, editable (`bandCtaLabel`, max 40) | required when on |
| band.cta.href | link | "/contact" | DB, editable (`bandCtaHref`) | required when on; `.pill` + PillBadge FIXED |

---

### 6. What is included `section.sec.incl-sec` (aria-labelledby `incl-title`)

Type: 3-column card grid with icons. Order 6.

| field | type | current | where | rule |
|---|---|---|---|---|
| label | text | "What's included" (all 4) | DB, editable (max 60) | REQUIRED |
| title | rich | "Everything in `<em>brand identity</em>`" / "…`<em>product design</em>`" / "…`<em>web design & build</em>`" / "…`<em>motion & 3d</em>`" (lower-case "3d" in seed) | DB, editable (max 200) | REQUIRED |
| items[] repeater `included.items` | list | 6 items on every service | DB, editable (1-12) | `.incls` = `repeat(3, 1fr)`: designed for multiples of 3 (6 current; 3, 9, 12 also tile cleanly). Other counts leave a ragged last row. Stagger `--i = i % 3` |
| item.title | text (`b`) | brand: Brand strategy, Naming & verbal identity, Visual identity, Art direction, Packaging, Guidelines. product: UX research, Information architecture, UI design, Design systems, Prototyping, Design engineering. web: Messaging & narrative, Web design, Webflow development, Next.js development, Motion, Performance & accessibility. motion: Interface motion, Motion guidelines, 3D & shaders, Product video, Illustration systems, Launch assets | DB, editable (max 100) | REQUIRED. Also feeds JSON-LD `hasOfferCatalog` (offers = item titles) |
| item.text | textarea | 48-94 chars e.g. "…" | DB, editable (max 400) | REQUIRED; keep ~50-100 chars (card height) |
| item.icon | inline SVG `{viewBox:"0 0 24 24", nodes:[{t,a}]}` rendered by `SvgIcon` in `span.ico` | 1-4 path/circle/rect nodes each | DB (inside `included_json`), validated by `iconSchema`, NOT editable: form shows no icon control; existing icons are kept; a NEW item gets a default circle (`DEFAULT_ICON`) | FIXED-FOR-DESIGN-INTEGRITY: icons are stroke SVGs matching the icon set; recommend a fixed icon-key picker (preset library) rather than free SVG; docs/SERVICES-CMS.md lists "icon choice" as not done |

---

### 7. Process `section.sec.process-sec.has-aurora.glow-right` (aria-labelledby `proc-title`)

Type: stepped "stairs" run with expandable notes (dark section with `<Aurora/>`). Order 7. Component `src/components/motion/Stairs.tsx` (client), `idPrefix="stair-<slug>"`.

| field | type | current | where | rule |
|---|---|---|---|---|
| label | text | "How it runs" (all 4) | DB, editable (max 60) | REQUIRED |
| title | rich | "Four phases, `<em>one team</em>`" (all 4) | DB, editable (max 200) | REQUIRED |
| steps[] repeater `process.steps` | list | 4 steps on every service | DB, editable (1-10) | CONSTRAINT: `<ol class="stairs" style="--n: steps.length">`; grid is `repeat(var(--n), 1fr)`; each step descends by `--lvl * 44px` (staircase); the bar gradient uses `--i / (--n - 1)` so 1 step divides by zero (gradient breaks): effective minimum 2; practical design range 3-6 (columns get narrow; on mobile it becomes a vertical list, `.stair` border-top at tablet). Validation allows 1-10: recommend 3-6, default 4. Step number badge "Step #N" is generated (`.stair-no`, FIXED; the first badge is yellow `#fdc448` via CSS) |
| step.title | text (`h3.stair-title`) | brand: Discovery, Strategy, Identity, Rollout; product: Discovery, Design, System, Ship; web: Story, Design, Build, Launch; motion: Direction, Studies, Production, Hand-off | DB, editable (max 100) | REQUIRED; keep to one-two words (narrow columns). Also used in `aria-label="<title> — details"` on the + button |
| step.duration | text (`span.dur`) | "1–2 weeks", "3–4 weeks", "2 weeks", "1 week" | DB, editable (max 40) | REQUIRED |
| step.text | textarea (`.stair-tip p`) | 51-84 chars | DB, editable (max 400) | REQUIRED; shown in a popover note (tip) opened by the + button or CSS hover: keep short (~60-120 chars), long text overflows the tip |
| step.deliverables | list (title/detail) | NOT used on services (case studies only: Stairs supports it) | n/a | do not expose for services |
| behaviour | | One note open at a time; Escape / outside click closes; `aria-expanded`, `aria-controls=<idPrefix>-<n>` | HARDCODED | FIXED a11y wiring and ids |

---

### 8. Case studies `section.sec.svc-cases` (aria-labelledby `cases-title`)

Type: sticky stacking case panels (`CaseStack`, `div.cases#cases`). Order 8.

| field | type | current | where | rule |
|---|---|---|---|---|
| label (`cases.label`) | text | "Our cases" (all 4) | DB (`cases_json`), editable (`casesLabel`, max 60) | REQUIRED |
| title (`cases.title`) | rich | "Work that `<em>moved the needle</em>`" (`h2#cases-title`, all 4) | DB, editable (`casesTitle`, max 200) | REQUIRED |
| selected cases `caseIds` | relation (ordered list of case_study ids) | 3 per service, ordered: brand = marlow, verdant, northwind; product = orbit, fold, aster; web = kite, northwind, halcyon; motion = kite, orbit, fold | DB table `service_case_studies` (service_id, case_study_id, position), editable (ListEditor of selects, max 6, unique) | Publishing a service requires >=1 case. Only PUBLISHED case studies are shown on the live page (draft ones are filtered in the join). Panels are sticky and stacked, `CaseStack` writes `--p` on every `.case-panel` except the last, desktop only (>=901px), disabled with reduced motion. Works with any count 1-6; design shown with 3. With 1 case there is no stacking effect (still fine) |

Each panel (`CasePanel.tsx`: `article.case > a.case-panel`) is DERIVED from the case study row, NOT editable in the service form (edited in the Case Studies CMS: `case_studies.card_tags_json`, `card_image_id/alt`, `showcase_json`):
- link `href = /works/<slug>` (internal, whole panel is the link)
- `ul.tags li` tags (3 each: e.g. Furniture / Rebrand / Packaging)
- `h3.h3` title (rich), from `showcase_json.title`: e.g. "A century-old furniture maker gets an identity with as much craft as its chairs"
- variant A "quote": `.review` with source (e.g. Clutch) + stars, `<q>` quote, avatar img (alt=""), name, role. Variant B "results": `.review.case-results` heading hardcoded "Results" + list of {value rich, text} (2 items). Current: marlow/verdant/northwind/orbit/kite = quote; fold/aster/halcyon = results.
- media: `case-media > Img` card image (alt from `card_image_alt`, e.g. "Hovra furniture brand identity — placeholder from Dribbble") + decorative arrow `span.case-open[aria-hidden]` (FIXED).
- Note the alt texts contain "placeholder from Dribbble" / "design by Ridoy Rock" (content smell, to review).
- Hardcoded in JSX: the word "Results", the star glyphs.

---

### 9. Reviews `section.sec.svc-reviews.has-aurora.glow-left` (aria-labelledby `rev-title`)

Source: ServiceReviews.tsx -> shared `ReviewsSection` (src/components/site/ui/ReviewsSection.tsx). Type: carousel (horizontal scroller `div.carousel#carousel`, prev/next `CarouselNav`). Order 9. Dark variant with glow-left.

| field | type | current | where | rule |
|---|---|---|---|---|
| label | text | "Verified reviews" | HARDCODED-JSX (ServiceReviews.tsx) | optional/per-template; not editable |
| title | rich | "What our `<em>clients</em>` say" (`h2#rev-title`) | HARDCODED-JSX | not editable |
| rating line | text | "**5.0** ★★★★★ 60+ reviews on Clutch" (`.rating`) | HARDCODED-JSX (ReviewsSection.tsx) | shared: same copy as hero badge; make global setting |
| prev/next buttons | FIXED | `aria-label="Previous"` / `"Next"`, `data-carousel` hooks, svg arrows | HARDCODED | FIXED (JS hooks) |
| reviews[] repeater | list | 5 cards (shared with Home and Works, NO per-service selection) | IN-CODE-ONLY: `src/content/reviews.ts` (no D1 table, no admin) | Each: avatar img (`/assets/people/maya.webp` etc, alt=""), company + coloured dot, quote, name, role, city. Shape `{avatar, company, dot?, quote, name, role, city}`. Current: Orbit/Maya Rao; Marlow & Co./Harriet Marlow; Kite/Ingrid Halvorsen; Verdant/Aiko Sato; Northwind/Rosa Almeida. Carousel scrolls so 3-10 reviews OK; <3 looks sparse. `id="carousel"` FIXED (JS) |

Dynamic relationship: shared global "reviews" data (should become a global reviews table, optionally filterable per service). No service-specific reviews exist.

---

### 10. Global CTA band + footer (not in ServicePage, from the layout)

`<section class="cta" id="contact">` is rendered by the shared layout (`src/components/site/chrome/CtaBand.tsx`, other audit). Content: HARDCODED-JSX heading "Ready to discuss your `<em>project</em>` with us?", lead, mailto pill using the global contact email setting. `#contact` anchor is FIXED (the nav CTA and hero pill target it). Not editable per service.

---

### 11. Per-service differences (all D1 rows, same shape)

| field | brand-identity | product-design | web-design-build | motion-3d |
|---|---|---|---|---|
| meta title | Brand identity — Visuolab | Product design — Visuolab | Web design & build — Visuolab | Motion & 3D — Visuolab |
| hero shots (A / B) | marlow / verdant | orbit / halcyon | kite / northwind | aster / fold |
| problems (hidden) | 4 | 4 | 4 | 4 |
| overview blocks | 4 | 4 | 4 | 4 |
| outcomes | 3 | 3 | 3 | 3 |
| band (hidden) | 1 text + CTA | same | same | same |
| included items | 6 | 6 | 6 | 6 |
| process steps | 4 | 4 | 4 | 4 |
| cases | 3 (quote x3) | 3 (quote, results, results) | 3 (quote, quote, results) | 3 (quote, quote, results) |

No shape differences between services: every repeater has the same count across all four. Count minimum/maximum tolerated by design (recommended CMS range): problems 4 (4-8), overview blocks 1-8 (4 designed), outcomes 3 (3 or 6), included 6 (3/6/9/12), process steps 3-6 (4 designed; 1 breaks the gradient maths), cases 1-6.

---

### 12. SEO for `/services/[slug]`

Source: `serviceSeo()` in src/lib/server/seo.ts:71, `pageMetadata()` (src/lib/seo/metadata), JSON-LD nodes in src/lib/seo/jsonld. Site-wide defaults come from `settings.seo` in `site_settings` (src/lib/settings/schema.ts: defaultTitle, defaultDescription, ogImage, indexing, disallow, sitemap; `pages.*` overrides exist only for home/about/works/blog/contact: NOT services) via `getSiteConfig()`.

| item | value today | where | editable? |
|---|---|---|---|
| `<title>` | `services.meta_title`, e.g. "Brand identity — Visuolab" (no suffix added; layout template is `%s`) | DB | YES (`metaTitle`, required, max 70, 60 recommended, with counter and search preview) |
| meta description | `services.meta_description` (full sentence, ~190 chars on brand-identity; also rendered into og/twitter description) | DB | YES (`metaDescription`, 20-200, 160 recommended). Existing seed descriptions are ~190 chars (over the 160 recommendation) |
| canonical | `{siteUrl}/services/{slug}` (auto, localhost in dev) | derived | NO per-service canonical override field (blog posts have `canonicalUrl`, services do not). Recommend optional `canonicalUrl` |
| og:title / twitter:title | = meta title | derived | with title |
| og:description / twitter:description | = meta description | derived | with description |
| og:image / twitter:image | hero shot A (`/assets/cases/marlow.webp`, 1200x900) with `og:image:width/height`; fallback logic: shot A, else none (site default og image is set by the layout) | derived from `hero_image_a_id` | NO dedicated OG image field. Recommend optional `ogImage` (falls back to hero A) |
| og:image:alt / twitter:image:alt | shot alt, else plain text of hero title (since alts are empty: "A brand that still makes sense when the company doubles in size") | derived | indirect via hero alt |
| og:type / site_name / locale | website / Visuolab / en_GB | fixed | NO |
| twitter:card | summary_large_image | fixed | NO |
| robots | `index, follow` normally; `noindex` when site setting `seo.indexing` is off or when previewing an unpublished service | settings.seo + status | NO per-service noindex toggle (home/about/etc. have `pages.*.noindex`; services do not) |
| JSON-LD | two `<script type="application/ld+json">` graphs: layout Organization node (`@id #organization`); then Service node (`@id /services/<slug>#service`, name = meta title minus " — Visuolab", description, url, serviceType, image, provider -> organization, mainEntityOfPage, `hasOfferCatalog` named "<name>: what is included" listing every `included.items[].title` as Offer/Service) and a BreadcrumbList (`Home > <name>`) | derived from the service record | NO (auto; no free-form JSON-LD field). Note: Breadcrumb has just one item beyond Home, with no "Services" level (no index page exists) |
| sitemap | service URLs included from published rows (docs/SEO.md) | DB status | via status |
| Preview (draft/archived, admin) | noindex, no JSON-LD | | |

---

### 13. FIXED-FOR-DESIGN-INTEGRITY summary

- Section set and order (hero, problems, overview, outcomes, band, included, process, cases, reviews) and the aurora wrapper split: the `.svc-run` wrapper spans hero+problems+overview only; outcomes sits outside. Do not allow reordering across it.
- Root classes/ids: `.svc-page`, `.svc-run.hero-run.has-aurora`, `section.svc-hero#top`, `#svc-title`, `#prob-title`, `#ov-title`, `#out-title`, `#incl-title`, `#proc-title`, `#cases-title`, `#rev-title`, `.cases#cases`, `.carousel#carousel`, `#contact` (global CTA). aria-labelledby wiring depends on these ids.
- Every `.reveal` + `--i` stagger; `Aurora` components; `PillBadge`; decorative SVGs (stairs + button svg, case-open arrow, carousel arrows, quote mark `span.mark`); `.svc-shot[aria-hidden]`; Stairs ids `stair-<slug>-<n>`; `--n` custom property (derived from the step count, never an editor field).
- Layout-driving counts: hero images exactly 2; outcomes 3; problems 4; included multiple of 3; process 3-6 (not 1); cases 1-6.
- Hardcoded copy not editable today and recommended to stay fixed or move to global settings: "Trusted by" label, logo marquee list (code `src/content/logos.ts`), rating badge copy "5.0 · 60+ reviews on Clutch" (hero + reviews), reviews section label/title, review list (`src/content/reviews.ts`), "Results" label in case panels, "Step #N" label, aria-labels "Previous"/"Next"/"Start a project"/"<title> — details".
- Rich text allowed: only balanced `<em>` and `<b>` (richOk in validation); plain fields reject `<` and `>`; links limited to `/…`, `#…`, `mailto:`, `https://`.

### 14. Existing Service admin form: what it covers vs not

Covered (ServiceForm.tsx): Basics (name `title`, slug with redirect protection, status on create), SEO title and description, hero (headline, intro, button text+link, 2 images + alts), overview (label, heading, blocks), outcomes, included (label, heading, items without icon choice), process (label, heading, steps), case studies (label, heading, ordered case selection), CTA band (toggle, text, button, link), "What we fix" toggle + all fields.

Not covered / still code or fixed: icons for included items (new items = plain circle), hero rating badge, "Trusted by" label + logo list, reviews section (label, title, rating, review list), global CTA band, OG image override, canonical override, per-page noindex, JSON-LD customisation, drag-and-drop reorder (up/down arrows exist on the list page), services order driving menus (header mega menu, footer and the home page service cards are still built from code/navigation, not from the services table; docs/SERVICES-CMS.md states the menus are not generated from it yet), service `title` (Name) is admin-only (not displayed on the page; JSON-LD name is derived from `meta_title`, not `title`).

### 15. Ambiguities / observations

- `docs/SERVICES-CMS.md` says "Icon choice ... not in this phase" while `iconSchema` exists in validation: icons are accepted only as pass-through data from the existing row.
- Overview and problem items use titles as React keys (duplicates would clash). Outcomes use `text` as key.
- Seed values contain empty `<em></em>` in outcome values ("18<em></em>", "4.8<em></em>", "98<em></em>"): harmless but passes validation.
- Rendered counts I measured with text matching were inflated by the RSC payload; the counts in this file come from the seed data, which matches the rendered text.

---

# Part 4. Works `/works` and `/works/[slug]`

### 0. Overview and storage legend

Routes: `/works` (src/app/(site)/works/page.tsx, `force-dynamic`, D1) and `/works/[slug]` (src/app/(site)/works/[slug]/page.tsx). Both read D1 via `getCaseStudies` / `getCaseStudyBySlug` (src/lib/server/cms.ts), mapped by `src/lib/content/case-study-mapper.ts` into the `CaseStudy` type (src/content/types.ts) and rendered by `WorksPage`+`WorksGrid` and `CaseStudyPage`. `src/content/cases.ts` (1901 lines) is NOT read by any route; it is only the reference for `db:verify`. The doc is ../docs/CASE-STUDIES-CMS.md (repo root `docs/`, not `visuolab-next/docs/`).

Storage tags: **DB** = ALREADY-IN-DB and edited by the existing Case study admin form (`CaseStudyForm.tsx`); **SETTINGS** = in site_settings/SEO settings; **CODE** = IN-CODE-ONLY (src/content/*.ts); **JSX** = HARDCODED-JSX.

Tables: `case_studies` (migration 0005 + `featured` in 0010; JSON columns facts_json, stats_json, showcase_json, process_json, challenges_json, results_json, more_json, card_tags_json, filters_json), `case_study_images` (role CHECK in gallery_a | gallery_b | wide; `UNIQUE(case_study_id, role, position)`; caption, alt_text, object_position), `service_case_studies` (service links), `slug_redirects` (kind case_study), `media` (images referenced by id).

Page-level split: `/works` = the LIST. The page copy (hero, lead, chips, empty text, reviews heading) is all JSX; only the cards come from D1. `/works/[slug]` = TEMPLATE. Nearly everything is already per-record in DB, but section labels/headings are per-record too (stored in JSON columns per case study, not global).

Current data (8 published case studies, in position order): orbit, marlow, kite, verdant, halcyon, northwind, aster, fold. All 8 have: 3 stats, 4 process steps (each with deliverables), 3 challenges, 6 results (3 `is-num` + 3 plain), 2 + 2 gallery images, 1 wide, 3 more-work cards (kite currently renders only 1 more-work card and orbit gallery A has 3 images: live DB drift from admin tests; the seed has 3 slugs for kite, 4 slugs on one row).

---

### PART A: `/works`

Visual order: (1) works-hero (inside `.hero-run.has-aurora`) -> (2) works-grid-sec (same hero-run) -> (3) reviews carousel -> (4) site-wide CTA band (#contact, from ShellFooter, not page-owned) -> footer.

### A1. Works hero
- Root: `<section class="works-hero" id="top" aria-labelledby="works-title">` inside `<div class="hero-run has-aurora">` with `<Aurora/>` (decorative). Source: src/components/site/works/WorksPage.tsx. Type: page hero + filter chips. Order 1.

| field key | type | current value | stored | req |
|---|---|---|---|---|
| works.hero.label | text (<=24) | "Works" | JSX | optional text (eyebrow `p.label`) |
| works.hero.title | rich (<=60) | "Work that <em>moved</em> the needle" (em on "moved") | JSX | required; em optional |
| works.hero.lead | textarea (<=220) | "140+ launches since 2017. These are the ones we're proudest of — each with the brief, the thinking and the numbers behind it." | JSX | required (hero lead) |
| works.hero.chipsAriaLabel | text | "Filter by discipline" | JSX | FIXED (a11y wiring; could be editable but low value) |

- Filter chips (`.filters`, `button.chip[data-filter]`, `aria-pressed`, `<i>count</i>`): rendered by FilterChips (src/components/site/ui/FilterChips.tsx) from the constant `DISCIPLINES` in WorksPage.tsx: all/All, brand/Brand, product/Product, web/Web, packaging/Packaging, motion/Motion. Counts are computed live from `case_studies.filters_json`. Current counts: All 8, Brand 3, Product 3, Web 4, Packaging 2, Motion 5. Storage: JSX const (labels) + DB (counts). The same 5 keys are the validation enum `DISCIPLINES` (src/lib/validation/case-study.ts) and the checkbox list in the admin form (`DISCIPLINE_LABELS`). Three places hold the list.
- Chip labels: editable text allowed (label, <=16); chip KEYS and the "All" chip are FIXED (they are the join to `filters_json` values and `data-filter`; adding a discipline needs a validation enum + form change + chip). Count `<i>` is computed: FIXED/derived. Each chip is a button, not a link: filtering is client state.
- Filter motion (src/components/motion/Filter.tsx): `FilterProvider` (no DOM) holds `filter` + `touched`; `matchesFilter(filter, keys)` = "all" or key included. Until a chip has been pressed the grid classes stay untouched so the scroll `.reveal` can add `.in`; after a press cards get ` in` (match) or ` is-hidden` (display:none). Nothing animates the text.

### A2. Works grid
- Root: `<section class="works-grid-sec" aria-label="Case studies">` > `.wrap` > `<div class="works-grid" id="works-grid">`. Source: WorksGrid.tsx. Type: dynamic card grid (2 columns, even cards offset down by `translateY(clamp(24px,5vh,72px))` on desktop; 1 column <=~900px). Order 2. `aria-label="Case studies"` JSX, FIXED.
- Repeater `cards` = one per published case study, order = `case_studies.position` (admin list up/down arrows). Item = `a.wcard.reveal[href=/works/{slug}][data-tags="{filters joined by space}"]`, `--i` = index % 2 (stagger, FIXED).
- Min/max the design tolerates: 0 shows the empty message; 1+ fine; an odd count leaves the last card alone in the left column (OK); the stagger needs no even count. No limit in CSS. Admin has no max.

| field key (per case study) | type | current example (Orbit) | stored | req |
|---|---|---|---|---|
| card.name (`h2`, also breadcrumb & More-work `b`) | text <=60 (`clientName`) | "Orbit" (others: "Marlow & Co.", "Kite", "Verdant", "Halcyon", "Northwind", "Aster Labs", "Fold") | DB `client_name` | required |
| card.year (`span.year`) | text 4 digits | "2025" | DB `year` | required (validated /^(19\|20)\d\d$/) |
| card.type (`p.type`) | text <=80 (`typeLine`) | "Fintech app · Fintech" | DB `type_line` | required |
| card.tags (`ul.tags li`) | list of text <=24 | ["Product","Motion"] | DB `card_tags_json` | required, 1-4 (1-4 pills fit; more risks wrapping) |
| card.filters (`data-tags`) | multi-select of 5 keys | "product motion" | DB `filters_json` | required, 1-5 |
| card.image src/alt | image + alt <=200 | /assets/cases/orbit.webp, alt "Pesse fintech app screens — placeholder from Dribbble"; 16/11 crop (`.wcard-media aspect-ratio:16/11`, object-fit cover) | DB `card_image_id` -> media, `card_image_alt` | required |
| link | internal | `/works/{slug}` | derived from slug | FIXED |

- Fixed inside the card: `span.case-open` arrow SVG (aria-hidden), hover zoom, `.reveal`, `fetchPriority="high"` for card 0, normal for card 1, `loading="lazy"` for index >= 2 (code, `i < 2`). Img component adds responsive `srcset` (sizes `(max-width: 900px) 100vw, 760px`). No width/height attributes on `<img>`; ratio comes from CSS.
- Empty state: `p.works-empty` "Nothing here yet — try another filter." (JSX, hidden unless no card matches). Editable text (optional), element FIXED.

### A3. Reviews carousel ("Testimonials")
- Root: `<section class="sec reviews works-reviews has-aurora glow-right" id="reviews">` via `ReviewsSection` (src/components/site/ui/ReviewsSection.tsx) with `<Aurora/>`. Type: horizontal review carousel with prev/next (`CarouselNav`, `data-carousel="prev|next"`, `#carousel`). Order 3. `id="reviews"` is an anchor target: FIXED. The class string is passed in by WorksPage and decides the surface: FIXED.

| field key | type | current | stored | req |
|---|---|---|---|---|
| reviews.label | text | "Testimonials" | JSX (WorksPage prop) | optional |
| reviews.title | rich | "What the <em>clients</em> behind these projects say" | JSX (WorksPage prop) | required |
| reviews.rating | text | `<b>5.0</b>` + stars + "60+ reviews on Clutch" | JSX in ReviewsSection (shared by Home? No: Home uses its own HomeReviews.tsx with the same copy hardcoded; service pages use ReviewsSection) | optional; the `★★★★★` and `<b>` are fixed markup |
| reviews.items | repeater (5) | see below | CODE: src/content/reviews.ts (`reviews` array) | required list, min/max see below |
| prev/next aria-labels | text | "Previous" / "Next" | JSX | FIXED |

- Review item shape: `{avatar (/assets/people/*.webp, decorative alt=""), company, dot (hex colour of the `i` dot, optional), quote, name, role, city}`. Current 5: Orbit/Maya Rao/"They tailor their solutions to our specific needs and goals."; Marlow & Co./Harriet Marlow; Kite/Ingrid Halvorsen; Verdant/Aiko Sato; Northwind/Rosa Almeida. `mark` quote glyph is decorative (FIXED).
- NOTE: a `site_settings` row `key='reviews'` ("Client reviews (carousel)", db/seed/content.sql line ~138) EXISTS in DB but `ReviewsSection` imports `src/content/reviews.ts` directly and never reads it (grep for a reads of key "reviews" finds none). So reviews are effectively CODE-only on this page. Home (`HomeReviews.tsx`) hardcodes its own copy of the same 5 reviews in JSX and `home.reviews` also exists as a setting. Ambiguity to resolve: one shared `reviews` collection feeding Home, Works, Services.
- Constraint: carousel scroll-snap; 3+ items needed so prev/next scrolls; no CSS maximum; quote length ~<=140 chars to keep card heights equal (cards align by flex). Recommend 3-10.

### A4. CTA band (not page-owned)
- `<section class="cta" id="contact">` from `src/components/site/chrome/CtaBand.tsx` via ShellFooter (rendered on every page except `/contact`). Content is HARDCODED-JSX (heading "Ready to discuss your <em>project</em> with us?", lead "Tell us where you are and where you want to be. We'll come back within a day...", button "Book a call", mailto link with `EMAIL`). Floaters use /assets/cases/orbit, kite, marlow, verdant `.webp` (hardcoded, decorative, alt=""). `#contact` is an anchor used by nav: FIXED. Belongs to the global-chrome inventory; mentioned here because it appears on both routes.

### A5. SEO for `/works`
- Source: `fixedPageSeo("works", {image, items})` in src/lib/server/seo.ts; settings group `seo.pages.works` (src/lib/settings/schema.ts line ~147; admin Settings -> SEO -> Page metadata).
- Title: "Works — Visuolab" (SETTINGS; default in schema). Description: "Selected brand, product, web and packaging work by Visuolab — case studies with the results behind them." (SETTINGS, clipped to 300). Noindex flag: `seo.pages.works.noindex` plus global `seo.indexing` (SETTINGS).
- Canonical: `/works` (code constant `PATHS.works`, FIXED). OG/Twitter: title/description as above, `og:image` = first published case study's card image (+ alt) via `fixedPageSeo` opts (derived, no field). `og:type` per `pageMetadata`.
- JSON-LD: Organization (global) + `CollectionPage` node listing every case study (`items` = name + `/works/{slug}`) + BreadcrumbList (Works). Derived from D1; no editable field. No dedicated OG image field for Works (derived): optional enhancement.

---

### PART B: `/works/[slug]` (case study template)

All 8 case studies share one layout. Visual order: B1 hero -> B2 cover -> B3 about+stats -> B4 gallery A -> B5 process (Stairs) -> B6 gallery B -> B7 challenges -> B8 wide image -> B9 results -> B10 more work -> CTA band (#contact) -> footer. Root wrapper for B1+B2: `div.hero-run.has-aurora` containing `<Aurora/>`.

Form column legend: "Form" = section title in `CaseStudyForm.tsx` and field `name`.

### B1. Case hero
- Root `<section class="work-hero" id="top" aria-labelledby="case-title">` (CaseStudyPage.tsx). Type: hero with breadcrumb, headline, definition list of facts. Order 1.

| field key | type | current (Orbit) | stored | form | req |
|---|---|---|---|---|---|
| hero.breadcrumb.root | text | "Works" link to `/works` | JSX | no | FIXED (nav semantics) |
| hero.breadcrumb.current (`span`) | text | "Orbit" | DB `client_name` (same as card name) | Basics: `clientName` | required |
| hero.title (`h1#case-title`) | rich (<=200) | "Orbit cut onboarding drop-off by <em>41%</em> with a calmer money app" | DB `title` | Basics: `title` (hint explains `<em>`); `<b>` also validated | required |
| hero.facts (`dl.meta`) | repeater, FIXED 5 terms in fixed order | Client "Orbit Financial"; Industry "Fintech · Series B"; Services "Product design, Design system, Motion"; Year "2025"; Timeline "12 weeks" | DB `facts_json` [{term,value}], built by `inputToColumns` from separate fields | Project details: `clientFull`(<=80), `industry`(<=80), `services`(<=160), `year`(shared with card year, 4 digits), `timeline`(<=40) | all 5 required; term labels FIXED (`FACT_TERMS` const in mapper) |

- Layout: the `dl.meta` is a row of 5 key/value cells. The 5 terms are hard-wired by the admin form (not a free repeater). Term names (Client, Industry...) are not editable today (stored per record in JSON but form always writes the 5 constants); making them editable is possible but then count becomes a layout risk. `id="top"` anchor: FIXED. `--i` stagger: FIXED.

### B2. Cover image
- Root `<section class="cover-wrap" aria-hidden="true">` > `.cover.reveal` (aspect-ratio 2/1 desktop, 4/3 <=~900px; object-fit cover; `fetchPriority="high"`, sizes `(max-width: 900px) 100vw, 1300px`).
- Fields: cover.image (src from media) DB `cover_image_id`; cover.alt DB `cover_image_alt` (<=200, required in validation). Form: "Hero image" `coverImage` + `coverImageAlt`. NOTE the section is `aria-hidden="true"`, so the alt text is not exposed to screen readers on the page, but it IS used for OG image alt in SEO. No crop `position` field for the cover (only gallery/wide have `position`). Required. The image used as `og:image`.
- Aspect crop is fixed by CSS: upload art must tolerate 2:1.

### B3. About the project + key numbers
- Root `<section class="sec about-project" aria-labelledby="about-title">`. Type: label+lead, then stats row. Order 3.

| field key | type | current (Orbit) | stored | form | req |
|---|---|---|---|---|---|
| about.label (`p.label#about-title`) | text <=60 | "About project" | DB `about_label` | Description: `aboutLabel` | required |
| about.lead (`p.about-lead`) | rich textarea <=600 | "<em>Orbit</em> is a consumer banking app that had grown feature by feature until nobody could see the whole of it. ..." (em on client name) | DB `about_lead` | Description: `description` | required |
| about.stats (repeater `stats`) | item `{value rich <=24, label text <=100}` | "41<em>%</em>" / "less onboarding drop-off"; "2.3<em>×</em>" / "accounts funded in week one"; "4.8<em></em>" / "App Store rating, up from 3.9" | DB `stats_json` | Description -> Key numbers: `stats` | required list |

- Stats count: validation allows 1-4, but CSS `.about-project .stats{grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)}` is a THREE-column layout (first stat left, second on centre line, last on right edge; <=760px stacks to 1 col). All 8 cases have exactly 3. 1, 2 or 4 stats will misalign: the design effectively requires 3 (hard-ish constraint; recommend min 3 max 3, or tolerate 2). Note Orbit's third stat has an empty `<em></em>` (accepted). `.stats` base rule (sections.css) is `repeat(4,...)` but overridden here.
- `.reveal-group` / `--i` stagger FIXED.

### B4. Gallery A ("Project images")
- Root `<section class="gallery-sec" aria-label="Project images">` > `.gallery` (2-column grid, each `figure` aspect-ratio 4/3, border-radius 20, `figcaption` is an absolutely positioned glass chip bottom-left). Shared `Gallery` component also renders B6. `aria-label` JSX FIXED.
- Repeater `galleryA`, role `gallery_a` in `case_study_images`; item = `{media, caption <=160, alt <=200 (optional), position (CSS object-position "20% 30%", optional)}`. Orbit currently 3 images (2 original + a test "A third picture" caption); the other seven have 2. Original design = 2.
- Constraints: validation 1-6; CSS 2 columns, so use an EVEN count (2/4/6); an odd count leaves one half-width tile. 1 image occupies the left half only. Images lazy-loaded, `--i` stagger FIXED; `sizes (max-width: 900px) 100vw, 760px`.
- Form: Gallery -> "First gallery" `galleryA` (list editor with `media`, `caption`, `alt`, `position`). Stored DB. Captions are visible text overlays; alt is empty for current seeds (`alt=""` rendered) - decorative-by-default is a content choice, not enforced.

### B5. Process / approach ("How it went")
- Root `<section class="sec chapters-sec process-sec has-aurora glow-right" aria-labelledby="chapters-title">` with its own `<Aurora/>` (decorative, FIXED). Type: stepped "Stairs" run with +/- note per step. Component `src/components/motion/Stairs.tsx` (client). Order 5.

| field key | type | current (Orbit) | stored | form | req |
|---|---|---|---|---|---|
| process.label (`p.label`) | text <=60 | "How it went" | DB `process_json.label` | Approach: `processLabel` | required |
| process.title (`h2#chapters-title`) | rich <=200 | "Four phases, <em>one team</em> throughout" | DB `process_json.title` | `processTitle` | required |
| process.steps (repeater) | item `{title <=100, duration <=40, text <=500, deliverables[0-8] {title <=100, detail <=200}}` | Discovery / "2 weeks" / "Interviews with fourteen customers, funnel analytics and an audit of every onboarding screen." / deliverables "Onboarding flow \| 6 screens", "Home, cards & transfers \| iOS · Android"; Design (5 weeks), Build (4 weeks), Launch (1 week) | DB `process_json.steps` | Approach: `processSteps` list; deliverables as textarea "title \| detail" per line | required list |

- Rendered per step: `Step #{n}` (auto number, JSX `Step #${i+1}`, FIXED), `h3.stair-title`, `button.stair-btn[aria-expanded][aria-controls=stair-{slug}-{n}][aria-label="{title} — details"]` (aria wiring FIXED; label template JSX), `div.stair-tip#...` containing `span.dur`, `p`, optional `ul.stair-deliv`. Plus/minus SVG decorative (FIXED).
- Constraints: `--n` = step count drives `grid-template-columns: repeat(var(--n),1fr)` (sections.css line 327) and the rail `background-position: calc(var(--i)/(var(--n) - 1) * 100%)`; per-step `--lvl` = index drives the stair height. All 8 cases use 4 steps. Validation allows 1-8 but: 1 step divides by zero in the rail calc (broken rail), and 7-8 columns is far narrower than the design (<=~900px collapses to 1 column). Design-safe range 3-5 (recommend 3-5, default 4). Open/close: one note at a time, Escape/click-outside closes (document listeners). Text length: `stair-tip` is an absolute tooltip (hover also reveals via CSS), so keep `text` <=~160 chars in practice despite the 500 validation cap; deliverables 0-3 reasonable. Deliverables list optional per step (hidden when empty).
- Anchors: `idPrefix=stair-{slug}`, FIXED.

### B6. Gallery B
- Same component and CSS as B4 (`section.gallery-sec[aria-label="Project images"]`), placed after the process section. Role `gallery_b`. 1-6 items, even count preferred; seeds have 2 each. Form: Gallery -> "Second gallery" `galleryB`. DB.

### B7. Challenges
- Root `<section class="sec challenges-sec" aria-labelledby="challenges-title">` > `.ws` (sticky-ish head + body). Type: numbered 3-column cards (`ol.challenges`).

| field key | type | current | stored | form | req |
|---|---|---|---|---|---|
| challenges.label | text <=60 | "Challenges" | DB `challenges_json.label` | Challenge: `challengesLabel` | required |
| challenges.title (`h2.ws-title#challenges-title`) | rich <=200 | "What we had to <em>solve</em>" (`.ws-title` max-width 11ch: short titles only, ~<=28 chars) | DB `challenges_json.title` | `challengesTitle` | required |
| challenges.items | item `{title <=100, text <=500}` | "An onboarding nobody finished" / "Eleven screens stood between download and a funded account..." | DB `challenges_json.items` | `challengesItems` | required list |

- Number badge `span.n` is auto "01","02",... (`String(i+1).padStart(2,"0")`, FIXED). Layout: `.challenges{grid-template-columns:repeat(3,1fr)}`; all cases have 3. Validation allows 1-8; 4 or 5 wraps to a second row (acceptable), 1-2 leaves empty columns. Recommended 3 or 6.

### B8. Wide image
- Root `<section class="wide-sec" aria-hidden="true">` > `figure.wide-img.reveal` (aspect-ratio 21/9, radius 24, object-fit cover) with `figcaption` glass chip. Sizes `(max-width: 900px) 100vw, 1300px`, lazy.
- Single slot, role `wide`, count exactly 1 (mapper takes `role("wide")[0]`; if none, renders an empty src: validation makes it required). Fields `{media, caption <=160, alt <=200, position}`: form "Wide image" `wideMedia`, `wideAlt`, `wideCaption`, `widePosition`. DB `case_study_images`. Current Orbit: caption "Cards, transfers and the new home screen", crop "50% 40%". Section is aria-hidden so alt is not announced. Required. Caption may be empty (optional visual chip); the chip still renders as an empty element (check CSS if caption left empty: not verified).

### B9. Results
- Root `<section class="sec results-sec" aria-labelledby="results-title">` > `.ws`. Type: result tiles (`ul.results`, 3-column grid; 2 columns <=1100px; 1 <=600px). `li.is-num` = "headline number" tile style.

| field key | type | current | stored | form | req |
|---|---|---|---|---|---|
| results.label | text <=60 | "What changed" | DB `results_json.label` | Results: `resultsLabel` | required |
| results.title (`h2.ws-title#results-title`) | rich <=200 | "Results" | DB `results_json.title` | `resultsTitle` | required |
| results.items | item `{metric boolean, text rich <=300}` | `is-num`: "<b>41%</b> less onboarding drop-off"; "<b>2.3×</b> accounts funded in week one"; "<b>4.8</b> App Store rating, up from 3.9"; plain: "Eleven screens became six. Each asks one thing and says why it's needed." ... | DB `results_json.items` | Results: `resultsItems` (textarea + "Style" checkbox "Headline number (shown larger)"; admin placeholder shows `<em>62%</em>` but seeds use `<b>`) | required list (1-10) |

- Check-circle SVG on non-number tiles is decorative (aria-hidden) and FIXED; hidden on `is-num` tiles. Count: 6 in all cases (3 num + 3 text) filling a 3x2 grid; validation 1-10; design-safe is a multiple of 3 (3, 6, 9). Mixed count leaves ragged last row (acceptable). Emphasis markup in `text` is `<b>` for the headline figure (rich accepts `<em>` and `<b>`; `.is-num b` is the large style).

### B10. More work ("next" cards)
- Root `<section class="sec more-sec" aria-labelledby="more-title">`: `.more-head` (label+h2, plus ghost pill "All projects") and `div.more` (3-column grid, each `a` = `.img` 4/3 + `b` name + `span` kind).

| field key | type | current | stored | form | req |
|---|---|---|---|---|---|
| more.label | text <=60 | "More work" | DB `more_json.label` | More work: `moreLabel` | required |
| more.title (`h2#more-title`) | rich <=200 | "Other projects <em>worth a look</em>" | DB `more_json.title` | `moreTitle` | required |
| more.items | list of case-study picks (1-4), order kept | Orbit: marlow, kite, verdant | DB `more_json.slugs[]` | `moreSlugs` select list (options = other case studies, with draft/archived tagged) | required, 1-4; no self, no duplicates (superRefine) |
| (derived) card name `b` | text | "Marlow & Co." | DYNAMIC from referenced case study `client_name` | edited on the referenced case | n/a |
| (derived) card kind `span` | text | "Rebrand" | DYNAMIC from referenced `short_kind` (form field Card section "Short label" `shortKind` <=40) | on referenced case | required there |
| (derived) card image `img` alt="" | image | marlow.webp | DYNAMIC from referenced `card_image_id`; alt is always empty (decorative) | on referenced case | n/a |
| "All projects" pill | CTA | label "All projects", href `/works`, ghost pill with `PillBadge` arrow | JSX | no | label optional-edit; href FIXED (internal) |

- Relationship: only published case studies appear (unpublished/deleted slugs are silently skipped; Kite currently renders 1 card because its list has missing/unpublished entries or was edited). Rename of a slug rewrites other cases' `more_json` (admin logic). Layout: `.more` is `repeat(3,1fr)`; the design is 3 (all seeds) - 1-2 leaves empty columns (tolerated), 4 wraps to a second row, so recommend exactly 3 (min 2, max 3). Validation max is 4. Hide the section if 0 are resolvable (current code renders an empty `.more` grid with the header).

### B11. CTA band and footer
- Same global `CtaBand` (`section.cta#contact`) and footer as Part A4. HARDCODED-JSX; no case-specific CTA exists in the template (the older `.next` block styling exists in CSS but is unused by CaseStudyPage). `#contact` FIXED.

### B12. Case study SEO
- Source: `caseStudySeo()` in src/lib/server/seo.ts, fed by case study row.

| field | where | current (Orbit) | form |
|---|---|---|---|
| Title (`<title>`, og:title, twitter:title) | DB `meta_title` | "Orbit — Visuolab" (<=70, required) | Search engines (SEO): `metaTitle` |
| Description | DB `meta_description` | "Orbit case study: Orbit cut onboarding drop-off by 41% with a calmer money app." (20-200, clipped to 300) | `metaDescription` |
| Canonical | derived `/works/{slug}` | `http://localhost:3001/works/orbit` (production SITE_URL) | no field (no canonical override, unlike blog) |
| Robots | derived: `noindex` when the case is a preview (draft) or global `seo.indexing` is off; else "index, follow" | | no per-case noindex field |
| OG image / twitter image + alt | derived: cover image (`cover_image_id`) and `cover_image_alt` (fallback "{client}: {typeLine}"), width/height measured | /assets/cases/orbit.webp 1600x1200 | no separate OG image field |
| og:type | `article` with publishedTime (`published_at`), modifiedTime (`updated_at`), section "Case study" | | derived |
| JSON-LD | `Article` node (headline = `hero.title` raw WITH `<em>` markup stripped? verify: `c.hero.title` is passed as `headline` directly, so rich tags could leak: confirm `articleNode` strips tags), description = meta description, image, dates, `about` client name, author/publisher = Organization) + BreadcrumbList (Works > client name) + global Organization | derived | no field |

- Draft/archived case studies are served only to a signed-in admin as preview (noindex, no JSON-LD). Slug change creates a 308 redirect (`slug_redirects`). sitemap lists published cases (separate file, not audited here).

---

### What the existing admin form edits vs what is still hardcoded

Admin form (src/components/admin/CaseStudyForm.tsx; action `saveCaseStudy`; validation src/lib/validation/case-study.ts; persistence src/lib/server/case-studies-admin.ts) ALREADY edits, per case study: slug, status (create only), featured, clientName, headline (title), 5 facts, year, typeLine, shortKind, card tags (1-4), filters (1-5), card image + alt, cover image + alt, meta title/description, about label + lead + stats (1-4), gallery A (1-6) and B (1-6), wide image (caption/alt/crop), process label/title/steps (1-8, deliverables 0-8), challenges label/title/items (1-8), results label/title/items (1-10 + metric flag), more-work label/title/slugs (1-4), service links (service_case_studies), and the home/service "showcase" card (title, tags 1-4, variant results|quote, results 0-4, quote fields). Reorder/publish/archive/delete are in the list page.

STILL HARDCODED (not editable anywhere in admin):
1. `/works` page hero: label "Works", H1 "Work that <em>moved</em> the needle", lead paragraph (JSX WorksPage.tsx).
2. Filter chip labels and the 5-discipline list (WorksPage `DISCIPLINES`, validation enum, form labels: three copies); "All" chip; empty-state text "Nothing here yet — try another filter."
3. Reviews section on /works: label "Testimonials", title, rating line "5.0 ★ 60+ reviews on Clutch", the 5 reviews themselves (src/content/reviews.ts, IN-CODE-ONLY despite a `site_settings.reviews` row existing).
4. Case template fixed copy: breadcrumb root "Works", "Step #n", stair aria-label template "{title} — details", gallery aria-label "Project images", "All projects" pill label, fact term labels, prev/next labels.
5. `/works` SEO is in SETTINGS (editable under Settings -> SEO -> Page metadata), but there is no per-page OG image / canonical field.
6. CTA band + footer (global chrome).
7. Cover image crop position and cover aria-hidden.
8. Per-case-study section visibility toggles do not exist (all sections always render, and every list has min 1).

Fixed-for-design-integrity summary: Aurora spans, `.reveal` / `--i` stagger indices, `--n`/`--lvl` on stairs, stairs aria wiring + ids, `id="top"`, `id="works-grid"`, `id="works-title"`, `id="case-title"`, `id="about-title"`, `id="chapters-title"`, `id="challenges-title"`, `id="results-title"`, `id="more-title"`, `id="reviews"`, `id="contact"` (anchors, `aria-labelledby` targets), chip `data-filter` keys + `data-tags` join, `case-open` arrow SVG, result check-circle SVG, PillBadge, section class strings, aspect ratios (card 16/11, cover 2/1, gallery 4/3, wide 21/9, more 4/3), 3-column grids for stats/challenges/results/more, 2-column gallery, hover and scroll behaviours.

### Constraint recommendations (design-safe counts vs current validation)

| list | validation min-max | design-safe | reason |
|---|---|---|---|
| stats | 1-4 | 3 | `.about-project .stats` is a 3-column grid with positioned 2nd/last cells |
| stairs steps | 1-8 | 3-5 (4 current) | `--n` columns; `/(var(--n) - 1)` divides by zero at 1; >5 too narrow |
| deliverables per step | 0-8 | 0-3 | shown in the stair tooltip |
| gallery A / B | 1-6 | 2 or 4 or 6 | 2-column grid |
| challenges | 1-8 | 3 or 6 | 3-column grid |
| results | 1-10 | 3, 6, 9 | 3-column grid |
| more work | 1-4 | 3 (2 min) | 3-column grid |
| card tags | 1-4 | 2 (current) | pill row |
| cards on /works | unbounded | any | 2-column staggered grid |
| reviews | n/a (code) | 3-10 | carousel |
| wide image | exactly 1 | 1 | single slot, role `wide` |

Slot/role rules: `case_study_images.role` is one of `gallery_a` | `gallery_b` | `wide` (DB CHECK); `UNIQUE(case_study_id, role, position)`; `position` is the display order within a role (rewritten 0..n on save by `inputToImages`); `wide` takes the first row only; cover and card images are NOT in this table (columns on `case_studies`). Images must exist in `media` (FK RESTRICT); deleting a media in use is blocked.

Motion notes: Stairs (client component, one open note, document Esc/click-outside); `.reveal` scroll reveal with `--i` stagger on almost every block; works filter hides cards via `.is-hidden` (display:none) after first chip press; no ScrollWords/CaseStack/Reel on these two pages (CasePanel.tsx is not used by `/works` or `/works/[slug]`: it renders the home/service "showcase" card from `showcase_json`; its text lengths matter there).

Ambiguities / to verify: whether `articleNode` strips `<em>` from the headline in JSON-LD; behaviour of the empty `.more` grid / empty wide caption; whether `site_settings.reviews` is meant to be wired into `ReviewsSection`; whether the Orbit/Kite DB drift (3rd gallery image, 1 more-work card) is intentional test residue.

---

# Part 5. Blog `/blog` and `/blog/[slug]`

Legend for "Stored": **DB** = ALREADY-IN-DB and read by the page; **CODE** = IN-CODE-ONLY (src/content/*.ts or constants); **JSX** = HARDCODED-JSX; **DB-UNUSED** = row exists in D1 seed but nothing reads it.
Opt/Req/Fixed: OPT = optional, REQ = required, FIX = fixed for design integrity.

Overall: the article is already a typed-block CMS (blog_posts table, Blog admin, Zod `src/lib/validation/blog.ts`, mapper `src/lib/content/blog-mapper.ts`). The BLOG LISTING page chrome (hero copy, chip labels, "Read the article", empty-state text) is hardcoded JSX. SEO for the listing comes from Settings > SEO > pages.blog.

### 1.1 `/blog` — Section 1: Page hero (+ topic filter chips)
- Order 1 on page. Root: `<section class="page-hero blog-hero" id="top" aria-labelledby="blog-title">` inside `<div class="hero-run has-aurora">` (wrapper holds `<Aurora/>`). Source: `src/components/site/blog/BlogListing.tsx` L24-33. Type: page hero + filter chips.
- Route file: `src/app/(site)/blog/page.tsx` (force-dynamic; reads D1 per request).

| field key | type | current value | stored | opt/req |
|---|---|---|---|---|
| blog.hero.label | text (<=24) | "Blog" | JSX | REQ (or OPT) |
| blog.hero.title | rich (em on 1 word) | "Notes on `<em>design</em>` and the work around it" (h1#blog-title) | JSX | REQ, max ~70; keep exactly one `<em>` |
| blog.hero.lead | textarea | "What we ship, what we learn and what we would do differently. No thought leadership, no listicles." | JSX | OPT, max ~140 |
| (aria) filters group label | text | "Filter by topic" | JSX | FIX (a11y) |
| chip "All" label | text | "All" + count `<i>6</i>` | JSX label; count computed | label REQ; count FIX (computed) |
| chips per category | repeater (derived) | Brand, Product, Web, Motion, Process (each `data-filter=<title>`, `<i>count</i>`) | DB `blog_categories` (title, position, status; order = `position`) | min 0, no hard max (wraps). Managed in `/admin/blog/categories` |

- FIXED: `id="top"`, `aria-labelledby`/`#blog-title`, `<Aurora>` (decorative, aria-hidden), `.reveal` + `--i` stagger, `.filters` role=group, chip markup `data-filter`, aria-pressed, `.is-on`. Counts are computed live, never editable. Chip keys equal the category title text, so renaming a category renames the filter value.
- Filtering is client-side (`FilterProvider`, `useFilter`, `matchesFilter`) on `p.category`; the featured card is NOT part of the filtered set.

### 1.2 `/blog` — Section 2: Featured article card
- Order 2. Root `<section class="featured-sec" aria-label="Latest article">` > `a.featured.reveal`. Source `BlogListing.tsx` L35-49. Type: single dynamic card. Rendered only if there is at least one live post.
- Selection logic: first post with `featured=1` (newest first), else newest post. Only one featured at a time (admin enforces).

| field | value (current featured = newest, "design-systems-that-survive") | stored |
|---|---|---|
| image | `featured.cover.src`, alt = `cover_alt` (seed alt is "" = decorative), `sizes="(max-width:900px) 100vw, 640px"`, `fetchPriority=high` (LCP) | DB: `blog_posts.cover_image_id` -> `media`, `cover_alt` |
| category pill | "Product" | DB `blog_categories.title` |
| date | formatted `published_at` | DB |
| read time | "7 min read" (`${readMinutes} min read`) | DB `read_minutes` (auto-counted if empty), the word "min read" is JSX |
| title h2 | post title | DB |
| excerpt | `post.excerpt ?? meta.description` | DB `excerpt` (fallback `meta_description`) |
| link label | "Read the article" + arrow svg | JSX (FIX svg; label could be a setting) |
| href | `/blog/<slug>` | DB `slug` |

- Only the blog-post data is edited in Blog admin (Featured checkbox / star). The label "Read the article" and aria-label "Latest article" are JSX-only.
- Cover image is the LCP element: keep `fetchPriority="high"`, ratio fixed by CSS `.featured .img`.

### 1.3 `/blog` — Section 3: Article grid
- Order 3. Root `<section class="posts-sec" aria-label="Articles">` > `div.posts#posts-grid` (`BlogGrid.tsx`) of `BlogCard` (`a.post.reveal`, `data-cat`). Type: card grid (filterable).
- Items: all live posts except the featured. Today 5 cards (6 live posts). Min 0 (then empty state shows only after a chip is used), grid is CSS grid, tolerates any count (no pagination exists, no limit; cards stagger `--i = index % 2`).
- Card fields (all from DB): cover `src`+`alt` (lazy, sizes 420px), category, date, title h2, link `/blog/<slug>`.
- Empty-state copy: `<p class="works-empty" hidden>` "Nothing here yet — try another topic." — JSX (OPT text; shared class with Works).
- Pagination: none. Sorting: `published_at DESC, slug`. Live filter: `status='published' AND published_at <= now` (scheduled posts appear by themselves).
- FIXED: `id="posts-grid"`, `.post` markup, `data-cat`, `.in`/`.is-hidden` classes.

### 1.4 `/blog` — SEO
| field | source today |
|---|---|
| title / description / noindex | `site_settings` key `settings.seo` > `pages.blog` (defaults "Blog — Visuolab" / "Notes on brand, product, web and motion design...") via `fixedPageSeo("blog")` in `src/lib/server/seo.ts`; editable in Settings > SEO |
| canonical | `${SITE_URL}/blog` (auto, not editable) |
| OG image | featured (or newest) post's `ogImage ?? cover` (auto, with alt) |
| robots | per-page `noindex` OR global `seo.indexing=false` |
| JSON-LD | `CollectionPage` listing all live posts (`collectionNode` items name+path) + `BreadcrumbList` (Home/Blog) + site-wide `Organization` in layout |

### 1.5 `/blog/[slug]` — Section 1: Article header (hero)
- Order 1. Root `<article class="post-page light" id="top" data-light-offset="450">` > `.post-hero` > `.wrap.post-head`. Source `BlogArticle.tsx` L24-36. Type: article hero (breadcrumb + h1 + byline).
- `light` + `data-light-offset="450"` drives the Nav over-light switching: FIXED.

| field | type | current (design-systems-that-survive) | stored | opt/req |
|---|---|---|---|---|
| breadcrumb "Blog" label + link | text | "Blog" -> `/blog`; separator "/" | JSX | FIX |
| breadcrumb category | text | "Product" | DB `category_id` -> `blog_categories.title` | REQ |
| title (h1) | text <=140 | "Design systems that survive contact with a roadmap" | DB `title` | REQ |
| author avatar | image (media) | `/assets/people/jordan.webp`, alt="" (decorative), class avatar | DB `author_image_id` | OPT |
| author name | text <=60 | "Jordan Ellis" (in `<b>`) | DB `author_name` | REQ |
| date | date | formatted `published_at` (UTC datetime) | DB | REQ |
| reading time | int 1-120 | "7 min read" | DB `read_minutes` or auto count (200 wpm) | OPT (auto) |

- Note: the h1 has no `<em>` emphasis (plain text; title rejects `<` `>`).
- FIXED: dots `<span class="dot" aria-hidden>`, `.reveal`, `--i`.

### 1.6 `/blog/[slug]` — Section 2: Cover figure
- Order 2. `<figure class="post-cover reveal">` inside `.wrap`. Source L37. Image `p.cover.src`, alt `p.cover.alt` (seed alt ""), `sizes="(max-width: 900px) 100vw, 1300px"`, `fetchPriority="high"`. DB: `cover_image_id`, `cover_alt`. REQ image (schema: "Choose the featured image"); alt OPT (<=200). Same image drives the card on /blog.
- No caption field in the hero.

### 1.7 `/blog/[slug]` — Section 3: Article grid (TOC rail | prose | share rail)
Root `div.article-grid` (3 columns). Source L38-62.

**3a. ArticleToc (left rail)** — `ArticleToc.tsx`: `<aside class="toc" aria-label="On this page">`, `<p class="rail-label">On this page</p>`, `<nav class="toc-list">` links `#<headingId>`. Label/aria text JSX-only (FIX recommended). Links are AUTO-GENERATED from body blocks of type `heading` (h2) via `headingId(text, index)` (`src/lib/slug.ts`). Active link class `on` set by scroll test (heading `offsetTop <= scrollY + --nav-h + 40`). Constraint: two headings that make the same anchor are refused by validation. Current 4 items (Start with the ten screens you actually have / Tokens before components / One owner, one hour a week / Motion is part of the system). Empty list when no h2 (rail renders just label).

**3b. Prose (`div.prose.reveal`)** — everything below is DB (`blog_posts.lead`, `body_json`, `outro_json`):
| element | type | stored | limits |
|---|---|---|---|
| `p.post-lead` | inline-rich text ("**bold** *italic* `code` [link](url)") | `lead` | REQ, <=600 |
| body blocks[] | repeater of typed blocks, order free | `body_json` | 1..80 blocks (REQ >=1) |
| block `heading` (h2, id from text, in TOC) | plain text <=140 | | |
| block `subheading` (h3, not in TOC) | plain <=140 | | |
| block `paragraph` | inline-rich <=3000 | | |
| block `list` (ul/ol) | items inline-rich <=400 each, 1..30, `ordered` flag | | |
| block `quote` (blockquote + `<cite>`) | inline text <=600, cite <=100 OPT | | |
| block `image` (`figure.post-figure`) | media id, alt <=200, caption <=200 OPT, lazy | | |
| block `divider` (`hr.post-divider`) | none | | |
| closing `<hr>` | FIXED | JSX | |
| `p.outro` | before (<=120, spacing kept) + link text (<=60) + href (path, #anchor, mailto:, https; <=300) + after (<=160) | `outro_json` {before,linkText,href,after} | REQ link text and href; before/after OPT |

- Current outro: "Working on something like this? [Tell us about it](#contact) — we answer within a day." The href `#contact` depends on the CtaBand section (id="contact") existing on the page (it does on /blog/[slug]; it would NOT on /contact).
- Seeded articles only use heading + paragraph blocks; h3, lists, quote, image, divider styles were added in "CMS additions" at end of `src/styles/pages.css`.
- Safe links: validator + renderer both restrict to `/ # mailto: https://`.

**3c. ShareRail (right rail)** — `ShareRail.tsx`: `<aside class="share" aria-label="Share this article">`, `<p class="rail-label">Share</p>`, 3 anchors (aria-label/title "Share on X" -> twitter.com/intent/tweet?url&text=meta.title; "Share on LinkedIn"; "Share on Facebook") + button "Copy link" (aria-label/title "Copy link", clipboard, `.copied` for 1.6 s). All labels, icons, networks: HARDCODED-JSX, FIXED (the networks are a fixed set; recommend a global on/off only). Share URL = `${SITE_URL}/blog/<slug>` (no anchors); share text uses `meta.title` (the SEO title, which includes " — Visuolab").

### 1.8 `/blog/[slug]` — Section 4: "More from the studio" (related)
- Order 4. Root `<section class="sec more-sec light" aria-labelledby="more-title">`. Source L65-81. Type: heading + link + 3-up card row.

| field | current | stored |
|---|---|---|
| label | "Keep reading" | JSX |
| title h2#more-title | "More from the `<em>studio</em>`" | JSX |
| button | "All articles" -> `/blog` (`pill ghost`, PillBadge) | JSX |
| cards | up to 3: cover (alt="" decorative, lazy, sizes 420), category, "N min read", title `<b>`, href `/blog/<slug>` | DB: slugs in `blog_posts.related_json`; cards resolved from LIVE posts only (unpublished/missing slugs dropped silently) |

- Admin edits "More from the studio" (select from other articles, max 3, no duplicates, cannot list itself). Heading/label/button text is NOT editable (JSX).
- Count: layout tolerates 0..3 (docs say seed uses 2; max 3 by validation). With 0 related the row is empty but heading remains (ambiguity: no hide-if-empty logic).
- FIXED: `id="more-title"`, `light` class (nav colour), `.posts-more` grid.

### 1.9 `/blog/[slug]` — SEO + redirects + preview
| field | source |
|---|---|
| title / description | `blog_posts.meta_title` (<=70) / `meta_description` (20-200) (REQ) |
| canonical | `blog_posts.canonical_url` (https only) else own address |
| OG image | `og_image_id` else cover; `og:type=article`, published/modified time, author, section=category |
| keywords | tags (`blog_tags`/`blog_post_tags`, max 8, 2-30 chars) |
| robots | preview (admin viewing draft/scheduled/archived) = noindex; global indexing flag |
| JSON-LD | `BlogPosting` + `BreadcrumbList` (Home/Blog/Article), via `blogPostSeo()` in seo.ts |
| redirects | renamed slug -> `slug_redirects` -> `permanentRedirect`; `/blog/x.html` -> `/blog/x` (next.config redirects) |

### 1.10 Blog admin coverage vs hardcoded (summary)
| Element | Admin edits it? |
|---|---|
| title, slug, category, tags, featured, status, excerpt, lead, blocks, closing line, related (<=3), SEO title/desc, canonical, OG image, cover + alt, author name + picture, publish date/schedule, reading time | YES (`src/components/admin/BlogForm.tsx`, `ArticleEditor.tsx`, `src/lib/validation/blog.ts`, `src/lib/server/blog-admin.ts`) |
| Categories (title, slug, status, order) and tags | YES (`/admin/blog/categories`, `/admin/blog/tags`) |
| Blog hero label/heading/lead, "Read the article", empty state, TOC/Share labels, "Keep reading / More from the studio / All articles" | NO (JSX) |
| Author box (bio, role) | DOES NOT EXIST (only avatar + name in byline) |
| Article-level CTA band | uses shared CtaBand (Part 3), not per-article; per-article only the closing line |
| Share networks / counts | NOT editable, fixed |
| Per-article author link, comments, newsletter, pagination | do not exist |
| `src/content/blog.ts` | only a typed seed/fallback; the runtime reads D1 only |
| Note | Author is free text per post (no authors table). `excerpt` is only displayed when the post is the featured one. Cover alt seeded as "" for all 6 posts. |

---

---

# Part 6. Contact `/contact`

Route `src/app/(site)/contact/page.tsx` renders `ContactSection` (`src/components/site/contact/ContactSection.tsx`, async server component) which contains ContactForm (client). The page has ONE visual section; no CtaBand (ShellFooter skips it on `/contact`) and a footer variant "contact".

### 2.1 Contact section (hero + form)
- Root `<section class="contact-page hero-run has-aurora" id="top" aria-labelledby="contact-title">`, contains inline decorative aurora (`div.aurora aria-hidden` with `span.s1`, `span.s2`), then `.wrap > .contact-grid` = `.contact-intro` (left) + `.contact-form-wrap#form` (right). Type: split intro + form.
- FIXED: `id="top"`, `id="form"`, `id="contact-title"`, aurora spans, `.reveal` + `--i` indexes (0,2,3,4 on left; 1 on form wrap), `.contact-grid`.

**Intro column** (all JSX except email):
| field key | type | current value | stored | opt/req |
|---|---|---|---|---|
| contact.label | text | "Contact" | JSX | REQ |
| contact.title | rich (em 1 word) | "Tell us where you are and where you want to `<em>be</em>`" (h1) | JSX (seed `site.contact.title` exists but is DB-UNUSED) | REQ, ~70 |
| contact.who.avatar | image | `/assets/people/jordan.webp`, alt="" | JSX | OPT |
| contact.who.name | text | "Jordan Ellis" | JSX | OPT (group hide) |
| contact.who.role | text | "Founder & Creative Director — answers new enquiries" | JSX | OPT |
| contact.direct[0].label / text / href | repeater item | "Email" / `{email} ↗` / `mailto:{email}` | email = DB `settings.contact.email`; label JSX | label OPT; text derived |
| contact.direct[1] | repeater item | "New business" / "Book a 30-min intro call" / `mailto:{email}?subject=New%20project` | label+text JSX | OPT |
| contact.facts[] | list of 3 | "Answer within 1 working day"; "Lisbon & remote — 4 continents"; "Projects from €20k" | JSX | OPT, 0..4 (design tolerates a short list; was exactly 3) |
- The arrow icons (`svg` M7 17L17 7) are FIXED.
- `contact.direct` items: only 2 today; layout tolerates 1-3. Both link as mailto (internal e-mail from Settings > Contact; env fallback `hello@visuolab.studio`).
- Contact details from Settings (`settings.contact`: email, phone, address, hours; `settings.social`) — ONLY `email` is displayed on this page. Phone, address and hours are in the schema and admin but are not rendered anywhere on /contact (nor in footer). Ambiguity/gap: no designed slot exists for them; adding them would change the design.
- Also seeded but UNUSED: `site_settings` key `site.contact` (title, whoAnswers, direct, facts) — an unconnected copy of exactly these fields; a ready data shape for the CMS.

**Form column** (`ContactForm.tsx`, `form.contact-form#contact-form`, noValidate). Field names (`name,email,company,need[],budget,message`) and ids (`c-name,c-email,c-company,c-msg`) are FIXED (validation, server action, FIELD_IDS error mapping, `contact_submissions` columns).
| field | label | placeholder | rules | stored |
|---|---|---|---|---|
| name | "Your name" | "Jane Okafor" | required, <=100, autocomplete name | JSX |
| email | "Email" | "jane@company.com" | required, type email, <=254 | JSX |
| company | "Company" + `<span>optional</span>` | "Company name" | optional <=120 | JSX |
| need (checkbox group, fieldset legend) | legend "What do you need?" | - | options: "Brand identity", "Product design", "Web design & build", "Motion & 3D", "Not sure yet" (5) | CODE `src/content/contact.ts` NEEDS; ALSO enforced by Zod `src/lib/validation/contact.ts` (strict list) |
| budget (radio, legend) | "Budget range" | - | options: "Under €20k", "€20–50k", "€50–100k", "€100k+", "Not sure yet" (5) | CODE BUDGETS; Zod-enforced |
| message | "About the project" | "What are you building, what's the deadline, and what does success look like?" | required 10-5000 | JSX |
| submit | "Send message" + PillBadge | | | JSX |
| honeypot | label "Website", name `website` | | decoy, aria-hidden, off-screen | FIXED (spam) |
| Turnstile | none visible (interaction-only) | | rendered only when integration active (`turnstileGate()`; Settings > Integrations, key `TURNSTILE_SECRET` secret) | FIXED |
| hidden | `startedAt`, `key` (UUID) added in JS | | | FIXED |

- Option lists: editing the visible labels requires also changing the Zod enum (or making validation read the same list); stored value = label text; `need` stored joined ", " in `contact_submissions.service`. Option count: design wraps `.opts` pills; 3-7 tolerated (5 today); the last "Not sure yet" is a convention. If options become editable, validation must read from the same source.
- Messages:
  - Consent/helper note (`p.form-note`): "By sending this you agree we may reply by email. That's it — no list, no sequence." — CODE const `NOTE` in ContactForm.tsx. (This is the only consent text; no checkbox.)
  - Success (`p.form-ok role=status`): "Thanks — that's with us. You'll hear back within one working day." — JSX.
  - Generic error (client catch): "Something went wrong. Please try again, or email {site.email}." — JSX, email from Settings.
  - Server errors (`src/actions/contact.ts` L14-15): "Something went wrong on our side. Please try again, or email {email}." and "Too many messages from this connection. Please try again later, or email {email}." — CODE.
  - Field errors: browser native bubbles + messages from `src/lib/validation/contact.ts` (CODE).
  - Spam is shown as success (never announced).
- Aria wiring: labels `for`/ids, legend/fieldset, `role="alert"` on error note: FIXED.
- Pipeline (FIXED): origin check, Zod, rate limits (5/h visitor, 3/day email, 200/h site), idempotency, `contact_submissions`, notification via integration (Resend), event dispatch. See `docs/CONTACT-FORM.md`.
- Where the post-submit notification recipients live: `integrations` table (Settings > Integrations), not content.

### 2.2 `/contact` — SEO
`settings.seo.pages.contact` (default title "Contact — Visuolab", description "Tell us about your project. A real person answers within one working day — no forms into the void, no sales sequence."), noindex flag, canonical `/contact`, no page OG image (falls back to Settings > SEO default OG image), JSON-LD `ContactPage` + `BreadcrumbList`; `fixedPageSeo("contact")`.

---

---

# Part 7. Shared chrome (every page)

Layout wiring: `src/app/(site)/layout.tsx` wraps all public routes with `SiteConfigProvider` (site name, logo urls, email, instagram, linkedin, x, dribbble from `site_settings` settings.general/contact/social) and `NavigationProvider` (menus from `navigation_items`); renders `<Nav/>`, page, `<ShellFooter/>`. Layout also adds site-wide `Organization` JSON-LD.

### 3.1 Header (Nav + MobileNav)
- Root `<header class="nav" id="nav">` (`src/components/site/chrome/Nav.tsx`), mobile dialog `#mnav` (`MobileNav.tsx`, portal, below 900px). Shown on ALL public pages incl. 404.
- **Already in DB** (`navigation_items`, migration 0007 + 0015, admin at `/admin/navigation`, config in `src/lib/navigation/config.ts`): `primary` links (max 8; today Works, Blog, About ... see seed), `cta` button (max 1; label + href), `mega_columns` (grouped, max 6 columns x 10 links), `mega_cards` (max 6; label, description, icon key branding|product|web), `mega_promo` (1; label, description, tag). Each: type internal/external/group, is_visible, open_in_new_tab, position. Fallback built-in copy in `src/content/nav-data.ts` when DB fails.
- **Hardcoded JSX** (not in navigation_items): the trigger text "Services" (button data-menu), mega label "Core departments", `aria-label="Primary"`, burger `aria-label="Menu"`, aria-controls `mnav`; logo via `Brand.tsx` (site name + logo from Settings > General). Mobile close/section labels (see `MobileNav.tsx`).
- FIXED: `id="nav"`, `data-menu`, icons (`iconFor` branding/product/web), scroll states `.scrolled`/`.over-light` (depends on `.light` sections and `data-light-offset`), focus trap/Lenis pause, 380 ms close timing.
- Services dropdown cards/columns are NOT automatically linked to the `services` table (manual hrefs, `page_ref` e.g. `service:svc_brand_identity` is stored for picking only). `src/lib/server/services-nav.ts` exists (check: keeps nav in sync on slug change).

### 3.2 CtaBand (closing CTA)
- Source `src/components/site/chrome/CtaBand.tsx`; root `<section class="cta" id="contact">`. Type: CTA band with floating images + avatars. Rendered by `ShellFooter` on every public page EXCEPT `/contact` (so on Home, About, Works, Blog, blog articles, work/service pages, 404). It is the target of every `#contact` anchor (hero CTAs, "why" list, article closing line) and the footer's `/#contact`.
| field | type | value | stored | opt/req |
|---|---|---|---|---|
| avatars[3] + "+" + "You" chip | images (3) | `/assets/people/jordan.webp`, `team-2.webp`, `aiko.webp`, alt="" | JSX (seed `site.cta.avatars` DB-UNUSED) | FIX count 3 (layout stack) ; images swappable |
| floaters[4] | decorative images | `/assets/cases/orbit.webp`, `kite.webp`, `marlow.webp`, `verdant.webp` (aria-hidden, lazy, `.f1`-`.f4` positions) | JSX (seed `site.cta.floaters` DB-UNUSED) | FIX count 4 (CSS positions f1..f4) |
| title (h2) | rich | "Ready to discuss your `<em>project</em>` with us?" | JSX (seed `site.cta.title` DB-UNUSED) | REQ ~60 |
| lead | text | "Tell us where you are and where you want to be. We'll come back within a day with how we'd get you there." | JSX (seed `site.cta.lead`) | OPT ~140 |
| primary button | label+href | "Book a call" -> `mailto:{email}` (pill + FIX badge arrows) | label JSX; href derived from Settings > Contact email | label REQ; href OPT override |
| secondary link | arrow-link | `{email} ↗` -> `mailto:{email}` | email from Settings | derived |
- FIXED: `id="contact"`, `.floaters` positions, `.reveal` stagger, badge svgs.

### 3.3 Footer
- Source `src/components/site/chrome/Footer.tsx`; root `<footer class="footer">`. Variant prop from `ShellFooter` by pathname (`home`, `about`, `works`, `contact`, `default` = everything else incl. blog, services, case studies, 404). Footer ALWAYS present on all public pages.

**Variants (FIXED behaviour driven by `FOOTER_BRAND`, `OWN_PATH`, `OWN_REDIRECT`):**
| variant | brand link | dark logo | own-page link rewriting |
|---|---|---|---|
| home | `#top` | no `.logo-d` | `/#x` -> `#x` |
| about | `/` | yes | `/about#x` -> `#x` |
| works | `/` | yes | `/works` -> `/#work` |
| contact | `/` | yes | `/contact` -> `/#contact` (no CTA band here) |
| default | `/` | yes | none |

Sub-blocks:
- **Newsletter block** (`.newsletter`): brand logo link (aria-label "{siteName} — home"; `logo-l` from Settings > General logo, `logo-d` dark logo; 335x100), `<p>` "Subscribe to our newsletter to stay in touch with the latest." (JSX; seed `site.footer.newsletter` DB-UNUSED), `NewsletterForm` (`src/components/motion/NewsletterForm.tsx`): email input placeholder "Your email address", aria-label "Email", submit button aria-label "Subscribe". NOT FUNCTIONAL: `onSubmit` just `preventDefault()` (no subscription backend, no state/feedback). Copy OPT; the form behaviour is an open product decision.
- **Link columns**: `footer` menu from `navigation_items` (grouped; group label = `<h4>`, links `<li><a>`; max 6 columns x 12 links) — ALREADY-IN-DB, editable at `/admin/navigation`. Mobile/desktop layout tolerates ~3-4 columns well (grid): design has 3 columns today (verify seed: Company / Services-like / Resources); more than 4 may wrap.
- **Badges row** (`.badges`): six `.badge-card`s, all HARDCODED-JSX with inline brand SVG marks (seed `site.footer.badges` has 6 `{mark,text}` entries DB-UNUSED):
  1. Clutch — mark: "Clutch" + "★★★★★" — "60+ reviews / on Clutch"
  2. Dribbble — laurel + dribbble icon — "Top 50 trending / team on Dribbble"
  3. Awwwards — wordmark "awwwards." — "Site of the Day / × 3 on Awwwards"
  4. Webflow — wordmark — "Professional partner / by Webflow"
  5. GoodFirms — "G GoodFirms" — "Top user experience / team by GoodFirms"
  6. Behance — laurel + Behance icon — "Projects are featured / on Behance"
  Editable potential: the 2-line caption text per card (`<br/>` splits line 1/2). FIXED: brand marks/svgs (third-party logos), `<symbol id="laurel">` defs (hidden svg), count 6 (grid layout; the cards are not links), order. Cards are not links (no href).
- **Legal row** (`.legal`): "Privacy policy", "Cookie policy", "Terms" — all `href="#"` (DEAD LINKS; no pages exist, see Part 4). JSX. Seed `site.footer.legal` also all "#".
- **Social icons** (`.social`): 4 icons with aria-labels "Instagram" (Settings > Social instagram), "Dribbble" (Settings > Social `others` entry whose label matches /dribbble/i), "LinkedIn" (social.linkedin), "X" (social.x). Empty URL -> `href="#"`. Facebook and YouTube from Settings > Social are NOT rendered anywhere (no designed slot). Icons FIXED; hrefs ALREADY-IN-DB.
- **Copyright**: "© 2016–2026 Visuolab" hardcoded JSX (year range and name literal; not using siteName).
- Shown on: every public page.

### 3.4 ShellFooter
`src/components/site/ShellFooter.tsx` (client): `path !== "/contact"` -> `<CtaBand/>`, then `<Footer variant>` mapped from pathname. Slash-trimmed. Variants only differ for `/`, `/about`, `/works`, `/contact`; `/blog`, `/blog/*`, `/services/*`, `/works/*`, 404 use `default`.

### 3.5 Reviews (carousel)
- Data: array of 5 `ReviewSeed` {avatar, company, dot (colour), quote, name, role, city}. Today: `src/content/reviews.ts` (CODE) used by `ReviewsSection`; also a seeded `site_settings` key `reviews` (5 items, identical; DB-UNUSED — only `scripts/db/verify.mjs` compares). HOME does NOT use it: `HomeReviews.tsx` has the five cards HARD-CODED in JSX (duplicate copy; avatars maya/harriet/ingrid/aiko/rosa).
- Shown on: Home (`#reviews`, light surface, `HomeReviews`), Works (`WorksPage`: `ReviewsSection className="sec reviews works-reviews has-aurora glow-right" id="reviews" label="Testimonials" title="What the <em>clients</em> behind these projects say"`), each service page (`ServiceReviews`: dark `sec svc-reviews has-aurora glow-left`, label "Verified reviews", title "What our `<em>clients</em>` say", `aria-labelledby="rev-title"`). Not on About, Blog, Contact.
- Per-section fields: label (text), title (rich, one em), rating line (`<b>5.0</b> ★★★★★ 60+ reviews on Clutch` — hardcoded in ReviewsSection and HomeReviews; seed `home.reviews.rating` DB-UNUSED), prev/next buttons (aria-labels "Previous"/"Next", FIXED).
- Repeater `review-card`: avatar (img alt=""), company logo text + coloured dot `<i style=background>` (optional colour), quote (blockquote, ~90 chars each), name, role, city. Items 5 today; carousel is scroll-snap/prev-next (`CarouselNav`, id `carousel`): tolerates 3-10; <3 may leave empty space. Quote length affects card height (cards equal height by flex); keep within ~140 chars.
- IDs FIXED: `#reviews` (home, works), `#carousel`, `#rev-title`.

### 3.6 Logo marquee ("Trusted by")
- Component `LogoMarquee` (`src/components/site/ui/LogoMarquee.tsx`) uses `src/content/logos.ts` `trustedBy` (10 text logos: NORTHWIND caps, halcyon dot, Marlow & Co. serif, orbit_ mono, ASTER LABS caps, Kite, Verdant serif, fold. dot, quill mono, TESSEL caps). Items are TEXT wordmarks (class caps/serif/mono + optional dot `<i>`), not images. Seed `trusted_by` key (identical) DB-UNUSED.
- Shown on: every service page (`ServicePage.tsx` hero `.logos`, label "Trusted by"). HOME has its OWN hardcoded copy in `HomeIntroRun.tsx` (`.intro-band .logos`, label "Trusted by"; same 10 names, listed twice inline).
- FIXED: the list is rendered twice (CSS animation loop: translate -50%), `aria-hidden="true"`, `.marquee-track`. Min ~6 items to cover the width; max ~16 (speed scales with width; keep similar speed).

### 3.7 Where each shared block appears
| block | Home | About | Works | Work/[slug] | Services/[slug] | Blog | Blog/[slug] | Contact | 404 |
|---|---|---|---|---|---|---|---|---|---|
| Nav | Y | Y | Y | Y | Y | Y | Y | Y | Y |
| CtaBand | Y | Y | Y | Y | Y | Y | Y | NO | Y |
| Footer variant | home | about | works | default | default | default | default | contact | default |
| ReviewsSection / HomeReviews | Y(hard) | - | Y | - (verify) | Y | - | - | - | - |
| LogoMarquee | own copy | - | - | - | Y | - | - | - | - |

---

---

# Part 8. Other routes and URL probes

### 4.1 Route inventory
| Route | File | Kind | Needs content schema? |
|---|---|---|---|
| `/` | `src/app/(site)/page.tsx` | public page | YES (home) |
| `/about` | `(site)/about/page.tsx` | public page | YES |
| `/works` | `(site)/works/page.tsx` | public listing | YES |
| `/works/[slug]` | `(site)/works/[slug]/page.tsx` | dynamic page (case_studies D1) | YES (CMS exists) |
| `/services` | `(site)/services/page.tsx` | redirect-only: `permanentRedirect("/#services")` (308) | No (no overview page exists in the original) |
| `/services/[slug]` | `(site)/services/[slug]/page.tsx` | dynamic page (services D1) | YES (CMS exists) |
| `/blog`, `/blog/[slug]` | see Part 1 | page / dynamic | YES |
| `/contact` | see Part 2 | page | YES |
| `/admin/login`, `/admin/*` (console: blog, case-studies, services, integrations, media, navigation, settings, submissions, dashboard) | `src/app/(admin)/...` | admin (own root layout, noindex, auth, no-store) | No (internal tool) |
| `/robots.txt` | `src/app/robots.ts` | technical (from Settings > SEO: indexing, disallow list, sitemap flag; `/admin` always blocked) | No (settings) |
| `/sitemap.xml` | `src/app/sitemap.ts` | technical (fixed pages + published services, case studies, live blog posts) | No |
| `/media/[...key]` | `src/app/media/[...key]/route.ts` | technical: serves R2 uploads (only `uploads/YYYY/MM/uuid.ext`), CSP sandbox | No |
| `/api/health` | `src/app/api/health/route.ts` | technical (D1/R2 check, 200/503) | No |
| `/api/admin/media` (GET/POST), `/api/admin/media/[id]/replace` (POST) | `src/app/api/admin/media/...` | technical, admin-only (401 when signed out) | No |
| not-found / error | NO `not-found.tsx` / `error.tsx` / `global-error.tsx` in `src/app` (only `(admin)/admin/(console)/error.tsx` and `loading.tsx`) | framework default 404 inside site layout | YES (candidate: 404 content) |
| Server actions | `src/actions/*` (contact, blog, navigation, ...) | technical | No |

Redirects (`next.config.ts` `redirects()`, permanent): `/index.html`->`/`, `/about.html`->`/about`, `/works.html`->`/works`, `/blog.html`->`/blog`, `/contact.html`->`/contact`, `/work/:slug.html`->`/works/:slug`, `/service/:slug.html`->`/services/:slug`, `/blog/:slug.html`->`/blog/:slug`. DB-driven redirects: `slug_redirects` (kinds service, case_study, blog_post) after slug rename. `src/worker.ts` has an edge cache (CACHEABLE paths, keyed on `app_meta.content_version`, skipped for session cookie/query strings) but NO redirects. Security headers on all routes; `/admin/*` no-store.

### 4.2 Live probes (localhost:3001; "-" = no redirect)
| URL | status | note |
|---|---|---|
| /privacy, /terms, /cookies, /cookie-policy, /privacy-policy | 404 | no legal pages exist; footer legal links are `#` |
| /careers | 404 | the About page has a `#careers` anchor (roles), not a route |
| /services | 308 -> `/#services` | |
| /services/brand-identity | 200 | (also product-design, web-design-build, motion-3d in sitemap) |
| /services/nope, /works/nope, /blog/nope | 404 | |
| /works, /about, /contact, /blog | 200 | |
| /404, /nope, /work, /case-studies, /team, /pricing, /faq, /legal, /sitemap | 404 | default Next 404 ("404: This page could not be found."), title falls back to site default title |
| /blog.html, /contact.html, /about.html, /index.html | 308 -> /blog, /contact, /about, / | |
| /robots.txt | 200 | `Allow: /`, `Disallow: /admin`, `Sitemap: http://localhost:3001/sitemap.xml` |
| /sitemap.xml | 200 | home, about, works, blog, contact + 4 services + 8 works (orbit, marlow, kite, verdant, halcyon, northwind, aster, fold) + 6 blog posts |
| /api/health | 200 `{"status":"ok","checks":{"d1":"ok","r2":"ok"}}` | |
| /media/x | 404 | key pattern guard |
| /admin | 307 -> /admin/login | |
| /admin/login | 200 | |
| /admin/blog | 307 -> /admin/login | |
| /api/admin/media | 401 | |

### 4.3 Legal/dead links to flag
- Footer legal row (Privacy policy, Cookie policy, Terms): `href="#"` x3 on every page; no routes. Candidate for either new simple "legal page" content type (title, last updated, rich body) or hiding with a toggle.
- Footer socials: `href="#"` when the Settings > Social URL is empty (current seed has them empty => dead links today).
- Newsletter form: no action.
- About page "careers" is an in-page anchor only.

---

---

# Appendix. Gaps and surprises from the shared/route audit

### Key gaps / surprises (for the CMS design)
1. Seeded `site_settings` keys `site.cta`, `site.contact`, `site.footer`, `home.reviews`, `reviews`, `trusted_by` exist in D1 but NOTHING renders from them (`getSetting` has no runtime callers; only `scripts/db/verify.mjs`). Components still read JSX / `src/content/*.ts`. They are ready-made schemas to wire up.
2. Home duplicates data: `HomeReviews.tsx` and `HomeIntroRun.tsx` hard-code reviews and the logo marquee instead of using `src/content/reviews.ts` / `logos.ts`; Works/Services use the shared content files. Phone/address/hours in Settings > Contact are never rendered on /contact or in the footer.
3. No site-wide 404/error page, no legal pages, footer newsletter has no backend, footer/CTA/contact copy all hardcoded; contact option lists (NEEDS/BUDGETS) are duplicated in a content file AND the Zod schema (must stay in sync).
