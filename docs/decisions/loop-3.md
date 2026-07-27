# Loop 3 — Diffs, share links, a11y pass

**Status:** complete. **Date:** 2026-07-25.
**Exit criterion (PLAN §Loop 3):** cold-opening a teacher link restores the exact view incl.
trail; the screen reader announces ayahs and hops.
**Result:** every spec-§7 link form cold-opens through the *same* select/navigateTo path a live
hop uses — a `#/hafs-kfqc/2:123?trail=2:40,2:47&via=2:48` link restores page 19, the 2:123
selection, and all three trail beads; every selection and hop is spoken through an `aria-live`
region; the automated axe pass and a keyboard-only hop tour are green on both mobile engines.

## What shipped

Paste (or cold-open) a link like `#/hafs-kfqc/2:123?via=2:48` → the app **lands on page 19 with
2:123 current and 2:48 threaded as a trail bead**, exactly as if you'd hopped there; the address
bar always holds a shareable link to "here"; **Share** copies it (or invokes the native share
sheet); opening a hop row reveals a **token diff** of the two readings; and the whole surface is
**keyboard- and screen-reader-navigable** — every ayah is a focusable, labelled button, arrows
step ayah-to-ayah, and each select/hop is announced.

- **`packages/core/router.ts`** — the pure spec-§7 URL codec, DOM-free (speaks canonical keys +
  `AppState` records; L3 owns `location`/`history` I/O). `serializeState(state) → string` and
  `parseHash(hash) → AppState | null` are exact inverses over every §7 form: `#/<edition>/<surah>:<ayah>`,
  ranges (`2:47-2:48`), `?w=3-7` word-span, `?skin=tajweed`, `?via=` breadcrumb, `?trail=` chain,
  bare `#/<edition>/p7`. Query params emit in a fixed order (w, skin, via, trail) so serialization
  is stable; a malformed known param rejects the whole hash (returns null) rather than restoring a
  half-parsed view; missing leading `#` and empty/`#`/`#/` are tolerated. `refToKey`/`keyToRef`
  bridge §7 refs ↔ canonical keys. **18 unit tests**, incl. a combinatorial round-trip sweep
  (`parse(serialize(state))` deep-equals state across all axis combinations).
- **`packages/core/verse-text.ts`** — the diff model. Each ayah is **pre-tokenized** into
  `[text, DiffClass]` pairs (0 = common, 1 = reading-A, 2 = reading-B) — no runtime alignment; the
  view just renders both sides' pre-classified tokens. `verseTokens(key)` and
  `diffPair(fromKey, toKey)` (null if either side is unvendored). The signature pair
  **2:48 vs 2:123 = شفاعة/عدل** order swap. **5 unit tests.**
- **`packages/core/highlighter.ts` — keyboard + a11y contract.** Polygons become real controls:
  `enhancePolygons()` sets `role="button"`, `tabindex="0"`, and an `aria-label` from an injected
  `labelFor` callback (keeps core free of the 114-surah-name table — L3 supplies the names). A
  `keydown` listener selects on Enter/Space and steps the focus ayah-to-ayah on Arrow/Home/End.
  **+6 keyboard-a11y tests** (15 total in the highlighter suite).
- **`apps/web/useHashRouter.ts`** — the view ↔ URL bridge. Parses `location.hash` on the *ready*
  edge (cold open) and on every `hashchange` (paste, back/forward) → `onRestore`; reflects live
  `AppState` back with `replaceState` (no history entry per hop — the trail is the history). A
  `selfWritten` guard ignores our own echo; a `coldOpened` latch gates both the first restore and
  all writes so the initial empty view can't overwrite an incoming link before it's read.
- **`apps/web` DiffView / ShareSheet / LiveAnnouncer** — the L3 furniture. **DiffView** renders a
  `diffPair` as two token rows (reading-A red wash, reading-B verdigris wash). **ShareSheet**
  builds `origin+pathname+serializeState(state)`, prefers `navigator.share`, falls back to
  `clipboard.writeText`, and is user-initiated only (a quiet verdigris pill in the footer).
  **LiveAnnouncer** is an `sr-only` `role="status"`/`aria-live="polite"` region; `useAnnouncer()`
  re-announces repeats by clearing then re-setting on a microtask.
