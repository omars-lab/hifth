---
name: hifth-app-identity
description: "What the hifth project is — Quran navigation app for huffaz, renamed from design-phase \"Linker\", built in loops per docs/PLAN.md"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0da21e77-a946-4228-877a-aee0949749f7
  modified: 2026-07-20T09:33:16.009Z
---

Hifth (حفظ) is a pure navigation web app for huffaz: tap/highlight an ayah on real
mushaf SVG pages → hop to similar verses (mutashabihat), shared roots, etc. Knowledge
graph = static adjacency JSON; no backend. Designed in a claude.ai conversation
(shared: https://claude.ai/share/9d43fe10-4c1a-4880-86eb-4adcadb3dfbb) under the
codename "Linker · رابط"; user renamed it **Hifth** on 2026-07-20.

Key user decisions (2026-07-20): web app first with mobile support (PWA, touch-first);
implement iteratively in loops (each loop = vertical slice demoed on a phone); proper
component architecture is a requirement, not an afterthought. Spec of record:
`docs/reference/linker-spec.md`; plan: `docs/PLAN.md`; interactive mock and architecture
diagram also in `docs/reference/`.
