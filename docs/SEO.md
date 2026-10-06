# SEO system

Everything here is invisible to visitors: `<title>`/`<meta>`/`<link>` tags and `<script type="application/ld+json">` blocks. No visible markup was added; the pixel comparison of every public page is unchanged.

## Where the code lives

| File | Job |
|---|---|
| `src/lib/seo/metadata.ts` | Pure. `pageMetadata()` builds the Next `Metadata` object (title, description, canonical, robots, Open Graph, Twitter). Helpers `plain`, `clip`, `twitterHandle`, `absoluteUrl`. |
| `src/lib/seo/jsonld.ts` | Pure. Builders for Organization, WebSite, BreadcrumbList, Service, Article/BlogPosting, CollectionPage, AboutPage/ContactPage. `jsonLdScript()` serialises (escapes `<` and U+2028/2029 so text can never close the script tag). |
| `src/lib/server/seo.ts` | Reads D1 (site settings, media sizes) and returns `{ metadata, jsonLd }` for `fixedPageSeo(page)`, `serviceSeo`, `caseStudySeo`, `blogPostSeo`. |
| `src/components/site/JsonLd.tsx` | Renders the script tag for a list of nodes. |
| `src/app/sitemap.ts`, `src/app/robots.ts` | `/sitemap.xml`, `/robots.txt`, both generated from D1. |

Each public route has `generateMetadata()` (calls the helper's `.metadata`) and renders `<JsonLd nodes={seo.jsonLd} />` from the same helper.

## What each page emits

| Page | Title / description from | Image | JSON-LD |
|---|---|---|---|
| Home | Settings → SEO → Page metadata (Home) | default share image | WebSite (+ Organization from layout) |
| About | Page metadata (About) | default | AboutPage, BreadcrumbList |
| Works | Page metadata (Works) | default | CollectionPage (all case studies), BreadcrumbList |
| Blog | Page metadata (Blog) | default | CollectionPage (live articles), BreadcrumbList |
| Contact | Page metadata (Contact) | default | ContactPage, BreadcrumbList |
| Service | the service row (`meta_title`, `meta_description`) | hero image | Service (offer catalog from "included"), BreadcrumbList |
| Case study | the case study row | cover image | Article, BreadcrumbList (Home › Works › Case) |
| Article | the article row (SEO title/description, canonical URL, OG image) | OG image, else cover | BlogPosting (author Person, section, keywords), BreadcrumbList (Home › Blog › Article) |

Every page also gets: one absolute canonical, Open Graph (`title`, `description`, `url`, `site_name`, `locale`, `type`, `image` + `alt`, width/height when the media record knows them; articles add published/modified time and author), a Twitter card (`summary_large_image`, `twitter:site` from the X profile in Settings → Social), and one robots tag.

The Organization node is on every page (from the site layout) with a stable `@id`; other nodes refer to it by `@id`. JSON-LD is emitted as one `@graph` per block.

## Rules

- **Facts only.** Empty values are dropped from JSON-LD; nothing is invented.
- **Canonical** is the record's own canonical URL if set (articles), else the page address built from the `SITE_URL` setting. Home canonical has no trailing slash.
- **Image fallback:** page image → Settings → SEO default image → none.
- **Indexing off** (Settings → SEO): every page `noindex, nofollow`, sitemap empty, `robots.txt` has `Disallow: /`.
- **Page hidden** (Page metadata → "Hide from search engines"): that page `noindex, nofollow`, removed from the sitemap.
- **Previews** (admin viewing a draft/archived service, case study or article): `noindex`, no structured data. Anonymous visitors get a 404 for those.
- **Taken offline / scheduled in the future:** 404, not in the sitemap.
- `/admin` is always disallowed in `robots.txt`.

## Sitemap

Home (priority 1), About (.6), Works (.8), Blog (.8), Contact (.7), plus every published service, case study and live article with `lastmod` from its row. Hidden pages are left out.

## Settings → SEO

Fields: default title, description, default share image, indexing switch, disallowed paths, sitemap line, and a **Page metadata** fieldset per fixed page (title 1–70 characters, description 20–200, hide-from-search). Stored in `settings.seo` (`pages.home|about|works|blog|contact`). Missing values fall back to the defaults in `src/lib/settings/schema.ts`, which are the texts the pages had before this feature.

## Tests

- `npm run db:verify` (203 checks): pure builders, escaping, `@graph`, page-metadata settings.
- E2E `seo-test.mjs` (41 checks, dev server): all 25 public pages' title/description/canonical/Open Graph/Twitter/robots, JSON-LD types and breadcrumbs (every address returns 200), sitemap and robots.txt, D1-driven changes (service/case/article records), previews, per-page and global noindex in the admin, site name propagation.

## Before going live

Set the real `SITE_URL` (canonicals, sitemap and JSON-LD use it), set a default share image in Settings → SEO, and fill the X profile if you want `twitter:site`. Validate a few pages with Google's Rich Results Test after deploy.
