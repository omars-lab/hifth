---
name: backlog-is-the-only-record
description: "docs/backlog.md is the one self-contained page of every open item and question; anything open must reach a register before a session ends, or it is lost when the session is cleared"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-29T19:34:38.193Z
---

docs/backlog.md holds every open item and question **in full**, so it can be read on its own. It is
rebuilt by `make backlog` from the pages that own each item: PLAN follow-ups, performance.md, design
docs' open questions, the check ledger and decisions. Never edit it by hand. There is one backlog
only; the old docs/tasks/backlog.md was folded in on 2026-09-29.

**Why:** the owner, 2026-09-29: "backlog should track all open work / questions", "it should be
self contained", "there is no other way to track these open items once we clear our session". The
session task list and memory do not survive a clear. The sweep that day found three items that had
lived only in the task list: the Preact swap, the QUL command-line tool, and joining the commentary
sources to the pitch drawer.

**How to apply:** before ending a session, or clearing its task list, write each open thing into
its owning register with an issues.json row, then run `make backlog`. Never park open work only in
TaskList, memory, or a note in docs/issues/. Related: [[park-manual-reviews]], [[decisions-must-be-recorded-at-the-source]].
