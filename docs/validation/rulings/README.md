# Rulings

The answers themselves. One file per sitting where a person was asked a question over and
over and a tool wrote down what they said — the input a scorer needs to arrive at a verdict
a second time, on a different machine, months later.

```
docs/validation/rulings/<when>-<check-id>.seed<N>.json
docs/validation/rulings/<when>-<check-id>.seed<N>.reader<X>.json   # when two people sat it
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

The file a session hands back carries the seed in *its* name too, and a narrowed session adds
the page fingerprint after it. That is not the naming convention above — it is what lands in a
downloads folder before anybody renames it — and it exists because two sittings under one seed
that asked about different pages would otherwise arrive as the same file, where the browser
appends a number and nothing on the outside of either says which is which.

The file also carries the fingerprint of the displacements it was placed against
(`shiftFingerprint`), and both scorers refuse to read a ruling against a different set. That
is deliberate: silently scoring yesterday's answers against today's measurement is the one
way this could go wrong without anybody noticing.

A session built on a **subset** of pages — either kind — carries a second thing: the ordered
list of pages it was allowed to draw from, and a fingerprint of that list (`select`). The
scorer replays that list instead of choosing again, for the reason the seed exists at all — the
trial list is rebuilt, not stored, and a rebuild that narrowed the pages differently would put
every trial index against a different mark while nothing threw. It refuses on that fingerprint
too, and refuses a third time if the displacements it is handed carry no row for a page the
sitting used. That last check is not redundant with the first: a file can carry the right
fingerprint and still be the wrong file for these pages, and the error message says so in those
words.

Both kinds can be narrowed, and they narrow differently on purpose. A placing session wants the
pages where the proposed move is largest and smallest, because it is estimating *how far* and
that is bought with leverage. A forced choice only ever asks which of two rectangles is closer,
so it takes an even walk through the print instead: it has no leverage to gain and it would
lose the one thing its headline claims, which is that the number is about the mus'haf rather
than about its strangest pages.

## Why some of them also name a person

A placing session says how far a rectangle is from where somebody put it, and that number has
two readings it cannot separate on its own: *the print is out by this much*, and *this person
puts rectangles this way*. Only a second person working the identical session — the same marks,
the same order, the same starting points — tells those apart, so the session records **whose
hand it was**, and when there are two of them the name goes in the file name after the seed:

```
2026-08-13T…-placement-holds-off-its-own-pages.seed31.readerB.json
```

That is not decoration. Two people sitting the same build otherwise produce two files with the
same name, and a half-finished sitting resumes out of whichever answers the browser saw last —
the second reader would resume into the first one's work and never know. Scoring one against the
other is `--against`, and it refuses two sittings that were not the same build, or two by the
same person, which compares a hand with itself and returns a beautiful number about nothing.

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
