-- How many one-off sign-in words were handed out in each ten minutes (docs/design/sign-in.md,
-- step 17). Applied by `wrangler d1 migrations apply`, and by the tests through test-d1.mjs.
--
-- What is kept, and why only this:
--   sign_in_counts  one row per ten-minute stretch: which stretch, and how many words were
--                   handed out in it, by everyone together. It says nothing about who asked:
--                   no internet address, no device, no account. It is what stops anyone from
--                   making the server write without end before they have proved anything.
--                   Rows for stretches that are over are deleted at the next hand-out.

CREATE TABLE sign_in_counts (
  stretch     INTEGER PRIMARY KEY,
  handed_out  INTEGER NOT NULL
);
