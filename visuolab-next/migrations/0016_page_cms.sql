-- Section-based page CMS: pages, their sections, and the references a section makes to media and case studies.
-- Structure only: the website does not read these tables yet (see docs/PAGE-CMS-ARCHITECTURE.md). Rows are written by the seed step that
-- follows, from the typed defaults in src/lib/pages/defaults.ts, so a section never exists with content its schema would refuse.
--
-- This is a controlled model, not a page builder: the templates and the section types are a fixed list (the two lookup tables below),
-- every section row says which type of content it holds, and that content is checked against that type's schema (src/lib/pages/) before it
-- is written. Editors change the content of sections that exist; they do not add, remove or reorder sections.

-- page_templates: the page layouts the website has. A template with a route is a public page; the others hold copy that several pages
-- share (the closing CTA band, the reviews, the footer extras) or copy around records that already have their own tables.
CREATE TABLE IF NOT EXISTS page_templates (
  template  TEXT PRIMARY KEY,
  label     TEXT NOT NULL,
  route     TEXT                                               -- NULL: not a page of its own
);

-- page_section_types: the kinds of section content. One row per schema in code; a new design section means a new row and a new schema.
CREATE TABLE IF NOT EXISTS page_section_types (
  type      TEXT PRIMARY KEY,
  label     TEXT NOT NULL,
  version   INTEGER NOT NULL DEFAULT 1                         -- bumped when the shape of the content changes; rows keep the version they were written with
);

-- pages: one row per page (one per template: the set of pages is fixed, like the design).
CREATE TABLE IF NOT EXISTS pages (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 60 AND slug NOT GLOB '*[^a-z0-9_-]*'),   -- a stable key (home, about, ...), not the address
  title           TEXT NOT NULL,                               -- the name in the admin
  status          TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  template        TEXT NOT NULL REFERENCES page_templates (template),
  seo_title       TEXT,                                        -- NULL: use the default for the page (Settings > SEO)
  seo_description TEXT,
  og_image_id     TEXT REFERENCES media (id) ON DELETE RESTRICT,
  canonical_url   TEXT CHECK (canonical_url IS NULL OR canonical_url LIKE 'https://%' OR canonical_url LIKE '/%'),
  noindex         INTEGER NOT NULL DEFAULT 0 CHECK (noindex IN (0, 1)),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  updated_by      TEXT REFERENCES users (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_pages_template ON pages (template);
CREATE INDEX idx_pages_og_image ON pages (og_image_id);

-- page_sections: one row per section of a page, addressable on its own (a section is saved, enabled or hidden without touching the page
-- or any other section). `content` is JSON, but only ever of the shape that `section_type` names: it is validated against that schema.
CREATE TABLE IF NOT EXISTS page_sections (
  id              TEXT PRIMARY KEY,
  page_id         TEXT NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
  section_key     TEXT NOT NULL CHECK (length(section_key) BETWEEN 1 AND 40 AND section_key NOT GLOB '*[^a-z0-9_]*'),   -- the section's name on its page: hero, faq, ...
  section_type    TEXT NOT NULL REFERENCES page_section_types (type),
  position        INTEGER NOT NULL CHECK (position >= 0),      -- where the section sits on the page; set by the template, not by editors
  is_enabled      INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),
  content         TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(content) AND json_type(content) = 'object'),
  schema_version  INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  updated_by      TEXT REFERENCES users (id) ON DELETE SET NULL,
  UNIQUE (page_id, section_key)
);
CREATE INDEX idx_page_sections_page ON page_sections (page_id, position);
CREATE INDEX idx_page_sections_type ON page_sections (section_type);

-- page_section_refs: every media file and case study a section's content points at, one row per field. The content JSON stays the one
-- place the value is edited; these rows are an index rewritten in the same batch that saves the section. They exist so the database can
-- enforce what JSON cannot: a file or case study in use cannot be deleted (RESTRICT, the same rule as the other tables), and "where is this
-- used?" is one query.
CREATE TABLE IF NOT EXISTS page_section_refs (
  section_id      TEXT NOT NULL REFERENCES page_sections (id) ON DELETE CASCADE,
  field_path      TEXT NOT NULL,                               -- e.g. bookBar.avatarId, items.2.avatarId, caseIds.0
  kind            TEXT NOT NULL CHECK (kind IN ('media', 'case_study')),
  media_id        TEXT REFERENCES media (id) ON DELETE RESTRICT,
  case_study_id   TEXT REFERENCES case_studies (id) ON DELETE RESTRICT,
  PRIMARY KEY (section_id, field_path),
  CHECK ((kind = 'media' AND media_id IS NOT NULL AND case_study_id IS NULL) OR (kind = 'case_study' AND case_study_id IS NOT NULL AND media_id IS NULL))
);
CREATE INDEX idx_section_refs_media ON page_section_refs (media_id) WHERE media_id IS NOT NULL;
CREATE INDEX idx_section_refs_case  ON page_section_refs (case_study_id) WHERE case_study_id IS NOT NULL;

-- the fixed lists (kept in step with src/lib/pages/registry.ts; scripts/db/verify-pages.mjs fails if they differ)
INSERT INTO page_templates (template, label, route) VALUES
  ('home',              'Home',                      '/'),
  ('about',             'About',                     '/about'),
  ('works',             'Works',                     '/works'),
  ('blog',              'Blog',                      '/blog'),
  ('contact',           'Contact',                   '/contact'),
  ('service_detail',    'Service page copy',         NULL),
  ('case_study_detail', 'Case study page copy',      NULL),
  ('article_detail',    'Article page copy',         NULL),
  ('shared',            'Shared across pages',       NULL);

INSERT INTO page_section_types (type, label) VALUES
  ('home_hero',          'Home hero'),
  ('logo_marquee',       'Trusted-by logos band'),
  ('showreel',           'Showreel video'),
  ('why_stats',          'Why us list and numbers'),
  ('services_columns',   'Services columns and book bar'),
  ('case_showcase',      'Case study showcase'),
  ('industries_grid',    'Industries'),
  ('process_steps',      'Process steps'),
  ('reviews_carousel',   'Reviews carousel'),
  ('about_hero',         'About hero'),
  ('case_mosaic',        'Case study mosaic'),
  ('principles_list',    'Principles'),
  ('mission_vision',     'Mission and vision'),
  ('timeline',           'Story timeline'),
  ('manifesto',          'Manifesto'),
  ('office_clocks',      'Offices and clocks'),
  ('faq_accordion',      'FAQ'),
  ('open_roles',         'Open roles'),
  ('works_hero',         'Works hero and filters'),
  ('works_grid',         'Works grid'),
  ('blog_hero',          'Blog hero and filters'),
  ('blog_featured',      'Blog featured article'),
  ('blog_grid',          'Blog article grid'),
  ('contact_intro',      'Contact intro'),
  ('contact_form',       'Contact form'),
  ('cta_band',           'Closing call to action'),
  ('reviews_collection', 'Reviews'),
  ('logos_collection',   'Trusted-by logos'),
  ('site_rating',        'Review rating line'),
  ('footer_extras',      'Footer extras'),
  ('case_study_chrome',  'Case study page labels'),
  ('article_chrome',     'Article page labels');
