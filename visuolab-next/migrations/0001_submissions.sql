-- Contact form submissions + rate limiting.
-- Personal data kept: name, email, company, the message and the choices made on the form.
-- The visitor's IP address is never stored, only a salted hash (enough to spot repeats, not to identify anyone).

CREATE TABLE IF NOT EXISTS submissions (
  id          TEXT PRIMARY KEY,                       -- random UUID
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  company     TEXT,
  service     TEXT,                                   -- "What do you need?" choices, joined with ", "
  budget      TEXT,                                   -- budget range choice
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'new'
              CHECK (status IN ('new', 'read', 'replied', 'archived', 'spam')),
  source      TEXT NOT NULL DEFAULT 'contact-page',   -- which form on the site it came from
  ip_hash     TEXT,                                   -- salted SHA-256 (truncated) of the IP address
  user_agent  TEXT,                                   -- truncated to 200 characters
  notified_at TEXT,                                   -- when the notification email was accepted by the mail provider
  notify_error TEXT,                                  -- why it was not, if it was not
  created_at  TEXT NOT NULL,                          -- ISO 8601, UTC
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created ON submissions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions (email);

-- Fixed-window counters used by the form (per visitor, per email address, site-wide) and by admin sign-in.
CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,                      -- unix seconds
  count        INTEGER NOT NULL
);
