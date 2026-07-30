# quran-data.xml — provenance

- **Source:** https://tanzil.net/res/text/metadata/quran-data.xml (Tanzil Project —
  the "Tanzil metadata" that `JUZ_STARTS` in `packages/core/src/quran-meta.ts` has
  named in a comment since Loop 4a without anything being able to check it).
- **Retrieved:** 2026-07-30. The file itself carries no version other than
  `version="1.0"`; the server's `Last-Modified` is `2010-06-05`, so the bytes have
  been stable for sixteen years and a hash pin is a fair substitute for a commit
  pin.
- **SHA-256:** `8867c1d88191472adec9db694b3cd9f135b1a2ef580574d32cf888dcb22c5c7a`
- **License (root element, verbatim):**
  `copyright="(C) 2008-2009 Tanzil.info" license="cc-by"` — CC BY, attribution
  required. Credited in the app's colophon; see the `tanzil-quran-metadata` entry
  in `SOURCES.md`.
- **Shape:** one `<quran type="metadata">` root holding flat elements carrying
  `sura`/`aya` attributes: 114 `<sura>` (name, ayah count, cumulative start),
  30 `<juz>`, 7 `<manzil>`, 556 `<ruku>`, 604 `<page>` (Madani print),
  15 `<sajda>` — and **240 `<quarter>`**.
- **There is no `<hizb>` element**, which is the one thing to know before reading
  the derivation. The division is published at its finest grain, the quarter
  (أرباع الأحزاب), and a hizb is four of them: hizb *h* starts at quarter
  `4h − 3`. Every fourth quarter, not half a juz.
- **Why it is vendored rather than fetched:** `scripts/gate-quran-meta.mjs`
  re-derives `JUZ_STARTS` and `HIZB_STARTS` from these bytes on every CI run and
  diffs them against what `@hifth/core` exports. A gate that reaches the network
  fails when a host is down, which teaches everyone to skip it — and it would
  silently start checking different numbers if the upstream file ever changed.
- **What is NOT taken from this file:** the surah name strings, the ayah counts
  (`AYAH_COUNTS` predates it and is checked against it by the gate rather than
  copied from it), and the `<page>` table — page geometry comes from the vendored
  KFGQPC SVGs, and a second, differently-printed page table would be a source of
  disagreement, not of truth.
- **Corroboration:** the 60 derived hizb starts were compared against
  `https://api.alquran.cloud/v1/meta` (an independent implementation, retrieved
  2026-07-30) and agree on all 60 pairs. Corroboration, not independence — that
  API's structural tables are themselves Tanzil-derived — but a transcription
  error on either side would have shown.
- **Immutability:** bytes are vendored verbatim and never edited; refresh =
  re-fetch, re-hash, and update this file.
