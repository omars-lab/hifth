---
name: segmentation-witness-technique
description: How to corroborate a split/join disagreement with a third corpus — the tag-independent split signature and the independence proof
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-05T20:15:53.234Z
---

Answering what-we-depend-on ⑩ (does the 9,533 print-splits-particle / grammar-joins-particle
disagreement have a disinterested third witness) taught two moves that generalise to any
witness-validation task ([[qul-gap-record-dont-import]], task #59's skill, remaining #66):

**1 · Reduce a split/join question to ONE tag-independent signature, don't align skeletons.**
The naïve approach — align the witness's per-ayah words to the incumbent's and compare
positionally — breaks on orthography: MASAQ spells الصلاة (imla'i) where QAC keeps الصلوة
(Uthmani), so strict-equality alignment (`alignBlocks`) returns null even when word boundaries
are identical. Don't fight that. A *split* of a proclitic has exactly one signature in any
word-segmented grammar: **a token that is the bare particle with no stem under it.** Count
those across the whole corpus. MASAQ had 0 in 77,411 words ⟹ it joins at all 9,533 positions,
with zero dependence on spelling normalisation or a whitelist of proclitic tags. Cross-check
with per-ayah word-count deltas (a split would make the witness's count exceed the incumbent's)
— they agreed.

**Why:** the airtight measurement was tag-independent; my first attempt (whitelist of CONJ/PREP/
DET leading-prefix tags) mis-flagged 24 positions as anomalies purely from positional drift and
tags like OTHER/IMPERF_PREF. The stemless-token count sidesteps all of it.

**2 · Prove the witness is INDEPENDENT — ⑩ warns a scraped witness is not a witness.** Measure
divergence, don't assume it. MASAQ tokenises to 77,411 words vs QAC's 77,429, and spells 8.6% of
aligned words differently across 3,695/6,236 ayahs. A copy would be identical in both; the
divergence IS the independence proof. Record the number.

**3 · Frame the result as convention-vs-convention, not correctness.** Two independent grammars
fold the particle; only the press separates it. So adopting the print's word count for the
neighbour rail (⑦) is a *licence choice made knowing the print is the measured outlier*, never
"the print is right and the corpus is wrong". This is the same trap [[qul-gap-record-dont-import]]
names: a disagreement between two conventions is not an error to correct.

Pattern for the durable artifact (matches probe-hop-recall precedent): probe reads the gitignored
`.cache/`, ships nothing, writes `docs/design/<name>.data.json` (counts + verse keys, zero
Arabic — verify with a codepoint grep). Register the source in SOURCES.md as an *instrument*
(read to check, shipped nowhere). New opt-in probes show "_not in the code map_" in the ETL
census and that's fine (so does probe-hop-recall) — but `make etl-scripts-doc` must re-run or
gate:etl-scripts fails on the disk-hash. Also re-run `make tasks-doc` after touching issues.json,
or the pre-commit stale-page hook blocks the commit.
