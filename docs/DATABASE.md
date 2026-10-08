# Database (Cloudflare D1)

D1 is SQLite, so everything below is plain SQLite. The schema lives in `visuolab-next/migrations/`, the content in `visuolab-next/db/seed/content.sql`, the read queries in `src/lib/server/cms.ts`. The **service**, **Works** and **Blog** pages read from the database (`SERVICES-CMS.md`, `CASE-STUDIES-CMS.md`, `BLOG-CMS.md`); the other public pages still render the typed content in `src/content/*.ts`. The seed and the read queries were checked to be identical to that content (section 9), so switching a page over changes no pixel.

## 1. Conventions

| Topic | Rule |
|---|---|
| Ids | `TEXT` primary keys. Seeded rows have readable ids (`svc_brand-identity`, `case_orbit`, `post_webflow-or-next-js`, `media_cases-orbit`); rows created in the admin use `crypto.randomUUID()`. |
| Dates | ISO 8601 strings in UTC (`2026-10-04T00:00:00.000Z`) in `created_at`, `updated_at`, `published_at`. They sort correctly as text. |
| Content tables | `id`, `slug` (unique), `title`, `status` (`draft` / `published` / `archived`, default `draft`), `created_at`, `updated_at`, `published_at`. A row with `status = 'published'` must have a `published_at` (a CHECK enforces it). Applies to `services`, `case_studies`, `blog_posts`, `blog_categories`, `blog_tags`, `media`. |
| System tables | `users`, `sessions`, `site_settings` (keyed by `key`), `navigation_items`, `integrations`, `audit_logs`, `contact_submissions` do not have a public slug or publish date; `integrations` has `slug`, `title`, `status`. |
| Foreign keys | Declared and enforced (D1 turns them on). Deleting something in use is refused (`RESTRICT`) for media and blog categories; child rows are removed with their parent (`CASCADE`) for images, links, sessions and menu items; the user link is cleared (`SET NULL`) where history must survive. |
| JSON columns | `*_json` text, each guarded by `CHECK (json_valid(...))`. Used for ordered, repeatable page content that is always read and written together (the steps of a process, the results of a case study). Shapes: section 5. |
| Rich text | Text that may contain `<em>…</em>` and `<b>…</b>` (headlines, lead paragraphs, statistics). The site renders it without injecting HTML. |
| Secrets | Never in the database. `integrations.secret_name` holds only the **name** of the Worker secret. Passwords are PBKDF2 hashes; session tokens are stored as SHA-256 hashes; visitor IPs as salted hashes. |
| Personal data | Only in `contact_submissions` (name, e-mail, company, the message, the choices made) and `users` (e-mail, name). |

## 2. Migrations

