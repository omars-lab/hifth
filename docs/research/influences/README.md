# What do other open apps do with their screens?

This folder holds what we learned from reading the source of well-used open apps that run on a Mac, an iPhone or iPad and the web.
The page to act on is [the catalog](catalog.md).
The other files are the record it was built from.

## Which file should I open?

| File | What it is |
| --- | --- |
| [catalog.md](catalog.md) | The one to act on: each app, what it does that we could borrow, and how sure we are. |
| [2026-11-16-a-findings.md](2026-11-16-a-findings.md), [2026-11-16-a-design.md](2026-11-16-a-design.md) | The first researcher's raw notes and what they would do with them. |
| [2026-11-16-b-findings.md](2026-11-16-b-findings.md), [2026-11-16-b-design.md](2026-11-16-b-design.md) | The second researcher's, written without seeing the first. |

## How was it made?

Two researchers answered the same question without seeing each other's work.
A third then read both, opened the sources again behind the claims that matter, and wrote the catalog.
A claim both found is marked as agreed.
A claim only one found, or that rests on a file nobody opened, is marked so, not dropped.

## How do I add to it?

Follow the `find-influences` skill in `.claude/skills/find-influences/`.
It says what to look for, where to write it, and what never to send to an outside service.

## Open questions, and what would answer each

### ① Has the layout plan taken in what the catalog found? · **open**

Written, but not on main yet. On 2026-11-16 the findings went into the layout plan on the launch branch: each of its items now has a "What other apps do" paragraph, and hiding the bars while reading became its open item ⑪. This item closes when that branch merges.

Before that, the layout plan (`docs/design/app-layout.md`) had items on moving around, pens, settings and first-run teaching that were written before anyone had looked outside.
Each finding that changes an item there should be added to that item's "what would answer it" line, with a link back to the catalog.
