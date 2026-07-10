CREATE TABLE IF NOT EXISTS catalog_entries (
  mattel_sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  character_name TEXT,
  line_name TEXT,
  product_type TEXT NOT NULL,
  monitor_status TEXT NOT NULL CHECK (monitor_status IN ('active', 'monitor_only')),
  required_terms_json TEXT NOT NULL,
  reject_terms_json TEXT NOT NULL,
  search_query TEXT NOT NULL,
  source_url TEXT,
  source_checked_at TEXT NOT NULL,
  evidence TEXT NOT NULL,
  doll_id TEXT UNIQUE REFERENCES dolls(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS catalog_entries_monitor_status_idx ON catalog_entries(monitor_status, mattel_sku);
