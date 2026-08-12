# Rulings

The answers themselves. One file per sitting where a person was asked a question over and
over and a tool wrote down what they said — the input a scorer needs to arrive at a verdict
a second time, on a different machine, months later.

```
docs/validation/rulings/<when>-<check-id>.seed<N>.json
```

## Why these are here and not in a downloads folder

A session page hands its answers back as a download, because that is the only thing a page
opened from a file can do. That is where they stayed, which meant the numbers banked in
`../ledger.json` were reproducible by exactly one person on exactly one laptop until the
browser cleared it. A verdict whose working cannot be re-run is a verdict nobody can argue
with, and this project's whole shape is built on being able to argue with one.

So the answers come home, the same way the transcript beside them does.

## The three directories, and which is which

| directory | what it holds |
| --- | --- |
| `../sessions/*.jsonl` | the transcript — what a person did, step by step, as it happened |
| `../evidence/<id>.json` | a machine run's exit code, written by `make validate-auto` |
| `rulings/` | the answers themselves — the input a scorer re-reads to reproduce a verdict |

A transcript says *a sitting happened and here is how it went*. A ruling says *here is what
was answered*. They pair by stem: `2026-08-12T1650-placement-residual-by-hand.jsonl` is the
sitting, `2026-08-12T1650-placement-residual-by-hand.seed23.json` is what came out of it.

## Why the seed is in the name

The trials are not stored in the file — only the answers, keyed by index and trial id. The
seed is what rebuilds the trial list, so the seed is what makes an answer mean anything. A
ruling separated from its seed is a column of numbers.

The file also carries the fingerprint of the displacements it was placed against
(`shiftFingerprint`), and both scorers refuse to read a ruling against a different set. That
is deliberate: silently scoring yesterday's answers against today's measurement is the one
way this could go wrong without anybody noticing.

## Reading one

```
pnpm nudge:score      docs/validation/rulings/<file>      # the placing sessions
pnpm adjudicate:score docs/validation/rulings/<file>      # the forced choices
```

Both take `--shift <path>` when the displacements they were made against are not the ones
sitting in `packages/etl/out/`.

## Are these committed?

Yes. They contain no Qur'anic text: a ruling is page numbers, mark indices, offsets in page
units, and millisecond timings. No field can carry anything about the person who sat the
session except how long they took.

The one thing they do not carry is the file they must be scored against —
`packages/etl/out/mark-shift.json` is derived, and `packages/etl/out/` is ignored wholesale
because of what else lands there. Until that gap is closed, re-scoring a ruling on a clean
checkout means rebuilding the displacements first.
