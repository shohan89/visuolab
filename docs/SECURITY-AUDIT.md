# Security audit

Scope: the whole application in `visuolab-next/` (public site, admin, server actions, API routes, D1 queries, R2 media, integrations, build and dependencies) and the repository. Audited on 5 October 2026 against the code at the end of the integration-management work.

**Result: no critical and no high finding.** Two medium and three low findings were fixed during the audit; one dependency advisory was fixed; the rest are accepted risks, deployment notes or recommendations, listed below with the reason.

## How it was done

1. **Code review** of every file that touches authentication, sessions, cookies, request handling, server actions, API routes, SQL, media, integrations and rendering of stored text.
2. **Mechanical checks** over the whole source: every exported server action and its guard, every SQL statement built with a template literal, every `fetch(` call, every `dangerouslySetInnerHTML`/`innerHTML`, every `redirect(`, every use of `process.env`/environment values, secrets in git history.
3. **Live attack probe** (`scripts/security/security-probe.mjs`, 43 checks) run against the **production build** (`wrangler dev --config dist/server/wrangler.json`) with a real session: anonymous access, CSRF, upload attacks, XSS and SQL payloads in forms and file names, role escalation, session replay, cookie flags, brute force, path traversal, sensitive-file requests, header checks, secret sweep. All 43 pass on the production build.
4. **Dependency audit** (`npm audit`, with and without dev dependencies).
5. The existing regression suites were re-run after the fixes (admin, media, contact, settings, dashboard, integrations).

## Findings

| ID | Severity | Area | Finding | Status |
|---|---|---|---|---|
| SEC-01 | Medium | Public | Public pages sent no security headers (no `nosniff`, framing protection, referrer policy, permissions policy, CSP, HSTS). Only `/admin` had them. | **Fixed** |
| SEC-02 | Medium | Auth, cookies | The session cookie's `Secure` flag and `__Host-` name depended only on `SITE_URL` being `https://`. A deployment that forgot to set it would have sent the cookie over plain http. | **Fixed** |
| SEC-03 | Low | API, rate limiting | The visitor address used for rate limits fell back to `X-Forwarded-For`, which a visitor can type. | **Fixed** |
| SEC-04 | Low | Media | An upload with no declared size (chunked body) was read completely before the size check. | **Fixed** |
| SEC-05 | Moderate | Dependencies | `fflate` 0.7.x (through `satori` / `@vercel/og`, from `vinext`): infinite loop on a malformed ZIP64 archive (GHSA-px8p-9vwx-vf98). | **Fixed** (override to 0.8.3) |
| SEC-06 | Low | Dependencies | `braces` ≤ 3.0.3 stack-exhaustion DoS (GHSA-vfj7-8cjw-p6xm), reached through `micromatch`/`fast-glob` in `eslint-config-next` and `vite-plugin-dynamic-import`. **No patched version exists.** | Accepted |
| SEC-07 | Low | Auth | The per-account sign-in limit (10 per 15 minutes) means someone can lock the admin out for 15 minutes by guessing wrongly from two or more addresses. | Accepted |
| SEC-08 | Medium (hardening) | Auth | No second factor, no "change password" screen, no list of active sessions. Safety rests on a strong password plus the lockout and session rules. | Recommendation |
| SEC-09 | Info | Public | The Vite **development** server serves some project files (`package.json`, `migrations/*.sql`, `db/seed/content.sql`, `vite.config.ts`). The production build serves none of them (verified). | Note |
| SEC-10 | Low | Auth, deploy | **Found on the first live deploy:** the Cloudflare Workers runtime refuses PBKDF2 above 100,000 iterations (the local runtime accepted 600,000), so sign-in failed on the live Worker. Hashing now uses 100,000 (the platform maximum). That is below the usual 600,000 recommendation for PBKDF2-SHA256, so the compensating controls matter: random 20+ character admin passwords, the sign-in rate limits, and (SEC-08) Cloudflare Access with MFA in front of /admin | **Fixed** (iterations lowered to the platform limit; admin passwords created with the old count must be re-created) |
| SEC-11 | Info | Secrets | Items on your side: a mailbox password was typed into the project chat early on; the Cloudflare API token sits in a local `.env`; `wrangler.jsonc` holds a personal address and the account id. None is in git. | Recommendation |
| SEC-12 | Info | Public | `/api/health` is public and returns only `ok`/`degraded` for D1 and R2. | Accepted |
| SEC-13 | Info | Public | The CSP restricts framing, form targets, plugins and `<base>`, but not script sources. | Recommendation |
| SEC-14 | Info | Database | Contact enquiries (names, emails, messages) are kept forever. | Recommendation |

