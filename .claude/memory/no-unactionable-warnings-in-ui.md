---
name: no-unactionable-warnings-in-ui
description: "a warning that gives the reader nothing to do is a backlog item for us, not a banner for customers (owner, 2026-09-25)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-25T18:29:18.358Z
---

A notice that only reports a risk the reader cannot act on does not belong in the app. Owner, 2026-09-25, about the "Offline storage is not guaranteed" banner: "this should be a backlog item for us to address .. not something we show customers".

**Why:** Hifth is a POC being pitched ([[poc-for-study-quran-team]]). A banner about our own plumbing makes the app look broken and asks the reader to worry about something only we can fix.

**How to apply:** before adding any warning, ask "what can the reader do about this?" If nothing, leave it out of the app and record it in docs/performance.md plus docs/issues.json. Warnings with a real action (storage cap they set, install offer, kept juz cleared) stay. Done in commit 3bdda28, issue `storage-not-kept`.
