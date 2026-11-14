---
name: hifth-supabase-via-cli
description: "hifth's Supabase store is on its own account, reached with the CLI profile ~/.supabase/profiles/hifth.yaml; the older account has its own bytesofpurpose profile; never the connected MCP"
metadata:
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-11-12T16:15:38.535Z
---

The hifth Supabase store holds the QUL page-map and word text, so the text lives neither in
the repo nor in the shipped bundle (see [[qul-licensing]]). It is managed with the `supabase`
CLI, never the `mcp__claude_ai_Supabase__*` tools, which are bound to a third account (earlbear,
at its free cap).

**Moved 2026-11-12** to a new account and project: `hifth.app`, region us-east-1, Postgres 17.11.
The plan page is `docs/design/supabase-move.md` (issue row `supabase-move`, branch and worktree
`supabase-move` / `../hifth-supabase`). The old project, on the older account, is paused, with
its tables closed by migration `20261112000001_close_qul_tables.sql`. Don't write either
project's ID in the repo, a PR or a chat. This folder is checked in, so read IDs from
`supabase --profile … projects list` when needed.

**Profiles (read in the CLI source and tested 2026-11-12):** `--profile` takes a built-in name
(supabase, supabase-staging, supabase-local, snap) or a path to a YAML file with
`name/api_url/project_host/dashboard_url/pooler_host`. The keychain login is filed under `name`,
so each file gets its own login slot. A bare `--profile hifth` fails because it is neither a
built-in name nor a file.
- `~/.supabase/profiles/hifth.yaml` (name `hifth`) is the new hifth account. Logged in.
- `~/.supabase/profiles/bytesofpurpose.yaml` (name `bytesofpurpose`) is the older account
  (the bytesofpurpose site and the old hifth store). Logged in 2026-11-12, and tested: it
  lists only that account's two projects, while the hifth profile lists only `hifth.app`.
- The default login (no flag) is still the older account, as of 2026-11-12.
- `SUPABASE_ACCESS_TOKEN` in the env beats every stored login.
- The link (`supabase/.temp`) is per checkout, not per profile.
- `scripts/supabase-profile.test.mjs` fails if a skill lists a hosted command without the hifth
  flag.

`supabase login` is interactive, so the owner runs it in their own terminal.

**The building scripts don't use the login.** The ingest and page-fixture scripts run
`psql "$SUPABASE_DB_URL"`, a password-bearing address that is the owner's to hold. I never
enter it.
- The direct database host is IPv6-only and this laptop has no IPv6, so use the **session
  pooler**: `postgresql://postgres.<ref>:<DB-PASSWORD>@aws-0-us-east-1.pooler.supabase.com:5432/postgres`.
  The user is `postgres.<ref>`, not bare `postgres`.
- `psql` comes from `brew install libpq` (keg-only, `/opt/homebrew/opt/libpq/bin`), so put it
  on PATH.
- The dashboard's copyable string has a literal `[YOUR-PASSWORD]` placeholder, which must be
  replaced.
- The old dotenvx `.env` is gone (its worktree was removed), so the new project needs a new one.

**Data:** the old store's rows are in the git-ignored
`packages/etl/data/qul/.cache/qul-store-backup/public-data-2026-11-12.sql` (counts 9,046 /
83,668 / 4, restore proven). A checksum-matched copy is in iCloud Drive at
`CloudDesktop/data/hifth/qul-store-backup/`. The owner chose to set the new project up first
and load the data later.
