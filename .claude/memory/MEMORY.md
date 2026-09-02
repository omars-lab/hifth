# Memory index

- [Hifth app identity](hifth-app-identity.md) — Quran navigation app for huffaz, renamed from "Linker", loops plan in docs/PLAN.md
- [Artifacts in English by default](artifacts-english-by-default.md) — mocks/walkthroughs use English chrome, only scripture stays Arabic; watch published artifacts for feedback
- [Desktop edge-grab page turn](desktop-edge-grab-turn.md) — desktop spread turns by grabbing the outer fore-edge (hand cursor); mid-page drags never turn
- [Juz-jump leaf alignment](juz-jump-leaf-alignment.md) — a hop revealed the incoming leaf before centring it (1-frame ~9px flash); fixed by centerCurrent() in navigateTo; rebuild dist before e2e
- [Desktop zoom StrictMode orphan](desktop-zoom-strictmode-orphan.md) — "zoom broken on spread" was a dev-only StrictMode orphan host; teardown now removes hosts; prod was never affected
- [SPA hash nav is not a reload](spa-hash-nav-no-reload.md) — a #-only navigate keeps the old bundle on 5173; force location.reload() before calling a change "not rendered"
- [Playwright WebKit missing](playwright-webkit-missing.md) — iphone e2e project cannot launch locally; run the Chromium projects, ask before installing WebKit
- [Designs public on the site](designs-public-on-site.md) — tenet since 2026-09-01: docs/ pages are served from blog.bytesofpurpose.com/hifth/docs/ by the build; never publish a decision page to claude.ai as its address
