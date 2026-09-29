---
name: qul-gap-record-dont-import
description: "When a ruler (QUL etc.) surfaces pairs/data the app lacks, first check whether OUR own vendored build-time data can derive it — a gap the ruler shows is often NOT one we must import; if it is, record it as a drawn, eye-checked decision framed as reopening the copy-nothing boundary"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d06a126-c11f-4081-bd4d-6a82cacfbae2
  modified: 2026-09-04T03:28:00.896Z
---

When measuring our numbers against an outside ruler surfaces something we *lack* (e.g. the
635 verbatim whole-ayah twins QUL's corpus 74 had that our mutashabihat set did not), the
first question is **"can we derive this from our OWN already-vendored data at build time?"** —
because a gap the ruler *shows* is often not a gap we must *import*.

**This was resolved on 2026-09-03 (decision `similar-ayah-enrichment`, decided option D).**
The earlier framing here — "record + open decision, framed as reopening the boundary" — was
the fallback, not the answer. The false assumption that made it look like the only path was
"the app ships no Qur'an text, so it has nothing to compare word against word." True of
*shipped* bytes; **false of build-time ones.** The QAC morphology corpus
(`packages/etl/data/roots/`, GPL, provenance recorded) is vendored and read by the ETL
already; `wordsByAyah()` in `morphology.mjs` reduces every verse to the rasm skeleton the edge
builder compares on. Grouping all verses by that skeleton found every whole-verse twin in-house
(`build-verbatim-twins.mjs`, floor 4 words → 636 pairs vs the ruler's 635), shipping only verse
numbers. The ruler's verbatim gap fell 635→3, and the 3 residuals are provably near-pairs
(differ by ≥1 word), which our exact-sequence detector correctly excludes. **The copy-nothing
boundary was never reopened**, and D cost less than importing would have.

So, in order:

1. **Try to derive it from our own vendored corpus at build time.** If it works (it did here),
   nothing is taken from the ruler, the ruler is left validating (probe folds our shipped set
   in and confirms), and [[qul-licensing]]'s copy-nothing boundary (`qul-reliance`, decided A)
   stays untouched. This is strictly better than importing — prefer it.
2. **Only if it genuinely cannot be derived**, record it as an OPEN decision framed honestly as
   *"are these worth reopening the boundary for"* — never *"add these"* — related
   bidirectionally to `qul-reliance` (the gate fails on a one-way link). Do not import even bare
   numbers without that decision.
3. **Draw it, do not just count it**, either way. The owner said "i want to visually see
   differences": the decision page crops the actual pairs from our own mus'haf artwork at real
   size, fading neighbours. And **eye-check every drawn pair against the print** — a ruler's
   100% score is a machine's claim (it caught 61:9/9:33, which read as differing by their last
   word only because their *neighbours* share it). See the CLAUDE.md "verify with your own eyes"
   tenet.

**Why:** the app's whole reason-for-being is a plain-language, public decision trail
([[designs-public-on-site]]); and the copy-nothing boundary is load-bearing. Deriving in-house
honours both at once — no import, and the reasoning still drawn and public.

**How to apply:** machinery is built — `build-verbatim-twins.mjs` (in-house derivation),
`build-similar-ayah-gap.mjs` (draws the page), `make probe-qul` (measures the gap, now folds
twins in), the `leverage-qul` skill (guardrails), `docs/decisions/similar-ayah-enrichment.md`
(worked example, decided D), and the pivot write-up
`docs/issues/verbatim-twins-found-in-house.md`. Reuse this shape — derive first, import last.
