-- Blog: categories (one per article), free-form tags (many per article) and the articles.

CREATE TABLE IF NOT EXISTS blog_categories (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,                                    -- "Brand", "Product", ...: also the filter chip label
  status       TEXT NOT NULL DEFAULT 'draft'     CHECK (status IN ('draft', 'published', 'archived')),
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  published_at TEXT,
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS blog_tags (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'draft'     CHECK (status IN ('draft', 'published', 'archived')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  published_at TEXT,
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  category_id      TEXT NOT NULL REFERENCES blog_categories (id) ON DELETE RESTRICT,
  meta_title       TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  excerpt          TEXT,                                         -- teaser on the featured card (the latest article only today)
  featured         INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  lead             TEXT NOT NULL,                                -- opening paragraph
  body_json        TEXT NOT NULL CHECK (json_valid(body_json)),  -- [{type:"heading"|"paragraph",text}]
  outro_json       TEXT NOT NULL CHECK (json_valid(outro_json)), -- {before,linkText,href,after}
  related_json     TEXT NOT NULL CHECK (json_valid(related_json)), -- slugs of the two "More from the studio" picks
  read_minutes     INTEGER NOT NULL CHECK (read_minutes > 0),
  author_name      TEXT NOT NULL,
  author_image_id  TEXT REFERENCES media (id) ON DELETE SET NULL,
  cover_image_id   TEXT NOT NULL REFERENCES media (id) ON DELETE RESTRICT,
  cover_alt        TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  published_at     TEXT,                                         -- the date shown on the article
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX idx_blog_posts_status_published ON blog_posts (status, published_at DESC);
CREATE INDEX idx_blog_posts_category         ON blog_posts (category_id);

CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id TEXT NOT NULL REFERENCES blog_posts (id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES blog_tags (id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX idx_blog_post_tags_tag ON blog_post_tags (tag_id);
