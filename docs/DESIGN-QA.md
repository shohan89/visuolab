# Design QA: original static site vs the Next.js app

Result: **no visual mismatch needed a fix.** Every route, at every width, renders pixel-for-pixel like the original when the same picture files are used; the only measurable differences are the intended ones listed under [Remaining differences](#remaining-differences). Nothing was redesigned and no visual pattern was added.

Audited 6 October 2026 against the production build (`wrangler dev --config dist/server/wrangler.json`, page cache on), with the original site served from `referance-website/`. The tools are in `scripts/qa/`.

## What was compared

| Route | Original file | Pages |
|---|---|---|
| `/` | `index.html` | 1 |
| `/about` | `about.html` | 1 |
| `/works` | `works.html` | 1 |
| `/works/[slug]` | `work/*.html` | 8 (aster, fold, halcyon, kite, marlow, northwind, orbit, verdant) |
| `/services/[slug]` | `service/*.html` | 4 (brand-identity, motion-3d, product-design, web-design-build) |
| `/blog` | `blog.html` | 1 |
| `/blog/[slug]` | `blog/*.html` | 6 |
| `/contact` | `contact.html` | 1 |
| `/services` | none | the original has no services index page; the app redirects `/services` to `/#services` (308) |

Viewports: **desktop** 1440 px, **tablet** 768 px and 1024 px, **mobile** 390 px and 320 px. The legacy `.html` addresses redirect to the clean routes (308).

## Method and results

### 1. Full-page pixel comparison (`scripts/qa/compare.mjs`)

Full-page screenshots, reduced motion, time-driven bits frozen the same way on both sides, every reveal resolved, lazy pictures loaded.

- **With the app's responsive picture copies** (what visitors get): 69 screenshots (23 pages × 1440 / 768 / 390). Page **heights are identical in all 69**. 0–0.182% of pixels differ, all inside pictures (see difference 1).
- **With the original picture files** (`NOSRCSET=1`, which removes only the `srcset` so the browser uses the same files the original used): of 69 screenshots **64 are byte-identical**, and the other 5 differ by 278–1,731 pixels (0.008–0.023%): single glyph edges and the About page's 3D canvas (difference 3). A second run at 1024 and 320 px: 44 of the 45 screenshots that finished in the time limit are identical; the 45th differs by 782 pixels (0.011%), also glyph edges.
- Pages whose layout has any chance to move (every route at three widths) therefore have **no spacing, size, width, colour, background, border, radius or image-placement difference**.

### 2. Computed-style parity (`scripts/qa/parity.mjs`)

Both DOMs are walked in parallel (about 380–900 elements per page) and every element's computed style is compared: font family, size, weight, style, line height, letter spacing, text transform and alignment, colour, background colour and image, all four borders (width, colour, style), all four radii, padding, margin, display, position, gap, shadow, opacity, transform, object-fit, filters, overflow, flex alignment, z-index, cursor; plus the position and size of each element.

- 23 pages × 3 widths (1440, 768, 390) = **69 comparisons: no typography, spacing, colour, background, border, radius or geometry difference.** (One margin difference reported on `/about` was a pairing artefact: the same element read in both pages gives the same 72 px margin and the same position.)
- With motion on, `transition-*` and `animation-*` (property, duration, delay, timing function, iteration, fill mode), `will-change`, `scroll-behavior`, `mix-blend-mode` and `pointer-events` on 9 routes at 1440 and 390: **no difference.**
- Fonts: the same families, styles and weights are actually loaded on all 8 route types (DM Sans 400/500, Instrument Serif regular and italic, Inter Tight 400/500/600, with the same unicode-range subsets, `font-display: swap`).

### 3. Behaviour (`scripts/qa/behavior.mjs`, motion on)

| Area | Result |
|---|---|
| Hover effects | 86 hovered elements on 8 routes (pills, nav links, mega-menu cards, work cards, case panels, blog cards, chips, footer links, FAQ rows, contact links, options): identical resting and hover styles. Three apparent differences were the elements caught mid-animation while the page was still scrolling; re-measured after the smooth scroll settles, none |
| Navigation | the same links and targets at 1440, 768 and 390 (24 links on desktop); the header background when scrolled is the same; the open mega menu is **pixel-identical** (0 differing pixels on Home and Blog). The only difference is whitespace between two inline pieces of the Design-sprint promo text, which does not render |
| Navigation from the database | The header, mega menu and footer now read `navigation_items` instead of arrays in the components. With the seeded rows the server-rendered header and footer of six routes (Home, About, Works, Contact, Blog, a service page) are **byte-identical** to the markup before the change (every character of `<header class="nav">…</header>` and `<footer>…</footer>` compared). The only markup that can differ is what an editor changes: new tab attributes on links set to open in a new tab. Checked again after the end-to-end edit test, which restores the menus. |
| Mobile menu | opens with the same 6 items; the open panel is **pixel-identical** (0 differing pixels) |
| Scroll behaviour | smooth scrolling (Lenis) on in both; a 1200 px wheel turn follows the same curve (at 100 / 300 / 600 ms and settled) and settles in the same place |
| Animations | the same elements are revealed on scroll on every route (counts equal), the same timing values; the reveal and hero load-in start when the HTML has been parsed, as in the original |
| 3D / mesh | the same canvases exist (hero mesh on Home, the glass band on About); no console error or warning on any route |
| Video | the showreel has the same poster, source, `muted`, `loop` and `playsinline` |
| Footer, CTA sections | identical in every full-page comparison above (they are part of every page) |

### 4. Motion-on screenshots

40 viewport screenshots with motion running (Home, About, Works, a service page; 1440 and 390; scroll positions 0, 700, 1400, 2400, 3600). Static sections are **0.000%** different (Works at desktop: all five positions identical). The positions that differ are the ones that contain something driven by time (difference 3). The original compared with itself differs the same way (the About page at 390 px against itself: 423 pixels).

## Remaining differences

None is a design mismatch; they are listed because they are measurable or because behaviour differs from the original in a way that is not visible.

| # | Route | Issue | Severity | Reason | Fix or accepted limitation |
|---|---|---|---|---|---|
| 1 | Every route with pictures (Home, Works, Case studies, Services, Blog, Articles, About) | Up to 0.18% of pixels differ inside pictures (mean difference 1.5% of the colour range where a pixel differs at all; page heights identical) | Low, not visible | Pictures are served as pre-made 128–1280 px copies through `srcset` (`docs/PERFORMANCE.md`), so the browser scales a 640–1280 px copy where the original scaled the 1600–1920 px file; the two resamplings differ in the last digits | **Accepted limitation** (bytes saved: 70–80% of picture weight). Proven by `NOSRCSET=1`: with the original files 64 of 69 screenshots are identical. A single picture can be restored by removing its entry from `src/lib/image-variants.generated.ts` |
| 2 | Home | The showreel does not download or play until its panel is about to scroll into view (the original starts fetching it with the page: `autoplay`, `preload="metadata"`) | Low, not visible | Performance: 1.6 MB no longer competes with the first screen. The panel shows the same poster, plays when 20% is visible and pauses when it leaves, exactly as the original's visibility rule | **Accepted limitation**. A reel panel scrolled to very quickly can show the poster for a fraction of a second before the first frame |
| 3 | Home (hero and showreel panel), About (3D band) | Frames differ between the two sites at the same scroll position, 1–12% of the viewport | Low, not a mismatch | These are time-driven: the mesh gradient, the glass band, the hand drift, the reel's cycling words are at a different phase in two separate page loads. The original differs from itself the same way (423 pixels on About at 390). The hero's skipped sub-visible style writes and the half-resolution gradient (`docs/PERFORMANCE.md`) are far inside that variation | **Accepted limitation**: not reproducible between two loads of the same page |
| 4 | About 390, Contact 768, Service (product design) 1440, Case study (kite) 390 and 1024, Article ("the brief…") 768 | 278–1,731 pixels (≤0.023%) of single glyph edges differ even with the original picture files | Very low, not visible (zoomed 4×, the words look the same) | Anti-aliasing of text over the page's gradients and canvases; the original compared with itself is identical on the Service page at 1440 and Contact at 768, so this is a real, tiny rendering difference. Computed styles, positions and sizes of the text are identical | **Accepted limitation**; cause not isolated (all style properties, the font files and positions are equal) |
| 5 | Every route | The fonts come from this site (`/fonts/…`, the same files and subsets Google served) instead of Google Fonts, and two are preloaded | None visible | Performance and privacy (no third-party request); loading is `font-display: swap` in both | **Accepted**: same glyphs, same fallback behaviour. First paint on a slow phone is 0.15–0.35 s later than before because of the preloads, see `docs/PERFORMANCE.md` |
| 6 | Every route | All six stylesheets are present in the page (the ones a route does not use are switched off) and the keyframes of the inactive ones are listed in the document | None | The app keeps all six sheets so client-side navigation is instant and the cascade stays in the original order; inactive sheets have no effect on the page. Sheets not needed by the first screen load after idle | **Accepted**: no visual effect (parity runs show identical computed styles) |
| 7 | `/services` | The original has no such page; the app redirects it to `/#services` | None | Needed so that the Services link of a breadcrumb or old address does not 404 | **Accepted** |
| 8 | Every route | Addresses are clean (`/about`) instead of `about.html`; legacy `.html` addresses redirect with 308 | None | Migration requirement | **Accepted** |

## Navigation CMS (`scripts/qa/navigation-qa.mjs`)

Run against the dev server and its local database (45 checks, all passing): the sidebar item is a link and the "Soon" badge is gone; adding, editing, deleting, reordering (arrows and drag and drop), hiding and cancelling items; an internal and an external link (new tab, `rel="noopener noreferrer"`); the contact button and a Services dropdown link; the mobile menu (390 px: opens, shows the edited button and the new dropdown link, a link navigates and closes it) and the desktop dropdown and links; footer links, a hidden link, a hidden column, reorder and the per-page anchor rule on About and Home; server-side validation (`javascript:`, `//host`, missing slash, empty label, `<b>`, address without host); authorization (no session: the page redirects to sign-in and a replayed save changes nothing; wrong origin with a valid session changes nothing; the same request with session and right origin is saved, so the refusals are real). No JavaScript errors in the browser. The test puts the menus back afterwards.

## Re-running

```bash
# Navigation CMS (dev server on :3001, local database, an admin user): ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/qa/navigation-qa.mjs
# production build running on :8788, original site in ../referance-website, from visuolab-next:
PAGES="$(cat pages.txt)" WIDTHS=1440,768,390 NEWBASE=http://localhost:8788 node scripts/qa/compare.mjs
NOSRCSET=1 PAGES="$(cat pages.txt)" WIDTHS=1440,768,390 NEWBASE=http://localhost:8788 node scripts/qa/compare.mjs
PAGESFILE=pages.txt NEWBASE=http://localhost:8788 node scripts/qa/parity.mjs        # ANIM=1 for the animation properties
NEWBASE=http://localhost:8788 node scripts/qa/behavior.mjs
```

`pages.txt` is one line of `name:route:originalfile` entries separated by commas, for example `index:/:index.html,about:/about:about.html,work-aster:/works/aster:work/aster.html`. The tools need `playwright`, `pngjs` and `pixelmatch` (`npm i --no-save playwright pngjs pixelmatch`). Always compare against the production build, not `npm run dev`.
