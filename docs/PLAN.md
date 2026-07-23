# Hifth (حفظ) — Implementation Plan

**App identity.** Hifth is a pure navigation instrument for huffaz. Select or highlight an
ayah on a real mushaf SVG page → see typed hop links (similar verses, shared roots, later
hadith/tafsir) → jump. The knowledge graph is the routing table; the page is the
interface. No reader features (audio, translation, tafsir reading). *(Design-phase codename
was "Linker · رابط"; the app is Hifth everywhere.)*

**Platform.** Web app first, mobile-first: touch as the primary input, RTL-native layout,
installable PWA with offline page caching, fully static (no backend). Native iOS/Android
are a gated later track (Capacitor wrap of the same web build), not a v1 concern.

**Source documents** (in `docs/reference/`, kept verbatim for provenance):
- `linker-spec.md` — spec v0.9, the **contract of record**: key grammar, layer contract,
  highlighter API, adjacency shapes, URL grammar, ETL, phases.
- `linker-mock.html` — working mock on 3 real Madani pages (Hafs/KFQC, quranpedia corpus).
- `linker-architecture.html` — sources → ETL → static data → runtime diagram.
- `linker-delivery-plan.md` — the design conversation's week-numbered delivery plan
  (web + iOS tracks); its milestones, budgets, and UX furniture are folded into the loops
  below.

**Research** (`docs/research/2026-07-20-mobile-svg-pwa.md`): a verified deep-research pass
whose findings became the binding design rules in §4.

---

## Status & tracking

This section is the **roadmap of record** — it replaces the retired external task tracker;
statuses, gates, and open follow-ups live here and nowhere else. Convention: **every loop
ends by updating this section and writing `docs/decisions/loop-<N>.md`.**

| Loop | Status | Exit criterion (short) | Record |
|---|---|---|---|
| 0 — Skeleton | complete | Installable RTL shell showing page 7; CI green with gates | [loop-0.md](decisions/loop-0.md) |
| 1 — Select + perf | complete-with-deferral | Tap-to-select on-device; RTL page-turn decided; perf verdict → follow-up ① | [loop-1.md](decisions/loop-1.md) |
| 2 — The hop | complete | Tap 2:48 → rail → popover → cross-page hop → bead back, one-handed | [loop-2.md](decisions/loop-2.md) |
| 3 — Diffs, share, a11y | pending (after 2) | Teacher link cold-open restores exact view; screen reader announces hops | — |
| 4 — Full corpus ETL | **gated on follow-up ①** | Deterministic `pnpm etl`; every ayah navigable; TTI <2.5s mid-Android | — |
| 5 — Highlight + roots | pending (after 4) | Drag-range → merged hop list; root lens nearest-page-first | — |
| 6 — Offline, skin, editions | pending (after 4) | Pinned juz offline after 8+ days; instant skin toggle; Lighthouse ≥90 | — |
| 7 — Polish + beta | pending (after 3+5+6) | Hafiz revision session, zero friction notes → **web v1.0** | — |
| Track B — Capacitor | gated on web v1.0 | Same web build wrapped for iOS/Android; Universal Links | — |

### Open follow-ups

