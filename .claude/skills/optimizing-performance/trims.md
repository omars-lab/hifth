# Trims — the list, and how to take one on

Read by the optimizing-performance skill each time it runs, so this list can change without the
skill changing. Re-run `make perf-report` rather than trusting the sizes here; they are here so the
first candidates are not rediscovered from scratch.

## Where the room goes (2026-09-27, ~149 KB in all, 138 KB in the main script)

| part | size | trim | catch | status |
| --- | --- | --- | --- | --- |
| React's page-drawing library (`react-dom`) | ~42 KB | swap for Preact's compatibility layer (~4 KB) | every component and `@use-gesture` must still behave; needs a full e2e and golden run | **done** 2026-10-03, #PR: start-up script 132.4 → 96.4 KB, time to answer a tap 2554 → 1956 ms; Preact needed React's after-input timing put back (`docs/issues/preact-swap.md`) |
| our components | ~39 KB | load rarely used tools (crop, diff view, settings) when first opened | a short wait the first time; the service worker must cache the extra files for offline | **done** 2026-09-29, #149: start-up script 134.3 → 121.6 KB; the tools come as one 14.6 KB file on first open |
| English **and** Arabic interface text | ~10 KB | load only the reader's language | the language switch must fetch the other one, and offline must still have both | **done** 2026-09-29, #148: start-up script −11 KB; each reader downloads 3.9–5.1 KB less |
| shared logic (`packages/core`) | ~15 KB | little: it is what the first page needs | none | — |
| gesture library | ~9 KB | none worth the risk | none | — |

When a trim lands, set its status to **done**, with the date, the PR and the bytes saved, and
update the sizes from a fresh `make perf-report`.

## Why the size check went up when start-up went down

The size check adds up **every** file we ship, including the ones a reader only fetches later. So
a trim that moves code out of the start-up script shows as the same or slightly more in total
(each extra file carries a little of its own wrapping), even though the first visit downloads
less. Read the per-file lines in the baseline diff, not only the total. After both trims above:
158.3 → 160.3 KB in all, while the start-up script fell to 121.6 KB.

## Taking one on — the checklist

1. **Measure first.** `make build`, then `pnpm gate:budget` and `make perf-report`. Write down the
   total and the part you are trimming.
2. **Write the failing test first.** Usually two: a check on the build output that the moved code
   is no longer in the start-up script, and a Playwright test that the moved thing still opens and
   works (desktop and desktop-firefox). Watch both fail before the change.
3. **Make the change.** Load it later with a dynamic `import()`, or swap the library.
4. **Things to look for** — each of these has bitten a trim somewhere:
   - **A flash or a jump** the first time the moved thing opens. Show nothing, or a quiet
     placeholder of the same size — never a spinner that shifts the page.
   - **Offline.** Every later-loaded file is its own file; the service worker must cache it, or it
     will not open with no connection. Check with the offline tests.
   - **The pitch build.** It must still build, and its private code must still stay out of the
     public build (the size check fails if it leaks).
   - **A saving too small to matter.** Under ~2 KB is rarely worth a new loading path; say so and
     stop.
   - **A tiny shared file.** Two later-loaded files that share a small helper make the build
     ship the helper on its own: one more request before the first paint. The build folds any
     shared file under 2 KB into the main script, and refuses to build if a language file still
     needs one (`docs/issues/one-language-startup-check.md`).
   - **A top-level wait in the main script.** A later-loaded file can import things from the main
     script. If the main script is paused at the top waiting for that file, each waits for the
     other and the page never paints. Load, then draw, from a promise.
   - **Which start-up step you land on.** Start-up time moves in ~150 ms steps (see the sweep in
     the skill); a trim that does not cross a step down saves bytes but not time.
5. **Measure again**, `make budget-update`, read the baseline diff, and put before → after in the
   commit message.
6. **Run `make lighthouse`** on the trim branch, with nothing else running on the machine. The
   size cap stands in for it but is not it: it is how the tiny-file and top-level-wait problems
   above were found. Its five runs split into ~2100 ms and ~2550 ms groups for a reason inside
   the measurement (same issue file); compare against main measured the same way before blaming
   the trim.
