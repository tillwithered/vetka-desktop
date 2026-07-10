PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS dolls (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  character_name TEXT,
  line_name TEXT,
  generation TEXT,
  mattel_sku TEXT,
  upc_ean TEXT,
  image_path TEXT,
  notes TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS amazon_listings (
  id TEXT PRIMARY KEY,
  doll_id TEXT NOT NULL REFERENCES dolls(id) ON DELETE CASCADE,
  region TEXT NOT NULL CHECK (region IN ('amazon_us','amazon_uk','amazon_de','amazon_es','amazon_it')),
  asin TEXT NOT NULL CHECK (length(asin) = 10),
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('candidate','confirmed','rejected','frozen')),
  confirmation_source TEXT CHECK (confirmation_source IN ('exact_id','deterministic_match','manual')),
  match_score INTEGER NOT NULL DEFAULT 0 CHECK (match_score BETWEEN 0 AND 100),
  match_reasons_json TEXT NOT NULL DEFAULT '[]',
  last_checked_at TEXT,
  last_verified_at TEXT,
  last_check_status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(doll_id, region, asin)
) STRICT;

CREATE TABLE IF NOT EXISTS price_checks (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES amazon_listings(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('verified','out_of_stock','no_price','needs_review','captcha_required','blocked','parser_changed','identity_mismatch','network_error','conflict')),
  adapter_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  diagnostic_json TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE TABLE IF NOT EXISTS price_snapshots (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL UNIQUE REFERENCES price_checks(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES amazon_listings(id) ON DELETE CASCADE,
  offer_kind TEXT NOT NULL CHECK (offer_kind IN ('regular','prime','subscription')),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD','GBP','EUR','KZT')),
  shipping_minor INTEGER CHECK (shipping_minor IS NULL OR shipping_minor >= 0),
  seller_name TEXT,
  fulfilled_by_amazon INTEGER NOT NULL CHECK (fulfilled_by_amazon IN (0, 1)),
  availability TEXT NOT NULL CHECK (availability IN ('in_stock','preorder')),
  condition TEXT NOT NULL CHECK (condition = 'New'),
  coupon_text TEXT,
  rate_to_kzt_micros INTEGER NOT NULL CHECK (rate_to_kzt_micros > 0),
  price_kzt_minor INTEGER NOT NULL CHECK (price_kzt_minor >= 0),
  checked_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_contact TEXT NOT NULL CHECK (length(trim(customer_contact)) > 0),
  doll_id TEXT NOT NULL REFERENCES dolls(id),
  source_snapshot_id TEXT NOT NULL REFERENCES price_snapshots(id),
  source_region TEXT NOT NULL,
  source_asin TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_seller TEXT,
  source_price_minor INTEGER NOT NULL,
  source_currency TEXT NOT NULL,
  source_rate_to_kzt_micros INTEGER NOT NULL,
  source_price_kzt_minor INTEGER NOT NULL,
  local_shipping_minor INTEGER NOT NULL DEFAULT 0,
  local_shipping_currency TEXT NOT NULL,
  local_shipping_rate_to_kzt_micros INTEGER NOT NULL,
  weight_grams INTEGER NOT NULL CHECK (weight_grams > 0),
  international_rate_minor_per_kg INTEGER NOT NULL,
  international_rate_currency TEXT NOT NULL,
  international_rate_to_kzt_micros INTEGER NOT NULL,
  international_shipping_kzt_minor INTEGER NOT NULL,
  extra_costs_kzt_minor INTEGER NOT NULL DEFAULT 0,
  total_cost_kzt_minor INTEGER NOT NULL,
  customer_price_kzt_minor INTEGER NOT NULL,
  profit_kzt_minor INTEGER NOT NULL,
  margin_basis_points INTEGER,
  status TEXT NOT NULL CHECK (status IN ('new','awaiting_payment','ordered','shipped','warehouse','in_transit','received','delivered')),
  tracking_number TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS order_status_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS listings_doll_region_idx ON amazon_listings(doll_id, region, status);
CREATE INDEX IF NOT EXISTS snapshots_listing_checked_idx ON price_snapshots(listing_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS checks_listing_finished_idx ON price_checks(listing_id, finished_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_updated_idx ON orders(status, updated_at DESC);
