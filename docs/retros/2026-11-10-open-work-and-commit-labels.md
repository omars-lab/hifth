---
date: 2026-11-10
repo: hifth
session: f20a6685-f1f6-450b-9b0a-9cf2dce93d64
branch: open-work-plan, PR #587; then intent-labels
folded: 2026-11-19
---

## Snags
- `make pre-push` (the browser tests' server): a preview server left over from an earlier run held the tests' port, and the push failed minutes in with an error that did not name the cause. It should say so at the start. Pushing again with `HIFTH_REUSE_SERVER=1` worked.
  - Landed: already in testing (the push checks the ports first with `make e2e-port-free`, and `HIFTH_REUSE_SERVER=1` is explained); held by a test: `scripts/e2e-port-free.test.mjs`.
- `scripts/gate-gates.mjs`: it only looked at the two hook files it knew by name, so a third file in `.githooks/` would have been checked by nothing. Widened on the `intent-labels` branch.
  - Landed: held by a test: `scripts/gate-gates.test.mjs` (the "third hook" cases).
- `.claude/skills/testing/SKILL.md`: says the browser tests build the app first (they do not) and names an old Node. The Firefox run covers a fixed list of test files, so a new test file is skipped there until it is added to the list.
  - Landed: already in testing (it now says the browser tests do not build the app, names Node 22, and the commit check `pnpm gate:e2e-runs` refuses a new file that is on no list).
- The plugin repo's `scripts/cli`: `make update` only updates plugins already installed. A new plugin needs `make install-plugin PLUGIN=<name>` once, and nothing says so.
  - Landed: belongs to another repo (the plugin marketplace); marked only.
- Running one repo's git-heavy tests while another repo's push checks were running: it slows both and makes a timing failure hard to read. Run them one after the other.
  - Landed: testing, "Tests that run git".

## Worth copying
- Asking for a review right after the first commit of a new tool, before building on it. It found three gaps the 45 passing tests did not cover (a hook that could stop a commit, a comparison against a stale local main, a first install with no command on the path). Each then got a test seen failing first.
  - Landed: extend, "Traps".
- Tests for anything that runs git: a throwaway repo with every `GIT_*` variable stripped and the global settings pointed at nothing, so a commit hook's own variables cannot reach the real repo.
  - Landed: testing, "Tests that run git" (names `fixtureEnv()` in `scripts/gate-fixture.mjs`).

## Didn't work
- Reading a tool's output with a helper that trims it, when the output is split on the unit-separator character: Python counts that character as blank space and trims it away. Read the raw output.
  - Landed: belongs to another repo (the plugin marketplace, the intent tool); nothing in this repo splits output on that character. Marked only.
