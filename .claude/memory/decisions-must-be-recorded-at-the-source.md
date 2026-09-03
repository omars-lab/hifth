---
name: decisions-must-be-recorded-at-the-source
description: "A verbal decision that never reaches docs/decisions.json does not stick — the owner re-answered mark-placement (H) many times because the row stayed \"open\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-03T19:46:21.574Z
---

The owner picked option **H** for the `mark-placement` decision ("put each mark where its
own ink is, and line the rest up") **many times across sessions** and each time it came back
as if undecided. On 2026-09-03 he asked, pointedly, "why isn't this sticking?"

The cause: `docs/decisions.json` — the one file a new session reads to know what is settled —
had said `"status": "open"` for that row since the day it was created (commit 243b37e) and had
**never once been written otherwise**. Every choice lived only in a conversation. So each
session opened the register, saw an open question with F drawn as the recommendation, and
asked again. Recorded at last in commit 0881048 (decided: H, by: omar, 2026-09-03).

**Why:** the register is the source of truth; a decision spoken in chat is invisible to the
next session. This is the exact failure the global rule names — *write the decision and its
reason where the work is tracked, so the next session inherits the choice instead of
re-litigating it.*

**How to apply:** the moment the owner picks an option, write it to `docs/decisions.json`
(`decided`, `status: decided`, `by`, `date`) **in the same turn**, before doing anything else
with it — then `make decisions-doc` + `pnpm gate:decisions`. Never treat a spoken choice as
recorded. If a decision seems to keep re-surfacing, check the register row's history first
(`git log -S` on its id) — an unrecorded decision is the likely reason, not indecision. See
[[designs-public-on-site]] for the register discipline this sits inside.
