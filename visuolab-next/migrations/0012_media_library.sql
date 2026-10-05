-- Media library: what an editor needs to know about an uploaded picture, beyond the file itself.
-- The file lives in R2 (media.r2_key); the database keeps only metadata and the reference.

ALTER TABLE media ADD COLUMN caption TEXT NOT NULL DEFAULT '';                 -- shown with the picture where a page has a caption slot
ALTER TABLE media ADD COLUMN original_name TEXT;                              -- the file name the editor uploaded (display only; never part of the object key)
ALTER TABLE media ADD COLUMN sha256 TEXT CHECK (sha256 IS NULL OR length(sha256) = 64);  -- fingerprint of the bytes, to spot the same file uploaded twice
CREATE INDEX idx_media_sha256 ON media (sha256);
CREATE INDEX idx_media_created ON media (created_at DESC);
