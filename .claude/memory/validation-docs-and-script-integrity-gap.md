---
name: validation-docs-and-script-integrity-gap
description: "Where hifth's validation story lives, and its biggest open gap: everything pins the data, almost nothing pins the scoring/gate code"
metadata: 
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-21T15:28:30.941Z
---

Hifth's validation is documented in three complementary places, and they don't restate each
other (house tenet: registers/docs index, they don't duplicate):

- **`docs/validation/how-we-earned-your-trust.md`** (+ `.html`, reader-facing, no jargon) — the
  authoritative trust narrative: the witness method (build from print → find an independent
  witness who never saw ours → lock agreement as a gate, or examine every difference), a
  figure→register-of-record table, the divergence framing, and honest gaps. Covers the *corpus*
  checks (page table, hop-recall, tajweed, print-identity, structural constants, mark-census).
- **`docs/design/mark-registration.md`** — why the mark boxes are placed as they are (Option H:
  each mark on its own ink; §⑦ held-out halves, §⑫ two-instruments-agreeing).
- **`docs/design/robust-validation.md`** (added 2026-09-21, branch harakat-marking, commit
  3d92ad4) — the two things the trust page doesn't cover: (1) the by-eye placement check rebuilt
  to hunt disagreement on the ~1,007 least-sure marks (since 99.69% of boxes now sit on their
  ink, a random draw is a landslide); (2) **script integrity**.

**The biggest open validation gap (script integrity):** every safeguard pins the *data* — SHA-256
pins over the 604 printed pages, an FNV fingerprint over the measurements a score ran on, the
seed-rebuilt blind key. **Almost nothing pins the *code*.** A quietly modified scorer or gate
would pass every other check and report a different verdict from identical inputs, undetected.
Five proposed closers, each extending a pattern already in the repo: (a) fingerprint the scorer +
its libs into each ruling (extends the `gate:etl-scripts` script-hash and `builtBy`); (b) a
known-answer self-test baked into each scorer (extends `vendor-pages.mjs --verify-loop0`, which
re-derives 3 known pages unconditionally); (c) publish the seed + ruling for adversarial
re-scoring; (d) a genuinely separate second rasteriser (the ornament-witness probe is the pattern);
(e) a second human reader per sitting. None built yet — a live question the doc opens.

**Why/how to apply:** when asked to strengthen trust for the pitch or to close a validation gap,
start from these three docs and foreground the code-pinning gap — it's the one an outsider asks
about and the one currently unanswered. The by-eye check is the ledger entry
`placement-correction-by-eye` (pending, its runbook still builds the discredited per-page trials;
`tunes` now points at robust-validation.md for the rebuild). Related: [[hifth-app-identity]],
[[poc-for-study-quran-team]], [[segmentation-witness-technique]],
[[decisions-must-be-recorded-at-the-source]].
