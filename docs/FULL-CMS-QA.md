# Full CMS audit

An audit of the whole content management system: can an administrator edit every intended content field of every public page, does the public page follow, and did the design stay as it was.

**Result: every CMS-managed page and record was tested, end to end, through the admin. No open defects.** Two gaps were found during the audit and fixed (section 5). The remaining text that is not editable is interface wording that belongs to the design (section 6).

Everything below was run on a local copy of the site (its own D1 database and R2 bucket), against a production build served by `wrangler dev` with the edge page cache switched on, so that the Worker's cache and revalidation were part of the test. The live site was not touched.

## 1. What was tested

| Area | Where it is edited | Sections / records tested | Text fields edited | Pictures replaced |
|---|---|---|---|---|
| Home | Pages → Home | 9 sections | 128 | 2 |
| About | Pages → About | 9 sections | 87 | 0 (no picture fields) |
| Services listing | `/services` redirects to the Services section of Home (Pages → Home → Services); there is no separate listing page | included in Home | included in Home | included in Home |
| Individual services | Services → each service | 4 services × 9 sections = 36 | 308 | 8 |
| Works listing | Pages → Works | 3 sections | 12 | 0 |
| Case studies | Case studies → each | 8 case studies × 14 sections = 112 | 729 | 57 |
| Blog listing | Pages → Blog | 3 sections | 6 | 0 |
| Articles | Blog → each | 6 articles × 8 sections = 48 | 122 | 18 |
| Contact | Pages → Contact | 2 sections (hero and information, form) | 38 | 1 |
| Shared copy | Pages → Shared across pages | 6 sections (closing call to action, reviews, trusted-by names, rating line, header menu labels, footer extras) | 81 | 12 |
| Page labels | Pages → service, case study and article page copy | 4 sections | 11 | 0 |
| Contact information, site name, social profiles | Settings → General, Contact, Social | 3 forms | 9 | 0 |
| Navigation | Navigation (header and footer) | the menus | see section 4 | see section 4 |
| Search settings | Pages → each page → Edit SEO; SEO section of each service, case study and article | 5 pages, 18 records | all | — |

In total: **232 sections, 1,522 text fields and 98 pictures** were changed through the admin and checked on the public pages. Fifteen sections consist only of choices (the About projects strip, which services show a case study, which articles are recommended); every choice in them was changed too.

## 2. Method

For every section (pages and records), `scripts/qa/full-cms-qa.mjs` drives the real admin in a browser:

1. open the section editor;
2. type a value over the field's limit and check it is refused and nothing is stored (validation);
3. type a unique marker into every text field and choose a different library picture for every picture field;
4. save (a draft) and check the draft is stored while the published content is untouched;
5. publish, **refresh the admin** and check every value was saved;
6. open the public pages **without a session** and check every marker is drawn and every chosen picture is used;
7. check the audit log has the entries;
8. after all sections of a page were changed, check the page's markup (tags and classes) is the same as before (the design did not change).

Separate steps check the search metadata of every page, the mobile, tablet and desktop renderings, authorization, the cache, the navigation, settings and the admin's wording. Everything is restored afterwards.

## 3. The 15 verifications

| # | Verification | How | Result |
|---|---|---|---|
| 1 | Edit content | Every text field of every section, by typing into the admin editor | Pass |
| 2 | Save | Save draft, then Publish, for every section; the choice-only sections too | Pass (232 sections) |
| 3 | Refresh admin | Reload the editor after publishing | Pass: every value read back |
| 4 | Verify saved content | Compared field by field with what was typed | Pass |
| 5 | Open public page | Pages fetched without a session | Pass |
| 6 | Public content changed | Every marker looked for in the HTML; every chosen picture looked for in `src`, `srcset` and `poster` | Pass: all 1,522 values drawn (see 5 for the two gaps found and fixed) |
| 7 | Design did not change | Tag-and-class skeleton of each page compared before and after every section was edited; plus the pixel and markup parity diff (`page-parity.mjs`) against the original: 23 of 23 pages identical | Pass |
| 8 | Image replacement | A different library picture chosen for every picture field (98 pictures) and found on the public pages; replacing the file of a library entry (same id, every page follows) is covered by `pages-admin-qa.mjs` | Pass |
| 9 | SEO metadata | For the 5 pages: title, description, canonical, Open Graph title and robots (index, noindex, nofollow) saved, read back, and found in the page head; for 4 services, 8 case studies and 6 articles through their SEO section | Pass |
| 10 | Mobile rendering | 390 px: 8 public pages (all five pages, a service, a case study, an article), no sideways scrolling, a heading, no broken pictures, no script errors; the mobile menu opens | Pass |
| 11 | Desktop rendering | The same at 1440 px, and at 768 px | Pass (24 page and viewport combinations) |
| 12 | Cache and revalidation | `scripts/qa/cache-qa.mjs` (below) | Pass |
| 13 | Authorization | 21 admin screens redirect to sign-in without a session; the media API refuses; a preview needs an admin session; a save replayed without a session, or from another origin, stores nothing; the same request with session and origin does | Pass |
| 14 | Validation | An over-limit value in every section is refused with a message and stores nothing; SEO title over 70 characters, a canonical that is not https, an invalid e-mail, a `javascript:` link in the social profiles, a site name over its limit | Pass |
| 15 | Audit log | At least two entries (draft and publish) for every section of the pages with their own address and the records, one for shared copy, one for every settings form | Pass |