1. **On-device perf verdict** (formerly external-tracker task #24) — decide
   inline-SVG-everywhere vs content-visibility virtualization vs raster-glyph fallback.
   The emulated baseline (~8.3 ms/frame, flat under CPU throttle) cannot see the real
   risks: initial raster of a 170 KB inline SVG on a low-end phone, and re-raster on zoom
   past the layer's backing store. **How to run:** `pnpm build && pnpm --filter @hifth/web
   exec vite preview --host --port 4173`, open on a real mid/low-tier phone, pinch/pan
   page 7, and read fps via Chrome remote DevTools / Safari Web Inspector
   (`apps/web/perf/pan-zoom-trace.mjs` prints the same recipe). **Gates Loop 4** — must be
   resolved before Loop 4 starts (Loops 5–6 inherit the gate through the ETL).
2. **License confirmation** — `SOURCES.md` marks `hafs-kfqc` **PROVISIONAL**; confirm
   quran-svg redistribution terms **before Loop 7** (public beta).
3. Loop-assigned deferrals (already scoped in their loop sections; details in the decision
   records): full corpus vendoring + QUL validation → Loop 4; `navigateTo` animation,
   wheel-zoom, golden-image visual regression → Loop 2; per-polygon a11y labels + keyboard
   path → Loop 3; marquee drag-select → Loop 5; Lighthouse CI + iOS install coach mark →
   Loop 6.

---

## 1. How we build: loops, not a waterfall

The build proceeds in **vertical loops**. Each loop is a thin end-to-end slice with a
demoable exit criterion checked on a real phone (or Playwright mobile emulation) before the
next loop starts. Loops are ordered so the riskiest unknowns — inline-SVG performance at
scale, the touch gesture split — surface earliest. The delivery plan's week-numbered
milestones are imported as loop *exit criteria*, not as sequencing.

Loops are allowed to shrink; they are not allowed to skip their exit criterion, and a loop
never ends without an on-device check and a `docs/decisions/loop-<N>.md` writeup of what
was decided, measured, and deferred.

## 2. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Repo | Light **pnpm workspace** | `packages/core`, `packages/etl`, `apps/web`; pays for itself when the Capacitor track wraps the same web build |
| Build/dev | Vite + TypeScript (strict) | fast, static output, no server |
| UI | React 18 | component model for rail/popovers/menus; mobile-touch ecosystem |
| Core (L2 highlighter, resolver, router, keys) | **Framework-free TypeScript** in `packages/core` | the spec's L2 speaks DOM element IDs + CSS classes only; keeping it React-free preserves the layer contract and keeps it headless-testable. `Gesture` (vanilla @use-gesture) fits here |
| Gestures | **@use-gesture v10** | drag + pinch on one surface, with `touch-action` + `pinching`/`cancel()` disambiguation (research §4) |
| Stage transform | one combined `translate/scale` on the container | children never re-render on pan/zoom (research §7) |
| State (L3) | Zustand (or React context while small) | selection/trail/skin/edition are a tiny store |
| Styling | CSS modules + **design tokens** (custom properties) | tajweed skin is by spec a stylesheet swap — keep styling in CSS, not JS |
| Tests | Vitest + Playwright (mobile viewport) + fast-check + axe | see §6 |
| ETL | Node/TS in `packages/etl` | offline, output = static JSON; shares the key-grammar code with the app |
| Hosting | Static (Cloudflare Pages) | hash routing is static-host friendly |
| PWA | vite-plugin-pwa | offline pages + installable |

Ship artifacts: `public/assets/` (SVG pages, untouched), `anchors/`, `adj/`, `roots/`,
`skins/`, `registry.json`, and the app bundle. No backend.

## 3. Component architecture

The spec's three layers map to three areas with **enforced boundaries** (ESLint
`import/no-restricted-paths`: `core/` may not import from `components/`; nothing imports
from `assets/`).

```
packages/core/                ← framework-free TS (architecture's L2 + shared grammar)
  keys.ts                     parse/format/compare canonical node-keys (spec §1)
  resolver.ts                 key → {page, elementIds, bbox, markerXY} via anchors JSON
  highlighter.ts              highlight/clear (grouped), navigateTo, setSkin,
                              onSelect/onRangeSelect, serializeState/restoreState (spec §3)
  gestures.ts                 pointer-event splitter: text-marquee vs margin-pan
  router.ts                   hash-link grammar parse/serialize (spec §7) — same path as share
  adjacency.ts                shard loader + edge bucketing by dir (↻◀▶), popover ordering

packages/etl/                 ← Node: extract-anchors, build-adjacency, build-roots,
                                build-skins, validate (resolution + licensing gates)

apps/web/
  src/state/                  ← L3 store: selection, trail, skin, active edition
  src/components/             ← React, presentational + thin containers
    PageStage.tsx             SVG mount point, pan/zoom viewport, page load/unload
    HopRail.tsx               chips with counts (↻3 ◀1 ▶2 ⬡12), arc-arrow glyphs
    HopPopover.tsx            target list grouped by direction, lazy-loaded
    DiffView.tsx              token-level mutashabih diff, ctx-continuation line
    HighlightMenu.tsx         post-drag context menu (hop / root lens / copy link / clear)
    RootLens.tsx              root occurrences by page distance, lemma sub-groups
    TrailBeads.tsx            subha-bead breadcrumb strip; every bead a back-hop
    ShareSheet.tsx            link + trail share (serializeState → URL)
    SkinToggle.tsx            plain / tajweed
    ArcArrow.tsx              the one hop glyph (mirrored / closed-loop variants)
    EditionPicker.tsx         edition switch + "view in your mushaf" concordance prompt
  src/App.tsx                 shell: stage + rail + trail, mobile-first RTL layout
  public/assets/              immutable SVG corpus
  public/data/                ETL output: anchors/ adj/ roots/ skins/ registry.json
```

Component rules:
- React components never touch SVG internals. `PageStage` is the only one that hands a DOM
  node to the highlighter; everything else calls the highlighter and renders around the stage.
- Every component gets a fixture (plain Vite page) so it can be built before real data exists.
- The edge-type registry (spec §5) drives `HopRail`/`HopPopover`; reserved types
  (hadith ⚭, tafsir ✎, lexicon) render nothing until their `status` flips.

## 4. Binding design rules (from research)

Full evidence in `docs/research/2026-07-20-mobile-svg-pwa.md`. The rules:

1. **DOM budget is the #1 constraint.** Mount only current + adjacent pages;
   `content-visibility: auto` + `contain-intrinsic-size` off-screen; scope highlight
   toggles to small CSS-contained subtrees. CI check: **no asset page contains `<text>`**
   (Safari content-visibility paint bug; quran-svg uses outlined paths, so we stay safe).
2. **Inline SVG at scale is unproven** (no major Quran app does it). Loop 1 runs a
   real-device perf spike; the architecture keeps a **raster-fallback escape hatch**
   (rasterize glyph layer, keep only the polygon hit layer as DOM) behind the unchanged
   highlighter API.
3. **@use-gesture + mandatory `touch-action`**; apply the `pinching`/`cancel()` split.
4. **Offline: quota is a non-issue (~60% disk); eviction is the issue.** iOS install is a
   prerequisite for durable offline (ITP 7-day deletion; installed apps exempt) → the
   install prompt is a first-class iOS feature. Call `persist()`, verify with
   `persisted()`, degrade gracefully. Detect Chrome's clear-on-exit ~300 MB cap. Ignore
   obsolete "Safari 1 GB / 50 MB" numbers.
5. **iOS deep-links can't open an installed PWA** — shared links open in Safari tabs;
   pin-a-juz UX lives inside the app; don't promise link-into-app on iOS.
6. **A11y floor:** WCAG 2.2 targets ≥24×24px (our 44px budget clears it); SVG exposed via
   `role="img"` + `aria-labelledby`, per-polygon `aria-label` + `tabindex` for keyboard hops.
7. **Corpus completeness is unverified** — audit quran-svg page-by-page in Loop 0 before
   trusting it as the sole asset source.

## 5. Frontend-design practices

- **Design tokens from Loop 0** (CSS custom properties): paper/ink neutrals so the mushaf
  artwork is the hero; tajweed + plain skins are token layers (matches "skin = stylesheet").
- **Signature element:** the leaping arc-arrow + subha-bead trail (spec §9). One
  orchestrated motion moment — the hop (pan → land → pulse). Everything else quiet.
- **Type:** characterful Arabic display face for chrome (surah names, rail); quiet
  Latin/utility companion; mushaf glyphs are geometry, never restyled.
- **Copy:** user-side vocabulary (Hop, Trail, "Pin this juz"), active voice, one verb per
  flow end-to-end, errors say what to do next, empty states invite action. Arabic-first
  chrome with English support.
- **Quality floor, unannounced:** responsive to 320px, visible focus, reduced-motion
  respected, 44px targets, RTL-native (`dir="rtl"`, logical properties).

## 6. Testing plan

Principle: **the data is scripture — data correctness is tested harder than code.** A
wrong hop or mislabeled ayah is a product-breaking bug for this audience.

### Test pyramid by layer

| Layer | What | Tool | From |
|---|---|---|---|
| `core` unit | keys round-trip (property-based: parse→format→parse); resolver incl. misses; adjacency bucketing (↻◀▶ boundaries: dSurah 0/±1, same-page/juz); every §7 link form round-trips serialize/restore | Vitest + fast-check | Loop 1 |
| Highlighter contract | spec §3 API on fixture pages (jsdom): group isolation (breadcrumb never clobbers selection), navigateTo mounts ≤ current+adjacent, setSkin toggles classes without touching geometry, events carry correct keys/granularity | Vitest + fixtures (mock pages 7/9/19) | Loop 1 |
| Component | each component from fixture data: rail counts match adjacency, popover hifz ordering, diff output for known pairs (2:48 vs 2:123 = شفاعة/عدل), reserved edges render nothing | Vitest + Testing Library | as each lands |
| E2E core loop | scripted hop tours: tap → rail → popover → cross-page hop → bead back; drag → menu → merged hops; cold-open every §7 link and assert restored state | Playwright, iPhone + Android viewports, touch | smoke every push (Loop 2); full nightly |
| Visual regression | golden screenshots: 5 pages × (plain, tajweed) × (selection, phrase, breadcrumb, marquee) | Playwright toHaveScreenshot | Loop 2 |
| Perf | Loop 1 spike in CI: trace pan/zoom + highlight-toggle on densest page, assert frame budget; TTI <2.5s throttled; JS <150KB gz; shard <50KB gz | Playwright traces + Lighthouse CI | budgets Loop 0; traces after Loop 1 |
| A11y | axe-core on every screen; keyboard-only hop tour (tab → select → rail → hop → back); manual VoiceOver + TalkBack each loop exit | axe + Playwright + manual | Loop 3 |
| Offline | pin a juz → offline → navigate/hop within it; simulate eviction (clear Cache, keep IndexedDB manifest) → app offers re-pin; persist() denial renders warning | Playwright offline | Loop 6 |

### Data/ETL testing (the scripture layer)

- **Determinism:** two consecutive `pnpm etl` runs are byte-identical (hash outputs in CI).
- **Resolution gate:** 100% of edge endpoints resolve in anchor tables; 100% of SVG
  polygons appear in anchor tables (both directions — no orphans).
- **Cross-source reconciliation:** anchors vs QUL layout DB; any surah/ayah/page
  disagreement fails the build with a diff report.
- **Golden ayahs:** ~30 hand-verified ayahs (first/last of surah, juz boundaries, sajda
  marks, pages 1 and 604) asserted every ETL run.
- **Edge spot-audit (human):** weekly during Loops 4–7, 20 random edges vs a printed
  mushaf; a hafiz signs off mutashabihat diffs before v1.0. Tajweed skin ships behind a
  "beta" flag until hafiz approval.
- **License gate:** build fails if any source lacks a `SOURCES.md` entry.

### Device matrix (manual, each loop exit)

Primary: mid-tier Android (the TTI budget device) + iPhone, both installed-PWA and
browser-tab. Secondary each ~2 loops: 320px phone, iPad, desktop. The 8+ day ITP offline
survival test (installed vs tab) runs once in Loop 6.

## 7. The loops

### Loop 0 — Skeleton on a phone (small) — ✅ complete ([loop-0.md](decisions/loop-0.md))
pnpm workspace; ESLint boundaries; Vitest + Playwright mobile; CI (lint, test, **JS-budget
gate**, **license gate** reading `SOURCES.md`); design tokens + `dir="rtl"` shell; PWA
manifest + install-prompt scaffold; Cloudflare Pages deploy. Extract the mock's 3 pages
(7, 9, 19) + polygon metadata from `linker-mock.html` into `public/assets/`; **audit
quran-svg corpus completeness** and record licenses in `SOURCES.md`.
**Exit:** deployed installable shell showing page 7; CI green with gates.

### Loop 1 — Select + the performance verdict (small; de-risks everything) — ✅ interactions complete; perf verdict deferred to on-device ([loop-1.md](decisions/loop-1.md))
`keys.ts`, `resolver.ts` (ayah-polygon adapter over the 3 pages' `verse-N` /
`number="SSSAAA"` attrs); `PageStage` inline SVG; @use-gesture pan/zoom with `touch-action`
+ pinch/drag disambiguation; tap polygon → highlight + `onSelect`.
**Perf spike (the loop's real product):** fps of pan/zoom + highlight toggle on mid/low
Android and an older iPhone across the densest bundled page → decision recorded (inline SVG
everywhere / content-visibility virtualization / raster-glyph fallback). Observe RTL
page-turn conventions in quran.com + Tarteel, record decision.
**Exit:** tap-to-select on-device; written perf verdict + RTL decision in `docs/decisions/`.

### Loop 2 — The hop (medium) ← the product exists after this loop — ✅ complete ([loop-2.md](decisions/loop-2.md))
Adjacency shards for the mock's curated clusters; `adjacency.ts` (dir bucketing, hifz
popover ordering); `HopRail` (arc-arrow chips ↻◀▶ + counts); `HopPopover`; `navigateTo`
(cross-page load, pan, pulse; only current+adjacent mounted); breadcrumb group;
`TrailBeads`. Bottom-sheet popovers <900px; 44px targets.
**Exit:** tap 2:48 → rail → popover → hop to 2:123 cross-page → bead back, one-handed on a phone.
**Shipped it:** `adjacency.ts` + `view.ts` (pure math) in core; the multi-page `PageStage` with
a single-`view` RAF hop-tween (owns the transform); `HopRail`/`HopPopover`/`TrailBeads`;
`build-adjacency.mjs` ETL → committed surah-2 shard, deterministic in CI. Full hop tour green on
WebKit + Chromium. Un-vendored targets surfaced-but-disabled (no ghost page). LRU-6 eviction and
the token DiffView deferred to Loops 4 and 3 respectively.

### Loop 3 — Diffs, share links, a11y pass (medium)
`DiffView` (token diff, twin label, ctx continuation); hash router = spec §7 via
`serializeState`/`restoreState` (same path as live hops); `via`/`trail`/`w`/range forms;
`ShareSheet` (Web Share API + clipboard fallback). A11y: `role="img"` + labels, per-polygon
`aria-label` + keyboard hop path; VoiceOver/TalkBack on-device check.
**Exit:** cold-opening a teacher link restores exact view incl. trail; screen reader announces ayahs and hops.

### Loop 4 — Full corpus ETL (large, mostly offline work)
`packages/etl`: anchors over all 604 pages (cross-check QUL layout DB; fail on mismatch);
edges (Waqar144 mutashabihat primary, QUL phrase ranges, QurSim secondary) → canonical
keys → dedupe → dir annotations → `adj/<surah>.json`; validation gates (100% resolution,
shard <50KB gz, licenses). **Asset decision point:** evaluate the word-granular ligature
corpus (gates word-span pulsing + true root lens) — its resolver adapter fits behind the
same L2 API. Page streaming: fetch-on-demand, LRU ~6 pages, prefetch hop targets +
adjacent pages; PWA caching of visited juz.
**Exit:** `pnpm etl` deterministic in CI; every ayah navigable; first-page TTI <2.5s mid-Android.

### Loop 5 — Highlight gesture + root lens (medium)
`gestures.ts` marquee/pan split (touch-action zones + intent thresholds); amber wash;
`HighlightMenu` (merged deduped edges of the range, range-form copy link); roots ETL
(Quranic Arabic Corpus / QUL morphology) + `RootLens` (page-distance sort, lemma
sub-groups). Word-granularity if Loop 4 adopted the ligature corpus; ayah-fallback otherwise.
**Exit:** drag 2:47–2:48 → menu → merged hop list; word/ayah → root lens nearest-page-first.

### Loop 6 — Offline + skin + editions (medium)
Service worker: precache shell + registry; runtime-cache visited pages/shards; **pin-a-juz
packs** (Cache Storage + IndexedDB manifest) with `persist()` + `persisted()` verification,
graceful-denial UI, Chrome clear-on-exit detection; iOS install-prompt flow (ITP 7-day
rule). Tajweed ETL (quran.com rule spans → element-ID class maps → `skins/`); `setSkin`
swap; color-blind palette; "beta" flag until hafiz sign-off. `EditionPicker` + concordance.
iOS standalone state-restoration test. Onboarding coach marks; surah/juz/ayah jumper.
**Exit:** airplane-mode revision of a pinned juz works after 8+ days; instant plain⇄tajweed toggle (identical geometry); Lighthouse ≥90.

### Loop 7 — Hifz polish + beta (ongoing) → web v1.0
5–10 huffaz/teachers; interview, don't instrument (privacy-respecting counts only). Weekly
data-QA (20 random edges vs printed mushaf, hafiz sign-off on diffs). Popover ordering
tuning (same page → juz → earlier → later); keyboard map (arrows=pages, `/`=jumper);
golden-image tests on 5 pages; perf pass (shard prefetch on selection).
**Exit:** a revision session with a hafiz produces no navigation friction notes → **web v1.0**.

### Track B (gated on stable web beta) — Capacitor iOS, then Android
Wrap `apps/web`; bundle the full corpus in-app (offline by default); native share sheet;
**Universal Links** (links open the app — solves research §5 on iOS); haptics on hop-land
and bead taps; state restoration; iPad two-page spread; App Store review notes lead with
KFGQPC provenance. Android fast-follow (~95% shared code). Do not start until web v1.0.

### Someday — Reserved edges
Hadith/tafsir/lexicon edges: data drop + registry `status` flip only. No UI or highlighter
changes, per the additive-only registry design.

## 8. Cross-loop rules

- **Assets are immutable** — never edited, styled only via CSS classes + the injected
  overlay group (`#hifth-overlay`).
- **Edition in every key, always.** No index arithmetic across editions; concordance only.
- **Licensing gate from Loop 0:** `SOURCES.md` manifest; CI fails on a source without an
  entry (QUL terms vary per resource — record each).
- **Mobile is the acceptance device** for every loop, not a retrofit.
- Each loop ends with: on-device demo → `docs/decisions/loop-<N>.md` → (re)scope next loop.

## 9. Execution convention

Two levels, both living in this repo (the external task tracker is retired —
§Status & tracking is the roadmap of record):
- **Roadmap** — the Status & tracking table. One row per loop (+ Track B); the status
  column carries the sequencing (linear through Loop 2; Loops 3 & 4 open after Loop 2;
  Loops 5 & 6 depend on the ETL; Loop 7 waits on 3+5+6; Track B gated on web v1.0).
  Exactly one loop in flight; a loop flips to complete only when its exit criterion and
  testing-plan tiers pass and both its decision record and the table are updated.
- **Per-loop working list** — created fresh at loop start from that loop's plan section
  (one item per deliverable), tracked in-session, closed as items land. The durable
  residue is the loop's decision record (decided / measured / deferred), not the list.
  Discovered work becomes a list item or an Open follow-up above — never silent scope creep.

### Agent strategy per loop

Guidance, not bureaucracy. Modes: **Explore** (read-only fan-out recon), **Plan**
(implementation-plan design), **general-purpose** (multi-step research + code), and
**Workflow** orchestration (deterministic parallel/pipeline fan-out — opt-in per run).

- **Loop 2** — single-context feature work: code inline; one Plan agent for the
  `navigateTo` cross-page mount/pan/pulse design before building.
- **Loop 3** — inline; run the a11y audit as a separate review-style pass (Explore) over
  the finished screens rather than mid-feature.
- **Loop 4** — the natural **Workflow fan-out**: per-surah shard validation, cross-source
  reconciliation vs the QUL layout DB, and golden-ayah checks parallelize cleanly; the
  ETL pipeline code itself stays inline.
- **Loops 5–6** — inline feature work; Loop 6's offline/eviction matrix is a manual
  device checklist, not an agent job.
- **Loop 7** — inline polish; the 5-page golden-image sweep is a small fan-out candidate.

## 10. Non-goals (v1)

Audio, translations, tafsir reading, quizzes, user accounts, server backend,
editing/creating SVG assets, exhaustive phrase matching beyond curated hifz sets.

## 11. How to start a loop

One self-contained prompt per loop:

```
Start Loop <N> of Hifth. Read docs/PLAN.md (§Loop <N>) and docs/reference/linker-spec.md
first. Scope: exactly the Loop <N> deliverables — do not pull work forward. Definition of
done: the Loop <N> exit criterion, the applicable testing-plan tiers passing in CI, and a
demo I can open on my phone. Finish by writing docs/decisions/loop-<N>.md and telling me
exactly what to check on my phone.
```

`docs/PLAN.md` is the single source the prompt points at; each loop's `docs/decisions/`
writeup means the next loop needs no conversation memory.

The `Makefile` makes this executable: `make loop N=<N>` prints the prompt above with that
loop's plan section inlined; `make status` prints the Status & tracking table; `make ci`
mirrors the CI gate sequence locally; `make loop-verify N=<N>` runs the full gate + e2e so
a loop only closes green; `make phone` / `make perf` drive the on-device checks.
