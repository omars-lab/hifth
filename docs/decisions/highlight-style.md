# The highlight over an ayah: what shape should it be, and how strong?

The app marks the ayah you are on. A reader has asked to change how that mark looks — a box
or a fill, and how see-through it is. This record is what that request turns into once it
meets what the app already draws and what it has already settled: not one question but two,
and neither of them is quite "box or fill".

It is drawn on real ayahs of a real page, at the size a reader reads them, so the argument is
about a picture anyone can open:

- **The picture, on the site:** <https://blog.bytesofpurpose.com/hifth/docs/design/highlight-style-options.html>
- **The same page, checked in:** [`docs/design/highlight-style-options.html`](../design/highlight-style-options.html), rebuilt by [`scripts/build-highlight-style-options.mjs`](../../scripts/build-highlight-style-options.mjs) from page 7's shipped word boxes, its outlined print, and the app's own mark colours.

## A few words, defined once

- **The mark** — the highlight the app lays over the ayah you have selected, so you can see
  which one you are on.
- **The swipe** — what that mark is today: a round-capped band drawn along each line of the
  ayah, blended into the print like a felt-tip marker rather than sitting on top of it.
- **A fill** — a soft translucent wash filling a line, the words still readable through it.
- **An outline** — a thin frame drawn around a line, with nothing laid over the words at all.
- **Per line** — every one of these is drawn once for each line the ayah occupies, not as a
  single shape around the whole run. This is not a choice on the table; it is settled.
- **Strength** — how strong the mark is: how dark the swipe, how opaque the fill.

## What is being decided?

Two questions, and they are not independent — the answer to the first changes how much the
second is worth.

1. **Does a reader choose the highlight's shape, and among which?** — everyone keeps the one
   swipe; or the reader picks between the swipe and a fill; or between the swipe, a fill and
   an outline.
2. **Does a reader tune the mark's strength, or is it fixed as it is today?** — fixed for
   everyone; one strength control; or a few named steps.

## Why is this being asked now?

A reader asked for it directly, in the desktop triage: let me change the highlight — box or
fill, and how see-through. It is worth taking seriously rather than dismissing, because the
mark is the single most-seen piece of colour in the app and a reader who finds it wrong finds
it wrong on every page. It is also worth saying plainly that this is a *preference* request,
not a defect: the mark works. So the reader is allowed to hear "not yet", and this record is
built to let them.

## What happens if nobody decides?

Nothing breaks and nothing else is blocked. Every reader keeps today's swipe, which is a mark
this project already tuned to survive over the print at reading size. The cost of leaving it
open is only that the one reader who asked keeps a mark they find too heavy, with no way to
lighten it — a real cost to that reader, and a small one to the app. There is no measurement
waiting on this and no feature stacked behind it.

## What does the app do today, and what is it costing?

The mark is a **marker swipe**: for each line of the selected ayah, a round-capped amber band
is drawn along the line and blended into the print, covering about seven-tenths of the line's
height and leaving the rest clear so that stacked lines still read as separate passes. It is
not a box, not a fill, not an outline — it is ink. Its colour is the app's amber at full
strength; a lighter version of the same pen marks a whole passage you have dragged across.

None of this is a setting. There is exactly one mark, the same for every reader, and no stored
preference anywhere controls how a highlight looks. The one thing that changes marks at all is
the beta tajweed colouring, which is a different feature and is itself deliberately not
remembered between visits.

What it costs is visible in the drawn page, and it is worth naming because a paragraph would
have hidden it: at the app's real strength, a translucent **fill is markedly fainter than the
swipe**. That is not a flaw in the drawing — it is why the app chose a swipe in the first
place. So "let me switch to a fill" is, at today's strengths, a request for a *quieter* mark,
which ties the shape question to the strength one.

## What do people outside this project do about this?

**A fresh external scan was not done for this page.** The printed tradition is the reference
worth stating: a mus'haf marks with ink and with marginal ornament, per line, and it does not
offer the reader a choice of highlight — there is one house style, set by the printer. That is
evidence that a single, consistent mark is a defensible answer, not that customisation is
wrong for a screen, where a reader genuinely can have a preference a page of print cannot
honour. How other reading apps handle a highlight-appearance setting — whether they offer one
at all, and whether readers use it — is the prior art that would actually settle question one,
and it has not been gathered here.

## What have we already decided that touches this?

- **A mark is drawn per line, never as one box around the whole run** — settled when the app
  decided [what the panel shows around an ayah](comparison-crop.md). Two independent traditions
  do it the same way, for the same reason: a single box swallows the lines above and below. So
  a whole-ayah box is not one of the shapes on this page. It would reopen that decision, which
  makes it a bigger question than this one — it is noted below as considered-and-excluded, not
  offered as an option.
- **Nothing solid goes over the ink; a wash stays translucent** — the same decision. It is why
  the fill option here is drawn translucent, and why an opaque fill is not a candidate: it
  would bury the words the mark exists to point at.
