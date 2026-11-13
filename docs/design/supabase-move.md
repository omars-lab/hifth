# Moving the outside-library store to a new Supabase account

**What is moving?** The hosted database that holds our copy of the outside library (QUL): the
page layout and the per-word text the building tools draw our own word-by-word page from. It is
moving from the old Supabase account to a new account and project the owner controls. Nothing a
reader uses touches it. The app and the site never call it; only three building scripts do.

**What does a hafiz notice?** Nothing. The store feeds the tools that make and check pages, not
the app.

**Status:** started 2026-11-12. On 2026-11-13 the data was loaded into the new store, and every
row was checked against the old store: the same rows in all three tables. The new store was
also locked down further than the old one (below). Later that day the owner saved the new
password file and the page-fixture script ran against the new store, so the move is proven.
What is left is deleting the old project (③). The old project is still running until then. (This page said on
2026-11-12 that the old one was paused; on 2026-11-13 it showed as running and answered
queries, so that was wrong.) Tracked as the `supabase-move` row in the issue register, with
smaller items after it (③, ④, ⑤); ② is answered.

**A leak on the way (2026-11-13).** While checking the saved settings, a Claude session printed
every saved value into its chat. The two Cloudflare tokens were replaced the same day; the
database password is replaced the same way (the secrets skill's table says how). What happened,
and the guard that now refuses such commands, is in
[docs/issues/secrets-printed-into-chat.md](../issues/secrets-printed-into-chat.md).

## What is in the old store? (audited 2026-11-12)

| What | Found |
| --- | --- |
| Tables | Three: the page lines (9,046 rows), the word text (83,668 rows), the layout's own counts (4 rows). About 8.6 MB in all. |
| Schema history | Two migrations in the repo, both applied, nothing applied that the repo lacks. |
| Extensions | Only the four every new Supabase project starts with. Nothing to carry over. |
| Server functions, stored secrets, file buckets, preview branches | None. |
| Sign-ups | None. Counted on 2026-11-13 without copying any row: 0 sign-ups, 0 linked logins, 0 file buckets, 0 stored files. |
| Licence for the word text | Read and marked done in the manual-check ledger before the text was loaded. The move does not change what is held, so it does not need reading again. |
| Who could read it | **The tables were open to the project's public key, for reading and for writing.** Supabase opens every new table that way, and our migrations never closed them. This was read from the table rights and the missing row rules, not tried with the key. The key itself was never written in this repo, which limits who could have had it. The new migration (dated 2026-11-12) closes the tables, and a test now fails if a table is ever added open. **Closed on the old store the same day:** the migration was pushed there, and a fresh schema dump shows row rules on all three tables and no table rights left for the public roles. |
| The connection password file | Gone from disk: it lived in a worktree that was removed. The new project gets a new one. |

## Where does the data come from for the new store?

The two downloaded source files the fill-in script reads are no longer on this laptop. So the
old store was the only ready copy. It was copied on 2026-11-12 into a git-ignored backup
(`packages/etl/data/qul/.cache/qul-store-backup/`), and the copy's row counts match the live
store exactly. It was then loaded into a throwaway copy of Supabase's own Postgres 17, on top of the
three migrations and as the same database role step 5 uses. It loaded with no errors: every row
came back, word ids 1 to 83,668 with none missing and no empty word. The backup holds the word
text, so it stays in that ignored folder, plus a second copy in the owner's iCloud Drive (made
2026-11-12, checksum matches), because a folder named `.cache` has been cleared on this laptop
before. The old project is still running, so once the new store is loaded the two can be compared
row for row, not only by counts.

## What did the move tighten, and what keeps it tight?

The owner asked (2026-11-13) for the move to improve the store's security, not only copy it.
The new store differs from the old one in five ways. The old store's column was read from its
live settings on 2026-11-13 (a preview that answers no to every change, so nothing was pushed):

