---
name: hifth-supabase-via-cli
description: "hifth's Supabase is the CLI default login on a separate account (org yakillzoqgybilhewwzg), project ref zbkqfstkjmgzsrraodez"
metadata: 
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-08T02:30:43.209Z
---

The hifth Supabase project (store for QUL page-map / word data, so the text lives
neither in the repo nor the shipped bundle — see [[qul-licensing]] and the design
doc docs/design/qul-page-source-and-diff.md) is on a **different Supabase account**
than the connected `claude_ai_Supabase` MCP.

**Concrete state (set up 2026-09-07):**
- Account: org `yakillzoqgybilhewwzg` (NOT `earlbear`/`zmzpebfwplbnclbzwmyj`, which
  is at its 2-project free cap — that is why a separate account was used).
- Project: name `hifth`, ref `zbkqfstkjmgzsrraodez`, region West US (Oregon).
  Public API URL `https://zbkqfstkjmgzsrraodez.supabase.co` (owner confirmed 2026-09-07,
  this is the **dev** store). That is the anon endpoint, NOT the credential: the ETL
  ingest needs the password-bearing `SUPABASE_DB_URL` Postgres string, which is the
  owner's to hold and run — I never enter it (safety rule).
- The repo is linked: `supabase/config.toml` (`project_id = "hifth"`) is committed;
  `supabase/.temp/` (holds the remote ref) and `.env*` are gitignored by the CLI's
  own `supabase/.gitignore`.

**Why the CLI, not the MCP:** the MCP connector is bound to earlbear and cannot be
switched mid-session. The owner logged the CLI in as the other account with plain
`supabase login`, which overwrote the CLI **default** token — so hifth commands need
NO `--profile` flag (the `--profile hifth` attempt failed: plain login writes the
default, not a named profile). `supabase projects list` (default) now shows hifth +
bytesofpurpose.

**How to apply:** drive all hifth Supabase work (migrations, the QUL ETL) through the
`supabase` CLI at the repo root — it is already linked. `supabase login` is interactive
and cannot run in the non-TTY tool shell; the owner runs it in their own Terminal.
Do NOT reach for the `mcp__claude_ai_Supabase__*` tools for hifth (wrong account).

**Connecting for the ETL ingest (verified 2026-09-08):** the ingest shells out to
`psql "$SUPABASE_DB_URL"`. Two gotchas found the hard way:
- **The direct host is IPv6-only.** `db.zbkqfstkjmgzsrraodez.supabase.co` has only an
  AAAA record; this laptop's network has no IPv6 default route → `psql` gives
  "No route to host". Use the **session pooler**, which is IPv4:
  `postgresql://postgres.zbkqfstkjmgzsrraodez:<DB-PASSWORD>@aws-0-us-west-2.pooler.supabase.com:5432/postgres`
  (Oregon = **us-west-2**, not us-west-1; user is `postgres.<ref>`, not bare `postgres`).
- **`psql` was not installed.** Added via `brew install libpq` (keg-only, at
  `/opt/homebrew/opt/libpq/bin/psql`); for the ingest's bare `psql` call it must be on PATH
  (`export PATH="/opt/homebrew/opt/libpq/bin:$PATH"` or `brew link --force libpq`).
- The dashboard's copyable string carries a literal `[YOUR-PASSWORD]` placeholder (15 chars);
  it must be replaced with the real DB password or auth fails as user "postgres".

Credentials live in a dotenvx-encrypted `.env` at the worktree root
(`/Users/omareid/Workspace/git/hifth-qul-etl`), gitignored: `SUPABASE_DB_URL` (encrypted),
`SUPABASE_SECRET_KEY` (encrypted), `SUPABASE_URL` (plain, public endpoint). Run the ingest via
`dotenvx run -- …`. The dotenvx private key is backed up in LastPass entry
`dotenvx/hifth/DOTENV_PRIVATE_KEY` (in its **password** field).
