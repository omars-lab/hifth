---
date: 2026-11-12
repo: hifth
session: check card (walk capture session)
branch: check-card
folded: no
---

## Snags
- `native-shell` skill: on the iOS 26.5 iPad simulator, text styled `.secondary` (or `Color.secondary`) inside a ScrollView over a `.regularMaterial` card is not drawn at all, though the accessibility tree has it. `Color.gray` draws. Look at a cropped picture of any new native panel, not only the UI test's pass.
- `make app-unit-test`: the last "Executed 0 tests" line is XCTest's count and reads like nothing ran; the Swift Testing suites report as `Suite "…" passed after` / `failed after`. Grep for those.
- UI tests that open a `hifth://` link with `XCUIDevice.shared.system.open` get iOS's "Open in Hifth?" prompt from the springboard; tap its Open button if it appears, or the test waits on a card that never comes.
- `check-card.mjs`: iOS cuts a link that opens the app at 2,048 characters, and the cut step silently vanishes (12 sent, 9 on the card). Only a real, long ledger row showed it; the made-up test lists were short. Any new link built from long text needs a length cap and a test with a long made-up list.
- `native/Makefile.native`: calling `xcodebuild` directly (for a Release build no target covers yet) fails with "redefinition of module" in Apple's own headers, because the shell's `CPATH` points at the Mac SDK. The makefile `unexport`s it; a direct call needs `env -u CPATH`. The iPad Release build compiled once that was cleared.
- `apps/web/e2e/desktop.spec.ts`, the chips-between-rows test: it failed once in the full push run and passed on retry. The cause was real (the verse's drawer measured itself once, while still short) and could not be made to happen by slowing the CPU. A test that holds the drawer short with a style, then lets it grow, made it happen every time. When a flaky run's picture shows the cause, force that state rather than trying to reproduce the timing.
- `scripts/gate-issues.mjs`: a backlog row whose source named no item failed with "has no undefined row". It now says to add the item. Every row needs `source.item`, even when the source is a design page.

## Worth copying
- Stand-ins for Apple's tools through `HIFTH_SIMCTL` / `HIFTH_DEVICECTL` (as the crash-log puller does) let the whole laptop script be tested first, with no device, and the real simulator run then only confirms it.
- Answering "what am I supposed to check?" with a card on the device, built from the by-hand checks list, instead of a list in chat.
