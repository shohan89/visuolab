# Admin authentication

Own implementation on D1 and the Web Crypto API (no third-party auth service, no Node-only modules), so it runs unchanged on Cloudflare Workers. Users and sessions live in D1 (`users`, `sessions`; schema in `DATABASE.md`). No credentials are in the source code.

Files: `src/lib/server/auth.ts` (sessions, `requireAdmin`), `src/lib/server/crypto.ts` (hashing), `src/lib/server/request.ts` (origin check, IP hashing), `src/lib/server/rate-limit.ts`, `src/lib/server/audit.ts`, `src/actions/admin.ts` (login, logout, admin actions), `scripts/create-admin.mjs` (bootstrap), `next.config.ts` (admin response headers).

## 1. What is in place

| Requirement | Implementation |
|---|---|
| Admin login | `/admin/login`; e-mail + password, looked up in `users` (case-insensitive e-mail). A wrong e-mail, a wrong password and a disabled user give the same message and take the same time (a dummy PBKDF2 check runs when the user does not exist). |
| Password hashing | PBKDF2-SHA256, 100,000 iterations, random 16-byte salt per password, constant-time compare. Stored as `pbkdf2$sha256$100000$<salt>$<hash>`. Plain passwords are never stored or logged. |
| Secure sessions | Random 256-bit token in the cookie; the database stores only its SHA-256 (`sessions.id`), so a database leak does not give working cookies. A new token on every sign-in (no session fixation). |
| Session expiry | 12 hours without activity, and never longer than 14 days after sign-in. Both limits are checked on the server on every request; an expired row is deleted. Expired rows are also removed at each sign-in. A disabled user's sessions stop working at once. |
| Secure cookies | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` and the `__Host-` prefix (name `__Host-vl_session`) whenever `SITE_URL` is https. Plain-http local development uses `vl_session` without `Secure`. |
| Protected routes | `src/app/(admin)/admin/(console)/layout.tsx` calls `requireAdmin()`; the login page is the only open admin page. The check runs on the server for every request (the layout is `force-dynamic`); nothing depends on client code. |
| Server-side authorization | `requireAdmin()` at the start of every admin page, server action and route handler. Role and status are read from the database on each call, never from the cookie. |
| Logout | `logout` action deletes the session row and clears the cookie. The old cookie stops working at once (tested). |
| CSRF | Cookies are `SameSite=Lax`, **and** every admin action (login, logout, status change, delete) calls `strictSameOrigin()`: the `Origin` header must match this host, or, if the browser sends none, `Sec-Fetch-Site` must be `same-origin`; otherwise the request is refused. Actions are POST-only (Next server actions, which also check Origin themselves). No state changes on GET. |
| Rate limiting | Sign-in: 5 attempts per 15 minutes per visitor (salted IP hash) and 10 per 15 minutes per account e-mail (hashed), counted in D1 (`rate_limits`, atomic upsert). A successful sign-in resets both counters. |
| Audit trail | `audit_logs` records `login.success`, `login.failed`, `login.locked`, `logout`, `submission.status`, `submission.delete` with user and hashed IP (never the address). A logging failure never blocks the action. |
| Headers on `/admin/*` | `Cache-Control: no-store`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`; pages are `noindex`. |

## 2. The authorization helper

```ts
import { requireAdmin } from "@/lib/server/auth";

// page or layout
export default async function Page() {
  const admin = await requireAdmin();        // AdminUser { id, email, name, role }
  ...
}

// server action
"use server";
export async function saveThing(formData: FormData) {
  if (!strictSameOrigin(await requestHeaders())) throw new Error("bad origin");   // the local guard() in actions/admin.ts does both
  const admin = await requireAdmin();
  ...
}

// route handler (JSON endpoint)
import { requireAdminApi } from "@/lib/server/auth";
export async function POST() {
  const auth = await requireAdminApi();
  if ("response" in auth) return auth.response;   // 401 not signed in, 403 wrong role
  const { admin } = auth;
  ...
}
```

`requireAdmin()`: not signed in sends the visitor to `/admin/login`; signed in but not an `admin` returns 404 (the area is not revealed). Every new admin action must call it **before** doing anything else, and must not trust anything the browser sends except the form values, which still need validating. In `src/actions/admin.ts` the local `guard()` combines the origin check and `requireAdmin()` for the actions there; use it or repeat both calls.

Roles: `admin` (everything) and `editor` (reserved for the content editors; `requireAdmin()` refuses editors, a later `requireEditor()` can allow them where needed).

## 3. Creating the first admin (bootstrap)

No user exists after the migrations, and nothing is seeded. The password is given at run time and only its hash is stored.

```
# local (the database used by npm run dev)
ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='a long unique password' npm run admin:create

# local database used by npm run preview
... npm run admin:create -- --preview

# live database (check `npx wrangler whoami` first)
... npm run admin:create -- --remote
```

- Password: at least 12 characters, longer is better. Type it in the terminal for that command only; do not put it in a file in the repository, a ticket or a chat.
- Run again with the same e-mail to **reset the password**: it updates the hash, makes sure the role is `admin` and the status `active`, and signs that user out everywhere.
- To lock someone out: `UPDATE users SET status = 'disabled' WHERE email = '...'` (their sessions stop working immediately).
- Add more people the same way (one run per e-mail). A user-management screen is a later phase.

Required for production (once): `npx wrangler secret put SESSION_SECRET` (64 random hex characters, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and `SITE_URL` set to the real `https://` address in `wrangler.jsonc`. The site refuses to hash visitor data without the secret when `SITE_URL` is https. Locally the secret goes in `.dev.vars` (git-ignored; template `.dev.vars.example`).

## 4. Secrets and what is committed

Never in git: `.dev.vars`, `.env*`, `.wrangler/`, passwords, password hashes of real accounts, API keys. The repository holds only names (`SESSION_SECRET`, `RESEND_API_KEY`) and the empty template. Rotating `SESSION_SECRET` is safe: it only changes the salt for visitor hashes (rate-limit keys and stored IP hashes restart); sessions are random tokens and are not derived from it.

## 5. Tests

Browser test of the running site (28 checks, all passing): signed-out access to `/admin` and `/admin/submissions` redirects to login with no data in the HTML; a direct request without a cookie gets a redirect, not the page; wrong password and wrong e-mail give identical messages; lock-out after 5 failures even with the right password; the cookie is HttpOnly and SameSite=Lax and not readable by page scripts; only the token hash is in the database; an action without a session changes nothing; an action with a valid session but a foreign `Origin` is refused (403); sign-out removes the session row and the old cookie no longer opens the dashboard; no console errors.

## 6. Known limits (not in this phase)

- No two-factor sign-in, no password-reset e-mail, no user-management screen. Reset is by `admin:create`.
- Sessions are cleaned up when somebody signs in, not on a timer.
- Rate limiting is per visitor and per account in a fixed window; for heavier protection put Cloudflare Turnstile or a WAF rate-limit rule in front of `/admin/login` (the `integrations` table has a placeholder for Turnstile).
- Check on the live site after deploy: cookie name starts with `__Host-`, has `Secure`, and `/admin/login` returns the headers listed above.
