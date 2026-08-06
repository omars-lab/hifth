# tajweed.hafs.uthmani-pause-sajdah.json — provenance

- **Source:** [cpfair/quran-tajweed](https://github.com/cpfair/quran-tajweed) —
  "Tajweed annotations for the Qur'an (riwayat hafs)" by Collin Fair, built
  (per its README) "using information from [ReciteQuran.com](http://recitequran.com),
  the [Dar al-Maarifah](http://tajweedquran.com) tajweed masaahif, and others."
  The repository is dormant and self-declares so: its first README line reads
  "### NOTE: This project is not actively maintained".
- **Commit pin:** `496f71cd191da00fa2a37ded79dbbddb033bb0ad` (branch `master`,
  2021-10-12 — the newest commit; the repo has had none since).
- **Retrieved:** 2026-07-25, via
  `https://raw.githubusercontent.com/cpfair/quran-tajweed/496f71cd191da00fa2a37ded79dbbddb033bb0ad/output/tajweed.hafs.uthmani-pause-sajdah.json`
- **SHA-256:** `151d616ad37a4cc21a80f20d5e1104c5b408375107ddd4d71247dea4c05ebf67`
  (5,578,730 bytes). Verified byte-identical through a second, independent
  transport — the codeload tarball of the same pin
  (`https://codeload.github.com/cpfair/quran-tajweed/tar.gz/496f71cd…`) — so the
  hash is not a property of one CDN path.
- **License (README, verbatim — the repo has NO `LICENSE` file; this sentence is
  the entire grant, and it is the primary source, written by the author in the
  repository that publishes the data):**
  > This data file is licensed under a [Creative Commons Attribution 4.0
  > International License](https://creativecommons.org/licenses/by/4.0/), while
  > the original Tanzil.net text file linked above is made available under the
  > [Tanzil.net terms of use](https://tanzil.net/download/).

  CC BY 4.0 permits redistribution and derivative works — which is what the
  shards are — on condition of attribution. Hifth's attribution channels: this
  file, `SOURCES.md`, `assets/skins/<edition>/NOTICE.txt` shipped beside the
  shards, and a visible credit + link in the app's tajweed legend.
- **Scope of that grant, read narrowly (recorded, not resolved):** it says "this
  **data file**". `tajweed_classifier.py` and `rule_trees/*.json` in the same
  repository carry no licence at all. So the vendored JSON is covered; a *rebuild*
  of the annotations from the classifier — the obvious future move if we ever
  re-key the spans to the KFGQPC text — is **not** covered by anything, and would
  need its own clearance. This is the same "README, verbatim; no LICENSE file"
  footing on which `mutashabihat-waqar144` was vendored in Loop 4a, with a
  stronger grant (a named standard licence rather than informal prose) and a
  narrower one (scoped to one file).
- **The base text it indexes into (second notice), verbatim from
  <https://tanzil.net/download/>:**
  > Permission is granted to copy and distribute verbatim copies of the Quran
  > text provided here, but changing the text is not allowed. The text can be
  > used in any website or application, provided that its source (Tanzil Project)
  > is clearly indicated, and a link is made to tanzil.net to enable users to
  > keep track of changes.

  Hifth vendors and ships **no Tanzil bytes**: the annotations are offsets, the
  Quran text on screen is the KFGQPC page artwork, and the shards carry numbers
  only. The Tanzil term therefore binds nothing we distribute — but the offsets
  are meaningless without knowing which text they address, so the source is named
  here, in `SOURCES.md` and in the shipped `NOTICE.txt`.
- **Shape:** a JSON array, one record per ayah:
  `{ "surah": 1, "ayah": 1, "annotations": [ { "rule": "madd_6", "start": 245, "end": 247 }, … ] }`.
  `start`/`end` are **Unicode codepoint offsets within that ayah's own text**
  (max observed 1,171, in 2:282 — the longest ayah), not global file offsets and
  not word indices. The text they address is the frozen 2017 Tanzil Uthmani
  snapshot the README pins as a GitHub issue attachment
  (`https://github.com/cpfair/quran-tajweed/files/7281388/quran-uthmani.txt`);
  that file is **not vendored** — nothing in this pipeline reads it.
- **Measured at pin** (by parsing the vendored bytes, not by trusting the README):
  **6,236/6,236 ayahs** · all 114 surahs · **60,057 annotations** · **18 rule
  ids** · 0 duplicate `(rule, start, end)` within an ayah · annotations already
  ascending by `start` · 63 ayahs with no annotation at all.
- **The 18 source rules → Hifth's 7 families** (`build-tajweed.mjs` owns the
  table; it throws on any id not in it, so a source refresh that adds a rule
  fails the build instead of silently dropping it):

  | family | source rules | occurrences | ayahs | % of ayahs |
  |---|---|---:|---:|---:|
  | `madd` | `madd_2`, `madd_246`, `madd_muttasil`, `madd_munfasil` | 18,740 | 5,709 | 91.5% |
  | `wasl` | `hamzat_wasl` | 13,252 | 4,749 | 76.2% |
  | `ghunnah` | `ghunnah`, `ikhfa`, `ikhfa_shafawi`, `iqlab` | 11,305 | 4,548 | 72.9% |
  | `idgham` | `idghaam_ghunnah`, `idghaam_no_ghunnah`, `idghaam_shafawi`, `idghaam_mutajanisayn`, `idghaam_mutaqaribayn`, `lam_shamsiyyah` | 8,604 | 4,021 | 64.5% |
  | `qalqalah` | `qalqalah` | 3,834 | 2,641 | 42.4% |
  | `silent` | `silent` | 4,174 | 2,307 | 37.0% |
  | `madd-lazim` | `madd_6` | 148 | 128 | 2.1% |

  That last column is not decoration: it is what `TajweedRule.salience` in
  `packages/core/src/skins.ts` is ranked by, and the reason an ayah is marked
  with its *rarest* rule rather than its first. `lam_shamsiyyah` sits under
  `idgham` because إدغام الشمسية is an idgham; `iqlab` and both `ikhfa` sit under
  `ghunnah` because all three are realised as a nasalisation.
- **Two parsing facts worth knowing** (both handled in `build-tajweed.mjs`):
  1. **The README's rule names are wrong in two places.** It lists
     `idghaam_mutajaanisain` and `idghaam_mutaqaaribain`; the data emits
     `idghaam_mutajanisayn` (58×) and `idghaam_mutaqaribayn` (13×). The ETL codes
     against the data and the strict-id gate is what would catch a drift.
  2. **The ruleset is incomplete by construction.** It has no `izhar`,
     `izhar_shafawi`, `tafkheem`, `tarqeeq` or `madd_al_tamkeen`. An ayah with no
     annotation therefore means "no rule *this source covers*", never "recite it
     flat" — one reason the skin ships labelled **beta** until a hafiz signs off
     (PLAN §6).
- **What is NOT resolved, and why the skin is ayah-granular:** the spans address
  Tanzil's tokenisation, while Hifth renders KFGQPC page artwork whose glyphs are
  anonymous outlined `<path>`s with no letter, ligature or word ids. There is
  nothing on the page for a character span to attach to. 16.7% of spans (10,028)
  even cross a word boundary, so the eventual binding is word-*ranges*, not word
  indices. Until Loop 4b's ligature corpus lands, the shards keep the spans
  verbatim and the app paints one mark per ayah. See the header of
  `packages/core/src/skins.ts`.
- **Measured 2026-08-06 — the binding above is now priced, and it is a build
  change** (`tajweed-words.probe.json`, `pnpm probe:tajweed-words`). The
  paragraph above was written when there was nothing on the page to attach to;
  `assets/words/**` now holds 91,451 word boxes, so the question became whether
  a codepoint span lands inside one of them. It cannot be asked directly — that
  needs the Tanzil text, which this repo does not hold — so the probe
  *reconstructs* the text from the print's own per-word `data-hafs`, under three
  corrections each earned by a run that failed without it: the source prefixes
  the **basmala** to ayah 1 of every surah but 1 and 9; the print **splits the
  conjunction waw** Tanzil joins and flags the split itself
  (`data-waw-alatf="true"`); and the print **numbers pause marks as words** while
  this text carries none of them, so they are dropped (63.40% → 97.03%). The fold
  is checked against an oracle rather than its own output — `hamzat_wasl` must
  start on ٱ and `lam_shamsiyyah` on ل, 15,985 annotations that need no word
  boundary to verify.

  | measure | result |
  |---|---|
  | oracle on the expected letter | 15,510 / 15,985 = **97.03%** |
  | annotations inside one print word | 50,233 / 60,057 = **83.64%** |
  | two adjacent print words | 9,818 = **16.35%** |
  | wider than two | **4** (2:228, 12:41, 12:101, 28:83 — all `idghaam_ghunnah`) |
  | residual | **172 ayahs**, 475 misses, all within ±3 codepoints |

  The 16.35% is the cross-word phonology — idghaam, ikhfa, iqlab — painting
  correctly across two boxes, not a misalignment; it is also *not* the same
  number as the 16.7% above, which is against Tanzil's own tokenisation. The
  residual is orthographic in the sense `docs/design/word-indexing.md` ③ uses:
  166 of the 172 ayahs drift by a single constant amount, one spelling
  difference each. **None of this lifts the beta label** — the palette waits on a
  hafiz (`plan-tajweed-golden-row`), and a per-word colour that is wrong is worse
  than an ayah-wide mark that is vague. It only says the eventual bake is
  ordinary ETL work.
- **Rejected alternatives** (checked 2026-07-25, all for the licence gate):
  - **quran.com API `text_uthmani_tajweed`** — no grant of any kind, and it is
    not an independent path anyway: enumerated over all 114 surahs its rule
    counts match this file exactly, including the two rarest
    (`idgham_mutajanisayn` 58 = 58, `idgham_mutaqaribayn` 13 = 13, same 13 ayahs)
    and the same `izhar` gap. Common lineage; routing through it would lose the
    CC BY attribution notice rather than gain a licence.
  - **QUL (qul.tarteel.ai) tajweed resources #58 / #87** — letter-level and
    KFGQPC-native, which would have solved the alignment problem outright, but no
    licence text appears anywhere on the resource pages, the credits page or the
    FAQ, and the downloads are login-gated. `TarteelAI/quranic-universal-library`
    is MIT, but that covers the Rails app; the data is not in the repo. Same
    rejection as QUL morphology in Loop 5.
  - **AlQuran.cloud `quran-tajweed` edition** — "© Islamic Network and
    contributors since 2014", no grant.
  - **`quran/quran-tajweed`** — a 2017 fork of this repo with no LICENSE that
    also drops the Tanzil clause from the README; strictly worse than the
    original.
  - **`quranfoundation/TajweedImages`** — derived from a copyrighted work
    (Ayman Suwayd), no grant.
  - **`misraj-ai/quranhub`** (Non-Commercial), **`tarekeldeeb/tajweed-embeddings`**
    (Waqf 2.0 non-commercial + all rights reserved) — present licences, but
    non-commercial terms, which Hifth's own unsettled licence (PLAN follow-up ⑤)
    is in no position to inherit.
- **Immutability:** bytes are vendored verbatim and never edited (PLAN §8).
  Refresh = re-pin a newer commit and update this file.
