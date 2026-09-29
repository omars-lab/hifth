# The app's tap shapes register well against the store's words — the residue is ayah boundaries, not misplacement

**One issue, one file.** What follow-up ⑳ asked, what the whole-book sweep found, and how to read a count that looks alarming and is not.

## What this checked

The app does two things with a page: it *shows* it, and it answers a *tap* on it with an ayah.
Follow-up ⑲ checks the first — our print against the held store's page, drawn in the print's own
per-page font. Nothing checked the second. Each ayah's tappable shape was drawn from the print's
own ink, ayah by ayah, and the only test that a shape encloses exactly its own words had been a
person's eye.

The store gives a second opinion at the word. It says which words make up each line and each ayah;
once those words are drawn in the print's per-page font at the print's geometry (the pipeline
follow-up ⑲ built), every word has a **measured box**. So: lay the app's tappable ayah shapes over
the store's page and, per page, count every word whose box centre falls **outside** its own ayah's
shape or **inside a neighbour's**. Then sweep all 604 pages by tool, the way the highlight sweep in
follow-up ⑩ replaced page-by-page looking.

The sweep is `apps/web/scripts/qul-tap-sweep.mjs`. It reuses the exact workbench module
(`apps/web/src/qul-diff/storePage.ts`) inside a headless browser — the word boxes are the browser's
own justified right-to-left layout, and only it lays the per-page glyph font out — and calls the
pure, DOM-free classifier that the workbench's "Where a tap lands" panel already uses. Its output is
text-free (page numbers, `s:a`/`s:a:p` addresses, box coordinates, counts) and is committed beside
this record as `qul-tap-sweep.json`.

## What it found

Across **83,196** store words on 604 pages:

| | words | share |
|---|---|---|
| tap their **own** ayah's shape | 80,157 | 96.3% |
| land in a **neighbour** ayah's shape | 2,992 | 3.6% |
| land **outside every** shape | 47 | 0.06% |

67 pages are perfectly clean; 537 carry at least one flag. That "537 flagged" number is the one that
looks alarming and is not — it is what forced a look rather than a report.

**The flags concentrate at ayah boundaries, and their count per page tracks how many boundaries the
page has.** The worst twelve pages are all short-surah pages where ayahs are one to three words
(page 585, Sūrat ʿAbasa: 131 neighbour flags of 167 words; then 446, 453, 584, 452, 376…). A page of
long prose ayahs carries about one flag; a page of many tiny ayahs carries a hundred. That is the
signature of **boundary straddle**, not of misplacement: where an ayah ends and the next begins *on
the same line*, the store's justification and the app's tap-shape edge disagree about which side of
the split a word sits — by about one word's width, sub-word scale. Two independent justifications of
the same line always disagree there by a hair, and the flag is that hair.

**Vertical registration is excellent everywhere: no word lands on the wrong line.** The disagreement
is never "this ayah's shape is one line too high"; it is only ever "the boundary word on a shared
line belongs to the left ayah or the right one." That is exactly the thing the tap shapes get right.

## Verified three ways, because a count cannot be trusted

1. **Against the browser's own hit-test.** The classifier's own-shape verdict was cross-checked
   against native `isPointInFill` on 738 words across the flagged pages — **zero disagreements**. The
   count is not a parser bug.
2. **By structure.** Of 3,039 findings, 1,933 are horizontal (the word's own shape covers its line
   but the box centre crosses the split) and 1,106 vertical-ish at unpaired pages — all consistent
   with boundary straddle, none with a shape on the wrong region.
3. **By eye** — the discipline that a match-rate cannot replace. Three pages were rendered with the
   store's glyphs, the translucent tap shapes, and a dot on every flagged word, and read: page 585
   (short ayahs, dots sit exactly on the vertical ayah-splits, text registered line-for-line), page
   367 (boundary straddles plus one real store-overflow blob at the far left of line 5), page 3
   (clean — the single flag is one boundary word at the 5→6 split). The renders carry the store's
   held letters and so are **not** committed; they were shown to the owner.

## The only potentially-actionable residue: 47 words outside every shape

On 22 pages. They split into two harmless classes, neither a misregistered tap shape:

- **15 words past the left column edge** (14 of them on page 77 and the other overflow pages): the
  store's *own* justification pushes a word past the column margin, so its centre is off the page,
  not in a gap the app left. A store-layout artifact on a dense line.
- **32 words in the sliver between two adjacent shapes**: the same boundary straddle as the
  neighbour class, landing in the hairline dead space *between* two tap shapes rather than inside
  one. Page 555 (63:8→63:9) is the only page where a whole line's run lands this way.

None of the 47 is a reader tapping an ayah and being told a wrong one; they are words the store
draws where no shape claims them, at boundaries and margins. If anything here is ever worth acting
on it is page 367's line-5 overflow and page 555's run — single pages, looked at by eye, not a class.

## The confidence caveat: 18 "placed by fit" pages

On 18 pages the number of print rows and the number of store lines do not match, so the store's
lines are placed by fitting rather than paired one-to-one (a surah header or basmala the store
carries explicitly and the print folds into its frame throws the count off). Their per-page flags
are lower-confidence and are marked `paired: false` in the evidence. They are not excluded — they
are flagged so a reader weights them less.

## How to reproduce

```
# dev server up on 5199, all 604 fixtures pulled (packages/etl/scripts/qul-page-fixtures-all.mjs)
node apps/web/scripts/qul-tap-sweep.mjs --base http://localhost:5199 --out <path>
```

The fixtures and the per-page font are gitignored held copy; the sweep's output is not.

## What would change the answer

A word landing on the **wrong line** (a vertical miss), or a neighbour-flag count that does *not*
scale with a page's ayah-boundary count — either would mean a tap shape genuinely off its ayah, and
neither appears.

The tighter test named here has now been run, and its evidence is committed beside this record as
`qul-print-tap-sweep.json` (generator: `apps/web/scripts/qul-print-tap-sweep.mjs`, which touches no
held copy — only the app's own committed word boxes and tap shapes). It removes the store entirely:
instead of the store's re-justified words it lays the app's **own** print word boxes — the ones the
app already ships — over the same tap shapes, so the only two things left to disagree are the app's
own ink-traced ayah polygon and its own word-box layout, with no foreign justification. Across all
604 pages **99.56%** of 91,451 print words tap their own ayah; **0.41%** (379) land in a neighbour
and **0.02%** (20) outside — a residue roughly **eight times smaller** than the store sweep's 3.6%,
and concentrated the same way, at ayah boundaries. It shrinks by removing one justification and does
not vanish, because the polygon and the word boxes are still two readings of the same print that
part by a hair where an ayah ends mid-line.

That leftover residue is **directional**, which is what a boundary artifact looks like: of the 379
neighbour words, 345 land in the immediately **preceding** ayah, **none** in the following one, and
not one lands on the wrong line — the only disagreement is which side of a shared-line split a
boundary word sits on. None is the first word of its ayah; they are interior words on a line their
ayah shares with the one before it. That bias is a property of the app's own registration — its word
boxes against its ink-traced shapes — not of the store, and it is where to look first if the
boundary residue ever needs to be driven to zero. Until then the tap shapes stand: **the app answers
a tap with the right ayah, page after page.**
