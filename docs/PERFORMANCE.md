# Performance

What was optimized, why, how it was measured, and how to keep it that way. The design is unchanged: same pages, same animations, same pictures. Three things differ in a way a pixel comparison can see and an eye cannot, and are listed under [Visual check](#visual-check).

## Results

Lab measurements of the production build (`scripts/perf/measure.mjs`), median of three runs per page, before (`scripts/perf/baseline-before.json`) → after (`scripts/perf/after.json`). Each cell reads *before → **after***.

**Mobile (390 px wide, 4x slower CPU, 1.6 Mbit/s, 150 ms round trip)**

| Page | TTFB ms | LCP s | CLS | INP ms | FCP s |
|---|---|---|---|---|---|
| Home | 153 → **21** | 5.56 → **2.19** | 0 → **0.001** | 40 → **32** | 1.27 → 1.50 |
| About | 105 → **26** | 3.20 → **1.22** | 0 → **0.001** | 56 → **48** | 1.04 → 1.22 |
| Works | 148 → **21** | 4.42 → **1.56** | 0 → **0.002** | 56 → **40** | 1.01 → 1.22 |
| Case study | 126 → **20** | 3.32 → **1.21** | 0 → **0** | 48 → **32** | 1.08 → 1.21 |
| Service | 139 → **20** | 4.10 → **1.51** | 0 → **0** | 56 → **40** | 1.20 → 1.51 |
| Blog | 118 → **25** | 2.32 → **1.36** | 0.019 → **0.002** | 32 → **32** | 1.08 → 1.36 |
| Article | 141 → **22** | 3.27 → **1.40** | 0 → **0** | 24 → **16** | 1.05 → 1.40 |
| Contact | 95 → **21** | 3.08 → **1.37** | 0 → **0.006** | 32 → **24** | 1.04 → 1.37 |

**Desktop (1440 px wide, 10 Mbit/s, 40 ms round trip)**

| Page | TTFB ms | LCP s | CLS | INP ms | FCP s |
|---|---|---|---|---|---|
| Home | 119 → **17** | 0.91 → **0.66** | 0 → **0** | 64 → **64** | 0.77 → 0.64 |
| About | 83 → **11** | 0.87 → **0.46** | 0 → **0.001** | 128 → **104** | 0.56 → 0.46 |
| Works | 131 → **11** | 1.32 → **0.40** | 0.064 → **0.057** | 80 → **64** | 0.58 → 0.40 |
| Case study | 136 → **11** | 0.84 → **0.57** | 0 → **0.015** | 72 → **64** | 0.61 → 0.43 |
| Service | 143 → **11** | 0.94 → **0.61** | 0.028 → **0** | 136 → **104** | 0.64 → 0.45 |
| Blog | 123 → **10** | 0.91 → **0.44** | 0.026 → **0** | 64 → **56** | 0.57 → 0.44 |
| Article | 150 → **11** | 0.76 → **0.46** | 0.055 → **0.016** | 24 → **16** | 0.55 → 0.38 |
| Contact | 87 → **10** | 0.80 → **0.62** | 0.012 → **0** | 56 → **56** | 0.52 → 0.45 |

**Payload** (mobile profile; desktop loads the larger picture sizes)

| Page | Pictures, page scrolled to the end KB | Pictures at first load KB | Showreel video at first load KB | JavaScript KB (brotli) | CSS KB (brotli) | Third-party KB |
|---|---|---|---|---|---|---|
| Home | 1096.2 → **225.8** | 95.8 | 1624.1 → **0.0** (1624.2 fetched when the panel is reached) | 144.2 → 145.6 | 31.8 → 31.5 | 88.1 → **0.0** |
| About | 441.3 → **127.3** | 69.6 | – | 238.4 → 240.2 | 31.8 → 31.5 | 67.4 → **0.0** |
| Works | 896.0 → **262.7** | 127.3 | – | 142.0 → 143.3 | 31.8 → 31.5 | 88.1 → **0.0** |
| Case study | 111.5 → **30.4** | 30.4 | – | 141.2 → 142.5 | 31.8 → 31.5 | 67.4 → **0.0** |
| Service | 222.6 → **55.0** | 55.0 | – | 141.9 → 143.1 | 31.8 → 31.5 | 88.1 → **0.0** |
| Blog | 697.8 → **214.7** | 62.9 | – | 141.8 → 143.1 | 31.8 → 31.5 | 67.4 → **0.0** |
| Article | 586.4 → **177.9** | 25.1 | – | 141.8 → 143.1 | 31.8 → 31.5 | 67.4 → **0.0** |
| Contact | 20.0 → **10.4** | 10.4 | – | 163.2 → 143.9 | 31.8 → 31.5 | 67.4 → **0.0** |

**How to read these numbers**

- **TTFB** is measured against a local database with no network between the Worker and D1, so the *before* is the best case. On Cloudflare each D1 query is a network round trip and a page makes several, so the saving from the page cache is larger there. The cache is a Worker-side cache hit (`X-Edge-Cache: HIT`); the first visit to a page after a change (or every five minutes) still pays the old cost.
- **LCP** is the headline gain. Before, the largest paint waited for pictures of 100–500 KB and, on text pages, for the scripts to download and hydrate before the heading was allowed to fade in. On the home page it is the hero headline.
- **FCP** (first paint of any content) is 0.15–0.35 s *later* on the slow-phone profile on every page (it is 0.1–0.2 s earlier on desktop). That is the price of preloading the two fonts the first screen needs: they share a 1.6 Mbit/s line with the stylesheet. Without the preloads first paint is about 0.15 s earlier, but headlines then swap fonts late: layout shift of 0.18 on the Blog page and a later largest paint. Both are measured (see [Fonts](#fonts)); the preloads are the better trade.
- **CLS** was already near zero; it stays under 0.02 on every page except Works on desktop (0.057, unchanged from before, below the 0.1 "good" limit).
- **INP** is the slowest interaction in a scripted tour (open the menu, press a button, open an accordion): all well under 200 ms. It did not need work.
- **JavaScript** is the React/vinext runtime (about 143 KB brotli) and did not shrink on most pages: it is the framework, not our code. Our own code is 5–10% of it. The Contact page lost 19 KB (validation library loaded on demand) and the About page defers its 3D library (below).
- **Total blocking time** is not in the tables because two pages are not comparable in a lab: Home and About draw WebGL, and headless Chrome draws WebGL in *software*, so their main thread is blocked by the "GPU" (the Commit step) in a way a real phone is not. The JavaScript side of those scenes was made cheaper (see [Animations](#animations-optimized-not-removed)). All other pages block the main thread for under 0.35 s on the throttled phone, before and after.
- The lab runs everything from one machine, so absolute numbers are lower than field data; use them to compare before and after, and use [Cloudflare Web Analytics or real-user monitoring](#after-you-deploy) for the real distribution.

## What was done

### 1. Caching on Cloudflare

**Static files** (`public/_headers`, served by Cloudflare's asset layer):

| Path | Cache-Control | Why |
|---|---|---|
| `/_next/static/*` | `public, max-age=31536000, immutable` | build output with a hash in every name |
| `/fonts/*` | `public, max-age=31536000, immutable` | file names carry a content hash |
| `/assets/*` | `public, max-age=604800, stale-while-revalidate=86400` | pictures and the showreel keep their names when replaced, so a week, refreshed in the background |

Before, `/assets/*` was `max-age=0, must-revalidate`: every picture was a conditional request on every visit.

**Public pages** (`src/worker.ts`, the Worker's entry point; vinext's handler is unchanged behind it). Pages are read from D1 on every visit; that was the slowest part of a request. The finished HTML of the public pages, the sitemap and `robots.txt` is now kept in Cloudflare's cache for the data centre that served it, and repeat visits are answered from there without touching D1 or rendering.

- **Always correct after a change.** The cache key contains a *content version*, a counter in D1 (`app_meta.content_version`) that every admin action bumps (`src/lib/server/audit.ts`; sign-ins, test sends and inbox actions do not). Saving anything in the admin changes the key, so the next visit renders fresh. The Worker remembers the counter for 5 seconds, so a change is live everywhere within about 5 seconds.
- **Scheduled articles.** Nobody saves anything when a scheduled article reaches its publish time, so entries also expire after 5 minutes: a scheduled article appears within 5 minutes of its time.
- **Drafts cannot leak.** A visitor with an admin session cookie is never served from the cache and never fills it. Only 200 answers without a cookie are stored; 404s are not.
- **Only plain page loads are cached:** `GET`, no query string, none of the headers a client-side navigation, prefetch, server action or range request sends. Admin, API, media and assets bypass it.
- **The browser is unaffected.** It receives the same headers as an uncached page (`no-store`); the cached copy is stored with its own short lifetime and the original header is restored on the way out. The answer carries `X-Edge-Cache: HIT | MISS | BYPASS` for debugging (absent when the request was never eligible).
- **Switch.** `EDGE_CACHE` in `wrangler.jsonc` (`"1"` = on, the production default). Local development and the test suites set `EDGE_CACHE=0` in `.dev.vars` so changes show at once.
- **Tested** by `scripts/perf/cache-test.mjs` against the production build (14 checks): miss then hit, byte-identical bodies, same browser headers, every excluded request type, 404s, an admin change appearing within the memo window, and a draft never reaching the cache.

Not used: the framework's ISR with KV or Workers Cache adapters, which need a KV namespace and Worker configuration that must be created in the Cloudflare account and cannot be verified from here. The content-version cache needs no new resource.

**Edge settings worth checking** (dashboard, nothing to code): Brotli and HTTP/3 on (they are by default), Early Hints on (the Worker already sends `Link: rel=preload` for fonts and the first-screen pictures), Tiered Cache on, and for the Worker a Smart Placement hint if the database is far from most visitors.

### 2. Images

The site's pictures were 1280–1920 px wide and shown at 52–1296 CSS px; every visitor downloaded the full file.

- `scripts/perf/make-image-variants.mjs` makes smaller copies of every picture in `public/assets` (128, 320, 480, 640, 800, 1024, 1280 px wide, never up-scaled, WebP quality 80, `effort 5`) and writes `src/lib/image-variants.generated.ts`. 124 files, 2.5 MB, in the same folders. The originals are untouched and remain each image's `src`.
- `src/components/site/ui/Img.tsx` replaces the plain `<img>` on all public pictures (the two logos stay as they were). It adds `srcset` and `sizes` from the manifest; `sizes` is set where the displayed width was measured (cards 420–760 px, covers 1300 px, avatars 52 px, the globe 121–262 px, the hands 302–655 px). The browser picks by width and screen density.
- Pictures uploaded in the admin (`/media/…`) get the same through Cloudflare Image Transformations once `IMAGE_TRANSFORMS=1` (see `MEDIA.md`); otherwise they are used as they are.
- **Loading.** Avatars and cards below the first screen are `loading="lazy"` with `decoding="async"` (the avatars used to load eagerly: 10 pictures at the top of the Home page's payload). The first card of Works, the featured article, an article's cover and a case study's cover are `fetchpriority="high"` (they are the largest paint). The first row of the Works grid is eager.
- Preloads follow the chosen size: the pictures preloaded for the first screen use `imagesrcset`, so the browser no longer fetches the 476 KB original behind the page's back.

Effect: the pictures a phone downloads for a whole scrolled page fell by 70–80% (Home 1.1 MB → 0.23 MB, Works 0.9 → 0.26, Blog 0.7 → 0.21); at first load a phone fetches 10–127 KB of pictures, depending on the page.

### 3. Video

`showreel.mp4` (1.6 MB, already fast-start) was `autoplay preload="metadata"`: the browser started fetching it with the page. It is now `preload="none"` with its poster; it starts to download when the panel is within 800 px of the screen and plays when 20% of it is visible, as before (`src/components/motion/Reel.tsx`). First load no longer carries the 1.6 MB. Not done: re-encoding (no encoder is available in this environment); a 720p/H.264 or AV1 copy would be the next saving.

### 4. Fonts

The three fonts (DM Sans, Instrument Serif, Inter Tight) came from Google Fonts: two extra connections (DNS, TLS) and a render-blocking stylesheet request to a third party before any text could be styled.

- `scripts/perf/fetch-fonts.mjs` downloads exactly what Google served (same files, same unicode-range subsets, `font-display: swap`) into `public/fonts/` with content-hashed names (13 files, 7–90 KB each; a page downloads the 4 Latin files, 125 KB) and writes the rules to `src/styles/fonts.css`. The layout inlines that CSS (12 KB, about 2.6 KB compressed) so the first paint does not wait for a stylesheet request.
- The two faces every first screen needs (DM Sans and the Instrument Serif italic of the headlines) are preloaded. Measured on the slow-phone profile (median of five), Blog page: without the italic preloaded the headlines swap late and shift the page (**CLS 0.182**); with DM Sans and the italic preloaded **0.002** with the same first paint; preloading all four changed nothing further. Without any preload the first paint is about 0.15 s earlier, but the largest paint 0.5 s later.
- Third-party bytes on every page: 67–124 KB from Google → **0**.

### 5. JavaScript

- **Contact form:** the validation library (zod, 83 KB raw) loaded for every visitor of `/contact` although it is only needed when the form is sent. It is now loaded when the visitor first touches the form (and, if not, at submit); the server checks the same rules anyway. Contact page JavaScript 163 → 144 KB.
- **About page 3D scene** (Three.js, 485 KB raw, about 120 KB brotli): already loaded on demand, but at once. It now starts after the page has loaded and the browser is idle (reduced-motion visitors still get their single frame), so text, pictures and scroll are ready first.
- **Analytics** (Google Analytics, Tag Manager, Meta Pixel) now load with `lazyOnload` (after the `load` event and an idle moment) instead of `afterInteractive`. They are only loaded when switched on in **Integrations** and on a real https address, so no local number includes them; the saving is that they no longer compete with the page's own scripts and pictures. A visitor who leaves in the first second may not be counted.
- **Server Components.** Every page and section was already a Server Component; client components exist only where the motion needs them (scroll, filters, the form). The new image helper is a Server Component, so it adds nothing to the page's JavaScript (the Works grid, a client component, loads an 8 KB chunk, about 2 KB compressed, for the same helper). Static rendering at build time is not possible for pages that read D1, which is not reachable while the site is built; the page cache above replaces it.

### 6. CSS

- The six original stylesheets must keep their order and subsets (they override each other). Before, every page downloaded all six (`media="not all"` for the ones it did not use). Now the first request carries only the sheets the page uses (Home: 3 of 6, 19 KB instead of 38 KB gzip) and the rest are added once the page is idle, or as soon as the visitor reaches for a link, in their original positions, still switched off. Moving between pages stays instant and verified identical (`scripts/perf/check-perf.mjs`: the sheets are switched on exactly as after a direct load, in the same order, and no console error or hydration warning appears on any page).
- Not minified: the build's CSS minifier rewrites `backdrop-filter` pairs and removes the blur on the About captions and menus (see the note in `vite.config.ts`). Compression already takes the 138 KB of CSS to 32 KB.

### 7. Animations: optimized, not removed

Every animation is still there. Their implementations were made cheaper:

- **Hero scroll sequence** (`src/lib/motion/hero.ts`): seven custom properties were rewritten on every frame, and because custom properties are inherited, each write made the browser recompute the style of the whole hero. A value that has not moved (scrolling stopped, pointer still, pulse finished) is no longer rewritten, and a change below a thousandth of the range (a few hundredths of a pixel for the idle drift) waits for the next frame that moves further. Measured on an idle Home page with the slow-phone CPU: style recalculation per frame 10.4 ms → 4.7 ms. (The lab frame rate also rose from 19 to 60 fps, because the half-resolution gradient below stops software WebGL from being the bottleneck, so the total time recalculating styles in a 3-second window is not comparable.) The motion is the same.
- **Hero mesh gradient** (`src/lib/motion/mesh.ts`): a full-screen shader (five noise layers three times over for every pixel, every frame) rendered at 1–1.5× the screen's resolution. It is a soft, slow, low-contrast gradient with no detail finer than a few dozen pixels, so it is computed at half the CSS resolution and stretched by the browser: a quarter (at 1×) to a ninth (at 1.5×) of the pixels. The canvas keeps its CSS size.
- **About 3D band** (`src/lib/motion/scene.ts`): the twisted surface (12,000 vertices) was recomputed 60 times a second with six trigonometric calls per vertex. The twist enters only through `cos`/`sin` of (1.5·θ + phase), which split into per-ring constants (computed once) and the phase's cos/sin (once per frame): a few multiplications per vertex. Positions agree with the original formula to 1e-14, and the per-frame cost of that step is 2.3× lower.
- **Scroll reveals and the hero load-in start when the HTML has been parsed**, as in the original static site, instead of after the scripts have downloaded and hydrated (`EARLY_REVEAL` in the layout, production only). The same classes the observer would add a moment later are added to what is already on the first screen; everything else is still revealed by the observer as you scroll. This is the main reason text pages' largest paint fell from 3–4 s to about 1.2–1.5 s on the slow phone, and the Home headline from 4.3 s to 2.2 s.

### 8. Third-party scripts

Fonts no longer come from Google (above). Analytics, Tag Manager and the Pixel are optional, loaded after the page, and loaded only on a real https address. There are no other third-party requests. Cloudflare Turnstile loads only when it is switched on and configured.

## Visual check

The pixel comparison against the reference site (`compare.mjs`, Home and About at 1440, 900 and 390 px) was 0 pixels different before this work. It is now:

| Page | Width | Pixels different (threshold 0.1) |
|---|---|---|
| Home | 1440 / 900 / 390 | 0.142% / 0.046% / 0.039% |
| About | 1440 / 900 / 390 | 0.000% / 0.020% / 0.022% |

Page heights are identical at every width, and the differences are all inside pictures: the browser now scales a pre-made 640–1280 px copy of a card or cover instead of scaling the 1600–1920 px original, and the two resamplings differ in the last digits. Where a pixel differs at all, it differs by 1.5% of the colour range on average (3.9 of 255), at most 122 in an edge pixel. Nothing moved, no colour or size changed. The mesh gradient at half resolution and the hero's skipped sub-visible writes are inside that figure and well below what the eye can see. If a single picture must be byte-for-byte as before, remove its entry from `image-variants.generated.ts` (the page then uses the original).

## Operating notes

- **Adding or replacing a picture in `public/assets`:** run `node scripts/perf/make-image-variants.mjs` and commit the new copies and the manifest. A picture without variants works, just without savings. If a picture's displayed width differs from the default `sizes` (`(max-width: 900px) 100vw, 760px`, avatars 52 px), pass `sizes` to `Img`.
- **Changing fonts:** edit the family list in `scripts/perf/fetch-fonts.mjs` and run it; it rewrites `public/fonts`, `src/styles/fonts.css` and the preload list.
- **Seeing the page cache work:** `curl -I https://your-site/about` twice: `X-Edge-Cache: MISS`, then `HIT`. After saving something in the admin, wait about 5 seconds, then the next request is a `MISS` with the new content.
- **If a change does not show:** you are not signed in as the admin on that browser (admins bypass the cache), or fewer than 5 seconds have passed, or the change was a scheduled publish (up to 5 minutes). `EDGE_CACHE=0` turns the cache off.
- **Local runs:** `.dev.vars` carries `EDGE_CACHE=0`; keep it out of production (`.dev.vars` is not deployed).
- **Measuring again:** see the header of `scripts/perf/measure.mjs`. Always measure the production build (`wrangler dev --config dist/server/wrangler.json`), never `npm run dev`.

## After you deploy

1. Set the real `SITE_URL`, then compare a few pages with PageSpeed Insights and the Chrome DevTools Lighthouse panel on a throttled phone profile; expect numbers in the same direction as the tables.
2. Turn on **Web Analytics** (Cloudflare dashboard → Web Analytics) for real-user LCP, CLS and INP by page; it needs no script change when the site is proxied through Cloudflare.
3. In **Integrations → Media** terms: set `MEDIA_BASE_URL` to a custom domain for the R2 bucket and `IMAGE_TRANSFORMS=1` (Image Transformations enabled on the zone) so uploaded pictures also get responsive sizes and modern formats.
4. Check `X-Edge-Cache` on the live site as above.

## Not done, and why

- **Re-encoding the showreel** (no video encoder in this environment) and **AVIF** variants of the pictures (the stock WebP is already 70–90% smaller than before; AVIF would save roughly a further 20–30%).
- **Minifying CSS** (see above) and **removing unused CSS** (the sheets override each other by cascade order, so rule-level removal is not safe without a visual test of every page).
- **Shrinking the framework runtime** (React, the vinext client): it is the floor under every page's JavaScript.
- **Reducing the font files** (variable DM Sans carries an optical-size axis that the browser uses automatically; dropping it would change letter shapes).
- **Static pre-rendering** of public pages: not possible while content lives in D1 and D1 is not reachable at build time. The content-version page cache gives the same effect without a rebuild.

## Files

`public/_headers`, `public/fonts/`, `src/styles/fonts.css`, `src/lib/fonts.generated.ts`, `src/lib/image-variants.generated.ts`, `src/lib/images.ts`, `src/components/site/ui/Img.tsx`, `src/worker.ts` (wrangler `main`), `src/lib/server/audit.ts` (content version), `src/app/(site)/layout.tsx`, `src/components/site/StyleGate.tsx`, `src/components/site/Analytics.tsx`, `src/components/site/contact/ContactForm.tsx`, `src/components/motion/{Reel,AboutScene}.tsx`, `src/lib/motion/{hero,mesh,scene}.ts`, and the pages' image tags. Scripts: `scripts/perf/{measure,fetch-fonts,make-image-variants}.mjs` (build and measure) and `scripts/perf/{cache-test,check-perf}.mjs` (checks against a running production build; they need playwright, see their headers).
