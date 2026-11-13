---
date: 2026-11-13
repo: hifth
session: 2b1703dd (Supabase move; two landing-page comments; security rules)
branch: supabase-move, and security-rules (the rules file alone)
folded: no
---

## Snags
- The `intent` commit labels: the first commit on a new branch made before `intent start` has no label, so the pre-push check refuses it. Labelling it with `intent answer` then needs one more commit, and that one has no label either. Run `intent start <task>` straight after `git worktree add`, before the first commit.
- A new worktree has no `node_modules`, so the commit hook fails at `tsc: command not found`. Run `pnpm install --frozen-lockfile --prefer-offline` (2.5 s from the store) before the first commit there.
- The pre-push check on a `.claude/`-only branch still runs the full browser tests (more than 10 minutes). Start the push with `run_in_background`, not a foreground call with a 600 s timeout.
- The `answer-page-comments` skill's `pc` shorthand fails if kept in a shell variable, because zsh treats `$PC` as one command name. Use the page-comments MCP tools (`shot`, `reply`, `resolve`) instead.
- The `reader-decides-who-sees-their-data` memory says the tenet is in project CLAUDE.md and has a `sharing-who-has-my-data` backlog item. Neither is on main yet, so check before naming either.

## Worth copying
- Splitting the landing-page comments by thread with the other session working on that page, then telling the comment dispatcher who holds which, kept two sessions from committing over each other's work on the same files.
- Shipping the `.claude/claude-security-guidance.md` rules file alone on a `.claude/`-only branch (no paid publish run), while its test rides on the feature branch, put the rules in force at once without an extra paid merge.
