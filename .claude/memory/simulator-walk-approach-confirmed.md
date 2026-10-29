---
name: simulator-walk-approach-confirmed
description: "Owner liked walking the pitch inside the real iPad app (simulator) — launch at a verse, turn it, screenshot, measure from inside the page — and wants it kept in the skills as make targets"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e85ea537-5f5b-46cb-add4-971a01406e5a
  modified: 2026-10-08T18:23:03.167Z
---

Walking the pitch **inside the real iPad app in the simulator** — not only Playwright's browsers — is the approach the owner wants (2026-10-08: "i like this approacj"; "make sure thsi simulartor testing is part of our skills"). The loop: `make app-web FLAVOUR=pitch` → launch at a verse → turn the simulator → `simctl io screenshot` + `sips -r` → measure inside the page with `make app-probe TARGET=ipad EVAL=…` → a failing `make app-test ONLY=SmokeTests/<name>` → fix → passes.

**Why:** the iPad's own WebKit lays out differently from Playwright's WebKit. Held sideways, the app drew the two pages as a 28 pt sliver while every Playwright project was green; only the in-app walk found it.

**How to apply:** for any iPad-facing pitch change, walk it in the simulator too, and fold each new step into a make target plus the native-shell skill ("Walking the app in the simulator") and the walk-app checklist, per [[walk-app-growing-checklist]]. Turning the simulator by keystroke steals focus — check Simulator is frontmost (the owner may be in Firefox, see [[owner-uses-firefox]]); prefer `XCUIDevice.shared.orientation` in a test. Measure the web view's own screenshot, not the whole-screen one, when the simulator is turned.
