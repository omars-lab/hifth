# Data sources & licensing

Every data source bundled or processed by Hifth is recorded here. CI fails the
build if an asset edition or data drop has no entry (`scripts/gate-license.mjs`).
The registry key in the manifest (`edition`) must match a `### <edition-id>`
heading below.

The design conversation's terms vary per resource (QUL resources each carry their
own license); each is recorded individually rather than assumed.

---

### hafs-kfqc

- **Name:** Hafs ʿan ʿĀṣim — King Fahd Glorious Quran Complex (KFGQPC) Madani mushaf,
  page-outlined SVG.
- **Provenance:** SVG page geometry sourced via the quranpedia / quran-svg corpus
  (`xmlns:ayah="https://quranpedia.net"`), derived from the KFGQPC digital mushaf.
  The three pages bundled in Loop 0 (7, 9, 19) were extracted verbatim from the
  design mock `docs/reference/linker-mock.html`.
- **Encoding:** outlined `<path>` glyphs (no `<text>`), per-ayah hit polygons
  `class="ayahPolygon"` carrying `number="SSSAAA"` and `surah`.
- **Coverage bundled now:** Surah 2, ayahs 38–48 (p7), 58–61 (p9), 120–126 (p19).
  **Full 604-page coverage is NOT yet vendored** — Loop 4 vendors and validates the
  complete corpus. See the Loop 0 corpus audit in `docs/decisions/loop-0.md`.
- **License / usage:** KFGQPC mushaf artwork is distributed by the Complex under its
  own terms; the quran-svg redistribution terms must be confirmed before public
  beta. **Status: PROVISIONAL — confirm before Loop 7 (public beta).**
- **Immutability:** SVG bytes are copied verbatim and never edited (PLAN §8).

---

## Pending sources (not yet vendored — recorded so the gate is ready)

These are named in the plan for later loops. They are listed here so their license
review is tracked from the start; no bytes are vendored until the noted loop.

- **Waqar144 mutashabihat dataset** — mutashabihat edges (Loop 4). License: review pending.
- **QUL (qul.tarteel.ai) layout DB + phrase ranges** — anchor cross-check + phrase
  edges (Loop 4). License: per-resource on QUL; review each before use.
- **QurSim** — secondary similarity edges (Loop 4). License: review pending.
- **Quranic Arabic Corpus / QUL morphology** — root/lemma data for the root lens
  (Loop 5). License: review pending (QAC is CC-BY-SA — attribution required).
- **quran.com tajweed rule spans** — tajweed skin ETL (Loop 6). License: review pending.
