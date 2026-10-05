# Case studies management

Admin: `/admin/case-studies`. Public: `/works` (the grid) and `/works/<slug>` (the pages). Everything on them now comes from D1; the page components, markup and styles are unchanged.

```
BEFORE   src/content/cases.ts (typed seed data) ──▶ WorksPage / CaseStudyPage
AFTER    D1 (case_studies, case_study_images, media, service_case_studies)
           ──▶ cms.getCaseStudies() / getCaseStudyBySlug()
           ──▶ content mapping layer (mapCaseStudy)
           ──▶ the same WorksPage / CaseStudyPage
```

All 8 case studies were already in D1 as seed content (`db/seed/content.sql`, generated from the original site and the typed data, with the original image order, captions and crops). After switching the routes, `/works` and the 8 pages were compared with the original static HTML at 1440 and 390 px: **0 differing pixels** (two captures showed 0.01% noise in one batch and 0 on a rerun, a rendering-timing flake, not a data difference). The typed file `src/content/cases.ts` is no longer read by any route; it stays as the reference for `db:verify`.

## The content mapping layer

`src/lib/content/case-study-mapper.ts` is the only place that knows how a database record becomes page content and back. Pure functions, no database or framework imports, so the Worker, the admin and the verification script share them.

| Function | Direction | Used by |
|---|---|---|
| `mapCaseStudy(row, images, media, others)` | rows → `CaseStudy` (the type the page components take) | `/works/[slug]`, `/works` |
| `mapCaseCard(slug, image, alt, showcaseJson, media)` | rows → `CaseCardSeed` (the small card) | service pages, home data |
| `rowToInput(row, images, serviceIds)` | rows → `CaseStudyInput` (the admin form model) | edit form |
| `inputToColumns(input)` / `inputToImages(input)` | form model → JSON columns and image rows | create and save |

The JSON documents are typed there (`Fact`, `Stat`, `ProcessDoc`, `ChallengesDoc`, `ResultsDoc`, `MoreDoc`, `ShowcaseDoc`). A "More work" slug that points at a case study that is deleted or not published is left out, so a page never breaks. `db:verify` runs the mapper against the typed content and requires field-for-field equality; saving every seeded case study without edits changes nothing stored (tested).

## Where each requested field lives

| Requested | Form field | Stored in |
|---|---|---|
| Slug | Slug | `case_studies.slug` (unique; rename keeps the old address as a redirect) |
| Client name | Client name (card, breadcrumb) and Client (full name) | `client_name`; fact "Client" in `facts_json` |
| Industry, Services, Timeline | Project details | facts "Industry", "Services", "Timeline" in `facts_json` |
| Year | Year (4 digits) | `year`; fact "Year" |
| Description | Description + small label + key numbers | `about_lead`, `about_label`, `stats_json` |
| Challenge | Challenge (heading + items) | `challenges_json` |
| Approach | Approach (steps with duration and deliverables) | `process_json` |
| Results | Results (items; "headline number" style) | `results_json` |
| Gallery | Two galleries (1–6 images each) and a wide image | `case_study_images` rows, role `gallery_a` / `gallery_b` / `wide`, with position, caption, description and crop |
| Hero image | Hero image + description | `cover_image_id`, `cover_image_alt` |
| Card image, tags, filters | Card on the Works page | `card_image_id`, `card_tags_json`, `filters_json` (brand, product, web, packaging, motion) |
| Featured status | Featured checkbox / ★ in the list | `featured` (migration `0010`) |
| SEO metadata | SEO title and description | `meta_title`, `meta_description` |
| Services | "Shown on service pages" checkboxes | `service_case_studies` (existing order kept; new links go last) |
| Home / service card | Card on service pages and the home page | `showcase_json` (results or a client quote) |
| Related projects | More work (1–4) | `more_json` |

Multiple images: every gallery takes up to six pictures from the media library, each with its own caption, description and optional crop position. The public page shows exactly what is listed (a third image added in the test appeared on the page).

**Featured** is stored and editable (star in the list, checkbox in the form, "Featured" tab). It marks the four cases the home page shows today (set by the seed). The home page markup is still built into the website, so changing the flag does not change the home page yet.

## Admin features

- **List:** search (client, headline, slug, type, industry facts; `% _` are plain text), status tabs with counts (All, Published, Drafts, Archived, Featured), discipline filter, thumbnail, filters, image count, updated date.
- **Create / edit:** one form with all sections above. Lists (tags, numbers, gallery images, steps, challenges, results, more work, card results) can be added to, removed from and reordered; deliverables are one line each as `title | detail`.
- **Publish / unpublish / archive:** publishing checks the saved content with the same rules as the form. Hidden = 404 for visitors; a signed-in admin can preview a draft at its normal address.
- **Reorder:** ↑ ↓ (hidden while a search or filter is active); the order is the order of the cards on `/works`.
- **Delete:** always through a confirmation page.

## Safe slugs and redirects

Lower-case letters, numbers, single hyphens, 2–60 characters, not reserved, unique. The client name suggests the slug. Renaming keeps the old address as a 308 redirect (`slug_redirects`, kind `case_study`, no chains), and rewrites the "More work" lists of the other case studies that named the old slug. Deleting removes the slug from those lists and drops redirects that pointed to it.

## Validation (server side, `src/lib/validation/case-study.ts`)

Plain text cannot contain `<` or `>`; rich text allows only balanced `<em>` / `<b>`; year is 4 digits; crop positions look like `20% 30%`; length limits everywhere; at least one tag, filter, number, image in each gallery, step, challenge, result and More work entry; a case study cannot list itself; chosen images, case studies and services must exist. The status of an existing case study cannot be changed by the save form. Errors show at the top and under the fields, and everything typed is kept.

## Protection against broken public routes

Hiding or deleting a **published** case study makes `/works/<slug>` return 404 and removes its card from `/works`. The confirmation page lists everything that links to it: navigation and site settings, service pages that show it, other case studies' "More work", blog posts, and the built-in home and About pages (always the case for the 8 originals). When anything links to it, or a published case study is deleted, the slug must be typed; the server action checks this again (tested: a wrong slug changes nothing).

## Security and audit

Every page and action calls `requireAdmin()` and checks the request origin (`AUTH.md`). Create, update (with old and new slug), publish, unpublish, featured, reorder and delete go to `audit_logs`.

## Tests

`case-test.mjs`, 63 checks against the real local D1: signed-out access; list, search (including the industry fact), discipline filter, featured tab; saving each of the 8 case studies unchanged keeps every stored value and the public page; validation refusals with values kept; creating a case study with 2 + 1 + wide images, deliverables, facts, service link and card; draft 404 and admin preview; publish: public page, Works page (9 cards, filters), service page card, More work; featured toggle; reorder; slug rename (308, More work follows, duplicate refused); unpublish and delete confirmation with the server refusing a wrong slug; cascade deletes (images, links) with media kept; seeded cases flagged; a third gallery image on a seeded case; audit entries; no horizontal scroll at 390 px; no console errors. The service (56), dashboard (30) and admin (28) suites pass as before; `db:verify` 105/105 and 65/65 on the local D1.

## Not in this phase

Image upload (the picker lists the media table), drag-and-drop ordering, generating the home page cards from the featured flag, and a blog-style revision history.
