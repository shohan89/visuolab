# Integration management

One layer manages everything the website connects to. Admin: **Integrations** in the sidebar (`/admin/integrations`). The public design is unchanged. The only visitor-facing change is the optional Cloudflare Turnstile widget, which exists only while Turnstile is switched on and fully configured.

The email provider (Resend) and the enquiry delivery record are described in [INTEGRATIONS.md](INTEGRATIONS.md); this file covers the management layer around them.

## The integrations

| Slug | Name | Kind | Settings (public-safe, in D1) | Cloudflare secrets | What it does |
|---|---|---|---|---|---|
| `ga4` | Google Analytics 4 | analytics | measurement ID | none | Loads the Google tag on public pages (real https site only) |
| `gtm` | Google Tag Manager | analytics | container ID | none | Loads the container (real https site only) |
| `meta_pixel` | Meta Pixel | analytics | pixel ID | none | Loads the pixel (real https site only) |
| `resend` | Email notifications | email | provider, sender, recipients | `RESEND_API_KEY` | Emails the team for each enquiry |
| `turnstile` | Cloudflare Turnstile | bot protection | site key | `TURNSTILE_SECRET` | Verifies a visitor proof on the server |
| `webhook` | Webhook | outgoing | events | `WEBHOOK_URL`, optional `WEBHOOK_SECRET` | Signed JSON POST per event |
| `crm_webhook` | CRM webhook | outgoing | events | `CRM_WEBHOOK_URL`, optional `CRM_WEBHOOK_TOKEN` | Creates a lead in a CRM |
| `slack` | Slack notifications | outgoing | events | `SLACK_WEBHOOK_URL` | Posts a message in a Slack channel |

Events today: `contact.submitted` (a new, non-spam enquiry). New events are one line in `EVENTS` (`src/lib/integrations/core.ts`).

## States

Every integration is always in exactly one of four states, shown as a word on the overview, the detail page and the dashboard count.

| State | Meaning |
|---|---|
| **Connected** | Switched on, everything it needs is present, and the last run did not fail (or it has not run yet) |
| **Disconnected** | Switched off |
| **Configuration required** | Switched on, but something is missing: a setting, a Cloudflare secret, an unusable secret value, or (analytics) a `SITE_URL` that is not a public https address. The reasons are listed. |
| **Error** | Switched on and complete, but the last run failed (for example "answered 500", "timeout"). The next successful run clears it. |

The rule is one pure function, `deriveState()` in `src/lib/integrations/core.ts`; analytics scripts cannot fail on the server, so only server-run integrations reach Error. The dashboard shows "Integration problems" = Configuration required + Error.

## Secrets and safety

- **Credentials are Cloudflare secrets only** (`npx wrangler secret put NAME`; `.dev.vars` locally). The database and the admin hold their *names* and whether each is set, never a value. There is no input field for a secret anywhere.
- Webhook, CRM and Slack **addresses are secrets too** (an address can carry a token). Settings keep only which events to send.
- A value that looks like a key or a secret address (Resend, Slack, GitHub, AWS, Stripe, PEM, `hooks.slack.com/services/…`, `?token=`) is refused as a setting.
- Outgoing addresses must be **https**, with no user name or password in them, and not local or private hosts (`localhost`, `127.*`, `10.*`, `192.168.*`, `169.254.*`, `*.internal`, …). Slack addresses must be on `slack.com`. Redirects are not followed. `INTEGRATIONS_ALLOW_HTTP=1` lifts the https/host rules for local development and tests only; never set it in production.
- Runs are executed **on the server**; the browser never calls a webhook, CRM, Slack or the mail provider. Each has a 5 second time limit.
- Messages are plain data: Slack text is escaped (`& < >`), so visitor input cannot become a link, a mention or `@channel`. The generic webhook is signed (see below).
- The activity log and the audit log hold short safe reasons ("answered 500", "timeout") and the names of what changed. They never hold an address, a token, the receiver's answer, or settings values.

## Outgoing messages

All carry headers `X-Visuolab-Event` and `X-Visuolab-Delivery` (`<submission id>:<event>`, stable per enquiry so a receiver can de-duplicate).

**Webhook** body: `{ "event", "id", "createdAt", "site", "data": { id, name, email, company, service, budget, message, createdAt } }`. If `WEBHOOK_SECRET` is set the request also has `X-Visuolab-Timestamp` and `X-Visuolab-Signature: sha256=<hex>` where the hex is HMAC-SHA256 of `"<timestamp>.<raw body>"` with that secret. The receiver recomputes it and should reject old timestamps.

**CRM webhook** body: `{ "event", "site", "createdAt", "lead": { id, name, email, company, need, budget, message, source } }`, with `Authorization: Bearer <CRM_WEBHOOK_TOKEN>` when that secret is set.

**Slack**: `{ "text": "…" }` with the enquiry summarised in a few escaped lines.

Test sends use event `integration.test` and a `test` payload instead of an enquiry.

