# Research — Mobile SVG mushaf PWA: constraints & best practices

**Date:** 2026-07-20
**Method:** deep-research workflow `wf_a42db314-202` — 5 search angles, 22 sources fetched,
108 claims extracted, top 25 adversarially verified (3-vote, need 2/3 to survive).
Result: 22 confirmed, 3 refuted. This document is the frozen record; re-verify storage
policy numbers before public beta (they are volatile).

## One-paragraph verdict

A 604-page interactive-SVG mushaf PWA is feasible within 2026 browser constraints, but
only with strict rendering discipline. A single inline Madani page (hundreds of per-ayah
polygons + glyph paths) can alone approach Lighthouse's DOM-node warning thresholds, so
only the current and adjacent pages should be live in the DOM, and highlight toggles must
be scoped to avoid INP-degrading style/layout storms. `@use-gesture` is the current
best-practice way to run pinch-zoom and drag-to-highlight on the same surface, given
correct `touch-action` CSS. Storage quota is **not** the binding constraint (~60% of disk
on modern Safari and Chromium); eviction is — mitigated by Home-Screen install +
`navigator.storage.persist()`. Notably, no leading production Quran app renders inline SVG
pages (quran_android uses raster pages + a glyph-bounds DB; quran.com uses per-page QCF
fonts), so inline interactive SVG is the road less traveled and must be perf-proven early.

## Confirmed findings (→ binding design rules)

### 1. DOM node budget is the primary rendering constraint
Lighthouse heuristics: a page warns above **800 nodes**, is flagged excessive above
**1,400**. One inline Madani page with hundreds of polygons plus glyph paths can plausibly
approach this alone; mounting many pages inline certainly exceeds it. DOM mutations
(toggling highlight classes, swapping pages) kick off style/layout/paint work that
degrades INP directly.
**Rules:** mount only current + adjacent pages; use `content-visibility: auto` +
`contain-intrinsic-size` for off-screen pages; scope highlight class changes to small
CSS-contained subtrees.
*Source:* web.dev/articles/dom-size-and-interactivity (verified verbatim). Note:
Lighthouse 13 (Oct 2025) folded dom-size into an insight triggered by measured
style-recalc cost (>40ms); 800/1,400 remain reference thresholds, not hard gates.

