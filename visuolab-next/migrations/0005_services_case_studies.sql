-- Services and case studies.
--
-- Columns that the site filters or joins on are real columns. Ordered, repeatable page content that is always read and written
-- together (the process steps of a service, the results of a case study, ...) is stored as JSON text; each *_json column is
-- checked with json_valid(). The shape of each document is described in docs/DATABASE.md and typed in src/content/types.ts.
-- Rich text inside these documents is limited to <em> and <b>.

CREATE TABLE IF NOT EXISTS services (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,                               -- "Brand identity"
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  position          INTEGER NOT NULL DEFAULT 0,
  meta_title        TEXT NOT NULL,                               -- <title> and og:title
  meta_description  TEXT NOT NULL,
  hero_title        TEXT NOT NULL,                               -- rich text
  hero_lead         TEXT NOT NULL,
  hero_cta_label    TEXT NOT NULL,
  hero_cta_href     TEXT NOT NULL,
  hero_image_a_id   TEXT REFERENCES media (id) ON DELETE RESTRICT,
  hero_image_b_id   TEXT REFERENCES media (id) ON DELETE RESTRICT,
  hero_shots_json   TEXT NOT NULL CHECK (json_valid(hero_shots_json)),   -- [{alt,width,height,priority,lazy}] for image a, then b
  show_problems     INTEGER NOT NULL DEFAULT 0 CHECK (show_problems IN (0, 1)),  -- the "What we fix" section exists but is hidden today
  problems_json     TEXT NOT NULL CHECK (json_valid(problems_json)),     -- {label,title,items[{title,text,proofValue,proofLabel}]}
  overview_json     TEXT NOT NULL CHECK (json_valid(overview_json)),     -- {label,title,blocks[{title,text}]}
  outcomes_json     TEXT NOT NULL CHECK (json_valid(outcomes_json)),     -- {label,title,items[{value,text}]}
  show_band         INTEGER NOT NULL DEFAULT 0 CHECK (show_band IN (0, 1)),      -- the inline call-to-action band, hidden today
  band_json         TEXT NOT NULL CHECK (json_valid(band_json)),         -- {text,cta{label,href}}
  included_json     TEXT NOT NULL CHECK (json_valid(included_json)),     -- {label,title,items[{icon,title,text}]}
  process_json      TEXT NOT NULL CHECK (json_valid(process_json)),      -- {label,title,steps[{title,duration,text}]}
  cases_json        TEXT NOT NULL CHECK (json_valid(cases_json)),        -- {label,title}; the cases themselves are in service_case_studies
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  published_at      TEXT,
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX idx_services_status_position ON services (status, position);

CREATE TABLE IF NOT EXISTS case_studies (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,                               -- the page headline, rich text
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  position          INTEGER NOT NULL DEFAULT 0,                  -- order on /works
  meta_title        TEXT NOT NULL,
  meta_description  TEXT NOT NULL,
  client_name       TEXT NOT NULL,                               -- "Orbit"; also the card title and the breadcrumb
  year              TEXT NOT NULL,
  type_line         TEXT NOT NULL,                               -- "Fintech app · Fintech"
  short_kind        TEXT NOT NULL,                               -- "Fintech app": the label under the thumbnail in "More work"
  card_tags_json    TEXT NOT NULL CHECK (json_valid(card_tags_json)),    -- ["Product","Motion"]
  filters_json      TEXT NOT NULL CHECK (json_valid(filters_json)),      -- ["product","motion"]: which /works filters list it
  card_image_id     TEXT NOT NULL REFERENCES media (id) ON DELETE RESTRICT,
  card_image_alt    TEXT NOT NULL,
  cover_image_id    TEXT NOT NULL REFERENCES media (id) ON DELETE RESTRICT,
  cover_image_alt   TEXT NOT NULL,
  facts_json        TEXT NOT NULL CHECK (json_valid(facts_json)),        -- [{term,value}]: Client, Industry, Services, Year, Timeline
  about_label       TEXT NOT NULL,
  about_lead        TEXT NOT NULL,                               -- rich text
  stats_json        TEXT NOT NULL CHECK (json_valid(stats_json)),        -- [{value,label}]
  showcase_json     TEXT NOT NULL CHECK (json_valid(showcase_json)),     -- the card on the home page and the service pages: {title,tags,quote|results}
  process_json      TEXT NOT NULL CHECK (json_valid(process_json)),      -- {label,title,steps[{title,duration,text,deliverables[{title,detail}]}]}
  challenges_json   TEXT NOT NULL CHECK (json_valid(challenges_json)),   -- {label,title,items[{title,text}]}
  results_json      TEXT NOT NULL CHECK (json_valid(results_json)),      -- {label,title,items[{metric,text}]}
  more_json         TEXT NOT NULL CHECK (json_valid(more_json)),         -- {label,title,slugs[]}: the three projects under "More work"
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  published_at      TEXT,
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX idx_case_studies_status_position ON case_studies (status, position);

-- The pictures inside a case study: two galleries and the wide image.
CREATE TABLE IF NOT EXISTS case_study_images (
  id              TEXT PRIMARY KEY,
  case_study_id   TEXT NOT NULL REFERENCES case_studies (id) ON DELETE CASCADE,
  media_id        TEXT NOT NULL REFERENCES media (id) ON DELETE RESTRICT,
  role            TEXT NOT NULL CHECK (role IN ('gallery_a', 'gallery_b', 'wide')),
  position        INTEGER NOT NULL DEFAULT 0,
  caption         TEXT NOT NULL DEFAULT '',
  alt_text        TEXT NOT NULL DEFAULT '',
  object_position TEXT,                                          -- CSS object-position, e.g. "20% 30%"
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (case_study_id, role, position)
);
CREATE INDEX idx_case_study_images_media ON case_study_images (media_id);

-- Which case studies each service page shows, and in which order.
CREATE TABLE IF NOT EXISTS service_case_studies (
  service_id    TEXT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  case_study_id TEXT NOT NULL REFERENCES case_studies (id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (service_id, case_study_id)
);
CREATE INDEX idx_service_case_studies_case ON service_case_studies (case_study_id);
