# When two pages are open, do the zoom buttons grow both together?

**Status:** decided — both leaves grow together.
**Decided by:** omar, on 2026-09-01.
**In one line:** with the book open, pressing magnify now enlarges both pages at
once, to the same size. It used to do nothing at all while two pages showed.

This reverses a finding made earlier, on purpose and by the person who made it.
Everything below is why the old answer was reasonable, why it was overturned, and
what the reversal does and does not settle.

## A few words, once

- **Mus'haf** — the printed Qur'an, the thing on screen.
- **Leaf** — one page of it. When two are shown side by side, each is a leaf.
- **The opening** — the two facing leaves seen together, the way a physical book
  falls open. "Open the book" means show two leaves; "close it" means show one.
- **Magnify / the stepper** — the two buttons in the top bar, marked minus and
  plus, that make the page larger or smaller by fixed steps.

## What is being decided?

When the book is open — two leaves side by side — and the reader presses the
magnify button, what should happen? Three answers were on the table: nothing (the
old behaviour); make the reader close to one page first; or grow both leaves
together. The reader chose the third.

## Why is this being asked now?

Because a reader hovered the magnify buttons with two pages open, found them dead,
and the cursor showed the "not allowed" sign. From the reader's chair there was no
sign of *why* they were off — the buttons looked broken, not withheld. The
question "why can't I make this bigger?" is the report that reopened it.

## What did the app do before, and what did it cost?

With two pages open the magnify buttons were switched off entirely. Hovering them
showed a blocked cursor and a tooltip that said, in effect, "magnifying needs one
page — switch to one page first." A reader who wanted a larger page had to first
change a *different* control (the one-page / two-page switch), then magnify, then
switch back if they wanted the opening again. Three actions for one wish, and the
first of the three was invisible until you went looking for it.

That was not an accident. It was the answer to a real observation, recorded when
the magnify buttons were first built.

## What did we already decide that touches this?

One decision, closely: **the wheel navigates, buttons magnify** — the change that
took magnification off the mouse wheel and put it on a pair of buttons. That
decision carried a corollary: *the buttons are off while the book is open.* It
rested on two observations made at the time:

1. Two enlarged pages side by side lose their outer edges off the screen and start
   to read as one tall column of script, which an opening is not — a spread is
   *two* pages, and the gap down the middle is part of what tells you so.
2. At the width where two pages first fit, each leaf is already limited by the
   screen's *height*, not its width — so at that one narrow size, magnifying buys
   very little reading size before the page runs off the top and bottom.

Both were true. This decision does not dispute either. It disputes that they
should *forbid* the reader from magnifying — it makes them the reader's cost to
weigh, not the app's rule to enforce. The earlier record has been marked to point
here, so nobody reads its "disabled while open" section as still current.

## What do other readers and other apps do about this?

I did not survey other mus'haf apps for this specific behaviour before deciding, so
treat this as thin. The one strong reference point is the physical book the app is
imitating: a reader holding a large-print mus'haf does not see one page grow while
the facing page stays small — the whole opening is the same size, because it is one
sheet of paper. "Both leaves at one size" is the behaviour that matches the object.
The reason print does not answer the *edges* worry is that paper has no screen to
run off — a bound book can be as wide as it likes. That is exactly the constraint
observation (1) above is about, and it is why the drawn evidence, not the analogy,
is what the reader weighed.

## The options, and what each costs

**Leave it off (the old answer).** No work, and the two edge-and-height findings
are honoured by construction. The cost is the reported one: a control that reads as
broken, and a three-step detour for anyone who wants a bigger page while keeping
the opening. *Not chosen.*

**Make the reader close to one page first.** Keep magnification a one-page feature,
but when the reader presses magnify on a spread, close the book for them and then
magnify. Cheaper to reason about — one leaf, one size — and it sidesteps the edge
worry entirely. The cost is that it silently overrides the reader's other choice:
they said "show me two pages", and the magnify button would quietly countermand it.
*Not chosen.*

**Grow both leaves together (chosen).** The magnify buttons work with the book
open, and one press enlarges both leaves to the same size. The reader keeps their
opening and gets a larger one. The two pages grow *outward from the fold* — the
gap down the middle stays exactly where it is, and each page opens away from it
into the margin of empty desk on its outer side, the way a real book gets larger.
So a step or two of magnification clips nothing at all: it spends the desk margin
first. Only past that does the outermost edge of the opening begin to leave the
screen, and when it does it leaves symmetrically, both sides at once, which is what
zooming any large picture does. At the narrowest two-page width there is also
little height to spend before the top and bottom run off — that half of the old
finding still holds, and it is the reader's to weigh.

## Why "together" and not "each leaf on its own"?

Because two leaves at two different sizes is the *original* complaint that the
wheel-and-buttons decision was cleaning up in the first place — a book open with
one page big and one page small looks broken in a way neither size explains. The
whole reason this is safe to build is that there is exactly one magnification for
the opening: the live page owns it, and the facing page is told to match whatever
the live one lands at. One number, so there is nothing to fall out of step.

## Does the opening grow from the middle, or from the fold?

This is the part the first build got wrong, and it is worth stating plainly
because it is what a reader sees before they can say whether they like anything
else. The first attempt grew each page from its own centre. Two pages each
swelling from their own middle push *toward* each other: the inner margins meet
and crush the fold — the gap down the middle that tells you it is two pages and
not one — while the outer margins are shoved off both edges of the screen at once.
The reader's words for it were that the middle went weird and the sides were
clipped, and both were the same mistake seen from two ends.

The opening grows from the **fold** instead. The middle of the book is held still
and both pages open outward from it, the way paper does when a book is made
larger — nothing near the fold moves, and the empty desk on the two outer sides is
what gets spent as the pages grow. That is why a normal step or two of
magnification now clips nothing: there is room to grow into before there is
anything to run off. It is the same one magnification for both leaves as before;
only the point they grow *from* changed, from two centres to the single fold they
share.

## What would change the answer?

- If readers report the magnified spread genuinely reads as one column and they
  lose their place in it, the edge finding wins after all, and the fallback is the
  second option — magnify by closing the book. The mechanism to do that already
  exists; only the wiring would change. Growing from the fold was meant to answer
  exactly this worry — the middle gap is preserved, so the two pages stay legibly
  two — but the test is a reader's eye, not the drawing, and this is the thing to
  watch for.
- If the app ever gives the facing page its own controls (a drawer on the opposite
  leaf is already contemplated separately), the "one magnification for the opening"
  rule would need re-examining, because a second surface is a second place a size
  could be set.

## What this is not settling

- **Magnification is still dropped to fit when the opening first appears**, and
  when a shared link or a page-turn lands with the book open. Both leaves start at
  their natural size and the reader grows them from there. Whether magnification
  should instead *survive* a page-turn or a jump inside a spread is a separate
  question, left open.
- **Nothing about a phone.** Below the width where two pages fit, there is no
  opening and no facing leaf; this decision does not exist there.
- **The height finding is not withdrawn.** At the narrowest width where two pages
  first fit, each page is limited by the screen's height, so there magnifying buys
  little before the top and bottom run off. That is real and the reader chose to
  live with it. The *edges* half of the old finding is answered rather than
  accepted: growing from the fold keeps the middle gap and spends the desk margin
  before anything clips, so a modest magnification loses no edges at all. If either
  proves worse in the hand than on the page, this is reopenable on that evidence.
