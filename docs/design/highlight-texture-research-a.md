# How do real highlighters, and the apps that copy them, handle shape, texture and overlap?

*Researcher A's raw findings, 2026-09-30. It feeds [the options page](highlight-texture-options-a.md)
and a later comparison with a second, independent researcher. Every source is listed with what
it says and **how I saw it**:*

- *Fetched* means I opened the page itself and read it.
- *Snippet* means I only saw a line of it in search results, because the page refused to load
  or I never opened it.

*Every claim that rests on a snippet is marked. Nothing here quotes scripture or commentary.*

## The short version

- **A highlighter is a filter over the paper, not a coat on top of it.**
  - Light goes down through the ink, bounces off the paper and comes back up through the ink,
    so a second pass takes away more light. This is why the overlap of two passes goes darker
    and the black letters stay black.
  - The screen's "multiply" blend is the textbook model of this.
  - Plain see-through layering (normal blending) is not. It greys the letters, because it lays
    the colour over the ink too.
- **Letting overlaps go darker is a choice, and the apps split on it.**
  - Zotero's developer and FigJam say the darker overlap is the point: it shows you marked twice.
  - GoodNotes users have been asking since 2018 for the overlap *not* to darken (261 votes).
  - Hypothesis, a web annotator, takes a middle road: nested highlights get a fixed second shade,
    and a third level or deeper adds nothing.
  - Procreate's "glazed" brushes do the same trick within one stroke: one stroke is one shade
    however often it crosses itself, and only a new stroke darkens.
- **A hand-drawn edge is cheap to make ourselves and expensive to import.**

  | Library | Size, compressed | Share of the ~16 KB we have left |
  | --- | --- | --- |
  | Rough.js | 8.9 KB, and trimming it to the parts we would use does not shrink it | over half |
  | perfect-freehand | 2.0 KB | small |
  | rough-notation | 3.8 KB, and it needs Rough.js too | |

  A seeded wobble written by hand is a few hundred bytes. The seed is what matters: without it
  the edge "boils", changing every time the page redraws.
- **Browser filters can make a rough edge or a grain, but they are costly on phones.**
  - They can make a rough edge (noise pushes the edge around) or a grain (noise thins the ink in
    places), and a filtered shape can still be multiplied into the page.
  - Several write-ups say they are slow, worst in Safari, and that very large filtered areas may
    not draw at all there.
  - A filter cannot blend with the page behind it on its own. No major browser ever built that
    part of the standard.
- **Contrast has no rule for two tints stacked, so we measure it ourselves.**
  - The web's contrast guideline asks 4.5:1 for letters on whatever is behind them, and 3:1 for
    the *sign* of a selected state against what is next to it.
  - Every stacked layer is a new background under the letters, so each overlap needs its own
    measurement. The options page measures them all.

## How does highlighter ink actually mix on paper?

