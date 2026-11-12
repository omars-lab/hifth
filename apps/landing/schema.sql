-- The "tell me when the Mac app is out" list. One row per email, nothing else.
-- Applied with: wrangler d1 execute hifth-notify --remote --file schema.sql (through dotenvx).
CREATE TABLE IF NOT EXISTS notify (
  email TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL UNIQUE
);
