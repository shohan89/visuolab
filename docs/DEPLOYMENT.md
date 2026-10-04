# Visuolab — Local Development and Cloudflare Deployment

Project: `visuolab-next/`. The original static site in `referance-website/` is not touched by any command below.

## 1. Stack and what was verified

| Piece | Choice |
|---|---|
| Framework API | Next.js App Router (`next` 16, used for types and APIs), TypeScript strict |
| Runtime / bundler | **vinext 1.0.1** on **Vite 8**, with `@cloudflare/vite-plugin` (RSC environment runs in workerd) |
| Deploy tool | `vinext-cloudflare deploy` (`@vinext/cloudflare`) on top of **Wrangler 4** (`wrangler.jsonc`) |
| Data | Cloudflare D1 `visuolab` (binding `DB`), R2 bucket `visuolab-media` (binding `MEDIA`) |
| Lint / types | ESLint 9 with `eslint-config-next`, TypeScript 6 (`typescript-eslint` does not support TypeScript 7 yet) |

vinext is documented by its authors as under active development and not a drop-in replacement for every Next.js feature (notably Cache Components / `"use cache"`, build-time image and font optimization, native Node modules in dev). Re-run `npx vinext check` after adding dependencies.

Verified on this machine (Node 24, npm 11, Windows):

| Check | Result |
|---|---|
| `npm run typecheck` | passes |
| `npm run lint` | passes |
| `npm run dev` | serves `/` (200), original CSS files linked in original order, `/assets/*` static files, `/about.html` → `/about` (308), `/api/health` reports D1 and R2 `ok` |
| `npm run build` | passes (client, RSC and SSR bundles) |
| `npm run db:migrate:local` | applies `0000`-`0008` (app meta, submissions, users and sessions, media, services and case studies, blog, settings/navigation/integrations/audit, `contact_submissions`) |
| `npm run preview` | builds, starts the built Worker in local workerd on port 8787; `/`, `/api/health`, redirect and assets all respond correctly |
| `vinext-cloudflare deploy --dry-run` | passes. **No production deploy has been run yet.** |

The home page is a placeholder. No UI has been migrated and there is no admin yet.

## 2. Prerequisites

- Node.js 20 or newer (24 used here) and npm.
- A Cloudflare account that owns the D1 database and R2 bucket (currently `Visuolab@gmail.com's Account`, ID `48fa30c68a3fcf35323392af2c199e01`).
- A Cloudflare API token for the CLI. Template: **Edit Cloudflare Workers**. Add D1: Edit and Workers R2 Storage: Edit.

## 3. First-time setup

```
cd visuolab-next
npm install
copy .env.example .env          # then fill the two values (CLI-only, git-ignored)
copy .dev.vars.example .dev.vars  # Worker runtime secrets for local dev (git-ignored)
npm run cf-typegen              # generates worker-configuration.d.ts from wrangler.jsonc
npm run db:migrate:local        # creates the local D1 tables
```

Check you are on the right account before any remote command:

```
npx wrangler whoami
```

It must show the Visuolab account. If an older OAuth login for another account appears, the `CLOUDFLARE_API_TOKEN` in `.env` overrides it for commands run in this folder.