| Source | What it says | Seen |
| --- | --- | --- |
| [Colour Literacy: subtractive mixing of transparent colourants](https://colourliteracy.org/subtractive-mixing-transparent) | See-through inks act like stacked filters. Light passes down through each layer, reflects off white paper and passes back up, so each layer takes away more light. This is the physics of a darker overlap. | Fetched |
| [Wikipedia: Highlighter](https://en.wikipedia.org/wiki/Highlighter) | Highlighter ink is vivid, see-through and often fluorescent. Yellow is common partly because it leaves no shadow on a photocopy. | Fetched |
| [MDN: blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/blend-mode) | Multiply is "like two images printed on transparent film overlapping": white changes nothing and black stays black. "Darken" keeps the darker of the two colours in each channel instead. | Fetched |
| [MDN: mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mix-blend-mode) | The property works on SVG elements. `isolation` limits what an element blends with. | Fetched |
| [Sara Soueidan: compositing and blending in CSS](https://www.sarasoueidan.com/blog/compositing-and-blending-in-css/) | A blend mode creates a group, and `isolation: isolate` stops the blend reaching further back. It applies to SVG as well. | Fetched |
| [W3C Compositing and Blending draft](https://drafts.csswg.org/compositing/) | The order is filter, then clip, mask, blend, composite. Multiply is the backdrop times the source. A group is composited first and blended once, and an isolated group sees its backdrop only once. These are the rules that let "same colour never double-darkens" and "the inner mark cuts a hole" be built with plain groups. | Fetched |
| [Whizz-tech: highlighter prints opaque](https://whizz-tech.com/support/printers/notability-goodnotes-highlighter-prints-opaque/) | Overlapping highlighter strokes in note apps can stack their see-through amounts until they print solid, because the apps layer them normally rather than multiplying. Flatten before printing. | Fetched |

## Which blend modes and filter tools does the browser actually have?

| Source | What it says | Seen |
| --- | --- | --- |
| [MDN: feBlend](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feBlend) | Blending inside a filter runs in a different colour space by default. Set `color-interpolation-filters="sRGB"` or the colours shift. | Fetched |
| [MDN: feComposite](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feComposite) | The `in` operator clips one image to another's shape. `arithmetic` mixes two images by a weighted sum, which is how noise can be worked into the ink's strength. | Fetched |
| [MDN: feTurbulence](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feTurbulence) | Makes smooth noise. `seed` makes it repeatable, so the same seed draws the same grain on every visit. | Fetched |
| [Mozilla bug 437554](https://bugzilla.mozilla.org/show_bug.cgi?id=437554) | The standard's way for a filter to read the page behind it is not built in Firefox; the bug has been open for about 18 years. The same holds in Chrome and Safari. So blending with the page must be done with the CSS blend property, not inside a filter. | Fetched |
| [MDN: Highlight.priority](https://developer.mozilla.org/en-US/docs/Web/API/Highlight/priority) | The browser's own text-highlight feature does *not* blend overlapping highlight backgrounds: the higher-priority one simply wins. This is a "top one wins" rule, built in. | Fetched |

## Rough.js, perfect-freehand and rough-notation: what do they give, and what do they cost?

Sizes are measured here, not taken from the projects' pages: I packed each published package,
compressed it with gzip at its highest setting, and checked the Rough.js trim with a bundler.

| Source | What it says | Seen |
| --- | --- | --- |
| [Rough.js repository](https://github.com/rough-stuff/rough) | A hand-drawn look for lines and shapes: "under 9 kB", MIT licence, fill styles from hatching to solid. **Measured: 8,919 bytes compressed** for version 4.6.6. Trimming it to only the shape generator we would call still came to 9,188 bytes, so it does not get smaller. That is 55% of the 16,359 bytes the app's size budget has left. | Fetched, and measured |
| [Rough.js wiki](https://github.com/rough-stuff/rough/wiki) | The settings: `roughness` (default 1), `bowing`, and `seed` from 1 to 2^31, which fixes the wobble so it is the same every time. Also `disableMultiStroke`, since it draws each line twice by default for the sketched look. | Fetched |
| [Excalidraw issue 362](https://github.com/excalidraw/excalidraw/issues/362) | Excalidraw keeps each shape's seed with the shape so its rough edge does not change as you work. This is the "stable wobble" requirement, learned the hard way. | Fetched |
| [perfect-freehand repository](https://github.com/steveruizok/perfect-freehand) | Turns pen points into the *outline* of a stroke whose width changes with pressure or speed, with tapered ends. Settings: `size`, `thinning`, `smoothing`, `streamline`, simulated pressure, and start and end tapers. MIT. **Measured: 2,009 bytes compressed** for version 1.2.3. | Fetched, and measured |
| [rough-notation README](https://github.com/rough-stuff/rough-notation) | Hand-drawn underline, box, circle and *highlight* marks on web text, animated in. Stated as 3.83 KB compressed, and it uses Rough.js. Has a multi-line mode. Draws 2 passes by default. | Fetched (size not measured by me) |
| [rough-notation source, render step](https://github.com/rough-stuff/rough-notation/blob/master/src/render.ts) | Its "highlight" is a thick rough line at about 95% of the text's height, drawn back and forth over the text as several seeded passes. This is the streaked, two-pass look, and it shows a well-used library chose passes over a single band. | Fetched (read through GitHub's API) |

## Can a filter give the marker a rough edge or a grain, and what does it cost on a phone?

| Source | What it says | Seen |
| --- | --- | --- |
| [Smashing Magazine: SVG displacement filtering](https://www.smashingmagazine.com/2021/09/deep-dive-wonderful-world-svg-displacement-filtering/) | How far the displacement filter moves each pixel, and why. Its output is not smoothed again, so pushed edges can look jagged. "SVG Filters can hurt the performance of your site drastically", with Safari and Firefox named as struggling. Use sRGB. | Fetched |
| [SVGator: SVG animation lag in Safari](https://www.svgator.com/help/animation-and-interactivity/how-to-fix-svg-animation-lag-in-safari) | Filters are turned into pixels. Safari is slow with them, and may skip drawing very large filtered elements altogether. | Fetched |
| [Camillo Visini: hand-drawn motion with SVG filters](https://camillovisini.com/coding/simulating-hand-drawn-motion-with-svg-filters) | A "boiling" line made by changing the noise every 100 ms. "Don't let things boil over." This is a warning for us: a highlight that shifts under the letters is noise, not ink. | Fetched |
| [Ben Gammon: rough CSS borders with SVG filters](https://bengammon.co.uk/rough-css-borders-with-svg-filters/) | The same noise-and-displace pair used to rough up box edges. Little detail on settings. | Fetched |
| [pepelsbey: skewed highlight](https://pepelsbey.dev/articles/skewed-highlight/) | A marker look for web text made with gradients alone, one piece per line (`box-decoration-break: clone`). A no-filter route. | Fetched |
| [Codrops: texture with feTurbulence](https://tympanus.net/codrops/2019/02/19/svg-filter-effects-creating-texture-with-feturbulence/) | A tutorial on making paper and grain textures from noise. | **Snippet**: the page returned 403 |
| [CodePen: improving SVG rendering performance](https://codepen.io/tigt/post/improving-svg-rendering-performance) | Performance advice for SVG, filters included. | **Snippet**: 403 |
| Safari and CSS filters (search result; no single page) | Safari is said to handle CSS filter shortcuts well but SVG `<filter>` elements poorly. | **Snippet only.** Not relied on beyond "test on an iPhone" |

## What do other reading and note apps do when two highlights overlap?

| App | What it does | Source | Seen |
| --- | --- | --- | --- |
| **Hypothesis** (web annotation) | Nested highlights are given explicit shades rather than being left to add up. The stylesheet's own comments: the first level is the base colour multiplied at 80% strength on white; the second is that multiplied again at 40%; the **third level and deeper are transparent**, so they add nothing. This is a capped stack. | [client repo, highlights stylesheet](https://github.com/hypothesis/client/blob/main/src/styles/annotator/highlights.scss) | Fetched (read through GitHub's API) |
| **Zotero** (PDF reader) | The developer says overlaps must look darker "to show that", as is standard in PDF readers. The user who asked says the stacked opacity hurts reading. | [forum 110523](https://forums.zotero.org/discussion/110523/overlapping-highlight-annotations-look-darker) | Fetched |
| **GoodNotes** | Users have asked since 2018, with 261 votes, that overlapping highlighter strokes *not* darken. There is no official answer on the thread. | [feedback thread](https://feedback.goodnotes.com/forums/191274-customer-suggestions-for-goodnotes-apple/suggestions/18526903-when-highlighter-overlaps-don-t-darken-the-overla) | Fetched |
| GoodNotes, continued | Help pages about straightening a highlighter stroke by holding the pen down, and about the highlighter sitting behind text. | [support: highlighter tool](https://support.goodnotes.com/hc/en-us/articles/7353718215823-Highlighting-with-the-Highlighter-tool) | **Snippet**: 403 |
| **FigJam** | "Highlights are semi-transparent … To deepen a highlight, draw over it again." Hold Shift to draw straight. Overlap darkening is presented as the feature. | [Figma help](https://help.figma.com/hc/en-us/articles/1500004414442-Doodle-and-highlight-in-FigJam-with-drawing-tools) | Fetched |
| **Procreate** | "Glazed" brushes: one stroke is one shade until the pen lifts, however often it crosses itself; the next stroke darkens. | [Adventures with Art: glazed brushes](https://adventureswithart.com/procreate-glazed-brushes/) | Fetched |
| Procreate, continued | The brush settings include glaze and blend modes, *wet edges* (a darker rim), *burnt edges* (edges that darken where strokes overlap) and grain. | [Procreate handbook: brush studio](https://help.procreate.com/procreate/handbook/5.0/brushes/brush-studio-settings) | Fetched |
| **Notability** | Version 9.2 made the highlighter "more vivid and behind text, making the text pop". | [Mac Observer](https://www.macobserver.com/cool-stuff-found/notability-9-2-update/) | Fetched |
| Notability, continued | An option to go back to the old highlighter layering was offered after complaints. | [Notability on X](https://x.com/NotabilityApp/status/1207421735668076545) | **Snippet** |
| **KOReader** | "Unlike kindle, koreader allows you to highlight the same passage any number of times." | [discussion 13700](https://github.com/koreader/koreader/discussions/13700) | Fetched |
| **Kindle** | Highlights that touch or overlap are merged into one after an update, so there is no double highlight at all. | [Amazon forum: highlights merge](https://www.amazonforum.com/s/question/0D5at00000ZpGQhCAN/highlights-merge-after-software-update) | **Snippet**: the page did not load, and the Amazon help page returned 503 |
| **Apple Books** | **Not verified.** The one page that looked like it described Apple Books merging an overlap "into one, in the new colour" turned out to be another project's own design notes ([rfc-reader 522](https://github.com/Radiergummi/rfc-reader/issues/522)). Apple's own guide did not load. [Apple discussions 254426476](https://discussions.apple.com/thread/254426476) says only that an existing highlight cannot be extended. | | Fetched, but says nothing on overlap |
| **Freeform / Notes** | Freeform appears to have no highlighter tool. | search result | **Snippet** |
| **Ayah** (Qur'an app) | Highlights come in several colours and are grouped by colour. Nothing on overlap. | [App Store](https://apps.apple.com/us/app/ayah-quran-app/id706037876) | Fetched |
| Other Qur'an apps | The earlier options record already surveyed Quran.com, Quran for Android, Tarteel and Ayat. None draws a highlight *inside* another. I found no Qur'an app with overlapping highlights. | [earlier record](highlight-options.md) | — |
| **Miro, Excalidraw** | Not looked at for overlap. Excalidraw was read only for how it keeps a rough edge stable (above). | | Not looked at |
| Print "knockout groups" | In print design, a knockout group makes overlapping objects replace one another rather than double up. | Adobe InDesign help | **Snippet**: 403 |

## What does accessibility ask of a stacked, textured mark?

| Source | What it says | Seen |
| --- | --- | --- |
| [WCAG 2.2 Understanding 1.4.11, non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | The visual sign of a state needs 3:1 against the colours *next to it*. A change of colour alone between two states that never sit side by side is not held to 3:1. Thickness and size count towards being seen. So the amber band is judged against the paper beside it, and a darker band inside a lighter one is judged against the lighter one. | Fetched |
| [MDN: prefers-contrast](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-contrast) | A reader can ask the system for `more` or `less` contrast, or a `custom` setting (tied to forced colours). The app can answer with a firmer edge instead of a stronger wash. | Fetched |
| Reduced motion (the app's own stylesheet) | The app already turns the wipe off for readers who ask for less motion. Any new animation, such as a second pass laid down live, must do the same. | Read in the repository |

## Where does this leave the options?

This section is not research; it lists what the options page has to show because of it.

1. **Multiply stays.** Every source that models real ink lands on it, and it keeps the letters
   black.
2. **The overlap question is a real split, not an oversight.**
   - Whether the overlap darkens as far as the marks add up (Zotero, FigJam), darkens by a fixed,
     capped step (Hypothesis, Procreate's glaze), or never darkens (GoodNotes' requesters, the
     browser's own highlight feature, Kindle's merging) is the choice.
   - Each needs to be drawn on a real overlap.
3. **The rough edge must be seeded and fixed per verse**, and made by us, not imported.
4. **A filter texture has to be seen at phone size before anyone argues for it**, and tested on
   an iPhone before it ships.

## What I did not manage to see

- Apple Books' overlap behaviour.
- Kindle's merge (seen only as a snippet).
- GoodNotes' own help pages (403).
- Miro.
- Any Qur'an app that nests one highlight inside another.

If the second researcher found these, that settles them. If not, they stay unverified.
