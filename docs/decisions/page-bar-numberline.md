# The page bar — can it read out its own landmarks, like a ruler under your finger?

*Status: decided — option B, the fisheye, chosen by the owner on 22 September 2026, and shipped behind a setting the reader can turn off. This record states the question, draws all three options on the real bar, and records the choice. The two that lost stay drawn, because they are the reason the choice was a choice, and the reopening test below is what would bring them back.*

**The picture — and a thing you can move:** <https://blog.bytesofpurpose.com/hifth/docs/design/page-bar-numberline-options.html> — `page-bar-numberline-options.html`, checked in and rebuilt by `scripts/build-page-bar-numberline-options.mjs` from the vendored print's page-of-every-verse table, the juz table, and the bar's own stylesheet. Move the pointer across the bar and switch between the three options and the two devices; the address is the page's own on the app's site, so it is public the day the page is merged.

The difference between these options is *felt* — a bar that spreads apart under a moving pointer, a panel that hovers while you scrub — so the page does not describe them, it runs them: each option is the real, shipped spread and swell functions inlined from the same compiled source the app runs, driven over the real thirty juz openings, not a mock. The rule you pick by hand on the page is the one that ships: the winner graduates into the bar and the losers stay drawn, kept here and on the page by the [`graduation-losers`](./graduation-losers.md) decision (option A), so the next reader can still feel what each one did.

## A few words, defined once

- **The page bar** — the control along the bottom of the app that scrubs through all 604 pages of the print. Dragging it moves the book; letting go opens the page under the thumb.
- **Juz** — one of the thirty roughly equal parts the book is divided into for reading it over a month. A juz begins at a fixed verse, and in this print juz 1 opens on page 1 and each next juz opens roughly twenty pages on.
- **Marker** — the short green tick drawn on the bar at the page a juz begins on. Thirty of them.
- **Fisheye** — the way a camera fisheye lens bulges the middle: here, the bar spreading its marks apart under the pointer to make room, and drawing them back together at the edges.

## What is being decided?