- **A strength control has already been floated once** — the [tajweed-colours decision](tajweed-colours.md)
  set aside "one strength slider and nothing else" as "quite possibly what is actually being
  asked for", to build if that decision landed a certain way. This record is the second time
  the same idea has surfaced, now for the selection mark rather than the tajweed wash, which is
  a reason to treat the strength question as the more likely of the two to be worth building.

## Does a reader choose the highlight's shape, and among which?

Each shape is drawn on the picture linked at the top, on the same one-line and three-line ayah,
at reading size — because the shapes read differently across lines, and a fill or an outline
repeated down a long ayah is a different thing from one over a single line.

- **A — One house style, no choice** *(the status quo)*. Every reader gets the swipe. Nothing
  to set, nothing to learn, and the mark means the same thing on every phone and in every
  screenshot a reader shows a teacher. Its cost is the reader who finds the swipe too heavy and
  has no way to lighten it.
- **B — A choice of two: the swipe or a fill.** The reader picks between today's swipe and a
  translucent fill. Both keep the words readable. This is the smallest real answer to the
  request, and it pairs naturally with a strength control, since the fill is the shape with room
  to be turned up. Its cost is a second treatment to draw, test and keep honest across single
  and multi-line ayahs, for a choice some readers never open.
- **C — A choice of three: swipe, fill, or outline.** The full menu, including an outline that
  puts nothing over the words at all — the gentlest possible mark, and the one a reader bothered
  by any wash would reach for. Its cost is three treatments to maintain, and an outline repeated
  around every line of a long ayah can read busier than the thing it marks.

## Does a reader tune the mark's strength, or is it fixed?

The same swipe and fill are drawn at their extremes on the page, so the range is visible. The
swipe today is already at full ink, so a control mostly makes it *fainter*; the fill has room in
both directions. This is the question that overlaps a preference already recorded once.

- **A — Fixed, as it is today.** The strength is chosen once, for everyone, and never moves.
  The app already tuned it to survive over the print; a fixed strength is one less thing that
  can be set wrong. Its cost is that the most common complaint about any mark — too loud, or too
  faint — has no answer but "that is how it is".
- **B — One strength control.** A single slider from faint to firm and nothing else. Cheap, and
  quite possibly the whole of what is being asked for, since most objections to a mark are about
  how loud it is rather than its shape. Its cost is a setting to store, a floor so a reader
  cannot make the mark vanish, and a way back to the default.
- **C — A few named steps.** Not a continuous slider but three — light, medium, firm — with the
  middle at today's strength and the ends safe by construction. Its cost is that three steps is a
  guess at the right granularity, and a reader who wants the gap between two of them cannot have
  it.

## What else could we consider, and why is it not here?

- **A box around the whole multi-line ayah.** The literal reading of "box vs fill" — and it is
  excluded, not offered, because per-line is already settled and a whole-run box reopens that
  decision. If a reader truly wants it, that is a bigger page than this one.
- **An opaque fill.** Ruled out by the same earlier decision that keeps a wash translucent: an
  opaque fill buries the words. Drawn faint-to-firm here, but never to fully solid.
- **A choice of colour, not just shape and strength.** A different request — the palette is the
  tajweed decision's subject, and mixing a free colour picker into the selection mark would
  collide with the meaning those colours carry. Left off deliberately.
- **Per-ayah styling** — a different mark for corrections than for the ayah you are on. That is
  the mistake-marking decision's territory (what a mark *means*), not this one (how the plain
  selection mark *looks*).

## What would change the answer?

- A second or third reader asking for the same thing — which turns a one-reader preference into
  a pattern and weighs toward offering at least the strength control.
- The tajweed-colours decision landing on its option that builds the strength slider — after
  which a strength control for the selection mark is a small addition rather than a new idea.
- A report that the swipe is genuinely unreadable for someone — a low-vision reader, or a
  particular device — which would move this from preference to accessibility and change who the
  decision is for.

## What is this not settling?

- What a mark *means* — a correction versus a comment versus the ayah you are on. That is the
  mistake-marking decision; this one is only about how the plain selection highlight looks.
- The tajweed colouring, its palette, or whether it is remembered between visits. A separate
  feature with its own decision.
- The exact strength values, the slider's floor, or the names of any steps. Tuning, settled
  when a shape and a strength answer are chosen, not before.
- Whether any of this is built at all. "One house style, fixed" — the pair of status-quo
  options — is a complete and defensible answer to both questions.

## So what is being decided?

Two things: **whether a reader can change the highlight's shape**, and among the swipe, a fill,
and an outline — never a whole-ayah box, which is already ruled out; and **whether a reader can
tune its strength**, or it stays fixed as today. The shapes and strengths are drawn on real
ayahs so the choice is made from the picture. The honest recommendation the page carries, for
whoever decides: if anything is built, the cheaper and more-asked-for half is the strength
control, and the swipe-or-fill pair is the shape choice that pairs with it.
