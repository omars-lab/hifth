# Highlighter shape and texture: the research behind options page B

*Raw findings from researcher B. The owner asked for more shapes and textures for the mark: a
rough, hand-drawn look, and see-through patches that stack into a darker double highlight, the
way a real highlighter does. This file lists every outside source I used, with what I took from
it and whether I actually read the page ("fetched") or only saw a search-result summary of it
("snippet"). Anything that rests on a snippet is flagged where it is used. The decision record
built from this is `highlight-texture-options-b.md` beside this file; its drawn page is
`highlight-texture-options-b.html`.*

Written 2026-09-30, working alone. I did not read the other researcher's files.

## How to read the source lists

- **Fetched** means I opened the page and read its text (through a web fetch or a direct
  download). A claim marked fetched is one I saw on the page.
- **Snippet** means a search engine showed me a summary and I could not open the page (it was
  blocked, broken, or I did not get to it). A claim resting on a snippet is a lead, not a
  finding.
- **Measured** means I ran it myself, here, and the number is mine.

---

## 1. How does real highlighter ink stack, and which screen blend copies it?

**Short answer.** Highlighter ink is a transparent dye. Light passes through it, bounces off the
paper and passes through it again. Two layers of dye each let through a fraction of the light, so
the fractions multiply. That is exactly what the screen's **multiply** blend computes (the
result is the backdrop colour times the mark's colour). So a second pass of the same pen goes
darker in the same hue, never greyer, and black letters stay black. Plain transparency (laying a
see-through sheet on top) is the wrong model: it mixes the mark's colour *into* the letters, so
black letters turn brown-grey.