| What | Old store | New store |
| --- | --- | --- |
| The web door that answers the public key (Supabase's Data API) | On | **Off.** Nothing we run uses it. Our scripts talk to the database directly. |
| Sign-ups | On (Supabase's default), with email confirmation on | **Off.** Nobody signs in to this store. If they are ever turned on, an email must be confirmed, passwords are at least 12 characters, and one-time codes are 8 digits. |
| Unencrypted connections | Allowed | **Refused.** The three building scripts also ask for encryption themselves. |
| Tables, now and later | Closed on 2026-11-12, after being open | Closed by the migrations before any data went in. Tables added later start closed too. |
| Settings | Supabase's defaults, kept only in the dashboard | **Written in the repo** (`supabase/config.toml`), so a change shows up in review. |

**What keeps it from drifting back:** `make qul-store-check` asks the live store and fails if any
table lacks row rules, the public roles hold any right, anyone has signed up, unencrypted
connections are allowed, or the live settings differ from the repo's settings file. It prints
counts and settings only, never a row. It runs only when someone runs it; nothing watches the
store on a schedule. An offline test, which does run with every commit, fails if the settings
file ever stops keeping sign-ups and the web door off, or if a building script stops asking for
encryption.

**Still open to every address:** the store accepts connections from any internet address (with
the password). Limiting it to a list of addresses is possible, but this laptop's address changes,
so a fixed list would lock the owner out. Kept as a question for the owner, not changed here.

<details><summary>How the settings got pushed by accident, and why it is fine now</summary>

On 2026-11-13, a preview of the settings push was run with no answer typed. The command asks
"[Y/n]" for each part and counts no answer as yes, so it pushed the settings file's local
defaults live: sign-ups on, email confirmation off. Nothing used the store at the time and no one
signed up (the check above counts 0). The settings file was then tightened and pushed on purpose,
and the next preview showed every part up to date. To preview safely, pipe "n" into it; the check
script does exactly that. Written up in `docs/issues/supabase-config-push-answers-yes.md`.

</details>

## Open questions, and what would answer each

### ① Has the store moved to the new account, closed to the public key, with the old one retired? · **open**

**What would answer it:** the new store holds the same rows as the old one, and the page-fixture
script runs against it. Both are done (2026-11-13). What is left is step 8, deleting the old
project. The steps:

1. **Copy the data out of the old store.** Done 2026-11-12 (above).
2. **Create the new account and project.** Done 2026-11-12: project `hifth.app`, region
   us-east-1 (US East, N. Virginia), Postgres 17.11. Its session-pooler address is on
   `aws-0-us-east-1.pooler.supabase.com`, not the old project's us-west-2.
3. **Point the Supabase command line at it.** Log in as the new account under its own profile,
   so the old account's login stays where it is, then link the repo to the new project.
4. **Build the tables.** Push the migrations. The new project starts with the tables already
   closed to the public key. Done 2026-11-12 (step 3 too): the move worktree is linked through
   the `hifth` profile, all three migrations applied, and a schema dump shows the three tables
   with row rules on, no table rights for the public roles, and later tables starting closed.
5. **Load the data, and check every row.** Done 2026-11-13. The load script refuses a store that
   already has rows, loads the whole backup in one go (so a failure leaves the store empty, not
   half-filled), then fingerprints each table: a row count and one hash over every row in key
   order. The compare step fingerprints the old store the same way. All three tables matched:
   9,046 / 83,668 / 4 rows, with identical hashes. None of this needs a database password; it
   goes through the command line's own login.
6. **Make a new password file.** The owner's step, in their own terminal in the main checkout
   (the password must not pass through a chat). **First bring back the plain settings file**
   from its encrypted copy: this laptop has only the encrypted one, and saving a value without
   the plain file rebuilds the encrypted copy from that one value, dropping the three Cloudflare
   entries. Then copy the new connection address from the dashboard (use the *session pooler*
   one, since this laptop has no IPv6) and save it as `SUPABASE_DB_URL` with the repo's
   hidden-prompt command. The prompt shows the shape it expects and refuses anything else (the
   project's web address, the direct address, the placeholder password left in, the wrong port
   or region), and `make env-check` checks a value already saved. That check was added on
   2026-11-13, after the web address was saved here by mistake. Done 2026-11-13. Every saved
   entry, where its value comes from and the commands for it are in the `secrets` skill.
7. **Prove it works.** Run the page-fixture script against the new store. Done 2026-11-13:
   page 1 (8 lines, 36 words) and page 604 (15 lines, 73 words). It first failed because
   Homebrew keeps `psql` in its own folder, off the path; the store scripts now look there too.
8. **Retire the old project.** Only after step 7. That is item ③.

<details><summary>Commands for each step</summary>

A Supabase command-line *profile* is a small file of web addresses plus a name, and the saved
login is filed under that name. A profile file with its own name (`hifth`, kept at
`~/.supabase/profiles/hifth.yaml`) therefore holds a second login next to the default one.
Commands without `--profile` keep using the old account. Its contents:

```
name: hifth
api_url: https://api.supabase.com
project_host: supabase.co
dashboard_url: https://supabase.com/dashboard
pooler_host: supabase.com
```

Every command in steps 3 and 4 takes the same `--profile` flag, and the store script in step 5
takes a profile name (it defaults to `hifth`). Setting `SUPABASE_ACCESS_TOKEN`
in the shell beats both saved logins, so leave it unset.

```
# 3 — log in once, in your own terminal (it opens a browser)
supabase login --profile ~/.supabase/profiles/hifth.yaml
supabase --profile ~/.supabase/profiles/hifth.yaml projects list
supabase --profile ~/.supabase/profiles/hifth.yaml link --project-ref <new project's ref>

# 4
supabase --profile ~/.supabase/profiles/hifth.yaml migration list   # all three show as not yet applied
supabase --profile ~/.supabase/profiles/hifth.yaml db push

# 5 — load into the empty new store, then check every row against the old store
#     (the old store's folder holds only its link, kept outside the repo so the
#     main checkout can be linked to the new project)
make qul-store-load BACKUP=packages/etl/data/qul/.cache/qul-store-backup/public-data-2026-11-12.sql
make qul-store-compare FROM_PROFILE=bytesofpurpose FROM_WORKDIR=~/.supabase/workdirs/hifth-old-store
make qul-store-check

# 6 — in your own terminal, in the main checkout, not through Claude
make env-keys-pull      # the key that opens the encrypted copy, from LastPass
make env-bootstrap      # the plain settings file, rebuilt with the Cloudflare entries in it
make env-set NAME=SUPABASE_DB_URL

# 7
dotenvx run -- node packages/etl/scripts/qul-page-fixture.mjs --page 1
```

Keep the new project's ID out of the repo, PRs and pages, as the setup guide says. The old one
had been written into two published decision records and is now removed from those pages. It
is still in git history and in one agent memory note.

</details>

### ② Did anyone ever sign up on the old store? · **answered**

No. Counted on 2026-11-13 by a query that returns numbers only: 0 sign-ups, 0 linked logins, 0 file
buckets, 0 stored files. Deleting the old project loses no one's account.

### ③ Delete the old project once the new store is proven · **open**

The old project is still running, and it stays running until the new store is proven, because
it is what the new store's rows are compared against. A deleted project cannot be brought back.

**What would answer it:** ① closed (the new store's rows match the old one's and the page-fixture
script has run against it). Then delete the old project from the old account's dashboard, and remove its
command-line profile if nothing else uses that account.

### ④ Should the new store accept connections only from listed addresses? · **open**

Today it accepts a connection from any internet address that has the password, the same as the
old store. Supabase can limit that to a list of addresses.

| | Keep it open (today) | Allow only listed addresses |
| --- | --- | --- |
| What it buys | Works from any network, with nothing to keep up | A stolen password is useless from anywhere else |
| What it costs | A stolen password works from anywhere | This laptop's address changes; each change locks the owner out until the list is updated |
| What it commits to | Nothing | Updating the list from a known address, or keeping a fixed address (a VPN with a set exit) |

**What would answer it:** the owner's choice. The store check reports which way it is set and
does not fail either way. The leak on 2026-11-13 printed the database password into a chat; a
list would have made that password useless from anywhere but this laptop.

### ⑤ Will reinstalling the Cloudflare setup keep the format checks? · **open**

The saving and checking commands (`make env-set`, `make env-check` and the scripts under
`scripts/env/`) are written into this repo by the global `cloudflare-onboarding` skill, and its
installer overwrites them when rerun. The checks added here on 2026-11-13 (the shape each value
must have, the refusal to save when only the encrypted copy exists) are not in the installer
yet, so a reinstall would quietly drop them.

**What would answer it:** the same checks carried into the `cloudflare-onboarding` skill's own
copies, with their tests, so every repo it sets up gets them.
