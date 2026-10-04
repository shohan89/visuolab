-- Site-wide settings, navigation, third-party integrations and the audit trail.

-- site_settings: named JSON documents for everything that is not a page of its own: the company facts, the reviews carousel,
-- the lists on the home and About pages (FAQ, timeline, offices, ...), footer details. One row per document, found by key.
CREATE TABLE IF NOT EXISTS site_settings (
  id          TEXT PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,                              -- e.g. reviews, home.stats, about.faq
  title       TEXT NOT NULL,                                     -- label shown in the admin
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  value_json  TEXT NOT NULL CHECK (json_valid(value_json)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT REFERENCES users (id) ON DELETE SET NULL
);

-- navigation_items: every menu on the site in one table. A parent row (parent_id NULL) with children makes a group,
-- e.g. a mega-menu column or a footer column.
CREATE TABLE IF NOT EXISTS navigation_items (
  id          TEXT PRIMARY KEY,
  menu        TEXT NOT NULL CHECK (menu IN ('primary', 'cta', 'mega_cards', 'mega_promo', 'mega_columns', 'footer')),
  parent_id   TEXT REFERENCES navigation_items (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  label       TEXT NOT NULL,
  href        TEXT,                                              -- NULL for a group heading
  description TEXT,                                              -- the line under a mega-menu card or the promo
  tag         TEXT,                                              -- small badge, e.g. "1–2 weeks"
  icon_key    TEXT,                                              -- name of an icon drawn in code
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
-- one item per position within a menu (or within a group); COALESCE because NULL parents would otherwise never collide
CREATE UNIQUE INDEX uq_navigation_position ON navigation_items (menu, COALESCE(parent_id, ''), position);
CREATE INDEX idx_navigation_menu_position ON navigation_items (menu, position);
CREATE INDEX idx_navigation_parent        ON navigation_items (parent_id);

-- integrations: external services the site uses. config_json holds settings that are safe to show; the secret itself
-- (API key, token) is never stored here, only the NAME of the Worker secret that holds it (secret_name).
CREATE TABLE IF NOT EXISTS integrations (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,                          -- resend, turnstile, analytics
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled', 'enabled', 'error')),
  config_json     TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(config_json)),
  secret_name     TEXT,                                          -- e.g. RESEND_API_KEY
  last_checked_at TEXT,
  last_error      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  updated_by      TEXT REFERENCES users (id) ON DELETE SET NULL
);

-- audit_logs: append-only record of changes made in the admin. Rows are never updated; the user link is cleared (not the row)
-- if the user is deleted, and the e-mail is kept so the entry still says who did it.
CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users (id) ON DELETE SET NULL,
  user_email  TEXT,
  action      TEXT NOT NULL,                                     -- create, update, delete, publish, sign_in, ...
  entity_type TEXT NOT NULL,                                     -- service, case_study, blog_post, media, setting, ...
  entity_id   TEXT,
  summary     TEXT NOT NULL,
  diff_json   TEXT CHECK (diff_json IS NULL OR json_valid(diff_json)),
  ip_hash     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_entity  ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_user    ON audit_logs (user_id);
