CREATE TABLE IF NOT EXISTS product_keyword_rank_cache (
  product_id TEXT NOT NULL,
  keyword_text TEXT NOT NULL,
  rank_position INTEGER,
  result_page INTEGER,
  status TEXT NOT NULL,
  confidence TEXT NOT NULL,
  search_url TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (product_id, keyword_text)
);

CREATE INDEX IF NOT EXISTS idx_product_keyword_rank_cache_expires_at
ON product_keyword_rank_cache(expires_at);