The bar already grows a juz marker as the pointer nears it — a magnifying swell, decided and shipped ([`juz-detents`](./page-bar.md#when-a-reader-lets-go-near-a-marker-should-the-bar-pull-the-page-onto-it), option C). What it has never shown is a **number**. To learn *which* juz a mark is, you hover it for a tooltip or drag the thumb for the pop-up. The question is: **can the bar itself read out its landmarks — the juz around your finger, and the page under it — like a ruler, without a second surface and without a drag?**

## Why is this being asked now?

Watching a hafiz scrub the bar hunting for juz 18 — swelling marks, none of them named, counting ticks by hand. The bar was redesigned to carry thirty landmarks and then left mute. Task #130 opened to chase a suspected overflow in the bar; the overflow turned out to be a phantom (nothing was mis-drawn), which left the real question standing: the marks are fine, they just cannot be *read*.

## What happens if nobody decides?

Nothing breaks. The bar works today as option A — marks that swell but stay unnamed — and every juz is still reachable three exact ways (the wheel with Shift, a cell of the revision map, the jump box). The cost of leaving it is only that the landmark you can *see* you still cannot *read* without a hover or a drag. Nothing else is blocked behind it.

## What does the app do today, and what is it costing?

Option A, drawn on the page at both widths. Read off the bar's own stylesheet, five pages sit about seven pixels apart on a desktop track and about two on a phone. So the marks are dense — thirty of them across the bar — and none carries a number. On a phone there is no hover at all, so the marks sit at their plain size and a landmark costs a drag. The cost is not a defect; it is a mute control.

## What do people outside this project do about this?

The reference point is the printed mus'haf, which names the juz in the running head of every page — an **always-on** printed label, no pointer needed, because paper has no pointer and no hover. That convention is evidence about readers (they steer by juz number), not about implementations: a screen bar 604 pages wide cannot print thirty juz numbers at once without them smearing into each other, as the drawn option A shows. A web search for how other mus'haf apps let you scrub to a juz found list-and-jump menus, not a bar that reads out its landmarks in place; none was seen doing this, so there was no answer to copy. Looked, found no transferable answer.

## What have we already decided that touches this?

- **The marker swell** ([`juz-detents`](./page-bar.md#when-a-reader-lets-go-near-a-marker-should-the-bar-pull-the-page-onto-it), option C) — a marker grows as the pointer nears it, and this ships underneath all three options here. The fisheye adds a *position* spread and *names* on top of a swell that is already there; it does not replace it.
- **Desktop versus phone** ([`desktop-vs-mobile`](./desktop-vs-mobile.md)) — the living rule that the app may behave differently on a wide window only when there is a reason to. The fisheye is a pointer gesture: it needs a hover, which a phone has no way to make, so on a phone it parks over the current page rather than sweeping. That is the constraint that shaped option B, not a free choice.
- **What happens to the losers** ([`graduation-losers`](./graduation-losers.md), option A) — the two that lost stay drawn on the page, not deleted.

## The options, each drawn live on the real bar

- **A · today** — magnifying juz marks, no numbers. The number line is felt, never read; a landmark costs a hover or a drag. This is the thing to beat, and it is what the setting falls back to when the reader turns the fisheye off.
- **B · the fisheye** — a Dock-style lens that *spreads the bar apart* under the pointer. The marks near the finger do not just swell — they slide apart to make room, so the juz around you name themselves and the exact page you are on sits beneath, where the track was too tight for a label a moment before. Flat everywhere else, no second surface. **Chosen.**
- **C · the loupe** — a magnifier panel that floats *above* the pointer, like a jeweller's loupe on a ruler. It gives the forty-odd pages under your finger a fixed, generous strip, so juz numbers and a page-every-five ruler read cleanly — at the cost of a panel hovering over the mus'haf while you scrub. The most literal answer to "zoom into a piece of it".

## What building it taught — the surprises no upfront list had a row for

- **Page-every-five cannot be read in the bar itself.** Five pages are about seven pixels apart on a desktop track and two on a phone, and even the fisheye — which really does slide the marks apart — cannot open that enough; the numbers still touch. This is why **B names the juz and the single page you are on, and leaves the full page ruler to the loupe.** It was the first thing the render killed.
- **The phone is where a zoom is needed most and an in-place one helps least.** The narrower the bar, the more juz fall under a lens of any fixed width — a dozen on a phone — and a fixed strip spread apart cannot hold a dozen two-digit numbers. So B names the juz by *page distance* from the finger (the two or three right under it), not by pixels. The loupe has no such trouble, because its width is its own.
- **The loupe is the only option that reads the same on both devices**, because it does not borrow the bar's width — at the cost of the one thing a still picture *does* show plainly: a panel over the page.

## What else was considered, and why it is not a live option here

**An always-on printed ruler** — juz numbers standing over every mark, all the time, no pointer needed, the way paper does it. Option A's own render is why it is out: thirty marks on a phone bar are a picket about seven pixels apart, and a number over each would be a solid smear. Always-on can afford a very coarse scale (a number every fifty pages) but not the juz-by-juz reading the question asks for, so it is not drawn as its own option.

## What would change the answer?

- **A real phone in hand.** Everything about the phone above is arithmetic on a 390-pixel window. Whether a hafiz scrubbing with a thumb wants the loupe's panel over the page or would rather it stay out of the way is the one thing these pictures cannot settle.
- **Much more width** — a tablet or a desktop laid edge to edge would let the in-place fisheye carry page numbers too, and would make the loupe's second surface look like more than it buys.
- **A hizb layer** — sixty landmarks instead of thirty would tighten the bar further and push harder toward the loupe's own-width panel.

## What is this not settling?

- **The phone verdict.** B ships as the default because it is the quieter of the two — no surface over the page — and the setting exists exactly so that call can be revisited on a real phone without another round of drawing, not because the loupe was ruled out.
- **A running page ruler.** B names *the page you are on*, not a page-every-five ruler. If the loupe is later wanted for the full ruler on wide screens, that is a new option on a new page, not a reopening of this one.
- **A touch read-out.** What the bar should read out under a *dragging thumb* on a phone — as opposed to a hovering pointer — is a follow-up, deferred with the phone verdict above.

## So what was decided?

On 22 September 2026, by the owner: **B, the fisheye** — the bar spreads apart under the pointer, names the juz around you and the exact page beneath, with no second surface — and it ships **behind a setting the reader can turn off**, whose off state is option A, today's bar. It is a quiet addition, not a change anyone is made to take. What would reopen it is written above: a real phone in hand, far more width, or a hizb layer.
