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

## Worth copying
- Stand-ins for Apple's tools through `HIFTH_SIMCTL` / `HIFTH_DEVICECTL` (as the crash-log puller does) let the whole laptop script be tested first, with no device, and the real simulator run then only confirms it.
- Answering "what am I supposed to check?" with a card on the device, built from the by-hand checks list, instead of a list in chat.
