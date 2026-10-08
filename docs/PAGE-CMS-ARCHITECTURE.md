# Page CMS architecture

How the public pages become editable, section by section, without changing the design. This is the architecture and the foundation (database migration, schemas, types, defaults, checks). The website does not read any of it yet: no public page has changed. The input is [PAGE-CONTENT-MAP.md](PAGE-CONTENT-MAP.md).

Code: `visuolab-next/src/lib/cms/` (one file per section in `sections/`) · server actions: `src/actions/cms-pages.ts` · migration: `visuolab-next/migrations/0016_page_cms.sql` · checks: `npm run db:verify:pages`.

## 1. Principles

1. **The design is fixed; the words and pictures in it are data.** Every section the design has gets one predefined content schema. Editors fill the content of sections that exist. They cannot add a section, remove one, reorder them or change its type.
2. **Not a page builder.** There is no "block" library, no free-form JSON, no layout fields. A content schema names every field it accepts, with its type, its limit and the number of items the layout can take; an unknown key is an error.
3. **Independently addressable.** A page is a row. Each of its sections is a row. A section is read, saved, switched off or restored without touching the page or any other section. There is no document that holds a whole page.
4. **One source for each fact.** A piece of copy lives in exactly one place. The CMS does not copy what already has a table (case studies, services, articles, navigation, site settings); it points at it.
5. **A damaged row cannot break a page.** Content is checked when it is saved and again when it is read; if a row is missing or no longer passes its schema, the page uses the built-in default for that section.
6. **Same schema in the browser, the server and the tests.** Types are inferred from the schemas (`z.infer`), so a type and its validation cannot drift.

## 2. Overview

```
page_templates ─┐                            page_section_types ─┐
 (fixed list)   │                              (fixed list)      │
                ▼                                                 ▼
             pages  1 ───────< page_sections >──── (section_type) ┘
               │                    │
               │ og_image_id        │ 1
               ▼                    ▼ n
             media <──────── page_section_refs ────────> case_studies
                      (media_id)             (case_study_id)
```

- `pages` and `page_sections` are the content.
- `page_templates` and `page_section_types` are the closed lists that make the model controlled (a foreign key refuses anything else). Adding a template or a type is a migration plus code, which is the point: a new design section is a development task.
- `page_section_refs` records which media files and case studies each section points at, so the database can protect them (section 8).

The set of sections of each template, their order and their schemas are defined in code (`registry.ts`). The database holds the content and the lookup tables; `scripts/db/verify-pages.mjs` fails if the lookup tables and the registry disagree.

## 3. Page model

Table `pages`. One row per page, one page per template (`UNIQUE (template)`): the set of pages is fixed like the design.

| Column | Type | Notes |
|---|---|---|
| `id` | text, PK | |
| `slug` | text, unique | A stable key (`home`, `about`, `works`, `service-detail`, ...), lowercase letters, digits, `-` `_` only. **Not the address**: the address comes from the template (`/`, `/about`, ...), so renaming a slug can never break a link. |
| `title` | text | The name in the admin ("Home"). Not shown on the site. |
| `status` | `draft` / `published` / `archived` | The field is there for pages that may become optional later. The admin step keeps every page that has a route published. |
| `template` | text, FK `page_templates` | Which layout, therefore which sections. |
| `seo_title`, `seo_description` | text, nullable | `NULL` means "use the default" (section 10). |
| `og_image_id` | text, FK `media`, `RESTRICT` | Share picture for this page. |
| `canonical_url` | text, nullable | An `https://` address or a path; `NULL` means the page's own address. |
| `noindex` | 0/1 | Keeps the page out of search engines (the global "indexing" switch in Settings still overrides). |
| `created_at`, `updated_at`, `updated_by` | | `updated_by` → `users`, cleared if the user is deleted. |

Saving a section does **not** change the page row, and saving the page's SEO does not touch sections.

### Templates

Table `page_templates` (`template`, `label`, `route`). A template with a route is a public page; one without holds copy that other pages use.

| Template | Route | What it holds |
|---|---|---|
| `home` | `/` | The Home sections |
| `about` | `/about` | The About sections |
| `works` | `/works` | The Works listing (hero, grid, reviews) |
| `blog` | `/blog` | The Blog listing (hero, featured, grid) |
| `contact` | `/contact` | Intro and form copy |
| `service_detail` | none | Copy that is the same on every service page: the "Trusted by" label and the reviews heading. Each service's own content stays in `services`. |
| `case_study_detail` | none | Words around every case study ("All projects"). Each case study stays in `case_studies`. |
| `article_detail` | none | Words around every article (contents, share, "More from the studio"). Each article stays in `blog_posts`. |
| `shared` | none | Copy used on several pages: the closing CTA band, the reviews, the logo list, the rating line, the footer extras. |

## 4. Section model

Table `page_sections`. One row per section of a page.

| Column | Type | Notes |
|---|---|---|
| `id` | text, PK | |
| `page_id` | text, FK `pages`, `CASCADE` | |
| `section_key` | text | The section's name on its page (`hero`, `faq`, ...). With `page_id` it is unique and is how code and the admin address the section. Lowercase, digits, `_`. |
| `section_type` | text, FK `page_section_types` | Which schema the content follows. |
| `position` | integer ≥ 0 | Where the section sits on the page. Set from the template; editors do not change it. |
| `is_enabled` | 0/1 | Switches the section off without deleting its content. Only sections the registry marks `canDisable` may be switched off (the others own anchors other pages link to, or the page is meaningless without them). |
| `content` | text, JSON object | The section's content. `CHECK (json_valid(content) AND json_type(content) = 'object')`. Always validated against the schema of `section_type` before it is written. |
| `schema_version` | integer | The version of the type's schema the content was written with (for future migrations of content). |
| `created_at`, `updated_at`, `updated_by` | | |