| Source | Takeaway | How read |
| --- | --- | --- |
| [Wikipedia: Highlighter](https://en.wikipedia.org/wiki/Highlighter) | A highlighter is a felt-tip marker with transparent fluorescent ink, not opaque ink; typical dyes are pyranine (yellow) and rhodamines. | fetched |
| [Wikipedia: Subtractive color](https://en.wikipedia.org/wiki/Subtractive_color) | Each layer absorbs some wavelengths and passes the rest; the result is the product of the layers' transmissions. | fetched |
| [Wikipedia: Beer-Lambert law](https://en.wikipedia.org/wiki/Beer%E2%80%93Lambert_law) | Transmittance through successive layers multiplies. Two passes of the same ink behave like one pass at twice the concentration. | fetched |
| [W3C Compositing and Blending](https://www.w3.org/TR/compositing-1/) | Multiply is `backdrop x source`; darken is `min(backdrop, source)`. The general blend-then-composite formula. | fetched |
| [MDN mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mix-blend-mode) | The blend keywords on the web, including multiply, darken and plus-darker. | fetched |
| Fluorescent highlighter ink patents, e.g. [US8007096B2](https://patents.google.com/patent/US8007096B2/en) | Real highlighter ink fluoresces, which is why it glows; the screen cannot copy the glow, only the dye. | snippet |

**What this means for the page.** Multiply is the honest model of "patches of translucency that
compose double highlighted sections". The app already blends its mark with multiply, so the
physics is already in the app. What the app does *not* do yet is decide *which* pieces count as
one pass. See section 4.

## 2. What does a rough, hand-drawn look cost to build?

**Short answer.** Two well-known libraries do this, and both would take a large bite of the room
left in the app's download budget. The same look can be written directly in well under a kilobyte,
because the app already knows the one shape it needs (a band along a line).

**Measured here** (the npm package's shipped browser file, gzipped at level 9, on 2026-09-29):

| Package | Gzipped | Share of today's room |
| --- | --- | --- |
| roughjs | 8,919 B | 55% |
| rough-notation (built on Rough.js) | 4,007 B | 24% |
| perfect-freehand | 2,009 B | 12% |
| our own rough band plus its seeded noise (the code on the page, minified) | about 720 B | 4% |

The room: the app's budget is 175 KB and its recorded size is 162,841 B, which leaves 16,359 B.

| Source | Takeaway | How read |
| --- | --- | --- |
| [Rough.js on GitHub](https://github.com/rough-stuff/rough) | "A small (<9 kB) graphics library"; seven fill styles; `roughness`, `bowing`, `fillWeight`. | fetched |
| [Rough.js wiki (options)](https://github.com/rough-stuff/rough/wiki) | `roughness` 0 is a perfect shape, default 1; `bowing` bends lines; `seed` makes the randomness repeatable. | fetched |
| [roughjs.com](https://roughjs.com/) | "<9kB gzipped"; draws to SVG. | fetched |
| [rough-notation on GitHub](https://github.com/rough-stuff/rough-notation) | "3.83kb gzipped"; has a `highlight` annotation that animates in, built on Rough.js. | fetched |
| [perfect-freehand on GitHub](https://github.com/steveruizok/perfect-freehand) | Turns a list of pointer points into an outline that swells and thins (`size`, `thinning`, `smoothing`, `streamline`, simulated pressure). Needs points, which means a gesture or a made-up path. | fetched |
| [perfect-freehand on npm](https://www.npmjs.com/package/perfect-freehand) | Package page. | snippet (403) |
| [Excalidraw issue #70](https://github.com/excalidraw/excalidraw/issues/70) | Rough.js re-randomised shapes on every reload, so a saved drawing came back looking different; Excalidraw fixed it by seeding the randomness per shape. | fetched |
| Excalidraw "sloppiness" levels and a per-shape seed field ([scene schema](https://plus.excalidraw.com/docs/api/scene-content-schema)) | Three roughness levels exposed to users; a stored seed per element. | snippet |
| [Bundlephobia: roughjs](https://bundlephobia.com/package/roughjs) | Returned no data; I measured locally instead (table above). | fetched, empty |

**What this means for the page.** The lesson from Excalidraw is the one that matters for a
hafiz: **a mark that looks different every time you open the page is a mark you cannot learn**.
So the rough band on the page is seeded from the verse's own reference; the same verse is drawn
by the same hand every time. The live card lets you switch that off to feel the difference.

## 3. Can the ink have texture, and what breaks when it does?

**Short answer.** Yes: the browser's built-in noise filter can give grain, streaks and ragged
edges with no library at all. But filters are slow on phones, especially iPhones, one iPhone bug
report shows a filter plus multiply rendering as a solid block, and a filter on a perfectly level
line can make the line disappear in two of the three main browsers (I found this one myself;
see "What only the build showed").

| Source | Takeaway | How read |
| --- | --- | --- |
| [W3C Filter Effects](https://www.w3.org/TR/filter-effects-1/) | Filters apply first, then clipping, masking and opacity. The default filter area is measured from the element's own box, plus 10% on each side. | fetched |
| [MDN feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence) | The noise source: `baseFrequency`, `numOctaves`, `seed`, `type`. | fetched |
| [MDN feDisplacementMap](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap) | Moves each pixel by the noise times `scale`; this is how a clean edge becomes ragged. | fetched |
| [CSS-Tricks: patterns with SVG filters](https://css-tricks.com/creating-patterns-with-svg-filters/) | Noise, then a colour matrix, then a composite onto the shape: the grain recipe the page uses. | fetched |
| [Codrops: texture with feTurbulence](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/) | The standard article on the same recipe. | snippet (403) |
| [Ben Gammon: rough borders with SVG filters](https://bengammon.co.uk/rough-css-borders-with-svg-filters/) | Confirms noise plus displacement for rough edges; gives no values. | fetched |
| [Camillo Visini: hand-drawn motion](https://camillovisini.com/coding/simulating-hand-drawn-motion-with-svg-filters) | The "boiling" line: change the noise seed several times a second so the edge moves like hand-drawn animation. | fetched |
| [GSAP forum: feTurbulence on mobile](https://gsap.com/community/forums/topic/33075-gsap-and-feturbulence-mobile-performance/) | "SVG filters are pretty horrific for performance"; sluggish animation and tab crashes on iOS. | fetched |
| [Home Assistant issue #29866](https://github.com/home-assistant/frontend/issues/29866) | On iOS 26.3, an element with both a filter and multiply draws as a flat opaque rectangle instead of blending. It quotes the Safari 26.0 release note claiming a fix for this. | fetched |
| Safari 26.0 release note: "fixed rendering an image with a filter and mix-blend-mode only getting filtered but not mixed" | Known only as quoted in the issue above. | second-hand |
| [Vega issue #2842](https://github.com/vega/vega/issues/2842) | An older report that Safari did not blend SVG elements; shows this area has a history of Safari gaps. | fetched |
| [caniuse: mix-blend-mode](https://caniuse.com/css-mixblendmode) | Safari and iOS Safari are marked "partial", without saying what is missing. | fetched |
| [W3C fxtf-drafts #309](https://github.com/w3c/fxtf-drafts/issues/309) | Not about filter-then-blend order; not useful. | fetched |
| Safari "opacity: 0.9999" trick to force a group to blend | Folk workaround. | snippet |

**What I measured here, in three engines.** I drew four small test rows (a filtered level line;
a filtered filled shape; filter and multiply on the same element; filter and multiply on nested
groups) and photographed them in Playwright's Chromium, WebKit (build 2311, the engine of desktop
Safari) and Firefox:

- Filter plus multiply rendered correctly in all three, on the same element and on nested groups.
  **So I could not reproduce the iOS 26.3 bug on desktop WebKit. It is untested on an actual
  iPhone.**
- A filtered **level line** with the default filter area vanished in Chromium and WebKit and drew
  in Firefox. Its box has zero height, so an area measured from that box has zero height too.
  Setting the filter area in page units fixes it in all three.

## 4. What do other apps do where two highlights overlap?

**Short answer.** There are three camps, and users argue about which is right:

1. **It darkens, like real ink** (GoodNotes, FigJam, Zotero, Procreate's glazed brushes between
   strokes, Apple's PencilKit between separate strokes). Users are split: many like it, and a
   GoodNotes request to turn it off has hundreds of votes.
2. **It never darkens within one stroke, only across strokes** (Procreate glazed brushes, PencilKit's
   "wet ink" group, tldraw's two-pass highlight, the SaneNotes design). This is the rule the
   page calls "each mark is one more pass".
3. **They merge into one** (Apple Books, as described second-hand; Kindle, snippet only). No
   stacking at all, because overlapping marks become one mark.

No Qur'an app I found draws two nested highlights at all; they mark a verse by tinting its
number or its background, one mark at a time.

| App | Source | Takeaway | How read |
| --- | --- | --- | --- |
| GoodNotes | [Feedback forum request](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes/suggestions/18526903-when-highlighter-overlaps-don-t-darken-the-overla) | Overlaps darken, like a real pen; users asked for a toggle to stop it (about 261 votes). | fetched |
| GoodNotes | [Support: highlighter tool](https://support.goodnotes.com/hc/en-us/articles/7353718215823-Highlighting-with-the-Highlighter-tool), [behind text](https://support.goodnotes.com/hc/en-us/articles/360002892176-Why-does-the-Highlighter-not-appear-behind-the-text-it-highlights) | Straight-line mode; a setting to draw behind typed text. | snippet (403) |
| Notability | [Support: Highlighter](https://support.gingerlabs.com/hc/en-us/articles/4968218861978-Highlighter) | Highlighter draws behind handwriting. | snippet (403) |
| Notability and GoodNotes | [Whizz Tech print note](https://whizz-tech.com/support/printers/notability-goodnotes-highlighter-prints-opaque/) | Highlights are vector strokes with transparency; some print paths flatten them and they print opaque. | fetched |
| Zotero | [Forum: overlapping highlights look darker](https://forums.zotero.org/discussion/110523/overlapping-highlight-annotations-look-darker) | Overlaps darken; a moderator calls it standard in PDF tools; a user says it makes text harder to read. | fetched |
| Procreate | [Adventures with Art: glazed brushes](https://adventureswithart.com/procreate-glazed-brushes/) | A glazed brush lays one shade for the whole stroke however often you go back over it; a *new* stroke over it goes darker. | fetched |
| tldraw | [Default shapes: highlight](https://tldraw.dev/sdk-features/default-shapes) | The highlight "draws two passes with configurable opacities to imitate a highlighter pen": an underlay at 0.82 and an overlay at 0.35. | fetched |
| SaneNotes | [Issue #152](https://github.com/swiftsaneai/sanenotes/issues/152) | A chisel nib, width fixed, opacity 0.5, multiply on a layer under the ink; passing twice does not darken. | fetched |
| FigJam | [Help: doodle and highlight](https://help.figma.com/hc/en-us/articles/1500004414442-Doodle-and-highlight-in-FigJam-with-drawing-tools) | "Highlights are semi-transparent. To deepen a highlight, draw over it again." | fetched |
| Apple Notes | [Paperlike review](https://paperlike.com/blogs/paperlikers-insights/apple-notes-review) | Five thicknesses and an opacity slider; "even at 100% opacity, it won't dim your notes" (so it sits behind the writing). | fetched |
| Apple PencilKit | [WWDC26 session 203](https://developer.apple.com/videos/play/wwdc2026/203/) | Strokes drawn together quickly are composited "as if the inks were still wet" (one group, no darkening); separate groups stack. | fetched |
| Apple Books | [rfc-reader issue #522](https://github.com/Radiergummi/rfc-reader/issues/522) | Takes Apple Books as its model: "an overlapping highlight merges into one, in the new color." Second-hand. | fetched (second-hand) |
| Apple Books | [iPhone guide: annotate books](https://support.apple.com/guide/iphone/annotate-books-iph17bf340c1/ios) | Only the table of contents came back. Colours and underline style known only from snippets. | fetched, empty |
| Kindle | [KOReader discussion #13700](https://github.com/koreader/koreader/discussions/13700) | Kindle lets you extend an existing highlight by dragging it; KOReader allows overlapping ones instead. | fetched |
| Kindle | Amazon forum, "highlights merge after software update" | Contiguous highlights merge into one; "popular highlights" are drawn as a dotted underline, not a fill. | snippet (the forum page came back broken) |
| Hypothesis | [Issue #6348](https://github.com/hypothesis/client/issues/6348) | About a bug, not about how nested highlights look. That nested highlights draw darker is snippet only. | fetched, off-topic |
| Web standard | [MDN Highlight.priority](https://developer.mozilla.org/en-US/docs/Web/API/Highlight/priority) | The browser's own highlight API: where two overlap, the higher priority (or the newest) styles the overlap. "The stronger one wins", built in. | fetched |
| Excalidraw | Issue #70 above | Stable seeds per shape. | fetched |
| Qur'an apps | [holy-quran issue #128](https://github.com/Ramahadam/holy-quran/issues/128) | A mus'haf reader marks a bookmarked verse by tinting the background of its verse number only, not the words. | fetched |
| Qur'an apps | Ayah, Bayaan app store pages | Verse highlight during recitation; no nested marks. | snippet |

## 5. Does a doubled or textured mark stay readable?

**Short answer.** Measure the letters *under* the mark, not the mark's colour. With multiply,
black letters stay nearly black under any number of amber passes, so contrast drops slowly. With
plain transparency, or with a second, darker hue, it drops fast. Texture adds a second problem:
the lightest speck of grain or the dry end of a stroke must still read as "marked" against the
paper.

| Source | Takeaway | How read |
| --- | --- | --- |
| [WCAG 1.4.3 contrast (minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) | Text needs 4.5:1 against what it sits on; says nothing precise about which part of a busy background to measure. | fetched |
| [WCAG 1.4.11 non-text contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html) | A sign that something is selected needs 3:1 against what is next to it; the guideline does not require it for every state difference. | fetched |
| [MDN prefers-contrast](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-contrast) | `more` means the reader asked for more contrast; the page turns every texture filter off under it. | fetched |
| Reduced motion | The app already zeroes its wipe under the reduced-motion setting; the page's moving edge refuses to start under it. | the app's own code |

**How the page measures.** For each mark it prints two numbers: the **letters** under the mark
against the **paper** under the same mark, and the mark against bare paper. For a mark inside a
mark it also prints the inner mark against the outer one. Measured this way, today's swipe gives
**7.9:1** for the letters. The earlier options record printed 7.1:1 for the same swipe, because it
measured black letters on the mark's colour without putting the letters under the mark too.
Multiply darkens both, so the true figure is a little higher.

---

## What only the build showed

None of these were in any source above. Each turned up only once the page was drawn and looked at.

1. **Today's passage has a pinch at every verse boundary.** The app draws a passage as one mark
   per verse. Where two verses share a line, their round ends meet end to end and leave a small
   notch of paper between them. It is in the app today. Making each mark "one pass" does not fix
   it; merging the pieces of each line into one band per mark does.
2. **A filter on a level line vanishes in Chromium and WebKit.** Firefox draws it. The cause is
   the default filter area being measured from a box with no height. Setting the area in page
   units fixes it everywhere. Anyone who adds texture to the app's pen will hit this first.
3. **"One more pass" and "the stronger one wins" look the same at two levels.** A verse inside a
   passage measures 1.4:1 against the passage under one rule and 1.5:1 under the other; the
   pictures are nearly identical. They only differ at a third level (a word run inside the verse)
   and in what a verse on its own looks like.
4. **The hole rule only shows at the ends of shared lines,** because the pen already leaves paper
   between lines.
5. **Grain depends on the screen.** On a desk screen at normal size it all but disappears; at
   phone density it reads as a pleasant paper tooth.
6. **Two streaked passes read as a shiny tube,** and the light seams cut across the tails of
   letters.
7. **A drying stroke is palest at the verse's own end,** right where its number is, which is the
   one place a hafiz looks to check where a verse stops.

## What I did not do

- I did not test on a real iPhone. Everything Safari-shaped here is desktop WebKit.
- I did not time filter speed on a phone. The speed warning rests on the GSAP forum thread.
- I did not open Kindle, Apple Books, GoodNotes or Notability myself; what they do rests on the
  sources in section 4, several of them snippet only.
