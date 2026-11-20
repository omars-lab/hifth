-- Accounts and sessions for sign-in (docs/design/sign-in.md, step 10).
-- Applied by `wrangler d1 migrations apply`, and by the tests through test-d1.mjs.
--
-- What is kept, and why only this:
--   accounts       one row per reader. Found by Apple's lasting user number, never by email;
--                  no email, name or device is kept. Our own account number is a random code,
--                  so nothing else we store repeats Apple's number.
--   sessions       one row per signed-in device. Only a scrambled copy (SHA-256) of the session
--                  is kept, so a copy of this table cannot be used to sign in as anyone.
--   sign_in_words  the one-off words handed out for a sign-in, scrambled, each good once and
--                  for a few minutes.

CREATE TABLE accounts (
  id          TEXT PRIMARY KEY,
  apple_user  TEXT NOT NULL UNIQUE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_by_account ON sessions(account_id);

CREATE TABLE sign_in_words (
  word_hash   TEXT PRIMARY KEY,
  expires_at  INTEGER NOT NULL
);
