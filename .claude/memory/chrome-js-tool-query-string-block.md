---
name: chrome-js-tool-query-string-block
description: "Chrome javascript_tool returns \"[BLOCKED: Cookie/query string data]\" when the page URL has a ?query; return void 0 instead of a string"
metadata: 
  node_type: memory
  type: reference
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-11T18:22:29.431Z
---

When the Chrome `javascript_tool` runs on a page whose URL carries a query string —
e.g. a design page opened with a cache-buster like `?v=committed1` — a string return
value comes back redacted as `[BLOCKED: Cookie/query string data]`, even when the string
itself contains nothing sensitive. The code still **executes**; only the returned value
is filtered.

Workarounds:
- End the snippet with `void 0;` (or any expression evaluating to `undefined`) so there is
  no string to redact. Side effects (e.g. `openPanel(7)`) still run.
- Or navigate to the bare URL (no `?query`) before reading a value back — but that risks a
  stale cached bundle on the http-server.
- The comma operator still runs the action: `(openPanel(2), "…")` opens the panel before the
  return is blocked, so a blocked return does not mean the call failed.

Seen while screenshotting `docs/design/harakah-pick-options.html` served from the local
http-server on 127.0.0.1:8791 with `?v=N` cache-busters. Verify the effect with a
screenshot rather than trusting the (blocked) return. Related: [[spa-hash-nav-no-reload]].
