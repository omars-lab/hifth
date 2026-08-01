---
name: issues
description: Work the issue catalog — sweep for unindexed items, pick the next thing worth doing, write a new defect or open question down where it belongs, or close one. Use when asked "what's open?", "what should I work on next?", "is that tracked?", when a defect or an unanswered question is discovered mid-task, or when finishing work that closes something. Reads docs/issues.json, which is gate-checked, so its index is true or the build is red.
---

# Working the issue catalog

This repo has no GitHub issues and no issue tracker. Open work lives in **four
registers**, each of which was already disciplined before the catalog existed:

| register | holds | when a new item goes here |
|---|---|---|
| `docs/PLAN.md` §Open follow-ups | the roadmap of record | it changes what a loop must do, or it is a story that will need retelling |
| `docs/backlog.md` | performance and optimization only | it is a cost, not a defect — scheduled by evidence, not by loop |
| a design doc's §*Open questions, and what would answer each* | what that document knows it has not settled | it belongs to one document's subject matter |
| `docs/validation/ledger.json` | checks a machine cannot run | answering it needs a human, a phone, or a printed mushaf |

`docs/issues.json` **indexes** those four. It holds no titles, no descriptions and
no reproductions — those live in the register that owns the item, and a copy here
would be right for a while and then quietly stop being right. What the index adds
is what no single register can hold: severity, owner, what blocks it, what closed
it, and the fact that two registers are describing one thing.

```
make issues                  what is open, worst first
make issues ID=<id>          one item in full
make issues-doc              re-render docs/issues.md
pnpm gate:issues             the invariants
```

## The words

Six, and they are load-bearing:

| | means |
|---|---|
| `open` | nobody has decided; nothing named as blocking it |
| `confirmed` | a defect, **reproduced**, with the numbers in its source |
| `suspected` | read from the code — never reproduced or profiled |
| `blocked` | the next step is named and unavailable (hardware, a hafiz, a loop) |
| `answered` | decided; nothing owed in code |
| `fixed` | closed in code **and** in a test that would fail if it came back |

The `confirmed` / `suspected` line is the one people blur. Reproduce it or say you
did not. `page-turning.md` ⑩ has been `suspected` for six loops because the profile
was never run, and marking it `confirmed` would have made a guess look like a
measurement.

**`fixed` is a claim the gate audits.** It requires `closedBy` naming a file that
exists, and it is the repo's standing rule in one word: a result that did not
tighten something automated has not been banked. If you cannot name the test,
the status is not `fixed` — it is `answered`, or it is still open.

## Sweep — is everything tracked?

`pnpm gate:issues` already answers this in CI, in the direction that matters: it
reads every register and fails when one of them holds an item the index does not.
That reverse check is the reason the catalog exists. `page-turning.md` §7 ⑨ sat
in a design document as a `confirmed` defect for six loops; every forward pointer
in the repo resolved perfectly the whole time, because nothing pointed at it.

So a sweep is not a search. It is:

1. `pnpm gate:issues` — clean means every register item is indexed.
2. `make issues` — read it. The gate proves nothing is *missing*; only a person
   can notice that something is *wrong* — a `blocked` whose blocker has since
   arrived, a `suspected` somebody quietly reproduced, an `open` that was decided
   in a commit message and never written down.

## Triage — what next?

`make issues` prints worst-first: `confirmed` before `suspected` before `open`
before `blocked`. Pick the first row that is `owner: agent` and has no
`waiting on`. That ordering is deliberate — a reproduced defect outranks an
unanswered question, because the app is wrong today.

Two things it will not tell you and you should weigh:

- **`user`-owned items are not yours to do**, but they may be yours to *unblock*.
  `make phone-perf` existed only because follow-up ① sat behind four steps of
  DevTools friction. Removing the friction in front of a user-owned check is
  often worth more than any agent-owned row on the list.
- **A `blockedBy` naming another id is a chain.** `spread-mounts-two-leaves`
  waits on `mounted-set-ceiling`, which waits on the perf verdict. Working the
  tail of a chain is work you will redo.

## Open — write a new one down

Order matters: the register first, the index second. The item's text belongs to
the document that owns it, and the gate will refuse an index entry pointing at a
row that is not there.

1. **Pick the register** from the table above. If it fits two, it goes in the more
   specific one and gets indexed once — except when two registers genuinely
   describe the same thing from different angles, in which case index both and
   say so in each `note` (`mounted-set-ceiling` and `mounted-set-has-no-ceiling`
   are the standing example).

2. **Write the row** in that register, as a heading in the house convention:

   ```markdown
   ### ⑦ What is wrong, in a sentence someone else could act on · **confirmed**
   ```

   Continue the numbering that section already uses. Below it, prose: what is
   wrong, **what would answer it**, and — if you reproduced it — the viewport,
   the build and the numbers. A `confirmed` with no numbers is a `suspected`
   wearing the wrong word.

   A ledger check is JSON instead, and needs a runbook; see the `validate` skill.

3. **Index it** in `docs/issues.json`:

   ```json
   {
     "id": "kebab-slug",
     "source": { "file": "docs/design/page-turning.md", "item": "⑦" },
     "status": "confirmed",
     "severity": "defect",
     "owner": "agent",
     "blockedBy": ["loop-4b"],
     "note": "Only what the register cannot say. Optional — leave it out if the source says it all."
   }
   ```

   `severity` is `defect` (wrong today), `question` (undecided) or `risk`
   (unmeasured, which is where `suspected` lives). `owner` is `user` when it
   needs a human, a phone or a printed mushaf, `agent` otherwise. `blockedBy`
   entries that look like ids must resolve to an issue, a ledger check or a
   milestone; a person or a piece of hardware is written as prose (`"a hafiz"`),
   and the gate tells the two apart by whether the string has a space in it.

4. **`make issues-doc`**, then `pnpm gate:issues`.

## Close — and what closing costs

1. **Fix it, and write the test in the same change.** Not after. The test is what
   the word `fixed` means here.
2. **Update the marker in the owning register** — the heading's `· **status**` —
   and add a short *Closed by* paragraph naming what now notices a regression.
   Do not delete the item. The record of a defect that existed is worth more than
   a shorter document, and the next reader needs to know it was considered.
3. **Update the index**: `status`, and `closedBy` pointing at the test.
4. **`make issues-doc`**, then `pnpm gate:issues`.

If the fix taught you something the guess got wrong, say so in the register.
`page-turning.md` ⑪ is the model: the doc predicted reduced-motion would need the
duration token zeroed, the real answer was that the band is never inserted at
all, and the wrong prediction is left standing beside the correction because it
shows how the mistake was reachable.

**Do not mark something `fixed` from reading the code.** Four of that document's
eleven markers were wrong when the catalog was first built — three items had been
silently fixed loops earlier and still said `confirmed`. Check the code, then
check the test.

## What this skill will not do

- **Restate an item.** Ask `make issues ID=<id>`; it reads the title out of the
  owning document at the moment you run it.
- **Invent a status.** Six words, listed above. The gate refuses a seventh.
- **Let a `fixed` through without a test.** That is the whole point.
