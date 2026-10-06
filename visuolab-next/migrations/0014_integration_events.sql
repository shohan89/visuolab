-- Integration management: when an integration last worked, and a log of what each one did.
-- No secret is stored here either: only outcomes (status, HTTP code, a short safe reason).

ALTER TABLE integrations ADD COLUMN last_success_at TEXT;

-- integration_events: one row per run of an integration (an outgoing webhook, a Slack message, an e-mail, a test, a spam check).
-- `error` is a short reason written by the code ("answered 404", "timeout"), never the provider's raw answer and never a URL.
-- `ref` points at what triggered it (a submission id) so a failure can be traced; rows older than 30 days are deleted as new ones are written.
CREATE TABLE IF NOT EXISTS integration_events (
  id          TEXT PRIMARY KEY,
  integration TEXT NOT NULL,                                   -- slug: resend, turnstile, webhook, crm_webhook, slack, ga4, gtm, meta_pixel
  event       TEXT NOT NULL,                                   -- contact.submitted, integration.test, ...
  status      TEXT NOT NULL CHECK (status IN ('ok', 'failed', 'skipped')),
  http_status INTEGER,
  error       TEXT,
  duration_ms INTEGER,
  ref         TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_integration_events_slug ON integration_events (integration, created_at DESC);
CREATE INDEX idx_integration_events_time ON integration_events (created_at);
