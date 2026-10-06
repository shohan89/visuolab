# Integrations and contact notifications

> The management layer (all integrations, states, secrets status, tests, activity log, webhooks, CRM, Slack, Turnstile) is in [INTEGRATION-MANAGEMENT.md](INTEGRATION-MANAGEMENT.md). This file covers the email provider and the delivery record on each enquiry.

How a message from the contact form reaches the team, how the email provider is configured, and how to swap it.

```
Visitor ─▶ Contact form ─▶ Server action (origin check ▸ validation ▸ rate limits ▸ duplicate check ▸ spam checks)
                                         │
                                         ▼
                                    SAVE in D1  ◀── the enquiry is safe from here on
                                         │
                                         ▼
                        Notification service ─▶ EmailProvider (Resend today) ─▶ team inbox
                                         │
                                         ▼
                    delivery record on the enquiry (status, attempts, reason, message id)
                                         │
                                         ▼
                      Admin: submissions list, filter, "Send notification", dashboard count
```

## The three rules this follows

1. **Persistence never depends on email.** The enquiry is written to D1 first. The notification is attempted afterwards by `notifySubmission(id)`, whose result the form ignores: whatever happens (no key, provider down, bad sender, timeout, a bug) is written to the enquiry's delivery record and nothing else. The visitor always gets the same success answer once the enquiry is stored. Tested with the provider answering 500, 401, 429, hanging, and refusing connections.
2. **No secret in the browser, the database or the logs.** The API key is a Cloudflare secret read inside the Worker at the moment of sending. See "Secrets".
3. **One enquiry, one record, at most one automatic email.** See "Idempotency".

## Configuration

| What | Where | Notes |
|---|---|---|
| Email API key | Cloudflare secret `RESEND_API_KEY` | `npx wrangler secret put RESEND_API_KEY`; local: `.dev.vars` (git-ignored). Never entered in the admin. |
| Provider, sender, notification addresses, on/off | Admin → **Settings → Integrations** (table `integrations`, row `resend`) | Sender must be on a domain verified with the provider. 1–5 recipients. |
| Contact address shown to visitors | Admin → Settings → Contact | Also used in the form's error messages. |
| `EMAIL_API_BASE` (optional) | Worker variable | Address of the provider API when it is reached through a proxy (or a test server). Empty: the provider's own address. |
| `MAIL_FROM`, `MAIL_TO` | `wrangler.jsonc` vars | Only fallbacks when no integration row exists. |

Setting up the live site: create the Resend API key, `npx wrangler secret put RESEND_API_KEY`, verify the sender domain in Resend, set the sender and recipients under Settings → Integrations, press **Send test email**, then send a real enquiry through the form.

## Secrets

- The key lives only in the Worker environment. `src/lib/server/notifications.ts` reads it (`env[provider.secretName]`) and passes it to the provider for one request; it is not stored, logged, returned, or included in any message body (it travels in the `Authorization` header only).
- The Integrations screen shows each secret's **name, purpose and set / not set**; there is no field for a value. Settings text fields refuse values shaped like API keys.
- Checked: the key is not in any page, any script the browser loads, the admin pages, the server action's answer, or any database column (settings, integrations, delivery records). The provider's raw answer is never stored either: failures are recorded as short fixed reasons (`mail provider answered 401`, `timeout`, `could not reach the mail provider`).

## Delivery status

Every enquiry carries a delivery record (migration `0013`):

| Column | Meaning |
|---|---|
| `notify_status` | `pending` (not tried yet, or the attempt was cut short), `sent` (the provider accepted it), `failed`, `skipped` |
| `notify_error` | the reason for `failed` or `skipped` |
| `notify_attempts`, `notify_last_attempt_at` | written **before** each attempt, so an attempt that is interrupted still shows as tried |
| `notify_provider`, `notify_message_id` | which provider, and its own id for the message when it gave one |
| `notified_at` | when the provider accepted it |

`skipped` reasons: `spam` (kept for review, never emailed), `disabled` (switched off, or provider "none"), `not configured` (no API key), `no recipient`. Failure reasons are fixed texts: `mail provider answered <status>`, `timeout` (the provider did not answer within 5 seconds, so the visitor waits at most that long), `could not reach the mail provider`, `internal error`.

"Sent" means the provider accepted the message. Whether it reached an inbox is the provider's own delivery report (Resend dashboard).

## What the admin sees

