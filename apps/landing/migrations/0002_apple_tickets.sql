-- Apple's cancel ticket for each account (docs/design/sign-in.md, step 13).
-- Applied by `wrangler d1 migrations apply`, and by the tests through test-d1.mjs.
--
-- What is kept, and why only this:
--   apple_tickets  at most one row per reader: the long-lived token Apple hands hifth.app at a
--                  sign-in (Apple calls it a refresh token). Apple needs it back to cut the link
--                  between the reader's Apple account and Hifth when they delete their account.
--                  It is kept locked (encrypted, lib/apple-link.mjs); the lock's key is not in
--                  this database, so a copy of this table shows no ticket. app_id is which of
--                  our apps the reader signed in to, because Apple wants the same name again
--                  when the link is cut. The row goes when the account goes.

CREATE TABLE apple_tickets (
  account_id  TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  sealed      TEXT NOT NULL,
  app_id      TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);
