---
date: 2026-11-13
repo: hifth
session: capture link (feature-links step 3)
branch: capture-link
folded: no
---

## Snags
- `native/HifthUITests/SmokeTests.swift`: the only way to point the app's captures at a folder a test can read was `HIFTH_WALK_CAPTURE_AT_START`, which also takes a capture at launch. A link test needed a folder-only switch (`HIFTH_WALK_CAPTURE_FOLDER`); add one alongside any "do X at start" test switch from the outset.
- `make issues` / `make use-cases` do not re-render every page the fast checks compare: `use-cases-doc`, `issues-doc` and `tasks-doc` each had to be run after a gate named them. One make target that re-renders every register page would save three round trips.
- `docs/design/app-url-scheme.openapi.json`: a new link action has to be added in five places (paths, error codes, examples, the "only these exist" note, the web builder). The examples running in both the Swift and the web test is what caught the builder; keep that.

## Worth copying
- Sending the real `hifth://` link to the simulator from a UI test (`XCUIDevice.shared.system.open`, then pressing "Open" if iOS asks) proved the whole path, waiting for the page included, in about a minute.
