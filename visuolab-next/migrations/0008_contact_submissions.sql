-- The contact form table gets its final name. `submissions` (0001) becomes `contact_submissions`; rows are kept.

CREATE TABLE contact_submissions (
  id           TEXT PRIMARY KEY,                                 -- random UUID
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  company      TEXT,
  service      TEXT,                                             -- "What do you need?" choices, joined with ", "
  budget       TEXT,
  message      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived', 'spam')),
  source       TEXT NOT NULL DEFAULT 'contact-page',             -- which form on the site it came from
  ip_hash      TEXT,                                             -- salted SHA-256 (truncated) of the IP address; the address is never stored
  user_agent   TEXT,                                             -- truncated to 200 characters
  notified_at  TEXT,                                             -- when the notification e-mail was accepted by the mail provider
  notify_error TEXT,                                             -- why it was not, if it was not
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

INSERT INTO contact_submissions (id, name, email, company, service, budget, message, status, source, ip_hash, user_agent, notified_at, notify_error, created_at, updated_at)
SELECT id, name, email, company, service, budget, message, status, source, ip_hash, user_agent, notified_at, notify_error, created_at, updated_at FROM submissions;

DROP TABLE submissions;

CREATE INDEX idx_contact_status_created ON contact_submissions (status, created_at DESC);
CREATE INDEX idx_contact_created        ON contact_submissions (created_at DESC);
CREATE INDEX idx_contact_email          ON contact_submissions (email);
