CREATE TABLE IF NOT EXISTS seo_health_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seo_health_usage_user_created
  ON seo_health_usage (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_rewrite_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_rewrite_usage_user_created
  ON ai_rewrite_usage (user_id, created_at DESC);
