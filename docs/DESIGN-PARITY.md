# Visuolab — Design Parity Report

Scope of this migration step: the visual system (CSS, fonts, assets), every JavaScript behavior, the shared chrome (nav, mega menu, mobile menu, footer, CTA band), and two full pages used as the parity test bed: **Home (`/`)** and **About (`/about`)**. The other 21 pages are not migrated yet (section 8).

Reference: `referance-website/` (unchanged). New app: `visuolab-next/`.

## 1. Summary

| Area | Result |
|---|---|
| CSS | The six original files are copied **byte-for-byte** (checked with `cmp`). No class was renamed, no rule edited. |
| Pixel comparison, full page, 3 widths (1440 / 900 / 390), animations frozen | Home: **0 differing pixels** at all widths, dev and production build. About: **0 differing pixels** in dev; 0.03–0.06 % in the production build, all inside the About slider captions (section 6.1). |
| Behavior comparison (motion on) | Same results as the original for every behavior listed in section 4, measured side by side (section 5). |
| Console | No errors or warnings on Home or About in the production build. |
| Known differences | 12, all listed in section 6. None changes layout, spacing, type or color. |
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
| `Footer` (variants `default`, `home`, `about`), `CtaBand` | footer and CTA band | server (footer form is a client wrapper) |
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

## 7. Unresolved

1. **Dev server only: client-side navigation back to `/` fails** with `process is not defined` under `vite dev` (vinext). The same navigation works in the production build and in `wrangler dev` preview (section 5.3). Cause not found yet; to be isolated (candidate: a dev-mode dependency pre-bundle).
2. **About page, production build: 0.03–0.06 % of pixels differ**, concentrated in the blurred (`backdrop-filter`) captions on the project slider. The same screenshots are identical in dev. Sub-pixel, no layout shift; origin undetermined.
3. **`body` class for service pages.** The original uses `<body class="svc-page">` on the four service pages and `rhythm` elsewhere. The layout sets `rhythm` for every page. Service pages are not migrated yet; the class has to be set per route when they are.
4. **Not pixel-compared:** WebGL output (mesh and 3D scene, only their presence, size and lifecycle were compared), the showreel video frame, and the live clock text (hidden in both, since it changes every second). Hover and open states are compared in section 5.4 only where listed (for example card hover on service pages is not covered because those pages are not migrated).
5. **Pages not migrated yet (21):** `/works`, 8 case studies, 4 service pages, `/blog`, 6 articles, `/contact`. Links from Home, About, nav and footer to those routes currently lead to 404 pages. Their CSS sets are already defined in `css-sets.ts` but have not been compared against the originals.

## 8. Next steps

1. Isolate the dev-only navigation error (item 7.1).
2. Port the remaining pages with the same converter and run the same pixel and behavior checks per page (the checks are scripted; the scripts live in the working directory of this step, not in the repo — move them into `visuolab-next/scripts/parity/` when the repo gets a test setup).
3. Port the page-level behaviors that have no home yet: filter chips, TOC and share rail, stairs, contact form.
4. Replace hard-coded copy with data (Phase 5/6 of `ARCHITECTURE.md`) once pixel parity is locked.
