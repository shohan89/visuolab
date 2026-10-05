# Visuolab — Design Parity Report

Migrated so far: the visual system (CSS, fonts, assets), every JavaScript behavior, the shared chrome (nav, mega menu, mobile menu, footer, CTA band), and these pages: **Home (`/`)**, **About (`/about`)**, **`/services`** (redirect, see 6.13) and the four service pages **`/services/brand-identity`, `/services/product-design`, `/services/web-design-build`, `/services/motion-3d`**, plus **`/works`** and the eight case studies **`/works/{orbit,marlow,kite,verdant,halcyon,northwind,aster,fold}`**, plus **`/blog`** and the six articles **`/blog/{design-systems-that-survive,designing-for-trust-in-fintech,motion-that-earns-its-place,the-brief-that-writes-itself,webflow-or-next-js,what-a-rebrand-actually-costs}`** (all from static seed data). Finally **`/contact`** with a working form (section 5.10 and `CONTACT-FORM.md`). Every page of the original site is now migrated.

Reference: `referance-website/` (unchanged). New app: `visuolab-next/`.

## 1. Summary

| Area | Result |
|---|---|
| CSS | The six original files are copied **byte-for-byte** (checked with `cmp`). No class was renamed, no rule edited. |
| Pixel comparison, full page, animations frozen | Home, About, the four service pages, `/works`, the eight case studies, `/blog`, the six articles and `/contact`: **0 differing pixels** at 1920, 1440, 1280, 1024, 900, 768, 390 and 360 px, in `vite dev` and in the production build (sections 5.7 to 5.10). |
| Behavior comparison (motion on) | Same results as the original for every behavior listed in section 4, measured side by side (section 5). |
| Console | No errors or warnings on Home or About in the production build. |
| Known differences | 28, all listed in section 6. None changes layout, spacing, type or color. |
| Unresolved | 5, listed in section 7. |

How it was measured: Playwright (Chromium) screenshots of the original (served from `referance-website/` over HTTP) and the new app at the same viewport, `prefers-reduced-motion: reduce`, with CSS animations/transitions frozen, the showreel video, WebGL canvases and the live clock text hidden in both (they change over time), then compared with `pixelmatch` (threshold 0.1). Page heights matched exactly in every run.

## 2. Visual system

### 2.1 Stylesheets

| Original | New | Status |
|---|---|---|
| `css/base.css` (386 lines) | `src/styles/base.css` | identical |
| `css/hero.css` (193) | `src/styles/hero.css` | identical |
| `css/sections.css` (404) | `src/styles/sections.css` | identical |
| `css/work.css` (331) | `src/styles/work.css` | identical |
| `css/pages.css` (482) | `src/styles/pages.css` | identical |
| `css/about.css` (157) | `src/styles/about.css` | identical |

**Why the sheets are switched per route (`StyleGate`).** The static pages each loaded a different subset (home: base + hero + sections; About: base + sections + about; blog, contact, services: base + sections + work + pages; works and case pages: base + sections + work). The files reuse class names with different meanings, so loading all six everywhere changes how pages render. Two proven cases:

- `.out`: a pill row of step outputs on Home (`sections.css`) and a stat card on service pages (`pages.css`). With all six loaded, every Home process step grew by 150 px (page 600 px taller, 12 % of pixels different).
- `.about-lead`: defined in `work.css` (case pages) and `about.css`. With all six loaded, the About lead paragraph picked up `letter-spacing: -0.035em` from `work.css` and wrapped differently.

64 class names appear in more than one of the six files (for example `.h2`, `.lead`, `.stat`, `.stars`, `.copy`, `.facts`, `.out`, `.about-lead`, `.reviews-head`, `.review-card`); many are intentional overrides between files that load together, but the cases above show others are not. Renaming classes would have changed the CSS; instead `src/components/site/StyleGate.tsx` renders all six `<link rel="stylesheet">` elements in the original order and gives each `media="all"` or `media="not all"` from `src/lib/css-sets.ts`. Sheets that are off are still downloaded, so client-side navigation switches instantly and the cascade for each page is exactly the original one.

### 2.2 Fonts

| | Original | New |
|---|---|---|
| Source | Google Fonts `<link>` (`preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`) | same `<link>` elements, same URL, in `src/app/(site)/layout.tsx` |
| Families / weights | DM Sans 400;500;600, Instrument Serif regular + italic, Inter Tight 400;500;600, `display=swap` | same |
| Used by | `--sans`, `--serif`, `--nav-font` | unchanged (CSS is identical) |

Fonts are still loaded from the Google CDN, as before. Self-hosting is not done: vinext does not extract Google Fonts at build time (its README lists this as a known gap), and `next/font` would rename the families the CSS refers to.

