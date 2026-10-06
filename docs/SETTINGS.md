# Site settings

Admin: `/admin/settings` (General, Contact, Social, SEO, Analytics, Integrations). The public website reads the **safe** settings from D1 at request time and shows exactly what it showed before settings existed: with the seeded defaults, every public page is 0 px different from the original (12 of 12 captures).

## The rule about secrets

| Kind | Where it lives | Reaches the browser? |
|---|---|---|
| Public-safe settings (site name, logos, contact e-mail, profile links, SEO defaults, analytics IDs) | D1 `site_settings`, keys `settings.*` | Only what the page itself shows |
| Integration settings that are not secret but private (notification addresses, sender, provider, on/off) | D1 `integrations` | **No.** Server only; never passed to a page |
| **Secrets** (`RESEND_API_KEY`, `TURNSTILE_SECRET`, `SESSION_SECRET`) | **Cloudflare secrets** (`wrangler secret put NAME`; `.dev.vars` locally) | **Never.** Not stored, not read into a page, not shown |

- The Integrations screen shows each secret's **name, purpose and whether it is set** (a yes/no read from the Worker environment) and the command to set it. It has no field for a value, because a secret must not pass through the database or the admin forms.
- `integrations.secret_name` holds only the *name* of the secret.
- **Guard rails:** every text field of every settings form is checked against the shapes of well-known secrets (Resend `re_…`, Stripe `sk_/rk_…`, AWS `AKIA…`, GitHub/Slack tokens, `Bearer …`, `api_key=…`, PEM private keys). A key pasted into the wrong box is refused with "This looks like a secret key… set it as a Cloudflare secret". `db:verify` also scans the seed and every settings document for them.
- Audit entries name the fields that changed, never their values.

## Where each setting lives and what uses it

| Setting | Stored in | Public effect |
|---|---|---|
| **General**: site name | `settings.general` | header/footer logo `alt` and "… — home" label, Open Graph site name, application name, Organization and article JSON-LD |
| Logo, dark logo | `settings.general` (media ids) | header and footer logo images (same 335 × 100 size; use a picture of that shape) |
| Favicon | `settings.general` | `<link rel="icon">` |
| Site description | `settings.general` | Organization JSON-LD |
| **Contact**: e-mail | `settings.contact` | contact page, mobile menu, closing call-to-action, About page job links (subject lines kept), contact-form error text |
| Phone, address, business hours | `settings.contact` | Organization JSON-LD only (the design has no place for them, so none was added) |
| **Social**: Instagram, LinkedIn, X, "Dribbble" | `settings.social` | footer icon links (open in a new tab with `noopener`; empty keeps the old `#`) |
| Facebook, YouTube, other profiles | `settings.social` | JSON-LD `sameAs` (the footer has four designed icons) |
| **SEO**: default title, description | `settings.seo` | used by pages without their own; pages with their own SEO fields keep them |
| Page metadata: title, description, hide-from-search for Home, About, Works, Blog, Contact | `settings.seo` `pages` | the page's `<title>`, description, Open Graph, Twitter card and JSON-LD; a hidden page gets `noindex` and leaves the sitemap. Defaults are the texts the pages had before. See [SEO.md](SEO.md) |
| Default Open Graph image | `settings.seo` (media id) | share picture for pages without one of their own |
| Robots: indexing, disallowed paths, sitemap line | `settings.seo` | `robots.txt`; with indexing off, `Disallow: /` and a `noindex, nofollow` tag on every page. `/admin` is always blocked |
| **Analytics**: GA4, GTM, Meta Pixel IDs + on/off | `settings.analytics` (mirrored into `integrations` `analytics`) | scripts loaded after the page is interactive, only on a real https address |
| **Integrations**: provider, sender, notification addresses, on/off | `integrations` `resend` | the enquiry email (`src/lib/server/mail.ts`) |
| Bot protection (Turnstile) site key, on/off | `integrations` `turnstile` | stored; the contact form does not show the widget yet |

Page title strings, article, case study and service SEO fields are unchanged and still win over the defaults.

## Reading settings

`getSiteConfig()` (`src/lib/server/site-config.ts`) returns the resolved public settings, once per request (React `cache`). Each section is parsed with its schema and merged over the defaults (`src/lib/settings/schema.ts`), so a **missing, damaged or out-of-date row can never break a page**: valid fields are kept, the rest fall back (tested with wrong-shaped JSON and a deleted row). The public layout passes only what the header and footer need to a client provider; the notification addresses and everything under `integrations` stay on the server.

