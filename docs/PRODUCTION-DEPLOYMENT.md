# Production deployment (Cloudflare Workers)

How to put the site live, what Cloudflare resources it needs, and the exact commands. **Nothing has been deployed yet.** The application, configuration and checks are ready; the steps below need you (the domain, the secrets, the admin password).

Run every command from `visuolab-next/`.

## State of the Cloudflare account (read-only check, 6 October 2026)

| Resource | Name / id | Status |
|---|---|---|
| Account | `48fa30c68a3fcf35323392af2c199e01` | token works (`wrangler whoami`) |
| D1 database | `visuolab`, `09818a92-a4b7-4ec1-a009-740b8e353402` | **exists, empty** (0 tables): migrations and seed not applied |
| R2 bucket | `visuolab-media` | **exists** |
| Worker | `visuolab-next` | **not deployed** |
| Secrets | `SESSION_SECRET`, `RESEND_API_KEY`, … | **not set** (the Worker does not exist yet) |
| Custom domain, media domain, Image Transformations, Resend sender domain | – | not configured (need your domain) |

## What the Worker needs

| Need | Kind | Required | Notes |
|---|---|---|---|
| Worker `visuolab-next` | Worker | yes | entry `src/worker.ts` (vinext handler + page cache), static files from `dist/client` through the `ASSETS` binding |
| D1 `visuolab` | binding `DB` | yes | 14 migrations in `migrations/` |
| R2 `visuolab-media` | binding `MEDIA` | yes | picture uploads; no public access of its own |
| `SITE_URL` | var | yes | the real origin, `https://…`, no path (canonical links, sitemap, structured data, secure cookies) |
| `EDGE_CACHE` | var | yes (`"1"`) | public page cache in the Worker |
| `MEDIA_BASE_URL` | var | optional | empty = the Worker serves `/media/*` itself; `https://media.<domain>` once the bucket has a custom domain |
| `IMAGE_TRANSFORMS` | var | optional | `"1"` only when Image Transformations are enabled on the zone, else `"0"` |
| `SESSION_SECRET` | **secret** | yes | 64 hex characters; salts visitor hashes. Without it the Worker refuses to run on https |
| `RESEND_API_KEY` | secret | for email | without it enquiries are stored and marked "not configured" |
| `TURNSTILE_SECRET` | secret | if Turnstile is used | set the site key in **Integrations** |
| `WEBHOOK_URL`, `WEBHOOK_SECRET`, `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_TOKEN`, `SLACK_WEBHOOK_URL` | secrets | only the integrations you use | addresses count as secrets |

**Never set in production:** `INTEGRATIONS_ALLOW_HTTP`, `EMAIL_API_BASE`, `TURNSTILE_VERIFY_URL`, `EDGE_CACHE=0`. `npm run deploy` refuses them. **No development credential is deployed:** `.dev.vars` and `.env` are git-ignored, are never uploaded, and the deploy script deletes the copy of `.dev.vars` that the build leaves in `dist/server/` and checks that none of its values appears anywhere in the build.

## Configuration (`wrangler.jsonc`)

