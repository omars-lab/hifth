# Loop 1 — Select + the performance question

**Status:** interactions complete; perf verdict **deferred** (needs your device). **Date:** 2026-07-20.
**Exit criterion (PLAN §Loop 1):** tap-to-select on-device; written perf verdict + RTL decision.
**Scope call:** per an explicit decision this loop, we *ship the interactions* and split the
architecture perf verdict into a follow-up you unblock by measuring on real hardware (task #24).
Tap-to-select is done and verified on WebKit + Chromium touch engines; the verdict is the one
thing that legitimately can't be closed from this machine.

## What shipped

Tap an ayah on page 7 → it highlights in amber and its reference shows in the footer.
Pan and pinch-zoom the page. All of it on the real layer architecture, not a mock.

- **`packages/core/resolver.ts`** — the ayah↔polygon adapter (spec §4). Pure, DOM-free:
  indexes the asset manifest both ways (key→location, elementId→key) so a tap can name
  its ayah and a key can find its polygon(s). Multi-polygon ayahs collapse to one location.
  7 unit tests.
- **`packages/core/highlighter.ts`** — the SVG-aware L2 module (spec §3), the ONE owner of
  SVG geometry. Renders highlights as clones into the additive `#hifth-overlay` group (source
  paths never mutated), grouped by `GroupId` so selection/breadcrumb/phrase never clobber each
  other. `onSelect` fires on polygon tap; glyph paths are inert. `resolve()` reads live bbox
  via `getBBox()`; `setSkin()` swaps a class only. 9 contract tests in jsdom.
- **`apps/web` PageStage** — mounts the SVG, builds the Highlighter over it, and drives
  pan/zoom with **@use-gesture** on one surface: `touch-action: none`, drag=pan, pinch=zoom
  toward the pinch origin, with the `pinching`-flag/`cancel()` disambiguation (research §3).
  The view transform is written straight to the host element's style — **React never
  re-renders on pan** (research §6); it owns lifecycle and chrome only.
- **`apps/web` App + selection chip** — App owns the Resolver + selected-key state; tap shows
  "البقرة · ٢:٤١" (surah name + Arabic-Indic ref, `format.ts`), tap-again or tap-the-chip
  clears. This is the minimal L3 surface; the hop rail that replaces it is Loop 2.
- **Highlight styles** (`styles/highlight.css`) — amber wash + ring for selection, verdigris
  dashed outline reserved for the Loop 2 breadcrumb, a reduced-motion-safe landing pulse.

## Measured

- **JS budget:** **68.8 KB gz** (was 57.7; +11 KB is @use-gesture). Budget 150 KB — **54%
  headroom**. Still comfortably inside.
- **Tests:** core 21 (keys 5 + resolver 7 + highlighter 9), web 5 (incl. the tap→select→
  highlight round-trip), e2e 6 (iPhone WebKit + Android Chromium, incl. **tap-to-select on a
  real touch engine**). Full clean-state CI sequence green (dist deleted first — the Loop 0
  contamination lesson applied).
- **Emulated perf baseline** (`apps/web/perf/pan-zoom-trace.mjs`, Pixel-7 profile, scripted
  pan→zoom→highlight-toggle on the densest page p7): mean **~8.3 ms/frame, 0% of frames over
  the 16.7 ms budget**, and — notably — **identical at 4× and 6× CPU throttle**.

## Decided

- **@use-gesture v10** for gestures (research §3): React-hook flavor, one surface for
  drag+pinch, documented pinch/drag disambiguation. Confirmed it composes with the imperative
  transform without fighting React.
- **"Framework-free" in core means no React, not no DOM.** The highlighter is L2's SVG owner
  (spec §2–§3), so `packages/core` now compiles with the `DOM` lib. The layer boundary is
  still enforced — by ESLint (`import/no-restricted-paths` + no-React) — not by starving core
  of DOM types. This is the honest reading of the spec's layer contract.
- **RTL page-turn convention: swipe follows the physical mushaf.** In a bound mushaf (RTL,
  spine on the right) the *next* page in reading order is reached by turning leftward, so the
  next page enters from the right. Convention adopted, matching quran.com / KFGQPC / Tarteel:
  **dragging the page left→right (or swiping toward the right) advances to the next page;
  right→left goes back.** Keyboard (Loop 7) mirrors this: `←`/`→` map to next/previous under
  RTL, not to raw screen direction. Page-turn *gesture* implementation is Loop 2/3; the
  convention is pinned now so nothing downstream has to re-litigate it.

## Deferred — with where they land

- **THE PERF VERDICT (task #24) — inline-SVG-everywhere vs content-visibility virtualization
  vs raster-glyph fallback.** OPEN. The emulated baseline is fast, but it measures the wrong
  thing for the real risk: pan/zoom is a GPU composite of an already-rasterized layer (cheap,
  hence flat across throttle levels), while the genuine unknowns are (a) **initial raster of a
  170 KB inline SVG** on a low-end phone and (b) **re-raster on zoom** past the layer's backing
  store. Neither is visible in headless Chromium. **You unblock this**: `pnpm build && pnpm
  --filter @hifth/web exec vite preview --host --port 4173`, open on a real mid/low Android +
  an older iPhone, pinch/pan page 7, and read fps from Chrome remote DevTools / Safari Web
  Inspector. The `perf` script prints these steps. This verdict **gates Loops 4–6** (it decides
  whether the full 604-page corpus can be inline SVG) — resolve before Loop 4.
- **Range/marquee drag-select** (`onRangeSelect`) — the highlighter exposes the group and
  styles are ready, but the drag-to-highlight gesture is **Loop 5** (spec §3 says pen-down on
  text = marquee; that competes with pan and needs the intent-threshold work).
- **navigateTo pan/zoom animation + cross-page mount** — **Loop 2** (the hop needs it; Loop 1
  select stays on one page).
- **Wheel-zoom on desktop** — trivial add, folded into Loop 2's stage polish.
- **VoiceOver/TalkBack on the polygons** — a11y pass is **Loop 3**; role="img" + label is in
  place, per-polygon labels + keyboard hop path come with the share/a11y loop.

## Check it on your phone

```bash
pnpm install
pnpm build
pnpm --filter @hifth/web exec vite preview --host --port 4173
```

Open `http://<your-mac-LAN-IP>:4173` on your phone (same Wi-Fi). You should be able to:
**tap any ayah** on page 7 → it fills with the amber "you-are-here" wash and the footer shows
its surah + ayah in Arabic (e.g. **البقرة · ٢:٤١**); **tap it again** (or the chip's ✕) to
clear; **drag** to pan; **pinch** to zoom. If a real mid/low Android or older iPhone is around,
that's the device to run the perf capture on (steps above) — that measurement is what closes
task #24 and the architecture verdict.