## Validation (server side, Zod)

Site name required; plain text without `<` `>`; e-mail address valid; phone digits and `+ ( ) - . /`; address up to 5 lines, hours up to 7; every profile a full `https://` address **on the network's own domain** (`linkedin.com`, `instagram.com`, `x.com` or `twitter.com`, `facebook.com`, `youtube.com` or `youtu.be`; look-alike hosts such as `notinstagram.com` and `javascript:` are refused); robots paths start with `/`, no spaces; GA4 `G-XXXXXXXXXX`, GTM `GTM-XXXXXXX`, Meta Pixel digits only; sender `Name <a@b.co>`; 1–5 notification addresses; media ids must exist and be pictures. Errors appear on top and under the fields, and what was typed is kept.

## Analytics

IDs are public, so they sit with the settings. Rules enforced in code (`analyticsActive`): off unless switched on, **never on localhost or over http**, never in the admin. The IDs are matched against fixed patterns twice (on save, and again before they reach a script), so nothing else can be placed in a script. Scripts use `next/script` `afterInteractive`: they do not delay or change the page. Tag Manager and Pixel noscript fallbacks are included. If visitors must consent to tracking (for example in the EU), add a consent tool through Tag Manager before switching analytics on.

## Email

`notifyNewSubmission` takes provider, sender and recipients from the Integrations settings and the key from `RESEND_API_KEY`. The enquiry is always stored first; the notification status recorded on it is `not configured` (no key), `disabled` (switched off in the admin), `no recipient`, an error, or empty when the provider accepted it. **Send a test email** on the Integrations screen sends a short message to the notification addresses (5 per 10 minutes) and records when it last ran and whether it failed; without the key it says so instead. The request that is built (`src/lib/mail/build.ts`) is pure and tested: header injection through the visitor's name is impossible, the body is plain text, and no key appears in it. The old `MAIL_FROM` and `MAIL_TO` variables are still used as fallbacks when no integration row exists.

## Setting up the live site

1. `npm run db:migrate:remote`, then `npm run db:seed:remote` once (adds the five `settings.*` documents; it also resets other content, so only on a fresh database).
2. `npx wrangler secret put RESEND_API_KEY` (and `TURNSTILE_SECRET` if used).
3. Set `SITE_URL` to the real https address in `wrangler.jsonc`, then in the admin: Settings → Integrations (verified sender, recipients, **Send test email**), Contact, Social, SEO, Analytics.

## Tests

- `db:verify` (164 checks): defaults pass their schemas and are what the seed holds; the default logos exist; no secret-looking value in any settings document or integration config; integration rows name secrets only; 6 secret shapes refused in four different text fields; ordinary prose and hours are not mistaken for secrets; every format rule; damaged documents keep valid fields; analytics gating and snippets; the email request (recipients, header injection, no key).
- `settings-test.mjs` (59 checks, real browser and D1): signed-out access to all six screens; defaults visible on the public pages; General (validation, pictures chosen with the picker, name/logos/favicon/JSON-LD on the home and article pages); Contact (new e-mail in every place it appeared, none of the old, job-link subjects kept, phone/address/hours only in JSON-LD); Social (refusals, footer links and `sameAs`); SEO (default title/description/picture, `robots.txt` variants, `/admin` always blocked, indexing off gives `noindex` on every page); Analytics (refusals, mirror, nothing loads on localhost); Integrations (secret table with names and statuses only, saved config, test email message without a key, enquiry notification status `not configured` then `disabled`, Turnstile); no notification address or secret in any public page; damaged and missing settings rows; audit entries without values; no horizontal scroll at 390 px; no console errors.
- `analytics-https-test.mjs` (8 checks, site address set to an https name): GA4, Tag Manager and Meta Pixel scripts load with exactly the saved IDs, noscript fallbacks present, the admin never loads tracking, off means no markup.
- Contact form (30), services (56), case studies (63), blog (82), media (68), dashboard (30) and admin (28) suites and the pixel comparison were re-run with settings in place.

## Not in this phase

Footer icons for Facebook/YouTube (the design has four), a phone/address/hours block on the contact page, the Turnstile widget on the form, additional email providers, and editing secrets from the admin (by design).
