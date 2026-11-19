---
date: 2026-11-19
repo: hifth
session: sign-in server and the reader's copy of marks
branch: sign-in-server, PR #655
folded: no
---

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
- A new browser test file (not a new test in an old file) needs `pnpm gate:e2e-runs --write` and its runs file committed, or the commit's checks refuse it.
- The decision-tracking plugin's after-edit hook points at a script that is gone, and prints an error after every edit. That plugin's repo is read-only here, so it is the owner's to fix or switch off.

## Worth copying
- Before cutting features to fit the size cap, look at what the build adds by itself. The class names' trailing line number was 1.6 KB of the start-up download and no reader saw it; the namer that drops it also refuses a build where two files would share a name.
- Committing doc-only changes after a background push finishes, not during it: the commit's checks rebuild the app the push's browser tests are reading.