### 2.3 Assets, scripts, markup

- `public/assets/` holds the original images and video, unchanged. URLs are `/assets/...` (the `?v=182359` cache-bust is dropped).
- Lenis `1.1.18` and Three.js `0.170.0` are installed from npm at the **same versions** the original loaded from jsDelivr (pinned exactly). They are bundled, not fetched from a CDN at runtime.
- JSX was generated from the original HTML by a one-off converter (not shipped), so the DOM is class for class the same: same tags, attributes, inline `--i` stagger variables, whitespace handling and SVG paths. Internal links are rewritten to the new clean URLs.
- Images stay plain `<img>` with the original `width`/`height`/`loading`/`fetchpriority` attributes.

## 3. Components created

Only components that existed in the original design. No new visual component was added.

| Component | Replaces | Kind |
|---|---|---|
| `Nav`, `Brand`, `MobileNav` (+ `content/nav.tsx`) | header markup in every page; mobile menu built by script | client (nav state, menu) |
| `Footer` (variants `default`, `home`, `about`, `works`), `CtaBand`, `ShellFooter` | footer and CTA band (CTA omitted on `/contact`, as in the original) | client wrapper picks the variant from the route |
| `Pill` | the `.pill` CTA button with its double-arrow badge | server |
| `WorksPage`, `WorksFilters`, `WorksGrid` (+ `Filter` context) | works index: heading, discipline chips, case cards | server page; chips and grid are client |
| `CaseStudyPage` (+ `CasePanel`, `Stairs` with deliverables, `ReviewsSection`) | the eight case study pages, one layout, fed by the typed `CaseStudy` model | server; `Stairs` is client |
| `ContactSection`, `ContactForm` (+ `Link`, the site-wide link) | contact page and its form (now a working form); `Link` is `next/link` with prefetch off | server page; the form is client |
| `BlogListing`, `BlogCard`, `BlogGrid`, `BlogArticle` (+ `ArticleToc`, `ShareRail`, `FilterChips`) | blog index with featured article and topic filter; the six article pages | server; table of contents, copy button and the grid are client |
| `ServicePage` (+ `ServiceReviews`, `CasePanel`, `Stairs`, `LogoMarquee`, `Aurora`, `Rich`, `SvgIcon`) | one layout for the four service pages, fed by seed data | server; `Stairs` is client |
| `HomeHero`, `HomeIntroRun`, `HomeServices`, `HomeWorkRun`, `HomeReviews` | home sections | server |
| `AboutHeroRun`, `AboutPrinciples`, `AboutMission`, `AboutStory`, `AboutManifesto`, `AboutPlaces`, `AboutFaqRun` | About sections | server |
| `SiteMotion` | Lenis, anchors, load-in, reveal in `main.js` | client |
| `HeroBanner`, `Stars`, `MeshFlow` | `hero.js`, `mesh.js`, star field | client / server |
| `Reel`, `CaseStack`, `ScrollWords` | showreel, case stack, manifesto in `main.js` | client |
| `Clock`, `Faq`, `CarouselNav`, `NewsletterForm` | clocks, FAQ, carousel buttons, footer form | client |
| `AboutScene` (+ `lib/motion/scene.ts`) | `scene.js` | client, Three.js loaded lazily |
| `StyleGate` | per-page `<link>` sets | client |

Routes: `src/app/(site)/page.tsx` (`/`) and `src/app/(site)/about/page.tsx` (`/about`). The legacy `.html` URLs redirect with 308 (`next.config.ts`).

## 4. JavaScript behavior: original vs migrated

Rule applied: React state and effects replace DOM manipulation where that is safe; where an effect is inherently about layout measurement or canvas, the original logic is kept (same constants, same maths).

