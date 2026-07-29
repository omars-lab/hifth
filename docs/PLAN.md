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
whose findings became the binding design rules in §4. **Re-grounded 2026-07-25** with live
source checks (data sources, licenses, storage policy, Safari status) — links inline in §4
and §7 Loop 4; the strategy change it produced is the Loop 4a/4b split below.

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
| 3 — Diffs, share, a11y | complete | Teacher link cold-open restores exact view; screen reader announces hops | [loop-3.md](decisions/loop-3.md) |
| 4a — Edge-data ETL | complete | Deterministic full-corpus edge ETL; 100% valid keys; shards <50KB gz | [loop-4a.md](decisions/loop-4a.md) |
| 4b — Page corpus + streaming | **gated on follow-up ①** | All 604 pages vendored + QUL-checked; every ayah navigable; TTI <2.5s mid-Android | — |
| 5 — Highlight + roots | complete (ayah granularity; word granularity needs 4b) | Drag-range → merged hop list; root lens nearest-page-first | [loop-5.md](decisions/loop-5.md) |
| 6a — Skin, editions, wayfinding | complete | Instant plain⇄tajweed toggle (identical geometry); jump anywhere; visited pages survive offline; Lighthouse ≥90 | [loop-6a.md](decisions/loop-6a.md) |
| 6b — Pin-a-juz packs | **gated on 4b** (→ follow-up ①) | Airplane-mode revision of a pinned juz works after 8+ days | — |
| 7 — Polish + beta | pending (after 3+5+6) | Hafiz revision session, zero friction notes → **web v1.0** | — |
| Track B — Capacitor | gated on web v1.0 | Same web build wrapped for iOS/Android; Universal Links | — |

### Open follow-ups

