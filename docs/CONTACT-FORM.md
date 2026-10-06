# Contact form and submissions: how it works

The form on `/contact` looks and behaves like the one in the static site. Behind it there is now a validated, rate-limited, spam-filtered save into Cloudflare D1, and a small admin area to read the messages.

## 1. Flow

```
browser                                   server (Worker)                          D1
───────                                   ───────────────                          ──
fill form
browser validation (required, email)
Zod schema (same file as the server)
        ── submitContact(FormData) ──▶    1. Origin must be this site
                                          2. Zod schema again (the check that counts)
                                          3. rate limits (visitor, email, whole site)  ──▶ rate_limits
                                          4. spam checks
                                          5. INSERT                                    ──▶ contact_submissions
                                          6. notification email (Resend), if configured
        ◀── { ok: true } ────────────     never contains ids, reasons or internals
success panel (.form-ok)
```

Files: schema `src/lib/validation/contact.ts`, action `src/actions/contact.ts`, form `src/components/site/contact/ContactForm.tsx`, helpers in `src/lib/server/` (`rate-limit.ts`, `spam.ts`, `request.ts`, `submissions.ts`, `mail.ts`, `crypto.ts`), migrations `0001_submissions.sql` (original table and `rate_limits`) and `0008_contact_submissions.sql` (renamed table); sign-in tables in `0003_users_sessions.sql`. Full schema: `DATABASE.md`.

## 2. What the visitor sees (the design did not change)

The page is pixel-identical to `contact.html`. States reuse what the design already had:

| State | How it is shown |
|---|---|
| Missing/invalid field | the browser's own validation bubble and the red `:user-invalid` border (as before) |
| Rule the browser does not know (message under 10 characters, address without a real domain, a server-side rejection) | the same bubble, through `setCustomValidity` |
| Sending | the button is disabled at 60 % opacity, which is the look the original gave it after a successful send |
| Success | the existing `.form-ok` panel; the `.form-note` line is hidden; the button stays disabled (as in the original) |
| Problem that belongs to no field (rate limit, server error) | the existing `.form-note` line, its text replaced, with `role="alert"`; the button is enabled again so the visitor can retry |

Spam is never announced: a message flagged as spam still shows the success panel.

## 3. Validation

One Zod schema (`contactSchema`) is used in the browser and on the server. The server result is the only one that counts.

| Field | Rule |
|---|---|
| name | required, trimmed, max 100 |
| email | trimmed, lower-cased, max 254, must be a valid address (a domain with a dot is required) |
| company | optional, max 120 |
| need | zero or more of the five choices on the form, nothing else |
| budget | optional, one of the five choices |
| message | required, trimmed, 10 to 5000 characters |

The schema is `strict`; unknown choices are rejected. Server answers: `{ ok: true }`, `{ code: "invalid", fieldErrors }`, `{ code: "rate_limited" | "server", message }`.

## 4. Spam protection and rate limiting

No third-party widget is used, so the form design is untouched.

- **Honeypot:** a text field named `website`, off screen, out of the tab order, hidden from assistive technology. Anything in it marks the message as spam.
- **Fill time:** the browser sends when the form appeared. Under 2.5 seconds, or over 24 hours, counts as spam.
- **Content:** more than two links, or BBCode/HTML link and script markup, counts as spam.
- Spam is **stored with status `spam`** (visible in admin, never emailed) and the sender still sees success, so bots learn nothing.
- **Rate limits** (fixed windows in D1, one atomic statement per counter): 5 messages per hour per visitor, 3 per day per email address, 200 per hour for the whole site. Over a limit nothing is stored and the visitor sees the `.form-note` message.
- **Origin check:** a request whose `Origin` is another site is refused (vinext answers `403 Forbidden`; the action checks again).

Not included yet: Cloudflare Turnstile. It needs a visible or invisible widget on the page; when the client wants it, add the widget, a site key variable and a `TURNSTILE_SECRET`, and verify the token in `submitContact` before step 3.

## 5. Data and privacy

`contact_submissions` (D1): `id` (random UUID), `name`, `email`, `company`, `service` (the "What do you need?" choices joined with ", "), `budget`, `message`, `status` (`new`, `read`, `replied`, `archived`, `spam`), `source` (`contact-page`), `ip_hash`, `user_agent`, `notified_at`, `notify_error`, `created_at`, `updated_at` (ISO 8601, UTC).

- The IP address is **never stored or logged**. `ip_hash` is the first 32 hex characters of SHA-256 of `SESSION_SECRET` + address. The same hash feeds the rate limiter. If `SESSION_SECRET` is missing and `SITE_URL` is https, the form refuses to run rather than hash with a weak salt (plain-http local development uses a fixed fallback). Changing `SESSION_SECRET` breaks the link to older rows, which is the way to "forget" them.
- `user_agent` is cut to 200 characters. Rate-limit rows hold only hashed keys (`contact:ip:<hash>`, `contact:email:<hash>`).
- There is no `phone` column: the form has no phone field and the design must not change. Add one together with a field if the client wants it.
- Visitor text is only ever written to the database through bound parameters, shown in admin as plain text (React escapes it; verified with script and `onerror` payloads), and put in emails as plain text.
- Decide a retention period with the client (the architecture suggests 24 months). Deleting a row is available in admin.