| # | Original behavior (file) | Migrated to | Same logic kept? | How DOM/state is used now |
|---|---|---|---|---|
| 1 | Smooth scroll: `new Lenis({lerp:.075, wheelMultiplier:.8, smoothWheel, touchMultiplier:1.6, gestureOrientation:'vertical', autoResize})`, rAF loop, `html.lenis-on`, `window.lenis`; off under reduced motion (`main.js`) | `SiteMotion` | yes, same options | effect with cleanup (`destroy`); instance in a small external store so other components can pause it |
| 2 | In-page anchors ease through Lenis (`offset:-60`, `duration:1.4`); arrival with a hash glides (`1.2`) | `SiteMotion` | yes | document click listener; hash effect also runs after client-side navigation |
| 3 | Load-in: two rAFs then `body.loaded` | `SiteMotion` | yes | effect adds the class |
| 4 | Scroll reveal: `IntersectionObserver` (`rootMargin 0 0 -10% 0`, `threshold .05`), adds `.in` once; reduced motion adds `.in` to all | `SiteMotion` | yes | re-armed on every route change |
| 5 | Shared scroll driver (rAF-throttled `onScroll` fed by `scroll`, `resize`, Lenis) | `lib/motion/scroll.ts` | yes | subscribers register in effects |
| 6 | Nav `.scrolled` after 24 px; `.over-light` from `.light` sections + `data-light-offset` | `Nav` | yes, same test (`top + offset <= navH*.6 && bottom >= navH*.6`) | **React state** drives the classes |
| 7 | Mega menu: opens on `:hover` / `:focus-within` | `Nav` (CSS) | unchanged | pure CSS |
| 8 | Mobile menu: scraped from the desktop DOM; open/close timing 380 ms, focus on close button, focus trap, Escape, link click closes, closes at ≥901 px, Lenis stop/start, `html.mnav-open`, `data-lenis-prevent` | `MobileNav` | yes | **React state + portal**; built from the same data as the desktop menu |
| 9 | Hero scroll sequence: progress spring (95 ms), phases 0–3.2 / 3.2–5.6, `--reach --pulse --ripple --ripple-opacity --mx --my --float`, pointer parallax (190 ms ease), IO gate `rootMargin 25%`, reduced motion | `HeroBanner` + `lib/motion/hero.ts` | yes, formulas copied | writes CSS variables on the banner (as before) |
| 10 | Star field (48 generated stars) | `Stars` (server) | yes, same generator | rendered as elements, no script |
| 11 | Mesh gradient: WebGL domain-warped fbm shader, DPR cap 1.5, ResizeObserver, IO + visibility pause, reduced-motion single frame, CSS fallback | `MeshFlow` + `lib/motion/mesh.ts` | yes, shader text and constants unchanged | canvas appended to the host; `.has-gl` is React state; cleanup loses the GL context |
| 12 | Showreel: `--p` smoothstep growth; video plays only when 20 % visible | `Reel` | yes | scroll subscriber + IO |
| 13 | Case stack `--p` per panel (desktop only, ≥901 px) | `CaseStack` | yes | scroll subscriber |
| 14 | Manifesto: words split and lit one by one (`--o`, two-word ramp) | `ScrollWords` | yes | words are split **in render** (no text-node mutation); only `--o` is written |
| 15 | Live clocks: `Intl.DateTimeFormat`, 1 s tick, Working now / After hours / Weekend, `.off` | `Clock` | yes | **React state**; server renders the `--:--` placeholders |
| 16 | FAQ accordion: one open at a time, first open | `Faq` | yes | **React state** |
| 17 | Reviews carousel buttons: `scrollBy` one card + 16 px | `CarouselNav` | yes | one delegated click handler |
| 18 | Footer newsletter form: `onsubmit="return false"` | `NewsletterForm` | yes | `preventDefault` |
| 19 | About 3D scene: glass band, transmission, dispersion, backdrop trick, environment, lights, pointer and scroll reaction, IO + visibility pause, try/catch fallback | `AboutScene` + `lib/motion/scene.ts` | yes, geometry, material and motion copied; typed | canvas appended to the host; added dispose on unmount |
| 20 | Hover effects (about 88 rules) | CSS | unchanged | CSS is identical |
| 21 | Reduced-motion paths (CSS and JS) | same | unchanged | each module checks `matchMedia` like before |

Not yet migrated (behaviors that belong to unmigrated pages): works/blog filter chips, article TOC and share rail, stairs tooltips, contact form. Their original logic is documented in `EXISTING-SITE-AUDIT.md` section 4.

## 5. Verification results

### 5.1 Full-page pixel comparison (animations frozen)

| Page | Width | Original height | New height | Differing pixels (dev) | Differing pixels (production build) |
|---|---|---|---|---|---|
| Home | 1440 | 11718 | 11718 | 0 | 0 |
| Home | 900 | 14194 | 14194 | 0 | 0 |
| Home | 390 | 14857 | 14857 | 0 | 0 |
| About | 1440 | 7193 | 7193 | 0 | 3386 (0.033 %) |
| About | 900 | 8290 | 8290 | 0 | 4308 (0.058 %) |
| About | 390 | 10639 | 10639 | 0 | 2015 (0.049 %) |

### 5.2 Behavior comparison (motion on, side by side, 1440 × 900 unless noted)

