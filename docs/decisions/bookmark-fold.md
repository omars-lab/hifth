# A bookmark you drop by tapping the fold: is it one ribbon or many, and where is it kept?

The desktop triage asked for a bookmark a reader drops by tapping the corner of a page where
it turns — a ribbon that unrolls down the leaf, the way a printed mus'haf's silk marker does.
Before that gesture can be built, two things have to be decided that the animation itself does
not settle: **how many bookmarks a reader can hold at once**, and **where a bookmark is kept
so that tapping the fold still means something a week later.**

It is drawn on a real page, at the size a phone would show it, so the argument is about a
picture anyone can open:

- **The picture, on the site:** <https://blog.bytesofpurpose.com/hifth/docs/design/bookmark-fold-options.html>
- **The same page, checked in:** [`docs/design/bookmark-fold-options.html`](../design/bookmark-fold-options.html), rebuilt by [`scripts/build-bookmark-fold-options.mjs`](../../scripts/build-bookmark-fold-options.mjs) from page 7's shipped outline and the app's design tokens.

## A few words, defined once

- **A bookmark** — a place a reader deliberately marks to come back to, the way a silk ribbon
  hangs from a spot in a printed mus'haf.
- **The fold** — the corner band of a page that appears mid-turn, where the leaf lifts and
  creases. The gesture under discussion drops a bookmark by tapping there.
- **Your place** — where the reader currently is in the book. The app already keeps this; it is
  not the same as a bookmark, because it moves every time you turn a page and you never chose it.
- **Durable storage** — the phone's own private store that survives closing the app and
  reloading. It is not a backup: the phone's system can still clear it after about a week of
  the app going unopened, and a lost phone takes it.
- **The address** — the text in the browser's location bar that names the page you are on. The
  app already writes your place into it, so a copied link reopens the book where you left it.

## What is being decided?

Two questions, in order.

1. **Is a bookmark one ribbon that moves, or many the reader drops and lifts?** — a single mark
   that jumps to wherever you last tapped, or a set the reader adds to and removes from.
2. **Where is a bookmark kept, so tapping the fold still means something next week?** — in the
   address only, in the phone's durable store, or in a store that can also be carried off the
   phone.

## Why is this being asked now?

The gesture was asked for directly in the desktop triage — tap the fold, a ribbon unrolls. But
a gesture that drops a thing has to say what the thing *is* and where it goes, or the first tap
after a reader reopens the app finds nothing there. The animation is the easy half and it is
already drawn; the half that has to be decided before any of it is built is what the tap
persists and how many of them a reader is allowed to hold.

## What happens if nobody decides?

Nothing is blocked behind this — a reader can navigate the whole book today without a single
bookmark, because the app already keeps your place for you as you turn. The cost of leaving it
open is only that the triage item stays open: there is no bookmark gesture, so no reader misses
one they had. But if the gesture is built against the wrong answer here — a single ribbon when
readers wanted several, or a mark kept only in the address when readers expected it to survive
closing the app — the cost is a feature that quietly loses what people trusted it to keep, which
is worse than not having built it.

## What does the app do today, and what is it costing?

**There are no bookmarks today.** The corner fold is only an animation — the band that appears
for a fraction of a second while a page turns — and nothing responds to a tap on it. What the
app *does* keep is your place: every time you turn or jump, it writes where you are into the
address, so closing and reopening the book, or sharing the link, lands you back on the same
page.

That is the whole of the durable state a reader has, and it has one honest weakness the
bookmark question inherits: your place lives in the address and nowhere else. Open the app cold
with no address — a fresh tab, a cleared history — and it starts at the beginning, because there
was nothing to read your place *from*. The one store the app keeps that survives a cold open at
all is its private record of which pages you have opened, and that store is itself fragile: the
phone can evict it after about a week of the app going unused. So the status quo this decision
inherits is the leanest possible answer to the second question — *keep it in the address* — and
its cost is exactly that a bookmark kept there does not survive a reader who closes the tab.

## What do people outside this project do about this?

**A fresh external scan was not done for this page.** The printed reference is the strongest and
it is worth stating plainly: a physical mus'haf usually has one ribbon, sometimes two or three
sewn into the binding — a small, fixed number, each a single silk you move rather than a list you
grow. That is evidence about what readers of *this* book are used to, and it weighs toward the
first question's simpler answers, not its unlimited one. But print has no cold open and no
storage to evict, so it says nothing about the second question — where a digital bookmark is
kept is a problem the ribbon never had. How comparable reading apps persist a bookmark across a
cleared browser, and whether they expect an account to do it, is the relevant prior art for that
half and is owed a proper look before it is settled.

## What have we already decided that touches this?

- **Nothing leaves the phone unless it is in the reader's interest and under their control** —
  the stance the app is sharpening from a flat "nothing leaves the phone". The third storage
  option here, one that can be carried off the phone, is only allowed as a deliberate act under
  that stance, never an automatic upload.
- **A private record stays private by construction** — the revision record's privacy is a gate,
  not a good intention. A bookmark is a lighter thing than a record of where your memory slips,
  but if it is ever carried off the phone it passes through the same gate.
