# What should the panel show around the ayah?

**Status:** open. Nobody has decided; option A is what ships.

**Picture:** <https://claude.ai/code/artifact/b7be0f22-3ff5-45b7-a5c1-850dd73ef1f1> — five options, each
drawn on the real artwork at the panel's real width. Checked in as `comparison-crop.html`, rebuilt by
`node scripts/build-crop-options.mjs`, which writes that copy and the published one from the same pass.

Read the picture first. This file is the reasons; the page is the subject, and no paragraph here
substitutes for seeing a crop at the size a reader actually gets it.

## What this is

The look-alike panel used to show its two ayahs as retyped text out of a hand-built table. That table
is gone — it was the larger of the two sites holding running scripture, and it was wrong on its own
terms besides, because its spelling did not match the mus'haf the reader was looking at. The panel now
crops both ayahs out of the printed page. One set of letters, and 2,544 pairs covered where the table
covered twelve.

An ayah almost never begins and ends at the edge of a printed line, so the rectangle cut around it
carries whatever else sits on those lines. The wash marks the words the two ayahs do not share. It
does not, and cannot, mark the difference between *the rest of this ayah, which the two have in
common* and *a different ayah that happens to share a line*. A reader can take unmarked for shared.

That is the whole question. Which words get washed is read off the edge's `span`/`toSpan` and is
correct; it is not reopened here.

## The cost of leaving it

Measured over every drawable side of every pair — 5,088 crops, by `scripts/build-crop-options.mjs`,
which recomputes the figures on every build so the page cannot drift from the tree:

| | |
| --- | --- |
| mean share of a crop that is the ayah it names | 69.8% |
| median | 70.2% |
| crops that are more neighbour than ayah | 820 (16.1%) |
| under a third | 220 (4.3%) |
| worst | 10.3% — 80:36 on page 585 |
| single-line crops, which are already perfect | 584 |
| two-line crops, the worst class | 60.7% mean |

Two of those matter more than the average. The single-line crops contain nothing but their ayah and
whatever is decided must not disturb them. And the worst case is not the longest ayah but the shortest
multi-line one: both of its lines are partial and there is no full line in the middle to dilute the
edges.

The sharpest statement of the problem is not a number. On the app's own signature pair, the crop
labelled 2:123 has its entire first line occupied by 2:122, ending in a printed ayah marker, with
nothing marking it — the ayah the label names does not start until line two. That is on the page,
under option A, at the size it ships.

## Prior art