- **Submissions list:** each enquiry shows a badge (sent / failed / pending / skipped), a plain sentence ("Notification failed: the mail provider did not answer in time"), the time it was accepted, the attempt count and the provider.
- **Filter "Notification problems":** real enquiries whose notification failed or was never tried (spam and deliberate skips are not problems).
- **Dashboard:** a "Notification problems" count linking to that filter.
- **"Send notification" / "Send notification again":** sends the email for that enquiry now and records the new attempt (20 per admin per 10 minutes; written to the audit log). It changes only the delivery record, never the enquiry.
- **Settings → Integrations → Send test email:** a short message to the recipients; the last result is shown there.

## Idempotency and duplicates

- **Form key.** Each time the form appears it makes a random UUID and sends it with every try. The database has a unique index on it (`uq_contact_idempotency`), so a double click, or a retry after a lost answer, returns the original success and creates no second enquiry and no second email. Two identical requests arriving at the same moment are decided by the index: exactly one is stored and one email goes out (tested with four at once).
- **Content check.** The same e-mail and the same text (spacing and capitals ignored) within 10 minutes is the same enquiry sent again: answered with success, nothing stored or sent. After 10 minutes, or with different text, it is a new enquiry. This also covers a visitor who reloads and resubmits, and scripted posts without a key.
- Rate limits are applied **before** the duplicate check, so replays still count against the visitor, e-mail address and site limits.
- Admin "send again" is deliberate and is never blocked by these rules.

## The provider abstraction

```
src/lib/integrations/email/
  types.ts      EmailMessage, SendResult, EmailProvider, EMAIL_PROVIDER_IDS
  resend.ts     the Resend implementation (the only file that knows Resend's API)
  registry.ts   id -> provider
  delivery.ts   attempt(provider, key, message) -> Outcome; wording for the admin
src/lib/mail/build.ts            builds the messages (enquiry, test) as EmailMessage
src/lib/server/notifications.ts  settings + secret -> provider -> attempt -> delivery record
```

The contact form, the admin and the delivery records know only `EmailMessage` and `Outcome`. A provider is one object with an `id`, the name of its secret, and `send(message, { apiKey, baseUrl, timeoutMs }) -> { ok, messageId } | { ok: false, retryable, reason }`.

**To change provider** (Postmark, SES, SendGrid, …): write `src/lib/integrations/email/<name>.ts` implementing `EmailProvider`; add its id to `EMAIL_PROVIDER_IDS` and the object to `registry.ts`; `npx wrangler secret put <ITS_SECRET>`; choose it under Settings → Integrations. No change to the contact form, the delivery table or the admin screens. `db:verify` shows the swap with a fake provider.

## Retrying

There is no automatic retry queue yet (a cron-driven retry of `failed` and `pending` records is the natural next step; `retryable` is already recorded in the provider result). Until then nothing is lost: every failed or unsent notification is visible and counted in the admin and can be re-sent with one click.

## Tests

- `db:verify` (183 checks): the provider contract and registry; the exact Resend request (URL, method, key only in the `Authorization` header, plain-text body, reply-to); an alternate base address; 401/422 not retryable, 429/503 retryable; reasons never contain the provider's answer or the key; timeout and network failure; a fake provider plugging in without other changes, and a throwing provider; the admin wording; the delivery columns, the unique idempotency index (and `NULL` keys unaffected), the CHECK constraints; migration `0013` turning recorded results into statuses.
- `notify-test.mjs` (38 checks, a fake Resend server, real browser, local D1): the happy path (one request with exactly the expected headers and body, injection in the visitor's name neutralised, nothing delivery-related in the server action's answer); 500, 401, 429, a hanging provider (visitor waits at most the 5 s limit) and an unreachable provider, each with the enquiry stored, success shown, failure recorded; the admin list, filter, dashboard count and retry (only the delivery record changes); replay of the same request, four identical requests at once, the same text with different spacing, a different text, the 10-minute window; spam kept and skipped; notifications switched off and provider "none"; "send again"; the key absent from every page, script, admin page and database column; audit entries; no horizontal scroll at 390 px; no console errors.
- The existing contact form (30), settings (59), dashboard (30) and admin (28) suites pass with the new flow.

## Troubleshooting

| You see | Meaning | Do |
|---|---|---|
| "No notification: the email API key is not set" | `RESEND_API_KEY` is not a Worker secret | `npx wrangler secret put RESEND_API_KEY`, then press "Send notification" on the enquiry |
| "Notification failed: mail provider answered 401" | the key is wrong or revoked | set a new key |
| "… answered 403 / 422" | sender domain not verified, or an invalid address | verify the domain in Resend; check Settings → Integrations |
| "… answered 429 / 5xx", "timeout", "could not reach" | the provider is limiting or down | wait, then "Send notification" |
| "No notification: email notifications are switched off" | Settings → Integrations has notifications off or provider "None" | switch on |
| Enquiry in the list but no email | check the badge and reason on that enquiry; use **Send test email** | |
