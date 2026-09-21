# Should we build a fine check that holds our page against the other library's?

**Status:** decided **B** by omar, 2026-09-21 — asked 2026-09-06. Build the fine check as a
report a person runs and reads, not a guard that watches forever. See [The decision](#the-decision).

**Picture:**
<https://blog.bytesofpurpose.com/hifth/docs/design/qul-page-source-and-diff.html> — the whole
map of what stands between us and both halves of this idea: drawing a page from the other
library, and checking ours against it. This record is the checking half. Checked in as
[`docs/design/qul-page-source-and-diff.html`](../design/qul-page-source-and-diff.html), rebuilt
from its authored source by `scripts/build-qul-page-source-and-diff.mjs`.

Read the picture first. This file is the reasons for one of the two decisions it maps; its
sibling is [the development-only draw](qul-dev-draw-toggle.md).

## What is being decided

Today the app carries its own drawn pages of the mus'haf. A separate public collection of
Qur'an data — the same one we already read once, as a ruler, to check our 604-page table —
publishes its own map of which words sit on which line of which page, for the printing we
settled is the right one to check against. The question here is whether to build a *fine*
check that holds our page up against that library's, line by line and ayah by ayah, and
records every place the two disagree.

Nothing of the library ships. A page map can be compared to a page map entirely in word
numbers, with no letters changing hands, so the whole of this stays on the safe side of the
standing rule that we ship no Qur'an text.

## Why it is being asked now

The owner asked what it would take to base a page on the other library and to diff our page
against it and mark the problems. Splitting that in two, this is the cheap half: it changes
nothing a reader sees and only tells us where to look. It is also aligned with work already
finished — two loops cross-checked all 604 pages at the coarse level of "which ayah starts
which page," and this is the finer check that coarse pass pointed at.

## What happens if nobody decides

Nothing breaks. We keep the coarse check we already have, and we do not learn the finer
disagreements it cannot see. This is a settled, working posture; the cost of leaving it is
only the check we do not yet run.

## What we do today, and what that costs

The coarse cross-check compared page tables at the level of page boundaries and settled which
printing to trust. It does not compare where each word falls on its line, where lines break,
or where each ayah begins and ends — so a disagreement inside a page is invisible to it.

## What people outside this project do

I looked only inside the project for this scoping pass, and should say so plainly. The
internal prior art is direct: this project has twice built an independent-witness check — a
page table against an outside page source, a word-splitting habit against a third grammar —
and those set the pattern this leans on. The outside world's practice was surveyed in the
dependency audit and is not re-gathered here.

## What already constrains it

- **We ship no Qur'an text.** Kept by the shipped bytes, not by policy. The comparison stays
  inside this rule because it needs only word numbers, never letters.
- **We already treat the library as a ruler, and only a ruler**, and settled which printing
  is the one to check against. This builds on that, and reaches no further.
- **A difference of convention is not a mistake to correct** — the lesson the word-splitting
  check taught, and the one this must not forget.

## The options

| | | |
| --- | --- | --- |
| **A** | Keep the coarse page check we already have | No new work; the finer disagreements stay unseen. |
| **B** | Build the fine check as a one-time report we read and act on | Right if the disagreements are few and mostly differences of habit. |
| **C** | Build the fine check as a held count an automated guard watches forever | Right if we expect the set to stay small and want a new disagreement to be noticed the way a new off-grid box is. |

Doing nothing is A.

## What else could be considered, and is not here

The scoping page lists the finer sub-choices this decision folds together: which of the four
things to compare (word-to-line, line breaks, ayah boundaries, page boundaries), how much
slack counts as a match, and which register a genuine disagreement is filed under. They are
real, but they are the *how* of B or C, not a separate decision, so they are held on the
picture rather than split out here.

## What would change the answer

The size and nature of the first run's output: a short list of conventions argues for A or a
light B; a handful of true defects argues for C, the held count. A hafiz judging a sample of
the disagreements — which are error and which are habit — is what nobody has done yet, and it
is what would settle B-versus-C honestly.

## The decision

**B, decided by omar on 2026-09-21: build the check, and build it as a report a person runs
and reads — not a guard that watches forever.** The owner's words were "wire it in as a fourth
witness." That rejects A (do nothing) outright. Between B and C, two facts settled it, so no
further question was needed:

- **C cannot exist here.** A guard that watches forever has to run on its own, and this check
  cannot: the library's page map is a sign-in-gated download, so the file has to be handed to
  the check by a person each time. A guard with no file to read would either never run or would
  end up comparing our page table to a frozen copy of our own numbers — which watches nothing.
  Its twin, the coarse cross-check, is opt-in for exactly this reason, and this follows it.
- **B is what the finding could actually support.** When the check was built, the fine,
  word-by-word granularity the question imagined — which word sits on which line — turned out
  not to be sound: the library counts the words of the mus'haf differently than we do (a
  different split of the same text), so lining up word-for-word would invent disagreements that
  are only a difference of counting. So the built check compares the parts that need no such
  line-up and are therefore trustworthy: **where each surah opens** (all 114 agree, to the
  page) and the shape of the print (604 pages, 15 lines each — both agree). That is a report
  worth reading, and it is honest about the one comparison it does not make.

**What was built:** a second-opinion probe (`scripts/probe-qul-v2-layout.mjs`, `make
probe-qul-v2 DB=<the downloaded file>`) that reads the library's V2/1421H layout in place,
stores none of its bytes, and checks our page table against it. It is documented as the twin of
the existing coarse probe in the validation ledger's spot-audit runbook, and attributed in
`SOURCES.md`. First run, 2026-09-21: 114/114 surah openings agree, constants agree.

**What is deliberately left for later:** the finer sub-choices the picture holds (line breaks,
ayah boundaries, how much slack counts as a match) stay unbuilt until a run shows a real
disagreement worth filing — which the first run did not. If a future word-level source ever
does line up with our counting, reopening C would be a fresh decision, not a reversal of this
one.

## What this is not settling

It does not decide whether we ever *draw* a page from the library — that is the sibling
decision. It does not read any licence, does not reopen which printing is the right witness,
and does not touch the app's own rendering path, which needs nothing here.
