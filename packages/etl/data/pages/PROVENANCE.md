# ayah-pages.json — provenance

**What:** the ayah→page table for the `hafs-kfqc` edition — a JSON array of 6236
page numbers, index = absolute ayah number − 1 (Hafs/Kufan counting, see
`@hifth/core` `quran-meta.ts`). Loop 4a uses it for edge dir bucketing
(dPage/sameJuz for un-vendored targets); Loop 4b re-derives it during anchor
extraction and must reproduce it byte-identically.

- **Derived from:** the corpus's own per-page metadata —
  `mushafs/hafs/kfqc/json/<001..604>.json` of
  https://github.com/quranpedia/quran-svg at commit
  `5fbcb1d4d92b5a2972ab51472fe991b6066bb6e2` (2026-07-13), retrieved 2026-07-25.
  Each page file lists its ayah polygons (`surahNumber`, `ayahNumber`); the table
  records each ayah's (single) page.
- **SHA-256:** `50afcbaf4600341f1b9ce402af5bbe3c87efb62026d060548182733b3d913fd5`
- **Validation at build:** 6236/6236 ayahs covered exactly once (no ayah appears
  on two pages in this corpus); page sequence monotonic 1→604; matches the three
  Loop-0-vendored pages verbatim (p7 = 2:38–48, p9 = 2:58–61, p19 = 2:120–126).
- **Print identification (the Loop 4a pin):** the corpus follows the
  **KFGQPC QCF V2 / 1421H print** pagination, NOT V1/1405H ("Madani standard",
  what Tanzil metadata and quran.com default to). Evidence: V1 and V2 QUL layout
  DBs diverge on 36 pages (120–123, 144–145, 531–534, 564–600 region); at the
  first divergence quran-svg puts 5:77 on p120 and V2's p120 word range exceeds
  V1's by exactly 24 words = 5:77's 23 words + ayah marker; the p121 boundary
  likewise differs by exactly 5:83's 22 words. Both boundaries match V2.
  **Consequence:** any cross-check source must be the V2 layout
  ([QUL mushaf layout id 10, "QCF V2 layout/1421H print"](https://qul.tarteel.ai/resources/mushaf-layout/10));
  V1-based tables (Tanzil metadata et al.) disagree on 36 pages and must not be
  used for this edition.
- **Immutability:** regenerate only by re-running the derivation against a newer
  quran-svg pin; never hand-edit.