## When they run

`submitContact` saves the enquiry first. Then, for a non-spam enquiry: the email is sent (as before, before the answer), and the outgoing integrations run **after the answer** (`background()` → `waitUntil`), so a slow or broken receiver never delays or fails the visitor. Only integrations that are switched on, complete and subscribed to the event run. Each result is written to the activity log and updates the integration's state (`last_success_at`, `last_error`, `last_checked_at`).

There is no automatic retry queue yet: a failed send is logged and shown as Error; the next enquiry tries again, and the **Test** button can be used at any time. (A queue is the natural next step if guaranteed delivery is needed; the activity row has the enquiry id to build it on.)

## Turnstile

When Turnstile is on, has a site key, and `TURNSTILE_SECRET` is set, the contact form renders an *interaction-only* widget (invisible unless Cloudflare needs the visitor to do something) and the server verifies the proof with Cloudflare before saving.

- Proof rejected, or none sent: the enquiry is **kept as spam** (reviewable in Submissions), no notifications are sent, and the visitor sees the normal success. Integration stays Connected: this is the check working.
- Cloudflare unreachable, or the secret key rejected: the enquiry is **let through** (a real customer matters more than a missed check) and the integration shows **Error** with the reason.
- When Turnstile is off or incomplete, the contact page has no widget element and the form is exactly the designed one.
- The **Test** button sends a dummy proof with the secret; Cloudflare's answer shows whether the secret is accepted.

## Admin

- **Overview** (`/admin/integrations`): four counts, then every integration grouped (Analytics, Email, Bot protection, Webhooks) with state, reasons and last success.
- **Detail** (`/admin/integrations/<slug>`): Status box (state, reasons, what it does, last success/error), the settings form (switch + public-safe fields, generated from the catalog), the Cloudflare secrets table (set / not set / set but not usable, with the exact `wrangler secret put` command), the **Test** button (runs on the server, rate limited to 10 per 10 minutes), and the **Activity** list (last runs, kept 30 days).
- Saves and tests are audited (names of what changed only).
- The older **Settings → Analytics** and **Settings → Integrations** screens still work and edit the same data; they link here. Saving the older Analytics screen keeps the per-service switches chosen here.

## Where the data lives

| Data | Where |
|---|---|
| GA4 / GTM / Pixel IDs and switches | `settings.analytics` (`ga4`, `gtm`, `metaPixel`, `ga4On`, `gtmOn`, `pixelOn`; `enabled` is the master switch and follows the services) |
| Email, Turnstile settings | `integrations` rows `resend`, `turnstile` |
| Webhook, CRM, Slack switch and events | `integrations` rows `webhook`, `crm_webhook`, `slack` (created on first save) |
| Last success / error / checked | `integrations.last_success_at`, `last_error`, `last_checked_at` |
| Activity | `integration_events` (migration `0014_integration_events.sql`) |

## Adding an integration

1. Add an entry to `CATALOG` in `src/lib/integrations/core.ts` (slug, label, kind, fields, schema, secret names, what is missing, test text). Add the slug to `SLUGS`.
2. If it keeps its own settings, add a case to `readSettings`/`saveIntegration` in `src/lib/server/integrations.ts`; outgoing integrations that are plain "POST a message" need only a builder in `src/lib/integrations/outbound.ts` and the slug in `OUTBOUND`.
3. Add its secret names to `src/cloudflare-env.d.ts` and `.dev.vars.example`.

The overview, detail page, state rules, secrets table, test button, activity log, dashboard count and audit entries work without further changes.

## Tests

- `npm run db:verify` (227 checks): catalog, state rules, problem detection, setting validation, secret-shape guard, address rules, message building and escaping, signing (checked against Node's HMAC), sending with fake fetch (headers, redirects, 5xx/4xx, unreachable, timeout), migration 0014.
- `integrations-test.mjs` phase A (22 checks, no secrets set): overview, states, validation, analytics switches and their interplay with the older screen, access control, audit.
- Phase B (39 checks, secrets pointing at a local fake receiver): secrets shown as set without values, Connected, tests, one enquiry reaching webhook/CRM/Slack/email once each, signature verified independently, Slack escaping, failure → Error → recovery, hung receiver not holding the visitor, off = silent, email Error/recovery, Turnstile widget and every verdict, retention, and a sweep for secret leaks in all admin pages, public pages, activity and audit logs.

## Going live

Set the secrets you use: `npx wrangler secret put WEBHOOK_URL` (and `WEBHOOK_SECRET`, `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_TOKEN`, `SLACK_WEBHOOK_URL`, `TURNSTILE_SECRET`, `RESEND_API_KEY`), apply migration `0014` to the live D1 (`npm run db:migrate:remote`), then switch each integration on in **Integrations** and press **Test**. Do not set `INTEGRATIONS_ALLOW_HTTP`, `EMAIL_API_BASE` or `TURNSTILE_VERIFY_URL` in production.
