# Completed tasks

An archive, not a register — the session task tracker (`TaskList`) only shows what's still open,
so a task moves here once it's done rather than staying in that list forever. This file is not
the record of what was decided or found; that lives in the design docs, decisions, and commits
each task fed into. This is a dated pointer back to those, kept so a finished task isn't simply
deleted and forgotten.

Nothing here is hand-restated from those sources beyond a one-line summary — read the linked
commit or design-doc item for the actual reasoning.

## #209 — Rebuild the piece-union candidate script (reach-for-the-ink)

**Done:** 2026-08-19, commit `650ecbd` "Rebuild the piece-union script the doc's numbers came
from, so ㉜ has one".

The "reach for the ink" script behind item ㉘/㉙'s numbers had been run twice and discarded —
never committed, so nothing backed the two aggregate figures on record. Rebuilt as
`packages/etl/scripts/probe-piece-union.mjs`, reusing `readPageInk`/`shapeOf` from
`packages/etl/lib/ink.mjs`. Needed before #210 could test a guard against real per-mark candidate
output rather than two remembered numbers.

## #210 — Score an area-ratio cutoff against the 45 doubled ground-truth marks

**Done:** 2026-08-19, commit `e333652` "The guard ㉜ proposed catches a quarter of what it needs
to; both ways, three in four" — full writeup at
[`docs/design/mark-registration.md` item ㉝](../design/mark-registration.md).

Ran the rebuilt script against all 89 ground-truth marks with a settled reader answer. The guard
exactly as ㉜ proposed it — refuse only when a candidate grows past the shipped rectangle —
catches just 5 of 20 (25%) real disagreements, because 15 of those 20 are candidates that
*shrank*, which a one-sided "too big" test structurally can't see. The same measure read
**symmetrically** (flag both far-too-big and far-too-small) catches 15 of 20 (75%) at one false
flag among 52 good marks (94% precision). Verdict: the guard as literally proposed — kill; the
symmetric reframing — confirmed, and escalated as a revision to ㉜'s own test. Later doubled to
181 marks and re-cut at 1.75/0.571 by item ㉞ — see
[`hifth-continue.md`](../../.claude/prompts/hifth-continue.md) §1 for where that stands now.