**Cache and revalidation** (`cache-qa.mjs`, edge cache on): a public page is a `MISS` then a `HIT` for visitors; a request with a query string (a preview) never uses or fills the cache; a signed-in admin is never served from the cache; saving a **draft** does not change the page and does not drop the cache; **publishing** reaches visitors in 5.3 seconds (the Worker keeps the content version for up to 5 seconds) without anyone clearing the cache, and the fresh page is cached again.

## 4. Navigation CMS

`scripts/qa/navigation-qa.mjs`: 45 checks, all passing. They cover adding, editing, deleting, reordering (arrows and drag and drop), hiding, cancelling, internal and external links (new tab, `rel`), the contact button, the dropdown cards, promo and columns, the mobile menu at 390 px, footer links and columns, validation (`javascript:`, `//host`, missing slash, empty label, markup, address without host), authorization, and that the public header and footer follow.

Two notes:

- The test reads the public page immediately after a save, so it is run against a Worker with the edge cache off (`--var EDGE_CACHE:0`). With the cache on, five of its checks fail only because the page is up to 5 seconds old; the same changes appear after the cache check in section 3.
- The header's Services button label and the dropdown heading ("Core departments") were hard-coded. They are now editable (section 5).

**The word "Soon" does not exist in the admin.** The sidebar, the navigation screen and 147 admin screens (the dashboard, lists, every page and section editor, every record and its editors, settings, integrations, media, recent changes) were crawled with a signed-in browser: no "Soon", "coming soon", "not implemented", "TODO" or lorem ipsum text, and every sidebar item (Dashboard, Submissions, Services, Case studies, Blog, Media, Pages, Recent changes, Navigation, Integrations, Settings) is a real link.

### Repository search

| Search | Hits in code and scripts | What they are | Action |
|---|---|---|---|
| `Soon` | 17 | The phrases "as soon as" ("changes go live as soon as you save") and "sooner" in comments and hints. No label or badge. | None needed |
| `coming soon` | 0 | — | — |
| `TODO` | 1 | A generated Cloudflare type definition (`worker-configuration.d.ts`, third-party) | None |
| `not implemented` | 0 | — | — |
| `Navigation` | 205 | The Navigation CMS itself: its editor, tables, validation, actions, tests and documentation | None (legitimate) |
| `Soon` in documentation | 3 | `DESIGN-QA.md` (the badge was removed, kept as history) and `ADMIN-DASHBOARD.md` | `ADMIN-DASHBOARD.md` said the content sections were "listed as disabled Soon until their editors exist": that is no longer true and was corrected |

No placeholder corresponding to unfinished functionality was left in the source; the only removals were that outdated sentence and the two hard-coded header words (made editable, section 5).

## 5. Findings and fixes

| # | Finding | Fix |
|---|---|---|
| 1 | The header's **Services** menu button and the **Core departments** heading of its dropdown were written in the component, so an editor could change the links but not these two words. Found by comparing every visible text on every public page with everything the admin can edit (`scripts/qa/cms-coverage.mjs`). | New shared section "Header menu labels" (section type `header_labels`, migration `0023`, `db/seed/pages.sql`), drawn by `Nav` and `MobileNav`. With the default words nothing changes visually. |
| 2 | The **description** field of the reviews' avatar pictures and of the showreel's video and poster could be edited but was never drawn (the components always wrote `alt=""`). | The avatar description is drawn as the picture's `alt` (empty stays empty: decoration), the video description names the showreel section (`aria-label`, default "Showreel"), the poster description is the video's `title`. Empty values give the same markup as before. |

