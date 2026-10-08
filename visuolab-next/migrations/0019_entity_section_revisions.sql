-- Previous saved versions of one section of a service, case study or article, so an editor can go back (the Page CMS has the same for the static pages).
-- The sections themselves are not stored here: they are parts of the record (its columns and JSON documents). Each save of a section stores the
-- content it replaces; the last 10 per section are kept. `saved_at` is when the replaced version was written (the record's updated_at then).

CREATE TABLE IF NOT EXISTS entity_section_revisions (
  id            TEXT PRIMARY KEY,
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('service', 'case_study', 'blog_post')),
  entity_id     TEXT NOT NULL,
  section_key   TEXT NOT NULL CHECK (length(section_key) BETWEEN 1 AND 60),
  content       TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  saved_at      TEXT NOT NULL,
  replaced_at   TEXT NOT NULL,
  replaced_by   TEXT REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_entity_section_revisions ON entity_section_revisions (entity_type, entity_id, section_key, replaced_at DESC);

-- The three record tables are different tables, so a foreign key cannot cover them: a record that is deleted takes its saved versions with it.
CREATE TRIGGER trg_services_revisions_delete AFTER DELETE ON services BEGIN
  DELETE FROM entity_section_revisions WHERE entity_type = 'service' AND entity_id = OLD.id;
END;
CREATE TRIGGER trg_case_studies_revisions_delete AFTER DELETE ON case_studies BEGIN
  DELETE FROM entity_section_revisions WHERE entity_type = 'case_study' AND entity_id = OLD.id;
END;
CREATE TRIGGER trg_blog_posts_revisions_delete AFTER DELETE ON blog_posts BEGIN
  DELETE FROM entity_section_revisions WHERE entity_type = 'blog_post' AND entity_id = OLD.id;
END;