1. **On-device perf verdict** (formerly external-tracker task #24) — decide
   inline-SVG-everywhere vs content-visibility virtualization vs raster-glyph fallback.
   The emulated baseline (~8.3 ms/frame, flat under CPU throttle) cannot see the real
   risks: initial raster of a 170 KB inline SVG on a low-end phone, and re-raster on zoom
   past the layer's backing store. **To run it: `make validate CHECK=perf-verdict-on-device`**
   — the phone measures itself, no cable and no DevTools. The old recipe (pair over USB,
   enable Web Inspector, find the timeline) is a fair description of why this sat open for
   six loops: a check that expensive to run is a check that does not get run. The probe
   ([`src/perf/probe.ts`](../apps/web/src/perf/probe.ts)) is behind a build-time flag and
   never enters a shipped bundle. **Gates Loop 4b only**
   (page vendoring + streaming — the rendering-scale decision). Loop 4a (edge data) is
   pure data work, orthogonal to the rendering verdict, and proceeds ungated; Loop 6
   inherits the gate through 4b.
2. ~~**License confirmation**~~ — **substantially closed 2026-07-26**, and it caught a
   live defect. The overlay half is now read at the source rather than summarised:
   quran-svg's own contributions are **CC0 1.0**, which is the half the resolver depends
   on and it carries no obligation at all. The Complex's terms are read from that repo's
   [`NOTICE.md`](https://github.com/quranpedia/quran-svg/blob/main/NOTICE.md), which
   quotes them verbatim and cites Royal Decrees 136/8 and 9/B/46356 — the restriction is
   on **printing physical masahif for commercial sale**, not on digital or commercial use.
   The primary-source glance at [qurancomplex.gov.sa](https://qurancomplex.gov.sa) is
   still owed and still trivial: the origin refused connections from this environment
   (`ECONNREFUSED`, both `/en/` and `/en/terms/`) and the Wayback mirror is not fetchable
   here, so it needs an ordinary browser — `make validate CHECK=kfgqpc-terms-primary-source`.
   Nothing in the build depends on the answer.
   **The defect:** the colophon shipped in `74d5226` told every reader the mushaf pages
   were "إتاحة حرّة للاستعمال غير التجاري" — *non-commercial use only*. That is the
   **Libyan Endowments** edition's term, carried over to an edition we do not vendor; it
   claimed a restriction on the artwork that its publisher does not impose. Corrected in
   [`Colophon.tsx`](../apps/web/src/components/Colophon.tsx) and
   [`SOURCES.md`](../SOURCES.md). Worth naming as a pattern: a licence *summary* written
   into user-facing copy is a claim about someone else's terms, and the failure mode is
   silent — a too-strict paraphrase reads as caution and nobody files a bug about it.
   **Still live, for a later loop:** the **Libyan Endowments** editions (Qālūn/Warsh)
   *are* non-commercial-only, and commercial use needs the Ministry's prior approval —
   so `EditionPicker` may not grow one of those rows on the strength of `hafs-kfqc`'s
   terms. Per-edition licence review, per the Loop 0 gate.
3. Loop-assigned deferrals (already scoped in their loop sections; details in the decision
   records): full corpus vendoring + QUL validation → Loop 4b; **word-granularity roots +
   `?w=` UI → after 4b**; **word-granularity tajweed painting → after 4b** (the spans are
   already vendored verbatim, so it is a rendering change, not a data change); **hafiz
   sign-off on the tajweed skin → Loop 7** (the beta label stays until then). **Done:**
   golden-image visual regression, Lighthouse CI, and the **⬡ chip vs ⬡ lens** collision —
   all Loop 6a ([loop-6a.md](decisions/loop-6a.md)); marquee drag-select (Loop 5);
   per-polygon a11y labels + keyboard hop path (Loop 3); `navigateTo` animation (Loop 2).
4. **On-device VoiceOver/TalkBack pass** (Loop 3 exit named it; automated axe + the
   keyboard hop tour cover the machine-checkable floor, both green in CI). The manual
   screen-reader gesture walkthrough on a real iOS/Android device is the remaining
   confirmation — `make validate CHECK=screen-reader-walkthrough`, run alongside
   follow-up ① on the same phone, **before Loop 7**.
5. ~~**Hifth's own license**~~ — **DECIDED 2026-07-25: GPL-3.0-or-later.** Opened by Loop 5,
   which vendored the [Quranic Arabic Corpus](https://corpus.quran.com/download/) morphology
   (**GPL + its own terms of use** — *not* CC-BY-SA, as this plan previously said; corrected
   in `SOURCES.md` and [loop-5.md](decisions/loop-5.md)) and so made the derived root shards
   a GPL-covered derivative work under a strict reading. The stated goal was that
   improvements come back, so: copyleft. **The plain GPL, not the AGPL** — a fully static,
   backend-free PWA hands the browser its whole bundle, so a modified deployment already
   *conveys* the code and owes its users source; §13 closes a network-service hole this
   architecture does not have. Licensing our code GPL also collapses the code/data seam, so
   the story is "GPL, except vendored assets under their own terms". Shipped as `LICENSE`
   (canonical gnu.org text, SHA-256 `3972dc97…b36986`) plus
   [`LICENSES.md`](../LICENSES.md), the per-path map.
   ~~**One live obligation, earlier than "public beta":**~~ — **discharged in the app**
   (`74d5226`). Publishing the site *is* distribution: a static app hands the browser real
   copies of `assets/roots/**`, so §6 owes whoever loads the page the Corresponding Source
   **for that build**. The commit is resolved at build time (`CF_PAGES_COMMIT_SHA` →
   `GITHUB_SHA` → `git rev-parse HEAD` → `"dev"`) and baked in through
   [`vite.config.ts`](../apps/web/vite.config.ts) →
   [`src/provenance.ts`](../apps/web/src/provenance.ts), so the link points at *that tree*
   rather than at a branch that moves under the reader; with no commit to name it degrades
   to the repository root instead of minting a link to nothing. It surfaces in
   [`Colophon.tsx`](../apps/web/src/components/Colophon.tsx), opened from the wordmark —
   the chrome already carries ⌖, ▤, the skin switch and its legend, and a fifth
   control would cost stage height on a phone. The same sheet finally pays the three
   attributions the vendored data has been owed since Loop 4a (corpus.quran.com's mandatory
   link, quran-tajweed's CC BY, the mutashabihat licence's "mention in your app"), which is
   the surface `SOURCES.md` has been promising.
   ~~**Still true, and now the only thing standing between us and the deploy:**~~ —
   **discharged 2026-07-29.** The offer is only real if `SOURCE_REPO` resolves, and it did
   not: the repository was private, so the colophon named an address that 404s to everyone
   who is not us. **The repository is now public**, which was one of the two ways out —
   repointing that one constant at wherever the source is actually served was the other, and
   nothing else in the code changes either way. Followed anonymously, the repo root, the
   exact build tree and all four attribution links now resolve; recorded in the ledger with
   `make record`. **The deploy is no longer blocked on licence grounds.**
   **`make source-offer` answers this in seconds** — it follows the offer with no `gh`, no
   token and no credentials, deliberately, because signed in as ourselves a private repo
   looks exactly like a public one and the check would have passed every day it was wrong.
   That is the shape of the whole obligation: it can only be tested by ceasing to be
   privileged. `make source-offer URL=<deployed>` additionally reads `SOURCE_REPO` and the
   build's commit out of the deployed bundle, so it checks what a reader is handed rather than
   what the branch declares. The half a machine cannot do — that a reader can *reach* the offer
   from inside the running app — stays at `make validate CHECK=source-offer-resolves`.
6. ~~**`--ink-faint` contrast sweep**~~ — **closed** (`68746bf`). The token was redefined
   `#9c9284` → `#6b6255`, clearing 4.5:1 on all four surfaces it lands on; fixing it at the
   token rather than across 23 call sites, since every one of them is a `color:`.
   The sweep is not by hand and not axe: `e2e/contrast.spec.ts` opens **eleven** surfaces and
   measures each with `e2e/contrast.ts` (WCAG luminance, compositing semi-transparent layers
   to find the colour actually behind the text). Axe could not do this job — it filed most of
   this app's chrome under `incomplete` as `nonBmp` (every glyph control) or
   `shortTextContent` (every hop count), and `incomplete` never fails a build. **Any new
   sheet or popover needs a row in `SURFACES` or nothing is checking it.**
7. **The merge pass is a step, not a formality.** Loop 6a ran three agents into one tree and
   the protocol held — no lost edits, no rebase — but the defect it produced was *semantic*
   and existed only once both halves were mounted (two in-flow chrome strips, each correct
   alone, together eating a third of a phone's stage). Composition defects are invisible
   until the whole product runs at once, so **every parallel loop budgets a merge pass with
   its own `make ci` + `make e2e` on the merged tree** before the decision record is written.
   See [loop-6a.md](decisions/loop-6a.md) §The merge pass.
8. **The tajweed golden row** — the `SKINS` axis in `e2e/golden.spec.ts` is a live seam with
   one entry. Adding tajweed is gated on **two** preconditions, both of which must hold:
   the hafiz sign-off on the palette (or the gate's first firing is an expected wall of red
   that teaches everyone to `--update-snapshots` past it), and a **test-only** way to drive
   the skin — a production-readable `skin=` param would ship a shareable link that turns a
   beta annotation layer on for a reader who never saw the badge. Opened by Loop 6a;
   **after Loop 7's sign-off**. See [loop-6a.md](decisions/loop-6a.md) §Deferred.

**The half of these a machine cannot run now has a register — and a runbook.** Follow-ups
① (the phone), ② (the browser glance) and ④ (VoiceOver/TalkBack) still wait on a human, and
prose cannot answer "is that still true, on what device, and when?" — ⑤ (does the source
link resolve for a stranger) was answered on 2026-07-29 and is the register's first closed
entry, which is the point: it is *recorded*, with the commit it was true at, rather than
remembered. Each is an entry in
[`docs/validation/ledger.json`](validation/ledger.json) carrying what it blocks, what its
result **tunes**, and the steps to run it with what to expect on screen at each one. That
runbook renders three ways — `make validate CHECK=<id>` here, `make guide` to a phone-shaped
page served over the LAN, and the `validate` skill drives the session — so it is written
once and cannot drift. A fourth reader is also a writer: `make validate-auto` runs the half
of those steps a command can now do and writes down what happened, so nobody walks a step a
machine has already walked. `gate:validation` fails if the ledger starts lying, including a
pending human check nobody could follow. Recording a result is `make record`, not a
paragraph edit here — see §Testing plan.

### Where it deploys

**GitHub Pages, at <https://blog.bytesofpurpose.com/hifth/>, on every push to `main` that
clears all four CI jobs.** Nothing else publishes; there is no path in this repo that serves
bytes no gate has seen. The deploy job downloads the artifact `build-test-gate` uploaded
rather than rebuilding, so what a reader is handed is literally what the budget gate weighed
and the ETL determinism check matched against the committed assets.

Two things made this a workflow file and not a project. **Nothing in the app needed changing
for a `/hifth/` subpath** — `base: "./"`, a `start_url` and `scope` of `"./"`, and hash
routing were all already in place. And the hash routing in particular was chosen for share
links (a teacher pastes one; it cold-opens on the exact view), which happens to mean a deep
link never asks the server for a path it does not have — so GitHub Pages' total lack of
rewrite rules, normally disqualifying for an SPA, costs nothing here. A convention adopted
for one reason decided which hosts Hifth can live on.

**Cloudflare Pages stays available and stays live**, because the host is the kind of decision
that gets revisited and the worst moment to work out how to publish is the moment you need
to. Same workflow, same artifact, chosen rather than automatic: Actions › CI › Run workflow ›
`target: cloudflare`. Off CI entirely there is `make deploy-cloudflare`, which refuses on a
dirty tree — the bundle bakes the commit its reader is offered under §6 (follow-up ⑤ above),
and publishing uncommitted work would offer corresponding source that does not correspond.
The one thing the alternative host has that the default does not is `public/_headers`; the
note in that file explains why losing it costs almost nothing once a service worker is doing
the caching.

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

**This tree is the plan, not the map.** It was written before the code and says what
was *intended*; nothing fails when the code moves away from it. For where a feature
actually lives today — the ordered path through it, how to extend it, and which gates
judge it — run `make map` (`make map FEATURE=<id>` for one). That reads
[`docs/map.json`](map.json), whose every pointer is checked by `gate:map` on each push
and by the pre-commit hook on the files you staged, so it is true or the build is red.
The `extend` skill ([`.claude/skills/extend/SKILL.md`](../.claude/skills/extend/SKILL.md))
drives that walkthrough. Same rule as the validation ledger: one source, N renderers, and
this document names the command instead of restating it.

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
   *Re-checked 2026-07:* Safari 18+ supports `content-visibility` and mid-2026 releases
   fixed several of its bugs (find-in-page in skipped content, visible→hidden repaint —
   see [Safari release notes](https://releasebot.io/updates/apple/safari)), but the
   [SVG-`<text>`-never-paints bug](https://dev.to/bryce/a-gnarly-svg-visibility-bug-2j68)
   has no confirmed fix — the no-`<text>` CI guard stays.
2. **Inline SVG at scale is unproven** (no major Quran app does it). Loop 1 runs a
   real-device perf spike; the architecture keeps a **raster-fallback escape hatch**
   (rasterize glyph layer, keep only the polygon hit layer as DOM) behind the unchanged
   highlighter API.
3. **@use-gesture + mandatory `touch-action`**; apply the `pinching`/`cancel()` split.
4. **Offline: quota is a non-issue (~60% disk); eviction is the issue.** iOS install is a
   prerequisite for durable offline (ITP 7-day deletion; installed apps exempt) → the
   install prompt is a first-class iOS feature. Call `persist()`, verify with
   `persisted()`, degrade gracefully. Detect Chrome's clear-on-exit ~300 MB cap. Ignore
   obsolete "Safari 1 GB / 50 MB" numbers. *Re-verified 2026-07 — still current:* the
   7-day script-storage deletion applies to Safari-tab usage only; Home-Screen web apps
   keep [their own days-of-use counter](https://developer.apple.com/forums/thread/710157)
   and are exempt; [`persist()`](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist)
   is still not documented to stop the ITP timer (see also this
   [2026 iOS-PWA survey](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)),
   so install — not `persist()` — remains the durable-offline mechanism on iOS.
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
- **Edge spot-audit (human):** weekly during Loops 4–7, 20 sampled pairs vs a printed
  mushaf; a hafiz signs off mutashabihat diffs before v1.0. Tajweed skin ships behind a
  "beta" flag until hafiz approval. The runbook is `edge-spot-audit` in
  `docs/validation/ledger.json` — read it with `make validate CHECK=edge-spot-audit`.
  Draw with `make audit-edges N=20 SEED=1`: seeded, so a round can be re-run or handed
  to a second reader, and **stratified** by type × provenance × page distance, because
  97% of the corpus is one class and a flat draw of twenty essentially never shows the
  classes no gate covers. `make validate` prints which classes have never been looked at.
- **License gate:** build fails if any source lacks a `SOURCES.md` entry.

### How a manual result becomes a permanent test

The checks a machine cannot run are the expensive ones, and until now their results
lived only as prose in decision records — which cannot answer "is that still true, on
what device, and when?" without reading four documents. Two gates close that loop:

- **`gate:verified-edges`** — every human verdict about an edge, enforced forever.
  `correct` edges must keep shipping; **`wrong` edges must stay gone**, which is the
  half that pays: a rejected edge nobody wrote down returns on the next data refresh
  and costs that reader's time again, and no automated check can tell a wrong edge
  from a right one.
- **`gate:validation`** — the ledger at [`docs/validation/ledger.json`](validation/ledger.json):
  every manual check, what it blocks, what it **tunes**, and the runbook to run it. It does
  *not* fail on outstanding work (a phone nobody has held yet is a fact, not a broken build,
  and a permanently red gate teaches everyone to ignore it); it fails when the ledger lies —
  a `done` with no recorded result, an expired recurring check, a check that tunes nothing,
  or a pending human check with no runbook. `make validate` prints what the project is
  waiting on and what each blocks.

**Running one.** These checks happen with a phone in your hand, so the instructions have to
reach the phone: `make guide` renders the ledger to
[`docs/validation/guide.html`](validation/guide.html) and serves it over the LAN — one card
per check, every step paired with what you should **expect** to see, a screenshot of the
screen the step is describing, and checkboxes that survive a screen lock. The screenshots
are captured from the real build by `make shots`, never pasted in by hand — prose about a
screen is not the screen, and a hand-cropped picture is a second copy of the UI that drifts
silently. `make validate CHECK=<id>` prints the same runbook here;
`make record CHECK=<id> RESULT='…'` banks the verdict, regenerates the guide, and prints the
`tunes` work now owed. One source, three renderers — a runbook restated anywhere else drifts
silently, so this document deliberately names ids instead of steps.

**Run the machine half first.** Parts of these checks stopped needing a human as the
follow-ups landed, and a check may say so: an `evidence` block naming one command, the
runbook step **ids** it discharges, and — required — the `residue` it cannot.
`make validate-auto` runs those commands and writes the real exit code into
`docs/validation/evidence/`, which is what strikes a step off the terminal and the phone.
A run is written, never asserted, and exit 3 ("could not tell") discharges nothing — a
producer that could not reach its subject has proved nothing, and treating that as a pass
is how an automated run comes to look like it did someone's job. The rest is the point:
`gate:validation` rejects an `evidence` block that names no remainder.

**The rule:** a manual result must tighten something automated — a threshold, a
fixture, or a new gate. A check that feeds nothing has to be re-run by hand forever,
and it won't be. The full catalogue of every tier, in cost order, with the traps, is
the `validate` skill: [`.claude/skills/validate/SKILL.md`](../.claude/skills/validate/SKILL.md).

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

### Loop 3 — Diffs, share links, a11y pass (medium) — ✅ complete ([loop-3.md](decisions/loop-3.md))
`DiffView` (token diff, twin label, ctx continuation); hash router = spec §7 via
`serializeState`/`restoreState` (same path as live hops); `via`/`trail`/`w`/range forms;
`ShareSheet` (Web Share API + clipboard fallback). A11y: SVG `role="group"` + labels (an `img`
can't hold focusable ayah buttons — axe caught it), per-polygon `aria-label` + keyboard hop path;
VoiceOver/TalkBack on-device check → deferred to follow-up ④ (automated axe + keyboard tour green).
**Exit:** cold-opening a teacher link restores exact view incl. trail; screen reader announces ayahs and hops.

### Loop 4a — Edge-data ETL (medium, pure data work — **ungated**)
*Why the split (2026-07-25 grounding):* edge data is key-space math — it never touches the
rendering hot path, so it does not need the perf verdict (follow-up ①) that gates page
vendoring. Sources verified live:

- **Primary edges:** [Waqar144/Quran_Mutashabihat_Data](https://github.com/Waqar144/Quran_Mutashabihat_Data)
  — `mutashabiha_data.json` with `src` (absolute ayah number or array), `muts` (matching
  absolute ayah numbers), `ctx` (show-context flag; maps to our ctx-continuation line in
  DiffView). License: permissive custom ("free to use as you see fit", attribution
  appreciated) → record verbatim in `SOURCES.md` and put the credit in the app's about
  screen. Battle-tested by the author's own
  [quran_memorization_helper](https://github.com/Waqar144/quran_memorization_helper).
  ETL converts absolute ayah numbers → canonical `quran/<edition>/S:A` keys via the
  known 6236-ayah surah table (already in `keys.ts` domain).
- **Anchor cross-check:** [QUL mushaf layouts](https://qul.tarteel.ai/resources/mushaf-layout)
  (SQLite downloads). Three Madani KFGQPC layouts exist — **V1/1405H (id 15), V2/1421H
  (id 10), V4/1441H (id 19)**; first 4a task is to sample-match our quran-svg pages
  against them to pin *which print* our corpus is, then vendor that layout DB as the
  reconciliation source. Ayah→page agreement is the gate; line-level data is not needed.
- **Demoted: QurSim** ([LREC 2012](https://aclanthology.org/L12-1051/)) — the grounding
  pass showed it is *semantic relatedness* (7,679 verse pairs graded 0/1/2, derived from
  Ibn Kathir), **not** lafẓi mutashabihat, and has no canonical download endpoint. It is
  no longer a Loop 4 source; if it ever lands it is a separate reserved edge type
  (`related ⚯`), someday-scoped.

Work: full-corpus edge ETL → canonical keys → dedupe → dir annotations →
`adj/<surah>.json` shards for all 114 surahs; validation gates (100% of endpoints parse to
valid keys per the surah table — full anchor resolution moves to 4b where the pages exist;
shard <50KB gz; license entries). Edges to un-vendored pages stay surfaced-but-disabled
(the Loop 2 behavior) until 4b vendors the corpus.
**Exit:** `pnpm etl` deterministic in CI over the full mutashabihat dataset; every edge
endpoint a valid canonical key; all shards within budget; hop rail live on real data for
the 3 vendored pages.

### Loop 4b — Page corpus + streaming (large — **gated on follow-up ①**)
Vendor all 604 [quran-svg](https://github.com/quranpedia/quran-svg) Hafs/KFQC pages (CC0
overlay + KFQC free-use terms — see follow-up ②); anchors over all 604 pages,
cross-checked against the QUL layout DB pinned in 4a (fail on any surah/ayah/page
mismatch); **asset decision point:** evaluate the word-granular ligature corpus
([MushafDatabase](https://github.com/mushafdatabase/MushafDatabase-Ligature-Based-SVG) is
a candidate) — its resolver adapter fits behind the same L2 API. Page streaming:
fetch-on-demand, LRU ~6 pages, prefetch hop targets + adjacent pages; PWA caching of
visited juz.
**Exit:** every ayah navigable; 100% bidirectional anchor resolution; first-page TTI
<2.5s mid-Android.

### Loop 5 — Highlight gesture + root lens (medium)
`gestures.ts` marquee/pan split (touch-action zones + intent thresholds); amber wash;
`HighlightMenu` (merged deduped edges of the range, range-form copy link); roots ETL
([Quranic Arabic Corpus](https://corpus.quran.com/download/) — **GPL + terms of use**,
attribution mandatory; QUL morphology rejected, no license stated) + `RootLens` (page-distance sort, lemma
sub-groups). Word-granularity if Loop 4b adopted the ligature corpus; ayah-fallback
otherwise — Loop 5 can start after 4a (edges exist) and upgrade granularity when 4b lands.
**Exit:** drag 2:47–2:48 → menu → merged hop list; word/ayah → root lens nearest-page-first.

### Loop 6 — Offline + skin + editions (medium)

Split for the same reason Loop 4 was: **pinning a juz is meaningless while three pages are
vendored**, so the pack machinery inherits 4b's gate, while everything else is ungated and
ships now.

#### Loop 6a — Skin, editions, wayfinding, offline foundation (ungated)
Tajweed ETL (rule spans → element-ID class maps → `skins/`); `setSkin` swap; color-blind
palette; **"beta" flag until hafiz sign-off**. `EditionPicker` + concordance. Surah/juz/ayah
jumper; onboarding coach marks; keyboard map (arrows = pages, `/` = jumper). Service worker:
precache shell + registry, runtime-cache visited pages/shards. iOS install-prompt flow (the
ITP 7-day rule makes install a feature, not a nicety). `navigator.storage.persist()` +
`persisted()` with the graceful-denial UI and Chrome clear-on-exit detection — the *API
surface and its failure paths*, which are testable today. Golden-image regression harness
(moved from Loop 5; the amber wash and marquee need it). Lighthouse CI gate. Resolve the ⬡
collision (rail chip = curated shared-root edges vs lens = corpus-wide roots).
**Exit:** instant plain⇄tajweed toggle with identical geometry; jump to any surah/juz/ayah;
visited pages survive a reload offline; Lighthouse ≥90.

#### Loop 6b — Pin-a-juz packs (gated on 4b, i.e. on follow-up ①)
Juz packs over Cache Storage + an IndexedDB manifest; eviction detection and re-pin offer;
the **8+ day ITP offline survival test** (installed vs tab); iOS standalone
state-restoration test.
**Exit:** airplane-mode revision of a pinned juz works after 8+ days.

### Loop 7 — Hifz polish + beta (ongoing) → web v1.0
5–10 huffaz/teachers; interview, don't instrument (privacy-respecting counts only). Weekly
data-QA (20 sampled pairs vs printed mushaf, hafiz sign-off on diffs). Popover ordering
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
  column carries the sequencing (linear through Loop 2; Loops 3 & 4a open after Loop 2;
  4b gated on follow-up ①; Loop 5 after 4a; Loop 6 after 4b; Loop 7 waits on 3+5+6;
  Track B gated on web v1.0).
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
- **Loop 4a** — inline ETL code; per-surah shard validation is a small fan-out candidate.
- **Loop 4b** — the natural **Workflow fan-out**: per-surah anchor validation,
  cross-source reconciliation vs the QUL layout DB, and golden-ayah checks parallelize
  cleanly; the ETL pipeline code itself stays inline.
- **Loops 5–6** — inline feature work; Loop 6's offline/eviction matrix is a manual
  device checklist, not an agent job.
- **Loop 7** — inline polish; the 5-page golden-image sweep is a small fan-out candidate.

**Several agents writing one tree at once** — the Loop 6a configuration — has its own
protocol: [`PARALLEL-AGENTS.md`](PARALLEL-AGENTS.md). Two rules carry it (take the lock for
anything that builds or stages; commit by explicit path, never `--no-verify`), and the
merge pass in follow-up ⑦ is the third. Everything in that file is a Loop 6a failure
written down, including the thirty minutes of deadlock and the composition defect that no
single agent could see.

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
