# The local site's old folder could not be deleted while Finder was writing into it

*2026-11-14, found while building the side bar for the local copy of hifth.app.*

## What happened

`make hifth-app-serve` rebuilds the release folder (`apps/landing/dist/`) from scratch each time.
It deletes the old folder first. On 2026-11-14 that delete started failing with "directory not
empty" on `apps/landing/dist/read`, and the local site would not come up.

Something kept writing a `.DS_Store` file into the folder while it was being emptied. Finder writes
one into any folder a window has open. The delete removed the files, then found a new one when it
went to remove the folder itself.

## What was tried

- **Retrying the delete** (Node's `rmSync` with `maxRetries`). A stand-in for Finder, another
  program writing into the folder in a loop, beat it 20 times out of 20. Waiting longer doesn't
  help, because the writer never stops while the window is open.

## What replaced it

The old folder is first **moved aside** into a fresh folder in the system's temporary area, which
is one rename and finishes at once whatever is being written inside. Then the moved copy is deleted.
If that delete fails, nothing is lost: the new build already has a clean folder, and the temporary
area is cleared by the system. A rename that fails (it should not, on one disk) falls back to the
old retrying delete.

The code is `clearAway()` in `.claude/skills/deploy-site/scripts/release-hifth-app.mjs`. Its test,
in the same folder's `release-hifth-app.test.mjs`, starts a second program writing into the old
folder while the folder is rebuilt. It failed with the old delete and passes with the move.

## Why it matters past this one folder

Any script here that deletes a folder a person might have open in Finder can hit the same thing.
Move it aside first, then delete it.
