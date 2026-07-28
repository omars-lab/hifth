---
name: maintain-use-cases
description: Keep Hifth's promises and their proofs honest — docs/use-cases.json, the actor/use-case map rendered to docs/use-cases.md. Use when asked what this app promises or who it is for, when asked whether a feature is actually tested, when adding or removing a user-facing capability, when gate:use-cases fails, or when writing tests and needing to know which promise is thinly proven. Every entry names a test or a gate and is gate-checked, so its pointers are true or the build is red.
---

# Hifth's promises, and what keeps them

`docs/use-cases.json` is the only place a promise is written down. Everything
else is a renderer:

```
make use-cases              one line per use case, grouped by actor
make use-cases ACTOR=<id>   one actor's whole picture, with file:line
docs/use-cases.md           the mermaid map + tables (make use-cases-doc)
pnpm gate:use-cases         the gate — CI and pre-commit
```

**Never restate a use case anywhere else.** Point at the id. A second copy of a
promise drifts from the first, and the drifted copy still reads like fact — the
same reason `/extend` refuses to list entrypoints.

## What makes this file different from the map

`docs/map.json` answers *where do I change this*. This answers *what did we
promise, whose promise is it, and what fails if we break it*. They join on
`feature`: every use case names a map feature, and the gate refuses one that
does not.

The invariant that gives the file its value: **every use case names a proof** —
either `{file, test}`, a real test title, or `{gate}`, a script `package.json`
defines. You cannot write a promise here without saying what keeps it. A promise
whose proof is thinner than the promise gets a `gap`, and the `gap` is rendered
in the doc and collected in its own section. An honest hole is a to-do; a hidden
one is a lie.

## The procedure

**Asked what the app does, or who it is for:** `make use-cases`. Do not
reconstruct it from the code — the file exists so nobody has to, and it carries
the proof each claim rests on, which the code does not.

**Asked whether something is really tested:** `make use-cases ACTOR=<id>`. The
`proof` lines are the answer, and a `NOT proven` line is a truthful *no*.

**Adding a user-facing capability:** add the use case in the same commit.

1. Pick the `actor` whose goal it is. If none fits, the new actor needs its own
   use cases in the same commit — the gate refuses an actor with none, because
   a name with nothing behind it reads as scope we do not have.
2. Write `goal` in the actor's voice, first person, as the thing they want —
   not the mechanism. *"Show me the ayahs I keep confusing this one with"*, not
   *"render the hop rail"*. The mechanism is `code`; the map has the rest.
3. `feature` — the `docs/map.json` id where someone would change it.
4. `code[]` — two or three `{file, symbol}`. Symbols, never line numbers.
5. `proof[]` — the test that would fail if this broke. If the honest answer is
   "nothing end to end", write the thin proof you do have **and** a `gap`
   saying so in one sentence. Do not leave the promise bare and do not invent
   coverage.
6. `includes[]` — only for a genuine prerequisite (you cannot hop without
   selecting). It draws the dotted arrows in the diagram.
7. `pnpm gate:use-cases`, then `make use-cases-doc`, and commit the regenerated
   `docs/use-cases.md` alongside.

**Writing tests and looking for where it matters most:** the *What is promised
more than it is proven* section of `docs/use-cases.md` is the list, ordered by
nothing but honesty. Closing a gap means deleting the `gap` field in the same
commit as the test that closes it.

## The gate

`scripts/gate-use-cases.mjs` runs on every push (`pnpm gate:use-cases`) and
pre-commit, scoped to the staged files. It refuses:

- a `code` symbol that no longer exists — checked the map's way, in real code
  and not merely in a comment (`scripts/code-pointers.mjs`);
- a `proof` naming a test that is gone, or a string that is in the file but is
  not a test title. A title that drifted by one word is exactly the drift worth
  catching and is invisible to a substring search;
- a `proof` naming a `gate` script `package.json` does not define;
- a use case with no proof at all;
- a `feature` the map does not define, or an `includes` naming nothing;
- an actor with no use cases;
- a `docs/use-cases.md` built from a different source — the file carries a
  `use-cases-hash` stamp, and the fix is `make use-cases-doc`.

The pre-commit timing is the point: you are renaming the test *right now*, so
you know which promise it was standing behind. Ten minutes from now nobody
does. (`git commit --no-verify` bypasses it once; CI still checks everything.)

## Traps

- **`docs/use-cases.md` is generated.** Hand edits are lost on the next
  `make use-cases-doc` and the gate fails in between. Edit the JSON.
- **Renaming a test renames a proof.** The hook will tell you; update the entry
  rather than deleting it, unless the promise really is now unproven — in which
  case it needs a `gap`, not silence.
- **Deleting a feature deletes its use cases.** A promise pointing at a map
  feature that no longer exists is caught, but a promise for a capability that
  quietly stopped working is not. Removing the code means removing the entry.
- **Ids are stable.** Other documents and this skill's callers cite them; renaming
  one is a rename across the repo, not an edit here.

## Where the other answers live

| Question | Go to |
|---|---|
| What do we promise, and what proves it? | `make use-cases` — here |
| Where does this feature live? | `/extend` → `make map` |
| Is my change correct? | `/validate` |
| What is the project doing next? | `make status` → `docs/PLAN.md` |
