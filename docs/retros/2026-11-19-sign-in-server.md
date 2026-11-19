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
- The decision-tracking plugin's after-edit hook points at a script that is gone, and prints an error after every edit. That plugin's repo is read-only here, so it is the owner's to fix or switch off.

## Worth copying
- Before cutting features to fit the size cap, look at what the build adds by itself. The class names' trailing line number was 1.6 KB of the start-up download and no reader saw it; the namer that drops it also refuses a build where two files would share a name.
- Committing doc-only changes after a background push finishes, not during it: the commit's checks rebuild the app the push's browser tests are reading.