Applied in order with `npm run db:migrate:local` (local), `npm run db:migrate:preview` (the built Worker's own local copy), `npm run db:migrate:remote` (live). Forward-only.

| File | What it does |
|---|---|
| `0000_app_meta.sql` | Baseline table used by the health check. |
| `0001_submissions.sql` | Contact form table (first name: `submissions`) and `rate_limits`. |
| `0002_admin_sessions.sql` | First version of `sessions` (replaced in 0003). |
| `0003_users_sessions.sql` | **users**; **sessions** rebuilt with a foreign key to users (everyone signs in once again). |
| `0004_media.sql` | **media**. |
| `0005_services_case_studies.sql` | **services**, **case_studies**, **case_study_images**, join table `service_case_studies`. |
| `0006_blog.sql` | **blog_categories**, **blog_tags**, **blog_posts**, **blog_post_tags**. |
| `0007_site_navigation_integrations_audit.sql` | **site_settings**, **navigation_items**, **integrations**, **audit_logs**. |
| `0008_contact_submissions.sql` | `submissions` becomes **contact_submissions**; existing rows are copied over (tested). |
| `0009_slug_redirects.sql` | **slug_redirects**: old address to new address after an editor renames a slug (see `SERVICES-CMS.md`). |
| `0010_case_study_featured.sql` | `case_studies.featured` flag (0/1) and an index; the seed marks the four home page cases. |
| `0014_integration_events.sql` | `integrations.last_success_at`; table `integration_events` (activity log of integration runs, 30-day retention). See `INTEGRATION-MANAGEMENT.md`. |
| `0015_navigation_cms.sql` | `navigation_items`: `type`, `page_ref`, `is_visible`, `open_in_new_tab`; the unique position index is dropped. See `/admin/navigation` in `ARCHITECTURE.md` section 8. |
| `0017_page_section_revisions.sql` | **page_section_revisions**: the earlier saved versions of a section (the last 10 per section), for "Previous versions" in the Pages admin. |
| `0016_page_cms.sql` | Page CMS: **pages**, **page_sections**, **page_section_refs** and the lookup lists **page_templates**, **page_section_types**. See `PAGE-CMS-ARCHITECTURE.md`. |
| `0013_notification_delivery.sql` | `contact_submissions`: `notify_status`, `notify_provider`, `notify_message_id`, `notify_attempts`, `notify_last_attempt_at`, `idempotency_key` (unique when set), `content_hash`; existing rows get a status from what was recorded. See `INTEGRATIONS.md`. |
| `0012_media_library.sql` | `media.caption`, `original_name`, `sha256` (64 hex characters) and two indexes; see `MEDIA.md`. |
| `0011_blog_seo_fields.sql` | `blog_posts.canonical_url` (https only) and `og_image_id` (media, SET NULL), two indexes. Scheduled publishing needs no column (see `BLOG-CMS.md`). |

The 15 requested tables are all there: users, sessions, services, case_studies, case_study_images, blog_posts, blog_categories, blog_tags, blog_post_tags, contact_submissions, media, site_settings, navigation_items, integrations, audit_logs. Extra: `service_case_studies` (which cases a service page shows), `slug_redirects` (old addresses of renamed pages), `rate_limits` (form and sign-in counters), `app_meta` (health check).

## 3. Relationships

```
users 1──< sessions                     (CASCADE)
users 1──< media.uploaded_by            (SET NULL)      users 1──< audit_logs.user_id (SET NULL)
users 1──< site_settings.updated_by, integrations.updated_by (SET NULL)

media 1──< services.hero_image_a_id / hero_image_b_id            (RESTRICT)
media 1──< case_studies.card_image_id / cover_image_id           (RESTRICT)
media 1──< case_study_images.media_id                            (RESTRICT)
media 1──< blog_posts.cover_image_id (RESTRICT) / author_image_id (SET NULL)

case_studies 1──< case_study_images                              (CASCADE)
services >──< case_studies   via service_case_studies            (CASCADE both ways)

blog_categories 1──< blog_posts                                  (RESTRICT)
blog_posts >──< blog_tags    via blog_post_tags                  (CASCADE both ways)

navigation_items 1──< navigation_items (parent_id: a menu group and its links)   (CASCADE)
```

## 4. Tables

Type notes: all `TEXT` unless shown; `NN` = NOT NULL. Defaults in brackets.

### users, sessions
| users | |
|---|---|
| `id` PK, `email` NN **unique, case-insensitive**, `name` NN, `password_hash` NN (`pbkdf2$sha256$100000$salt$hash`), `role` NN [`editor`] (`admin` / `editor`), `status` NN [`active`] (`active` / `disabled`), `last_login_at`, `created_at` NN, `updated_at` NN | |

| sessions | |
|---|---|
| `id` PK (SHA-256 of the cookie token), `user_id` NN → users CASCADE, `created_at`, `expires_at` (14 days), `last_seen_at` (12 h idle limit), `ip_hash`, `user_agent` | Indexes: `idx_sessions_user`, `idx_sessions_expires` |

The first admin is created with `npm run admin:create` (see section 10). The `ADMIN_PASSWORD_HASH` secret and `ADMIN_EMAIL` variable of the earlier version are gone.

### media
`id`, `slug` (unique, e.g. `cases-orbit`), `title`, `status` [`draft`], `kind` (`image` / `video` / `file`), `mime`, `storage` [`static`] (`static` = shipped with the site, `r2` = uploaded), `url` (unique public path), `r2_key` (unique; required exactly when `storage = 'r2'`), `width`, `height`, `bytes` (positive), `alt_text` [''] (default alt text; a page may override it where it uses the file), `focal_x`, `focal_y` (0 to 1), `uploaded_by` → users SET NULL, timestamps. Indexes: `idx_media_kind_status`, `idx_media_storage`.

### services
`id`, `slug`, `title` ("Brand identity"), `status`, `position`, `meta_title`, `meta_description`, `hero_title` (rich), `hero_lead`, `hero_cta_label`, `hero_cta_href`, `hero_image_a_id` / `hero_image_b_id` → media RESTRICT, `hero_shots_json`, `show_problems` (0/1; "What we fix" exists but is hidden today), `problems_json`, `overview_json`, `outcomes_json`, `show_band` (0/1; the inline call-to-action band, hidden today), `band_json`, `included_json`, `process_json`, `cases_json`, timestamps. Index: `idx_services_status_position`.

### case_studies
`id`, `slug`, `title` (the page headline, rich), `status`, `position` (order on /works), `featured` (0/1), `meta_title`, `meta_description`, `client_name` ("Orbit": card title and breadcrumb), `year`, `type_line` ("Fintech app · Fintech"), `short_kind` (label under the thumbnail in "More work"), `card_tags_json`, `filters_json` (which /works filters list it), `card_image_id` + `card_image_alt`, `cover_image_id` + `cover_image_alt` (both → media RESTRICT), `facts_json`, `about_label`, `about_lead` (rich), `stats_json`, `showcase_json` (the card on the home and service pages), `process_json`, `challenges_json`, `results_json`, `more_json`, timestamps. Index: `idx_case_studies_status_position`.

### case_study_images
`id`, `case_study_id` → case_studies CASCADE, `media_id` → media RESTRICT, `role` (`gallery_a` / `gallery_b` / `wide`), `position` [0], `caption`, `alt_text`, `object_position` (CSS, e.g. `20% 30%`), timestamps. **Unique** (`case_study_id`, `role`, `position`); index on `media_id`.

### service_case_studies
(`service_id` → services CASCADE, `case_study_id` → case_studies CASCADE, `position`), primary key on both ids; index `idx_service_case_studies_case`.

### blog_categories, blog_tags, blog_posts, blog_post_tags
- **blog_categories**: content columns + `position`. One category per article; the five topics are the filter chips.
- **blog_tags**: content columns. The blog has no tags today, so the seed leaves it empty.
- **blog_posts**: `id`, `slug`, `title`, `status`, `category_id` → categories RESTRICT, `meta_title`, `meta_description`, `excerpt` (only the featured article has one), `featured` (0/1), `lead`, `body_json`, `outro_json`, `related_json`, `read_minutes` (> 0), `author_name`, `author_image_id` → media SET NULL, `cover_image_id` → media RESTRICT, `cover_alt`, timestamps; `published_at` is the date shown on the article. Indexes: `idx_blog_posts_status_published` (status, published_at DESC), `idx_blog_posts_category`.
- **blog_post_tags**: (`post_id` → posts CASCADE, `tag_id` → tags CASCADE), primary key on both; index on `tag_id`.

### site_settings
`id`, `key` (unique, e.g. `reviews`, `about.faq`), `title` (label for the admin), `status` [`published`], `value_json` NN, timestamps, `updated_by` → users SET NULL. Keys are listed in section 6.

### navigation_items
`id`, `menu` (`primary` / `cta` / `mega_cards` / `mega_promo` / `mega_columns` / `footer`), `parent_id` → navigation_items CASCADE (a group heading has `type` `group` and `href` NULL; its links point at it), `position`, `label`, `type` (`internal` / `external` / `group`), `href`, `page_ref` (the page an internal link was picked from, e.g. `service:brand-identity`, `case:orbit`, `post:<slug>`, `page:works`; set by the server from `href`, informational), `description`, `tag`, `icon_key` (name of an icon drawn in code), `is_visible` (0/1; hiding a group hides its links), `open_in_new_tab` (0/1), `status` (legacy: kept at `published`; visibility is `is_visible`), timestamps. Indexes: `idx_navigation_menu_position`, `idx_navigation_parent`. Migration `0015_navigation_cms.sql` added `type`, `page_ref`, `is_visible`, `open_in_new_tab` (old rows are carried over: published → visible, no `href` → group, `http(s)` → external) and dropped the unique (`menu`, parent, `position`) index: the editor saves a whole menu at once and `position` is written from the order of the list, so an index would reject the intermediate states of a reorder. Order is `ORDER BY position, id`.

### integrations
`id`, `slug` (unique: `resend`, `turnstile`, `analytics`), `title`, `status` [`disabled`] (`disabled` / `enabled` / `error`), `config_json` (settings that are safe to show), `secret_name` (e.g. `RESEND_API_KEY`), `last_checked_at`, `last_error`, timestamps, `updated_by`.

### audit_logs
Append-only: `id`, `user_id` → users SET NULL, `user_email` (kept when the user is deleted), `action`, `entity_type`, `entity_id`, `summary`, `diff_json`, `ip_hash`, `created_at`. Indexes: `idx_audit_created`, `idx_audit_entity`, `idx_audit_user`. Written by sign-in, submission and service actions.

### contact_submissions
`id`, `name`, `email`, `company`, `service` (the "What do you need?" choices joined with ", "), `budget`, `message`, `status` (`new` / `read` / `replied` / `archived` / `spam`), `source` [`contact-page`], `ip_hash` (salted hash, never the address), `user_agent` (200 characters), `notified_at`, `notify_error`, `created_at`, `updated_at`. Indexes: `idx_contact_status_created`, `idx_contact_created`, `idx_contact_email`. How the form feeds it: `CONTACT-FORM.md`.

### slug_redirects
`id`, `kind` (`service` / `case_study` / `blog_post`), `old_slug`, `new_slug`, `created_at`; **unique** (`kind`, `old_slug`), `old_slug <> new_slug`; index on (`kind`, `new_slug`). Public routes answer a miss with a 308 to `new_slug`. Only services use it so far.

### rate_limits, app_meta
`rate_limits(key PK, window_start, count)`: fixed-window counters with hashed keys. `app_meta(key PK, value, updated_at)`: baseline row.

## 5. JSON document shapes

Typed in `src/content/types.ts`; the verification script compares the decoded documents with the typed content field by field.

- **services.hero_shots_json**: `[{alt, width, height, priority, lazy}]` for image a, then b (the file is the media row).
- **services.problems_json** `{label, title, items[{title, text, proofValue, proofLabel}]}`; **overview_json** `{label, title, blocks[{title, text}]}`; **outcomes_json** `{label, title, items[{value, text}]}`; **band_json** `{text, cta{label, href}}`; **included_json** `{label, title, items[{icon{viewBox, nodes[]}, title, text}]}`; **process_json** `{label, title, steps[{title, duration, text}]}`; **cases_json** `{label, title}`.
- **case_studies.facts_json** `[{term, value}]` (Client, Industry, Services, Year, Timeline); **stats_json** `[{value, label}]`; **showcase_json** `{title, tags[], quote{source, text, avatar, name, role}` or `results[{value, text}]}`; **process_json** `{label, title, steps[{title, duration, text, deliverables[{title, detail}]}]}`; **challenges_json** `{label, title, items[{title, text}]}`; **results_json** `{label, title, items[{metric, text}]}`; **more_json** `{label, title, slugs[]}`.
- **blog_posts.body_json** `[{type: "heading" | "paragraph", text}]`; **outro_json** `{before, linkText, href, after}`; **related_json** `[slug, slug]`.

## 6. site_settings keys (all seeded)

| Key | Content |
|---|---|
| `settings.general`, `settings.contact`, `settings.social`, `settings.seo`, `settings.analytics` | the admin **Site settings** (name, logos, contact, profiles, SEO defaults and robots, analytics IDs). Public-safe only: no secret is ever stored here; see `SETTINGS.md` |
| `reviews` | the five client reviews of the carousel |
| `trusted_by` | the ten names of the logo marquee |
| `home.hero`, `home.why`, `home.stats`, `home.services`, `home.work`, `home.industries`, `home.process`, `home.reviews`, `home.showreel` | home page sections: headline and copy, lists, the four featured case slugs, the showreel video and poster |
| `about.hero`, `about.principles`, `about.mission_vision`, `about.milestones`, `about.manifesto`, `about.offices`, `about.faq`, `about.roles` | About page sections (offices carry the time zone and a flag name; the flag drawing stays in code) |
| `site.contact` | e-mail, contact page heading, "who answers", direct links, the three fact lines |
| `site.cta` | the closing call-to-action band: headline, lead, buttons, floating images, avatars |
| `site.footer` | newsletter text, legal links, social links, copyright line, the six award badges |

Not in the database (they stay in code): page headings and lead paragraphs of Works, Blog, article, service and case pages (only the data of those pages is stored), icons and flag drawings, and the footer link variants per page.

## 7. Navigation model

One row per link, grouped by `menu`. Examples: `primary` = Works, Blog, About; `cta` = Contact us; `mega_cards` = the three service cards (with `icon_key` `branding`, `product`, `web`); `mega_promo` = Design sprint (tag "1–2 weeks"); `mega_columns` = three groups of five links (parent row + children); `footer` = Services (5), Industries (5), Company (6). The footer rows hold the default (cross-page) addresses; the per-page footer variants (own-page links such as `#process` on the home page) remain code, because they depend on the page being shown.

**The website reads this table.** The layout calls `getNavigation()` (`src/lib/server/cms.ts`) for every public request and passes the result to `NavigationProvider`; `Nav`, `MobileNav` and `Footer` read it with `useNavigation()`. Only visible items are returned; a link whose `open_in_new_tab` is 1 gets `target="_blank" rel="noopener noreferrer"`. If the database cannot be read the layout falls back to the menus the site was seeded with (`src/content/nav-data.ts`), so the header and footer never disappear. The footer keeps one address per link: the per-page variants (a link into the page you are on becomes a bare anchor; the works and contact pages send their own link to a home-page section) are applied when drawing (`ownPage()` in `Footer.tsx`), not stored. Not in the table: the "Services" trigger label, the footer legal links (Privacy policy, Cookie policy, Terms) and the social icons (the latter come from Settings).

**Rules checked on the server** (`src/lib/validation/navigation.ts`, again on every save): label 1–60 characters without `<` `>`; internal URL starts with `/` (not `//`) or `#` and has no spaces; external URL is `https://` / `http://` with a host and no login, or `mailto:` / `tel:` (`javascript:`, `data:` and similar are refused); a column holds links, a menu without columns holds links only; limits per menu (primary 8, cards 6, columns 6 with 10 links each, footer 6 columns with 12 links each, contact button and promo 1); a row id that belongs to another menu is refused. Saving replaces the section in one D1 batch (`saveSection()` in `src/lib/server/navigation-admin.ts`), writes an `audit_logs` entry and bumps the content version so cached pages refresh.

## 8. Seed data

`db/seed/content.sql` is **generated** by `npm run db:seed:generate` (`scripts/db/generate-seed.mjs`), from the typed content in `src/content/*.ts` and from `referance-website/index.html`, `about.html`, `contact.html` and `assets/`. Nothing is invented: the generator stops with an error if the same case study card differs between the home page and the service pages, or if a "More work" thumbnail disagrees with its case. Re-running it produces identical bytes.

| Table | Rows | From |
|---|---|---|
| media | 28 | every file in `assets/` with type, size in bytes and image dimensions read from the file |
| case_studies | 8 | all eight case studies |
| case_study_images | 40 | 2 + 2 gallery images and 1 wide image for each case study |
| services | 4 | the four service pages |
| service_case_studies | 12 | three cases on each service page, in order |
| blog_categories / blog_posts | 5 / 6 | the topics and the six articles (dates are the published dates) |
| blog_tags / blog_post_tags | 0 / 0 | the blog has no tags |
| site_settings | 27 | section 6 (22 content documents + the 5 `settings.*` documents of the admin Settings screen) |
| navigation_items | 45 | section 7 |
| integrations | 3 | Resend (from and to addresses; disabled until a key is set), Turnstile, analytics (all disabled) |
| users, sessions, contact_submissions, audit_logs | 0 | not seeded |

The file starts with `DELETE` statements for the content tables, so it can be applied again to return to the original content. It does not touch users, sessions, contact messages, rate limits or the audit log. **Do not run it again once editors work in the admin.** Apply with `npm run db:seed:local` (or `:preview`, `:remote`).

## 9. Verification

`npm run db:verify` builds a new in-memory SQLite database from the migration files and the seed and runs **227 checks, all passing**; `npm run db:verify:local` runs the read-only subset against the real local D1 (`.wrangler/state`): **149 of 149 pass**. What is checked:

- all 9 migrations apply in order on an empty database; the rename keeps contact rows that existed before it; the seed applies twice with the same result;
- the 15 tables exist; each content table has id, slug, title, status, created, updated and published columns; 19 foreign keys, 13 unique constraints and 19 secondary indexes are declared;
- seed row counts per table (section 8); every seeded content row is published; no secret is stored in `integrations`;
- **the read queries in `cms.ts` return exactly the typed content the pages render**: the 4 services, the 8 case studies, the 6 articles, the 5 categories, the reviews, the logo marquee and all navigation menus match field by field; the lengths of the page lists in `site_settings` match the pages; every `/assets/...` file named inside a content document has a media row (13 checked); image sizes were read from the files;
- `PRAGMA integrity_check` and `PRAGMA foreign_key_check` are clean;
- 19 representative queries use an index (case studies and services by status and position, the latest articles, an article's category, a case study by slug, a case study's images, the cases of a service and the services of a case, posts with a tag, a menu in order, a setting by key, contact messages by status and by address, media by kind, sessions by user and by expiry, recent and per-record audit entries);
- constraints, tested by trying to break them: duplicate slugs of services, cases, posts, media urls, integrations and settings keys; user e-mail unique regardless of case; invalid status, role, menu, image role and message status; published without a publish date; invalid JSON; r2 media without a key; gallery images pointing at a missing case or file; two images in one slot; a duplicate menu position (also at top level); a duplicate tag on a post; deleting media or a category that is in use is refused;
- cascades: deleting a user removes their sessions and keeps the audit entry (user cleared, e-mail kept) and their uploads; deleting a case study removes its images and service links but not the files; deleting a tag or a menu group removes only links and children.

The same schema was also applied through wrangler to the local D1 (`npm run db:migrate:local`, `npm run db:seed:local`), and counts were read back with `wrangler d1 execute` (services 4, case studies 8, images 40, posts 6, media 28, settings 22, navigation 45, integrations 3).

## 10. Working with it

```
npm run db:migrate:local          # apply migrations to the local D1 (npm run dev)
npm run db:seed:local             # load the website content
npm run db:verify                 # full check on a fresh in-memory database
npm run db:verify:local           # read-only check of the local D1
ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='a long password' npm run admin:create
```

`admin:create` hashes the password on your machine (PBKDF2, 100,000 rounds) and writes only the hash; run it again with the same e-mail to reset the password (it also signs that user out). Add `--preview` for the database of `npm run preview` or `--remote` for the live one.

**Live database** (not done yet; needs the Visuolab Cloudflare account): `npm run db:migrate:remote`, then `npm run db:seed:remote`, then `admin:create --remote`, then deploy. D1 keeps point-in-time history (Time Travel); note a bookmark before each production migration (`npx wrangler d1 time-travel info visuolab`).

Example queries (all verified): published case studies in order `SELECT slug, title FROM case_studies WHERE status = 'published' ORDER BY position;` latest articles `SELECT slug, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC;` cases of a service `SELECT c.slug FROM service_case_studies l JOIN case_studies c ON c.id = l.case_study_id WHERE l.service_id = 'svc_brand-identity' ORDER BY l.position;` messages waiting `SELECT * FROM contact_submissions WHERE status = 'new' ORDER BY created_at DESC;`.

## 11. Decisions and limits

- **Page-level content as JSON documents.** Testimonials, FAQ, timeline, offices, principles, industries and similar lists are small, edited as a whole and shown in one place, so they live in `site_settings` (22 documents) instead of a table each. They can be promoted to tables later without changing the public design.
- **Case study cards:** the card on the home and service pages (`showcase_json`) is separate from the case page data because its headline and tags differ; it is identical wherever a case appears, so it is stored once per case.
- **Authors** are not a table: an article stores the author's name and portrait. Add one if there will be several writers.
- **No `phone` column** in `contact_submissions`: the form has no such field and the design must not change.
- `audit_logs` records sign-in events, submission changes and service changes. Only the service, works and blog pages read their content from the database so far; the editors and page switch for case studies, blog, navigation and settings are the next phases.
