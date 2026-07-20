# Hifth — Reconciled Implementation Plan (loops × delivery plan × deep research × frontend-design)

## Context

Hifth (حفظ) is a pure navigation web app for huffaz: tap/highlight an ayah on real mushaf
SVG pages → hop to similar verses. The repo now holds two plans from different directions:
`docs/PLAN.md` (our loop-based plan) and `~/Downloads/linker-delivery-plan.md` (the design
conversation's week-numbered delivery plan, web track + iOS Capacitor track). This plan
reconciles them, folds in a 104-agent deep-research pass (workflow `wf_a42db314-202`,
22 verified claims), and applies `/frontend-design` practices. Outcome: one plan of
record in `docs/PLAN.md`, then Loop 0 can start.

## Compare & contrast (summary — user asked for this explicitly)

**Agreements (adopted as-is):** spec v0.9 as contract; immutable assets + single
SVG-aware highlighter layer; framework-free TS core; static-first, no backend;
Vite + strict TS + Vitest/Playwright; CI licensing gate; PWA offline; hafiz field-testing;
reserved edge types.

**Differences → resolutions:**

| Axis | Loops plan | Delivery plan | Resolution |
|---|---|---|---|
| Process | 8 vertical loops, product exists after Loop 2 | Week-numbered, ETL-first, UI at wk 8 | **Loops win** (user requirement); delivery milestones become loop exit criteria |
| Asset corpus | Decide in Loop 4 | Lock word-level-primary wk 1 | Word-level as working assumption; **validated by a Loop 1 spike** (research supports caution — see below) |
| Repo shape | Single app + lint boundary | Monorepo (etl/highlighter/app/data) | **Light pnpm workspace**: `packages/core`, `packages/etl`, `apps/web` — pays off for the Capacitor track |
| Native | Out of scope | Capacitor iOS wk 12–18 + Android | Keep as **gated Track B** after web beta stabilizes |
| Budgets | Soft | JS <150KB gz, TTI <2.5s mid-Android, shards <50KB gz, Lighthouse ≥90, LRU ~6 pages | **Adopt all**, in CI from Loop 0 |
| UX furniture | Core loop only | Jumper, coach marks, offline juz packs, golden-image tests, hafiz data-QA, VoiceOver labels | **Adopt all**, slotted into loops |
| Components | Explicit map (user req) | Absent | Keep ours |
| Name | Hifth | Linker | Hifth everywhere; delivery doc archived verbatim |

## Research findings → binding design rules

All verified (2/3+ adversarial votes) unless marked open. Full report to be committed as
`docs/research/2026-07-20-mobile-svg-pwa.md`.

1. **DOM budget is the #1 rendering constraint.** Lighthouse heuristics: >800 nodes warn,
   >1,400 excessive; one mushaf page (hundreds of polygons + glyph paths) can approach
   this alone. Rules: mount only current + adjacent pages; `content-visibility: auto` +
   `contain-intrinsic-size` for off-screen pages; scope highlight class toggles to small
   contained subtrees (INP protection). Safari 18+ has a paint bug with SVG `<text>`
   under content-visibility — safe for us only because quran-svg glyphs are outlined
   paths; add a CI check that no asset page contains `<text>`.
2. **Prior art red flag: no major Quran app ships inline-SVG pages.** quran_android =
   pre-rendered raster pages + glyph-bounds DB; quran.com = per-page QCF fonts via
   FontFace API (verified in their source). Inline interactive SVG is unproven at this
   scale on low-end mobile → **Loop 1 must include a performance spike on real low/mid
   hardware**, and the architecture keeps a **raster-fallback escape hatch**: rasterize
   the glyph layer per page, keep only the polygon hit layer as DOM (still asset-derived,
   highlighter API unchanged).
3. **Gestures: @use-gesture v10** (React hook + vanilla `Gesture` class — fits our
   framework-free core). Drag + pinch on one surface is its documented use; we must
   apply the `pinching`-flag/`cancel()` disambiguation and set `touch-action` CSS on the
   stage (without it, browsers fire `pointercancel` and native-scroll; preventDefault
   alone cannot stop it).
4. **Offline: quota is a non-issue; eviction is the issue.** Quotas are ~60% of disk on
   Chromium and Safari 17+/iOS 17+ (Home-Screen installs get the browser tier, not
   WKWebView's 15%). The old "Safari 1GB/50MB" limits are obsolete — do not design
   around them. Real risks: (a) Safari's ITP deletes ALL script storage for origins
   untouched for 7 days of browser use — Home-Screen-installed apps are exempt →
   **install prompt is a first-class feature for iOS users, not a nicety**; (b) LRU
   eviction under pressure → call `navigator.storage.persist()`, verify with
   `persisted()`, degrade gracefully (grants are silent/heuristic — WebKit grants
   primarily to installed apps); (c) Chrome's "clear site data on close" setting caps
   ~300MB — detect and warn when pinning juz packs.
5. **iOS deep-link caveat:** tapped web links cannot open an installed PWA on iOS —
   shared hop links open in Safari tabs. Acceptable (links still work), but "pin a juz"
   UX must live inside the installed app, and docs/onboarding shouldn't promise
   link-into-app on iOS.
6. **React + imperative stage:** the stage applies one combined
   `translate/scale` transform on the container (children never re-render on pan/zoom);
   React owns chrome only, never the SVG DOM — confirms our `PageStage`-hands-node-to-L2
   design. Felt's SVG→Canvas migration is the documented endgame if vectors fail —
   our raster-fallback rule (2) is the cheaper version.
7. **A11y floor (verified):** WCAG 2.2 target minimum 24×24 CSS px (our 44px budget
   exceeds it); SVG exposure pattern = `role="img"` + `aria-labelledby` on the svg,
   per-polygon `aria-label` ("Ayah 2:255, Al-Baqarah") + `tabindex` for keyboard hops.
8. **Verification gaps (treat as open, resolve empirically in loops):** RTL swipe/page-turn
   conventions of shipping mushaf apps (observe quran.com/Tarteel in Loop 1); VoiceOver/
   TalkBack behavior on polygon labels (test on-device in Loop 3); iOS standalone
   state-restoration quirks (test in Loop 6); real fps numbers for 400–800KB SVG pan/zoom
   (the Loop 1 spike answers this). Also: quran-svg's edition completeness FAILED
   verification — **audit the corpus page-by-page in Loop 0 ETL before trusting it**.
   Storage policies are volatile — re-verify before public beta.

## Frontend-design practices (applied, not aspirational)

- **Design tokens from Loop 0** (CSS custom properties): paper/ink neutrals so the mushaf
  artwork is the hero; tajweed + plain skins are token layers (matches spec's
  "skin = stylesheet swap").
- **Signature element:** the leaping arc-arrow + subha-bead trail (spec §9). One
  orchestrated motion moment — the hop (pan → land → pulse). Everything else quiet.
- **Type:** characterful Arabic display face for chrome (surah names, rail); quiet
  Latin/utility companion; mushaf glyphs are geometry, never restyled.
- **Copy rules:** user-side vocabulary (Hop, Trail, "Pin this juz"), active voice, one
  verb per flow end-to-end, errors say what to do next, empty states invite action.
  Bilingual chrome: Arabic-first labels with English support.
- **Quality floor, unannounced:** responsive to 320px, visible focus, reduced-motion
  respected, 44px targets, RTL-native layout (`dir="rtl"` root, logical properties).

## The plan

### Step 0 — Housekeeping (before any code)
1. `mv ~/Downloads/linker-delivery-plan.md docs/reference/linker-delivery-plan.md`
2. Create `.claude/settings.json` with `{"plansDirectory": ".claude/plans"}`
3. Commit the research report to `docs/research/2026-07-20-mobile-svg-pwa.md`
   (findings + caveats + open questions from wf_a42db314-202)
4. Rewrite `docs/PLAN.md` as this reconciled plan (single plan of record; README link unchanged)

### Loop 0 — Skeleton on a phone (small)
pnpm workspace: `apps/web` (Vite+React18+TS strict), `packages/core` (framework-free),
`packages/etl` (Node). ESLint + `import/no-restricted-paths` boundaries. Vitest;
Playwright with mobile emulation. CI: lint, test, **budget gates** (JS <150KB gz),
licensing gate reading `SOURCES.md`. Design tokens + `dir="rtl"` shell. Deploy
(Cloudflare Pages). PWA manifest + install prompt scaffold. Extract the mock's 3 pages
(7, 9, 19) + polygon metadata into `apps/web/public/assets/`; **audit quran-svg corpus
completeness** (research gap 8) and record licenses in `SOURCES.md`.
**Exit:** Hifth shell showing one page, deployed, installable, CI green with gates.

### Loop 1 — Select + the performance verdict (small, de-risks everything)
`packages/core`: `keys.ts`, `resolver.ts` (ayah-polygon adapter over the 3 pages'
`verse-N`/`number="SSSAAA"` attrs). `PageStage` mounts inline SVG; @use-gesture pan/zoom
with `touch-action` + pinch/drag disambiguation; tap polygon → highlight + `onSelect`.
**Performance spike (the loop's real product):** fps of pan/zoom + highlight toggle on a
mid/low Android and an older iPhone across the densest bundled page; decision recorded:
inline SVG everywhere / content-visibility virtualization / raster-glyph fallback.
Also: observe RTL page-turn conventions in quran.com + Tarteel, record decision.
**Exit:** tap-to-select works on-device; written perf verdict + RTL convention decision.

### Loop 2 — The hop (medium) ← product exists here
Adjacency shards for the mock's curated clusters; `adjacency.ts` (dir bucketing, hifz
popover ordering); `HopRail` (arc-arrow chips ↻◀▶ with counts), `HopPopover`,
`navigateTo` (cross-page load, pan, pulse; only current+adjacent pages mounted),
breadcrumb group, `TrailBeads`. Bottom-sheet popovers <900px; 44px targets.
**Exit:** tap 2:48 → rail → popover → hop to 2:123 cross-page → bead back, one-handed on a phone.

### Loop 3 — Diffs, share links, a11y pass (medium)
`DiffView` (token diff, twin label, ctx continuation). Hash router = spec §7 grammar via
`serializeState`/`restoreState` (same code path as live hops); `via`/`trail`/`w`/range
forms; `ShareSheet` (Web Share API + clipboard fallback). A11y: `role="img"`+labels,
per-polygon `aria-label` + keyboard hop path; VoiceOver/TalkBack on-device check.
**Exit:** cold-opening a teacher link restores exact view incl. trail; screen reader announces ayahs and hops.

### Loop 4 — Full corpus ETL (large, offline work)
`packages/etl`: anchors over all 604 pages (cross-check QUL layout DB; fail on mismatch);
edges (Waqar144 mutashabihat primary, QUL phrase ranges, QurSim secondary) → canonical
keys → dedupe → dir annotations → `adj/<surah>.json`; validation gates (100% endpoints
resolve, shard <50KB gz, licenses present). Word-level ligature corpus evaluated here —
resolver adapter behind same L2 API. Page streaming: fetch-on-demand, LRU ~6 pages,
prefetch hop targets + adjacent pages.
**Exit:** `pnpm etl` deterministic in CI; every ayah navigable; first-page TTI <2.5s mid-Android.

### Loop 5 — Highlight gesture + root lens (medium)
`gestures.ts` marquee/pan split (touch-action zones + intent thresholds), amber wash,
`HighlightMenu` (merged deduped edges, range links), roots ETL + `RootLens`
(page-distance sort, lemma sub-groups). Word-granularity if Loop 4 adopted ligature corpus.
**Exit:** drag 2:47–2:48 → menu → merged hops; root lens nearest-page-first.

### Loop 6 — Offline + skin + editions (medium)
Service worker: precache shell+registry; runtime-cache visited pages/shards; **pin-a-juz**
packs (Cache Storage + IndexedDB manifest) with `persist()` + `persisted()` verification,
graceful-denial UI, Chrome clear-on-exit detection; iOS install prompt as first-class
flow (ITP 7-day rule). Tajweed ETL → `skins/`, `setSkin` swap, color-blind palette,
"beta" flag until hafiz sign-off. `EditionPicker` + concordance. iOS standalone
state-restoration test. Onboarding coach marks; surah/juz/ayah jumper.
**Exit:** airplane-mode revision of a pinned juz works after 8+ days; instant skin toggle; Lighthouse ≥90.

### Loop 7 — Hifz polish + beta (ongoing)
5–10 huffaz/teachers; interview, don't instrument (privacy-respecting counts only).
Weekly data-QA: 20 random edges vs printed mushaf, hafiz sign-off on diffs. Keyboard map
(arrows=pages, `/`=jumper). Golden-image tests on 5 pages. → **web v1.0**.

### Track B (gated on stable web beta) — Capacitor iOS, then Android
Wrap `apps/web`; bundle full corpus in-app; native share sheet, Universal Links (solves
research finding 5 — links open the app), haptics, state restoration; iPad two-page
spread; App Store review notes lead with KFGQPC provenance. Android fast-follow.

## How to kick off a loop

Each loop starts with one self-contained prompt to Claude Code. The template:

```
Start Loop <N> of Hifth. Read docs/PLAN.md (§Loop <N>) and docs/reference/linker-spec.md
first. Scope: exactly the Loop <N> deliverables — do not pull work forward from later
loops. Definition of done: the Loop <N> exit criterion, the testing-plan tiers that
apply to this loop passing in CI, and a demo I can open on my phone. Finish by writing
docs/decisions/loop-<N>.md (what was decided, measured, and deferred) and telling me
exactly what to check on my phone.
```

Loop 0's concrete kickoff prompt (usable as-is once this plan is approved):

```
Start Loop 0 of Hifth. Read docs/PLAN.md §Loop 0. Set up the pnpm workspace
(apps/web = Vite+React18+TS strict, packages/core, packages/etl), ESLint layer
boundaries, Vitest + Playwright mobile, CI with the JS-budget and SOURCES.md license
gates, design tokens + RTL shell, PWA manifest, and Cloudflare Pages deploy. Extract
the three mushaf pages and their polygon metadata from docs/reference/linker-mock.html
into apps/web/public/assets/, audit the quranpedia/quran-svg corpus for completeness,
and record source licenses in SOURCES.md. Done = deployed installable shell showing
page 7 with CI green; write docs/decisions/loop-0.md and give me the URL to open on
my phone.
```

Rules that make the prompts work: `docs/PLAN.md` (rewritten in step 0) is the single
source the prompt points at; every loop ends by writing `docs/decisions/loop-<N>.md`,
so the next loop's prompt needs no conversation memory; exit criteria live in the plan,
never in the prompt, so prompts stay short and the plan stays authoritative.

## Task-tool convention (two levels)

The task tools are used at two levels so the list never becomes either too coarse to be
useful or a stale wall of 200 items:

- **Roadmap level (created now, one task per loop).** Tasks #1 (step 0) and #2–#10
  (Loops 0–7 + Track B) exist as the durable backbone, wired with `blockedBy` so the
  list enforces sequencing: linear through Loop 2, then Loops 3 and 4 both open after
  Loop 2 (a11y/share parallels ETL), Loops 5–6 depend on the ETL, Loop 7 (web v1.0)
  waits on Loops 3+5+6, and Track B is gated on Loop 7. These stay `pending` and are the
  map of the whole project.
- **Execution level (created at the start of each loop, not now).** When a loop actually
  begins, its kickoff prompt directs Claude to `TaskGet` the loop's roadmap task, mark it
  `in_progress`, and break it into granular sub-tasks (one per deliverable in that loop's
  plan section) — created fresh in that session, closed as they land, with the roadmap
  task marked `completed` only when the loop's exit criterion and its testing-plan tiers
  pass. Discovered work becomes new sub-tasks rather than silent scope creep.

Why not enumerate every sub-task now: the plan sections already hold that detail, and
sub-tasks written before a loop starts go stale (the Loop 1 perf verdict reshapes Loops
4–6). The roadmap tasks carry the commitments; the plan carries the detail; each loop
generates its own working list. Rule for execution sessions: exactly one roadmap task
`in_progress` at a time; never mark a loop `completed` with failing tests or a partial
exit criterion (keep it `in_progress` and add a task naming the blocker).

## Testing plan

One principle: **the data is scripture — data correctness is tested harder than code.**
A wrong hop or a mislabeled ayah is a product-breaking bug for this audience.

### Test pyramid by layer

| Layer | What | Tool | When |
|---|---|---|---|
| `packages/core` unit | `keys.ts` parse/format round-trip (property-based: every valid key survives parse→format→parse); resolver lookups incl. misses; adjacency bucketing (↻◀▶ boundaries: dSurah 0/±1, same-page/juz refinement); router grammar — every §7 link form round-trips through serialize/restore | Vitest (+ fast-check for the grammars) | every push, Loop 1 on |
| Highlighter contract | Spec §3 API against fixture SVG pages in jsdom/happy-dom: highlight/clear group isolation (breadcrumb never clobbers selection), navigateTo mounts ≤ current+adjacent pages, setSkin adds/removes classes without touching geometry, events fire with correct keys/granularity | Vitest + fixture pages (extracted mock pages 7/9/19) | every push, Loop 1 on |
| Component | Each component in `components/` renders from fixture data: rail counts match adjacency, popover ordering follows hifz sort, diff view output for known pairs (2:48 vs 2:123 = شفاعة/عدل swap), reserved edge types render nothing | Vitest + Testing Library | as each component lands |
| E2E core loop | Scripted hop tours on the real app: tap → rail → popover → cross-page hop → bead back; drag-highlight → menu → merged hops; cold-open every §7 link form and assert restored state | Playwright, iPhone + Android viewports, touch enabled | CI smoke on every push; full tour nightly |
| Visual regression | Golden screenshots: 5 sample pages × (plain, tajweed) × (selection, phrase, breadcrumb, marquee highlights) — catches geometry/skin regressions the DOM can't | Playwright toHaveScreenshot | Loop 2 on |
| Perf | Loop 1 spike formalized into CI: trace pan/zoom + highlight-toggle on the densest page, assert frame budget; TTI <2.5s (throttled mid-tier profile); JS <150KB gz; shard <50KB gz | Playwright traces + Lighthouse CI | budgets Loop 0; traces after Loop 1 verdict |
| A11y | axe-core automated pass on every screen; keyboard-only hop tour in Playwright (tab → select ayah → open rail → hop → back); manual VoiceOver (iOS) + TalkBack (Android) script each loop exit from Loop 3 | axe + Playwright + manual checklist | Loop 3 on |
| Offline | Playwright with SW: pin a juz → go offline → navigate/hop within it; simulate eviction (clear Cache Storage, keep IndexedDB manifest) → app detects and offers re-pin; persist() denial path renders the warning UI | Playwright offline mode | Loop 6 |

### Data/ETL testing (the scripture layer)

- **Determinism:** two consecutive `pnpm etl` runs are byte-identical (hash outputs in CI).
- **Resolution gate:** 100% of edge endpoints resolve in anchor tables; 100% of SVG
  polygons appear in anchor tables (both directions — no orphans either way).
- **Cross-source reconciliation:** anchors cross-checked against QUL layout DB; any
  surah/ayah/page disagreement fails the build with a diff report.
- **Golden ayahs:** a hand-verified fixture set (~30 ayahs spanning first/last of surah,
  juz boundaries, sajda marks, page 1 and 604) asserted against anchors every ETL run.
- **Edge spot-audit (human):** weekly during Loops 4–7, 20 random edges vs a printed
  mushaf; a hafiz signs off mutashabihat diffs before v1.0. Tajweed skin ships behind a
  "beta" flag until hafiz approval of sample pages.
- **License gate:** build fails if any data source lacks a `SOURCES.md` entry.

### Device matrix (manual, each loop exit)

Primary: mid-tier Android (the TTI budget device) + user's iPhone, both installed-PWA and
browser-tab modes. Secondary each ~2 loops: small phone (320px), iPad/tablet, desktop.
The 8+ day ITP offline survival test (installed vs tab) runs once during Loop 6.

## Files created/modified in step 0 + Loop 0

- `docs/PLAN.md` (rewrite), `docs/reference/linker-delivery-plan.md` (moved in),
  `docs/research/2026-07-20-mobile-svg-pwa.md` (new), `.claude/settings.json` (new)
- `pnpm-workspace.yaml`, `apps/web/*`, `packages/core/*`, `packages/etl/*`,
  `SOURCES.md`, `.github/workflows/ci.yml`
- Reuse, don't rewrite: highlighter logic + adjacency data extracted from
  `docs/reference/linker-mock.html` (its HL module and curated clusters are the Loop 1–2
  starting point); resolver reads quran-svg's own `verse-N`/`number` attrs.

## Verification

- The Testing plan section above is the verification contract: its CI tiers gate every
  push, its manual tiers gate every loop exit.
- Every loop exits only after an on-device check (real phone or Playwright mobile
  emulation) of its exit criterion, listed above per loop.
- Loop 1's perf spike and Loop 6's 8-day offline test are explicit go/no-go measurements,
  written down in `docs/decisions/`.
