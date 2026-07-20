# Linker (رابط) — Delivery Plan
## From spec + mock → production web app (desktop & mobile) → iOS app

Companion documents: `linker-spec.md` (contracts & data shapes) · `linker-mock.html`
(working three-page prototype) · `linker-architecture.html` (system diagram).
This file is the execution plan: what gets built, in what order, by which milestone.

Guiding constraints (unchanged from spec):
- Existing SVG assets only, never modified — one SVG-aware layer (the Highlighter)
- Pure navigation instrument for huffaz; no reader features
- Static-first: no backend required for v1; everything deployable to a CDN
- Every edge carries provenance; reserved edge types (hadith/tafsir/lexicon) are
  placeholders from day one

---

## Track A — Production web app (desktop + mobile browser)

### A0. Repo & foundations (week 1)
- Monorepo: `packages/etl` (Node/Python scripts), `packages/highlighter`
  (framework-free TypeScript lib), `packages/app` (UI), `packages/data` (build output,
  git-ignored, published to CDN).
- Tooling: TypeScript strict, Vite, Vitest + Playwright, ESLint. CI on every push runs
  ETL validation gates + unit + e2e smoke.
- Decisions to lock in writing this week:
  1. **Primary asset corpus** — ligature/word-level corpus (word-span hops, real tajweed
     skin) vs ayah-polygon corpus (lighter, ayah-only). Recommendation: word-level as
     primary, ayah-polygon as fallback adapter; the resolver abstraction in the spec
     supports both.
  2. **Edition v1** — Hafs/Madinah only; concordance table schema created but empty.
  3. Licensing sign-off per source (QUL terms per resource, GitHub licenses, QurSim
     academic terms) recorded in `SOURCES.md` — the CI license gate reads this file.

### A1. ETL pipeline, full corpus (weeks 2–4)
Promote the mock's manual steps to scripts over all 604 pages:
- `etl/anchors` — parse asset metadata → anchor tables (SQLite in build, JSON shards out);
  cross-check against QUL layout DB; fail on any mismatch.
- `etl/edges` — ingest hifz-curated mutashabihat (primary), QUL phrase ranges (spans),
  QurSim (secondary weight); normalize → canonical keys → dedupe → Δsurah/Δpage/juz
  annotations → `adj/<surah>.json`.
- `etl/roots` — morphology → `roots/<slug>.json`, lemma sub-grouped, page-sorted.
- `etl/skins` — tajweed rule spans → element-class maps per page.
- `etl/validate` — resolution gate (100% edge endpoints resolve; 100% polygons anchored),
  license gate, shard-size budget check (each shard < 50KB gz).
- **Milestone A1:** `npm run etl` produces the complete static data set deterministically;
  CI green.

### A2. Highlighter library (weeks 3–5, overlaps A1)
Port the mock's HL module to `packages/highlighter` with the spec §3 API, plus:
- Page streaming: fetch SVG on demand, LRU-cache ~6 pages, prefetch hop targets and
  adjacent pages; serve Brotli.
- Word-granularity resolve/highlight/onRangeSelect (drag yields word-span keys on the
  word-level corpus).
- Gesture layer hardened for touch: drag-on-text = highlight, drag-on-margin = pan,
  **pinch zoom**, double-tap zoom, momentum pan; `prefers-reduced-motion` respected.
- Overlay `<g>` renderer for spans with no native element (fallback assets).
- Headless test harness: scripted hop tours over real pages run in CI (Playwright);
  golden-image tests for highlight rendering on 5 sample pages.
- **Milestone A2:** demo harness page reproduces every mock interaction on any of the
  604 pages.

### A3. Application UI (weeks 5–8)
- Shell: page stage, RTL-correct page turns, hop rail (leaping-arrow chips), diff
  popovers with ctx continuations, drag-highlight context menu, subha bead trail,
  skin toggle, share/trail links (hash grammar from spec §7).
- Responsive behavior (this IS the mobile web app — same build):
  - ≥900px: floating rail + right panel (as mock)
  - <900px: rail collapses to a bottom action bar above the bead trail; panel and
    context menu become bottom sheets; hit targets ≥44px; safe-area insets.
- Navigation: surah/juz/page jumper (typeahead, `2:255` direct entry), keyboard map
  (arrows = pages, `/` = jumper, Esc = dismiss).
- Onboarding: 20-second inline coach marks (tap → hops; drag → highlight menu) shown once.
- **Milestone A3:** core loop usable one-handed on a phone; Lighthouse ≥90 across the board.

### A4. PWA + performance (weeks 8–9)
- Service worker: precache app shell + registry; runtime-cache visited pages, adjacency
  shards, skins. **Offline juz packs**: user pins a juz → its 20 pages + shards persist
  (Cache Storage + IndexedDB manifest). A hafiz revises offline; this is table stakes.
- Install prompts (A2HS), maskable icons, splash, `display: standalone`.
- Budgets enforced in CI: first page interactive < 2.5s on mid-range Android / 3G-fast;
  initial JS < 150KB gz.
