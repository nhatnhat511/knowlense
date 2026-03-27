CREATE TABLE IF NOT EXISTS product_keyword_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT,
  product_url TEXT NOT NULL,
  title_text TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_keyword_runs_user_created_at
ON product_keyword_runs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_keyword_runs_product_id
ON product_keyword_runs(product_id);
