# Visuolab

Migration of the Visuolab static website into a full-stack Next.js application on Cloudflare Workers.

| Folder | Contents |
|---|---|
| `referance-website/` | Original static HTML/CSS/JS site. Design source of truth. Do not edit. |
| `visuolab-next/` | New app: Next.js App Router + TypeScript on vinext (Vite), Cloudflare Workers, D1, R2. |
| `docs/` | `EXISTING-SITE-AUDIT.md`, `ARCHITECTURE.md`, `DEPLOYMENT.md`. |

## Quick start

```
cd visuolab-next
npm install
copy .dev.vars.example .dev.vars
npm run db:migrate:local
npm run dev
```

See `docs/DEPLOYMENT.md` for local development and Cloudflare deployment. Secrets (`.env`, `.dev.vars`) are git-ignored and must never be committed.