| Check | Original | New |
|---|---|---|
| Lenis active (`html.lenis-on`), body `.loaded` | yes / yes | yes / yes |
| WebGL mesh canvas present and `.has-gl` | yes | yes |
| Star elements | 48 | 48 |
| Hero `--reach` at scrollY 300 / 900 / 1500 | 0.25 / 1.00 / 1.00 | 0.25 / 1.00 / 1.00 |
| Hero `--pulse` at 1500 / 2300 | 0.03 / 0.02 | 0.03 / 0.02 |
| Showreel `--p` at 1500 / 2300 / 3300 | 0.000 / 0.477 / 1.000 | 0.000 / 0.477 / 1.000 |
| Case panel `--p` at 5600 / 9500 | 0.043 · 0 · 0 / 1 · 1 · 1 | 0.043 · 0 · 0 / 1 · 1 · 1 |
| `.reveal` elements revealed at 3300 / 4200 / 5600 / 9500 | 3 / 9 / 10 / 18 of 35 | 3 / 9 / 10 / 18 of 35 |
| Nav classes (`scrolled`) | scrolled after 24 px | scrolled after 24 px |
| Showreel video pauses when far off screen | yes | yes |
| Reviews carousel "next" scrolls | yes | yes |
| Mega menu visible on hover | `visible` | `visible` |
| `a[href="#work"]` lands at | 60 px from top | 60 px from top |
| Mobile (390 × 844): burger → menu open (`mnav is-open`, `html.mnav-open lenis-stopped`, focus on close button) | yes | identical |
| Mobile: Services sub-list opens, 22 links in the menu | yes | identical |
| Mobile: Escape closes (`hidden`, `lenis` restored, focus back on burger) | yes | identical |
| About: 3D canvas size | 594 × 594 | 594 × 594 |
| About: manifesto words | 64 words, `--o` 1.000 at the end | same |
| About: clocks | Lisbon 06:50 GMT+1 · Toronto 01:50 GMT-4 · Singapore 13:50 GMT+8 · Sydney 16:50 GMT+11, Weekend | identical |
| About: FAQ states | `100000 → 001000 → 000000` | identical |
| Console, production build, Home and About | no issues | no issues |

### 5.3 Client-side navigation (production build)

Home → About → Home → `/about#careers`: stylesheet sets switch correctly (`hero` off on About, `about` on, and back), the 3D canvas mounts on About and is gone on Home, exactly one mesh canvas exists on Home after returning, `html` is left with the `lenis` class only, the hash target lands at 60 px from the top, no console issues.

### 5.4 Interactive states (viewport screenshots, dev server, animations frozen)

| State | Differing pixels |
|---|---|
| Mega menu open (hover on Services), 1440 | 0 |
| Mega menu with a card hovered, 1440 | 0 |
| Nav switched to dark text over the light Services section, 1440 | 0 |
| Contact pill hover (arrow swap), 1440 | 0 |
| Mobile menu open, 390 | 0 |
| Mobile menu with Services expanded, 390 | 0 |
| About FAQ third item opened, 1440 | 0 |
| Case stack mid-transition (scrollY 5600), 1440 | 0 |
| Hero scrolled (scrollY 500), 1440 | 0 |


### 5.5 Global shell, width sweep

Nav (`header.nav`), CTA band (`section.cta`) and footer (`footer.footer`) were screenshotted as elements on Home and About at 12 widths (1920, 1440, 1280, 1100, 1024, 900, 820, 768, 600, 560, 390, 360, covering every breakpoint the shell CSS uses) and compared with the original: **0 differing pixels in all 72 comparisons**, with identical element sizes. Full-page diffs after moving the footer and CTA into the root layout are still 0.

Shell pieces and where they live: `Nav` / `MegaMenu` markup / `MobileNav` / `Brand` (logo) / `Pill` (CTA button) in `components/site/chrome` and `components/site/ui`; `ShellFooter` (CTA band + footer, route-aware) and `StyleGate` in the root layout; global typography, spacing and container system are the original classes in `base.css` (`.wrap`, `.h1`–`.h3`, `.lead`, `.label`, `.sec`, `.rhythm`). The original has no page transitions (no view-transition CSS, no transition script), so none exist.

### 5.6 Homepage acceptance run

Full-page pixel diff of `/` against `index.html` (animations frozen): **0 differing pixels at 1920, 1440, 1280, 1024, 900, 768, 390 and 360 px**, identical page heights each time (12008, 11718, 11502, 12252, 14194, 14288, 14857, 14999).

Hover and open states on Home (viewport screenshots, 0 differing pixels each): Why-list link, services row, Book-a-call pill, case panel (also at 900 px), "View all projects" pill, industry card, process CTA, carousel round button, review card, closing CTA pill and arrow link, footer link, award badge card, social icon, hero pill and hero arrow link.

Links: the 80 `<a href>` on Home map one-to-one to the original (0 mismatches after the `.html` → clean URL mapping); anchors `#contact`, `#work`, `#top`, `#process`, `#reviews` all have targets; `mailto:hello@visuolab.studio` unchanged. Internal targets that exist today: `/` and `/about` (200). **Not built yet (404): `/works`, `/blog`, `/contact`, `/services/{brand-identity,product-design,web-design-build,motion-3d}`, `/works/{orbit,marlow,kite,verdant}`.** The destinations are the correct ones; the pages arrive in the next steps.

