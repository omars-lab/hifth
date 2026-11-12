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
| Who could read it | **The tables were open to the project's public key, for reading and for writing.** Supabase opens every new table that way, and our migrations never closed them. The new migration (dated 2026-11-12) closes them, and a test now fails if a table is ever added open. |
| The connection password file | Gone from disk: it lived in a worktree that was removed. The new project gets a new one. |

## Where does the data come from for the new store?

The two downloaded source files the fill-in script reads are no longer on this laptop. So the
old store was the only ready copy. It was copied on 2026-11-12 into a git-ignored backup
(`packages/etl/data/qul/.cache/qul-store-backup/`), and the copy's row counts match the live
store exactly. The backup holds the word text, so it never leaves that ignored folder.

## Open questions, and what would answer each

### ① Has the store moved to the new account, closed to the public key, with the old one retired? · **open**

**What would answer it:** the page-fixture script runs against the new store, and the old
project is paused. The steps:

1. **Copy the data out of the old store.** Done 2026-11-12 (above).
2. **Create the new account and project.** Postgres 17. Note the region: the connection
   address depends on it.
3. **Point the Supabase command line at it.** Log in as the new account, then link the repo to
   the new project from the repo root.
4. **Build the tables.** Push the migrations. The new project starts with the tables already
   closed to the public key.
5. **Load the data.** Restore the backup into the new project, then compare row counts with
   9,046 / 83,668 / 4.
6. **Make a new password file.** Copy the new connection address from the dashboard (use the
   *session pooler* one, since this laptop has no IPv6). Store it in an encrypted env file the
   way the scripts expect, and back its key up.
7. **Prove it works.** Run the page-fixture script against the new store.
8. **Retire the old project.** Only after step 7. Pause it first, delete later.

<details><summary>Commands for each step</summary>

```
# 3 — after logging in as the new account in your own terminal
supabase projects list
supabase link --project-ref <new project's ref>

# 4
supabase migration list         # both old migrations plus the close-the-tables one
supabase db push

# 5 — restore the backup (the password-bearing address is yours to supply)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f packages/etl/data/qul/.cache/qul-store-backup/public-data-2026-11-12.sql
supabase inspect db table-stats --linked

# 7
dotenvx run -- node packages/etl/scripts/qul-page-fixture.mjs
```

Keep the new project's ID out of the repo, PRs and pages, as the setup guide says. The old one
had been written into two decision records and is now removed from them.

</details>
