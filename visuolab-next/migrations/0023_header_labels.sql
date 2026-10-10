-- A new kind of section content: the words of the header's Services dropdown that are not links (the button's label and the heading above the cards).
-- The section itself (shared page, key header) is added by db/seed/pages.sql; until it is, the page uses the built-in words, which are the same.
INSERT OR IGNORE INTO page_section_types (type, label) VALUES ('header_labels', 'Header menu labels');
