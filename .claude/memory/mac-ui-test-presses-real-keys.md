---
name: mac-ui-test-presses-real-keys
description: "the Mac XCUITest (make app-test-mac-ui, testPageMenuTurnsThePage) types on the laptop's real keyboard; never run it while the owner is at the machine"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e85ea537-5f5b-46cb-add4-971a01406e5a
  modified: 2026-10-10T05:32:21.222Z
---

The Mac app's UI test `testPageMenuTurnsThePage` (run by `make app-test-mac-ui`; it is `#if os(macOS)`, so `make app-test ONLY=…` on the iPad simulator runs 0 tests) drives the real Mac: it fronts the app and sends key presses through the laptop's own keyboard input, so it lands in whatever the owner is typing in.

**Why:** the owner works on this laptop while sessions run; a test that types into their windows is worse than a skipped check. Seen 2026-10-10 during the real-app walk after the list fixes; the walk was recorded as done without it.

**How to apply:** check the Mac app by picture instead (`make app-shot TARGET=mac …`, `make app-walk`), and say in the record that the Page-menu test was not run and why. Run it only if the owner says they are away from the machine. Related: [[simulator-walk-approach-confirmed]], [[walk-app-growing-checklist]].
