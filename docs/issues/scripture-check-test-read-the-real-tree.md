# The scripture check's own test counted 510 files where it made 2, but only when committing from a worktree

**2026-09-30.** Committing a design page from a worktree, the pre-commit run of the script tests
failed one test: the check that keeps running scripture out of the source was run on a small
made-up repository of 2 files, and reported 510.

## What the evidence showed

The check lists files by asking git. While a commit is in progress, git hands its hooks the address
of the repository's index (and, in a worktree, its directory) through environment variables, and
every program the hook starts inherits them. In the main checkout that address is relative, so from
inside the made-up repository it pointed at nothing and the test passed by luck. In a worktree it is
absolute, so git, asked about the made-up repository, answered about the real one.

The test passed when run by hand, because nothing was committing. That is why it had not been seen.

## What replaced it

The test helper that runs a check against a made-up tree now strips git's own variables first, and
the test's own git calls do the same. A new test sets the index variable to point at a second
made-up repository holding 3 files, as a commit hook would, and checks the count is still 2. It
failed with 5 before the fix and passes after.

## What else it did

The same leak had a second, quieter effect, from a second test. The test that checks the pitch's
held copy can never be committed sets up its throwaway repository with `git init`. Run from a
push in a worktree, git's directory variable was inherited, so that `init` re-initialised the
**real** repository instead and marked it bare, as if it had no working files. The main
checkout's next git command failed with "this operation must be run in a work tree", and one push
failed half-way through its checks for the same reason. Nothing was lost; the one wrong line,
`bare = true` in the repository's own settings, was set back by hand (twice, 2026-09-30).

That test now runs every git command, its own setup included, without git's variables, and a new
case stands up a second working copy, points the variable at it the way a hook would, and checks
the real repository is not marked bare. It failed before the fix and passes after. No other test
builds a throwaway repository; the scripts that run git against the real one are meant to.
