---
date: 2026-11-12
repo: hifth
session: check card on the real iPad (walk capture session)
branch: guided-check
folded: 2026-11-19
---

## Snags
- `.claude/skills/guided-check/checks/walk-probe.json`: step 4's "see" said "Note in the note field whether iOS asked again". The owner pressed the cross with no note, and the answer couldn't be read. `check-card.mjs` now prints `ev=unclear_step` for a step worded that way. Every step needs to be a "Tick if …, cross if …" question.
  - Landed: already in guided-check ("How do I write a card that gives a readable answer?"), and held by a test: `.claude/skills/guided-check/scripts/check-card.test.mjs`.
- `check-card.mjs answers`: the throwaway probe's own log needed a second, hand-typed `devicectl copy from`. `--also` (`make check-answers ALSO=Documents/<folder>`) now brings it back with the answers.
  - Landed: already in guided-check (steps 5, "How do I get the answers back?" and the scripts table).

## Worth copying
- Reading the build's own log beside the card's answers. The log showed the recorder failing once on return from the Home Screen and then starting, which no tick or cross could have said.
  - Landed: already in guided-check ("What do I do with what came back?", first line).
- A check run from start to finish on the device, before any real code: one install, a five-step card, two copy-backs. That settled three open questions in about ten minutes of the owner's time.
  - Landed: guided-check, new line "Run a check before the real code, not only after it" under the short version.
