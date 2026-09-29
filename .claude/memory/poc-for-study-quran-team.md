---
name: poc-for-study-quran-team
description: "Hifth is a personal POC, not a release; the near-term goal is a rushed qualitative demo to pitch The Study Quran team for collaboration buy-in"
metadata: 
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-19T15:31:55.311Z
---

As of 2026-09-19 the owner set the mental model for Hifth: it is a **personal
proof-of-concept, not a product we're releasing in this form.** The near-term goal is to
**rush a qualitative demo** we can present to the team behind The Study Quran (HarperOne,
2015) to win their **buy-in to collaborate.** Qualitative impression over completeness — a
few verses done beautifully that make a scholar lean in, not broad coverage.

**Why:** the collaboration — and the licence to use their copyrighted commentary — is the
prize; the demo is the vehicle to get it. The Study Quran capture next door
(`../books/books/study-quran/`, source design `docs/design/knowledge-graph-commentary.md`)
is stamped licence "private" on every file: we can't ship their text, but we CAN show a
private pitch build to the people who own it.

**How to apply:** the pitch build is a **private track**, shown to the rights-holders in a
room, and may include their commentary + scripture beside it. The public site and its
no-held-text gates do NOT change — anything merged to the public site stays clean of Qur'an
text and held commentary. When a demo needs held text, it's the private build, never the
public one. Prioritise work that moves the pitch forward; if a task doesn't, it isn't urgent
now. Captured in CLAUDE.md "What we are building right now" and README (committed on branch
harakat-marking). Relates to [[designs-public-on-site]] (designs stay public; the pitch app
does not), [[hifth-app-identity]], and the held-copy discipline in [[qul-gap-record-dont-import]]
and [[qul-licensing]].
