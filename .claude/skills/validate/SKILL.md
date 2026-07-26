---
name: validate
description: Validate the Hifth repo — every check we can run, automated and manual, in cost order. Use when asked to validate, verify, run the gates, check a loop is landable, prepare a release, run a spot-audit, or answer "is this still true?". Also the front door for recording a manual validation result so it becomes a permanent test.
---

# Validating Hifth

Hifth ships mushaf pages and mutashabihat edges to people memorising the Qur'an. A
wrong hop is not a cosmetic bug for this audience, and no amount of green CI can
tell you an edge is *true*. So validation here comes in two halves that need each
other:

- **Automated tiers (1–6)** — cheap, exhaustive, and blind to meaning. They prove
  the build is well-formed, fast, legible, and legally shippable.
- **Manual tier (7)** — expensive, scarce, and the only thing that can judge truth,
  feel, or a real phone. Its results are perishable unless they are banked.

**The rule that connects them: a manual result must end up tightening something
automated.** A threshold, a fixture, or a new gate. If a manual check feeds
nothing, it has to be re-run by hand forever, and it won't be. `docs/validation/ledger.json`
records that link explicitly in each check's `tunes` field, and `gate:validation`
fails if a check tunes nothing.

## Pick a depth

| Ask | Run | Time |
|---|---|---|
| "is my change sane?" | Tier 0 | ~15s |
| "would CI pass?" | `make ci` (tiers 1–2) | ~90s |
| "is this loop landable?" | `make loop-verify` (tiers 1–5) | ~5min |
| "are we ready to publish?" | all tiers, incl. 7 | days — tier 7 has human latency |
| "what are we waiting on?" | `make validate` | instant |

Run from the repo root unless a command says otherwise. `pnpm --filter @hifth/core build`
comes first in almost everything: the other packages resolve `@hifth/core` through its
built `dist/`, so a stale core makes every downstream failure a lie.

---

## Tier 0 — Fast feedback (seconds)

```bash
make lint        # eslint, incl. the L1→L2→L3 layer-boundary rules
make typecheck   # tsc --noEmit in every package (builds core first)
make test        # vitest: core contracts + web components
```

`make test` is the unit tier: `packages/core` (keys, resolver, adjacency bucketing,
highlighter contract against fixture SVGs, router grammar round-trips) and
`apps/web/src/**/*.test.tsx` (each component from fixture data).

**Proves:** the code compiles, the layers stay separate, the pure logic holds.
**Cannot see:** anything about the real DOM, real assets, a real browser, or truth.

---

## Tier 1 — Data and asset gates

These run inside `make ci`, but each is worth running alone when you have touched
the ETL or the vendored data.

```bash
make etl                                    # regenerate every shard
git diff --exit-code -- apps/web/public/assets   # ETL must be deterministic
pnpm audit:corpus            # every manifest page exists, parses, has valid keys
pnpm gate:notext             # no <text> in any asset SVG
pnpm gate:license            # every bundled edition has a SOURCES.md entry
pnpm gate:text-sources       # no NUL byte in a tracked source file
pnpm gate:validation         # the manual-validation ledger is honest
pnpm gate:verified-edges     # human verdicts about edges still hold
pnpm gates                   # all of the above + the budget (needs a build)
```

What each one is actually defending:

- **ETL determinism** — the shards are committed, so a non-deterministic ETL means
  the tree and the build disagree and nobody can tell which is right.
- **`gate:notext`** — an SVG containing `<text>` can fail to paint under
  `content-visibility: auto` in Safari, and the virtualization strategy depends on
  that property. The corpus uses outlined paths; this keeps it that way.
- **`gate:text-sources`** — one NUL byte makes git call a file binary: no diff, no
  blame, no `git grep`. It has got in twice, both times as a "clever" composite-key
  separator. Use `>` instead.
- **`gate:verified-edges`** — see Tier 7. This is where human verdicts live forever.

---

## Tier 2 — The CI mirror

```bash
make ci
```

Runs tiers 0–1 plus the build and the JS budget, **in CI order**, so a green
`make ci` locally means a green `build-test-gate` job. Ends by reminding you CI
also runs `make e2e` and `make lighthouse` as separate jobs.

Budget: **150 KB gz** total JS. Currently ~93 KB.

---

## Tier 3 — Behaviour in a phone-shaped browser

```bash
make e2e                                        # all projects
cd apps/web && pnpm exec playwright test hop.spec.ts   # one spec
cd apps/web && pnpm exec playwright test --project=iphone
```

