-- v0.5 initial schema. Append-only events; no free text (privacy, PRD §8).
-- `choice` is an Arabic surface form from the fixed corpus, not user free text.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,                 -- client-generated uuid → idempotency key
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  ts INTEGER NOT NULL,
  surah INTEGER,
  ayah INTEGER,
  rung TEXT,
  position INTEGER,
  choice TEXT,
  correct INTEGER,                     -- 0/1
  pretest INTEGER,                     -- 0/1
  to_ayah INTEGER,                     -- n+1 for connection/junction/chain
  step_kind TEXT,                      -- 'ayah' | 'junction' for chain_step
  received_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_events_user_ts ON events(user_id, ts);
