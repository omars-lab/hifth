# The repo's most-repeated claim is false, and nothing was checking it

> **This file previously held the sitting-instrument plan**, which is unfinished and is *not*
> superseded. It is recoverable in full at `git show 83041f3:.claude/plans/shimmering-wandering-lobster.md`
> and should be restored to its own file before that work resumes.

## Context

Twenty-two times across twenty files, in three shipped `NOTICE.txt` files and in the sentence
`docs/decisions/loop-5.md:119` leans on, this repo asserts some version of *"there is no Quran
text here."* Measured against the tree, the unscoped form of that claim is false.

Two sites hold running scripture. Measurement is the **longest run of consecutive fully-vowelled
words** — one vowelled word is a specimen, a phrase is a passage somebody can recover:

| file | longest phrase | vowelled words | ships to the site? |
| --- | --- | --- | --- |
| `packages/core/src/verse-text.ts` | **11 words** | 160 | **yes** — all 48 token strings are byte-present in `apps/web/dist/assets/index-*.js` |
| `packages/etl/scripts/lib/tajweed-fold.test.mjs` | **5 words** | 29 | no — pipeline test, repository only |

Every other Arabic-bearing file in the tree scores **1 or 2**: our own interface Arabic
(`ar.gen.ts`, `format.ts`), domain terms (*madd*, *tamm*), and single-word pipeline specimens
(tajweed edge cases, join fixtures, encoding probes). **Nothing sits at 3 or 4.** That gap is
what makes a gate possible rather than a matter of taste.

Nothing caught either site. `gate:notext` sounds like it would and does not — it forbids `<text>`
elements in page SVGs because of a Safari paint bug, which is a rendering requirement wearing a
name that reads like a scripture check.

**Why it matters more than tidiness.** The Crossway/ESV takedown campaign of July–August 2025
ran eleven notices, roughly half of them **path-scoped into code repositories** — a data
directory in one, a **test-fixtures directory** in another. Blast radius tracks the directory
holding the text, not the project's purpose. Both of our sites are that shape. Unlike everything
else in `docs/design/what-we-distribute.md`, this needs no licensing opinion from anybody.

**And the shipped panel is also wrong on its own terms.** `verse-text.ts` is typed in a plainer
spelling than the mus'haf on screen. A reader comparing 2:48 and 2:123 sees one spelling in the
panel and different letters on the page underneath it.

**Outcome:** no running scripture in the tree, a gate that refuses the next one, the licensing
map covering everything that actually ships, and the panel showing the reader the same ink the
page does.

---

## The work

Ordered so the gate lands last and passes on arrival.

### ① Draw the diff panel from the page artwork — deletes `verse-text.ts`

**The classification is already shipped, for every edge.** This was the discovery that made the
option cheap. Adjacency edges already carry the target's page and the matching word range on
both sides:

```
2:48 → 2:123   page 19   span {from:[1,13]}   toSpan {from:[1,13]}
```

and the word shards already carry per-ayah boxes in the same index space:

```
2:48   page  7   from 1   23 boxes → indices 1..23
2:123  page 19   from 1   22 boxes → indices 1..22
```

Words 1–13 are the shared opening; 14–23 against 14–22 is where they diverge. That is exactly
what the hand-typed `cls 0 / 1 / 2` encoded — **already present, for all 44,431 links rather
than twelve ayah pairs.**

So the panel becomes: read the edge's `span`/`toSpan`, load each side's page SVG and word shard,
crop each word's box out of the page, and wash the words that fall outside the shared range.

- **Reuse, do not build:** `loadPageSvg` and `loadWordShard` (`apps/web/src/assets.ts:90,197`)
  and `WordIndex` (`packages/core/src/words.ts:120`), which already keys bare `"2:48"` to rects
  in reading order and holds the print's start index.
- **Rewrite** `apps/web/src/components/DiffView.tsx` — `TokenRow` becomes a row of cropped word
  SVGs. Keep `lang="ar" dir="rtl"` and the existing `styles.dA`/`dB` washes.
- **Replace** `diffPair` in `packages/core/src/verse-text.ts` with a pure function over an edge —
  no text, no table. Rename the module to say what it now is; drop `VERSE_TEXT`, `verseTokens`,
  `DiffToken`, `DiffClass` from `packages/core/src/index.ts:105-111`.
