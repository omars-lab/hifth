---
date: 2026-11-19
repo: hifth
session: sign-in server and the reader's copy of marks
branch: sign-in-server, PR #655
folded: 2026-11-19
---

Folded the same day, at the owner's ask, so a fresh session loops on the skills alone:
the test-file runs (`testing`), the drawn backlog (`issues`), the audit lines, React's `inert`
and comparing finding lists (`native-shell`), the saved copy's script name (`run-app`), the
redraw that returns (`validate`). The first line is held by its own test; the last is the
owner's.

## Snags
- `apps/web/e2e/lazy-tools.spec.ts`: the first check that the preload stand-in stayed out looked for `supports("modulepreload")`, which Vite's own loader also carries, so it would have failed on a good build. Switching the setting back on and watching the test go red is what showed the right tell-tale (`link[rel="modulepreload"]`).
- `apps/web/playwright.config.ts`: the iPhone and Android projects skip lazy-tools, so `--project=iphone` finds no tests. Use `desktop` and `desktop-firefox` for it.
- `docs/backlog.md` is drawn from `docs/issues.json` by `make backlog`; a note typed straight into the page is lost on the next redraw. Edit the register, then redraw.
- `native/HifthUITests/AccessibilityAuditTests.swift`: Apple's accessibility check with every kind at once gave up on a full page ("Audit failed to complete in time") before reporting anything. One kind per call finishes.
- Desktop and phone browsers leave the page drawing's rings and lettering out of their tree, so axe and the aria snapshots never saw what the iPad's screen reader announces. Only Apple's check inside the app found the 23 nameless pictures on page 7.
- `apps/web/src/components/PageSlider.tsx`: the slider's knob was hidden by a style rule and marked hidden from screen readers under a chosen verse's tools, yet the iPad's reader still found a nameless item there, and still did with `inert` on its track and the knob not drawn. It was the range control's own grip, which iPad WebKit lists through `visibility: hidden` and `inert`; only `display: none` on the control cleared it. Chrome and axe never see that grip, so only Apple's check can. Along the way: React 18 silently drops `inert=""`; it needs a value (`inert="true"`), and the browser test caught that the first try did nothing.
- `native/HifthUITests/AccessibilityAuditTests.swift`: the rule meant to let "too small to touch" pass on plain text compared the finding's own kind field with `.hitRegion`, which never matched, so those findings failed every run. It now uses the kind the test asked for. Compare the finding lists of two runs before believing "this passed before".
- `make app-test ONLY=…` does not rebuild the app's web copy, so the first rerun of Apple's check tested the old copy and re-found the fixed fault. Run `make app-web FLAVOUR=public` first; now in the native-shell skill.
- Checking a fix in the browser against the local preview: the page's offline cache kept serving the old build after a rebuild, so the knob looked "still drawn". Compare the loaded script's name with `dist/index.html`, and clear the offline cache before trusting what the page shows.
- `scripts/gate-validation.mjs`: a changed ledger makes the commit's checks fail on a stale guide page, and the fix it named was `make guide`, which serves the page after drawing it and never returns. It now names `make guide-doc`, which only draws.
- A new browser test file (not a new test in an old file) needs `pnpm gate:e2e-runs --write` and its runs file committed, or the commit's checks refuse it.
- The decision-tracking plugin's after-edit hook points at a script that is gone, and prints an error after every edit. That plugin's repo is read-only here, so it is the owner's to fix or switch off.

## Worth copying
- Before cutting features to fit the size cap, look at what the build adds by itself. The class names' trailing line number was 1.6 KB of the start-up download and no reader saw it; the namer that drops it also refuses a build where two files would share a name.
- Committing doc-only changes after a background push finishes, not during it: the commit's checks rebuild the app the push's browser tests are reading.

## Loop pass 1 (2026-11-19, evening; not folded yet)

The first pass of the operational-readiness loop, started from `/loop`.

### Snags
- `.claude/loop-prompts/operational-readiness.md` exists only on `sign-in-server`, not on main, so a session started in the main checkout looked for it and found nothing. It turned up with `git log --all`. It reaches main when #655 merges; until then, start the loop in `../hifth-auth`.
- `.claude/skills/issues/scripts/goal-names-every-row.mjs` read its default files relative to the folder it was run from, so run from the main checkout it stopped on a missing file. It now finds them from where the script sits, with a test that runs it from a temp folder.
- Making a new working copy for a helper agent set git's hooks folder back to the default; the git-settings guard put it back to `.githooks`. Check `git config core.hooksPath` after `git worktree add`.
- Axe's new screen checks all passed the moment they were written, which proves nothing alone. A planted nameless button in the info panel, expected to be caught, is what shows they are really looking.
- `share-a11y.spec.ts` runs only on the iPhone and Android browsers (see `apps/web/e2e/runs.json`), so `--project desktop` on it finds no tests.

### Worth copying
- Apple's accessibility check on the iPhone 17 simulator passed with no change after the iPad fixes: fixing what the iPad's reader heard was enough for the phone too.
