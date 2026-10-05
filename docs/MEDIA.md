# Media management

Pictures are stored in **Cloudflare R2**; the database keeps only **metadata and the object reference**. Admins upload through the dashboard, pick pictures with a reusable **MediaPicker**, and public pages load uploaded pictures from the configured **media domain**. The public design, markup and image sizes are unchanged.

```
 admin browser ──multipart──▶ Worker (POST /api/admin/media) ──▶ checks ──▶ R2 bucket  (original bytes, key uploads/YYYY/MM/<uuid>.<ext>)
        (no storage credentials)         │                                      ▲
                                         └─▶ D1 media row: mime, bytes, width, height, alt, caption, r2_key, url, sha256 …
 visitor ◀── <img src="https://media.<domain>/uploads/…">   (R2 custom domain, MEDIA_BASE_URL)
 visitor ◀── <img src="/media/uploads/…">                    (fallback: the Worker reads R2 itself)
```

## Secrets never reach the browser

There are no storage credentials anywhere in the front end, and none in the repository. The Worker writes to R2 through the `MEDIA` **binding** (configured in `wrangler.jsonc`, authorised by Cloudflare, not by keys). The browser only talks to the Worker: it sends the file with its session cookie and receives public metadata (public URL, size, dimensions). Storage keys are never part of an API answer; the upload route also needs the admin session and a same-site request (CSRF check). Direct-to-R2 signed uploads were not used: files are small (10 MB), the Worker must inspect the bytes before anything is stored, and a binding needs no credentials.

## Upload and validation (server side, `src/lib/media/sniff.ts`, `src/lib/server/media.ts`)

The browser's checks (type, 10 MB) only answer sooner. The Worker decides, from the **bytes**, never from the file name or the type the browser claims:

| Check | Rule |
|---|---|
| File type | JPEG, PNG, WebP, GIF, AVIF, recognised by magic bytes. **SVG, HTML and anything else is refused** (SVG can carry script). A text file named `.png` is refused; a JPEG named `.html` is stored as `.jpg`. |
| Size | At most **10 MB** (`413`). An oversized request is refused from its `Content-Length` before it is read, and again on the bytes. |
| Dimensions | Read from the file's own header (PNG IHDR, JPEG SOF with EXIF rotation, GIF, WebP VP8/VP8L/VP8X, AVIF `ispe`). Longest side ≤ 12 000 px and ≤ 100 megapixels (a guard against decompression bombs); empty or damaged files are refused (`415`). |
| Duplicates | A SHA-256 fingerprint is stored; uploading the same bytes again reuses the existing entry instead of storing a second copy. |
| Abuse | Admin session required; at most 200 uploads per admin per hour (`429`). |

**Object keys** are unique and unguessable: `uploads/<year>/<month>/<random UUID>.<extension from the real type>`. The original file name is kept in the database for display only and is never part of a key. Objects are stored with `Cache-Control: public, max-age=31536000, immutable` (a key is never reused, so a cached copy is never stale) and a correct `Content-Type`.

## What is stored (table `media`, migration `0012`)

`id`, `slug`, `title`, `kind`, **`mime`**, `storage` (`r2` for uploads, `static` for files shipped with the site), **`url`** (`/media/<key>`; a path, so the domain can change without touching data), **`r2_key`**, **`width`**, **`height`**, **`bytes`** (file size), **`alt_text`**, **`caption`**, `original_name`, `sha256`, `uploaded_by`, **`created_at`**, `updated_at`. There is no BLOB column. The 28 existing pictures stay `static` rows; nothing about them changed.

## Media library (`/admin/media`)

