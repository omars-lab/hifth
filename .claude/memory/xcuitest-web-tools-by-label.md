---
name: xcuitest-web-tools-by-label
description: "in the iPad app's XCUITest, the page's tool radios are not radioButtons; find by label; notes persist across test launches (uninstall for a clean run)"
metadata:
  node_type: memory
  type: reference
  originSessionId: e85ea537-5f5b-46cb-add4-971a01406e5a
  modified: 2026-10-11T17:29:31.999Z
---

In `native/HifthUITests/SmokeTests.swift`, `app.webViews.firstMatch.radioButtons` is empty: the
web page's `role=radio` tools (Note, Select…) are not exposed as radio buttons. Find them with
`web.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Note")).firstMatch`.
A note box shows as `web.textViews` (its textarea).

The app keeps its notes between XCUITest launches, so a run that pins a note leaves it for the
next. Start a clean run with `xcrun simctl uninstall <iPad id> com.bytesofpurpose.hifth`. That
leftover pin is how the "note left open stays empty" fault was found (2026-10-11, native-shell ㉙).

Related: [[simulator-walk-approach-confirmed]], [[mac-ui-test-presses-real-keys]].