## 4. Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR on **http://localhost:3001**. D1 and R2 are local emulations stored in `.wrangler/state`. |
| `npm run build` | `vite build`. Output in `dist/` (`dist/client`, `dist/server`). |
| `npm run preview` | Builds, then runs the built Worker locally with Wrangler on **http://localhost:8787**. Closest to production. |
| `npm run deploy` | `vinext-cloudflare deploy --config dist/server/wrangler.json`. Builds and deploys to Cloudflare. Run `npm run build` first or let the command build. |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`). |
| `npm run lint` / `lint:fix` | ESLint. |
| `npm run check` | typecheck + lint + build. Run before every commit and in CI. |
| `npm run cf-typegen` | `wrangler types` → `worker-configuration.d.ts` (binding types). Re-run after editing `wrangler.jsonc`. |
| `npm run db:migration:new -- <name>` | Creates the next empty SQL file in `migrations/`. |
| `npm run db:migrate:local` | Applies pending migrations to the local D1. |
| `npm run db:migrate:remote` | Applies pending migrations to the **production** D1. |
| `npm run db:list:local` | Lists migration status locally. |
| `npm run db:migrate:preview` | Applies migrations to the **preview** database. `npm run preview` runs it for you: the built Worker uses its own local D1 under `dist/server/.wrangler`, separate from the one `npm run dev` uses, and `vite build` clears it. |
| `npm run db:seed:generate` | Rebuilds `db/seed/content.sql` from the typed content and the reference site. |
| `npm run db:seed:local` / `:preview` / `:remote` | Loads the website content into that database. Do not re-run once editors use the admin. |
| `npm run db:verify` / `db:verify:local` | Checks schema, seed, queries and constraints (see `DATABASE.md` §9). |
| `npm run admin:create` | Creates or resets an admin user (`ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD`; add `-- --preview` or `-- --remote`). |

Drizzle (`drizzle-kit generate`) is planned for the schema phase. Until then migrations are plain SQL files created with `db:migration:new`.

## 5. Project layout (deployment-relevant)

```
visuolab-next/
├─ vite.config.ts          vinext() + cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } })
├─ wrangler.jsonc          Worker name, account, bindings, vars. main = "vinext/server/fetch-handler"
├─ next.config.ts          legacy .html → clean URL redirects
├─ migrations/             D1 SQL migrations (0000_app_meta.sql is the baseline)
├─ src/app/                routes (placeholder home + /api/health)
├─ src/styles/             the six original CSS files, unmodified
├─ public/assets/          original images and video (copied; originals still in referance-website/)
├─ worker-configuration.d.ts   generated types (git-tracked is optional)
├─ .env / .dev.vars        local secrets (git-ignored)
└─ dist/                   build output (git-ignored)
```

`vinext init` ran with `--platform=cloudflare --legacy-wrangler-cloudflare-init --cdn-cache=none --data-cache=none --image-optimization=none`. That keeps the Wrangler configuration (instead of the newer `cf` / `cloudflare.config.ts` format) and turns off cache and image adapters until they are chosen deliberately.

## 6. Configuration

### 6.1 `wrangler.jsonc`

| Key | Value | Note |
|---|---|---|
| `name` | `visuolab-next` | Worker name |
| `account_id` | `48fa30c6…e01` | Pins deploys to the Visuolab account |
| `main` | `vinext/server/fetch-handler` | vinext request handler. Replace with `./worker/index.ts` only if a custom entry is needed (for example Cron `scheduled`). |
| `compatibility_flags` | `nodejs_compat`, `global_fetch_strictly_public` | |
| `assets` | `dist/client`, binding `ASSETS` | Static build output |
| `d1_databases` | `DB` → `visuolab` (`09818a92-a4b7-4ec1-a009-740b8e353402`) | `migrations_dir: "migrations"` |
| `r2_buckets` | `MEDIA` → `visuolab-media` | |
| `observability` | enabled | Workers Logs |
| `vars` | `SITE_URL`, `MAIL_FROM`, `MAIL_TO` | Non-secret |

**Before the first production deploy:** change `SITE_URL` from `http://localhost:3001` to the real origin.

### 6.2 Environment variables and secrets

| Name | Type | Where it lives |
|---|---|---|
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | CLI only | `.env` locally; CI secrets. Never read by the Worker. |
| `SESSION_SECRET` (salt for visitor hashes; required in production), `RESEND_API_KEY` (optional until the key exists) | Worker secrets | `.dev.vars` locally; `npx wrangler secret put <NAME>` in production |
| `SITE_URL`, `MAIL_FROM`, `MAIL_TO` | Worker vars | `wrangler.jsonc` |
| Bindings `DB`, `MEDIA`, `ASSETS` | Bindings | `wrangler.jsonc` |

Secrets are typed in `src/cloudflare-env.d.ts` (`wrangler types` does not know them). The contact form, rate limiting and the admin area are described in `CONTACT-FORM.md`; the remote database needs `npm run db:migrate:remote` before the first deploy of those features (not run yet).

Read bindings in server code with `import { env } from "cloudflare:workers"` (see `src/app/api/health/route.ts`). No `NEXT_PUBLIC_` prefix for secrets.

`wrangler secret put` writes to the Worker deployed under `name`, so deploy once before setting production secrets, or use `npx wrangler secret put NAME --name visuolab-next`.

## 7. Local development

```
cd visuolab-next
npm run db:migrate:local
npm run dev                 # http://localhost:3001
```

Useful URLs: `/` (placeholder), `/api/health` (checks D1 and R2), `/cdn-cgi/local/explorer/api` (local D1/R2 explorer API).

Notes:

- Local D1 and R2 data live in `.wrangler/state` and are separate from the remote database. Deleting that folder resets local data.
- After changing `wrangler.jsonc`, run `npm run cf-typegen` and restart the dev server.
- Fonts still load from Google Fonts (as in the original site).
- Windows/Git Bash tip: when using `curl` with paths such as `/api/health`, quote them or use PowerShell, since Git Bash may rewrite leading-slash arguments.

### Testing the production build locally

```
npm run preview             # http://localhost:8787
```

## 8. Deploying to Cloudflare

### 8.1 One-time

1. Confirm the account: `npx wrangler whoami`.
2. Apply migrations to the remote D1: `npm run db:migrate:remote`, then `npm run db:seed:remote` (first time only) and `npm run admin:create -- --remote`.
3. Set secrets (once they exist): `npx wrangler secret put SESSION_SECRET`, and likewise `RESEND_API_KEY`, `TURNSTILE_SECRET`.
4. Set the final `SITE_URL` in `wrangler.jsonc`.
5. Decide the hostname: the first deploy publishes at `https://visuolab-next.<account-subdomain>.workers.dev`. For a custom domain add a `routes` entry (`{ "pattern": "example.com", "custom_domain": true }`) to `wrangler.jsonc` once the domain is on the Cloudflare account.

### 8.2 Each release

```
npm run check               # typecheck + lint + build
npm run db:migrate:remote   # only when migrations/ changed
npm run deploy
```

Order matters: apply forward-compatible migrations first, then deploy the code that uses them.

### 8.3 Verify after deploy

```
curl https://<your-worker-host>/api/health     # {"status":"ok","checks":{"d1":"ok","r2":"ok"}}
```

### 8.4 Rollback

- Code: `npx wrangler rollback` (or choose a previous version in the dashboard under Workers → Deployments).
- Data: D1 Time Travel (`npx wrangler d1 time-travel restore visuolab --timestamp <ISO time>`). Record a bookmark before every production migration (`npx wrangler d1 time-travel info visuolab`).

### 8.5 Staging (not set up yet)

Add an `env.staging` block to `wrangler.jsonc` with its own Worker name, D1 database and R2 bucket, then deploy with `vinext-cloudflare deploy --config dist/server/wrangler.json --env staging`. No `deploy:staging` script exists until this is configured.

## 9. Caching and images (decisions pending)

Initialised with no cache adapter and no Cloudflare Images binding. Both are opt-in later without changing routes:

- Data cache for `"use cache"`: `kvDataAdapter()` plus a KV namespace.
- Page cache (ISR): `workersCacheCdnAdapter()`, `staticAssetsAdapter()` or `responseStoreAdapter()` declared in `vite.config.ts` (`vinext({ cache: {...} })`).
- Image optimization: `npx vinext init --platform=cloudflare --legacy-wrangler-cloudflare-init --image-optimization=cloudflare-images`. The architecture currently plans plain `<img>` with pre-sized WebP, so this is not needed.

The choice is Phase 0 of the delivery plan in `ARCHITECTURE.md`.

## 10. CI outline (not created yet)

1. `npm ci`
2. `npm run cf-typegen`
3. `npm run check`
4. On release: `npm run db:migrate:remote`, then `npm run deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as encrypted secrets, using a token limited to this account.

## 11. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `typescript-eslint does not support TS 7.0` | Keep `typescript` at `~6` until `typescript-eslint` supports TS 7. |
| `Cannot find module 'cloudflare:workers'` types | Run `npm run cf-typegen`; `worker-configuration.d.ts` must be in `tsconfig.json` `include`. |
| `/api/health` returns `d1: error` locally | Run `npm run db:migrate:local` and restart the dev server. |
| Deploy goes to the wrong account | Check `npx wrangler whoami`. `account_id` in `wrangler.jsonc` and `.env` must both be the Visuolab account. |
| Error mentioning `Duplicate @vitejs/plugin-rsc` | Do not register `@vitejs/plugin-rsc` manually; vinext does it. |
| Build warnings `INEFFECTIVE_DYNAMIC_IMPORT` from `node_modules/vinext` | Known, harmless, from vinext internals. |
| `npm audit` reports 10 issues (4 moderate, 6 high) | Today they trace to transitive packages: `braces`/`fast-glob` (via `eslint-config-next` and `vinext`) and `fflate` (via `satori` / `@vercel/og`, which vinext bundles for OG images). Re-check after upgrades; do not run `audit fix --force` blindly. |
| `EPERM, Permission denied ... dist` during build | A previous `npm run preview` left a `workerd` process holding `dist/`. Stop it (`Get-Process workerd | Stop-Process`) and rebuild. |
