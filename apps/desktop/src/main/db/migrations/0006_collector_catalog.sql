CREATE TABLE collectibles (
  id TEXT PRIMARY KEY,
  mattel_sku TEXT UNIQUE,
  canonical_url TEXT NOT NULL UNIQUE,
  name_ru TEXT NOT NULL,
  official_name TEXT NOT NULL,
  line_name TEXT,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency TEXT,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('in_stock','preorder','coming_soon','fang_club','sold_out')),
  sale_starts_at TEXT,
  fang_club_only INTEGER NOT NULL CHECK (fang_club_only IN (0,1)),
  image_url TEXT,
  last_check_result TEXT NOT NULL CHECK (last_check_result IN ('verified','error')),
  last_checked_at TEXT NOT NULL,
  missing_complete_scans INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX collectibles_archive_name_idx ON collectibles(archived_at, name_ru);

CREATE TABLE collectibles_scan_state (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  status TEXT NOT NULL CHECK (status IN ('idle','running')),
  started_at TEXT,
  completed_at TEXT,
  next_run_at TEXT,
  processed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
) STRICT;

INSERT INTO collectibles_scan_state (singleton, status) VALUES (1, 'idle');
