-- Media library: every image and video the site shows.
-- storage = 'static': a file shipped with the site (url starts with /assets/); storage = 'r2': an upload in the R2 bucket.
-- Content rows point at media by id (foreign key), so a file in use cannot be deleted by accident.

CREATE TABLE IF NOT EXISTS media (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,                             -- short unique name, e.g. cases-orbit
  title        TEXT NOT NULL,                                    -- label shown in the library
  status       TEXT NOT NULL DEFAULT 'draft'     CHECK (status IN ('draft', 'published', 'archived')),
  kind         TEXT NOT NULL CHECK (kind IN ('image', 'video', 'file')),
  mime         TEXT NOT NULL,
  storage      TEXT NOT NULL DEFAULT 'static' CHECK (storage IN ('static', 'r2')),
  url          TEXT NOT NULL UNIQUE,                             -- public path
  r2_key       TEXT UNIQUE,                                      -- object key, only for storage = 'r2'
  width        INTEGER CHECK (width IS NULL OR width > 0),
  height       INTEGER CHECK (height IS NULL OR height > 0),
  bytes        INTEGER CHECK (bytes IS NULL OR bytes >= 0),
  alt_text     TEXT NOT NULL DEFAULT '',                         -- default alt text; a page may override it where it uses the file
  focal_x      REAL CHECK (focal_x IS NULL OR (focal_x >= 0 AND focal_x <= 1)),
  focal_y      REAL CHECK (focal_y IS NULL OR (focal_y >= 0 AND focal_y <= 1)),
  uploaded_by  TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  published_at TEXT,
  CHECK ((storage = 'r2') = (r2_key IS NOT NULL)),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX idx_media_kind_status ON media (kind, status);
CREATE INDEX idx_media_storage     ON media (storage);
