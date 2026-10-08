-- Previous saved versions of a section, so an editor can go back. Each save of a section stores the content it replaces; the last 10 are kept.
-- `saved_at` / `saved_by` say when and by whom that version was saved; `replaced_at` when it was replaced by the next one.

CREATE TABLE IF NOT EXISTS page_section_revisions (
  id              TEXT PRIMARY KEY,
  section_id      TEXT NOT NULL REFERENCES page_sections (id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (json_valid(content) AND json_type(content) = 'object'),
  schema_version  INTEGER NOT NULL,
  saved_at        TEXT NOT NULL,
  saved_by        TEXT REFERENCES users (id) ON DELETE SET NULL,
  replaced_at     TEXT NOT NULL
);
CREATE INDEX idx_section_revisions_section ON page_section_revisions (section_id, replaced_at DESC);
