CREATE TABLE IF NOT EXISTS rank_tracking_targets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_id TEXT,
  product_url TEXT NOT NULL,
  product_title TEXT NOT NULL,
  seller_name TEXT,
  keyword_text TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_checked_at TEXT,
  last_status TEXT,
  last_result_page INTEGER,
  last_page_position INTEGER,
  last_absolute_position INTEGER,
  last_search_url TEXT,
  best_absolute_position INTEGER,
  best_result_page INTEGER,
  best_page_position INTEGER,
  best_checked_at TEXT,
  next_check_after TEXT,
  UNIQUE(user_id, product_url, normalized_keyword)
);

CREATE INDEX IF NOT EXISTS idx_rank_tracking_targets_user_active
ON rank_tracking_targets(user_id, is_active, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rank_tracking_targets_next_check
ON rank_tracking_targets(is_active, next_check_after);

CREATE INDEX IF NOT EXISTS idx_rank_tracking_targets_product
ON rank_tracking_targets(product_id, product_url);

CREATE TABLE IF NOT EXISTS rank_tracking_checks (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  product_id TEXT,
  product_url TEXT NOT NULL,
  keyword_text TEXT NOT NULL,
  normalized_keyword TEXT NOT NULL,
  source TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  rank_status TEXT NOT NULL,
  result_page INTEGER,
  page_position INTEGER,
  absolute_position INTEGER,
  search_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (target_id) REFERENCES rank_tracking_targets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rank_tracking_checks_target_checked
ON rank_tracking_checks(target_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_rank_tracking_checks_user_checked
ON rank_tracking_checks(user_id, checked_at DESC);
