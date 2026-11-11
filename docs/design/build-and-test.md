# What slows down or trips up building and checking the app?

**Short version:** five things got in the way while building features in November 2026. None
changes the app a reader sees. Each is small, and each will trip the next session the same
way until it is fixed once, in the tool or the skill it belongs to.

**What it changes for a hafiz:** nothing directly. It is how fast and how safely the rest gets
built.

## Open questions, and what would answer each

### ① Can a new browser test be skipped without anyone noticing? · **answered**

Not any more (2026-11-11). It could: the laptop and Firefox runs each read a hand-kept list of
test files, and a new file left off the lists was not run there, with nothing to say so. It
happened twice in one week (the pencil tests, then the page icons).

Now a checked-in record, `apps/web/e2e/runs.json`, says which runs pick up each test file. A
check before every commit asks the test runner itself and refuses any difference: a new file,
a file dropped from a run, a file added to one, a file no run picks up. For a new file it
prints the runs it is in and the runs it is not in. Accepting what it prints is one command
(`pnpm gate:e2e-runs --write`), and the changed record then shows in the commit.

What it does not judge: whether a file *should* be in a run. Today 33 files run on the two
phones only, and the record takes that as it stands.

### ② Does a push say straight away when it cannot run the browser tests? · **answered**

Yes, since 2026-11-11. The first thing a push now does is look at the two ports the browser
tests serve the app on. If something is there, it stops within a second and says which port,
which program holds it, and the command that stops it.

Before, a server left over from an earlier look let the push run for minutes and then fail in
a way that read like a broken test.

Tried for real: with a preview server left on the port, the push checks stopped at once with
the message; with it stopped, they went on.

### ③ Does the Firefox test of grabbing the page's edge fail on its own some of the time? · **answered**

Not since 2026-11-11. It was a real fault in the app, not only an impatient test. The strip
you grab copies its rounded corners from the paper, and it sometimes measured the paper a
moment before the left page had been told it was the left page. It then kept the wrong, square
corner until the next turn.

The strip now measures again whenever a page is added or changes side. That also fixed a
second fault found on the way: a page whose drawing arrived more than two seconds late kept a
square strip.

Tried for real: the test and a new one for the late page ran 25 times each in Firefox with no
failure. The full account is in
[the issue note](../issues/edge-strip-measured-before-the-leaf-knew-its-side.md).

### ④ Can the bottom of the app be pressed on the dev server at phone width? · **open**

Not until the comment tool is hidden. The comment tool's bar sits in the bottom corner of the
dev server's pages, and on a narrow window it covers a bottom row of icons
([app-pages.md](app-pages.md) ②). The comment tool is not ours to restyle from here; it comes
from the owner's plugin collection.

**Half done, 2026-11-11:** measured at 390 wide, the bar lies over the slider and all three
page icons, and after Hide the small tab it leaves still lies over the last icon and the end
of the slider. So the run-app skill now says to use the preview, which never has the bar, or
to take the bar off the page for the look. A session is no longer caught out.

**What would close it:** the bar moves, shrinks or folds at phone width, and remembers being
hidden across a reload. Both are changes in the plugin.

### ⑤ Do the skills say the three things that each cost a wrong turn? · **answered**

Yes, since 2026-11-11. Each has a line in the skill a session would be reading at the time:

- The local preview keeps serving the old build after a rebuild until its saved copy is
  cleared, so a change looks like it did not land. Now in the run-app skill, with the line
  that clears it.
- In a walk script, a made-up Escape key does not close the info panel. Its own close button
  does. Now in the walk-app skill.
- The speed probe is switched on for the laptop's dev server with a setting no command named;
  the only named command builds it for a phone. Now in the optimizing-performance skill.
