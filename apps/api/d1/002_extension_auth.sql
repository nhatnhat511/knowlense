CREATE TABLE IF NOT EXISTS extension_connection_requests (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  fingerprint_hash TEXT,
  user_id TEXT,
  user_email TEXT,
  session_id TEXT,
  token_plaintext TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  claimed_at TEXT,
  redeemed_at TEXT
);

CREATE TABLE IF NOT EXISTS extension_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_extension_connection_requests_status_expires
ON extension_connection_requests(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_extension_sessions_user_expires
ON extension_sessions(user_id, expires_at DESC);
