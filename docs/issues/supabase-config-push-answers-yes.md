# A settings preview that pushed the settings live

**What happened (2026-11-13).** To see how the new store's live settings differed from the repo's
settings file, `supabase config push` was run with no input, expecting it to stop at its first
question. It asks "[Y/n]" for each part of the settings (web door, sign-ins, database, files),
and it counts no answer as **yes**. So it pushed the settings file's local defaults live: sign-ups
on, email confirmation off, a one-second limit between emails, six-digit codes, an extra
local return address.

**Did it hurt anything?** No. Nothing used the store at the time, and the store check counts 0 sign-ups
afterwards. The project's id
was printed in that output; the scratch file holding it was deleted and the id was not written
anywhere else.

**What changed because of it.**

- The settings file was tightened to what the store should be (web door off, sign-ups off, email
  confirmation on, 12-character passwords, 8-digit codes, two-step codes allowed), pushed on
  purpose, and a second preview showed every part up to date.
- The store check (`make qul-store-check`) previews the push by piping "n" to every question, so
  it can only read the difference, never push. It fails if any part is not up to date.
- An offline test fails if the settings file ever stops keeping sign-ups and the web door off,
  because a push from a file with the defaults in it is exactly what opened them.

**The rule for next time.** Never run `supabase config push` to preview without piping "n" into
it (`printf 'n\nn\nn\nn\n' | supabase … config push`). An empty input is a yes. The leverage-qul
skill says the same.
