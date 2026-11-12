# Moving the outside-library store to a new Supabase account

**What is moving?** The hosted database that holds our copy of the outside library (QUL): the
page layout and the per-word text the building tools draw our own word-by-word page from. It is
moving from the old Supabase account to a new account and project the owner controls. Nothing a
reader uses touches it. The app and the site never call it; only three building scripts do.

**What does a hafiz notice?** Nothing. The store feeds the tools that make and check pages, not
the app.

**Status:** started 2026-11-12. Tracked as the `supabase-move` row in the issue register.

## What is in the old store? (audited 2026-11-12)

| What | Found |
| --- | --- |
| Tables | Three: the page lines (9,046 rows), the word text (83,668 rows), the layout's own counts (4 rows). About 8.6 MB in all. |
| Schema history | Two migrations in the repo, both applied, nothing applied that the repo lacks. |
| Extensions | Only the four every new Supabase project starts with. Nothing to carry over. |
| Server functions, stored secrets, file buckets, preview branches | None. |
| Sign-ups | Not checked: the dump that would count them also copies password hashes, so it was refused. Very likely empty: no app code signs anyone in, and the settings file is the untouched default. Glance at *Authentication → Users* in the old dashboard to be sure. |
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
before. The old project was paused the same day, so these two files are the working copies until
the new store is loaded.

## Open questions, and what would answer each

### ① Has the store moved to the new account, closed to the public key, with the old one retired? · **open**

**What would answer it:** the page-fixture script runs against the new store, and the old
project is paused. The steps:

1. **Copy the data out of the old store.** Done 2026-11-12 (above).
2. **Create the new account and project.** Postgres 17. Note the region: the connection
   address depends on it.
3. **Point the Supabase command line at it.** Log in as the new account under its own profile,
   so the old account's login stays where it is, then link the repo to the new project.
4. **Build the tables.** Push the migrations. The new project starts with the tables already
   closed to the public key.
5. **Load the data — later, once the new project is set up.** The owner chose (2026-11-12) to
   set the new project up first and bring the data over afterwards. Restore the backup into the
   new project, then compare row counts with 9,046 / 83,668 / 4. The backup is the old project's
   data as of the day it was paused, so pulling again from the old project would need it
   restored first and gives the same rows.
6. **Make a new password file.** Copy the new connection address from the dashboard (use the
   *session pooler* one, since this laptop has no IPv6). Store it in an encrypted env file the
   way the scripts expect, and back its key up.
7. **Prove it works.** Run the page-fixture script against the new store.
8. **Retire the old project.** Only after step 7. Pause it first, delete later.

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

Every command in steps 3 to 5 takes the same `--profile` flag. Setting `SUPABASE_ACCESS_TOKEN`
in the shell beats both saved logins, so leave it unset.

```
# 3 — log in once, in your own terminal (it opens a browser)
supabase login --profile ~/.supabase/profiles/hifth.yaml
supabase --profile ~/.supabase/profiles/hifth.yaml projects list
supabase --profile ~/.supabase/profiles/hifth.yaml link --project-ref <new project's ref>

# 4
supabase --profile ~/.supabase/profiles/hifth.yaml migration list   # all three show as not yet applied
supabase --profile ~/.supabase/profiles/hifth.yaml db push

# 5 — restore the backup (the password-bearing address is yours to supply)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f packages/etl/data/qul/.cache/qul-store-backup/public-data-2026-11-12.sql
supabase --profile ~/.supabase/profiles/hifth.yaml inspect db table-stats --linked

# 7
dotenvx run -- node packages/etl/scripts/qul-page-fixture.mjs --page 1
```

Keep the new project's ID out of the repo, PRs and pages, as the setup guide says. The old one
had been written into two published decision records and is now removed from those pages. It
is still in git history and in one agent memory note.

</details>