- **Your place is written into the address** — this is how the app already lets a reader reopen
  or share the book at the right page. The first storage option below is that same mechanism,
  named honestly as the status quo rather than a new idea.
- **A reader's authored notes have their own open persistence decision** — the
  [notes-export decision](notes-export.md) asks how a batch of authored notes survives a cleared
  phone and leaves it. A bookmark is a much smaller thing to keep, but the second question here
  is the same question at a lower stakes, and the two should answer it consistently.

## Is a bookmark one ribbon that moves, or many the reader drops and lifts?

Each option below is drawn on the picture linked at the top, on a real page at phone size, so
you can see how many ribbons a leaf carries before you choose.

- **A — One ribbon that moves.** Tapping the fold picks the ribbon up and drops it here; there
  is only ever one. The closest thing to the printed silk marker, and the simplest to hold in
  your head — there is no list to manage, and no question of which bookmark you meant. Its cost
  is that a reader keeping two places at once — a sūrah they are memorising and a page they are
  revising — cannot, and has to choose.
- **B — Many the reader drops and lifts.** Each tap of the fold adds a ribbon; tapping a ribbon
  lifts it off. A reader holds as many places as they like. It matches how a reader with several
  threads actually works, but it is a set to manage — which means a way to see them all, name
  them apart, and remove the ones that are stale, none of which the single ribbon needs.
- **C — Both: one that follows you, several you pin.** Your place is always marked by one ribbon
  that moves as you read, and tapping the fold pins an *additional*, permanent one. This is the
  richest, and it is also two concepts a reader has to tell apart on sight — the ribbon that
  moves on its own versus the ones they placed — which is the thing most likely to confuse.

## Where is a bookmark kept, so tapping the fold still means something next week?

The same three ribbons, now asked where they live between visits. This is the question the
status quo answers with its one weak point, so the options run from that point outward.

- **A — In the address only** *(what the status quo would give)*. The bookmark is the page you
  are on, carried in the location bar — no new storage at all, and a link you can share or
  save in the browser's own bookmarks. But a bookmark that lives only in the address is gone
  the moment the reader closes the tab without saving it, which is exactly the cold-open gap the
  app has today.
- **B — In the phone's durable store** *(the leaner lasting answer)*. The bookmark is kept in
  the app's own private store, beside the record of pages you have opened — so it survives
  closing the app and reopening it cold, with no address needed. It sends nothing anywhere. Its
  one caveat is the one that store already carries: the phone can clear it after about a week of
  the app going unopened, so a bookmark is durable but not permanent, and the reader should be
  told so rather than surprised.
- **C — In a store that can be carried off the phone.** The durable store of option B, plus a
  deliberate way to carry the bookmarks off — a saved file today, a synced copy the day a phone
  app and an account exist. The only option that survives a lost phone, and the only one that
  crosses the privacy gate, so it is off by default and drawn for the far edge of the space.

## What else could we consider, and why is it not here?

- **A bookmark that is a range, not a point** — "I am memorising these ten pages", marked as a
  span rather than a single spot. A richer idea, and a different gesture than tapping one fold;
  left for its own decision if the single-point bookmark proves too blunt.
- **Auto-bookmarking every session's last page.** The app already does the useful half of this
  by keeping your place; a separate automatic bookmark on top would compete with the deliberate
  one and blur what a tap means. Left off.
- **Naming or colouring bookmarks.** Only matters once there are several (the first question's
  option B or C), and it is a refinement of managing them, not a separate storage answer. Folded
  into whichever multi-bookmark option wins, if one does.
- **Bookmarks that sync with the confusion map or the notes.** Tempting to keep every private
  reader record in one place, but a bookmark is chosen and those are recorded or authored, and
  merging their storage would hide that difference. Kept as a sibling that links.

## What would change the answer?

- A reader saying they keep several places at once — a memorising thread and a revision thread —
  which weighs the first question toward many ribbons over one.
- The notes-export decision landing on a durable phone store or a carried-off file — this one
  would follow it for the second question, so a reader's bookmarks and notes persist the same way.
- The offline store's eviction proving to bite readers in practice, which weighs the second
  question toward the carried-off option C over the phone-only B.
- A phone app with accounts arriving, which is what unblocks the synced half of option C.

## What is this not settling?

- The animation itself — how the ribbon unrolls, how fast, what it looks like reduced-motion.
  That is drawn on the page as one motion, but the shape of it is not what this decides; the tap
  and the persistence are.
- Exactly how long the phone keeps a bookmark before eviction, or the saved file's name and
  shape. Tuning, not the decision.
- Whether a bookmark can be a range rather than a point. A separate, larger question, noted above.
- Any sharing of bookmarks between two people. Every option here is a reader marking their own
  places; showing them to someone else is a different decision about identity and consent.

## So what is being decided?

Two things, and the gesture waits on both: **how many bookmarks a reader holds** — one ribbon
that moves, many they drop and lift, or both — and **where a bookmark is kept** — in the address
only, in the phone's durable store, or in a store that can be carried off the phone. The tap on
the fold is drawn and not in question; what it persists, and how much of it, is.
