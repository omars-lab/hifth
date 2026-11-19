-- One copy of a reader's marks, kept only when they press "Keep a copy of my marks on hifth.app"
-- (docs/design/sign-in.md, step 21: "your marks follow you"). Applied by
-- `wrangler d1 migrations apply`, and by the tests through test-d1.mjs.
--
--   marks_copies  one row per reader who asked for a copy, never more. `marks` is the same file
--                 "Save to a file" writes (bookmarks, notes, marked mistakes, look-alike jumps, and
--                 the notes removed since), kept as it came: the device does the merging. It is not
--                 locked, so whoever runs the server could read it; the button says so (choice ③).
--                 `number` goes up by one with each copy, so a device that has not seen the latest
--                 copy cannot write over it. The row goes with the account (delete my account, or
--                 Apple's notice that the reader deleted their Apple account), and on its own when
--                 the reader deletes the copy.

CREATE TABLE marks_copies (
  account_id  TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  marks       TEXT NOT NULL,
  number      INTEGER NOT NULL,
  saved_at    INTEGER NOT NULL
);
