# The QUL page render needs the QPC V4 font before it can draw readable glyphs

**One issue, one file.** What was tried, what the evidence showed, why the approach changed.

## What the dev diff view is for

`qul-store-purpose` decided the held copy is a *second draughtsman*: draw our own word-by-word
page from the store and stand it beside the shipped print, to check our page is registered right
(the right verse on the right page, line breaks where they should fall). The dev diff view is that
tool.

## The evidence that forced a change of approach

Building the render, the store's word text turned out **not** to be plain Unicode Arabic letters.
The first word of Al-Fatihah — "in the name" — is held as a **single codepoint, U+FC41**, in the
Arabic Presentation-Forms block. That block is a set of standard ligatures, but the value here is
not the standard ligature; it is a **font-private, one-codepoint-per-word** mapping the QPC V4 font
supplies. Read in any other font — a generic Arabic face, or even the openly licensed DigitalKhatt
font the layout itself is named for — the same codepoint draws the *wrong* glyph, not the word.
So a faithful, readable page cannot be drawn without the exact QPC V4 font (QUL resource id 462),
which is not loaded into the store and not cached on this machine.

## What replaced it (for now)

The diff view ships in two layers, and only the second needs the font:

1. **Structure-faithful render — built now, no font.** For each of the page's fifteen lines: which
   verse and which run of words sits on it, whether it is centred, where a surah header falls. Stood
   beside the print page, this already answers the registration question the decision named — you can
   see that a line break falls where it should and that the right verse lands on the page — without a
   single glyph.
2. **Glyph-faithful render — pending the font.** The same lines drawn as the actual words, so the
   page can be eyeballed letter-for-letter against the print. This waits on the QPC V4 font being
   fetched (licence already cleared to hold) and served to the dev view only, gitignored, never
   shipped.

## What would change the answer

The font arriving — cached locally for the dev view (dev-only, gitignored), or loaded into the
store behind the same licence gate the word text passed. Until then the structure layer stands on
its own.

## What happened next (2026-09-08): the font arrived, after one wrong turn

The first file fetched was QUL resource **462, "KFGQPC Nastaleeq"** — the id this record named
above — and it drew every word of page 1 as an unrelated two-letter ligature (lam-khah, lam-meem, …). That
was the evidence the guess above had half of: the codepoints *are* font-private, but the font is
not one file. The print's word font is **one file per page**: page N's words are the run U+FC41,
U+FC42, … and only `pN.ttf` maps that run to N's words; every other page's file maps the same run
to *its* words, and a general text face — which is what the Nastaleeq resource is — maps them to
the Unicode ligatures the block officially holds.

The right resource is QUL **240, "QPC V4 Tajweed Font (Page by Page)"**: a 69 MB zip of 604
files, `p1.ttf` … `p604.ttf` (160 MB unpacked), the tajweed-coloured cut of the same KFGQPC V4
glyphs. It was fetched into the ETL's gitignored cache (`.cache/qul-fonts/qpc-v4-tajweed/`,
sha256 `b29c0282…8f6562`) through the owner's signed-in session, under the licence read recorded
that day in the validation ledger. The plain black cut is not on the library; the Quran
Foundation's own CDN serves it (`static.qurancdn.com/fonts/quran/hafs/v4/ttf/pN.ttf`, 47–150 KB
each), noted here in case the colour ever gets in the way of a comparison. The dev server route
now serves `/dev-fixtures/fonts/pN.ttf` by page number only, and the diff view declares one
`@font-face` per page under a family name that carries the page number.

With the letters in place, pages 1 and 300 were re-checked by eye against the print: every word
on the line the print has it on, every ayah medallion on the right line. The one standing
difference is still the explicit surah-name line the store carries and the print folds into its
frame. **The glyph-faithful layer this record was opened for is built; the record stays as the
trail of why the font is per-page and which resource it is.**
