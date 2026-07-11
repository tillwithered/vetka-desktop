PRAGMA defer_foreign_keys = ON;

CREATE TABLE price_snapshots_store_card (
  id TEXT PRIMARY KEY,
  check_id TEXT NOT NULL UNIQUE REFERENCES price_checks(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES amazon_listings(id) ON DELETE CASCADE,
  offer_kind TEXT NOT NULL CHECK (offer_kind IN ('regular','prime','subscription')),
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL CHECK (currency IN ('USD','GBP','EUR','KZT')),
  shipping_minor INTEGER CHECK (shipping_minor IS NULL OR shipping_minor >= 0),
  seller_name TEXT,
  fulfilled_by_amazon INTEGER NOT NULL CHECK (fulfilled_by_amazon IN (0, 1)),
  availability TEXT NOT NULL CHECK (availability IN ('in_stock','preorder','unknown')),
  condition TEXT NOT NULL CHECK (condition = 'New'),
  coupon_text TEXT,
  rate_to_kzt_micros INTEGER NOT NULL CHECK (rate_to_kzt_micros > 0),
  price_kzt_minor INTEGER NOT NULL CHECK (price_kzt_minor >= 0),
  checked_at TEXT NOT NULL
) STRICT;

INSERT INTO price_snapshots_store_card (
  id, check_id, listing_id, offer_kind, price_minor, currency, shipping_minor,
  seller_name, fulfilled_by_amazon, availability, condition, coupon_text,
  rate_to_kzt_micros, price_kzt_minor, checked_at
)
SELECT
  id, check_id, listing_id, offer_kind, price_minor, currency, shipping_minor,
  seller_name, fulfilled_by_amazon, availability, condition, coupon_text,
  rate_to_kzt_micros, price_kzt_minor, checked_at
FROM price_snapshots;

DROP TABLE price_snapshots;
ALTER TABLE price_snapshots_store_card RENAME TO price_snapshots;
CREATE INDEX IF NOT EXISTS snapshots_listing_checked_idx ON price_snapshots(listing_id, checked_at DESC);
