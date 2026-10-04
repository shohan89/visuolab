-- Baseline migration: proves the migration pipeline and gives /api/health something to read.
CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_baseline', '0000');
