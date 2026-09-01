---
name: desktop-zoom-strictmode-orphan
description: "Zoom broken on desktop spread" (one leaf grows, one stays) was a dev-only React StrictMode orphan host, not a prod bug
metadata:
  type: project
---

The desktop-spread "zooming is broken / don't see full pages on zoom" report reproduced
**only in the dev server** (`pnpm dev`, port 5173), never in the production build (`vite
preview`, 4173). Cause: React StrictMode's dev double-invoke mounts → tears down → remounts
against the *same* layer. `PageStage`'s teardown effect cleared the page Map but did **not**
`host.remove()`, so the first mount's host lingered as an orphan `<div>` outside the Map. Zoom
transforms only the Map's host (`applyTransform` reads `pagesRef.get(currentPage)`), so the
orphan twin sat un-magnified under the one that grew — reading as "one leaf zooms, one doesn't."

Fix (in `apps/web/src/components/PageStage.tsx`): teardown now removes each host from the
layer; `mountPage` re-reads the Map after its last await and yields to a rival that already
landed the page. Guarded by a StrictMode regression test in `PageStage.budget.test.tsx`
(confirmed it fails `-2/+1` on original code). Production was never affected — StrictMode is a
dev-only wrapper — but the dev server is what a developer previews in. See also the cold-link
blank-leaf reveal fix in the same file (showPage/navigateTo reveal unconditionally).