- **Milestone A4 = public beta.** Static hosting (Cloudflare Pages / Netlify), analytics
  limited to privacy-respecting counts (page loads, hops taken — no content of trails).

### A5. Hifz polish & beta feedback (weeks 9–11)
- Test with 5–10 huffaz/teachers; instrument nothing personal, interview instead.
- Expected refinements: popover ordering, diff token granularity, rail placement on
  small screens, trail-link sharing flow with teachers.
- v1.0 web launch at end of week 11.

---

## Track B — iOS app (starts after A4 beta is stable)

### B0. Strategy decision (1 week, during A5)
Recommended: **Capacitor wrapper around the same web build**, not a rewrite.
Rationale: the app is DOM/SVG-centric — the Highlighter's value is precisely its SVG/CSS
class machinery, which WKWebView runs natively well; a SwiftUI rewrite would mean
re-implementing the entire L2 layer for zero user-visible gain at this stage. Revisit
native only if profiling shows WKWebView SVG performance failing on target devices
(test on A13-era hardware first — 604-page corpus, worst-case dense pages).

### B1. Capacitor shell (weeks 12–13)
- Wrap `packages/app`; bundle the **full asset corpus + data shards in the app binary**
  (fully offline by default — stronger than the PWA's pinned juz packs; expect
  ~80–150MB, acceptable for this category).
- Native touches via plugins:
  - Share sheet for anchor/trail links (native `UIActivityViewController`)
  - Universal Links: `https://linker.app/#/hafs/2:255` opens the app at that ayah
  - Haptics on hop-landing pulse and bead taps (subtle)
  - Handoff/state restoration: reopen exactly where the hafiz left off, trail intact
- iOS-specific UI passes: safe areas/notch, rubber-band scroll suppression on the stage,
  system RTL behaviors, Dynamic Type for UI chrome (mushaf glyphs are geometry, unaffected).

### B2. iOS-only capabilities (weeks 13–15)
- **Widgets**: "Continue your trail" widget (last bead chain); optional daily
  mutashabih pair widget.
- **Spotlight**: index surah names and pinned trails for system search.
- Local notifications (optional, off by default): revision reminders tied to pinned juz.
- iPad: two-page spread mode (true mushaf opening — genuinely valuable and web-hard);
  pointer/trackpad support; keyboard shortcuts parity.

### B3. App Store submission (weeks 15–16)
- Review prep specific to this category: Quran apps get scrutiny for content accuracy —
  the "assets unmodified from KFGQPC-derived sources" provenance story is the answer;
  include it in review notes. Age rating 4+, no account, no tracking → simple privacy
  label ("Data Not Collected").
- TestFlight beta with the same huffaz cohort (2 weeks) before public release.
- **Milestone B3 = App Store v1.0**, ~week 17–18 overall.

### B4. Android note
Capacitor makes Android nearly free once B1 lands; schedule as fast-follow (2 weeks)
after iOS ships, sharing 95%+ of code.

---

## Cross-cutting workstreams (run throughout)

| Workstream | Owner cadence | Notes |
|---|---|---|
| Data QA | weekly | spot-audit 20 random edges vs printed mushaf; hafiz reviewer signs off on mutashabihat diffs |
| Licensing | at each source addition | SOURCES.md is the single register; CI gate enforces |
| Accessibility | each milestone | keyboard-complete on web; VoiceOver labels for chips/beads ("hop to 2:123, page 19, earlier in surah") |
| Performance | each milestone | budgets in CI; worst-case dense pages in the test set |
| Reserved edges | Phase 6, post-launch | hadith/tafsir/lexicon data drops + registry flips only |

## Risks & mitigations
1. **WKWebView SVG performance on old devices** → test earliest (B0), fallback: rasterized
   page underlay + vector polygon layer only (still asset-derived, still no new SVGs).
2. **Word-level corpus gaps/inaccuracies** → QUL layout DB cross-check in ETL gate;
   ayah-polygon fallback adapter already specced.
3. **Tajweed mapping fidelity** → ship skin as "beta" flag until hafiz reviewer approves
   sample pages; plain skin is default.
4. **App size (iOS bundle)** → On-Demand Resources for juz beyond the first if >200MB.
5. **Scope creep toward a reader app** → the non-goals list in the spec is the contract;
   every feature request must answer "does it make linking ayahs faster?"

## Timeline summary
| Week | Milestone |
|---|---|
| 1 | Repo, corpus + licensing decisions locked |
| 4 | Full-corpus ETL deterministic in CI |
| 5 | Highlighter lib reproduces mock on all pages |
| 8 | Responsive app feature-complete |
| 9 | PWA public beta (desktop + mobile web) |
| 11 | Web v1.0 |
| 13 | Capacitor iOS shell, fully offline |
| 15 | Widgets, iPad spread, Spotlight |
| 17–18 | App Store v1.0 · Android fast-follow next |