- **`apps/web` HopPopover → real modal dialog.** Focus moves in on open, Tab is trapped (wrap
  first/last), Escape closes, focus returns to the rail chip that opened it. Each row's label is an
  `aria-expanded` toggle that reveals the inline `DiffView`; the ↪ leap stays a separate labelled
  button (disabled + honest note for un-vendored targets).
- **`apps/web` PageStage** — the SVG is now `role="group"`, **not** `role="img"`. An image is a
  leaf; ours contains focusable ayah buttons, and axe (correctly) flags a focusable descendant of
  `role="img"`. This was caught by the new axe scan — a genuine architectural correction, not a
  test tweak.
- **`apps/web` App** — computes the current view as an `AppState` (`via` = the breadcrumb origin,
  `trail` = the rest of the chain) and restores a parsed link by rebuilding the beads from
  `trail`+`via` and feeding the selection through `navigateTo` — the *same* path a live hop uses,
  so there is no separate deep-link logic to drift (spec §7). Every select/hop/bead-back/clear
  calls `announce(...)`.

## Measured

- **JS budget:** **66.0 KB gz** app bundle (**76.5 KB gz** with the workbox SW chunks), against
  the 150 KB budget — comfortably inside. The router + diff model + four components added ~4 KB gz
  over Loop 2's 61.9 KB.
- **Tests:** core **69** (keys 5 + resolver 7 + highlighter **15** + adjacency 11 + view 8 +
  **router 18** + **verse-text 5**), web **6**, e2e **26** across both viewports (13 × iPhone
  WebKit + Android Chromium) — including **cold-open of every §7 link form**, the **full-trail
  restore**, the **hash-write-on-select**, the **diff-view expand**, a **keyboard-only hop tour**,
  **Escape-closes**, and **two axe scans** (base view + open popover, asserting zero
  serious/critical WCAG 2.2 A/AA violations). Full `make ci` green (ETL determinism, lint,
  typecheck, unit, gates, budget); `make e2e` green on both engines.

## Decided

- **Share/restore is the router, not a deep-link feature.** `serializeState`/`parseHash` are the
  single codec; a live hop, a cold-open, and a back-button traversal all route through the same
  `restoreState`. There is no second code path that could encode "here" differently from how it
  decodes a link — the property test proves the round-trip, and the e2e proves the cold-open lands
  the identical view.
- **Cold-open must wait for the resolver; writes must wait for cold-open.** The manifest loads
  async, so the mount fires before `restoreState` can resolve a link (`restoreState` no-ops without
  a resolver). `useHashRouter` gains a `ready` gate: the first restore runs on the *ready* edge,
  and the URL-write effect is held behind the same `coldOpened` latch — otherwise the initial empty
  `{select:null, page:7}` view would `replaceState` over an incoming teacher's link before we read
  it. This was the real bug behind the first e2e run (the link was parsed, then discarded).
- **The SVG is a `group`, not an `img`.** Loop 1 exposed the page as `role="img"` +
  `aria-labelledby` (research finding 7). Once polygons became focusable buttons (Loop 3), that
  became a WCAG violation — an image is a leaf and must not contain focusable descendants. The axe
  scan caught it; the page is now `role="group"` with the same label, and each polygon carries its
  own `aria-label`.
- **Every polygon is tabbable (not roving-tabindex).** A page's worth of ayahs is a reasonable tab
  sequence, and it keeps the highlighter's keyboard model trivial (no focus-owner bookkeeping).
  Arrow/Home/End move the *focus* ayah-to-ayah in document (reading) order — RTL-agnostic: "next
  ayah" is +1 regardless of physical arrow direction, so Down/Left = +1, Up/Right = −1.
