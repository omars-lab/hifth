---
date: 2026-11-10
repo: hifth
session: f20a6685-f1f6-450b-9b0a-9cf2dce93d64
branch: open-work-plan, PR #587; then intent-labels
folded: no
---

## Snags
- `make pre-push` (the browser tests' server): a preview server left over from an earlier run held the tests' port, and the push failed minutes in with an error that did not name the cause. It should say so at the start. Pushing again with `HIFTH_REUSE_SERVER=1` worked.
- `scripts/gate-gates.mjs`: it only looked at the two hook files it knew by name, so a third file in `.githooks/` would have been checked by nothing. Widened on the `intent-labels` branch.
- `.claude/skills/testing/SKILL.md`: says the browser tests build the app first (they do not) and names an old Node. The Firefox run covers a fixed list of test files, so a new test file is skipped there until it is added to the list.
- The plugin repo's `scripts/cli`: `make update` only updates plugins already installed. A new plugin needs `make install-plugin PLUGIN=<name>` once, and nothing says so.
- Running one repo's git-heavy tests while another repo's push checks were running: it slows both and makes a timing failure hard to read. Run them one after the other.

## Worth copying
- Asking for a review right after the first commit of a new tool, before building on it. It found three gaps the 45 passing tests did not cover (a hook that could stop a commit, a comparison against a stale local main, a first install with no command on the path). Each then got a test seen failing first.
- Tests for anything that runs git: a throwaway repo with every `GIT_*` variable stripped and the global settings pointed at nothing, so a commit hook's own variables cannot reach the real repo.

## Didn't work
- Reading a tool's output with a helper that trims it, when the output is split on the unit-separator character: Python counts that character as blank space and trims it away. Read the raw output.
