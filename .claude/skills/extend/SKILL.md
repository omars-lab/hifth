---
name: extend
description: Find where a feature lives in Hifth before changing it — the entrypoint files, the order to read them, how to extend them, and which gates will judge the change. Use when asked to add or modify a feature, when orienting in this codebase, when asked "where does X live?" or "where do I start?", or when onboarding someone to the repo. Reads docs/map.json, which is gate-checked, so its pointers are true or the build is red.
---

# Extending Hifth

Three layers, and the boundary between them is enforced by ESLint, not by
convention:

| | is | rule |
|---|---|---|
| **L1 `packages/core`** | framework-free TypeScript: keys, resolver, highlighter, adjacency | may not import React, may not import from `apps/` |
| **L2 `apps/web`** | React 18 shell around an imperatively-driven SVG stage | owns all DOM and all state |
| **L3 `packages/etl`** | Node scripts that turn vendored data into committed assets | output is diffed in CI; must be deterministic |

Adding logic to a component that belongs in core is the most common way to make
this codebase worse, because nothing catches it. Ask which layer owns the change
before writing it.

## Start here, always

```
make map                     one line per feature — what exists
make map FEATURE=<id>        the walkthrough for one
```

That is the whole orientation step. `make map FEATURE=<id>` prints, for one
feature: the ordered path through the code as `file:line` with a note on why each
file matters, the steps to extend it, and the gates that will judge the result.

**This skill deliberately does not list any of that.** The entrypoints live in
exactly one place — `docs/map.json` — because a second copy drifts and the drifted
copy still reads like fact. Read the map; don't ask this file where `HopRail`
lives.

The `file:line` it prints is computed at read time from the symbol, never stored,
so it is correct at the moment you read it.

## The procedure

1. **`make map`** → pick the feature. If nothing fits, the change is a new
   feature; see *Adding to the map* below.
2. **`make map FEATURE=<id>`** → read the path in the order printed. It is
   ordered by dependency, not by importance: entry 1 is what the rest assumes.
3. **Follow `see also`.** A change that looks like it lives in one feature very
   often lands in its neighbour — a new edge kind is `the-hop` *and*
   `edge-data-etl`, and only one of those has a determinism gate.
4. **Write the change**, in the layer that owns it.
5. **Run what the map said would judge it** — the `what will judge it` list is
   per-feature and is the short loop. `make ci` is the long one.
6. **Update `docs/map.json` if the change moved a mapped symbol.** The
   pre-commit hook will make you; see below.

## The map cannot rot

`scripts/gate-map.mjs` opens every file the map names and asserts the symbol
beside it still appears in real code — not merely in a comment, which is how the
first draft of the map got a pointer wrong and passed anyway.

It runs in two places:

- **pre-commit**, scoped to the staged files. Rename a mapped symbol and the
  commit is refused, naming the entry to fix. This is on purpose and the timing
  is the whole point: you are renaming the thing right now, so you know where it
  went. Ten minutes from now nobody does. (`git commit --no-verify` bypasses it
  for one commit; CI still checks the whole map.)
- **CI**, unscoped, on every push — `pnpm gate:map`.

So a stale pointer is a red build, not a slow disappointment for whoever trusted
it next year.

## Adding to the map

A new feature gets an entry in `docs/map.json` in the same commit that adds it.
The schema is documented in that file's `$comment`; the fields that matter:

- **`entry[]`** — ordered. Each is `{file, symbol, note}`. The `note` says *why a
  reader is being sent here*, not what the code does; the code says that. Two to
  six entries. A map with twelve is a table of contents, and nobody reads it.
- **`symbol`** — a name that exists in the file. Never a line number: line numbers
  rot on every insertion above them and nothing fails.
- **`extend[]`** — the steps someone would otherwise have to discover by breaking
  the build. Prefer the non-obvious ones: which ETL run must follow, which gate
  enforces the invariant they are about to violate.
- **`gates[]`** — the commands that judge this feature specifically.

Then `pnpm gate:map` to confirm every pointer resolves, and `make map FEATURE=<id>`
to read it as a newcomer would.

## Traps

- **Build core first.** `apps/web` and the ETL both resolve `@hifth/core` through
  its built `dist/`, so a core edit is invisible until `make core`. `make
  typecheck` / `test` / `e2e` / `ci` do it for you; a bare `pnpm vitest` does not.
- **The ETL output is committed and CI re-runs it.** Any change under
  `packages/etl` means `make etl` in the same commit, and the ETL must be
  deterministic — CI diffs a fresh run against the committed assets.
- **A new gate is three edits, not one**: `scripts/gate-*.mjs`, `pnpm gates` in
  `package.json`, and *both* `make ci` and `.github/workflows/ci.yml`. A gate in
  `pnpm gates` that no CI job runs is a comment.
- **Several agents share this checkout.** Anything that builds, installs or stages
  takes the lock: `make lock L=build CMD="…"`. Protocol in
  `docs/PARALLEL-AGENTS.md`.

## Where the other answers live

| Question | Go to |
|---|---|
| Where does this feature live? | `make map` — here |
| Is my change correct? | `/validate` |
| Why did the run fail? | `/review-reports` |
| What is the project doing next? | `make status` → `docs/PLAN.md` |
| Why is it built this way? | `docs/decisions/loop-*.md` |
