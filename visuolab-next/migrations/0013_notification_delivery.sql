-- Contact notifications: delivery status per enquiry, and protection against the same enquiry being stored twice.
--
-- The enquiry is saved first, then a notification e-mail is attempted. Whatever happens to the e-mail is recorded here and never
-- affects the saved enquiry: notify_status says what happened, notify_attempts how often it was tried, notify_error why not.

ALTER TABLE contact_submissions ADD COLUMN notify_status TEXT NOT NULL DEFAULT 'pending' CHECK (notify_status IN ('pending', 'sent', 'failed', 'skipped'));
ALTER TABLE contact_submissions ADD COLUMN notify_provider TEXT;                       -- which provider took (or refused) the message, e.g. resend
ALTER TABLE contact_submissions ADD COLUMN notify_message_id TEXT;                     -- the provider's own id for the message, when it gave one
ALTER TABLE contact_submissions ADD COLUMN notify_attempts INTEGER NOT NULL DEFAULT 0 CHECK (notify_attempts >= 0);
ALTER TABLE contact_submissions ADD COLUMN notify_last_attempt_at TEXT;

-- Idempotency: the form sends a random key made when the form appeared. The same key can be stored once (a double click, or a
-- retry after a lost answer, returns the first result instead of a second enquiry). Rows without a key (older ones) are not affected.
ALTER TABLE contact_submissions ADD COLUMN idempotency_key TEXT CHECK (idempotency_key IS NULL OR length(idempotency_key) BETWEEN 16 AND 64);
CREATE UNIQUE INDEX uq_contact_idempotency ON contact_submissions (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- A fingerprint of (e-mail, message): the same text from the same address within minutes is the same enquiry sent again.
ALTER TABLE contact_submissions ADD COLUMN content_hash TEXT CHECK (content_hash IS NULL OR length(content_hash) = 32);
CREATE INDEX idx_contact_content_hash ON contact_submissions (content_hash, created_at DESC);

CREATE INDEX idx_contact_notify ON contact_submissions (notify_status, created_at DESC);

-- Enquiries received before delivery tracking: derive the status from what was recorded then.
UPDATE contact_submissions SET notify_status = CASE
  WHEN notified_at IS NOT NULL THEN 'sent'
  WHEN status = 'spam' THEN 'skipped'
  WHEN notify_error IN ('not configured', 'disabled', 'no recipient') THEN 'skipped'
  WHEN notify_error IS NOT NULL THEN 'failed'
  ELSE 'pending' END,
  notify_attempts = CASE WHEN notified_at IS NOT NULL OR notify_error IS NOT NULL THEN 1 ELSE 0 END;
