# Blog management

Admin: `/admin/blog` (articles), `/admin/blog/categories`, `/admin/blog/tags`. Public: `/blog` and `/blog/<slug>`. Everything on the public pages comes from D1; the listing and article components, markup and styles are the ones from the static site.

```
BEFORE   src/content/blog.ts (typed seed data) ──▶ BlogListing / BlogArticle
AFTER    D1 (blog_posts, blog_categories, blog_tags, blog_post_tags, media)
           ──▶ cms.getBlogPosts() / getBlogPostBySlug()
           ──▶ content mapping layer (mapBlogPost)
           ──▶ the same BlogListing / BlogArticle (rendering blocks as React elements)
```

The 6 existing articles were imported by the seed (`db/seed/content.sql`): body blocks, lead, closing line, related articles, author and portrait, reading time, categories, dates. After the switch, `/blog` and the 6 article pages were compared with the original static HTML at 1440 and 390 px: **0 differing pixels** (20 of 20 captures, together with home, About and Contact). Saving every article unchanged in the editor changes nothing stored and nothing visible.

## Article content model (safe by construction)

An article is **data**, never HTML:

- `lead`: one paragraph of text.
- `body_json`: a list of typed blocks. `heading` (h2, in the table of contents), `subheading` (h3), `paragraph`, `list` (bullets or numbers), `quote` (+ source), `image` (a media file + description + caption), `divider`. The seeded articles use `heading` and `paragraph` only.
- Inline formatting inside paragraphs, list items, quotes and the lead is a tiny set: `**bold**`, `*italic*`, `` `code` ``, `[text](address)`, and `\` to show a mark literally. It is parsed into nodes (`src/lib/content/inline.ts`) and rendered as React elements by `InlineText`. **No HTML is stored, parsed or injected**: typed `<script>` or `<img onerror>` is shown as text (tested in a real browser: nothing ran).
- Link addresses must be a path (`/…`), an anchor (`#…`), `mailto:` or `https://`. Validation refuses anything else (`javascript:`, `http:`, `data:`); the renderer checks again and shows an unsafe link as its words only, so even a bad row written straight into the database cannot create a dangerous link (tested).
- Images come only from the media table (by id). A block whose file has gone is left out when rendering.
- JSON-LD is serialised with `<` escaped so it cannot close its script tag.

The Zod schema (`src/lib/validation/blog.ts`) is the single definition of what may be stored; the mapper (`src/lib/content/blog-mapper.ts`) converts rows ↔ page model ↔ form model.

New block elements need styles the original site did not have. They are added at the end of `src/styles/pages.css` under a "CMS additions" comment and only match elements the six original articles do not contain (`.prose h3, ul, ol, li, blockquote, .post-figure, code, strong, em`), so existing pages are untouched.

## Where each requested field lives

| Requested | Form field | Stored in |
|---|---|---|
| Title, slug | Title, Slug | `title`, `slug` (unique; renaming keeps the old address as a 308 redirect) |
| Category | Category | `category_id` (one per article) |
| Tags | Tags (chips, suggestions) | `blog_tags` + `blog_post_tags`; created on save, reused by slug |
| Featured image | Featured image + description | `cover_image_id`, `cover_alt` |
| Excerpt | Excerpt | `excerpt` (shown on the blog page when the article is the featured one; the SEO description is used if empty) |
| Rich article content | Opening paragraph + block editor | `lead`, `body_json` |
| Closing line | Text, link, text | `outro_json` |
| SEO title / description | SEO title, SEO description | `meta_title`, `meta_description` |
| Canonical URL | Canonical URL (https only) | `canonical_url` (migration `0011`) |
| Open Graph image | Open Graph image | `og_image_id` (migration `0011`; the featured image when empty) |
| Author | Author name + picture | `author_name`, `author_image_id` |
| Publish date | Publish date and time (UTC) | `published_at` |
| Featured | Featured checkbox / ★ | `featured` (one article at a time) |
| Related articles | More from the studio (up to 3) | `related_json` |
| Reading time | number, or counted from the text | `read_minutes` |

## Draft, published, scheduled

