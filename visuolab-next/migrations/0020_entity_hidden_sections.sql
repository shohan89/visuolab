-- Sections of a service, case study or article that an editor has switched off. The section's content stays in the record; a row here only says
-- "do not draw it on the public page". No row means the section is on. (The two service sections that already had a switch, "What we fix" and
-- "Call to action band", keep using their own columns.)

CREATE TABLE IF NOT EXISTS entity_hidden_sections (
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('service', 'case_study', 'blog_post')),
  entity_id    TEXT NOT NULL,
  section_key  TEXT NOT NULL CHECK (length(section_key) BETWEEN 1 AND 60),
  hidden_at    TEXT NOT NULL,
  hidden_by    TEXT REFERENCES users (id) ON DELETE SET NULL,
  PRIMARY KEY (entity_type, entity_id, section_key)
);

-- A deleted record takes its switches with it.
CREATE TRIGGER trg_services_hidden_delete AFTER DELETE ON services BEGIN
  DELETE FROM entity_hidden_sections WHERE entity_type = 'service' AND entity_id = OLD.id;
END;
CREATE TRIGGER trg_case_studies_hidden_delete AFTER DELETE ON case_studies BEGIN
  DELETE FROM entity_hidden_sections WHERE entity_type = 'case_study' AND entity_id = OLD.id;
END;
CREATE TRIGGER trg_blog_posts_hidden_delete AFTER DELETE ON blog_posts BEGIN
  DELETE FROM entity_hidden_sections WHERE entity_type = 'blog_post' AND entity_id = OLD.id;
END;
