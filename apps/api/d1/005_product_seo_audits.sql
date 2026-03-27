CREATE TABLE IF NOT EXISTS product_seo_audits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  seller_name TEXT,
  product_id TEXT,
  product_url TEXT NOT NULL,
  title_text TEXT NOT NULL,
  primary_keyword TEXT,
  audit_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_seo_audits_user_created_at
ON product_seo_audits(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_seo_audits_seller_name
ON product_seo_audits(seller_name);

CREATE INDEX IF NOT EXISTS idx_product_seo_audits_primary_keyword
ON product_seo_audits(primary_keyword);
