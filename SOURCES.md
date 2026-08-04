# Data sources & licensing

Every data source bundled or processed by Hifth is recorded here. CI fails the
build if an asset edition or data drop has no entry (`scripts/gate-license.mjs`).
The registry key in the manifest (`edition`) must match a `### <edition-id>`
heading below.

The design conversation's terms vary per resource (QUL resources each carry their
own license); each is recorded individually rather than assumed.

Each entry also carries a ` ```colophon ` fence: the exact row the app shows the
reader for that source. It is written here rather than in the component because
this is the file a licence question gets answered from, and the two once
disagreed — the colophon called the KFGQPC page artwork non-commercial, which is
a different edition's term, and nothing failed because only this file was ever
read by a machine. `scripts/gate-license-copy.mjs` now asserts that
`apps/web/src/components/Colophon.tsx` renders exactly these rows and no others,
so the screen is a view of the record. A source the app deliberately does not
credit says `not-credited: <reason>` in the same fence; saying nothing is not an
option, because it reads identically to having forgotten.

---

### hafs-kfqc

- **Name:** Hafs ʿan ʿĀṣim — King Fahd Glorious Quran Complex (KFGQPC) Madani mushaf,
  page-outlined SVG.
- **Provenance:** SVG page geometry sourced via the quranpedia / quran-svg corpus
  (`xmlns:ayah="https://quranpedia.net"`), derived from the KFGQPC digital mushaf.
  The three pages bundled in Loop 0 (7, 9, 19) were extracted verbatim from the
  design mock `docs/reference/linker-mock.html`. **Loop 4b replaced that route
  with the upstream repo itself**, pinned at commit
  `5fbcb1d4d92b5a2972ab51472fe991b6066bb6e2` (2026-07-13), path
  `mushafs/hafs/kfqc/{svg,json}/001..604`, retrieved 2026-07-25 —
  `packages/etl/data/pages/quran-svg.pin.json`, with a SHA-256 for every upstream
  file and every vendored byte. The pipeline's own self-test is that it
  re-derives Loop 0's three pages **byte-for-byte** from the pin before it is
  trusted with the other 601, so the mock and the repo are proven to be the same
  bytes rather than assumed to be.
- **Encoding:** outlined `<path>` glyphs (no `<text>`), per-ayah hit polygons
  `class="ayahPolygon"` carrying `number="SSSAAA"` and `surah`.
- **Coverage bundled now: all 604 pages** — the whole print, every ayah of the
  6236 on exactly one page, vendored in Loop 4b. (Loops 0–4a shipped three pages:
  Surah 2, ayahs 38–48 (p7), 58–61 (p9), 120–126 (p19); the Loop 0 corpus audit in
  `docs/decisions/loop-0.md` is that era's record.)
- **License / usage:** two licences, layered.
  1. **The overlay is CC0 1.0.** Read firsthand from the
     [quran-svg](https://github.com/quranpedia/quran-svg) README (2026-07-26): the
     ayah-polygon overlay, the per-page JSON (`mushafs/**/json/`, `surah.json`,
     `markers.json`) and the repo tooling are public domain — "reuse freely,
     including commercially, no attribution required". That is the half of these
     assets Hifth's resolver actually depends on, and it carries no obligation.
  2. **The artwork is the Complex's, under the Complex's terms.** Per that repo's
     [`NOTICE.md`](https://github.com/quranpedia/quran-svg/blob/main/NOTICE.md),
     which records publishers' terms verbatim: the digital Madinah mushaf "can be
     used for free" for personal, commercial and governmental purposes including
     "digital publishing, media use, and use in websites, software, and other
     similar intermediates", with physical printing for commercial sale reserved
     to the Complex under Royal Decrees 136/8 and 9/B/46356. **Note the shape of
     the restriction: it is on commercial *printing*, not on commercial or digital
     use.** Hifth prints nothing. (Non-commercial-only is the *Libyan Endowments*
     Qālūn edition's term — a different edition, not vendored here. Do not carry it
     over to `hafs-kfqc`; an earlier reading of this entry did, and the app's
     colophon told readers the artwork was more restricted than it is.)
- **Colophon row.** What the app tells the reader about this source, verbatim.
  `gate:license-copy` asserts `Colophon.tsx` shows exactly this, so the two can no
  longer disagree — that drift is what shipped the «غير التجاري» defect above.

```colophon
what: صفحات المصحف
who: طباعة مجمع الملك فهد (KFGQPC)، عبر quran-svg / quranpedia
licence: إتاحة حرّة للاستعمال الرقمي · الطبع التجاري محفوظ للمجمع
href: https://github.com/quranpedia/quran-svg
```

- **Status: CONFIRMED for the overlay (CC0, read at the source). The Complex's own
  terms remain read through quran-svg's NOTICE.md rather than off
  qurancomplex.gov.sa**, which refused connections on 2026-07-26 (`ECONNREFUSED`
  on both `/en/` and `/en/terms/`; the Wayback mirror is not fetchable from CI
  either). NOTICE.md quotes them and cites the decrees, so this is a strong
  secondary source, not a guess — but the one open item before Loop 7 is to open
  qurancomplex.gov.sa in an ordinary browser and confirm the wording is still what
  NOTICE.md records. Nothing in the build depends on the answer; the entry moves
  from PROVISIONAL to CONFIRMED-pending-that-glance.
- **Immutability:** SVG bytes are copied verbatim and never edited (PLAN §8). Loop
  4b applies exactly two declared transforms, both reproducible and both asserted:
  **svgo** at the version and config recorded in the pin (the config was recovered
  by search until it reproduced Loop 0's three pages byte-for-byte), and **two
  `id` repairs** — 19:3 on p305 and 75:5 on p577 carry path geometry where every
  other polygon carries `verse-<absolute ayah>`. The count is asserted to be
  exactly two and the ayahs exactly those two, so a future pin that fixes them
  upstream fails loudly instead of drifting silently. `pnpm gate:pages` re-checks
  the vendored hashes offline on every CI run.

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
- **Colophon row.** Verbatim; bound to `Colophon.tsx` by `gate:license-copy`.

```colophon
what: المتشابهات
who: Quran Mutashabihat Data · Waqar Ahmed
licence: استعمال حرّ مع ذكر المصدر
href: https://github.com/Waqar144/Quran_Mutashabihat_Data
```

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
- **Colophon row.** Verbatim; bound to `Colophon.tsx` by `gate:license-copy`. This
  one is a licence *condition* — the source must be "clearly indicated" with a link
  to corpus.quran.com — so the gate is the thing that keeps the condition met.

```colophon
what: الجذور والصرف
who: Quranic Arabic Corpus · Kais Dukes، جامعة ليدز
licence: GNU GPL
href: http://corpus.quran.com
```

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
- **Colophon row.** Verbatim; bound to `Colophon.tsx` by `gate:license-copy`. CC BY
  attribution travels with the work, so this row is a condition too, not a courtesy.

```colophon
what: أحكام التجويد
who: quran-tajweed · Collin Fair
licence: CC BY 4.0
href: https://github.com/cpfair/quran-tajweed
```

- **Status: VENDORED (Loop 6a) — rule-span source for the tajweed skin.**

---

### tanzil-quran-metadata

- **Name:** Tanzil Quran metadata — the structural divisions of the mus'haf
  (sura, juz, hizb quarter, manzil, ruku, page, sajda) as one XML file. The
  upstream for `AYAH_COUNTS`, `JUZ_STARTS` and `HIZB_STARTS` in
  `packages/core/src/quran-meta.ts`.
- **Provenance:** https://tanzil.net/res/text/metadata/quran-data.xml, retrieved
  2026-07-30 → `packages/etl/data/meta/quran-data.xml` (SHA-256
  `8867c1d8…c5c7a`, 77,234 bytes; server `Last-Modified` 2010-06-05). Full
  details in the adjacent `PROVENANCE.md`.
- **Shape:** one `<quran type="metadata">` root over flat elements carrying
  `sura`/`aya` attributes — 114 `<sura>`, 30 `<juz>`, 7 `<manzil>`,
  556 `<ruku>`, 604 `<page>`, 15 `<sajda>`, and **240 `<quarter>`**. There is no
  `<hizb>` element: the division is published at its finest grain, the quarter
  (أرباع الأحزاب), and a hizb is four of them — hizb *h* opens at quarter
  `4h − 3`. The tempting arithmetic (half a juz) agrees for only 4 of 30 and
  misses by up to 39 ayahs, which is why the table is vendored rather than
  computed.
- **License (root element, verbatim):** `copyright="(C) 2008-2009 Tanzil.info"
  license="cc-by"` — CC BY, so **attribution is mandatory**, and it ships in
  `SOURCES.md`, in `PROVENANCE.md` beside the bytes, and as a visible credit in
  the app's colophon.
- **What is taken, and what is not:** the numbers only — ayah counts and division
  start points. Not the surah name strings, and **not** the `<page>` table: page
  geometry comes from the vendored KFGQPC SVGs, and a second, differently-printed
  page table would be a source of disagreement rather than of truth.
- **Why the bytes are vendored and not fetched:** `scripts/gate-quran-meta.mjs`
  re-derives all three tables from this file on every CI run and diffs them
  against what `@hifth/core` exports, so a mistyped digit fails the build instead
  of quietly re-filing an ayah (the shape of #80). A gate that reaches the network
  fails when a host is down, which teaches everyone to skip it.
- **Immutability:** bytes are vendored verbatim and never edited (PLAN §8).
- **Colophon row.** Verbatim; bound to `Colophon.tsx` by `gate:license-copy`.

```colophon
what: أقسام المصحف
who: Tanzil Project
licence: CC BY
href: https://tanzil.net
```

- **Status: VENDORED (Loop 6b prep) — structural tables for juz/hizb.**

---

### word-geometry-mushafdatabase

- **Name:** MushafDatabase-Ligature-Based-SVG — a second SVG print of the same
  KFGQPC Madani mus'haf, set per *word* rather than per page: every word is a
  `<g>` carrying its surah, ayah and index. The source of the word boxes behind
  word-level selection (task #65).
- **Provenance:** https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG
  at commit `ae5786ab08597f8123575dec4e774f1eca195e0f` (2026-06-13), path
  `SVG V1.01`, read 2026-08-04. Per-page SHA-256s of exactly the bytes that were
  read are in [`packages/etl/data/pages/word-boxes.pin.json`](packages/etl/data/pages/word-boxes.pin.json),
  and the print identification is in
  [`ligature-svg.probe.json`](packages/etl/data/pages/ligature-svg.probe.json).
- **What is taken, and what is not — the whole point of this entry.** **No bytes
  of this corpus ship.** 378 MB was read to write 2.2 MB of geometry: per word, a
  rectangle on *our* page frame. Not the ink — our pages remain the quranpedia
  print, unchanged, and `gate:pages` still re-hashes all 604 against it. Not the
  text either, deliberately: see the `$segmentation` note in the pin for why this
  print's word index is not the Quranic Arabic Corpus's, and why joining the two
  needs an alignment rather than an assumption.
- **How geometry from one print lands on another:** both corpora draw the same
  page and both mark the end of every ayah with an ornament, so the ornaments are
  a correspondence neither was built to provide. `build-words.mjs` fits
  `ours = s·theirs + t` on them, per page, by least squares. Scale is 1.3333 in
  both axes everywhere and the offsets are the two constants already sitting in
  our own SVGs' transform matrices, one per page parity. Residual: median 0.089,
  max 2.722 viewBox units. `probe-word-registration.mjs` established this before
  a single box was vendored.
- **License (LICENSE, a Sadaqa-e-Jaria grant):** use, copy, modify, publish,
  distribute and derive, for any lawful purpose including commercial, without
  prior written approval; the Quranic content must not be altered in a way that
  misrepresents it; as-is, with no warranty. Nothing here obliges attribution —
  the colophon row below is a courtesy, and it is in the record so that a later
  reader does not mistake a courtesy for a condition and quietly drop it, or
  mistake it for a condition and refuse a change it does not forbid.
- **Second notice — the print behind the print:** the repository's README names
  the KFGQPC Madinah mus'haf, Hafs ʿan ʿĀṣim, from the printing-use collection at
  https://dm.qurancomplex.gov.sa/. It does not name the print *revision*, which
  is what `probe-ligature-print.mjs` had to establish: V2/1421H, the same print
  the pages are, confirmed on all four known V1/V2 divergence bands plus controls
  (PLAN follow-up 13).
- **Immutability:** nothing is vendored, so nothing can be edited. What is
  committed is derived, and `gate:words` re-measures every box against the
  polygon it claims on every CI run rather than trusting the hash alone.
- **Colophon row.** Verbatim; bound to `Colophon.tsx` by `gate:license-copy`.

```colophon
what: مواضع الكلمات
who: Mushaf Database · قاعدة بيانات المصحف
licence: صدقة جارية · إتاحة حرّة
href: https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG
```

- **Status: DERIVED (word-B) — word boxes on our frame; no upstream bytes ship.**

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
