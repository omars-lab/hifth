# The public Firefox tests ran on no push

**Found:** 2026-10-11, adding the recitation tests to Firefox. The push's test count did not
move, so the new tests had not run.

## What happened

The checks before each push run a fixed list of browser test projects. The Firefox project for
the public build, added 2026-09-28 for the open book's width and grown since (the tajweed key's
credit line, the highlighter's bands), was never put on that list. So none of its tests ran on
any push, while a memory note kept for these sessions said the Firefox project ran on every
push. Firefox is the owner's browser.

The private build's Firefox run was never affected: it has its own make target, and the push
runs it.

## What the evidence showed

- No make target names the public Firefox project, and the full log of a push on 2026-10-11 has
  no line from it.
- Run by hand on 2026-10-11, all 46 of its tests passed in about 30 s, so nothing had broken
  while it was not running.

## What replaced it

Both Firefox projects are on the push's list now. `scripts/prepush-projects.test.mjs` reads the
Playwright settings and the push's list, and fails when a project is on neither the push's list
nor a short list of projects that run from a make target of their own (the private build's, and
the docs pictures). It failed on the two Firefox projects before the fix.
