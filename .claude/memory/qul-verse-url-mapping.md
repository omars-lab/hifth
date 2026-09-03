---
name: qul-verse-url-mapping
description: QUL per-verse page URL is /cms/verses/N where N is the global 1-based ayah ordinal across all 6236 ayat
metadata: 
  node_type: memory
  type: reference
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-03T19:20:12.887Z
---

QUL (qul.tarteel.ai) has a per-verse CMS page at `https://qul.tarteel.ai/cms/verses/<N>`,
where **N is the global 1-based ayah ordinal** — the running count of ayat from the very start
of the mushaf, not a within-surah number.

- 1:1 (Al-Fatiha, ayah 1) → `/cms/verses/1`
- 2:1 (Al-Baqara, ayah 1) → `/cms/verses/8` (Al-Fatiha has 7 ayat, so 2:1 is the 8th ayah overall)

So `N = (sum of ayah counts of all surahs before this one) + ayah`. The repo already holds the
per-surah ayah counts as hand-typed structural constants checked by `gate:quran-meta` against
Tanzil metadata, so the mapping is derivable with no new data — a cumulative-sum table over
those counts, 1..6236.

Same host as the look-alike "ruler" (resource 73) and the `mushaf_page_preview` — see
[[artifacts-english-by-default]] context and `docs/validation/how-we-earned-your-trust.md`: QUL
is login-gated with an unstated licence and the app ships **zero bytes** from it. So this URL is
usable as an outbound *link* a reader can follow (no bytes copied), but pulling its content into
the app is a licensing question, not a free action. Tracked as a task (verse→QUL deep-link) and
alongside the page-preview-as-witness and per-verse-audio tasks.
