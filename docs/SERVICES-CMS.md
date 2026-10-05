# Services management

Admin: `/admin/services`. Public: `/services/<slug>`. Everything on a public service page now comes from D1; the page layout, markup and styles are the same components as before.

```
BEFORE   src/content/services.ts (typed seed data) ──▶ ServicePage
AFTER    D1 (services, service_case_studies, case_studies, media) ──▶ cms.getServiceBySlug() ──▶ the same ServicePage
```

The four pages were compared with the original static HTML at 1440, 900 and 390 px after the switch: **0 differing pixels** on all 12 captures. The typed file `src/content/services.ts` is no longer read by the service routes (it is still used to check the seed in `db:verify`, and the home page still has its own copy of the service cards).

## Public side

- `src/app/(site)/services/[slug]/page.tsx` reads at request time (`force-dynamic`: D1 cannot be read while the site is built).
- Only `status = 'published'` services are served; others return 404. A signed-in admin can open a draft or archived service at its normal address as a preview (visitors get 404).
- Case studies shown at the bottom are only the **published** ones, so a draft case study never appears as a broken link.
- An old address (after a slug change) answers `308` to the new one. Table `slug_redirects` (migration `0009`); chains are collapsed, and a redirect is removed if its target is deleted or its address is taken by a new service.
- `/services` still redirects to `/#services`.

## What an admin can do

| Feature | Where | Notes |
|---|---|---|
| List, search, filter by status | `/admin/services` | Search matches name, slug and SEO title (`%` and `_` are searched as text). Tabs: All / Published / Drafts / Archived with counts. |
| Create | `/admin/services/new` | Starts as a draft (or published, if chosen); the slug is suggested from the name. |
| Edit | `/admin/services/<id>/edit` | Basics (name, slug), SEO title and description with character counters, top of page (headline, intro, button text and link = CTA, featured and second image with descriptions), overview, outcomes, what is included, process, case studies (choose and order), call-to-action band (text, button, on/off), "What we fix" (on/off). Lists can be added to, removed from and reordered. |
| Publish / unpublish / archive | edit page, list page | Publish takes the last *saved* content and refuses an incomplete service (same checks as the form, at least one case study). |
| Reorder | list page (↑ ↓) | Positions are renumbered 0…n−1 and swapped. Hidden while a search or filter is active. The website's menus are not generated from this order yet. |
| Delete | edit page, list page | Always through a confirmation page (below). Case study links are removed with the service; the case studies stay. |

## Safe slugs

Lower-case letters, numbers and single hyphens, 2–60 characters, not a reserved word (`new`, `edit`, `admin`, `api`, `index`, `services`, …), unique. The name suggests a slug (`Test Service & Co` → `test-service-and-co`); typed slugs are normalised on the server too. Changing a slug is allowed and safe because the old address is kept as a redirect.

## Validation (server side, `src/lib/validation/service.ts`)

The browser only helps; the action re-checks everything with Zod and the database:

- Plain text fields cannot contain `<` or `>`. Rich fields (headlines, headings, big numbers) allow only balanced `<em>…</em>` and `<b>…</b>`.
- Links must start with `/`, `#`, `mailto:` or `https://` (`javascript:` and `http:` are refused).
- Length limits on every field; SEO title ≤ 70 (60 recommended), SEO description 20–200 (160 recommended); list sizes (overview 1–8, outcomes 1–8, included 1–12, process 1–10, case studies ≤ 6).
- Two different images that exist as images in the media table; every chosen case study exists; slug unique.
- The "What we fix" section and the call-to-action band may be left unfinished while switched off; switched on, they must be complete.
- Errors are shown at the top and under the fields, and everything typed stays in the form.
- The status of an existing service cannot be changed through the save form (only through Publish / Unpublish / Archive), so a stale or forged form cannot hide a live page.

## Protection against broken public routes

Hiding (unpublish, archive) or deleting a **published** service makes `/services/<slug>` return 404. Before that, `serviceReferences()` lists everything that links to the page:

- navigation items and site settings in D1 that contain the address,
- other service pages and blog posts that link to it,
- the header menu, footer and home page, which are still built into the website (so the four original services are always flagged).

The confirmation page (`/admin/services/<id>/confirm`) shows that list. When anything links to the page, **or** when a published page is deleted, the slug must be typed to continue. The server action checks this again, so removing the browser check does not bypass it (tested: wrong slug changes nothing). An unpublished service with no links can be deleted after a plain confirmation. Archiving is offered as the gentler alternative to deleting.

## Security and audit

Every page and action calls `requireAdmin()`; every action also checks the request origin (`AUTH.md`). Create, update (with the old and new slug), publish, unpublish, reorder and delete are written to `audit_logs` with the admin and a hashed IP.

## Tests

`svc-test.mjs` (56 checks, passing, against the real local D1): signed-out access to every services route; list, search, `% _ \`, filters, empty states; saving each seeded service without edits changes nothing stored and not the public page; validation refuses markup, reserved and duplicate slugs, bad links, unbalanced rich text, missing images, and keeps what was typed; create with the full form, links and image sizes; draft is 404 for visitors and previews for the admin; publish makes it live with the saved content and `<em>` rendered as markup; slug rename gives 308, no chains, no taking another service's slug; reorder swaps and keeps positions 0…n−1; unpublish and delete confirmation (listing, wrong slug refused by the server, typed slug deletes, redirects cleaned, case studies kept); an unfinished service cannot be published; audit entries; no horizontal scroll at 390 px; no console errors. The earlier dashboard (30) and admin (28) tests pass with the new sidebar entry.

## Not in this phase

Icon choice for "What is included" items (existing icons are kept; new items get a plain circle), image upload (the media picker lists the media table), generating the header menu, footer and home page from D1, and a drag-and-drop reorder.