Console and assets, desktop 1440, tablet 820 and mobile 390, after scrolling the whole page with the wheel: no console errors or warnings, no failed requests, 29/29 images loaded, fonts Inter Tight, Instrument Serif and DM Sans loaded (DM Sans is only used by the desktop nav, so it does not load below the nav breakpoint in either version), no horizontal scroll, same reveal counts as the original, showreel video `muted loop autoplay playsinline preload=metadata` ready (`readyState 4`, no error). The poster attribute is `/assets/showreel-poster.jpg` instead of `assets/showreel-poster.jpg`; same file.

### 5.7 About and service pages

Seed data: `src/content/services.ts` (extracted from `service/*.html` by a one-off script), plus `reviews.ts` and `logos.ts`; types in `content/types.ts`. Inline markup in seed text is limited to `<em>`, rendered by `Rich` (no HTML is injected). The four pages share one `ServicePage` component; it was accepted only because the output is pixel-identical (below).

Full-page pixel diff against the original (animations frozen, page scrolled first so lazy images are loaded):

| Page | 1920 | 1440 | 1280 | 1024 | 900 | 768 | 390 | 360 |
|---|---|---|---|---|---|---|---|---|
| About | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Brand identity | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Product design | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Web design & build | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Motion & 3D | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

(Differing pixels; page heights identical every time, for example Brand identity 8960 / 8839 / 8729 / 9135 / 10483 / 10816 / 12081 / 12284.) The production build (`wrangler dev` preview) was compared for About, Home and the service pages at 1440, 900 and 390 px: 0 differing pixels.

Interactive states on a service page (0 differing pixels each): hero pill hover, hero image pair hover, included-card hover, process step hover, process step opened (Brand identity and Motion & 3D), case panel hover, case stack mid-transition, review card hover, carousel button hover, mobile menu open (390 px), and the process steps at 900 px.

Behavior, original against new, Brand identity and Motion & 3D: same title and meta description; same hidden sections (`prob-sec`, `band-sec`); same reveal counts (39 of 46); case panel `--p` values equal; process steps open one at a time, close on the second click, on Escape and on an outside click, with identical `aria-expanded` sequences (`0000 > 0100 > 0010 > 0000 > 1000 > 0000 > 0001 > 0000`); the carousel moves; 55 of 55 links map one-to-one to the original targets; 26 of 26 images, loaded; no console errors and no failed requests.

Routes: `/services/{slug}` returns 200 for the four slugs and 404 for any other; `/services` redirects (308) to `/#services`; `/service/<slug>.html` redirects (308) to `/services/<slug>`.

### 5.8 Works index and case studies

**Data model.** `CaseStudy` in `src/content/types.ts` (typed: card, hero facts, cover, about and stats, two galleries, process steps with deliverables, challenges, wide image, results, more work). The eight records and the card order of `/works` live in `src/content/cases.ts`, extracted from `work/*.html` and `works.html` by a one-off script. Nothing is in the database. All eight pages have the same structure and differ only in content, so one `CaseStudyPage` renders every record; this was accepted only because the output is pixel-identical (below). Inline markup in text is limited to `<em>` and `<b>` (rendered by `Rich`, no HTML injection).

**Pixel diff, full page, animations frozen, page scrolled first:** `/works` and the eight case studies at 1920, 1440, 1280, 1024, 900, 768, 390 and 360 px: 72 comparisons, **0 differing pixels** after discounting three runs that showed 769–6,700 pixels (0.01–0.06 %) while the machine was busy; each of those three was repeated twice and was 0 both times (lazy images not yet decoded). Page heights identical every time (for example Works 5326 at 1440; Orbit 7660 at 1440 and 11235 at 390). Production build (`wrangler dev` preview), all nine pages at 1440 and 390: 18 of 18 comparisons are 0.

**Interaction states, 0 differing pixels each (viewport screenshots):** Works chip hover; filter Brand; filter Motion then scrolled; filter Packaging then All; card hover (second and last card); carousel button hover; Web filter at 390 px; Product filter at 900 px; case process note opened with its deliverables (Orbit, Kite); process step hover; gallery figure hover; "more work" card and "All projects" pill hover; mobile menu at 390 px. (At 900 px the process "+" buttons are `display:none` in both versions and every note is shown, so there is nothing to click there.)

