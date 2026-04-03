CREATE TABLE IF NOT EXISTS ai_rewrite_request_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  product_url TEXT NOT NULL,
  product_title TEXT NOT NULL,
  primary_keyword TEXT,
  model TEXT NOT NULL,
  model_version TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL,
  finish_reason TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_rewrite_request_logs_user_created
  ON ai_rewrite_request_logs (user_id, created_at DESC);
