# Hifth · حفظ

A pure navigation instrument for huffaz: select an ayah on a real mushaf SVG page,
see typed hop links (similar verses, shared roots, and later hadith/tafsir), and jump.
The knowledge graph is the routing table; the page is the interface.

Web app first, mobile-first, fully static — no backend.

## Quick start

```bash
pnpm install        # Node 20+, pnpm 9 (via corepack)
pnpm dev            # dev server (apps/web)
pnpm build          # static build → apps/web/dist
pnpm test           # unit tests (core + web)
pnpm --filter @hifth/web test:e2e   # Playwright, iPhone + Android viewports
pnpm gates          # CI content gates (no-<text>, license, JS budget)
```

## Layout

- `apps/web` — Vite + React 18 + TS, the mobile-first RTL PWA shell.
- `packages/core` — framework-free TS: keys, resolver, highlighter, router (L2).
- `packages/etl` — Node: asset extraction, corpus audit, and (later) adjacency/roots/skins.

## Status

**Loop 1 complete** — tap an ayah on the page to select it (amber highlight + surah/ayah
chip), with pan and pinch-zoom, on the real three-layer architecture. The inline-SVG
performance verdict is deferred to an on-device measurement before Loop 4. See
[`docs/decisions/loop-1.md`](docs/decisions/loop-1.md).

_Previously:_ **Loop 0** — installable RTL PWA rendering a real Madani mushaf page (7),
with CI gates and Cloudflare Pages deploy config. See [`docs/decisions/loop-0.md`](docs/decisions/loop-0.md).

## Docs

- **Implementation plan:** [`docs/PLAN.md`](docs/PLAN.md) — built in vertical loops, each ending on a phone
- **Loop records:** [`docs/decisions/`](docs/decisions/) — what each loop decided, measured, deferred
- **Spec of record:** [`docs/reference/linker-spec.md`](docs/reference/linker-spec.md) (design-phase codename "Linker")
- **Data sources & licensing:** [`SOURCES.md`](SOURCES.md)
- **Interactive mock:** [`docs/reference/linker-mock.html`](docs/reference/linker-mock.html) — open directly in a browser
- **Architecture diagram:** [`docs/reference/linker-architecture.html`](docs/reference/linker-architecture.html)
