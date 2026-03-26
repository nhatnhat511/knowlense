CREATE TABLE IF NOT EXISTS search_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  page_url TEXT NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  captured_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS search_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  product_url TEXT,
  shop_name TEXT,
  price_text TEXT,
  snippet TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (snapshot_id) REFERENCES search_snapshots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS keyword_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  snapshot_id TEXT,
  query_text TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  keywords_json TEXT NOT NULL,
  opportunities_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (snapshot_id) REFERENCES search_snapshots(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_search_snapshots_user_created_at
ON search_snapshots(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_results_snapshot_position
ON search_results(snapshot_id, position ASC);

CREATE INDEX IF NOT EXISTS idx_keyword_runs_user_created_at
ON keyword_runs(user_id, created_at DESC);
