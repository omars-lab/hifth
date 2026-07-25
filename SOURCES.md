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
  own terms; per the 2026-07-25 grounding pass, the
  [quran-svg repo](https://github.com/quranpedia/quran-svg) declares **CC0 1.0** for
  its own contributions (ayah-polygon overlay + JSON metadata) and documents KFQC's
  terms as free use incl. digital/web, with only *printing physical mushafs for
  commercial sale* reserved to the Complex. (Its Libyan-Endowments editions are
  non-commercial-only — not applicable to `hafs-kfqc`.)
  **Status: PROVISIONAL — one primary-source check of KFGQPC's published terms
  remains before Loop 7 (the repo's summary is secondhand).**
- **Immutability:** SVG bytes are copied verbatim and never edited (PLAN §8).

---

### mutashabihat-waqar144

- **Name:** Quran Mutashabihat Data — curated similar-ayah (mutashabihat) edges for
  huffaz, by Waqar Ahmed; based on the work of Qari Idrees Al-Asim (رحمه الله) and
  the author's own hifz experience.
- **Provenance:** https://github.com/Waqar144/Quran_Mutashabihat_Data, vendored at
  commit `f35f6d5d6e7d07f44e6a652d868b298fcd12e318` (2026-03-09), retrieved
  2026-07-25 → `packages/etl/data/mutashabihat/mutashabiha_data.json`
  (SHA-256 `785d5efa…780f0`; full details in the adjacent `PROVENANCE.md`).
- **Shape:** juz-keyed JSON; `src.ayah` / `muts[].ayah` are absolute ayah numbers
  (1–6236), numbers or arrays (ranges); `ctx: 2` flags show-continuation entries.
  1,344 entries · 2,448 directed edges at pin.
- **License (README, verbatim; no LICENSE file):** "The data in this project is
  free to use as you see fit. However, I would appreciate if you mention the use
  of this project in your app or any other kind of work if you decide to use this
  data." → attribution planned in the app's about/credits surface.
- **Status: VENDORED (Loop 4a) — primary mutashabihat edge source.**

---

### quranic-arabic-corpus

- **Name:** Quranic Arabic Corpus — morphology, version 0.4 (2011), by Kais Dukes,
  Language Research Group, University of Leeds. Root + lemma annotation for the
  root lens (⬡, Loop 5).
- **Provenance:** the official distribution (https://corpus.quran.com/download/)
  is behind an e-mail form, so the bytes are pinned from a mirror:
  https://github.com/alstat/QuranTree.jl at commit
  `d7a0fe9c5c7138081aec6683d18e49f9a233d0dd`, path
  `data/quranic-corpus-morphology-0.4.txt`, retrieved 2026-07-25 →
  `packages/etl/data/roots/quranic-corpus-morphology-0.4.txt`
  (SHA-256 `a1d12923…5d8c46`; full details in the adjacent `PROVENANCE.md`).
  Byte-identity confirmed against a second mirror (`cltk/arabic_morphology_quranic-corpus@b5abd4d`)
  and the official zip; QuranTree.jl's MIT license covers its Julia package, not
  this data.
- **Shape:** TSV, one line per morphological segment —
  `(surah:ayah:word:segment)`, form, tag, features (`ROOT:` / `LEM:` in the
  corpus's Buckwalter transliteration). 128,219 segments · 6,236/6,236 ayahs ·
  1,642 roots · 4,644 lemmas · 44,431 root↔ayah pairs at pin.
- **License (the file's own header, also published verbatim on the download
  page):** "Copyright (C) 2011 Kais Dukes. License: GNU General Public License…
  Permission is granted to copy and distribute verbatim copies of this file, but
  CHANGING IT IS NOT ALLOWED. This annotation can be used in any website or
  application, provided its source (the Quranic Arabic Corpus) is clearly
  indicated, and a link is made to http://corpus.quran.com to enable users to
  keep track of changes." The site footer reads "available under the GNU public
  license with terms of use"; https://corpus.quran.com/license.jsp is unmodified
  GPL v3. **The two are in tension** (GPL §5 permits modification, the terms of
  use forbid it) — Hifth satisfies both readings by vendoring the file verbatim
  with its copyright block intact and deriving the shards at build time.
  **Attribution is mandatory:** the app credits "Quranic Arabic Corpus" and links
  to http://corpus.quran.com on the root-lens surface.
- **Second notice inside the same file:** Tanzil Quran Text (Uthmani 1.0.2),
  © 2008-2009 Tanzil.info, **CC BY-ND 3.0 Unported**, attribution + link to
  http://tanzil.info. Our shards carry no Quran text from this file — only roots,
  lemmas, ayah numbers and page numbers — so the ND term binds the vendored copy,
  not the ETL output.
- **Immutability:** bytes are vendored verbatim and never edited (PLAN §8 and the
  terms above).
- **Status: VENDORED (Loop 5) — root/lemma source for the root lens.**

---

### quran-tajweed-cpfair

- **Name:** quran-tajweed — tajweed rule annotations for the Qur'an (riwāyat Hafs)
  by Collin Fair, built from ReciteQuran.com, the Dar al-Maarifah tajweed
  masāhif "and others". The rule-span source for the tajweed skin (Loop 6a).
  Repository is dormant and says so on its first README line.
- **Provenance:** https://github.com/cpfair/quran-tajweed at commit
  `496f71cd191da00fa2a37ded79dbbddb033bb0ad` (2021-10-12), path
  `output/tajweed.hafs.uthmani-pause-sajdah.json`, retrieved 2026-07-25 →
  `packages/etl/data/tajweed/tajweed.hafs.uthmani-pause-sajdah.json`
  (SHA-256 `151d616a…5ebf67`, 5,578,730 bytes; full details in the adjacent
  `PROVENANCE.md`). Byte-identity confirmed through a second transport, the
  codeload tarball of the same pin.
- **Shape:** JSON array, one record per ayah —
  `{surah, ayah, annotations: [{rule, start, end}]}`, where `start`/`end` are
  **codepoint offsets inside that ayah's own text** (Tanzil Uthmani, the frozen
  2017 snapshot the README pins). 6,236/6,236 ayahs · 60,057 annotations ·
  18 rule ids at pin, mapped to Hifth's 7 rule families by `build-tajweed.mjs`.
- **License (README, verbatim; no LICENSE file):** "This data file is licensed
  under a Creative Commons Attribution 4.0 International License, while the
  original Tanzil.net text file linked above is made available under the
  Tanzil.net terms of use." CC BY 4.0 permits the shards; **attribution is
  mandatory** and ships three ways — `assets/skins/<edition>/NOTICE.txt` beside
  the data, `SOURCES.md`, and a visible credit + link in the app's tajweed
  legend. Note the grant is scoped to *"this data file"*: the classifier and
  rule trees in the same repo carry no licence, so **rebuilding** the
  annotations is not covered and would need its own clearance.
- **Second notice — the base text the offsets address:** Tanzil.net terms of use
  ("Permission is granted to copy and distribute verbatim copies of the Quran
  text provided here, but changing the text is not allowed… provided that its
  source (Tanzil Project) is clearly indicated, and a link is made to
  tanzil.net"). Hifth vendors and ships **no Tanzil bytes** — the shards are
  numbers, and the text on screen is KFGQPC page artwork — so the term binds
  nothing we distribute; the source is named because the offsets are meaningless
  without it.
- **Known limits (recorded, and why the skin ships beta):** the ruleset omits
  `izhar`, `izhar_shafawi`, `tafkheem`, `tarqeeq` and `madd_al_tamkeen`, so "no
  annotation" means "no rule this source covers"; and the spans index Tanzil's
  tokenisation while the pages are KFGQPC artwork with no letter geometry, so
  the skin marks whole ayahs until Loop 4b's ligature corpus lands.
- **Immutability:** bytes are vendored verbatim and never edited (PLAN §8).
- **Status: VENDORED (Loop 6a) — rule-span source for the tajweed skin.**

---

## Pending sources (not yet vendored — recorded so the gate is ready)

These are named in the plan for later loops. They are listed here so their license
review is tracked from the start; no bytes are vendored until the noted loop.

- **QUL (qul.tarteel.ai) layout DB + phrase ranges** — ayah→page table for edge dir
  bucketing (Loop 4a) + anchor cross-check (Loop 4b). Madani layouts: V1/1405H
  (id 15), V2/1421H (id 10), V4/1441H (id 19) — pin the print matching quran-svg
  in Loop 4a. License: per-resource on QUL; review each before use.
- **QurSim** — *demoted 2026-07-25*: semantic relatedness (Ibn Kathir-derived,
  graded pairs), not lafẓi mutashabihat, and no canonical download endpoint.
  Someday-scoped as a reserved `related` edge type; not a Loop 4 source.
- ~~**Quranic Arabic Corpus / QUL morphology** — root/lemma data for the root lens
  (Loop 5). License: review pending (QAC is CC-BY-SA — attribution required).~~
  *Resolved 2026-07-25: vendored as `quranic-arabic-corpus` above. The CC-BY-SA
  note was wrong — QAC is GPL + its own terms of use. QUL morphology was rejected
  (no license stated on the resource pages, downloads login-gated).*
- ~~**quran.com tajweed rule spans** — tajweed skin ETL (Loop 6). License: review pending.~~
  *Resolved 2026-07-25: **rejected**, and vendored `quran-tajweed-cpfair` above
  instead. quran.com states no licence for `text_uthmani_tajweed`, and it is not
  an independent source anyway — enumerated over all 114 surahs its rule counts
  match cpfair's file exactly, including the two rarest (`idgham_mutajanisayn`
  58 = 58 and `idgham_mutaqaribayn` 13 = 13, the same 13 ayahs) and the same
  `izhar` gap. Going through it would shed the CC BY notice, not gain a licence.
  QUL's tajweed resources (#58/#87) were rejected on the Loop 5 grounds: no
  licence text anywhere on the resource or credits pages, downloads login-gated.*
