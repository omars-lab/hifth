# Loop 0 — Skeleton on a phone

**Status:** complete. **Date:** 2026-07-20.
**Exit criterion (PLAN §Loop 0):** deployed installable shell showing page 7; CI green with gates.

## What shipped

A working, installable, RTL-native PWA that renders a real KFQC Madani mushaf page
(page 7) with the full build/test/gate/deploy scaffold behind it.

- **pnpm workspace** — `apps/web` (Vite 5 + React 18 + TS strict), `packages/core`
  (framework-free TS), `packages/etl` (Node). Strict TS across all three
  (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- **Assets** — `packages/etl/scripts/extract-pages.mjs` extracts pages 7/9/19 and
  their 22 ayah polygons verbatim from `docs/reference/linker-mock.html` into
  `apps/web/public/assets/`, emitting a typed `manifest.json`. Extraction is
  byte-deterministic (CI re-runs and diffs).
- **Core** — seeded canonical types (`PolygonMeta`, `PageMeta`, `AssetManifest`)
  and the ayah-key helpers (`formatAyahKey`/`parseAyahKey`/`decodeAyahNumber`) with
  round-trip tests. Resolver/highlighter/router are stubbed for Loop 1.
- **Shell** — `App` + `PageStage` + `InstallButton`. RTL, mobile-first, design
  tokens (paper/ink + verdigris accent + amber highlight reserve). `PageStage`
  mounts the SVG, sets `role="img"`+`aria-labelledby`, and injects the additive
  `#hifth-overlay` group (source geometry never mutated).
- **PWA** — vite-plugin-pwa: manifest (RTL, standalone, maskable icon), SW
  precaching the shell only; page SVGs are runtime-cached (a 604-page corpus
  would blow the precache budget). `beforeinstallprompt` captured; install button
  first-class (research §4).
- **Lint boundaries** — ESLint flat config with `import/no-restricted-paths`:
  `packages/core` cannot import from `apps/` and cannot import React.
- **Tests** — Vitest (core keys 5, web shell 4) + Playwright on iPhone (WebKit) and
  Android (Pixel/Chromium) viewports (4 e2e).
- **Gates** (all in CI) — `gate:notext` (no `<text>` in any SVG), `gate:license`
  (every edition documented in `SOURCES.md`), `gate:budget` (JS < 150KB gz), plus
  the deterministic-extraction diff. CI = `.github/workflows/ci.yml`.
- **Deploy** — Cloudflare Pages: `wrangler.toml`, `_headers` (immutable hashed
  assets, revalidate SW/manifest/pages), `_redirects` (SPA 200 fallback for cold
  hash deep-links).

## Measured

- **JS bundle:** 57.7 KB gz total (app 47.2 + workbox 7.1 + workbox-window 2.3 +
  sw 1.0). Budget 150 KB — **62% headroom**. The inline-SVG payload is the real
  weight to watch, and that verdict is Loop 1's job.
- **Page SVG sizes:** p7 170KB, p9 141KB, p19 164KB (uncompressed, verbatim).
  Confirms research §1's concern — a single page is heavy; Loop 1 measures pan/zoom
  fps on-device before committing to inline-SVG-everywhere.
- **Corpus audit:** 22/22 polygons internally consistent (number↔surah:ayah↔key all
  agree); **0 `<text>` elements** (all outlined paths — safe for content-visibility).

## Decided

- **pnpm override to Vite 5** — vitest 2 is built against Vite 5; pinning avoids a
  dual-Vite install whose plugin types clash under `tsc`. Revisit when vitest 3
  (Vite 6-native) is adopted.
- **Precache = shell only.** Page SVGs are runtime-cached (`CacheFirst`, max 12
  entries). Pin-a-juz durable caching is Loop 6.
- **Palette is deliberate, not default.** Verdigris navigation accent (mushaf cover
  tooling / mihrab tilework) + amber reserved strictly for the selection wash; warm
  aged-paper neutrals so the mushaf is the hero — explicitly not the cream/serif/
  terracotta AI-default.
- **Icon is a geometric mihrab arch**, not a rendered glyph — robust to rasterize
  without a bundled font.

## Deferred (with where they land)

- **Corpus completeness:** only **3 of 604** pages vendored (0.5%). This is the
  research §7 open item — full vendoring + page-by-page validation against the QUL
  layout DB is **Loop 4**. The audit script already reports coverage every run.
- **License confirmation:** `SOURCES.md` marks `hafs-kfqc` **PROVISIONAL** — quran-svg
  redistribution terms must be confirmed before **Loop 7** (public beta).
- **Gestures / tap-to-select / inline-SVG perf verdict:** **Loop 1** (the stage has
  `touch-action: none` set, ready for @use-gesture).
- **Golden-image visual regression + Lighthouse CI:** Loops 2 and 6 respectively.
- **iOS "Add to Home Screen" coach mark:** Loop 6 (beforeinstallprompt never fires
  on iOS — research §5).

## Check it on your phone

```bash
pnpm install
pnpm build
pnpm --filter @hifth/web exec vite preview --host --port 4173
```

Then open `http://<your-mac-LAN-IP>:4173` on your phone (same Wi-Fi). You should see:
page 7 of the Madani mushaf on warm paper, **حفظ** top-right, **صفحة 7** top-left,
and "11 آيات قابلة للتحديد على هذه الصفحة" along the bottom. On Android Chrome an
"install" affordance appears (⋮ → Install app); on iOS Safari use Share → Add to
Home Screen. Once installed it opens offline.

**To deploy a public URL** (needs a Cloudflare account — I can't create one for you):
`cd apps/web && pnpm dlx wrangler pages deploy dist --project-name hifth`, or connect
the repo in the Cloudflare Pages dashboard with build `pnpm install && pnpm build`
and output `apps/web/dist`. The build is verified deployable; the hosted URL is the
one manual step I can't complete without your credentials.
