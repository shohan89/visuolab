-- CMS authentication tables.
--
-- users:    the people who can sign in to /admin. Passwords are stored only as PBKDF2 hashes.
-- sessions: one row per signed-in browser. The browser holds a random token; only its SHA-256 is stored here, so a copy of
--           this table cannot be used to sign in. Sessions now belong to a user (the first version was keyed by e-mail).

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,                                   -- pbkdf2$sha256$<iterations>$<salt>$<hash>
  role          TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_login_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Old sessions only hold a sign-in that lasts at most 14 days; replacing the table just signs everyone out once.
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,                                 -- SHA-256 (hex) of the session token
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,                                    -- absolute limit (14 days)
  last_seen_at TEXT NOT NULL,                                    -- idle limit (12 hours) is measured from here
  ip_hash      TEXT,
  user_agent   TEXT
);
CREATE INDEX idx_sessions_user    ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);
