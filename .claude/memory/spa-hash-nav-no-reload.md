---
name: spa-hash-nav-no-reload
description: "Navigating the dev app to a hash-only URL does not reload the SPA — the DOM keeps the old bundle even after a Vite restart; force location.reload() before concluding a change \"did not render\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-01T23:47:36.435Z
---

When verifying a UI change on `localhost:5173`, navigating the tab to `http://localhost:5173/#/...`
(a hash-only change) does **not** reload the document. The React tree keeps running the old
module graph. Restarting Vite and clearing `node_modules/.vite` does not help either, because
the browser never re-fetches the entry. The served source can be verified new (fetch the module
and grep it) while the DOM is still old.

**Why:** In this session the finished page-bar redesign (30 juz detents, page-icon handle) read as
"not rendering" for several turns — the DOM had zero detents while the served `PageSlider.tsx`
already contained them. One `location.reload()` showed everything. See also
[[desktop-zoom-strictmode-orphan]] for the sibling trap: a fault that shows only under the dev
server's StrictMode double-mount (5173) and not in the built app (4173).

**How to apply:** After editing, force a real reload (JS `location.reload()` or navigate to a
different path and back) before reading the DOM. If something reproduces on 5173 and not 4173,
say it is dev-only. Rebuild `dist` before e2e and free port 4173 first. The `run-app` skill
carries the recipe.