Projects: `iphone` (WebKit, iPhone 13), `android` (Chromium, Pixel 7), `golden`
(visual only — see Tier 4).

| Spec | What it holds |
|---|---|
| `smoke.spec.ts` | the app boots and shows a page |
| `hop.spec.ts` | the core loop: tap → rail → popover → cross-page hop → bead back |
| `marquee.spec.ts` | drag-to-highlight vs pan disambiguation |
| `range.spec.ts` | a dragged range → merged deduped hop menu |
| `deeplink.spec.ts` | every §7 link form cold-opens to the right state |
| `share-a11y.spec.ts` | share links + the keyboard hop tour + axe |
| `wayfinding.spec.ts` | jumper, edition picker, coach marks |
| `skin.spec.ts` | plain⇄tajweed swap leaves geometry identical |
| `offline.spec.ts` | service worker; visited pages survive a reload offline |
| `contrast.spec.ts` | **every surface** measured against WCAG 4.5:1 |
| `colophon.spec.ts` | the GPL §6 offer is reachable and resolves |

**Standing rule:** any new sheet or popover needs a row in `contrast.spec.ts`'s
`SURFACES` array, or literally nothing is checking its legibility. axe cannot do
this job here — it files most of this app's chrome under `incomplete` (`nonBmp`
for every glyph control, `shortTextContent` for every hop count), and `incomplete`
never fails a build.

---

## Tier 4 — Visual regression

```bash
make golden                    # diff against this platform's baselines
make golden-update             # accept new ones — REVIEW THE PNG DIFF FIRST
make golden-linux UPDATE=1     # refresh the CI-shaped (linux) set in Docker
```

Baselines are rasterized geometry and therefore per-platform: `darwin` locally,
`linux` in CI. Regenerate **both** when geometry legitimately changes.

**The trap worth knowing:** the shots are element screenshots of the page SVG, but
that SVG's bounding box spans most of the viewport, so the crop lands over the app
chrome. A few pixels of movement in the header re-photographs every page. If
several unrelated golden tests fail at once, suspect chrome geometry before
suspecting the highlighter — and do not reach for `--update-snapshots`, which is
how a wrong wash hides forever.

---

## Tier 5 — Performance and quality budgets

```bash
make lighthouse    # all four categories ≥90 against the built app
make perf          # emulated pan/zoom trace — the regression baseline
make phone-perf    # the real number: the phone measures itself (Tier 7)
```

`make perf` gives an emulated baseline (~8.3 ms/frame, flat under CPU throttle).
**Treat that number as unvalidated.** It writes `style.transform` in a loop, so
it never pays for touch dispatch, hit-testing hundreds of polygons, or the
compositor's decision to re-raster a scaled layer — which are the three costs
the architecture verdict turns on. Use it to catch regressions, never to decide.

`make phone-perf` is the one that decides. It builds a throwaway bundle carrying
`src/perf/probe.ts`, serves it to your phone, and the page samples its own frame
times across three separate segments (pan / pinch / tap-to-highlight) while you
drive it with real fingers, then prints paste-ready JSON for the ledger. The
probe is gated on a **build-time** flag and never enters a shipped bundle —
verify with `grep -c probe apps/web/dist/assets/index-*.js` after a plain
`make build`. Do not deploy a `dist/` produced by this target; any later
`make build` or `make ci` overwrites it.

---

## Tier 6 — Supply chain and secrets

```bash
make secrets       # gitleaks over the working tree AND full history
```

A gitleaks pre-commit hook runs on every commit. **Never `--no-verify`** — several
agents share this checkout and the hook is the only thing standing between a
pasted token and the history.

Provenance of vendored data is recorded per-source in
`packages/etl/data/*/PROVENANCE.md` (upstream URL, commit pin, retrieval date,
SHA-256). To re-verify bytes:

```bash
shasum -a 256 packages/etl/data/tajweed/tajweed.hafs.uthmani-pause-sajdah.json
# compare against the SHA-256 in the adjacent PROVENANCE.md
```

Licence terms live in `SOURCES.md`, one entry per source, and `gate:license`
fails the build on a bundled edition with no entry.

**A licence lesson worth not relearning:** a licence *summary* in user-facing copy
is a claim about someone else's terms, and overstating one fails silently — it
reads as caution, so no reader ever files a bug about being told they have fewer
rights than they do. The colophon once told everyone the mushaf artwork was
non-commercial-only; that was a different edition's term. When you touch a licence
string, check it against `SOURCES.md`, and check `SOURCES.md` against the source.

