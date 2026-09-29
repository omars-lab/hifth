---
name: manual-testing
description: The owner's parked list of by-hand checks, and how each one becomes an automated test once it is done. Use when the owner asks "what's next for me to review", "what should I test by hand", "manual testing", "what's parked", or wants to add something to check later; when a change leaves something only a person can judge (a feel, a wording, an account setting, a licence question); and when a by-hand check comes back with a verdict and should be turned into a regression test so nobody has to check it again.
---

# Manual testing

The owner does not want by-hand reviews pushed at them mid-work. They are **saved for later**, in
one list, and picked up when the owner chooses to. So:

- **Never end a turn by asking the owner to go and test something.** Add it to the list instead,
  in one line, and say it was parked.
- **When the owner asks what is parked**, read `checklist.md` (next to this file) and show the
  short version: the items in order, one line each. Nothing else.

The list lives in `checklist.md` so it can change without this skill changing. The detailed steps
for the phone-and-device checks already live in the validation ledger — the checklist points at
them by name and never copies them (see the `validate` skill, "Tier 7").

## Adding an item

One entry in `checklist.md`, under **Parked**, in priority order (what a Study Quran reader would
notice first goes first). Each entry says, in plain words:

- **What to look at** and where — a link that opens the app on the right page with the right thing
  open (`?open=`, `?tool=`, `?view=one|two`; see `docs/design/app-links.md`).
- **What right looks like**, so the owner can tell pass from fail without knowing the code.
- **Why a machine cannot check it yet** — this is the line that decides whether it can later be
  automated.
- **Ledger id**, if the check is in `docs/validation/ledger.json`.

## When a verdict comes back — make it a test

A by-hand check is a test we have not written yet. Every verdict the owner gives ends in one of
these, in the same change:

```mermaid
flowchart TD
  V[owner gives a verdict] --> Q{what did they find?}
  Q -->|something is wrong| F[write a failing test that shows it, then fix it]
  Q -->|it is right| P{can a machine now tell right from wrong?}
  P -->|yes: a size, a position, a colour, a word| T[write the test that holds it still]
  P -->|partly| E[automate the part it can; leave the rest in the ledger as what is left]
  P -->|no: a feel, a judgement, an outside answer| R[record the verdict with make record; set when it must be checked again]
  F --> D[strike it off the list]
  T --> D
  E --> D
  R --> D
```

Which kind of test, by what was checked:

| The owner checked | Hold it still with |
|---|---|
| where something sits, its size, that it stays on the page | a Playwright test that measures it (`apps/web/e2e/`), in Chromium and Firefox |
| how it looks | a golden picture (ask before re-baselining) |
| a wording or a number format | a unit test on the text |
| a flow: tap, open, land somewhere | a Playwright test of the flow |
| the machine half of a device check | an `evidence` block on the ledger check (`make validate-auto`) |
| something only a person can judge | stays in the ledger, `make record CHECK=<id> RESULT='…'` |

The owner's verdict is what the test encodes: a test written *before* anyone looked would only hold
what we guessed. That is why the list waits for them rather than being guessed away — and why,
once they have looked, the check never comes back to them.

When an item is done, move it to **Done** in `checklist.md` with the date and where its test is
(or the ledger record), so the list shows what has been turned into a test.
