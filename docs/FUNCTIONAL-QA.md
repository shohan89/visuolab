# Functional QA

End-to-end test of the whole application on 6 October 2026: the public site, the admin, the database, security and the Cloudflare runtime. One bug was found and fixed; everything else passed. No feature was added.

## Result

| Area | Checks | Result |
|---|---|---|
| Public site, admin, invalid input, unauthorized access, R2, environment (`scripts/qa/func-qa.mjs`, production build) | 35 | 35 pass |
| Admin CRUD and settings suites (dev server): admin 28, contact 30, media 68, settings 59, blog 82, services 56, case studies 63, SEO 41, dashboard 30 | 457 | all pass |
| Database (`npm run db:verify` / `db:verify:local`) | 227 / 171 | all pass |
| Security probe (production build) | 43 | all pass |
| Page cache (production build) | 14 | all pass |

## What was tested

**Public.** A crawl from the navigation, footers, cards and sitemap reaches all 23 pages (home, About, Works, Blog, Contact, 4 services, 8 case studies, 6 articles); every one answers 200 and no published service, case study or article is an orphan. The 164 pictures, video, fonts, stylesheets and scripts they use all load with the right type; every `#section` link points at an existing element; all `mailto:` and external links are well formed (https); old `.html` addresses redirect. In a real browser every header, mega-menu and footer link navigates to a page with a heading, the mobile menu opens, closes with Escape and each of its links works, the contact form refuses a bad email and stores a valid enquiry with every field, scroll reveals resolve on every page type, and Lenis, the hero scene and the load-in run on Home. No console error in any session.

**Admin.** Wrong and right login, 26 console screens, edit/confirm/detail screens of real records, logout (the old cookie stops working), and the full create/edit/publish/delete cycles of services, case studies, blog (with scheduling), media, submissions, settings and integrations in the suites above.

**Database.** Migrations apply in order on an empty database, the seed applies twice with the same result, constraints (unique slugs, status values, foreign keys, secret-free integration rows) are asserted (`db:verify`). With a table missing, public pages answer a generic 500 with no error text (see the bug below).

**Security.** 84 invalid, SQL, script, traversal and over-long ids on admin edit/confirm/detail screens and 65 hostile query strings on the list screens never give anything but 404 or a normal page; invalid and hostile public slugs give 404; the media API answers clean 4xx JSON for bad input. Three real admin server actions (status change, SEO save, delete) were captured and replayed without a session: nothing changed. Every console address and the media API refuse an unauthenticated visitor.

**Cloudflare.** The production build runs in the Workers runtime (`wrangler dev --config dist/server/wrangler.json`): `/api/health` reports D1 and R2 reachable; a picture uploaded in the admin is stored in R2 and D1, served with `nosniff` and immutable caching, and deleting it removes both; `SITE_URL`, `MEDIA_BASE_URL` and `IMAGE_TRANSFORMS` are read by the Worker and secrets are shown only as set / not set; the security headers and `no-store` are present on public pages.

## Bug found and fixed

| Where | Problem | Fix |
|---|---|---|
| `/sitemap.xml` (and, in principle, `/api/admin/media`, `/media/*`, `robots.txt`) | When the database (or R2) failed, a route handler's unexpected error was sent to the visitor as raw text: `Error: D1_ERROR: no such table: services: SQLITE_ERROR` plus a stack frame with a file path | `src/lib/server/safe.ts` wraps the API and media handlers: any unexpected error becomes `{"error":"server_error"}` (500, `no-store`) and only the error's class is logged. The sitemap falls back to the fixed pages and `robots.txt` to the default rules when the database cannot be read. Re-tested with `services` and `site_settings` renamed: sitemap and robots answer 200, pages answer a generic 500, no error text anywhere |

## Test-only corrections (not product bugs)

A blog-suite assertion occasionally read a stale toast (the test now waits for the dismissed one to leave); the cache test now bumps the content version instead of deleting it, so it works on a warm cache. The dev server sometimes exits on its own during long runs (a known development-server issue, not the production build); the suites were re-run until complete.

## Not covered

Live Cloudflare (no real account state was touched): real R2/Image Transformations on a media domain, Resend and Turnstile against their real services (tested against local fakes), and the real edge cache across data centres. The deployment checklist is in `DEPLOYMENT.md`.
