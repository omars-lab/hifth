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

## The displacements, beside the answers that were given about them

A ruling on its own is still not re-scorable. It says where a reader put a rectangle; it does
not say what rectangle they were shown, and that came from a file of per-page displacements
which is derived, lands in `packages/etl/out/`, and is ignored wholesale because of what else
lands there. So a committed ruling was auditable only by somebody who could first rebuild the
measurement — which is most of the way back to a verdict nobody can argue with.

Those files are now here too. They are the smallest thing that closes the gap: a page number
and two offsets per row, no ink, no scripture, and nothing a person typed.

| file | pages | what it is |
| --- | --- | --- |
| `mark-shift.40pages.c8528da9.json` | 40 of 604 | what the placing session and the forced choice were both built from |
| `mark-shift.604pages.c849e72d.json` | 600 of 604 | the full pass, 2026-08-12 — the input for anything built after |

**The fingerprint is in the name on purpose.** A ruling pins the displacements it was placed
against, and the scorers refuse to read it against any others; putting that same hex in the
filename means the pairing is legible before either file is opened, rather than being a thing
you discover from an exit code. So the sitting of 2026-08-12 re-scores, from this directory
and nothing else:

```
pnpm nudge:score docs/validation/rulings/2026-08-12T1650-placement-residual-by-hand.seed23.json \
                 --shift docs/validation/rulings/mark-shift.40pages.c8528da9.json
```

The 604-page file is not what that sitting was asked about and must never be substituted into
it — the scorer will refuse, but the reason is worth knowing anyway: it would be scoring one
day's answers against another day's measurement, which is the single failure this whole
naming exists to make loud.

## Are these committed?

Yes. They contain no Qur'anic text: a ruling is page numbers, mark indices, offsets in page
units, and millisecond timings. No field can carry anything about the person who sat the
session except how long they took.
