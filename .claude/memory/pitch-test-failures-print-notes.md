---
name: pitch-test-failures-print-notes
description: a pitch e2e assertion on a note's innerText (toMatch / not.toMatch) prints the whole note on failure; assert on counts with a message instead, and grep logs without "Received string"
metadata:
  type: feedback
---

A Playwright `expect(text).not.toMatch(re)` on a note's text dumps the whole held note as
"Received string" when it fails, and grepping that log line printed held commentary into the
conversation (2026-10-15, the stray-space test). Write such checks as counts:
`expect(text.match(re)?.length ?? 0, "what it counts").toBe(0)`, and when reading a pitch log,
grep only `Error:`, `Expected:`, `Received:` and the summary, never `Received string`.

**Why:** the no-held-text rule covers the conversation too ([[no-held-text-in-pr-bodies]]); a failing test is exactly when nobody is watching what it prints.
**How to apply:** every new pitch assertion on note text uses a count; fix an old one when you touch it (the curly-quotes test was converted the same day).
