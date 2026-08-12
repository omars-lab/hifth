# Transcripts

One file per sitting: what somebody did while working a manual check, written down as
they did it rather than remembered afterwards.

```
make session CHECK=<id>          →  2026-08-12T0641-<check-id>.jsonl
```

## Why these exist

The ledger has always ended a check the same way — one sentence of `result`, typed on the
laptop once the walkthrough is over. That sentence is the artifact and it is worth having,
but it is written from memory. A person walks ten steps on a phone over a quarter of an
hour, and whatever they noticed at step four survives only if they were still holding it at
step ten. Nobody can tell later whether a thin result meant there was nothing to say or
whether the saying happened too late.

A transcript fixes the ordering. The observation lands on disk while the step is still in
front of you, and the sentence at the end summarises a record instead of a recollection.

## What they are not

They are not a second ledger. `../ledger.json` stays the register — the verdict, the date,
the status — and a transcript is the working underneath one entry in it, the way
`../evidence/` is the working underneath a machine half. **Nothing reads a transcript to
decide whether a check passed.** A person reads one when they want to know how a verdict
was arrived at.

They also carry no score. The session page shows how far through you are and whether your
last answer was saved, and nothing else, because at least one check here —
`placement-correction-by-eye` — is a blind forced choice whose whole validity rests on
nobody, the worker included, knowing how it is going while it is going. A progress bar is
fine. A running tally would quietly turn a measurement into a training exercise.

## The format

JSON Lines, appended, one event per line, flushed per write — a session is twenty minutes
of scarce attention and the thing being defended against is losing it to a closed laptop or
a killed terminal. Append-only costs one line in the worst case; a rewritten document costs
the file. Every line carries a `t` stamped by the machine that wrote the file, never by the
browser posting to it, so the sequence can be read as one.

| `kind` | written when |
| --- | --- |
| `session` | the sitting opens — the check, the commit, the platform, how many steps |
| `step` | a runbook step is ticked or unticked |
| `note` | something is typed against a step (every version; the summary keeps the last) |
| `observation` | a check's own tool reports an answer — see below |
| `artifact` | a tool hands back a file, and where it was written |
| `verdict` | the sentence banked into the ledger, which closes the sitting |

A file with no `verdict` line is an unfinished sitting, and `make session` on the same check
offers to resume it rather than start a second one beside it. Two half-transcripts for one
check is the worst outcome available here: neither is the record, and whoever finds them
later cannot tell which was the real attempt.

## Tools that write here

A check may declare a `tool` in its runbook — a page it was given, built by its setup
commands. Opened from a session, that page finds a small sink on the window and posts to it;
opened as a plain file on its own, it finds nothing, the calls do nothing, and it keeps
whatever offline behaviour it had. Neither half knows anything the other does not.

```js
window.HIFTH_SESSION?.post("observation", { … });        // one answer, as it is given
window.HIFTH_SESSION?.artifact("ruling.json", { … });    // the file, at the end
```

## Are these committed?

Yes, the same way `../evidence/` and the golden images are: a claim about what happened on a
real machine, diffable, and worth nothing if it lives only in a scrollback. They contain no
Qur'anic text and no personal data — a transcript is timestamps, step ids, and words its
author chose to write into the record.