The composite — cropping an ayah out of a printed page and setting it beside its look-alike — I did
not find anyone doing. The largest public library of Quran data publishes the halves separately and has
not joined them: [twenty approved mushaf layouts](https://qul.tarteel.ai/resources/mushaf-layout) in
one place, [5,277 mutashabihat entries](https://qul.tarteel.ai/resources/mutashabihat) and
[4,001 similar-ayah links](https://qul.tarteel.ai/resources/similar-ayah) in another. quran.com shows
no look-alike feature on an ayah's own page.

The sub-problem — marking a run of text that wraps across lines of a page — is solved, and four
independent traditions solve it the same way: **per line, never by a box around the whole run.**

- [CSS Pseudo-Elements 4 §3.4](https://www.w3.org/TR/css-pseudo-4/#highlight-bounds) — a highlight is a
  single overlay for the document, and "Each box owns the piece of the overlay" for the text inside it.
  Every text selection in every browser is per-fragment.
- [CSSOM View](https://drafts.csswg.org/cssom-view/) — the platform names the two shapes separately:
  a list with "one for each box fragment", or "the smallest rectangle that includes all of the
  rectangles in list". `DiffView` is calling the second one.
- [W3C Web Annotation Data Model](https://www.w3.org/TR/annotation-model/) — the rectangle selector is
  explicitly limited ("even a simple circular region of an image, or a diagonal line across it, are not
  possible") and the spec points at an SVG selector when the region is not a rectangle.
- [IIIF Image API 3.0 §4.1](https://iiif.io/api/image/3.0/) — region requests are rectangle-only, with
  no multi-part form. Worth naming because it explains why our crop is a rectangle: a rectangle is what
  the tooling hands you, not what the content is.
- [hOCR 1.2](https://kba.github.io/hocr-spec/1.2/) and the
  [ALTO 4.4 schema](https://github.com/altoxml/schema) — both put geometry on the text *line*; logical
  units group lines rather than having shapes of their own. ALTO's `Shape`/`Polygon` is documented as
  describing "the bounding shape of a block, if it is not rectangular", which is exactly an ayah
  crossing three lines.

This changes the reading of option B: it is the conventional answer, not the bold one. Its remaining
objection is appearance, not correctness — none of those precedents has to look like a page of a
mus'haf.

**Not confirmed, and not counted above.** A multi-line PDF highlight is, I believe, stored as several
quadrilaterals rather than one rectangle — the same convention a fifth time — but both specification
sources I tried returned nothing and this session's search budget was spent. WebSearch was exhausted
at 200/200, so all of the above is primary-source fetching against known URLs rather than a search;
`loc.gov`'s ALTO page returned 403 and the finding was recovered from the schema repository instead. I
also could not open QUL's layout or look-alike data files, so that finding rests on their own
descriptions of them.

## What constrains it

- **The printed page is never edited.** Any option draws *over* the artwork. Re-flowing or re-setting
  letters is off the table — avoiding exactly that is why the retyped table went.
- **The page is never re-themed** (`tajweed-colours`, and the app has no dark theme at all). The
  printer's ink is a fixed dark; every specimen on the page is on paper even at night, deliberately.
- **The wash stays translucent.** Nothing solid goes over the ink.
- **The no-edge fallback stays.** No `span`, no shard, or no page → nothing is drawn and the hop row
  keeps its plain note. Every option must keep it.
- **`mark-placement` is the same tension in a second place** — whether a rectangle should register
  against a printed line or a whole page. The two should not be answered in opposite directions
  without somebody saying why. Both are open.

## The options

Grouped by what they do about the neighbours. They are not exclusive — B composes with D, C with E —
but each is drawn alone so it can be judged alone.

| | | |
| --- | --- | --- |
| **A** | Leave it as it is | The rectangle as it ships. Zero work, and the only option with no precedent behind it. |
| **B** | Cut each line down to the ayah's own words | One strip per line, in place. The problem disappears by construction; it is what everything else does; it is ragged. |
| **C** | Fade everything that is not this ayah | One rectangle, a veil over the neighbours. Keeps context, puts a scrim over printed Quran. |
| **E** | Mark where the ayah begins and ends | Two brackets, nothing hidden. Lightest intervention; states the boundary without quieting anything. |
| **D** | Mark the shared words too | A third neutral tint, so plain means *not part of the comparison*. Fixes the inference rather than its cause; needs a legend there is no room for. |

Implementation for each is a change to `apps/web/src/components/DiffView.tsx` alone; B is the only one
that changes the crop from one element into several. `WordIndex.bandsFor` already returns the per-line
rectangles B needs — it is what every option here is drawn from, including A's union.

## Rejected

- **Show the whole page and point at the ayah.** The panel is a strip under a row in a list. A whole
  page at that size is unreadable, and the reader already has one.
- **Re-flow the ayah onto its own line.** Moves the printer's letters. That is the defect cropping was
  brought in to fix.
- **Blur the neighbours.** Same objection, and harder to defend over printed Quran than a tint of equal
  strength.
- **Draw only the differing words.** The shared opening is *why* the pair is confusable; remove it and
  the panel stops answering its own question.

## What would change the answer

- **A hafiz reading the panel** and saying whether the neighbours help or hurt. The case against A
  rests on a guess about someone else's habit that has been tested on nobody.
- **Whether B's raggedness reads as broken.** After the prior art, this is the only real objection left
  to it, and it is an appearance claim. Two people, fifteen minutes.
- **The panel leaving the list row.** B's raggedness is a cramped-strip problem.
- **Any change to how the page is themed.** C is a veil in the page's own paper colour.

## Not settled here

Which words get washed (correct, verified). The two wash colours (settled elsewhere). Whether the panel
should exist. Anything about the vendored artwork.