- **First step before any of it:** confirm on 2:48/2:123 that `span.from` and the shard's `from`
  share an index space across a page boundary. The whole design rests on that one assumption and
  it is ten minutes to check.
- **The target's page must be fetched** when the panel expands — it is inside a popover opened on
  demand, so lazy on expand. Both call sites: `HighlightMenu.tsx:213`, `HopPopover.tsx:166`.
- **Falls back exactly as today:** no edge, no shard, or no page → render nothing, and the hop row
  keeps its plain note. That path already exists for the 6,224 pairs the table never covered.
- **While in there:** edge `note` fields carry bare Arabic (`"شفاعة ↔ عدل order swapped"`) and
  ship in the adjacency assets. Two unvowelled words is a specimen, not a phrase — but check
  where the note text originates before leaving it.

### ② The second site — `packages/etl/scripts/lib/tajweed-fold.test.mjs`

Five running words. Replace the phrase fixtures with per-word cases drawn from the same
edge-case set the rest of the file already uses, or with escaped code points where a word is
genuinely the thing under test. **Do not weaken what the test asserts** — it is checking fold
behaviour on real orthography and that coverage has to survive.

### ③ A gate that refuses the next one — `scripts/gate-scripture.mjs`

Model it on `scripts/gate-text-sources.mjs` exactly: same
`git ls-files --cached --others --exclude-standard` enumeration, same `SOURCE_RE`/`EXCLUDE_RE`
split with the reasoning stated in the file, same untracked-files rationale (its comments at
lines 42–56 explain why tracked-only is a real blind spot; that argument applies here unchanged).

**The rule:** fail on any run of **three or more consecutive fully-vowelled Arabic words**, where
a word counts as vowelled at half or more of its letters carrying a mark. Measured margin — 11
and 5 on the two offenders, 1 or 2 everywhere else, nothing between.

**The allowlist:** a named list of single-specimen files with a one-line reason each, so the
~90 lone vowelled words in `probe-tajweed-words.mjs`, `tajweed-fold.mjs`, `mark-join*.mjs`,
`probe-diacritics.mjs` and `segmentation.mjs` read as reviewed rather than unnoticed. **The
phrase rule is not allowlistable** — a run of three fails regardless of what the list says.

Wire into `package.json` beside the other gates, into `make ci`, and into `gate:gates`.

State in the header what `gate:notext` is actually about, so the next reader does not assume that
one covers this.

### ④ Make the licensing map see the whole assets folder — `scripts/gate-notices.mjs`

Three defects, all in one file:

- **Blind by construction.** `BUCKETS` declares three paths (`roots`, `skins`, `adj`) and the
  cross-check at line 187 compares that declaration against `LICENSES.md` in both directions —
  but it never enumerates `apps/web/public/assets/` itself. Add that enumeration: every entry
  must be either a declared bucket or a named entry in an "ours, no inherited terms" list.