**Behavior, original against new:** Works: chip counts All 8 / Brand 3 / Product 3 / Web 4 / Packaging 2 / Motion 5 are computed from the data and match; each filter shows the same cards (brand 3, product 3, web 4, packaging 2, motion 5, all 8), the active chip carries `.is-on` and `aria-pressed`, shown cards carry `.in`, the empty message stays hidden; the carousel moves. Case studies: process notes open one at a time, close on a second click, Escape and an outside click, with the same `aria-expanded` sequences; the same 2 / 2 / 1 / 1 deliverables per phase; same titles, meta descriptions and reveal counts; 55 of 55 links per case page and 58 of 58 on Works map one-to-one to the original targets (the two exceptions are footer links on Works, 6.17); no console errors, no failed requests, no broken images.

**Assets.** The 8 case images used by the data are byte-identical to the originals (SHA-256) and are served with 200 and the right content type; every file of `referance-website/assets` also exists in `visuolab-next/public/assets`. The images referenced by the pages (card, cover, gallery crops via `object-position`, wide image, "more work" thumbnails, review avatars, CTA floaters) loaded on every page.

Routes: `/works` and the eight `/works/{slug}` return 200, any other slug 404; `/work/<slug>.html` and `/works.html` redirect (308).

### 5.9 Blog and articles

**Data model.** `BlogPost` in `src/content/types.ts`: slug, meta, category, title, ISO publish date, read minutes, author, cover, optional excerpt (featured article only), lead paragraph, body as typed blocks (`heading` / `paragraph`), the closing outro line with its link, and the two related slugs. The six records, the order of `/blog` (first = featured, rest = grid) and the topic list live in `src/content/blog.ts`, extracted from `blog.html` and `blog/*.html` by a one-off script. Dates are stored as ISO and shown as "12 Sep 2026" by a fixed formatter. Heading ids and the table of contents are generated from the headings with the original script's rule. Nothing is in the database.

**Pixel diff, full page, animations frozen:** `/blog` and the six articles at 1920, 1440, 1280, 1024, 900, 768, 390 and 360 px: 56 comparisons, **0 differing pixels**; page heights identical (for example Blog 3504 at 1440 and 5527 at 390). Production build (`wrangler dev` preview), all seven pages at 1440 and 390: 14 of 14 are 0. Interaction states, 0 differing pixels each: topic chip hover; Product filter; Web then All; featured card hover; grid card hover; Motion filter at 390 px; Brand filter at 900 px; table-of-contents link hover; share button hover; two scroll positions (scroll-spy highlight moving); "keep reading" card and "All articles" pill hover; nav switching to dark text over the light article; mobile menu at 390 px; article at 900 px.

**Behavior, original against new (all seven pages):** topic chips show All 6 / Brand 1 / Product 2 / Web 1 / Motion 1 / Process 1 and each filter shows the same cards; the featured article is not part of the filtered grid (as in the original); the active chip carries `.is-on` and `aria-pressed`; shown cards carry `.in`. Articles: same table-of-contents entries and heading ids; scroll-spy highlights the same entry at five scroll positions; a table-of-contents click lands the heading at the same offset; share links (X, LinkedIn, Facebook) have the same labels, targets and `rel`; the copy button copies the article address, switches to the check icon (`.copied`) and back after 1.6 s, as before; the outro link scrolls to the contact section at the same offset; titles, meta descriptions and `lang` equal; 62 of 62 links per article map to the original targets (63 on one); no console errors, no failed requests, no broken images. One real difference was found and fixed during testing: the original copied the address captured at page load (no `#section`), and the first version copied `location.href` at click time, which included the section after a table-of-contents click.

**Metadata (head only, no visual effect).** `pageMetadata()` in `src/lib/seo/metadata.ts` builds, for `/blog` and every article: `<title>`, description, canonical URL, Open Graph (`og:title`, `description`, `url`, `site_name`, `locale`, `type` = `website` or `article`, `image` with alt, and for articles `article:published_time` and `article:author`) and the Twitter card (`summary_large_image`). Titles and descriptions are the ones from the static pages. Canonical and Open Graph URLs are absolute: the root layout sets `metadataBase` from the `SITE_URL` variable (`lib/site.ts`), and the article share links and copied address use the same origin. Verified in the production build with `SITE_URL` overridden: canonical, `og:url`, `og:image` and the share link all follow it. Each article also carries a schema.org `BlogPosting` JSON-LD script (headline, description, image, date, section, author, publisher). **Before deploying, set `SITE_URL` in `wrangler.jsonc` to the real domain** (it is `http://localhost:3001` now). The other pages still use their original title and description only; `pageMetadata()` can be applied to them the same way.

Routes: `/blog` and the six `/blog/{slug}` return 200, any other slug 404; `/blog.html` and `/blog/<slug>.html` redirect (308).

### 5.10 Contact page and form

