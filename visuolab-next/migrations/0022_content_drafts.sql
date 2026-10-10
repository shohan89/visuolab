-- Draft changes to the content of a section, kept apart from the published content. The public website reads only the published content; the draft is
-- what an editor saved but has not published yet, and what a preview (signed-in admin only) shows on top of it. One draft per section.
--   scope 'page'    -> owner_id is pages.id (pages that have their own address)
--   scope 'service' / 'case_study' / 'blog_post' -> owner_id is the record's id; section_key is a section of that record (src/lib/cms/entity)
-- Publishing writes the draft into the real content (through the same checked save, which keeps a revision) and deletes the draft.

CREATE TABLE IF NOT EXISTS content_drafts (
  scope        TEXT NOT NULL CHECK (scope IN ('page', 'service', 'case_study', 'blog_post')),
  owner_id     TEXT NOT NULL,
  section_key  TEXT NOT NULL CHECK (length(section_key) BETWEEN 1 AND 60),
  content      TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  updated_at   TEXT NOT NULL,
  updated_by   TEXT REFERENCES users (id) ON DELETE SET NULL,
  PRIMARY KEY (scope, owner_id, section_key)
);

-- A deleted page or record takes its drafts with it.
CREATE TRIGGER trg_pages_drafts_delete AFTER DELETE ON pages BEGIN
  DELETE FROM content_drafts WHERE scope = 'page' AND owner_id = OLD.id;
END;
CREATE TRIGGER trg_services_drafts_delete AFTER DELETE ON services BEGIN
  DELETE FROM content_drafts WHERE scope = 'service' AND owner_id = OLD.id;
END;
CREATE TRIGGER trg_case_studies_drafts_delete AFTER DELETE ON case_studies BEGIN
  DELETE FROM content_drafts WHERE scope = 'case_study' AND owner_id = OLD.id;
END;
CREATE TRIGGER trg_blog_posts_drafts_delete AFTER DELETE ON blog_posts BEGIN
  DELETE FROM content_drafts WHERE scope = 'blog_post' AND owner_id = OLD.id;
END;
