# When the word drawer would cover the word, where should it go?

**Decided: B**, by Omar, 2026-09-26. When the tapped word sits where the drawer would cover it, the
drawer stands at the top of the window, just under the tool bar; otherwise it stays at the bottom.
Chosen over the recommendation (C): keeping the tapped word and its full-size copies in sight was worth
more than the lines at the top it hides. A stays as the drawer's usual place; C's short row was never
built into the app, so there is nothing of it to delete.

Asked 2026-09-26. The live page: [where the word drawer stands](https://blog.bytesofpurpose.com/hifth/docs/design/word-drawer-placement-options.html)
([checked-in copy](../design/word-drawer-placement-options.html), rebuilt by `node scripts/build-word-drawer-placement.mjs`).

## What is being decided?

In Word mode a tap on a word opens its parts (the whole word, each vowel-sign, each letter) in a drawer
at the bottom of the window. That drawer is tall, so on a computer it covers the page's last lines, and
the tapped word too when it sits on the bottom line. This decides where the drawer stands.

**For a hafiz:** a slip on a vowel-sign is noted from the drawer; if it covers the word, the verse around
it, where the hafiz checks what they recited, is out of sight while they pick.

## Why now?

The word's parts were just moved from beside the word into the verse drawer's place at the bottom
(selection-drawer = D). Building it showed the cost: the verse's drawer is short and sits over the bar
under the page; the word's holds enlarged copies of the word and reaches up over the page.

## What happens if nobody decides?

A stays, as built. Nothing breaks.

## What does the app do today, and what does it cost?

A. Measured on the live page with the fullest word on page 7's last line: the drawer is 253 pixels tall,
and hides 35 words on 3 lines on a 1440 by 900 window, 44 words on 4 lines on 1280 by 720, the tapped
word among them each time.

## What do others do?

We did not look for this page.

## What already constrains it?

- selection-drawer = D: one drawer, from the bottom, on every screen.
- harakah-pick = D: the word's parts are enlarged copies of the print, one per sign and one per letter.

## The options

Each is built live on the page, on the real page 7, in a window the size of a real screen; it counts the
words each hides for any word tapped.

- **A · Keep it at the bottom.** One place, nothing more to build. Hides the last three lines, and the
  tapped word when it is low.
- **B · Top when the word is low.** Keeps the tapped word in sight. But at the top there is no bar for the
  drawer to sit over, so it hides the page's first six lines, twice what A hides, and it has two homes.
- **C · One short row.** Signs and letters behind two tabs, copies 34 pixels tall with their names
  beside them. 108 pixels tall, about the bar's own height: on page 7's last line it hides no words on
  either screen. Costs smaller copies of each sign and one tap to reach the letters; harakah-pick chose
  its picker at the larger size.

**Recommended: C.** Before the build B looked best; measured, it hides more of the page than A, and C
hides none while keeping one place.

## What else could be considered?

- Slide the page up under the drawer so the tapped line clears it. Left out: the page moving under the
  hand is its own surprise and fights the page-turn gestures.
- A side panel on a computer, or back beside the word: both ruled out by selection-drawer = D.

## What would change the answer?

A hafiz who finds the small copies hard to pick points away from C; one who finds the drawer's jump to
the top confusing points away from B.

## What is this not settling?

What the drawer holds or how a part is picked, only where it stands; and phones, where Word mode's tool
bar does not yet appear.
