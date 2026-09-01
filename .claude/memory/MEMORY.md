# Memory index

- [Hifth app identity](hifth-app-identity.md) — Quran navigation app for huffaz, renamed from "Linker", loops plan in docs/PLAN.md
- [Artifacts in English by default](artifacts-english-by-default.md) — mocks/walkthroughs use English chrome, only scripture stays Arabic; watch published artifacts for feedback
- [Desktop edge-grab page turn](desktop-edge-grab-turn.md) — desktop spread turns by grabbing the outer fore-edge (hand cursor); mid-page drags never turn
- [Juz-jump leaf alignment](juz-jump-leaf-alignment.md) — a hop revealed the incoming leaf before centring it (1-frame ~9px flash); fixed by centerCurrent() in navigateTo; rebuild dist before e2e
- [Desktop zoom StrictMode orphan](desktop-zoom-strictmode-orphan.md) — "zoom broken on spread" was a dev-only StrictMode orphan host; teardown now removes hosts; prod was never affected
