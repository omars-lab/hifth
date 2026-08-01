# Hifth · حفظ

A pure navigation instrument for huffaz: select an ayah on a real mushaf SVG page,
see typed hop links (similar verses, shared roots, and later hadith/tafsir), and jump.
The knowledge graph is the routing table; the page is the interface.

Web app first, mobile-first, fully static — no backend.

**Live: <https://blog.bytesofpurpose.com/hifth/>** — installable; open it on a phone. Every
push to `main` that clears all four CI jobs publishes there.

## Quick start

The `Makefile` is the front door — it wraps everyday dev, the exact CI sequence, and the
loop workflow. `make help` lists everything.

```bash
make install        # deps + gitleaks pre-commit hook (Node 20+, pnpm 9)
make dev            # dev server (apps/web) with HMR
make ci             # full local mirror of the CI build-test-gate job, in order
make status         # the roadmap: Status & tracking table + open follow-ups
make loop N=2       # print a loop's kickoff prompt + its plan section
make phone          # build + serve on your LAN; prints the URL to open on a phone
```

Deploying is automatic and needs no command — see [§Where it deploys](docs/PLAN.md#where-it-deploys)
for how the alternative host works if that ever has to change.

Under the hood these call pnpm (`pnpm dev`, `pnpm build`, `pnpm test`,
`pnpm --filter @hifth/web test:e2e`, `pnpm gates`) — use those directly if you prefer.

## Layout

- `apps/web` — Vite + React 18 + TS, the mobile-first RTL PWA shell.
- `packages/core` — framework-free TS: keys, resolver, highlighter, router (L2).
- `packages/etl` — Node: asset extraction, corpus audit, and (later) adjacency/roots/skins.

## Status

Pre-v1.0 and usable. What works today, on a phone:

- **Select** — tap an ayah on a real Madani mushaf page, or drag across a range; the mark is
  laid down like a highlighter, right to left, one line at a time.
- **Hop** — a rail of similar verses (mutashabihat) and shared roots, nearest page first;
  tap through to another page and a bead brings you back.
- **Read** — plain ⇄ tajweed skin with identical geometry, pan and pinch-zoom, jump to any
  surah/juz/page, and visited pages survive going offline.
- **Share** — a link cold-opens on someone else's phone restored to the exact view, with the
  two verses diffed; screen readers announce the hop.

Deliberately not done yet: the full 604-page corpus and pinned-juz offline packs both wait on
one on-device rendering measurement (follow-up ①), and there is no beta.

**The roadmap of record is [`docs/PLAN.md`](docs/PLAN.md) §Status & tracking** — loop
statuses, gates and open follow-ups live there and are deliberately not restated here.
`make status` prints it. Each loop's record is in [`docs/decisions/`](docs/decisions/).

## Docs

- **Implementation plan:** [`docs/PLAN.md`](docs/PLAN.md) — built in vertical loops, each ending on a phone
- **Loop records:** [`docs/decisions/`](docs/decisions/) — what each loop decided, measured, deferred
- **Open items:** [`docs/issues.md`](docs/issues.md) — everything unfinished, indexed from the four
  registers that hold it (the plan's follow-ups, the backlog, each design doc's open questions,
  the manual-check ledger); `make issues` prints it worst-first
- **Manual-check register:** [`docs/validation/ledger.json`](docs/validation/ledger.json) — the
  checks no CI job can make (a phone, a screen reader, a printed mushaf), each with a runbook
  and a recorded verdict; `make validate` in the terminal, `make guide` on the phone
- **Spec of record:** [`docs/reference/linker-spec.md`](docs/reference/linker-spec.md) (design-phase codename "Linker")
- **Data sources & licensing:** [`SOURCES.md`](SOURCES.md)
- **Licensing map:** [`LICENSES.md`](LICENSES.md) — how our terms compose with the vendored data's
- **Interactive mock:** [`docs/reference/linker-mock.html`](docs/reference/linker-mock.html) — open directly in a browser
- **Architecture diagram:** [`docs/reference/linker-architecture.html`](docs/reference/linker-architecture.html)