The top level is for local development and the production-build preview (`SITE_URL=http://localhost:3001`). The **`env.production`** block is what is deployed: it repeats the bindings (Wrangler environments do not inherit them), keeps the Worker name `visuolab-next`, turns on full logging (`observability.logs`, invocation logs, 100% sampling), sets `preview_urls: false`, and holds the production variables. Cloudflare Images/Transformations are *not* enabled (`IMAGE_TRANSFORMS: "0"`); see [Pictures](#pictures-r2-and-optional-image-transformations).

## One-time setup

### 1. Fill in the production address

Edit `wrangler.jsonc`, `env.production.vars.SITE_URL`: replace `https://REPLACE-WITH-YOUR-DOMAIN` with the real origin, for example `https://visuolab.com`. Until the domain is attached you can use the Worker's own `https://visuolab-next.<your-subdomain>.workers.dev` address here; change it later and redeploy.

### 2. Apply the migrations and load the content (remote D1)

```bash
npm run db:migrate:remote      # applies migrations 0000–0014 to the production D1
npm run db:seed:remote         # FIRST TIME ONLY: loads the site's content. It REPLACES the content tables; never run it again on a live site
```

Check: `npx wrangler d1 execute visuolab --remote --command "SELECT COUNT(*) AS services FROM services"` → `4`.

### 3. Create the admin user

Use a long, unique password (12 characters minimum). It is hashed on your machine; only the hash is written to the database.

```powershell
# PowerShell
$env:ADMIN_EMAIL="you@yourdomain.com"; $env:ADMIN_NAME="Your Name"; $env:ADMIN_PASSWORD="a long unique password"
npm run admin:create -- --remote
Remove-Item Env:ADMIN_PASSWORD
```

```bash
# bash
ADMIN_EMAIL=you@yourdomain.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='a long unique password' npm run admin:create -- --remote
```

Do not reuse a development or chat-shared password. The admin sits at `/admin`; consider putting **Cloudflare Access** (one-time PIN or SSO with MFA) in front of `/admin/*` and `/api/admin/*` (see `SECURITY-AUDIT.md`, SEC-08).

### 4. Pre-flight check (deploys nothing)

```bash
npm run deploy:check
```

It builds for production and checks: `SITE_URL` is https and not a placeholder, `EDGE_CACHE="1"`, no test switches or secret-looking variables, the D1/R2/assets bindings, observability, compatibility flags, no development credential in the build or tracked by git, and (read-only, against Cloudflare) that migrations are applied and the secrets exist. It lists what is missing; it must print `All checks passed.` before you deploy.

Before the first deploy the Worker does not exist, so the secrets cannot be listed yet: the script prints a note instead of failing. After step 6 it fails if `SESSION_SECRET` is missing.

### 5. First deploy

```bash
npm run deploy
```

(`node scripts/deploy.mjs`: builds for production, runs the configuration and no-development-credentials checks, removes the build's copy of `.dev.vars`, then runs `vinext-cloudflare deploy --env production --skip-build`. The Cloudflare-side checks (`--remote`) belong to `npm run deploy:check`, so run that first and do not deploy until the migrations are applied.) `vinext-cloudflare deploy --env production --dry-run` validates the setup without deploying; the real upload could not be exercised before you deploy. The deploy has succeeded only when the command ends without an error and prints the Worker's address; confirm with `npx wrangler deployments list --env production`.

### 6. Set the secrets (after the Worker exists)

```bash
# SESSION_SECRET: generated and piped straight in; it is never shown or saved
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler secret put SESSION_SECRET --env production

# email notifications (Resend → API Keys; the sender domain must be verified in Resend)
npx wrangler secret put RESEND_API_KEY --env production          # paste the key when asked

# only if used
npx wrangler secret put TURNSTILE_SECRET --env production
npx wrangler secret put SLACK_WEBHOOK_URL --env production
npx wrangler secret put WEBHOOK_URL --env production
npx wrangler secret put WEBHOOK_SECRET --env production
npx wrangler secret put CRM_WEBHOOK_URL --env production
npx wrangler secret put CRM_WEBHOOK_TOKEN --env production
```

Until `SESSION_SECRET` exists, sign-in and the contact form answer with an error (the Worker fails closed on https rather than hashing weakly). `npx wrangler secret list --env production` lists names only.

### 7. Custom domain and HTTPS

1. The domain's DNS must be a zone on this Cloudflare account.
2. In `wrangler.jsonc`, `env.production`, add (the commented example is there):
   ```jsonc
   "routes": [{ "pattern": "example.com", "custom_domain": true }, { "pattern": "www.example.com", "custom_domain": true }]
   ```
   set `SITE_URL` to the same origin, then `npm run deploy`. Cloudflare creates the DNS records and certificate for a Worker custom domain.
3. Dashboard → SSL/TLS: mode **Full (strict)**; Edge Certificates: **Always Use HTTPS** on, **Automatic HTTPS Rewrites** on. The Worker itself already sends `Strict-Transport-Security`, and issues the `__Host-` Secure session cookie because the request arrives over https.
4. When the domain works, set `workers_dev` to `false` in `env.production` and redeploy so the site has one address.

### Pictures: R2 and optional Image Transformations

- Uploads go to `visuolab-media` through the Worker (the browser never sees storage credentials) and are served at `/media/…` with `immutable` caching.
- Optional media domain: Dashboard → R2 → `visuolab-media` → Settings → **Custom Domains** → `media.<domain>`; set `MEDIA_BASE_URL` to `https://media.<domain>` and redeploy.
- Optional resizing: Dashboard → Images → **Transformations** → enable for the zone; then set `IMAGE_TRANSFORMS` to `"1"` and redeploy. Uploaded pictures then get responsive sizes (`MEDIA.md`). Leave it `"0"` if the feature is not enabled: the pictures shipped with the site already have pre-made sizes.

## Each release afterwards

```bash
npm run typecheck && npm run lint
npm run db:verify                    # schema, validators, escaping, signing (227 checks)
npm run db:migrate:remote            # only when migrations/ changed: forward-compatible migrations first
npm run deploy:check
npm run deploy
```

Rollback: `npx wrangler deployments list --env production`, then `npx wrangler rollback <version-id> --env production`. A migration is not rolled back by this; write migrations so the previous code still works.

## Verifying a deployment

Run these against the live address (replace `https://example.com`); every line has an expected result.

```bash
curl -s https://example.com/api/health                                   # {"status":"ok","checks":{"d1":"ok","r2":"ok"}}
curl -sI https://example.com/ | grep -iE "strict-transport|x-frame|content-security|x-edge-cache"   # headers; X-Edge-Cache MISS, then HIT on the second request
curl -s https://example.com/sitemap.xml | head -5                         # <loc> entries with https://example.com
curl -s https://example.com/robots.txt                                    # Disallow: /admin, Sitemap line
curl -sI https://example.com/admin | head -3                              # redirect to /admin/login
curl -s -o /dev/null -w "%{http_code}\n" https://example.com/api/admin/media   # 401
```

Then in a browser: sign in at `/admin/login` (the cookie is named `__Host-vl_session`, HttpOnly, Secure); **Integrations** → each integration's status and the **Test** button (email test needs `RESEND_API_KEY`); upload a picture in **Media** and open it; send a message from `/contact` and see it in **Submissions** with its notification status; **Settings → SEO** shows the right `SITE_URL`-based preview.

Logs: `npx wrangler tail --env production` (live), or Dashboard → Workers & Pages → `visuolab-next` → Observability (Workers Logs, retained, searchable). Messages contain error class names and short codes, never visitor data or secrets. Suggested alerts (Dashboard → Notifications): Workers error rate / health check on `/api/health`.

## What was run before this document was written (6 October 2026)

| Step | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | clean |
| Lint | `npm run lint` | clean |
| Tests | `npm run db:verify` / `db:verify:local` | 227 / 171 of 227 / 171 pass |
| | suites on the dev server: admin 28, contact 30, media 68, settings 59, SEO 41, dashboard 30, blog 82, services 56, case studies 63 | all pass |
| Production build | `npm run build` (and `CLOUDFLARE_ENV=production` through `deploy:check`) | builds |
| Cloudflare-compatible preview | `wrangler dev --config dist/server/wrangler.json` (workerd, local D1 and R2) | up |
| Routes, database, uploads, contact, admin sign-in | `scripts/qa/func-qa.mjs` against the preview | 35/35 (23 pages and every asset, D1/R2 bindings, picture upload and delete, enquiry stored, admin login/logout/authorization) |
| Security probe, page cache | `security-probe.mjs`, `scripts/perf/cache-test.mjs` against the preview | 43/43, 14/14 |
| Deploy guard | `npm run deploy:check` | correctly **refuses** to deploy: `SITE_URL` is still a placeholder, and the remote D1 has no migrations applied |

The preview runs the same Worker code against local copies of D1 and R2; the live bindings, secrets, domain and TLS can only be checked after you deploy, with the commands above.