### Fixes in detail

**SEC-01.** `next.config.ts` now sends on every response (`/` and `/:path*`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy` (camera, microphone, geolocation, payment, usb, interest-cohort off), `Content-Security-Policy: frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'`, `Strict-Transport-Security: max-age=31536000`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`. `/admin` keeps its stricter set (`no-store`, `DENY`, `no-referrer`), which wins where they overlap. The CSP leaves script and style sources open on purpose (see SEC-13) so fonts, analytics and the Turnstile widget keep working. The probe checks the headers on the production build; the visual comparison is unchanged.

**SEC-02.** `src/lib/server/auth.ts`: cookies are `Secure` and named `__Host-vl_session` when `SITE_URL` is https **or** the request itself arrived over https (`X-Forwarded-Proto`, `CF-Visitor`). Probe check 5h signs in with `X-Forwarded-Proto: https` while `SITE_URL` is http and gets a Secure `__Host-` cookie.

**SEC-03.** `src/lib/server/request.ts`: on a real (https) deployment only `CF-Connecting-IP` is used (Cloudflare sets it and a visitor cannot). `X-Forwarded-For` is read only for plain-http local development.

**SEC-04.** `src/lib/server/media-api.ts`: an upload must declare its size (`411` otherwise); browsers always do for a `FormData` upload. The size is still checked again on the bytes.

**SEC-05.** `package.json` `overrides: { "fflate": "^0.8.3" }`; build, type check and lint were re-run.

### Accepted risks, notes and recommendations

- **SEC-06.** Every remaining `npm audit` "high" comes from `braces`. It is used at build time (lint and bundler file matching on our own source patterns), is not in the deployed Worker bundle (checked: no `micromatch` or `fast-glob` in `dist/`), and cannot be fed attacker input. Re-run `npm audit` after upgrading `vinext` or `eslint-config-next`; `npm audit fix --force` proposes older versions and should not be used.
- **SEC-07.** The limits are deliberate: 5 attempts per visitor and 10 per account per 15 minutes slow a distributed guess without making a lock-out trivial. If a lock-out happens, wait 15 minutes. Putting `/admin` behind Cloudflare Access (SEC-08) also removes this.
- **SEC-08.** The strongest improvement available is **Cloudflare Access** (single sign-on or one-time PIN with MFA) in front of `/admin/*` and `/api/admin/*`; it needs no code. The application's own checks stay in place behind it. In-app TOTP, a password-change screen and a session list are the in-code alternatives.
- **SEC-09.** Run `npm run dev` on your own machine only (it listens on localhost). Do not expose it with a tunnel or on a shared network. Production never serves project files: `dist/client` is the only static directory and was checked.
- **SEC-10.** Resolved on the first live deploy (see the table): hashing uses 100,000 iterations, the Workers maximum.
- **SEC-11.** Rotate the mailbox password that was typed into the chat and use a unique one. Create the Cloudflare API token with only the permissions needed (Workers Scripts edit, D1 edit, R2 edit, for this account only) and rotate it if the `.env` file was ever shared. The account id and `MAIL_TO` address in `wrangler.jsonc` are not secrets, but `MAIL_TO` is personal data in the repository; remove it from `vars` once the notification address is set in **Integrations → Email**.
- **SEC-12.** Acceptable for uptime monitors; remove the route or require a header if you prefer.
- **SEC-13.** A real `script-src` needs a nonce on every inline script the framework emits. When the framework supports it, add `script-src 'self' 'nonce-…' https://www.googletagmanager.com …` per request. Until then, cross-site scripting is prevented in the code (below), not by the browser.
- **SEC-14.** Add a retention rule (for example delete spam after 30 days and enquiries after 24 months) and a "delete" habit in the inbox; the admin already has per-enquiry delete.

## What was checked and how (no finding)

### Authentication, sessions, cookies, passwords
- Passwords: PBKDF2-SHA256, 100,000 iterations, 16-byte random salt, constant-time comparison; the format carries its iteration count. A wrong e-mail runs a real hash too (no timing difference), and wrong password / unknown account / disabled account show one message (probe 5a). Minimum 12 characters in `create-admin.mjs`; changing a password signs the user out everywhere.
- Sessions: a 256-bit random token in an `HttpOnly`, `SameSite=Lax`, path `/` cookie; the database stores only its SHA-256 (probe 5e: the stored value is not usable as a cookie, 5g). Idle limit 12 hours, absolute limit 14 days, sign-out deletes the row (probe 9c replays the old cookie), disabling a user ends the session at once (9b), idle and expired sessions are refused (9d).
- Login: 5 attempts per visitor and 10 per account per 15 minutes, counted atomically in D1 (probe 5b/5c); failures and lock-outs are written to the audit log without the attempted password.
- Authorization: `requireAdmin()` reads the role from the database on every page, action and API call. A signed-in non-admin gets 404 on pages and 403 on the API (probe 9a). There is no way to change a role from the application, so no privilege-escalation path exists in the UI; `create-admin.mjs` is the only way to create an admin and runs on the operator's machine.

### Admin routes, server actions, privilege escalation
- Every `page.tsx` under `/admin` calls `requireAdmin()` (checked mechanically); the layout does too. Anonymous requests, including React-Server-Component requests (`RSC: 1`), get only a redirect (probe 1a/1c).
- All 40 exported server actions were listed and each one calls the shared `guard()` (same-origin check, then `requireAdmin()`), except `submitContact` which is the public form (checked mechanically; no unguarded admin action exists).
- CSRF: cookies are `SameSite=Lax`; every action and every media write also requires a matching `Origin` (or `Sec-Fetch-Site: same-origin` when no Origin is sent) and refuses a request with neither (`strictSameOrigin`). Probe 6a: an upload with a foreign Origin, a cross-site request and a request without origin information are all refused with 403 even with a valid session.
- No state change happens on GET.

### API
- Input validation: every form is parsed with a Zod schema on the server (lengths, formats, allow-listed values, link and URL shapes, no `<`/`>` in plain fields, secret-shaped values refused in settings). IDs from forms are matched against fixed patterns before use. Probe 8: markup, SQL text and CR/LF in the contact form are stored and shown as plain text; a 60,000-character message is refused.
- Rate limiting: contact form (per visitor, per e-mail, site-wide), login, media uploads (200 per admin per hour), integration tests (10 per 10 minutes), e-mail tests and re-sends. Counters are atomic single statements.
- SQL injection: every statement is prepared with bound parameters. The only template-literal SQL builds from constants (column lists, `?n` placeholder lists) or from numbers clamped by the caller; search uses `instr()` with a bound value, so no pattern syntax is interpreted. No raw user text reaches an SQL string (checked mechanically and by probe 8a, where `'; DROP TABLE users;--` leaves the table intact).
- XSS: React escapes all text. There is exactly one `dangerouslySetInnerHTML` (JSON-LD), and its serializer escapes `<` and the Unicode line separators, tested in `db:verify`. Blog and CMS text is parsed into React elements (no HTML pass-through); every link target is checked (`/…`, `#…`, `mailto:`, `https://` only; `javascript:` and `//host` links become plain text) both when saved and when rendered. Probe 7i and 8a confirm that markup typed into media titles, alt text, captions and enquiries never runs in the admin.
- Open redirects: no endpoint takes a destination from the request. Redirect targets are fixed admin paths with a notice code; the one "back" value is accepted only if it starts with `/admin/`. Slug redirects use stored, validated slugs. Probe 4a tries `next`, `redirect`, `returnTo`, `//host` and `/\host`: every `Location` stays on the site.
- SSRF: the only server-side `fetch` calls go to addresses that are not user input: Cloudflare Turnstile, the mail provider, and the webhook, CRM and Slack addresses, which are **Cloudflare secrets** (an admin cannot type them). They must be https, without credentials, not local or private hosts, and Slack must be on `slack.com`; redirects are not followed; `global_fetch_strictly_public` in `wrangler.jsonc` additionally stops the Worker reaching private addresses. `INTEGRATIONS_ALLOW_HTTP` lifts the first rules for development only and is documented as never for production.
- IDOR: the application has a single tenant and one privileged role, so there is no cross-user data. Record ids are random UUIDs or validated slugs; drafts, scheduled and archived content return 404 to the public and appear only as a no-index preview to a signed-in admin (suites and probe 1a).

### Media
- Validation looks at the bytes, never at the name or claimed type: only JPEG, PNG, WebP, GIF and AVIF are accepted; SVG, HTML and PHP renamed to `.png` are refused (probe 7a); dimensions are read from the header and capped (12,000 px per side, 100 megapixels: probe 7b); 10 MB maximum, refused before storing (7c) and, since SEC-04, only for uploads that declare their size.
- Object names are made by the server (`uploads/yyyy/mm/<uuid>.<extension of the real type>`); the visitor's file name is kept only as a text label, and hostile names (path traversal, NUL, markup) change nothing (probe 7e/7f).
- Access: uploads, replacement, deletion and listing are admin-only with CSRF and rate limits; objects are stored with the sniffed content type and served by the Worker with `nosniff`, a `default-src 'none'; sandbox` CSP and only for keys of the server-made shape, so traversal, SVG and HTML keys return 404 (probe 7g). A polyglot (a PNG with a script appended) can only ever be served as `image/png` (7d). The R2 bucket has no public access of its own; with a media domain, only the upload objects are in it.

### Database
- Writes happen only in admin-guarded code or the public contact form. Public reads select published content only and never select password hashes, session ids, ip hashes, integration rows or submissions. Visitor addresses are stored only as a salted, truncated hash. Passwords and sessions are stored hashed. The audit log records who did what and the names of changed fields, never values.
- Settings are public-safe by construction: secret-shaped values are refused, credentials are Cloudflare secrets only, and the integration tables hold names and outcomes, not values (also asserted by `db:verify`).

### Integrations
- Secrets are read from the Worker environment at the moment of use and never put into results, logs, pages or the database; the admin shows only "set / not set" and the command to set them. The integration test sweeps every admin page, every public page, the activity log and the audit log for secret values (check B38 of the integration test).
- Webhook: the generic webhook is signed (HMAC-SHA256 over `timestamp.body`, headers `X-Visuolab-Timestamp` and `X-Visuolab-Signature`), the CRM gets a Bearer token only in a header, Slack text is escaped. There are no inbound webhooks, so there is nothing to verify on receipt; receivers should verify the signature and reject old timestamps (documented in `INTEGRATION-MANAGEMENT.md`).
- Turnstile is verified on the server; a rejected proof keeps the enquiry as spam without telling the sender; an unreachable Cloudflare lets real enquiries through and shows an error.
- API keys: only `.dev.vars` (git-ignored) and Cloudflare secrets hold them. Git history was searched for Cloudflare, Resend, AWS, GitHub and Slack token shapes, private keys and the local admin password: none found. `.env` and `.dev.vars` are ignored; only `.env.example` and `.dev.vars.example` (empty values) are tracked.

### Public site: errors, debug output, environment
- Odd and hostile addresses (bad encodings, 5,000-character slugs, `/.env`, `/.git/config`, `/wrangler.jsonc`, `/src/...`, `/db/...`, `/migrations/...`, `/docs/...`) return 404 on the production build with no stack trace, file path, secret or SQL text (probe 3a/3b). A forged server-action id and a 3 MB junk body get a plain error (3c/3d).
- `console` output in the server code contains only error class names or short codes, never visitor data or secrets. The admin error screen shows a reference code, not the message.
- No `X-Powered-By` or version header is sent (probe 2e); public pages set no cookies (2f); public pages and the admin are `no-store`, so a shared cache cannot keep a draft preview (2c).
- Environment: only `SITE_URL` (read on the server) and the build-time `import.meta.env.DEV` are used outside the Worker bindings; there are no `NEXT_PUBLIC_*` variables. Client bundles and public pages were searched for the values in `.dev.vars` and for key shapes: none (probe 11). `SiteConfig` passed to the browser holds only public settings.

### Dependencies
`npm audit`: 12 advisories at the start (4 moderate, 8 high), none critical. After the fix: **9 high, 0 moderate**, all from `braces` through build-time tooling (SEC-06). The deployed Worker bundle contains none of the affected packages. Direct runtime dependencies are `next`, `react`, `react-dom`, `react-server-dom-webpack`, `vinext`, `@vinext/cloudflare`, `zod`, `three`, `lenis`, `server-only`; the last audit date is in this file's header.

## Re-running the audit

```bash
npm audit                         # dependencies
npm run db:verify                 # schema, secret handling, validators, escaping, webhook signing
node scripts/security/security-probe.mjs   # live probe; see the header of the file for the production-build recipe
```

Re-audit after: changing authentication, adding an admin action or API route (it must call `guard()` / `guardApi()`), adding an integration that makes outgoing requests (its address must come from a Cloudflare secret and pass `addressProblem`), accepting a new upload type, or adding any `dangerouslySetInnerHTML`.