- **The diff has no runtime aligner.** The mock pre-classifies each ayah's tokens; DiffView renders
  both sides' classes verbatim. A real alignment algorithm is out of scope until the full corpus
  (Loop 4+) — and for the confusable-pair use case, a curated per-edge classification is *more*
  trustworthy than an automatic diff a hafiz can't audit.
- **Announcements live outside React state updaters.** `handleSelect` reads the live selection via
  a ref and announces after `setState`, not inside the updater — React may invoke updaters twice in
  dev to check purity, which would fire the toggle-off branch (and the "deselected" announcement)
  spuriously.

## Test-infra fixes (found while landing)

- **Cross-test hash pollution.** The write effect sets `location.hash`; jsdom shares one `window`,
  so the next test's cold-open restored the *previous* test's selection — the tap then toggled it
  off. `App.test.tsx` now clears the hash in `afterEach` (each browser page-load is a fresh URL;
  the test harness must mirror that).
- **WebKit worker starvation.** Running both projects' 26 tests at the default 6 workers starved
  WebKit's page-setup past the 30 s timeout on a constrained machine (3 intermittent iPhone
  failures, all "timeout while setting up page" — infra, not logic). `playwright.config.ts` now
  caps `workers: 2`, sets `retries: 1` everywhere (a starved launch recovers on the second attempt;
  a real failure fails both), and raises `timeout: 60_000`. Stable green on both engines after.
- **Strict-mode locators.** The new a11y labels made polygons match substrings like `البقرة · ٢:٤٨`,
  and the LiveAnnouncer added a second match; several `getByText` assertions (incl. pre-existing
  smoke/hop specs) now target the specific current-ayah/bead buttons by role+name, and restore
  assertions use the header page number rather than a per-page-local `#verse-N` id (not unique
  across mounted pages).

## Deferred — with where they land

- **On-device VoiceOver/TalkBack pass** — the Loop 3 exit named it; automated axe + the keyboard
  hop tour cover the machine-checkable a11y floor (both green in CI), but the manual screen-reader
  *gesture* walkthrough on a real iOS/Android device is the remaining confirmation. Now
  **follow-up ④** in PLAN — run it alongside the perf verdict (follow-up ①) on the same phone,
  before Loop 7.
- **Word-span (`?w=`) UI** — the grammar round-trips through the router today, but the marquee that
  *produces* a word span is Loop 5 (highlight gesture). The link form is ready ahead of the UI so
  Loop 5 wires to it without a router change.
- **Skin toggle (`?skin=tajweed`)** — likewise round-trips in the grammar; the toggle UI + tajweed
  ETL are **Loop 6**.
- **On-device perf verdict** (follow-up ①, still open from Loop 1) — unchanged; share/restore is a
  state-and-URL concern that doesn't touch the rendering hot path. Still gates Loop 4.

## Check it on your phone

```bash
make phone     # build + serve on your LAN; prints the URL to open on a phone
```

Two things to try on the printed `http://<your-mac-LAN-IP>:4173` (same Wi-Fi):

**1. The teacher link.** Open this exact URL on your phone:
`http://<your-mac-LAN-IP>:4173/#/hafs-kfqc/2:123?trail=2:40,2:47&via=2:48`
It should cold-open **on page 19 with البقرة · ٢:١٢٣ already current** and **three beads**
(٢:٤٠ ٢:٤٧ ٢:٤٨) strung on the footer trail — the full path restored, not just the landing ayah.
Tap **شارك** (footer) to copy/share the link back; tap any bead to rewind.

**2. Screen reader.** Turn on **VoiceOver** (iOS: triple-click side button) or **TalkBack**
(Android). Swipe to an ayah — it announces "الآية البقرة · …" as a button; double-tap to select —
you hear "حُدّدت …"; open a hop rail chip and double-tap a row's ↪ — you hear
"انتقلت إلى … · صفحة …". Open a hop row (double-tap its label) to hear the **شفاعة ↔ عدل** diff.
Report anything the reader skips or mis-orders — that's the manual pass (follow-up ④) we still owe.