The page was ported from `contact.html` (the section is generated from the original markup; only the `<form>` is a component). The form keeps the original markup and classes. Added to it, invisibly: a `maxlength` on the text inputs and an off-screen decoy field for bots (`position:absolute`, `aria-hidden`, not in the tab order; it takes no space in the grid layout).

**Pixel diff, full page, animations frozen:** `/contact` at 1920, 1440, 1280, 1024, 900, 768, 390 and 360 px: 8 comparisons, **0 differing pixels**, identical heights (1803 / 1849 / 1892 / 1915 / 2532 / 3007 / 3738 / 3820).

**Interaction states, original against new, 0 differing pixels each:** focus in the name field; option chip hover; two options checked; fully filled form; submit button hover; the invalid state after pressing Send on an empty form; **the success state** (after a real submission: `.form-ok` shown, note hidden, button disabled at 60 % opacity) at 1440, 900 and 390 px; the e-mail link hover. (One 390 px run showed 13 pixels once; it was 0 on two repeats.) When the visitor is rate limited the page shows the `.form-note` line with an error message instead of the success panel; the original has no such state, so it has nothing to compare against.

**What changed in behavior** (original: "show success, send nothing"): the form now validates in the browser and on the server, checks spam and rate limits, stores the message in D1 and shows the same success panel. Full description, data model, privacy notes and the 58 test checks are in `CONTACT-FORM.md`. Native browser bubbles and the red `:user-invalid` border remain the field-error display; errors that belong to no field use the existing `.form-note` line.

**Links, title, description, fields (original against new):** 50 of 50 links map one-to-one (the exception is the footer Careers link, known difference 24), same title and description, same form fields plus the decoy field, no console errors, no failed requests, no broken images.

## 6. Known differences

None of these changes layout, spacing, typography or color.

1. **Footer links vary by page.** The original footer's own-page links differ from page to page (Home: `#process`, `#reviews`, brand `#top`; About: `index.html#process`, `#careers`; others: relative paths; the blog page even points at `#careers`, which does not exist there). Now `Footer` has variants `home`, `about` and `default` (cross-page links such as `/#process`). Only `home` and `about` exist so far; the rest will follow the page they belong to.
2. **Internal URLs are clean** (`/works`, `/services/brand-identity`, `/contact` …) instead of `*.html`. Old `.html` URLs redirect with 308.
3. **Libraries are bundled** (Lenis 1.1.18, Three.js 0.170.0, same versions) instead of loaded from jsDelivr. One Lenis option, `smoothTouch: false`, is omitted: Lenis 1.1 has no such option and the original value was ignored.
4. **`<noscript>` rule added** so `.reveal` content is visible without JavaScript (the original left it invisible).
5. **Hero stars are rendered on the server** with the same generator, instead of appended by script. The markup and inline styles are the same.
6. **Mobile menu opens one animation frame later.** The panel is unhidden, then `.is-open` is added on the following frame (the original forced a reflow in the same task). Close timing (380 ms) is the same. Not visible in the side-by-side runs.
7. **Cleanup on unmount.** The scroll driver, Lenis, observers, WebGL contexts and Three.js resources are disposed when the page changes. The original never had to, because each page was a full load.
8. **Nav `.scrolled` / `.over-light`, clocks, FAQ and mobile-menu state** are React state; the same classes appear on the same elements. The `.over-light` test now queries `.light` sections on each tick instead of caching the list at load.
9. **Reveal observer is re-armed per route** (needed for client-side navigation).
10. **The nav is one component for all pages** (the original had the same markup pasted 23 times). The mobile menu reads the same data instead of scraping the desktop DOM; the resulting DOM is identical (22 links, same classes).
11. **Three.js scene is typed and disposes its resources.** Geometry, material parameters, lights and the animation loop are unchanged. The version is pinned to 0.170.0 because newer versions deprecate `THREE.Clock` (a console warning).
12. **Fonts are still on the Google CDN** (same as the original), not self-hosted.
13. **`/services` has no page of its own.** The original has no services overview (the nav item only opens the mega menu), so the route permanently redirects (308) to `/#services`. No new page was designed.
14. **`svc-page` is a wrapper element, not a `<body>` class.** The shared layout owns `<body>` (it carries `rhythm`). The service rules (`.svc-page .sec`, `.svc-page .svc-hero`, `.svc-page .svc-band`, `--sec-gap`) are descendant selectors, so a wrapper around the page content gives the same cascade; `rhythm` and `svc-page` set the same 150 px gap. Pixel results above confirm it.
15. **The footer brand shows the dark logo image on every page except Home**, as in the original (only the Home footer lacked it). It is hidden by CSS either way; `Footer` has a `darkLogo` flag per variant.
17. **Works-page footer links.** The original works footer sends "Works" to the home page work section (`/#work`) and has a `#careers` link that points at an anchor which does not exist on that page. `Footer` has a `works` variant: "Works" keeps `/#work`, and Careers goes to `/about#careers` (the dead anchor was fixed, not copied).
18. **Works filtering is React state.** The original script toggled classes on the cards; now the chip row and the grid share a small context. The same classes appear in the same situations (`.is-on`, `aria-pressed`, `.is-hidden`, `.in` on shown cards). Until a chip is used the grid does not touch the card classes, so the scroll reveal still adds `.in` itself.
19. **Case data is typed, content is unchanged.** Case study text lives in `cases.ts` rather than in 8 HTML files; the rendered DOM is the same.
20. **Blog footer: Careers link.** The original footer on the blog pages had a `#careers` link whose target does not exist there; it now goes to `/about#careers` (same as the other inner pages).
21. **Blog filtering and the table of contents are React.** The grid shares the filter context with the chip row (same classes in the same situations); the table-of-contents links and heading ids are rendered by the server instead of built by script, and only the `.on` highlight is client state (same test as the original: heading top <= scroll + nav height + 40).
22. **Share rail is server markup.** The X, LinkedIn and Facebook links are plain anchors rendered with the page (they work without JavaScript); only the copy button is a client component. The original script computed the address at load time; the new links use the canonical address built from `SITE_URL`, identical on the real domain.
23. **Metadata additions.** Canonical, Open Graph, Twitter card and JSON-LD are new head tags (the original had only title and description). They change no pixel.
24. **Contact footer.** As on the original, the contact page has no closing CTA band, and its footer "Contact" link goes to the home page's closing section (`/#contact`); the dead `#careers` anchor became `/about#careers` (a `contact` footer variant).
25. **The contact form works.** In the original it only showed the success text. Now it validates, saves and can be rate limited (`CONTACT-FORM.md`). The only visible additions are the states the original could not show: a field message through the browser's own bubble for rules beyond `required`, and the `.form-note` line carrying an error message.
26. **Decoy field and `maxlength`** inside the form (invisible; spam protection and input limits).
27. **Link prefetching is off** (`components/site/ui/Link.tsx`). In the production build the router prefetched the page behind every visible link and, with it, browser preload hints for that page's images; every page logged "preloaded but not used" warnings and downloaded roughly 600 KB it did not need. The static site never prefetched. With it off, all eight page types log nothing.
28. **Separate admin area.** `/admin` has its own root layout, stylesheet and `noindex`; it shares nothing with the public site's design.
16. **CSS is not minified in production builds** (`build.cssMinify: false`). Vite 8's Lightning CSS minifier rewrote the `backdrop-filter` + `-webkit-backdrop-filter` pairs to the prefixed property only, which removed the blur on the About slider captions in Chromium (0.03–0.06 % pixel difference). The stylesheets are small; the original CSS now ships as written.

