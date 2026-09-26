# Prior art: how other open-source Qur'an projects solve our hard problems

This is a survey of open-source projects (mostly on GitHub) that tackle the same *kinds* of
problems this app tackles. It was done by reading READMEs, source layout, and docs — nothing was
cloned or built. Every link below is a real URL that was checked during the survey.

The point of the survey is to learn from how others solved five problems, and — most of all — to
find anyone who solves the one that is still open for us: **placing a small tajweed / harakat mark
exactly onto the ink of the letter it belongs to.**

## The five problems, in plain terms

1. **Show one exact printed page, letter-for-letter.** A hafiz memorised a specific printing
   (the King Fahd Complex "Madani" Hafs mus'haf). They need *that* page, with the letters in the
   same places. Our app ships each page as one big piece of outlined artwork (SVG glyph outlines,
   roughly 59-154 KB per page). How do others represent the page?
2. **Put a small mark exactly on a letter.** Registering a little mark box onto the exact ink of
   the letter it belongs to. This is the open question for us.
3. **Highlight a whole verse or a single word** that may wrap across lines on the page.
4. **Turn the page like a book** (a curl or a flat seam), smoothly, on a phone, without the heavy
   page artwork making the turn stutter.
5. **A neutral third source for where words and verses begin and end** — a word/verse map we do
   not have to take on faith from any one vendor.

---

## Problem 1 — showing one exact printed page

There are three families in the wild: (a) **outlined artwork** (our approach), (b) **special
fonts** that draw the exact printed shapes from text plus per-page glyph codes, and (c) **page
images**.

### batoulapps/quran-svg — the same approach we use
- URL: https://github.com/batoulapps/quran-svg
- Problems: 1 (page representation), and unexpectedly 2 and 3 (see below).
- Approach: One SVG per page, batch-converted with Inkscape from the **official Adobe Illustrator
  files published by the King Fahd Qur'an Printing Complex**. So it is the same lineage as our
  artwork: outlined glyph paths, no live Arabic text. This is almost certainly the upstream our
  own page artwork descends from (another repo, `taulujas-png/quran-mushaf`, openly describes
  itself as "604 pages as WebP — converted from batoulapps/quran-svg").
- **Why it matters most:** this repo does not stop at drawing the page. It also *derives geometry
  from the artwork* — the same job we are trying to do. See the detailed note under Problem 2.
- License: MIT. Activity: last pushed 2022; 149 stars. Stable/dormant but foundational.

### zonetecde/mushaf-layout — the font-plus-glyph-codes approach
- URL: https://github.com/zonetecde/mushaf-layout
- Problems: 1, 3, 5.
- Approach: One JSON per page (604 files). Each page is pre-broken into lines and words; every
  word carries its **QPC glyph codes** (`qpcV1` / `qpcV2`) plus the verse it belongs to
  (`surah:verse:word`). You render it by setting those glyph codes in the matching KFGQPC
  "QPC" font, and the font draws the exact printed page. No page images, no ink geometry — the
  font does the drawing and the layout JSON says what goes on which line.
- License: none stated (treat as all-rights-reserved). Activity: pushed 2025; ~20 stars.

### The KFGQPC / QPC fonts themselves (the "font" family)
- thetruetruth/quran-data-kfgqpc — https://github.com/thetruetruth/quran-data-kfgqpc — Unicode
  Uthmanic text + KFGQPC font data for developers. No license stated; ~62 stars; pushed 2022.
- raflyfahrezi/KFGQPC-Uthmanic-Script-HAFS-Regular —
  https://github.com/raflyfahrezi/KFGQPC-Uthmanic-Script-HAFS-Regular — the plain Hafs Uthmanic
  font.
- AbuYusof/Quran-Fonts-HAFS-Uthmanic-Colored-By-Tajweed-Ruls —
  https://github.com/AbuYusof/Quran-Fonts-HAFS-Uthmanic-Colored-By-Tajweed-Ruls — a **colour
  font** (COLR/CPAL) where the tajweed colour is baked into the glyphs themselves. Interesting as
  a "the font already knows the tajweed" data point, though it is Unicode-text-based, not artwork.
- YaseenDotDev/quran-qcf-v4 — https://github.com/YaseenDotDev/quran-qcf-v4 — the per-page "QCF"
  tajweed font (a separate font per page so the exact page shapes render).
- Trade-off of the whole font family: tiny to ship and gives you live text (so highlighting and
  mark placement are "free" via text spans) — **but** it depends on the reader having/loading the
  exact font, the shapes are the font vendor's rendering rather than the printed plates, and it
  requires shipping actual Arabic text. Our app deliberately avoids shipping Arabic text and uses
  the plates' own outlines, so this family does not fit our constraints even though it is the most
  common approach.

### Page-image family (for completeness)
- akram-seid/quran-hd-images (https://github.com/akram-seid/quran-hd-images) — HD Madani page PNGs.
- taulujas-png/quran-mushaf (https://github.com/taulujas-png/quran-mushaf) — the batoulapps SVGs
  flattened to WebP.
- Trade-off: dead simple and pixel-faithful, but the page is opaque — you get no verse/word/letter
  positions at all, so highlighting and mark placement have nothing to attach to.

---

## Problem 2 — placing a small mark exactly on a letter (our open question)

Two distinct strategies exist, and only one of them is about ink.

### Strategy A (the common one): annotate the *text*, let a font place the mark
Nearly every "tajweed" project attaches rules to **character positions in a text string**, then
relies on a font/DOM to render the coloured or marked letter. They never touch pixels or ink.

- **cpfair/quran-tajweed** — https://github.com/cpfair/quran-tajweed
  - Problem 2, done the text way. Ships `output/tajweed.hafs.uthmani-pause-sajdah.json`: for each
    verse, a list of `{rule, start, end}` where `start`/`end` are **Unicode codepoint offsets into
    the Tanzil.net Uthmani text**. Rules include ghunnah, idghaam, ikhfa, iqlab, the madd family,
    qalqalah, hamzat al-wasl, lam shamsiyyah, silent letters.
  - The clever part is *how the boundaries are found*: a set of hand-built **decision trees**
    (`rule_trees/*.json`, run by `tajweed_classifier.py`) that walk the text letter by letter,
    where a "letter" = a base character plus the combining diacritics (Unicode `Mn`) that follow
    it. Attributes are indexed relative to the current letter (`0_...`, negative = previous
    letters, positive = following). So it is a rule engine over the *character stream*, producing
    character ranges — not a geometric placement.
  - License: the data is CC-BY-4.0; code unlicensed. Activity: pushed 2021, "not actively
    maintained" (README points people to the Quran.com API instead); 189 stars.
  - **Bottom line for us:** this gives us *which letters* each rule covers, for free and from a
    neutral text source. It does **not** tell us *where on our page* that letter's ink is. It is a
    perfect front half (what to mark) bolted to a half we can't use (it assumes a text renderer
    places it).
- Sibling text-based tajweed projects, all the same shape (rule -> character range -> rendered by
  a font or by wrapping spans), useful only as corroboration of rule boundaries:
  nabil6391/qurantajweed (https://github.com/nabil6391/qurantajweed),
  rovshan-b/Quran-flutter-tajweed (https://github.com/rovshan-b/Quran-flutter-tajweed),
  ariona/rn-tajweed-verse (https://github.com/ariona/rn-tajweed-verse),
  ATouhou/alquran-tools (https://github.com/ATouhou/alquran-tools).

### Strategy B (the one that actually transfers): compute geometry from the artwork
Only one project in this survey does the ink-geometry job we need, and it is on our own artwork:

- **batoulapps/quran-svg — `line_split.py` and `positions.py`**
  - `positions.py`: the SVG plates carry **semantic layers** — there is an `ayah_markers` group,
    and each marker node has custom `ayah:x` / `ayah:y` attributes. The script reads those, sorts
    markers into lines by y-position, and writes per-page JSON of verse-marker coordinates. Lesson:
    the plates can carry hand-placed anchor points in their own coordinate space, and you just read
    them back. If our plates (or a derived layer) can carry per-mark anchors, placement becomes a
    lookup, not a search.
  - `line_split.py`: the genuinely relevant algorithm. Using `svgpathtools`, it takes each glyph
    path, computes its **bounding box** (`glyph_path.bbox()` -> xmin,xmax,ymin,ymax), and assigns
    the glyph to a line from its y-extent. For glyphs that straddle two lines (ambiguous), it does
    **nearest-path distance**: `path_distance()` samples points along one path and calls
    `radialrange()` to get the minimum distance to another path, i.e. it measures how close two
    pieces of ink actually are and assigns the glyph to the line whose ink it hugs. It also uses an
    x-overlap test (`within_bounds`) to decide whether two paths are horizontally over each other.
  - **This is exactly the toolkit our mark-registration problem needs:** bounding-box overlap +
    nearest-ink distance between two SVG paths, computed offline from the artwork with no Arabic
    text and no fonts. To place a harakat we would take the mark's box and find the base-letter
    glyph path it overlaps / sits nearest to — the same bbox-overlap-then-nearest-path pattern this
    script already uses to bind ambiguous glyphs to lines.
  - License: MIT (so we can lift the technique and even the code). Activity: dormant but done.

### What is *not* here (and why the search felt empty)
Searches for "arabic diacritic" surface a completely different field — **diacritic restoration**
(catt, almodhfer/Arabic_Diacritization, Anwarvic/Arabic-Tashkeela-Model, Hamza5/multilevel-
diacritizer). These are deep-learning models that *predict missing harakat in plain text*. That is
an NLP problem about which mark a word should have, not a rendering problem about where a mark's
box sits on ink. They do not transfer. Likewise Arabic OCR/segmentation projects were sparse and
image-classification-oriented, not glyph-to-annotation registration. The honest finding: **there is
essentially no open-source prior art for registering a mark box onto specific glyph ink, except the
bbox + nearest-path approach already living in batoulapps/quran-svg.**

---

## Problem 3 — highlighting a verse or a word across lines

Two ways again: font/DOM projects get it for free by wrapping the word's text in a span; artwork
projects must store per-word geometry.

- **cpfair/quran-align** — https://github.com/cpfair/quran-align — word-accurate **timestamps**
  (not screen boxes) for recited audio. JSON of `[word_start_index, word_end_index, start_msec,
  end_msec]` per verse, so a player can highlight the word being spoken. Method: a CMU Sphinx /
  PocketSphinx speaker-specific model recognises each verse's audio against a verse-limited
  dictionary, then aligns recognised words to the reference text. License: data CC-BY-4.0, code
  MIT; 256 stars; pushed 2017. This is the standard source for *time* segmentation, and pairs with
  screen geometry to do "karaoke" highlighting.
- **TarteelAI/quranic-universal-library (QUL)** — https://github.com/TarteelAI/quranic-universal-
  library — the big one: a Rails CMS (MIT, ~993 stars, actively pushed 2026) that manages and
  **exports** translations, tafsirs, audio segments, Arabic scripts, and **mushaf layouts**. Its
  mushaf-layout export is the font family's data model: per-word, which line and which position,
  keyed by `surah:verse:word`. Highlighting is then a DOM concern (wrap the word's glyphs). It does
  **not** publish per-word pixel boxes over a page image; geometry comes from laying out the font.
  It is the upstream for a whole ecosystem: blueheron786/quranic-universal-library-mushaf-layouts
  (the 15-line layouts), JibranKalia/quran-mushaf-renderer (a Sinatra renderer over QUL data),
  JibraanK/noor (word-synced hifz highlighting on QUL).
- **quran/quran.com-frontend-next** — https://github.com/quran/quran.com-frontend-next — quran.com
  itself renders words as text (QCF fonts / glyph codes) and highlights by word `location`, again
  DOM spans rather than page geometry.
- **marwan/quranwbw** — https://github.com/marwan/quranwbw — QuranWBW.com word-by-word reader;
  same font-plus-word-index model; ~112 stars, active, no license stated.
- Trade-off for us: all of these highlight by wrapping *text*. Because our page is artwork with no
  text, we cannot wrap anything — we need a stored per-word (and per-line-fragment) polygon/box in
  the plate's coordinate space, which is again a `line_split.py`-style derivation, not a data
  download.

---

## Problem 4 — turning the page like a book

The realistic page-turn effect is a solved, off-the-shelf component; nobody in the Qur'an space
wrote their own.

- **Nodlik/StPageFlip** — https://github.com/Nodlik/StPageFlip — the de-facto vanilla-JS library
  for realistic page-turn (soft/hard pages, mobile touch, portrait/landscape). Active (2026).
- **Nodlik/react-pageflip** — https://github.com/Nodlik/react-pageflip — the React wrapper over
  StPageFlip. Active (2026). This is the natural fit if we ever want a curl.
- **blasten/turn.js** — https://github.com/blasten/turn.js — the older jQuery-era HTML5 page-flip;
  widely forked, less maintained.
- **SympleNZ/PDFlipbook** — https://github.com/SympleNZ/PDFlipbook — vanilla JS, turns a PDF into a
  corner-fold flipbook with zoom and single/double-page modes; good reference for the interaction
  even though the source is a PDF.
- **kuberbassi/3d-book-codex** — https://github.com/kuberbassi/3d-book-codex — a React 3D page-flip
  component (WebGL-ish curl) for reference on the heavier, 3D end.
- Keeping heavy artwork cheap during the turn: none of these solve *our* specific cost problem
  (large SVG plates). The general pattern they rely on is to turn a **lightweight proxy** — a
  pre-rendered raster/thumbnail of the page — during the animation and swap the crisp page back in
  when the turn settles. `taulujas-png/quran-mushaf` (WebP plates) exists precisely because a raster
  is cheap; a raster proxy for the moving leaf plus our crisp SVG at rest is the transferable idea.

---

## Problem 5 — a neutral third source for word / verse boundaries

We want a word/verse map we don't have to take on faith from a single vendor. Several independent
sources exist:

- **Tanzil.net** (https://tanzil.net/download) — the reference Uthmani text used by *both*
  cpfair/quran-tajweed and cpfair/quran-align as their word/character backbone. Splitting the
  Tanzil Uthmani text on spaces defines "words"; verse numbers define verse boundaries. Widely
  treated as the neutral text.
- **Quranic Arabic Corpus** (corpus.quran.com) — independent morphological word segmentation with
  its own `surah:verse:word` addressing; a second opinion on word boundaries and grammar.
- **gaitco/quran-database** — https://github.com/gaitco/quran-database — a structured verses +
  metadata database.
- **semarketir/quranjson** — https://github.com/semarketir/quranjson — 6236 verses / 114 surahs /
  30 juz as JSON; simple verse-boundary source.
- **KFGQPC data** (thetruetruth/quran-data-kfgqpc, above) — the printing complex's own text, useful
  as the vendor-of-record cross-check.
- QUL and zonetecde/mushaf-layout also carry `surah:verse:word` indices, but they are the same
  ecosystem's layout data rather than a truly independent count.
- Relevance to our no-Arabic-text constraint: these give us word/verse *counts and boundaries*
  offline (numbers and indices, not necessarily the Arabic ink), so they can drive an
  offline-derivable check ("this page should contain verses X-Y, N words") without shipping text.

---

## What transfers / what doesn't

**Transfers directly to our mark-registration problem:**
- **batoulapps/quran-svg `line_split.py`** — bbox of each glyph path + **nearest-ink distance**
  (`svgpathtools` `bbox()` and `radialrange()`) + x-overlap test. This is the exact geometric
  toolkit for "which letter's ink does this mark's box sit on," runs offline on the artwork, needs
  no font and no Arabic text, and is MIT so we can lift it. Strongest single finding.
- **batoulapps/quran-svg `positions.py`** — the plates can carry hand-placed anchor points
  (`ayah:x/y` on a semantic `ayah_markers` layer) that you just read back. If mark anchors can live
  in a plate layer, placement becomes a lookup instead of a search.
- **cpfair/quran-tajweed** — tells us *which letters* carry each tajweed rule (character ranges over
  neutral Tanzil text, CC-BY). Ideal as the "what to mark" half, feeding the geometry half above.
- **cpfair/quran-align + QUL audio segments** — for verse/word *time* highlighting if we add
  recitation sync; complements screen geometry, doesn't replace it.
- **Nodlik/react-pageflip (StPageFlip)** + a raster-proxy-during-turn pattern — a ready page-curl
  and the standard trick for keeping heavy pages cheap mid-turn.
- **Tanzil / Quranic Arabic Corpus / KFGQPC counts** — disinterested word/verse boundary sources
  for offline sanity checks.

**Does not transfer (and why):**
- **The whole font/glyph-code family** (zonetecde/mushaf-layout, QUL mushaf layouts, quran.com,
  QuranWBW, the KFGQPC/QCF fonts). They render exact pages and get highlighting and mark placement
  "for free" — but only because they ship **live Arabic text placed by a font**. Our app ships
  outlined plates with **no Arabic text by design**, so there is no text stream to wrap a span
  around or to hang a font-drawn mark on. Their placement is free precisely by doing the thing we
  have chosen not to do.
- **Diacritic-restoration ML** (catt, Arabic_Diacritization, Tashkeela, multilevel-diacritizer).
  Different problem entirely: predicting *which* harakat a plain word should have, in text. Says
  nothing about *where a mark sits on ink*.
- **Page-image projects** (quran-hd-images, taulujas WebP). Pixel-faithful but opaque — no
  per-letter or per-word positions to register anything against (though a raster is still useful as
  a page-turn proxy).

**Net:** for placing marks by ink-overlap, there is one real ancestor — the bbox + nearest-path
geometry in batoulapps/quran-svg, on our own plate lineage — and it is the approach to build on.
Everyone else avoids the problem by shipping text and letting a font do the placing, which our
no-Arabic-text, exact-artwork constraint rules out.
