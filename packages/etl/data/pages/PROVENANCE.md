# ayah-pages.json — provenance

> **Loop 4b:** this directory now holds two things. `ayah-pages.json` is below;
> [`quran-svg.pin.json`](./quran-svg.pin.json) is the *page corpus* — 348 MB of
> upstream SVG is too large to vendor here the way the mutashabihat, roots and
> tajweed inputs are, so the pin stands in for the input with a SHA-256 per
> upstream file and per vendored byte. Its `$comment` says which half is checked
> when and by what.

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
- **Loop 4b re-derivation — it reproduced, and from different bytes.** The table
  above was derived from the corpus's per-page **JSON**; `extract-pages.mjs`
  re-derives it from the vendored **SVG**, reading each polygon's `verse-<n>` id
  out of the markup that ships. Both routes produce the same 6236 entries and the
  file did not change. That is worth more than a re-run: it is the JSON metadata
  and the shipped geometry agreeing, so a page whose polygons were dropped or
  renumbered in vendoring could not pass unnoticed.
- **Two upstream `id` defects, repaired and asserted.** Exactly two ayah polygons
  — 19:3 on p305 and 75:5 on p577 — carry path geometry in the `id` attribute
  where every other polygon carries `verse-<absolute ayah>`. `vendor-pages.mjs`
  rewrites those two to the id they should have had and asserts the count is
  **exactly two** and the ayahs are **exactly those two**, so a future pin that
  fixes them upstream fails loudly rather than drifting. `extract-pages.mjs`
  refuses any polygon without a well-formed id, so the repair cannot be skipped.
- **This table is also the instrument that identifies other corpora.** The V1/V2
  argument above runs in reverse: a corpus that tags its words with surah and
  ayah declares its pagination, and comparing that against these 6236 entries
  says which print it is without rendering a glyph. `probe-ligature-print.mjs`
  does exactly that to the candidate word-geometry corpus
  ([MushafDatabase-Ligature-Based-SVG](https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG),
  which states no print) and the verdict — V2, over all four divergence bands
  plus controls, 56/56 — is recorded with the fetched pages' hashes in
  [`ligature-svg.probe.json`](ligature-svg.probe.json).
- **word-B: that corpus is now an input — of measurements, not of bytes.** The
  probe answered "same print", and `probe-word-registration.mjs` then answered
  the second question: whether a box drawn on *its* page frame lands where the
  ink is on *ours*. It does — `ours = s·theirs + t`, fitted per page by least
  squares on the one correspondence neither corpus was built to provide, the
  ayah-end ornaments. So `build-words.mjs` transfers 91,451 word rectangles onto
  our viewBox and writes them to `apps/web/public/assets/words/hafs-kfqc/`, with
  [`word-boxes.pin.json`](word-boxes.pin.json) holding a SHA-256 per upstream
  page and per shard.

  **Still no upstream bytes ship, and that distinction is the point.** 378 MB
  was read to write 2.2 MB of geometry. The pages remain the quranpedia print,
  unchanged and still re-hashed by `gate:pages`; what the ligature corpus
  contributed is a number per word. Nor is its *text* taken: its word index is
  the print's, which disagrees with the Quranic Arabic Corpus's on 4,499 of
  6,236 ayahs, so joining the two needs an alignment and not an assumption (see
  the pin's `$segmentation`).

  **And it repaid the reading with a defect neither this file nor `gate:pages`
  could see.** `gate:pages` demands no orphan ink; on p577 there was none — the
  ink of 75:5's first word *was* covered, by 75:4's polygon. Only a second,
  independent print of the same page could say so, and it did: of 86,965
  lexical words, exactly one landed outside its own ayah. It is repaired in
  `vendor-pages.mjs` (the "stranded first word" shape) and the count is now
  zero. Two witnesses see what one cannot, which is the argument for having
  gone and fetched the second.
- **A third witness, and it had never seen us — measured 2026-08-06.** Both
  checks above compare this table against another *corpus*: bytes someone built
  by processing the same artwork. `scripts/probe-reference.mjs` asks a different
  question of a different kind of source — a page table **published for readers**,
  api.quran.com's `verses/by_page/N`, which is **V1/1405H**. That makes it useless
  as a source, and the Loop 4a argument above is exactly what makes it valuable as
  an *instrument*: **a pagination is a fingerprint**. A V2 corpus checked against a
  V1 table must agree on 568 pages and differ on precisely the other 36. Both
  halves are asserted, so agreement where the prints must differ is as much a
  finding as difference where they must not. Over all 604 pages: **568 agree, 36
  diverge, 0 surprises** — the divergent set is exactly `V1_V2_DIVERGENCE` in the
  probe, which enumerates the 36 rather than expressing the four bands named above,
  because 566, 571–574 and 577–582 sit inside "the 564–600 region" and do **not**
  diverge. So the Loop 4a identification now also holds from outside this repo,
  re-derived by a party with no access to the corpus it identifies.

  **It is a probe and not a gate, permanently.** It reaches the public internet,
  and `SOURCES.md` already wrote down what that costs: a gate that reaches the
  network fails when a host is down, which teaches everyone to skip it. Same
  reasoning that named `check-source-offer.mjs` `check-` and cancelled the KFGQPC
  watcher. Run it with `make probe-reference ALL=1`; it asks for verse *keys* only
  (no `fields` parameter), so no Quran text crosses the wire, and it writes
  nothing. What it cannot do is the reason `edge-spot-audit` is still owned by a
  human: it settles where an ayah *is*, never whether two of them are genuinely
  confused. `.claude/skills/mushaf-reference/SKILL.md` carries the rest — which
  published references can stand in for paper, and which are a different qira'a or
  a different revision and will make a correct pair look wrong.
- **The marks on these pages are drawn about a unit out of place, and the
  correction covers 6.6% of them — measured 2026-08-12.** The word geometry above
  transfers cleanly; the *diacritic* boxes carried onto this frame by the same fit
  do not. `probe-mark-ink.mjs` scores each mark's rectangle against the ink under
  it and against three deliberately wrong placements, and as shipped a claimed
  placement loses to a wrong one: **separation −0.242**, only 12.70% of marks
  beating their own null. The error is a shift of **0.79 across and 1.07 down** on
  marks 5.6 × 3.6, the same direction on every page sampled, and taking each page's
  own shift out lifts achievable overlap to 0.901–0.912 everywhere. A reader has
  since confirmed the direction by hand: of 60 marks placed, **59 landed nearer the
  corrected rectangle** than the one the app draws today (98.3%, interval
  91.1–99.7).
  **The number to carry away, though, is the coverage.** The probe samples marks and
  discards any page that got too few to fit, so 4,000 sampled marks produced a
  correction for **40 pages of 604 (6.6%)** — and because a by-eye trial cannot be
  built for a page with no proposed move, all 60 of those placements came from the
  same 40. Nothing measured so far separates *this print is displaced* from *these
  forty pages are displaced*, and nothing here should be applied to the other 564
  until a full pass exists. The unresolved remainder — a further tenth of a unit,
  which does not clear nothing once the pages rather than the placements are
  counted — is **not** applied. `docs/design/mark-registration.md` §⑦ and §⑧ carry
  the reasoning, `docs/validation/rulings/` the answers the reader gave.
