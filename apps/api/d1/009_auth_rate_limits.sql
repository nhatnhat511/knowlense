CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  last_attempt_at TEXT NOT NULL,
  blocked_until TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_scope_last_attempt
ON auth_rate_limits(scope, last_attempt_at DESC);

CREATE TABLE IF NOT EXISTS auth_security_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  ip_hash TEXT,
  email_hash TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_created_at
ON auth_security_events(created_at DESC);
