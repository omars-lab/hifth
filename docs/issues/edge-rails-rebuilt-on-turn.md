# One more child in the book dropped the lifted corner on every turn

**Found:** 2026-10-10, by the pre-push run of the edge-lift tests, while giving the look-alike
buttons a place beside one page (look-alike rows ⑨).

## What happened

The fix for ⑨ added one child to the book, after the turn rails: a box beside the page that
only draws anything with the book closed to one page. With two pages it drew nothing, yet the
test that lifts a page by its corner and lets go failed every time: the page turned, but the
lifted leaf was gone the moment the page number changed, so it was never laid down flat.

## What the evidence showed

- The app code from before the change passed three times out of three; with it, it failed
  every time.
- Taking out each part of the change in turn narrowed it to the new child. Replacing it with
  an empty `{null}` still failed; moving that empty slot in front of the leaves passed.
- So it was not what the box drew but where it stood. The two leaves carry names (React keys)
  and trade places on every turn, because the live page moves from one side of the opening
  to the other. The rails had no name, so React placed them by position, and with one more
  child after them the rails were rebuilt as the turn landed, losing the lifted corner the
  reader was holding.

## What replaced it

The rails are wrapped in a named fragment (`key="rails"`) and the new box is named too
(`key="slack"`). Named children are matched by name, not by position, so adding or removing
a child in the book can no longer rebuild the rails. The existing edge-lift test is the
check that would fail if it came back; it caught this one.
