CREATE TABLE catalog_region_evidence (
  mattel_sku TEXT NOT NULL REFERENCES catalog_entries(mattel_sku) ON DELETE CASCADE,
  doll_id TEXT NOT NULL REFERENCES dolls(id) ON DELETE CASCADE,
  region TEXT NOT NULL CHECK (region IN ('amazon_us','amazon_uk','amazon_de','amazon_es','amazon_it')),
  status TEXT NOT NULL CHECK (status IN (
    'verified','out_of_stock','no_price','not_found','needs_review','captcha_required',
    'blocked','parser_changed','identity_mismatch','network_error','conflict'
  )),
  evidence_url TEXT NOT NULL,
  asin TEXT,
  checked_at TEXT NOT NULL,
  diagnostic_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (mattel_sku, region)
);

CREATE INDEX catalog_region_evidence_doll_idx ON catalog_region_evidence(doll_id, region);
CREATE INDEX catalog_region_evidence_status_idx ON catalog_region_evidence(status, checked_at);