The audit script itself needed two changes while it ran (not product defects): it ignores emphasis markup inside text (`<em>`, `<b>`) and the typographic helper spans (no-break and per-word wrappers) when it compares page markup, because those depend on the words an editor writes, not on the layout; and it looks for a case study's card on every service page, not only the first.

## 6. Text that is not editable, on purpose

The coverage audit compares every visible text on 13 public pages (the five pages, all four services, two case studies, two articles) with the editable content. These remain, all interface wording that belongs to the design and carries no site content:

| Text | Where | Why |
|---|---|---|
| `Step #1`, `Step #2`, … | Process steps of services and case studies | Numbering generated from the position of the step |
| `★★★★★` | Rating lines, review badges | A drawn rating mark; the score and the text beside it are editable |
| `G` | Review source mark | The brand's own mark, fixed like the footer badges |
| `You` | The avatar stack of the closing call to action | A fixed label of the graphic |
| `optional` | Contact form, next to optional fields | Form convention; the field labels are editable |
| `min read`, formatted dates, counters (`All 8`, `Brand 3`) | Blog and Works | Computed from data |
| The brand marks in the footer badges | Footer | The brands' own marks (their captions are editable) |

Contact phone, address and business hours are editable under Settings → Contact and are given to search engines (structured data); the design has no visible place for them, so they are not drawn on the page (this is by design, noted in `PAGE-CMS-ARCHITECTURE.md`).

Search settings exist at two levels: Settings → SEO has defaults per fixed page; a page's own SEO form wins over them. Both were tested.

## 7. Other suites run on the same build

| Suite | Result |
|---|---|
| `page-parity.mjs diff` (23 pages: markup, links, media, scroll behaviour, screenshots at 1440 / 768 / 390) | 23 of 23 identical |
| `pages-admin-qa.mjs` | 97 of 97 |
| `entities-admin-qa.mjs` | 78 of 78 |
| `drafts-qa.mjs` (draft, publish, preview) | 55 of 55 |
| `visibility-qa.mjs` (enabled and disabled sections) | 305 of 305 |
| `revisions-qa.mjs` | 25 of 25 |
| `page-cms-qa.mjs` | 46 of 46 |
| `navigation-qa.mjs` (edge cache off) | 45 of 45 |
| `cache-qa.mjs` | 7 of 7 |
| `full-cms-qa.mjs`: page sections | 36 of 36 sections, all passing; the page-markup comparison was re-run after the per-word wrapper rule above (17 of 17 for the About group, all six pages identical) |
| `full-cms-qa.mjs`: records | 196 sections of 18 records: 213 of 219 checks on the first run; the 6 that failed were three case study cards that the script looked for on the wrong service pages (fixed, re-run 28 of 28) |
| `full-cms-qa.mjs`: SEO / settings / responsive / authorization / crawl | 22 / 9 / 27 / 7 / 4 checks, all passing |
| `db:verify`, `db:verify:pages`, `db:verify:entities` | 229, 179, 70 checks |
| Lint, type check, production build | clean |

## 8. How to run it again

```
npm run build                                   # or: npx vite build
npx wrangler dev --config dist/server/wrangler.json --port 8788 --persist-to .wrangler/state --var EDGE_CACHE:1
ADMIN_EMAIL=… ADMIN_PASSWORD=… BASE=http://localhost:8788 node scripts/qa/full-cms-qa.mjs            # everything
node scripts/qa/full-cms-qa.mjs --only=pages|records|seo|settings|responsive|auth|crawl [--grep="Home /"] [--out=report.json]
node scripts/qa/cms-coverage.mjs                # visible text that is not editable content
node scripts/qa/cache-qa.mjs                    # needs the edge cache on
```

Use a temporary admin (`npm run admin:create`) and delete it afterwards. The scripts refuse any address that is not `localhost`, and put every record, section, setting and page status back when they finish.

## 9. Limits of this audit

- It ran on a local database. The live site was not edited; before relying on a published change there, run the migrations and seeds in `docs/DEPLOYMENT.md` (this audit adds migration `0023` and one seeded shared section).
- The library holds one video, so the showreel's video cannot be swapped for another file in this data set; the field and its picker were exercised, and the poster was replaced.
- E-mail delivery, the Turnstile check and the third-party integrations depend on secrets and external services and are covered by their own tests (`FUNCTIONAL-QA.md`, `INTEGRATIONS.md`), not by this audit.
- A rendered page is compared by markup and by the pixel parity suite; it was not judged by eye.
