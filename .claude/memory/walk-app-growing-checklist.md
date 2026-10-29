---
name: walk-app-growing-checklist
description: walk-app skill walks every flavour (pitch/public, desk/laptop/iPad/phone both ways, Arabic, Firefox, Mac/iPad apps); every fault found adds a line to its checklist.md
metadata:
  type: feedback
---

Owner (2026-10-07) asked for a proper "walk the app" skill covering every flavour of the app, with a **growing checklist**: each time a walk finds a new fault, add a line to `.claude/skills/walk-app/checklist.md` (surface, devices, issue id) in the same change as the fix and its test.

**Why:** walks kept finding faults that were fixed once and never looked for again on purpose; the list makes the next walk check them.

**How to apply:** walk with `make drive DEVICE=<desktop|laptop|ipad|ipad-side|ipad-big-side|phone|phone-side> SEEN_COACH=1 [BROWSER=firefox] [LOCALE=ar]`; each fault → design-doc item + issues.json row + task + failing test + checklist line. Related: [[park-manual-reviews]], [[backlog-is-the-only-record]].
