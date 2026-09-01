---
name: juz-jump-leaf-alignment
description: "Why a juz jump could flash the two desktop leaves at different heights, and the one-line fix"
metadata:
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-01T17:53:16.966Z
---

On the desktop two-page spread, a jump to another juz (or any non-adjacent
relocation) could flash the two leaves at **different heights** for one frame —
the reported "sometimes things aren't aligned after a juz jump."

**Root cause.** A juz jump is a *hop*, not a page turn: it runs the live stage's
`navigateTo`, which reveals the incoming page (`setCurrentPage` → `display:block`)
and only *frames* it afterwards, inside an `await`ed tween. A freshly mounted host
wears no transform, so for the one paint before the tween's first frame the
incoming page sat at its leaf's top-left — one centring offset (~9px) above the
facing leaf beside it. On a fast machine that is a single frame; on a real one the
incoming ~170KB SVG's parse stalls the correcting frame long enough to see and
screenshot. (The page-*turn* path, `crossFade`, never had this — it applies the
transform synchronously and forces a reflow *before* revealing: the "arrive
already wearing your transform" rule.)

**Fix.** One line in `navigateTo`: call `centerCurrent()` right after
`setCurrentPage`, so the incoming leaf arrives centred before the tween can yield.
A zoom-1 hop then simply rests there; a closer hop (an ayah hop) tweens out from
fit, which is the correct motion anyway.

**Guard.** `desktop.spec.ts` → "a juz jump keeps the two leaves level through
every frame" polls both leaves' top edges every frame across the settle and fails
if any frame caught them >1.5px apart (proven to bite without the fix). Note the
e2e gotcha: `vite preview` serves the pre-built `dist/`, so **rebuild (`pnpm
build`) after every source edit** or the test runs stale bytes. See
[[desktop-edge-grab-turn]], [[hifth-app-identity]].
