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
