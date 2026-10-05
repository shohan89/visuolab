-- Featured case studies: a flag editors can set. Today it marks the four cases that the home page shows; the public pages do not read it yet.

ALTER TABLE case_studies ADD COLUMN featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1));
CREATE INDEX idx_case_studies_featured ON case_studies (featured, position);