Rules:

- A section's identity is `(page, section_key)`. Its `section_type` follows from the template; the registry rejects a mismatch.
- `content` holds **only** what the section's schema names. Rich text is restricted to `<em>` and `<b>`; plain text rejects `<` and `>`; links are a path, an anchor, `https://` or `mailto:`.
- Order is fixed by the template. `position` exists so the database and queries can order sections; it is not an editing feature.
- Saving is **per section** (`UPDATE page_sections SET content = ?, ...`), together with its references (section 8) in one D1 batch.

### The sections of each template

`canDisable`: may an editor switch the section off. Anchor: the `id` other links point at; it never changes.

**Home (`/`)**

| Key | Type | Disable | Anchor |
|---|---|---|---|
| `hero` | `home_hero` | no | `top` |
| `logos` | `logo_marquee` | yes | |
| `showreel` | `showreel` | yes | `showreel` |
| `why` | `why_stats` | no | `why` |
| `services` | `services_columns` | no | `services` |
| `work` | `case_showcase` | no | `work` |
| `industries` | `industries_grid` | yes | `industries` |
| `process` | `process_steps` | yes | `process` |
| `reviews` | `reviews_carousel` | yes | `reviews` |

**About (`/about`)**

| Key | Type | Disable | Anchor |
|---|---|---|---|
| `hero` | `about_hero` | no | `top` |
| `mosaic` | `case_mosaic` | yes | |
| `principles` | `principles_list` | yes | `principles` |
| `mission` | `mission_vision` | yes | |
| `story` | `timeline` | yes | `story` |
| `manifesto` | `manifesto` | yes | `manifesto` |
| `places` | `office_clocks` | yes | `places` |
| `faq` | `faq_accordion` | yes | `faq` |
| `careers` | `open_roles` | no (the header and footer link to `/about#careers`) | `careers` |

**Works (`/works`)**: `hero` (`works_hero`, no), `grid` (`works_grid`, no, `works-grid`), `reviews` (`reviews_carousel`, yes, `reviews`).
**Blog (`/blog`)**: `hero` (`blog_hero`), `featured` (`blog_featured`), `grid` (`blog_grid`, `posts-grid`), none can be disabled.
**Contact (`/contact`)**: `intro` (`contact_intro`, `top`), `form` (`contact_form`, `form`), none can be disabled.
**Service page copy**: `logos` (`logo_marquee`, yes), `reviews` (`reviews_carousel`, yes).
**Case study page copy**: `chrome` (`case_study_chrome`). **Article page copy**: `chrome` (`article_chrome`).
**Shared**: `cta` (`cta_band`, anchor `contact`), `reviews` (`reviews_collection`), `logos` (`logos_collection`), `rating` (`site_rating`), `footer` (`footer_extras`); none can be disabled.

35 sections in 9 templates, 32 section types.

## 5. Section schemas

Each section has its own file in `src/lib/cms/sections/` that exports a strict Zod schema and the type inferred from it (`homeHeroSchema` / `HomeHeroSection`). The files are built from the primitives in `src/lib/cms/primitives.ts`; `types.ts` collects the types (`SectionContentMap`, `TemplateSections`, `PageContent<T>`). "Rich" = text with `<em>`/`<b>`; "text" = plain; "opt" = may be empty; limits are characters. A count in brackets is what the layout takes (the loose limits of the old forms are not used: see PAGE-CONTENT-MAP.md, cross-cutting finding 4).

| File in `src/lib/cms/sections/` | Section type | Used on |
|---|---|---|
| `home-hero.ts` · `logo-marquee.ts` · `showreel.ts` · `why-stats.ts` · `services-columns.ts` · `case-showcase.ts` · `industries-grid.ts` · `process-steps.ts` · `reviews-carousel.ts` | `home_hero` · `logo_marquee` · `showreel` · `why_stats` · `services_columns` · `case_showcase` · `industries_grid` · `process_steps` · `reviews_carousel` | Home (logo marquee and reviews carousel also Works / service pages) |
| `about-hero.ts` · `case-mosaic.ts` · `principles-list.ts` · `mission-vision.ts` · `timeline.ts` · `manifesto.ts` · `office-clocks.ts` · `faq-accordion.ts` · `open-roles.ts` | `about_hero` · `case_mosaic` · `principles_list` · `mission_vision` · `timeline` · `manifesto` · `office_clocks` · `faq_accordion` · `open_roles` | About |
| `works-hero.ts` · `works-grid.ts` · `blog-hero.ts` · `blog-featured.ts` · `blog-grid.ts` | `works_hero` · `works_grid` · `blog_hero` · `blog_featured` · `blog_grid` | Works, Blog |
| `contact-intro.ts` · `contact-form.ts` | `contact_intro` · `contact_form` | Contact |
| `cta-band.ts` · `reviews-collection.ts` · `logos-collection.ts` · `site-rating.ts` · `footer-extras.ts` | `cta_band` · `reviews_collection` · `logos_collection` · `site_rating` · `footer_extras` | Shared (every page) |
| `case-study-chrome.ts` · `article-chrome.ts` | `case_study_chrome` · `article_chrome` | Case study and article pages |

