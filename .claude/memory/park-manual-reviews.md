---
name: park-manual-reviews
description: "Owner does not want by-hand reviews pushed at them; park them in the manual-testing skill's checklist and turn each into a test once checked"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-29T13:35:41.271Z
---

Don't end turns asking the owner to go test something. Add it to `.claude/skills/manual-testing/checklist.md` (Parked) and say it was parked. When they do check an item, turn the verdict into a regression test (or a ledger record if only a person can judge) and move it to Done.

**Why:** Owner, 2026-09-29: "I don't want to do manual reviews, I want to save for latter" and "manual testing skill should also consider regression tests, and how we can move things that need to be manually validated to regression tests after validation".

**How to apply:** "What's next for me to review" → show the parked list in one line each, nothing more. Related: [[nothing-too-small-to-fix]], [[checks-local-not-ci]].