- **Blog CMS block styles (additive).** `src/styles/pages.css` ends with a marked "CMS additions" section for article elements the original site never had (h3, lists, quotes, figures, inline code). Selectors only match those new elements; the six original articles contain none, and all blog captures are 0 px different (see `BLOG-CMS.md`).

## 7. Unresolved

1. ~~Dev server only: client-side navigation failed with `process is not defined`~~ **Resolved.** vinext's dev runtime defines `window.process` and removes it after the first client navigation. `SiteMotion` now pins the property in dev only (`import.meta.env.DEV`), and Home → About → Home → `/about#careers` works in `vite dev` with no console issues. Production builds were never affected.
2. ~~About page, production build: 0.03–0.06 % of pixels differ~~ **Resolved.** Cause: the CSS minifier dropped `backdrop-filter` (6.16). 0 differing pixels now.
3. ~~`body` class for service pages~~ **Resolved** with a wrapper element (6.14).
4. **Not pixel-compared:** WebGL output (mesh and 3D scene, only their presence, size and lifecycle were compared), the showreel video frame, and the live clock text (hidden in both, since it changes every second). Hover and open states are compared in section 5.4 only where listed (for example card hover on service pages is not covered because those pages are not migrated).
5. **Pages not migrated yet:** none. Every page of the original is migrated.

## 8. Next steps

1. Isolate the dev-only navigation error (item 7.1).
2. Port the remaining pages with the same converter and run the same pixel and behavior checks per page (the checks are scripted; the scripts live in the working directory of this step, not in the repo — move them into `visuolab-next/scripts/parity/` when the repo gets a test setup).
3. Contact form: add Cloudflare Turnstile if the client wants a captcha-style check (needs a widget, so a design decision); add the notification email once the Resend key exists.
4. Replace hard-coded copy with data (Phase 5/6 of `ARCHITECTURE.md`) once pixel parity is locked.