One file per distinct design section: the sections are not interchangeable (each has its own markup), so there is no generic "hero" or "image + text" type; where the audit found the same section on several pages (the reviews carousel, the logo band) it is one type used by several templates.

**`MediaReference`** (`primitives.ts`): `{ id, alt }`. A picture or video from the media library, never a URL. `id` is the library row; `alt` is the description on this page (empty: use the file's own description, or none for decoration). Wherever a schema below says "media" it is a `MediaReference`, and where the picture is optional the field is `MediaReference | null`.

Things that are **never** content, in any schema: decorative drawings, animation hooks (`reveal`, stagger indexes), 3D/mesh/stars, aria wiring, section ids, class names, generated numbers ("01", "Step #2"), the arrows and the icons bound to a position. They stay in the components.

### Home

| Type | Fields |
|---|---|
| `home_hero` | `eyebrow` (text 40) · `title` (rich 110) · `primaryCta` {label 24, href} · `secondaryCta` {label 24, href} or `null` · `sceneLabel` (opt 200: screen-reader description of the scene) |
| `logo_marquee` | `label` (opt 30). The names are the shared logo list. |
| `showreel` | `video` (media, an MP4) · `poster` (media, an image) · `tag` (opt 24) · `time` (opt 8, a label, not tied to the video length) |
| `why_stats` | `label` (24) · `title` (rich 80) · `items` [3–8] {label 48, href} · `stats` [exactly 4] {value (rich 24, e.g. `9<em>+</em>`), label 28} |
| `services_columns` | `label` · `title` (rich 60) · `lead` (160) · `columns` [exactly 3] {title 24, links [4–7] {label 28, href}} · `bookBar` {avatar (media or null), name 40, role 60, text 140, cta {label 24, href}} |
| `case_showcase` | `label` · `title` (rich 40) · `caseIds` [2–6 case studies, no repeats, in order] · `allLabel` (24). Each panel's own words come from the case study's "showcase" fields. |
| `industries_grid` | `label` · `title` (rich 60) · `lead` (220) · `items` [exactly 4] {title 24, text 140} |
| `process_steps` | `label` · `title` (rich 48) · `lead` (160) · `facts` [2–4] (32) · `cta` {label, href} · `steps` [3–6] {label 16, title (rich 48), text 170, outputs [2–4] (24), when 14} |
| `reviews_carousel` | `label` (24) · `title` (rich 80). Reviews and rating line are shared. |

### About

| Type | Fields |
|---|---|
| `about_hero` | `label` (30) · `title` (rich 90, a newline is a line break, at most 3 lines) · `lead` (220) · `facts` [0–5] (24) |
| `case_mosaic` | `caseIds` [3–8, no repeats]. Name, kind, picture and link come from each case study; the renderer repeats the list to fill the loop. |
| `principles_list` | `label` (opt 30) · `title` (rich 60) · `lead` (opt 120) · `items` [3–6] {title 40, text 140} (numbers generated) |
| `mission_vision` | `mission`, `vision`: each {tag (opt 30), title 16, text 260}. The pair is fixed. |
| `timeline` | `label` (opt) · `title` (rich 100) · `items` [exactly 5] {year 4, title 36, text 150} |
| `manifesto` | `label` (30) · `text` (rich 420; the words light up as you scroll) |
| `office_clocks` | `label` (opt) · `title` (rich 60) · `lead` (opt 240) · `items` [2–8] {timeZone (a real IANA zone), city 20, country 24, flag (one of the flags drawn in code: `PT` `CA` `SG` `AU`)} |
| `faq_accordion` | `label` (opt) · `title` (rich 60) · `lead` (opt 120) · `cta` {label 24, href (empty = e-mail us)} or `null` · `items` [3–10] {question 80, answer 320} |
| `open_roles` | `label` (opt) · `title` (rich 40) · `items` [0–10] {title 48, meta 40, subject 80 (the e-mail subject)} |

### Works, Blog

| Type | Fields |
|---|---|
| `works_hero` | `label` (opt 24) · `title` (rich 60) · `lead` (220) · `allLabel` (16) · `chipLabels` {`brand`, `product`, `web`, `packaging`, `motion`: each 16}. The keys join to the case studies' filters; only the labels are editable. |
| `works_grid` | `emptyText` (80). The cards are every published case study. |
| `blog_hero` | `label` (opt 24) · `title` (rich 70) · `lead` (opt 140) · `allLabel` (16). The chips are the blog categories. |
| `blog_featured` | `linkLabel` (24). The article is chosen on the article. |
| `blog_grid` | `emptyText` (80) |

### Contact

| Type | Fields |
|---|---|
| `contact_intro` | `label` (24) · `title` (rich 70) · `who` {avatar (media or null), name 40, role 80} or `null` · `direct` [1–3] {label (opt 24), text 60, mailSubject (opt 80)} · `facts` [0–4] (40). `{email}` in a text is replaced by the site's contact e-mail (Settings → Contact). |
| `contact_form` | `name`, `email`, `company`, `message`: each {label 40, placeholder (opt)} · `needLegend`, `budgetLegend` · `needOptions`, `budgetOptions` [3–7, no repeats (case-insensitive)] (30) · `submitLabel` · `note` (200) · `success` (200) · `error` (200, `{email}` allowed). The field names, rules and what is sent are fixed in code. |

### Shared, and labels around records

| Type | Fields |
|---|---|
| `cta_band` | `title` (rich 60) · `lead` (opt 160) · `primary` {label 24, href (empty = mail the contact address)} · `avatars` [exactly 3 media] · `floaters` [exactly 4 media] |
| `reviews_collection` | `items` [3–10] {avatar (media or null), company 24, dot (a `#rrggbb` colour or empty), quote 140, name 28, role 44, city 24} |
| `logos_collection` | `items` [6–14] {text 24, style (`plain` `caps` `serif` `mono`), dot (yes/no)} |
| `site_rating` | `score` (4, "5.0") · `text` (40, "60+ reviews on Clutch"). The stars are fixed. |
| `footer_extras` | `newsletterText` (120) · `newsletterPlaceholder` (40) · `badges` {`clutch`, `dribbble`, `awwwards`, `webflow`, `goodfirms`, `behance`: each {line1 24, line2 24}} · `legal` [0–4] {label 24, href} · `copyright` (60). The badge marks are the brands' own and fixed. |
| `case_study_chrome` | `breadcrumbRoot` (16) · `allProjectsLabel` (24) |
| `article_chrome` | `breadcrumbRoot` (16) · `tocLabel` (24) · `shareLabel` (16) · `relatedLabel` (24) · `relatedTitle` (rich 40) · `relatedAllLabel` (24) |

### Current copy as defaults

`src/lib/cms/defaults.ts` holds the current website copy for all 35 sections, typed key by key against the schemas (`PageContent<template>`: the compiler rejects a missing, extra or wrong field). It is (1) what the seed step writes into `page_sections`, (2) the content a section falls back to (section 11), and (3) the proof that the schemas accept the real site: `verify-pages.mjs` validates every default. Text came from the live site: Home and About lists from the seeded settings, the rest from the components.

## 6. Relationships

| From | To | Rule |
|---|---|---|
| `pages.template` | `page_templates` | A page has exactly one known template; one page per template. |
| `page_sections.page_id` | `pages` | `ON DELETE CASCADE`: deleting a page deletes its sections. |
| `page_sections.section_type` | `page_section_types` | A section has a known type. |
| `page_section_refs.section_id` | `page_sections` | `ON DELETE CASCADE`. |
| `page_section_refs.media_id` | `media` | `ON DELETE RESTRICT`: a file in use cannot be deleted. |
| `page_section_refs.case_study_id` | `case_studies` | `ON DELETE RESTRICT`: a case study in use cannot be deleted. |
| `pages.og_image_id` | `media` | `ON DELETE RESTRICT`. |

Dynamic relationships that are **not** stored in sections (the section stores only the choice, never a copy):

- Case studies: `case_showcase`, `case_mosaic` store case study ids. Name, kind, tags, picture, alt text and link come from the case study.
- The Works grid, the Blog grid and the featured article come from `case_studies` and `blog_posts` (and their order, featured flag and status).
- Reviews and logos: one shared list each (`shared.reviews`, `shared.logos`) feeds Home, Works and every service page. The rating line (`shared.rating`) feeds the same places and the service hero badge.
- Site facts: the contact e-mail, the site name and the logos come from Settings.
- Menus come from Navigation.

## 7. What stays outside the section CMS

Already section- or field-level editable, and left as they are: service pages (`services`: hero, overview, outcomes, included, process, cases, optional "What we fix" and CTA band), case studies (`case_studies`: hero, facts, gallery, process, challenges, results, more work, showcase card), articles (`blog_posts`: lead, blocks, outro, related), navigation (`navigation_items`), site settings, and form handling. Page CMS covers the **copy around** these records (the template-level pages above) and the pages that were hardcoded.

Not modelled, because the original design has no such page: a not-found page, legal pages (the footer's Privacy / Cookie / Terms links point to `#` today), a careers page, a services index (it redirects to `/#services`). They are listed as open items in section 13.

## 8. Media references

- A field that holds a picture or video is a `MediaReference` (`{ id, alt }`): the **media id** (`media_...`), never a URL. The URL, size, type and focal point come from the `media` row at render time, so replacing a file in the library updates every page that uses it. `alt` is the description on this page; **empty means decorative** (`alt=""`), which is what the design has for almost every picture today (the case study cards keep their alt text on the case study).
- Which fields hold media ids is declared per type in the registry (`SECTION_TYPES[type].media`, e.g. `items.*.avatar.id`, `bookBar.avatar.id`, `avatars.*.id`), each with the kind of file it needs (the showreel `video.id` must be `video/mp4`, the others images). `*` means "every item".
- When a section is saved, `checkSection()` returns the references it found; the save writes them to `page_section_refs` **in the same batch** as the section. The JSON stays the only place a value is edited; `page_section_refs` is an index of it.
- What the index buys: (1) the database refuses to delete a file or a case study that a section uses (`RESTRICT`), the same rule the other tables follow; (2) "where is this used?" is one query (`SELECT ... FROM page_section_refs WHERE media_id = ?`) for the media library; (3) a reference to a row that does not exist is rejected by the foreign key.
- Case studies are referenced the same way (`cases` paths, `caseIds.*`).
- On save the server checks every reference against the library: the file exists and is the right kind (an image field refuses a video and the other way round), the case study exists. The error is reported on the field path (`bookBar.avatar.id`).
- Fixed art (the hands, the orb, the mesh) is code, not media; it is not editable.

### The media library in the section editor

Every picture field of a section (`mediaRef`) is the library's `MediaField` with details on (`src/components/admin/MediaPicker.tsx`):

| Need | How |
|---|---|
| Select existing | **Change** / **Choose image** opens the **library modal** on the existing media API (`/api/admin/media`). Each card shows the **thumbnail, title, file name, dimensions, file size and description (alt)**. |
| Search and filter | A search box (title, description, file name), a **Source** filter (all / uploaded / shipped with the site) and a **Shape** filter (landscape / portrait / square), with a count of matching files and *Load more*. |
| Upload new | **Upload new** opens the modal on its **Upload** tab (drag and drop or choose files; JPEG, PNG, WebP, GIF, AVIF, up to 10 MB). The Worker checks the file and writes it to **R2**; D1 keeps only the details. The new file is chosen at once. |
| Replace | **Replace file** (for uploaded pictures) sends a new file to `/api/admin/media/<id>/replace`: the library entry keeps its id, so every page that uses it follows. It asks for confirmation first, because it changes every use. Pictures shipped with the site cannot be replaced here. |
| Remove | **Remove** empties the field (an optional picture becomes `null`; a required one is refused on save with its message). |
| Alt text | The field's own **description** is stored with the reference (`alt`; empty means decoration). The library's description is shown and **Use as description here** copies it across. |
| Caption | None of the sections has a caption (the page sections show pictures without one). Captions exist where the design has them: on case study gallery images, in the case study editor. |
| Videos | A video field opens the same modal on the videos only (no upload tab: videos are added by the site's developer). |

A section stores **only the media id and the description**, never a URL or file data (`{ "id": "media_...", "alt": "" }`); the file bytes live in R2 and their details in `media`. When a page is drawn the reference is resolved by `mediaUrls()` to the library's address through `publicMediaUrl()`: the Cloudflare **media domain** (`MEDIA_BASE_URL`) when one is configured, otherwise the site's own `/media/...` path, with Cloudflare-resized copies when `IMAGE_TRANSFORMS` is on. The components that draw these pictures are unchanged and their CSS fixes the size and `object-fit` (`img.avatar`, `.floater img`, the showreel video), so a picture of any shape is drawn in the same box as before. The media library's "used in" list and its delete check include page sections (for example "Page: Home / Services"), and the foreign keys on `page_section_refs` refuse to delete a file a section uses.
- Deleting a media file or a case study that is in use will now fail with a foreign key error. The admin screens that delete them must show a friendly "still used on: Home, About" message built from `page_section_refs` (implementation step).

## 9. Seeding

Migration `0016` creates structure and the two lookup lists only. `db/seed/pages.sql` (generated by `npm run db:seed:pages:generate` from `PAGE_DEFAULTS`, every section passing `checkSection()` first) writes the 9 `pages`, 35 `page_sections` and 24 `page_section_refs`. The statements are `INSERT OR IGNORE`: running the file again never overwrites a section an editor has saved, and it adds any section that is missing. Apply it with `npm run db:seed:pages:local` (or `:preview`, `:remote`). It needs `db/seed/content.sql` first (the media and case studies the references point at). Page SEO fields are left NULL: the existing Settings → SEO "page metadata" still supplies them (section 10).

## 10. SEO model

Page level (pages with a route): `seo_title`, `seo_description`, `og_image_id`, `canonical_url`, `noindex`, `nofollow` (migration `0018`). Index and follow are independent: the robots tag is `index/noindex` plus `follow/nofollow`. A page that is `noindex` and has no own `nofollow` value still gets `nofollow`, as before; the site-wide indexing switch in Settings forces both off.

Resolution for a page, first match wins:

| Value | 1 | 2 | 3 |
|---|---|---|---|
| Title | `pages.seo_title` | Settings → SEO page metadata (`seo.pages.<page>.title`) | the site default title |
| Description | `pages.seo_description` | `seo.pages.<page>.description` | the site default description |
| Share picture | `pages.og_image_id` | the page's derived picture (for example the first case study on Works, the featured article on Blog) | the site default share picture |
| Canonical | `pages.canonical_url` | the page's own address (template route on the site URL) | |
| Robots | `pages.noindex` or the global indexing switch off | | |

The seed copies the current Settings values into `pages`, after which the Settings → SEO "page metadata" block for these pages is replaced by the page editor (the site-wide defaults, robots rules and sitemap switches stay in Settings). JSON-LD stays derived from these fields as today (`fixedPageSeo()`); it is not editable.

Detail pages keep the SEO fields they already have on their own records (`services.meta_*`, `case_studies.meta_*`, `blog_posts.meta_*`, canonical and share picture on articles). The template-level pages have no SEO (`hasSeo: false`). Gaps found in the audit and left for a later step: no per-service or per-case share-picture or canonical override.

## 11. Rendering strategy

1. **Load.** A public page asks for its page by template (`getPage("home")`): one query for the page, one for its sections (`ORDER BY position`), one for the references' media rows and case studies. The shared page and the template-level pages are loaded the same way where needed. Per request, cached (React `cache`); across requests, covered by the existing edge cache, which is keyed on `content_version`.
2. **Check.** Each section's `content` is parsed against its schema (`SECTION_TYPES[type].schema`). A section that is missing, or fails, is replaced by its default (`PAGE_DEFAULTS`) and the problem is logged; the page still renders.
3. **Compose.** The page component walks the template's sections in order and renders each with the component for its type, skipping sections with `is_enabled = 0`. Section order and presence are fixed by the template; the page file lists them, exactly as today.
4. **Render.** Components keep their current markup, classes, ids and animation hooks. Literal strings become props. Rendering rules that are code, not content:
   - rich text goes through the existing restricted renderer (`<em>`, `<b>`); a newline in a title becomes `<br>`; no-break wrappers (`.nb`, `.keep`) are applied by the renderer around the phrase and its punctuation;
   - generated values stay generated: "01"/"02" numbers, "Step #n", counts on filter chips, `--i` stagger indexes, clock status;
   - media ids become URLs, sizes and responsive variants through the existing image helpers;
   - `{email}` is replaced with the contact e-mail from Settings; an empty CTA link falls back to `mailto:` of that e-mail;
   - a list the layout needs repeated (the mosaic marquee, the logo marquee) is repeated by the renderer, not by the editor.
5. **Disabled sections.** A disabled section is not rendered. Links that point to its anchor would dangle, which is why only sections whose anchors nothing else uses are marked `canDisable`; the admin shows which links point to a section's anchor before it is switched off.
6. **Freshness.** Saving a section writes an audit entry; the existing audit hook bumps `app_meta.content_version`, which refreshes cached pages on the next visit.

Switching a public page to read from here is done page by page, behind byte-for-byte comparison of the rendered markup against today's output (the method used for the Navigation change).

### Section type to component (the controlled mapping)

There is no generic section renderer. Each page file lists its sections in the template's order and hands each one's content, as props, to the component that always drew it. Where the design draws several sections inside one wrapper (a "Run"), one component takes all of them.

| Section type(s) | Component | Page file |
|---|---|---|
| `home_hero` | `HomeHero` | `src/app/(site)/page.tsx` |
| `logo_marquee`, `showreel`, `why_stats` | `HomeIntroRun` | same |
| `services_columns` | `HomeServices` | same |
| `case_showcase`, `industries_grid`, `process_steps` | `HomeWorkRun` (case panels are `CasePanel`, from the case studies) | same |
| `reviews_carousel` | `HomeReviews` (Home), `ReviewsSection` (Works, service pages) | same, Works, service page |
| `about_hero`, `case_mosaic` | `AboutHeroRun` | `src/app/(site)/about/page.tsx` |
| `principles_list` · `mission_vision` · `timeline` · `manifesto` · `office_clocks` | `AboutPrinciples` · `AboutMission` · `AboutStory` · `AboutManifesto` · `AboutPlaces` | same |
| `faq_accordion`, `open_roles` | `AboutFaqRun` | same |
| `works_hero`, `works_grid`, `reviews_carousel` | `WorksPage` (with `WorksGrid`) | `src/app/(site)/works/page.tsx` |
| `blog_hero`, `blog_featured`, `blog_grid` | `BlogListing` (with `BlogGrid`) | `src/app/(site)/blog/page.tsx` |
| `contact_intro`, `contact_form` | `ContactSection`, `ContactForm` | `src/app/(site)/contact/page.tsx` |
| `logo_marquee`, `reviews_carousel` (`service_detail`) | `ServicePage`, `ServiceReviews` | `src/app/(site)/services/[slug]/page.tsx` |
| `case_study_chrome` | `CaseStudyPage` | `src/app/(site)/works/[slug]/page.tsx` |
| `article_chrome` | `BlogArticle`, `ArticleToc`, `ShareRail` | `src/app/(site)/blog/[slug]/page.tsx` |
| `cta_band`, `footer_extras` | `CtaBand`, `Footer` (through `SharedContentProvider`, from the layout) | `src/app/(site)/layout.tsx` |
| `reviews_collection`, `logos_collection`, `site_rating` | read by `getReviewSeeds()`, `getLogoSeeds()`, `getRating()` and passed to the carousels, marquees and rating lines | `src/lib/server/cms-pages.ts` |

The loader is `src/lib/server/cms-pages.ts` (`getPage(template)`, `getMediaIndex()`, `getCaseCards()`, `getCaseTiles()`, `getSharedContent()`). A page that has no seeded rows, or whose database cannot be read, is drawn from the built-in defaults.

Notes from the migration (what the markup needed that the content could not carry): a hero title's emphasised phrase keeps its trailing punctuation on the same line (`Rich glue`); the first words of the Home services heading are wrapped in `.keep`; a newline in a title becomes `<br />`; the manifesto's words are split by `ScrollWords`, so its text is handed over as plain strings and `<em>` elements; the mosaic strip repeats its projects to an even number of tiles; the contact form's option lists are read from the CMS by the server that checks a message; flags, section drawings, icons and animation hooks stay in the components.

## 11b. The Pages admin

`/admin/pages` (sidebar: Content → Pages, after Media). Every screen is server-rendered and guarded by `requireAdmin()`; every write goes through the server actions in `src/actions/cms-pages.ts`.

| Screen | What it does |
|---|---|
| `/admin/pages` | The list: **Page, Route, Status, Last updated, SEO, Sections** for Home, About, Services, Works, Blog and Contact (in that order), each with **Edit Content**, **Edit SEO** and **Preview**. SEO is *Custom* (own title, description or picture), *Default* (Settings → SEO) or *Hidden from search*. Detail pages (services, case studies, articles) are not listed: they are edited under their own menus. `/services` is a redirect to the Services section of Home, so its row opens that section and its SEO is Home's. Below, a second table lists the content used on several pages (shared copy; the labels on service, case study and article pages). |
| `/admin/pages/<page>` (the slug `home`, or the id `page_home`; `home`, `about`, `works`, `blog`, `contact`, `shared`, `service-detail`, `case-study-detail`, `article-detail`) | **Edit Content** opens this screen: **one card per section, in the order the sections appear on the public page**. Each card shows the section's **name** ("Trusted by", "Where we work"), its **type** ("Trusted-by logos band"), its **enabled / disabled** status, **when it was last updated**, and an **Edit** button. A switch turns a section off and on where the registry allows it (a toast says what happened; the content is kept); the sections other pages link to say "always". For pages with an address, **Edit SEO** opens the dedicated SEO editor and **Preview** opens the public page. |
| `/admin/pages/<page>/seo` | The **SEO editor** of one page (only templates with an address). Fields: SEO title, SEO description, Canonical URL, Open Graph image (media library) and two robots choices, Index / Noindex and Follow / Nofollow. The SEO title is separate from the page's headline, which stays the Hero section's headline. Character guidance: title good at 30-60, hard limit 70; description good at 70-160, hard limit 200 (`src/lib/cms/seo-guidance.ts`); the counter changes colour and says what to do. A live search-result preview and share card show the typed or default values. Saving uses a version token (a conflict changes nothing), is audited and revalidates the public route. The values go only into the page head (title, description, canonical, robots, Open Graph, Twitter, JSON-LD); no page draws them as visible text. |
| `/admin/pages/<page>/<section>` | The section's editor (below). |

### The section editor is generated from the schema

`src/lib/cms/describe.ts` builds each editor form from the section's strict Zod schema. Nothing about a form is written by hand and there is no generic "any field" form: the fields, their order, the control for each one and its limits are read from the schema (`sections/*.ts`) and the small metadata its blocks carry (`primitives.ts`: `.meta({ kind, label, noun, ... })`).

| In the schema | In the form |
|---|---|
| `text(label, max)` / `optText` | Text input, or a text area for long limits; a counter against `max`; "optional" when the schema allows an empty value |
| `rich(label, max)` / `richLines` | **Rich text editor**: a text area with *Emphasis* and *Bold* buttons that wrap the selection in `<em>` / `<b>`, *Clear formatting*, and a live preview of what the website will show. Only those two tags are accepted by the server. A newline is a line break where the schema says so. |
| `href` / `hrefOpt` | URL input (path, anchor, `https://` or `mailto:`); may be empty only where the schema says so |
| `mediaRef(label, "image" \| "video")` | **Media picker** (the media library, with upload) for images, a video list for videos, and a description (alt) field; `.nullable()` makes the picture optional (a Remove button) |
| `group(label, shape)` | A box around the fields; `.nullable()` adds a "Show this part" **toggle** (stored as `null` when off) |
| `list(item, label, min, max, noun)` / `fixedList` | **Repeater**: add, remove, move up and down, with the schema's minimum and maximum; `fixedList` (a count the layout fixes) has no Add or Remove |
| `caseIds(label, min, max)` | Ordered case study picker |
| `choice(label, values, words)` | Select with the words for each value |
| `toggle(label, text)` | Switch |
| `timeZone`, `hexColour` | Time zone input, colour input |

Limits are not copied: the maximum length, the number of items and optionality shown in a form are read from the schema's own checks, and `verify-pages.mjs` proves it (a text of exactly the form's limit passes the schema, one more is refused) and that the generated form fits the current content of every section (no field missing, none extra, counts and shapes right).

**Save, Cancel, previous versions.** *Save section* sends the whole section to the `saveSection` action; *Cancel changes* puts back what is stored. Under the form, **Previous versions** lists the earlier saved versions (`page_section_revisions`, migration 0017: each save keeps the content it replaces, the last 10 are kept, saving identical content or a refused save adds none). *Load into the editor* puts a version in the form; saving it makes it live again, so restoring is an ordinary, audited save. A version that no longer fits the section's schema is listed but cannot be loaded.

**What a save does**, in order, all on the server: same-origin check and admin role (read from the database), the strict Zod check of the whole section, a check that every picture and case study exists and is the right kind, a refusal if someone else saved the section since the editor opened it (version token), then one atomic batch that stores the previous version, writes the content, the new `updated_at` and the editor, and rewrites the section's references; then an **audit log** entry (the section and the names of the fields that changed, never their values), which also bumps the content version that refreshes the Worker's cached public pages; then `revalidatePath()` for the affected public routes (the page's route; every page for shared copy; the detail routes for the template-level copy).

The page search settings are read by the public pages (`fixedPageSeo()` in `src/lib/server/seo.ts`): the page's own value, then Settings → SEO → Page metadata, then the site default.

## 12. Validation strategy

Four layers, each catching what the one before cannot:

1. **Schema (code).** `checkSection(template, key, content)` in `src/lib/cms/registry.ts` runs the strict schema of the section's type. It rejects: a section the template does not have; any key the schema does not name (including at the top level); text over its limit; `<` `>` in plain text; unbalanced or other tags in rich text; unsafe links (`javascript:`, `//host`, `data:`); the wrong number of items (the layout's count, e.g. exactly 4 stats, 3–6 steps); repeated case studies or options; an unknown time zone or flag; invalid colours. Errors come back keyed by field path (`items.2.title`) so the admin can mark the field. There is no `any` and no open `Record` in any schema.
2. **References and the write (server).** `saveSectionContent(db, ...)` in `src/lib/cms/store.ts` is the only way content is written. After the schema it checks that every media id and case study id exists and that each file is the kind the field needs, then writes the section and its `page_section_refs` rows in one `db.batch` guarded by the version the editor loaded: the `UPDATE` only matches `updated_at = expectedUpdatedAt`, and the reference rows are written only if that update happened (they check the new `updated_at` token), so two saves at the same moment cannot half-apply. Results are `ok`, `invalid` (with field errors), `conflict` or `missing`. The same module has `setSectionEnabled()` (refuses sections that are not `canDisable`), `savePageSeo()` (its own strict schema, `page-seo.ts`: title ≤ 70, description empty or 20–200, `https://` or `/path` canonical, image from the library; empty text stored as NULL) and `loadPage()` (read with fallback, section 11).
3. **Database.** `CHECK` constraints on JSON validity and object type, slug and key shape, status, `0/1` flags; foreign keys to the lookup lists; unique page per template and section per page key. `verify-pages.mjs` exercises each.
4. **Read time.** Content is parsed again when read (section 11); a failure falls back to the default.

The server actions (`src/actions/cms-pages.ts`: `saveSection`, `toggleSection`, `savePageSeoAction`) add the request-level rules: same-origin check and admin role read from the database on every call (the same guard as the other admin actions), JSON that cannot be parsed is refused, and an audit entry naming the page, the section and the **names** of the fields that changed (never their values). The audit entry also bumps the content version, so cached pages refresh. No screen calls the actions yet.

Coupled lists: the contact form's option lists live only in `contact_form` content; the server that checks a contact message reads the same lists (cached by content version) instead of keeping a second copy in code. The works filter keys are fixed in code and in `works_hero.chipLabels`; adding a discipline is a code change.

## 13. Decisions and open items

Decisions made here, where the audit left a choice:

- **CTA band avatars: exactly 3**, floating pictures exactly 4 (the shared-chrome audit says the layout fixes 3 and 4; the Home audit said 2–4).
- **Careers cannot be disabled** (the header/footer link to `#careers`); the FAQ and the others without anchors elsewhere can.
- **Home "Services" links** have an `href` per link (default `#contact`, as today); linking them to service pages is an editor choice, not a code change.
- **Per-case Home panels** (tags, quote, reviewer) stay on the case study ("showcase"); the Home section chooses which cases and in what order.
- **Flags** are a fixed list drawn in code (`PT` `CA` `SG` `AU`); a new office country needs its flag drawn and added.
- **Review dot, logo style** are enumerated, not free CSS.
- The About hero title keeps its two line breaks as newlines in the content (the seeded settings had lost them).

Open items, none blocking:

1. Whether to add pages the design lacks (not-found, legal pages, a careers page): each would be a new template and section type, designed first.
2. The footer newsletter form has no backend; only its text is covered here.
3. Contact phone, address and hours exist in Settings but have no slot in the design; adding one is a design change.
4. Content debt found in the audit, to correct while seeding: case-study card alt texts mention "placeholder from Dribbble"; the Orbit gallery has a test third image; Kite shows one "More work" card.
5. Whether Home's own copy of the reviews should be removed in favour of the shared list when Home is switched over (the plan says yes).
6. Revision history for sections (restore a previous version): not part of this model; a `page_section_revisions` table can be added without changing it.

## 14. Rollout

1. **Foundation (this change):** migration `0016`, schemas, registry, types, defaults, checks, this document. No page reads it.
2. **Seed and read layer (done):** the seed (`db/seed/pages.sql`), the read layer (`loadPage()` with the fallback) and the guarded write layer (`saveSectionContent()`, `setSectionEnabled()`, `savePageSeo()` and their server actions) exist and are tested.
3. **Switch pages one at a time (done for every public page):** shared (CTA, reviews, logos, rating, footer) → About → Home → Works, Blog, Contact → template-level copy. After each, compare rendered markup with the previous output.
4. **Admin (done):** the Pages screens (section 11b): page list, page overview with show/hide and search settings, one editor per section type driven by `fields.ts`, Save/Cancel per section.
5. **Retire the duplicates:** Home's inline reviews and logos, the `home.*`/`about.*`/`site.*` settings rows nobody reads, `src/content/reviews.ts` and `logos.ts` as runtime sources (kept as seed sources), the SEO page-metadata block in Settings.

## 15. Verification

`npm run db:verify:pages` (135 checks): the migration applies in order; the lookup tables equal the registry; section keys and anchors are unique; every type is used and every section has a default; **all 35 defaults (the real copy) pass their schemas**; every declared media/case path finds a reference; pages, sections and references store and read back; one section changes alone; the database refuses unknown types, bad JSON, non-objects, duplicate keys, a second page per template, bad slugs, bad status, bad canonical, missing references, a file or case study in use being deleted; cascades work; the schemas refuse the wrong counts, unknown keys, markup, unsafe links, bad time zones and flags, repeated options, and accept optional parts as `null` or empty. The store is tested through a D1-shaped adapter on SQLite: a page that is not seeded is drawn from the defaults; a missing, damaged or wrongly typed row is replaced by its default and reported; a valid save writes the content, version, time, editor and rewrites the references; one save leaves the page and the other sections untouched; a save from an old version, and a save that loses a race at the same moment, are conflicts that change nothing; invalid content, unknown fields, missing or wrong-kind media and unknown case studies are refused with their field path; sections can be hidden only where allowed; page SEO accepts and clears values and refuses bad ones. `npm run db:verify` (229 checks) still passes with the new tables.