### 2. content-visibility caveat: the SVG `<text>` paint bug
`content-visibility: auto` is the recommended mechanism for keeping off-screen pages in
the DOM cheaply (Baseline: Chrome 85, Firefox 125, Safari 18). **Project-critical bug:**
an SVG containing `<text>` inside a `content-visibility: auto` container may never paint
in Safari (w3c/csswg-drafts#10347). We are safe **only because quran-svg uses outlined
`<path>` glyphs, not `<text>`** — so add a CI check asserting no asset page contains a
`<text>` element. Requires `contain-intrinsic-size` to avoid scroll jumps.

### 3. Prior-art red flag: no major Quran app ships inline-SVG pages
- **quran_android**: pre-rendered **raster** page images (KFGQPC fonts rasterized
  server-side) + a database of per-glyph bounds for ayah/word highlighting — raster page
  + coordinate hit-map, not vector DOM.
- **quran.com** (frontend-next): renders live text via **per-page QCF glyph fonts**, one
  `FontFace` created and loaded on demand (`useQcfFont.ts`, verified against live master).
  No SVG page-image path in the repo.
**Implication:** inline interactive SVG at 604-page scale is unproven on low-end mobile.
Loop 1 must run a real-device perf spike, and the architecture keeps a **raster-fallback
escape hatch**: rasterize the glyph layer per page, keep only the polygon hit layer as
DOM. Highlighter API unchanged either way. Felt's documented SVG→Canvas migration is the
expensive endgame if even the hit layer is too heavy.

### 4. Gestures: @use-gesture v10 with mandatory touch-action
`@use-gesture` (pmndrs, v10.x) — `useGesture` hook (React) / `Gesture` class (vanilla,
fits the framework-free core) — explicitly supports drag + pinch on the same element.
Disambiguation is **not automatic**: check the `pinching` state flag and call `cancel()`
in `onDrag`. **Hard requirement:** set `touch-action` CSS (`none` or `pan-y`) on the
target; otherwise Pointer Events fire `pointercancel` and the browser native-scrolls —
`preventDefault` alone cannot stop it.
*Source:* use-gesture.netlify.app official docs (verified verbatim).

### 5. Offline: quota is a non-issue; eviction is the issue
- **Quota:** ~60% of total disk per origin on Chromium (browser cap 80%) and on Safari
  17+/iOS 17+. Home-Screen installs get the **browser tier (60%), not** WKWebView's 15%.
  ~38 GB on a 64 GB device — a multi-hundred-MB corpus fits trivially.
- **Obsolete, do NOT design around:** the old "Safari ~1 GB + 200 MB prompt increments"
  and "50 MB mobile Cache API" limits were refuted (0-3 and traced to legacy iOS).
- **Real risk (a) — Safari ITP 7-day deletion:** with tracking prevention on, Safari
  deletes *all* script-created storage (Cache API, IndexedDB, SW registrations,
  LocalStorage) for an origin with no user interaction in the last 7 days of browser use.
  **Home-Screen-installed apps are exempt.** → For iOS, install-to-Home-Screen is
  effectively a prerequisite for reliable offline; the install prompt is a first-class
  feature, not a nicety.
- **Real risk (b) — LRU eviction under pressure:** best-effort storage is evicted LRU. A
  granted `navigator.storage.persist()` exempts the origin. Grants are **silent and
  heuristic** (WebKit grants primarily to Home-Screen apps; Firefox prompts). → Call
  `persist()`, verify with `persisted()`, and degrade gracefully on denial. Never assume
  it succeeded.
- **Real risk (c) — Chrome "clear site data on close":** this setting caps quota at
  ~300 MB — the one place a large pinned corpus could hit a ceiling. Detect and warn.
- **Reporting quirk:** since Chrome 133, `storage.estimate()` may under-report
  (usage + 10 GiB) though the enforced quota is larger — don't gate UX on the estimate.
*Sources:* webkit.org/blog/14403, MDN Storage_quotas_and_eviction_criteria, web.dev,
learn.microsoft.com Edge docs (all verified verbatim).

### 6. iOS deep-link caveat
On iOS, a tapped web link **cannot** open an installed PWA in standalone mode — shared hop
links open in a Safari tab, not the installed app. Links still work (acceptable), but:
"pin a juz" UX must live inside the installed app, and onboarding must not promise
link-into-app on iOS. (Track B's Universal Links solve this natively later.)

### 7. React + imperative stage architecture
Apply one combined `translate/scale` transform to the stage container so children scale
without React re-rendering on pan/zoom. React owns chrome only and never the SVG DOM —
this confirms the plan's `PageStage`-hands-the-node-to-L2 design.
*Source:* freecodecamp graphical-React optimization (verified).

### 8. Accessibility floor (verified)
- **WCAG 2.2 SC 2.5.8 (AA):** pointer targets ≥ **24×24 CSS px**. Our 44px touch-target
  budget clears it with margin.
- **SVG exposure pattern:** `role="img"` + `aria-labelledby` on the `<svg>`; per-polygon
  `aria-label` (e.g. "Ayah 2:255, Al-Baqarah") + `tabindex` for keyboard hops. Native
  `<title>`/`<desc>` alone map inconsistently across screen readers.
*Sources:* w3.org WCAG22 target-size, tpgi.com ARIA-for-SVG (verified).

## Refuted claims (do not act on these)

1. "Safari allows ~1 GB per origin, prompting for 200 MB increments." — **0-3, obsolete.**
2. "Safari 7-day cap applies to all script storage as a hard rule regardless of settings."
   — **1-2**; the surviving precise form is: *tracking prevention on, 7 days of browser
   use, Home-Screen apps exempt* (finding 5a).
3. "quran-svg provides complete editions (604 Hafs / 612 Qalun, six riwayat) with
   clickable per-ayah polygons." — **1-2 on completeness.** The polygon *pattern* is
   verified against real source files (`<path class="ayahPolygon" fill-opacity="0"
   id="verse-N" number="SSSAAA" surah= ayah=>`, glyphs `pointer-events:none`), but the
   corpus's edition/page coverage failed verification → **audit page-by-page in Loop 0
   before trusting it as the sole asset source.**

## Open questions (resolve empirically in the loops)

1. **Perf (→ Loop 1 spike):** measured fps panning/zooming a single 400–800 KB Madani SVG
   with a few hundred polygon nodes on low/mid Android and older iPhone WKWebView — and at
   what complexity does rasterizing the glyph layer become necessary?
2. **RTL conventions (→ Loop 1):** actual page-turn/swipe direction in shipping mushaf
   apps (quran.com, Tarteel, KFGQPC) — does swipe advance forward, how is the spread
   ordered in RTL? Observe directly.
3. **SVG a11y (→ Loop 3):** per-ayah `aria-label` on polygons vs a parallel invisible text
   layer for VoiceOver/TalkBack; do dense-page polygons meet 24×24px?
4. **iOS standalone state (→ Loop 6):** do 2026 iOS standalone PWAs still lose/restore
   state unpredictably on process eviction; best practice for hash deep-links surviving
   the standalone cold-start.

## Caveats

Storage policies are volatile (Safari 60/15% dates from Safari 17/2023; Chrome 133/2025
changed only reporting). Lighthouse 13 softened the DOM thresholds into a cost-triggered
insight. Two findings survived only 2-1 (Lighthouse thresholds; two `persist()`
formulations) but are corroborated by 3-0 siblings. `persist()` grant heuristics are
described by WebKit as "currently" — no API contract guarantees them.
