-- A revision now records the whole change, not only what was replaced: the new content, who made the change, and whether it was an edit or a
-- restore of an earlier version. (`replaced_at` is when the change happened; `content` is the previous content.) Rows written before this
-- migration have no new content and no editor, which the admin shows as unknown.

ALTER TABLE page_section_revisions ADD COLUMN new_content TEXT CHECK (new_content IS NULL OR (json_valid(new_content) AND json_type(new_content) = 'object'));
ALTER TABLE page_section_revisions ADD COLUMN changed_by  TEXT REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE page_section_revisions ADD COLUMN kind        TEXT NOT NULL DEFAULT 'edit' CHECK (kind IN ('edit', 'restore'));

ALTER TABLE entity_section_revisions ADD COLUMN new_content TEXT CHECK (new_content IS NULL OR (json_valid(new_content) AND json_type(new_content) = 'object'));
ALTER TABLE entity_section_revisions ADD COLUMN kind        TEXT NOT NULL DEFAULT 'edit' CHECK (kind IN ('edit', 'restore'));