- **Two shipped trees are in no bucket.** `words/hafs-kfqc/` — 604 files, 2.8 MB — and
  `manifest.json` at 24,471 bytes. The string `words` appears in neither `SOURCES.md` nor
  `LICENSES.md` nor this gate. (`pages` is deliberate: it is covered by `LICENSES.md`'s "What we
  do not license" — keep it out of the buckets and put it in the named list with that reason.)
- **A false declaration.** Line 103 asserts `"ayah-pages.json": "ours"` for the roots bucket.
  Confirmed false. Line 129 already declares the honest form for the same file in the `adj`
  bucket — mirror that.

### ⑤ Say where the transliteration table came from — `packages/etl/scripts/build-roots.mjs:86`

The comment reads *"Buckwalter → Arabic (corpus.quran.com/java/buckwalter.jsp, verbatim)"* — a
table copied from the GPL corpus's own page. Buckwalter is a published transliteration **scheme**
and a forty-odd entry character mapping is thin ground for anyone to claim, but the comment as
written says we copied it from them. Cite the scheme's original publication rather than the
corpus's rendering of it, and add a row to `SOURCES.md` if the citation does not resolve to
something already listed there.

### ⑥ The prose that is wrong

Four sites. **The distinction that matters:** *scoped* claims stay — "our shards carry no Quran
text", "no Quran text crosses the wire", "this file contains no Quran text" are all still true
and all still worth saying. Only the **unscoped repo-wide** form is false.

- **Narrow the standing rule** where it is stated without scope: `morphology.mjs:14`,
  `probe-mark-labels.mjs:76`, `probe-mark-ink.mjs:65`, `probe-encodings.mjs:39`,
  `build-tajweed.mjs:35`, `scripts/probe-reference.mjs:34`, `docs/design/etl-pipeline.md:241`,
  `docs/design/word-indexing.md:467`, `.claude/skills/mushaf-reference/SKILL.md:110`. It becomes
  a rule about what is *vendored and shipped* — which is the thing it was always defending — and
  it names the gate that now enforces it.
  **Leave `docs/decisions/loop-5.md:119` alone.** It says *"our shards emit no Quran text"*, and
  that is scoped and true; the CC BY-ND argument standing on it is not damaged. An earlier note
  of mine overstated this.
- **`LICENSES.md:56-58`** — *"The app code is not a derivative of the corpus data — it reads the
  shards at runtime — so nothing here reaches our source by way of the data."* The premise is
  true (every asset read in `apps/web/src/assets.ts` is a `fetch` by URL; no `readFileSync` or
  `import` targets `packages/etl/data/`). The conclusion does not follow, because content
  arrived by **typing**, not across that boundary. Rewrite so it claims what it can prove.
- **`LICENSES.md:131`** — the page artwork is *"reproduced here unmodified"*. False: svgo runs at
  `floatPrecision 1`. Say what is applied.
- **`SOURCES.md:86`** — *"4b applies exactly two declared transforms"*, against
  `vendor-pages.mjs:25-26` which says three. Measured: `POLYGON_REPAIRS` is **23 entries across
  19 distinct pages**, `ID_REPAIRS` is **2**. The code is right and the register is stale; also
  correct the two-`id`-repairs description, which omits the polygon repairs entirely.

---

## Registers

- **`docs/issues.json`** — four rows are already written for this work
  (`twelve-verses-of-scripture-ship-in-the-bundle`,
  `the-transliteration-table-is-copied-into-our-code`,
  `the-artwork-pipeline-declares-two-transforms-and-applies-three`,
  `the-asset-manifest-is-in-no-licence-bucket`). Move each to `fixed` with `closedBy` as it
  lands, and **add one row for the second scripture site**, which no row covers. Hand-edited.
  Then `pnpm issues:doc && pnpm gate:issues && make tasks-doc`.
- **`docs/map.json`** — `gate-scripture.mjs` needs a row, and the `gate-notices.mjs` row needs
  the assets-folder enumeration recorded. Hand-edited.
- **`docs/design/what-we-distribute.md`** — item ④ carries the finding and predicts this fix;
  update it to what was actually done, and record the second site, which the document does not
  yet know about.
- **`LICENSES.md` / `SOURCES.md`** — the two new rows from ④ and any row from ⑤.
- **No new decision record.** Nothing here is a choice between defensible options; it is a set of
  claims that do not match the tree. The open licensing decisions are untouched.

## Verification

1. `node scripts/gate-scripture.mjs` on the tree **before** ① and ② — it must name exactly the
   two files, and nothing else. A gate that cannot reproduce the finding that motivated it is
   not measuring what it claims.
2. After ① and ②, the same run passes, and
   `grep -c $'َ' packages/core/src/verse-text.ts` finds no file.
3. `pnpm --filter @hifth/core test && pnpm --filter @hifth/web test` — `verse-text.test.ts` is
   deleted with its subject; `DiffView` gets a test that a pair with a known span washes the
   right word indices on both sides.
4. Rebuild the web bundle and confirm **zero** of the 48 token strings survive in
   `apps/web/dist/assets/index-*.js`. That byte-presence check is how the finding was made and
   it is how the fix is proved.
5. Open a hop from 2:48 to 2:123 in the browser and confirm by eye: the panel draws real printed
   words, the two divergent endings are washed, and the letters match the page underneath.
6. `pnpm gate:notices` — it must now fail if a tree is added to `apps/web/public/assets/` with
   no row. Test that by adding an empty directory and confirming the failure, then removing it.
7. `pnpm issues:doc && pnpm gate:issues`, `make tasks-doc`, `git add -A && make ci`.
8. **Commit code and docs separately.**

## Operational

- `cd /Users/omareid/Workspace/git/hifth && ./scripts/with-lock.sh <label> "sh -c '<cmd>'"`, and
  re-export `PATH` **inside** the quoted command every time.
- Registers are hand-edited, never generated. Never `--no-verify`.
- Nothing in this plan puts an Arabic literal into a tracked file.