## 6. Notification email (Resend)

If `RESEND_API_KEY` is set, each non-spam submission sends one plain-text email to `MAIL_TO` from `MAIL_FROM`, with `reply-to` set to the visitor. A failure never affects the visitor: it is stored in `notify_error` and shown in admin ("Mail" line). Without a key the line reads `not configured` and everything else works. Until the sending domain is verified in Resend, `MAIL_FROM` must stay `onboarding@resend.dev`, which only delivers to the Resend account owner.

## 7. Admin

`/admin/login`, `/admin` (counts) and `/admin/submissions` (list, filter by status, change status, delete with confirmation, 25 per page). The admin has its own root layout and stylesheet (nothing from the public site), is `noindex`, and is never cached.

- **Sign-in:** email and password; the user is looked up in the `users` table and the password is checked against its `password_hash` (PBKDF2-SHA256, 600,000 iterations, per-hash salt, constant-time compare; a disabled user cannot sign in). Sessions live in the `sessions` table (token stored as SHA-256 hash, 12 h idle / 14 day limit). A wrong email and a wrong password give the same message. Five failed tries per 15 minutes per visitor, then locked until the window passes.
- **Session:** 32 random bytes in an `HttpOnly`, `SameSite=Lax` cookie (`__Host-vl_session` and `Secure` when `SITE_URL` is https; `vl_session` over plain http in local dev). Only the SHA-256 of the token is stored. Idle timeout 12 hours, absolute limit 14 days, deleted on sign-out.
- **Every admin page and every admin action checks the session itself** (`requireAdmin()`), so nothing relies on a redirect. Actions also refuse a foreign `Origin`.
- **Not built yet:** other admin sections, several users or roles, password change, two-factor sign-in.

## 8. Setting it up

Local (`visuolab-next/.dev.vars`, git-ignored; copy from `.dev.vars.example`):

```
SESSION_SECRET=<64 random hex characters>
RESEND_API_KEY=            # optional
```

```
npm run db:migrate:local
npm run db:seed:local                # website content (optional for the form)
ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='a long password' npm run admin:create
npm run dev
```

Production:

```
npx wrangler secret put SESSION_SECRET
npx wrangler secret put RESEND_API_KEY      # when the key exists
npm run db:migrate:remote                   # migrations 0000-0012 in the live D1 (not run yet)
npm run db:seed:remote                      # content (not run yet)
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create -- --remote   # first admin (not run yet)
```

Also set `SITE_URL` (https) in `wrangler.jsonc`; it decides the cookie name and flags. **The admin password was shared in a chat earlier, so use a new one.** The password in `.dev.vars` is a local, random one used for testing; replace it.

## 9. How it was tested

Scripted browser tests (not part of the repository), run against the dev server and again against the production build (`npm run preview`, which has its own local D1):

- **Form backend, 30 checks, 30 pass on the production build.** On dev it was 29 of 30: one check expected our own error JSON for a foreign `Origin`, but the framework refuses it first with `403 Forbidden`, which is the intended outcome; the check now accepts it. Covered: success state and its styling, row contents and normalisation, hashed IP only, no raw address anywhere, truncated user agent, ISO timestamps, an empty form sends nothing, native bubble for required fields, client rule for short messages and bad addresses, server rejection of a short message / empty name / bad email / over-long name and message / a choice not on the form (requests replayed outside the browser), nothing stored for rejected requests, a foreign Origin refused, honeypot / too fast / many links stored as spam while a normal success is shown, a normal message right after is not spam, per-visitor and per-email limits, the refusal shown through `.form-note` with the form still usable, rate-limit keys hashed, no console errors or warnings.
- **Admin, 28 checks, 27 pass in each run.** The 28th (spam tab) is a test timing problem (it did not wait for the client-side navigation); filtering was confirmed by hand on dev and on the production build. Covered: closed when signed out, no data in the signed-out HTML, generic login error, lockout, cookie flags, hashed token only, list and highlighting, line breaks, stored script and onerror text rendered inertly, status changes, delete with cancel and confirm, an admin action without a cookie changes nothing, with a foreign Origin is refused, sign-out removes the session and the old cookie stops working, public pages unaffected. A hostile `status` value in the address (a SQL injection attempt) falls back to "all": the value is checked against a list and bound as a parameter.
- **Design:** see section 5.10 of `DESIGN-PARITY.md`.


## Email settings (since the Site settings phase)

Provider, sender and notification addresses are edited in the admin (**Settings → Integrations**) and stored in the `integrations` table; the Resend key stays the Cloudflare secret `RESEND_API_KEY`. The notification status stored on each enquiry is `not configured` (no key), `disabled` (switched off), `no recipient`, an error text, or empty when accepted. The contact e-mail shown in the form's error messages follows **Settings → Contact**. `MAIL_FROM` and `MAIL_TO` in `wrangler.jsonc` are only fallbacks when no integration row exists. Details: `SETTINGS.md`.


## Notifications, delivery status and duplicates (migration 0013)

The flow, the delivery record kept on every enquiry, the admin views, the idempotency rules (form key and 10-minute content check) and the email provider abstraction are documented in `INTEGRATIONS.md`. In short: the enquiry is saved first; the notification can never fail the submission; its status (`sent`, `failed`, `pending`, `skipped`) and reason are shown to admins with a one-click resend.