Drag-and-drop or file-picker upload (several files, one result line each, with the server's reason for a refusal), a grid of cards (thumbnail, title, dimensions, size, uploaded/shipped), **search** (title, description, caption, original file name, type) and **filters** (type, uploaded vs shipped, "not used anywhere"), paging (24 per page), counts and total size. A file's page shows all metadata, edits **title, alt text and caption**, copies the public address, lists **where it is used** (services, case studies, blog articles), and offers **Replace** and **Delete**.

- **Replace:** uploads a new picture for an existing entry. The entry keeps its id, so every page that uses it follows; the new file gets a new key (caches and the media domain can never serve the old picture under the new address) and the old object is deleted afterwards. An invalid replacement changes nothing. Replacing a file that ships with the website turns that entry into an R2 upload (the project's original file is untouched).
- **Delete:** only for uploads, and only when nothing uses them (content references are checked, and the database foreign keys refuse it anyway). Files shipped with the website cannot be deleted here. The row is removed first, then the object, so a failure never leaves a row pointing at nothing.

## MediaPicker (`src/components/admin/MediaPicker.tsx`)

`<MediaPicker open onClose onSelect />` is a dialog (library with search and "load more", plus an **Upload** tab that uploads and selects in one step). `<MediaField name value known optional onChange? />` is the form field built on it: thumbnail, title, Choose / Change / Remove, and the chosen id submitted under `name`. The dialog is rendered into `<body>`, so Enter in its search box can never submit the surrounding form. It is used everywhere a picture is chosen: service hero images, case study card, hero, wide and **gallery** images, blog featured image, **Open Graph image**, **author picture** and **image blocks** in articles. Server forms still check that every chosen id exists and is an image.

## Public images and the media domain

`media.url` is a path. Pages put `publicMediaUrl(url)` in `<img src>`:

- With **`MEDIA_BASE_URL`** set (an `https://` origin, e.g. `https://media.example.com`), an uploaded picture is `https://media.example.com/uploads/…`.
- Without it, the same path on the site (`/media/uploads/…`), which the Worker serves from R2 (`src/app/media/[...key]/route.ts`): only keys the upload code creates are served; `nosniff`, a sandboxing CSP, `ETag`/`304`, immutable caching.
- Files shipped with the website keep their `/assets/…` paths.

**Set up the media domain (Cloudflare dashboard):** R2 → bucket `visuolab-media` → Settings → *Custom Domains* → add `media.<your-domain>` (the domain must be on Cloudflare); then set `MEDIA_BASE_URL` in `wrangler.jsonc` `vars` (or the dashboard) and redeploy. Create the bucket once with `npx wrangler r2 bucket create visuolab-media` before the first deploy. Tested: with the variable set, the public service page loaded the uploaded picture from the media domain, the database still held the path, and `/media/…` kept working as a fallback.

## Image optimisation (Cloudflare Images / Image Resizing)

`transformUrl(src, { width, quality, format })` builds `/cdn-cgi/image/width=…,quality=…,format=auto,fit=scale-down/<source>` when **`IMAGE_TRANSFORMS=1`**. This needs Image Transformations enabled on the zone (Cloudflare dashboard → Images → Transformations), so it is **off by default** (it cannot work on `localhost` or `workers.dev`). It is used for the library thumbnails. The public pages deliberately still use the original files with their existing `width`/`height` and markup, so nothing visible changes; to serve responsive copies later, wrap a page image's `src` in `transformUrl` and add a `srcset`.

## API (admin only, JSON, never cached)

| Call | Purpose |
|---|---|
| `GET /api/admin/media?q=&type=&storage=&unused=1&page=&limit=` | list / search; `?id=` returns one file |
| `POST /api/admin/media` (multipart `file`, optional `title`, `alt`, `caption`) | upload; `201` created, `200` `duplicate: true`, `413`, `415`, `429` |
| `POST /api/admin/media/<id>/replace` (multipart `file`) | replace the file behind an entry |

Not signed in: `401`. A request from another site: `403`. Title, alt and caption edits and deletes are server actions (`src/actions/media.ts`) with the same origin and `requireAdmin()` checks. Uploads, replacements, edits and deletes are written to `audit_logs`.

## Tests

- `db:verify` (129 checks): the headers of all 28 shipped pictures give the same type and size as the seed; refusals for empty, text, SVG, HTML, truncated, zero-size, over-long and over-large pictures; PNG, GIF, JPEG (with EXIF rotation), WebP and AVIF headers; the media-domain and transformation address rules; the fingerprint constraint.
- `media-test.mjs` (68 checks, real local D1 and R2): signed-out access; every refusal above through the real API (including 10.5 MB and 12 MB bodies and a foreign origin); every format stored with the right type, size, dimensions, fingerprint, unique key and address; the bytes served back identical with correct headers and `304`; duplicates reused; no BLOB column; library search, filters and paging; UI upload with a bad file reported; metadata editing; the picker in service, case study gallery and blog block forms (Enter does not submit the page form; upload inside the picker); the public page loading the uploaded picture in a real browser; replace (old object deleted, same id, pages follow, invalid file changes nothing, shipped file becomes an upload); delete (cancel keeps it, unused upload removed from D1 and R2, in-use file offers no delete); audit; no horizontal scroll at 390 px; no console errors.
- `cdn-test.mjs` (6 checks, with `MEDIA_BASE_URL` and `IMAGE_TRANSFORMS` set): described above.
- The service (56), case study (63), blog (82), dashboard (30) and admin (28) suites pass with the pickers; the pixel comparison of home, Works, a case study, a service, Blog and an article is 0 px different (12 of 12 captures).

## Notes and limits

- **Cloudflare D1 limits a `LIKE` pattern to 50 bytes.** While testing the library this showed up as an error; all admin searches and "what links here" checks (media, services, case studies, blog) now use `instr()` on lower-cased text, which has no pattern limit and no wildcards to escape.
- Pictures only: no video or document upload yet (`kind` already allows them). No SVG, by design.
- Objects are not resized when uploaded (no image processing in the Worker); use Image Transformations for smaller copies.
- Focal points (`focal_x`, `focal_y`) exist in the table but are not editable yet.
- Run `npm run db:migrate:remote` (migration `0012`), create the R2 bucket and (optionally) the media domain before using uploads on the live site; nothing was run against the live account.