Status stays `draft` / `published` / `archived`. **Scheduled needs no extra state**: an article is *published* with a `published_at` in the future. Every public query uses `status = 'published' AND published_at <= now`, and the pages are rendered per request, so a scheduled article **appears by itself** (blog page, article page, sitemap) when its time passes, with no cron job and no cache to clear. The admin shows Draft, Scheduled (with the go-live time), Published and Archived, with counts.

- Set a future publish date on a draft and press **Schedule** (the button says Publish when the date is empty or past). Publishing checks the saved article with the same rules as the form.
- A live article cannot be given a future date through the form (it would silently take it offline); use Unpublish.
- Visitors never see drafts, scheduled or archived articles. A signed-in admin can open them at their normal address as a preview (marked `noindex`).

## Admin

- **Articles:** search (title, slug, author, excerpt, lead; `% _` are plain text), status tabs, category and tag filters, ★ featured toggle, thumbnails, Publish / Unpublish / Unschedule / Delete.
- **Editor:** sections for basics, featured image and excerpt, the article (block editor with Bold / Italic / Code / Link buttons and a text preview), closing line, related articles, SEO and sharing (with the 60 / 160 character guides), author, publish date and reading time. Not a generic form: the body is built from blocks that can be added, moved and removed.
- **Categories:** add, rename, change slug and status, reorder (the order of the filter chips), delete. A category that has articles cannot be hidden or deleted.
- **Tags:** list with counts, rename, delete (removes the tag from its articles; the articles stay).
- **Delete / unpublish a live article:** a confirmation page lists what links to it (recommendations in other articles, links inside articles, navigation, site content, case studies); when anything does, or a live article is deleted, the slug must be typed. The server checks this again. Renaming a slug rewrites the "More from the studio" lists of the other articles; deleting removes the slug from them.

## Metadata for every article

`generateMetadata` builds, from the database record: title, description, **canonical link** (the custom canonical URL, else the article's own address), Open Graph (`article` type, title, description, URL, site name, locale, image from the OG image or featured image with a description, published and modified time, author) and a Twitter large-image card; the tags are written as `<meta name="keywords">`. Previews of unpublished articles are `noindex`. Two JSON-LD blocks are added: `BlogPosting` (headline, description, absolute image, `datePublished`, `dateModified`, section, keywords, author, publisher, `mainEntityOfPage`) and a `BreadcrumbList` (Home / Blog / Article). The blog page's own metadata uses the featured article's image.

`/sitemap.xml` (built from D1 per request: fixed pages, published services and case studies, live articles) and `/robots.txt` (everything allowed except `/admin`, with the sitemap address) were added. Note: the framework used here (vinext) does not write `article:section` / `article:tag` Open Graph tags, so tags travel as `keywords` and JSON-LD.

## Security and audit

Every page and action calls `requireAdmin()` and checks the request origin (`AUTH.md`). Create, update (with old and new slug), publish, schedule, unpublish, delete, featured, and category and tag changes are written to `audit_logs`.

## Tests

`blog-test.mjs`, 82 checks against the real local D1: signed-out access to all six admin routes; complete metadata and JSON-LD on all 6 articles; list, tabs, search, category filter; saving each article unchanged (stored content and page identical); validation refusals (markup in the title, reserved slug, `javascript:` links, `http:` canonical, duplicate heading anchors, missing fields) with typed values kept; creating an article with every block type, tags, canonical and OG image; draft 404 and noindex preview; publish: every block renders as its element, inline marks become elements, typed HTML shows as text and nothing runs in a browser; custom canonical, OG image, keywords; `javascript:` link in the database rendered as text; featured (single); future date refused for a live article; scheduling (invisible, then live by itself when its time passes, sitemap included); slug rename (308, related lists follow); unpublish and delete confirmation with wrong slug refused by the server; categories (duplicate, reorder, in-use refused, empty deleted); tags (rename, delete); robots; audit; no horizontal scroll at 390 px; no console errors. `db:verify` now 108 / 108 (canonical https, OG image key, scheduled query). The service (56), case study (63), dashboard (30) and admin (28) suites pass as before.

## Not in this phase

Image upload (pickers list the media table), drag-and-drop block reordering (up/down buttons), revision history, per-author pages, tag pages on the public site, and RSS.