---

## Tier 7 — What a machine cannot run

`docs/validation/ledger.json` is the register: every manual check, why it exists,
how to run it, what it blocks, and — the field that matters — what it **tunes**.

```bash
make validate      # list outstanding checks and what each one blocks
```

`gate:validation` does not fail on `pending` work. A phone that has not been held
yet is a fact about the project, not a broken build, and a permanently red gate
just teaches everyone to ignore it. It fails when the ledger *lies*: a malformed
entry, a `done` with no recorded result, a recurring check that has expired, or a
check that tunes nothing.

### Recording a result

1. Run the check (each ledger entry has a `how`).
2. Set `status: "done"`, add `verifiedOn` (ISO date) and `result` (the verdict, in
   words — this is the artifact).
3. **Do what `tunes` says.** This is the step that makes the check worth its cost:
   the measured fps becomes the asserted frame budget, the screen-reader finding
   becomes an assertion in `share-a11y.spec.ts`, the edge verdicts become fixture
   entries. A `done` that tuned nothing is a result you will have to buy again.
4. Note it in the relevant `docs/decisions/loop-<N>.md`.

### The edge spot-audit — the scripture tier

The one check with a dedicated tool, because it is the highest-value human input
this project takes:

```bash
make audit-edges N=20 SEED=1     # a seeded, reproducible draw
make audit-edges N=20 NEW=1      # skip edges already verified
```

The draw is seeded so a round can be re-run, re-checked, or handed to a second
reader — same seed, same twenty edges, any machine. It prints the pairs to check
and then the JSON to paste into `packages/etl/data/qa/verified-edges.json`.

**Record both verdicts.** `correct` means the edge must keep shipping;
`wrong` means it must not. The negative case is the one that pays: an edge a
reader rejected, if it is not written down, comes back on the next data refresh
and costs that reader's time all over again — and no automated check can tell a
wrong edge from a right one. `gate:verified-edges` then enforces both directions
forever.

When a gate:verified-edges failure appears: **do not edit the fixture to go
green.** A failure means the data moved under a human verdict. Find out what
moved it. If the data is now right, re-verify with a reader before changing the
verdict.

If a whole *class* of edge turns out wrong, that is a filter in
`packages/etl/scripts/build-adjacency.mjs`, not twenty more rejections.

---

## Adding a validation

The suite is meant to grow as results arrive. Where a new check goes:

| You added | It needs |
|---|---|
| a new sheet, popover or panel | a row in `contrast.spec.ts`'s `SURFACES` |
| a new component | a `*.test.tsx` beside it, from fixture data |
| a new user-facing flow | an e2e spec, run on both `iphone` and `android` |
| a new highlight or wash | a golden case, and both platforms' baselines |
| a new vendored data source | a `SOURCES.md` entry + a `PROVENANCE.md` with a SHA-256 |
| a new invariant about committed data | a `scripts/gate-*.mjs`, wired into `pnpm gates`, `make ci` and `.github/workflows/ci.yml` |
| a check only a human can do | a `docs/validation/ledger.json` entry — with a non-empty `tunes` |

New gates follow the existing shape: a header comment saying what it defends and
*why the failure it prevents is hard to notice*, a clear failure message naming the
fix, exit 1 on violation.

---

## Known traps

- **Playwright runs against the built `dist`** (`vite preview`, `reuseExistingServer`
  when not in CI). A src change needs `pnpm build` before e2e, or you are measuring
  the previous build — silently, with plausible numbers.
- **`pnpm exec playwright test` must run from `apps/web`.** From the root it errors
  with `unknown command 'test'`.
- **`--project=golden` only matches `golden.spec.ts`.** Filtering another spec into
  it returns "No tests found", which reads like a passing run.
- **Build core first.** `make typecheck`/`test`/`e2e` do it for you; a bare
  `pnpm vitest` does not.
- **WebKit does not focus a button on tap.** Testing focus restoration after a
  `.tap()` measures the browser, not your dialog — open with `.focus()` +
  `keyboard.press("Enter")`.
- **Several agents share this checkout.** Anything that builds, installs or stages
  takes the lock: `make lock L=build CMD="pnpm -r test"`, `make lock-status`.
  Protocol in `docs/PARALLEL-AGENTS.md`.
