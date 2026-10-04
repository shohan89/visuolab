-- Admin sign-in sessions. The browser holds a random token; only its SHA-256 is stored here, so a copy of this table
-- cannot be used to sign in.
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,   -- SHA-256 (hex) of the session token
  email        TEXT NOT NULL,
  created_at   TEXT NOT NULL,      -- ISO 8601, UTC
  expires_at   TEXT NOT NULL,      -- absolute limit (14 days)
  last_seen_at TEXT NOT NULL,      -- idle limit (12 hours) is measured from here
  ip_hash      TEXT,
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
