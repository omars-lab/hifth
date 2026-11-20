# Larger text: on the iPhone, the boxes grew and the words did not

Backlog row: `a11y-larger-text`. Found 2026-11-20 on the iPhone SE simulator.

## What we tried

The rough build of larger text grows the bars and the panels with one style setting on each part (CSS
`zoom`). In the test browsers that made the buttons and their words about 1.5 times bigger, and
the browser test passed.

## What the simulator showed

With the iPhone SE at its largest text size, the panels got taller and the gaps got wider, but the
words were the same size as before. A reader with weak eyes got more empty space, not bigger words.

A small test page, opened in the simulator's Safari, settled why:

| text inside a 1.5× part | height |
| --- | --- |
| no other rule | 28 px (grew) |
| with "keep text at 100%" | 19 px (did not grow) |
| with that rule set back to automatic | 28 px (grew) |
| outside the part | 19 px |

The app sets "keep text at 100%" for the whole page (the top of `global.css`), so iPhone Safari
doesn't enlarge text when the phone turns sideways. On iPhone Safari that rule also stops a grown
part from growing its words. The test browsers ignore it, which is why the test passed.

## What changed

The grown parts set that rule back to automatic. It is one line, only for a reader who picked a
way, so the app as it is does not change. The browser test now measures the words as well as the
box. It cannot see this fault, because its browsers grow the words either way, so the walk
checklist now has the simulator step.

## What it showed next

With the words really growing, two faults showed that the empty space had hidden:

- the info button is pushed off the right edge of the top bar, even at 1.25 times;
- the verse drawer covers the chosen verse at 1.5 times, and the whole page at 2 times.

Both come before the owner is asked to choose a way. Both were fixed the same day, each with a
browser test that went red first:

- **Top bar.** At 1.25 times the SE has the room of a 300 px screen. On small phones the grown
  bar now hides the tagline and the mus'haf name, as the app already does on narrower screens.
  The test checks English too, because the test browsers start in Arabic and the Arabic row is
  the shorter one.
- **Drawer.** With no tool open, the drawer sits in the bottom bar's room, which the page already
  keeps clear, so it never told the page where its top was. Grown 1.5 times, it stands 68 px
  taller than that room and covered the verse by 26 px. In the larger-text build it now always
  tells the page its top, and it counts its own growth: a grown part's height in code is its
  height before growing, so the code multiplies by the growth.

## What to remember

A size change on the iPhone has to be looked at on the iPhone. The test browsers are not iPhone
Safari, and here they agreed with the code when the phone did not. Open each new build on a fresh
address, too. The app's offline copy kept serving the old build on the same port, and showed a
"new version is ready" banner over the first pictures.
