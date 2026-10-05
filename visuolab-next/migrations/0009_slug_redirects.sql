-- Old addresses of renamed pages. When an editor changes a slug, the old public URL is kept here and answers with a permanent redirect,
-- so links, bookmarks and search results do not break.

CREATE TABLE IF NOT EXISTS slug_redirects (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('service', 'case_study', 'blog_post')),
  old_slug   TEXT NOT NULL,
  new_slug   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (kind, old_slug),
  CHECK (old_slug <> new_slug)
);
CREATE INDEX idx_slug_redirects_target ON slug_redirects (kind, new_slug);
