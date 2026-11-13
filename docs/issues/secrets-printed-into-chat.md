# Every saved secret was printed into a chat (2026-11-13)

**What happened.** A Claude session was checking that the plain settings file matched its
encrypted copy. It ran the decrypt command by hand and sent the command's normal output to
`/dev/null`, meaning to see only whether it worked. Run through `npx`, the tool wrote the
decrypted values to its error stream instead, and that stream reached the chat. Every saved
value was printed: the database address with its password, both Cloudflare tokens and the
account ID. The chat is stored on disk and sent to the model's provider, so each of those values
counts as leaked.

**What was done the same day.**

- The owner rolled both Cloudflare tokens. `make cf-tokens` confirmed the new ones work and end
  on 2027-11-12.
- The database password is replaced the same way, by resetting it in the Supabase dashboard and
  saving the new address. The `secrets` skill's table gives the steps for every entry.
- The key that unlocks the encrypted copy was **not** printed, so it was not changed.

**Why the redirection did not help.** Sending one stream away says nothing about the other.
Any command that can decrypt is one bad redirect away from printing, so the rule cannot be
"redirect carefully". It has to be "never run it".

**What changed, so it cannot happen the same way again.**

1. **A guard runs before every command, file read and search in a Claude session in this repo.**
   It is `.claude/skills/secrets/scripts/guard-secrets.py`, wired in `.claude/settings.json`. It refuses a decrypt, a
   `dotenvx get`, a debug run, a run into a command that prints the environment, `lpass show`,
   and any command that names the plain file or the key file other than the few that never
   print a file. Its tests include the exact command that leaked. A fresh session started in the
   branch folder was refused on all three tries against a made-up `.env`: shell, file-reading
   tool and search tool.
2. **One way in.** The `make env-*` and `make cf-*` commands are the only way to touch saved
   values, and every check among them prints names, shapes and dates only. The checks run
   without a prompt; saving or replacing a value stays the owner's, in their own terminal.
3. **One page per entry.** The `secrets` skill lists every saved entry: where its value comes
   from, how to check it, how to replace it, and where else a copy lives. A test fails if the
   encrypted copy holds an entry the page does not list.

**First guard draft, and what was wrong with it.** The first version refused a list of reading
commands (`cat`, `head`, `grep`, …) aimed at the plain file. A review found the gaps a list
always has: copying the file and reading the copy, a Python script opening it, `$(<.env)`,
and a recursive `grep -r` from the repo's root, which does not skip ignored files and never
names the file at all. It also refused harmless commands, such as a commit message that
mentioned "dotenvx decrypt". The guard now refuses anything that *names* the file unless the
command is one that never prints a file, reads only the command being run (not words inside
quotes), and checks a recursive search for a plain file in the folder it searches.

**What it does not stop.** A script written to read the file and print it would get past it.
The guard is for the honest mistake. The other half is the open question of letting the store
accept connections only from listed addresses (item ④ on the move page): with it, a leaked
database password would be useless from anywhere else.
