---
date: 2026-11-13
repo: hifth
session: 2b1703dd (Supabase move; two landing-page comments; security rules)
branch: supabase-move, security-rules (the rules file alone), env-set-formats (PR #608)
folded: yes
---

## Snags
- The `intent` commit labels: the first commit on a new branch made before `intent start` has no label, so the pre-push check refuses it. Labelling it with `intent answer` then needs one more commit, and that one has no label either. Run `intent start <task>` straight after `git worktree add`, before the first commit.
  - Landed: issues, "Before the first commit on a row" (run it straight after making a new working copy, and why), and extend, "Pushing and merging".
- A new worktree has no `node_modules`, so the commit hook fails at `tsc: command not found`. Run `pnpm install --frozen-lockfile --prefer-offline` (2.5 s from the store) before the first commit there.
  - Landed: extend, "Pushing and merging", the new-working-copy line.
- The pre-push check on a `.claude/`-only branch still runs the full browser tests (more than 10 minutes). Start the push with `run_in_background`, not a foreground call with a 600 s timeout.
  - Landed: extend, "Pushing and merging" (the push line now says it runs in full on an agent-folder branch, and to start it as a background run).
- The `answer-page-comments` skill's `pc` shorthand fails if kept in a shell variable, because zsh treats `$PC` as one command name. Use the page-comments MCP tools (`shot`, `reply`, `resolve`) instead.
  - Held: that skill belongs to the development-manager plugin, not this repo's skills; a fold of the plugin carries it.
- The `reader-decides-who-sees-their-data` memory says the tenet is in project CLAUDE.md and has a `sharing-who-has-my-data` backlog item. Neither is on main yet, so check before naming either.
  - Held: out of date. Both the tenet (project CLAUDE.md) and the backlog row are now on the branch, and the line is about a memory note, not a skill.
- `supabase config push` counts an empty answer as yes, so a "preview" run with no input pushed the settings file live (sign-ups on). Pipe "n" to preview; now in the leverage-qul skill and `docs/issues/supabase-config-push-answers-yes.md`.
  - Landed: already in leverage-qul ("Never preview a settings push without answering no"); manage-database's rules now point at it.
- The move page and register said the old project was paused; it was running. A status written from what was intended, not checked, misled the next step. Check the live state before writing "paused" or "done".
  - Landed: manage-database, a new rule to check the live state before writing paused or done; its account table no longer says "being paused".
- An `issues.json` item heading must end in a bare status word (`· **answered**`); `· **answered: no**` fails the register gate.
  - Landed: issues, "Write the row" (the heading ends in one bare status word).

## Worth copying
- Moving the store through the command line's own login (`supabase db query --linked`) needed no database password at all, and a per-table hash over every row in key order proved the copy, not only the counts. `.claude/skills/leverage-qul/scripts/qul-store.mjs`.
  - Landed: already in leverage-qul's scripts table (fingerprint and compare, no database password).
- Splitting the landing-page comments by thread with the other session working on that page, then telling the comment dispatcher who holds which, kept two sessions from committing over each other's work on the same files.
  - Held: belongs to the development-manager plugin's page-comments skill, not this repo's skills.
- Shipping the `.claude/claude-security-guidance.md` rules file alone on a `.claude/`-only branch (no paid publish run), while its test rides on the feature branch, put the rules in force at once without an extra paid merge.
  - Landed: already in extend ("A merge that changes only Markdown or the agent folder publishes nothing") and project CLAUDE.md.
- A secrets guard is tested by refusing what *names* the file, not by a list of reading commands; a reviewer found six ways round the list in minutes. `.claude/skills/secrets/scripts/guard-secrets.py`, and its live test ran a fresh session against a made-up `.env` and counted the marker in the output (0).
  - Landed: secrets, "What the guard refuses" (refuse by what names the file; the fresh-session marker test).

## Didn't work
- Redirecting a decrypt's normal output to hide the values: through `npx`, `dotenvx decrypt` writes them to the error stream, and every saved value reached the chat. No by-hand decrypt, ever; the guard now refuses it. `docs/issues/secrets-printed-into-chat.md`.
  - Landed: already in secrets, "What the guard refuses" (the first item).
- A reset reported in chat ("dbpass reset too") was not yet a closed leak: the saved address still connected with the printed password. After any reset, check the new value works and the old one is refused before marking a leak closed.
  - Landed: already in secrets, the database address row and `db-connects.mjs` (new value connects, old copy refused).

## Folded into
- `.claude/skills/issues/SKILL.md`
- `.claude/skills/extend/SKILL.md`
- `.claude/skills/manage-database/SKILL.md`
- `.claude/skills/secrets/SKILL.md`
