---
name: owner-uses-firefox
description: "the owner walks the demo in Firefox; layout bugs Chrome hides show up there — Playwright's pinned Firefox is installed and a desktop-firefox project runs on push"
metadata:
  node_type: memory
  type: user
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-28T17:01:00.034Z
---

The owner browses the demo in Firefox. On 2026-09-28 a "weird state" report (blank leaves on the spread) turned out to be a Firefox-only bug. Firefox treats a leaf's percentage height as indefinite unless the book's height is stated, so it sized each leaf a third narrower. Chrome never showed it.

**Why:** a bug the owner sees but Chrome can't reproduce is likely a browser-engine difference.
**How to apply:** when a report doesn't reproduce in Chrome, try Firefox first. Playwright's own Firefox (v1532) is installed. The `desktop-firefox` project in apps/web/playwright.config.ts runs only spread-fit.spec.ts; add a spec to its testMatch when a layout check should hold in both browsers. See [[spa-hash-nav-no-reload]].
