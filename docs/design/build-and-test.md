# What slows down or trips up building and checking the app?

**Short version:** five things got in the way while building features in November 2026. None
changes the app a reader sees. Each is small, and each will trip the next session the same
way until it is fixed once, in the tool or the skill it belongs to.

**What it changes for a hafiz:** nothing directly. It is how fast and how safely the rest gets
built.

## Open questions, and what would answer each

### ① Can a new browser test be skipped without anyone noticing? · **open**

Yes, today. The laptop and Firefox runs each read a hand-kept list of test files. A new test
file left off the lists is not run there, and nothing says so. It happened twice in one week
(the pencil tests, then the page icons), caught both times only by reading the run's count.

**What would close it:** a check, run before a commit, that every browser test file is on a
list or is named as left out on purpose, with a test of that check.

### ② Does a push say straight away when it cannot run the browser tests? · **answered**

Yes, since 2026-11-11. The first thing a push now does is look at the two ports the browser
tests serve the app on. If something is there, it stops within a second and says which port,
which program holds it, and the command that stops it.

Before, a server left over from an earlier look let the push run for minutes and then fail in
a way that read like a broken test.

Tried for real: with a preview server left on the port, the push checks stopped at once with
the message; with it stopped, they went on.

### ③ Does the Firefox test of grabbing the page's edge fail on its own some of the time? · **open**

Yes, now and then, with no change to the code it tests. A push then has to be run again, which
costs about 13 minutes.

**What would close it:** find what it waits on that is not always ready, fix the wait, and run
it twenty times in a row clean.

### ④ Can the bottom of the app be pressed on the dev server at phone width? · **open**

Not until the comment tool is hidden. The comment tool's bar sits in the bottom corner of the
dev server's pages, and on a narrow window it covers a bottom row of icons
([app-pages.md](app-pages.md) ②). The comment tool is not ours to restyle from here; it comes
from the owner's plugin collection.

**What would close it:** the bar moves, shrinks or folds at phone width (a change in the
plugin), or our skills say to press Hide before a phone-width look.

### ⑤ Do the skills say the three things that each cost a wrong turn? · **open**

No. Each is known now and written only in a session note:

- The local preview keeps serving the old build after a rebuild until its saved copy is
  cleared, so a change looks like it did not land.
- In a walk script, a made-up Escape key does not close the info panel. Its own close button
  does.
- The speed probe is switched on for the laptop's dev server with a setting no command or
  skill names; the only named command builds it for a phone.

**What would close it:** one line each in the skill a session would be reading at the time
(running the app, walking the app, measuring speed).
