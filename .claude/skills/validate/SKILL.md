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
| "does anything outside this repo still agree with us?" | `make probe-reference ALL=1` (the probes) | ~4min |
| "what are we waiting on?" | `make validate` | instant |
| "how do I actually run one?" | `make validate CHECK=<id>`, or `make guide` for the phone | instant |

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
pnpm gate:ci-artifacts       # CI still uploads things that exist
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
- **`gate:ci-artifacts`** — every `upload-artifact` path must be one something in
  this repo writes, and must fail loudly when there is nothing to upload. The e2e
  job spent several loops uploading `playwright-report` while the CI reporter was
  `line`, which writes no report: green step, no artifact, traces discarded on
  exactly the runs that needed them. An upload step is a promise about a future
  failure, and nobody exercises it until the bad day.

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

Every run writes a full Playwright report — the failing screen, the trace, the
image diff. Open it with `make report`; the **`review-reports`** skill says which
artifact answers which question and where each one lies to you. Don't diagnose a
red line from the terminal alone.

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

## The probes — the checks that ask somebody else

Deliberately unnumbered: this is not a rung on the cost ladder, it is a different
axis, and it closes a blind spot **every tier above shares**. Tiers 1–6 check our
bytes against our bytes and our rules against our rules. They are excellent at
catching drift and structurally incapable of catching a *premise*: if the print we
pinned were the wrong one, or the offer we publish resolved for nobody, every gate
in this repo would stay green forever and say nothing. A closed system cannot
audit its own axioms.

So a handful of scripts go and ask a party outside the supply chain.

| Run | Asks | Answers | Blind to |
|---|---|---|---|
| `make probe-reference` | api.quran.com's published page table, and five other references for reachability | *Are we still the print we say we are?* 568 agree / 36 diverge / 0 surprises, all 604 pages | resemblance, meaning, anything a reader judges |
| `make source-offer URL=<deployed>` | the deployed site, anonymously, no `gh` and no token | *Does the GPL §6 offer resolve for a stranger?* | whether a reader can find it from inside the app |
| `node packages/etl/scripts/probe-ligature-print.mjs` | a second corpus of the same print | *Which print is that corpus?* — V2, 56/56 with controls | whether **we** are that print (that is `probe-reference`) |
| `node packages/etl/scripts/probe-word-registration.mjs` | the same corpus's geometry | *Does a word box drawn on its frame land on our ink?* | nothing about text or meaning |

**Proves:** a claim this repo makes about the outside world still holds — the
edition, the offer, the corpus — measured by something that has never seen our
data. That is the only evidence here that is not self-referential.
**Cannot see:** anything a reader judges. A probe settles *where* an ayah is,
never whether two of them are ones a hafiz would confuse.

**None of them is a gate, and none will become one.** `SOURCES.md` wrote the rule
down for the quran-meta tables: a gate that reaches the network fails when a host
is down, which teaches everyone to skip it — and a skipped gate is worse than no
gate, because the build still looks green. The naming carries it: `gate-*` runs in
`make ci` and a failure is a build failure; `check-*` and `probe-*` are opt-in and
a red one is a finding a human reads. Research ⑦ (a KFGQPC terms watcher) was
**cancelled** rather than deferred on exactly this reasoning.

**Two things a probe still owes.** Its output is not banked until someone runs
`make record`, and a measurement worth keeping belongs in the PROVENANCE.md of the
data it is about — `probe-reference`'s 568/36/0 is in
`packages/etl/data/pages/PROVENANCE.md`, beside the Loop 4a argument it
corroborates. A number that lives only in a terminal scrollback was not a
validation, it was a curiosity.

**And a probe can narrow a tier-7 check without closing it.** That is the useful
thing they do: `edge-spot-audit` no longer needs a human to confirm ayah *k* is on
page *n*, so the scarce reader spends the whole half hour on the judgement only
they can make. Narrowing is recorded in `docs/issues.json`; the check stays
`owner: user`.

---

## Tier 7 — What a machine cannot run

`docs/validation/ledger.json` is the register **and the runbook**: every manual
check, why it exists, what it blocks, what it **tunes**, and — per check — a
`runbook` of what you need, what to run, each step with the thing you should
*expect to see*, and how to read the answer.

That runbook is written once and rendered three ways. Never restate a check's
steps in this file, in `PLAN.md`, or in a loop doc: a runbook that exists in two
places drifts, and a drifted runbook fails silently because it still looks
authoritative.

```
docs/validation/ledger.json
  ├── make validate CHECK=<id>   → the runbook in this terminal
  ├── make guide                 → docs/validation/guide.html, served to the phone
  ├── make validate-auto         → runs the machine half; writes evidence/<id>.json
  └── this skill                 → drives the session
```

The pictures in the guide come from `make shots` (`apps/web/e2e/shots.spec.ts`),
captured from the real build by the same harness that runs the e2e suite. Never
paste a screenshot in by hand — a hand-captured picture is a second copy of the
UI that drifts silently, which is the failure this whole shape exists to
prevent. A step's `shot` naming a file that is not there fails `gate:validation`,
and the fix it names is that one command.

### Driving a session

1. `make validate` — what is outstanding, what each one blocks.
2. `make validate-auto` — run the machine half first, so you do not walk steps a
   command has already walked. It regenerates the guide itself, and its summary
   line says how many steps it struck off and how many named residues it could
   not touch.
3. Pick one. Read it here with `make validate CHECK=<id>`; a step a producer
   discharged prints as `[machine] …` with the command and the date, and you skip
   it.
4. Open the runbook where the check actually happens. Two surfaces, same source:
   `make guide` for the phone (every check, tickable, nothing written down), or
   `make session CHECK=<id>` for the one you are about to work (a single check,
   everything you tick or type banked to a transcript as you do it — see below).
   Run the check's own `setup` commands (e.g. `make phone-perf`) in a second
   terminal either way.
5. `make record CHECK=<id> RESULT='<the verdict, in words>'`. The words are the
   artifact: a `done` with no result is indistinguishable from a check nobody ran.
   Recording stamps the ledger, regenerates the guide, and re-runs the gate.
6. **Do what `tunes` printed.** This is the step that makes the check worth its
   cost: the measured fps becomes the asserted frame budget, the screen-reader
   finding becomes an assertion in `share-a11y.spec.ts`, the edge verdicts become
   fixture entries. A `done` that tuned nothing is a result you will have to buy
   again.
7. Note it in the relevant `docs/decisions/loop-<N>.md` and commit — ledger,
   guide and evidence records travel together.

**If an `expect:` line does not match what the device actually shows, that is a
bug in the runbook, not a detail to work around.** Fix the ledger, re-run
`make guide`, then carry on — you are the last person who will be able to tell.

`gate:validation` does not fail on `pending` work. A phone that has not been held
yet is a fact about the project, not a broken build, and a permanently red gate
just teaches everyone to ignore it. It fails when the ledger *lies*: a malformed
entry, a `done` with no recorded result, a recurring check that has expired, a
check that tunes nothing, a pending human check with no runbook (nobody can run
it, so it will sit there looking tracked), or a `guide.html` that was not
regenerated after the ledger moved.

### Co-working a check — `make session`

```bash
make session CHECK=<id>          # resume an unbanked sitting, or start one
make session CHECK=<id> NEW=1    # start a fresh transcript regardless
make session CHECK=<id> PORT=4180
```

One check, drawn from the same renderer the field guide uses, served on the LAN so
the phone can hold it — and, unlike the guide, it **writes**. Every box ticked,
every note typed, and every answer a check's own tool reports lands in
`docs/validation/sessions/<stamp>-<id>.jsonl` at the moment it happens. At the end
the page banks the verdict into the ledger for you (it runs `make record`), or
prints the `make record` line pre-filled from what you wrote if you would rather
say it yourself.

The gap this closes is an ordering problem, not a documentation one. The ledger's
`result` has always been typed after the walkthrough was over, so what you noticed
at step four survived only if you were still holding it at step ten. Here the
observation is on disk while the step is still in front of you.

Four properties, each load-bearing:

- **It cannot score.** The page shows how far through you are and whether the last
  write landed, and nothing else. `placement-correction-by-eye` is a blind forced
  choice whose validity rests on nobody — the worker included — knowing how it is
  going while it is going, and a running tally would quietly turn the measurement
  into a training exercise. `summarise()` in `scripts/lib/session-log.mjs` is
  arithmetic only for exactly this reason.
- **It is not a second ledger.** Nothing reads a transcript to decide whether a
  check passed. `docs/validation/sessions/README.md` is the format; the ledger
  stays the register.
- **A dropped write is visible.** The client retries forever and shows an
  unmissable "N not banked" pill while it does. A capture surface that loses
  writes quietly is worse than the download it replaced, which at least failed
  where you could see it.
- **The server binds `0.0.0.0`, so every write route carries a per-run token.**
  The URL printed in your terminal has it; a second thing on the Wi-Fi does not.
  The integrity argument is the real one — these files are treated as evidence.

**Giving a check its own tool.** A check whose work is a purpose-built page
declares it in the ledger, beside the runbook that builds it:

```json
"runbook": {
  "tool": { "path": "packages/etl/out/mark-adjudication.html", "label": "…", "note": "…" }
}
```

The session serves that file with a small sink injected, and the page opts in:

```js
window.HIFTH_SESSION?.post("observation", { … });        // one answer, as it is given
window.HIFTH_SESSION?.artifact("ruling.json", { … });    // the file, at the end
```

Both calls are optional by construction. Opened as a plain file — still supported,
still the documented fallback — the sink is absent, the calls do nothing, and the
tool keeps whatever offline behaviour it had. **Never send the sink anything the
page is not supposed to know**: the adjudication tool posts *which panel was
chosen* and never whether it was right, because the answer key does not exist
until the scorer rebuilds it from the seed, and a reporting path is the last place
that should be where it leaks.

### `evidence` — the half a machine *can* run, written down

A check may carry an `evidence` block: one command (`run`), the runbook step
**ids** it discharges (`covers`), and the `residue` it cannot. `make validate-auto`
runs each one and writes the real exit code into
`docs/validation/evidence/<id>.json`; the terminal and the guide read those
records and strike the covered steps off. Three checks have one today —
`source-offer-resolves`, `kfgqpc-terms-primary-source`, `edge-spot-audit`.

Four rules, each of them load-bearing:

- **A run is written, never asserted.** There is no way to mark a step discharged
  except by running the thing on this machine at this commit. The records are
  committed and diffed like golden images.
- **Exit 3 strikes nothing.** `outcomeOf` (`scripts/validation-ledger.mjs`) reads
  3 as *could not tell*, not as a pass — a check whose network would not answer
  has proved nothing, and letting that discharge a human's step is precisely how
  a muted watcher comes to look covered.
- **`run` is never a `make` target.** GNU make reports every failed recipe as
  exit 2, flattening a producer's own 1-vs-3 into one code. Name the script:
  `node scripts/check-source-offer.mjs`, not `make source-offer`.
- **`residue` is required, and it is the point.** `gate:validation` rejects an
  `evidence` block that names no remainder: *"an automated run that names no
  remainder is one claiming to have done their job."* If a command really covers
  a whole check, the check is not a Tier 7 check.

`covers` points at step **ids**, never positions — a reordered runbook must not
silently re-point it, and the gate fails on an id that no step has. Not every
check should have one: `screen-reader-walkthrough` deliberately has none, because
its steps already say that the labels are asserted by `e2e/__aria__/` and ask you
to judge whether they *sound* like something you would say. Striking those would
delete the check.

`make validate-auto` exits 0 even when a producer goes red. It is a reporting
run; the gate fails on a ledger that lies about its evidence, never on the
evidence being bad news.

### The GPL §6 offer — the half a machine *can* run

`make source-offer` (`scripts/check-source-offer.mjs`) follows the offer the way
a stranger would: anonymously, no `gh` and no token, because signed in as
ourselves a private repo looks public and the check would go green on exactly the
day the offer stopped resolving. `URL=<deployed>` additionally reads
`SOURCE_REPO` and the build's commit out of the deployed bundle, so it answers
what a reader is handed rather than what this branch declares.

It is deliberately **not** in `pnpm gates`, `make ci` or the pre-commit hook, and
is named `check-` rather than `gate-` to say so — it reaches the public internet.
`.github/workflows/public-deploy.yml` runs it on `workflow_dispatch`, which is
when the question is actually being asked.

Three verdicts, and the middle one is the point: `OK`, `DOES NOT RESOLVE`
(exit 1 — an answer), `COULD NOT TELL` (exit 3 — a network that would not answer,
which is **not** a pass). It is red today for a real reason: the repository is
private, so the offer 404s for everyone who is not us (task #53).

It is wired into the check's `runbook.setup`, so it is answered before anyone
picks up a phone. What is left for the person holding one is the part it cannot
see: that a reader can *reach* the offer from inside the running app.

### The edge spot-audit — the scripture tier

The one check with a dedicated tool (`make audit-edges`, seeded so a round can be
re-run, re-checked, or handed to a second reader), because it is the highest-value
human input this project takes. Steps: `make validate CHECK=edge-spot-audit`.

**No mushaf on the table is not a reason to skip the round.** `/mushaf-reference`
names the published scans and page tables that stand in for one, and the two traps
that make a stand-in worse than nothing: six of archive.org's twelve KFGQPC scans
are a different qira'a or script, and most published page tables are V1/1405H
while our print is V2/1421H — 36 pages apart. `make probe-reference ALL=1` checks
that divergence is still exactly the expected 36, which settles every arithmetic
claim under this check and none of its judgement.

**Aim the round before drawing it.** `make validate` ends in a coverage table:
one row per class of edge (type × curated-or-dataset × page distance), marked ✓
or ·. The · rows are where a wrong edge survives everything — `gate:edges` does
not score `shared-root` at all, and the curated pairs are ones we wrote
ourselves. The draw is stratified for that reason: 97% of the corpus is a single
class, so a flat draw of twenty never reaches the rest. `NEW=1` skips pairs a
verdict already settles; `UNIFORM=1` returns to a flat draw, which is only the
right question when the *rate* is — and `gate:edges` already carries the rate on
every commit.

**One row is one pair, and the paste block is twice as long.** Every edge is
generated in both directions from one fact, so a reading settles both and the
block writes both — forty entries for twenty pairs. `words` and `roots` beside
each pair are hints from the same reader `gate:edges` uses, never verdicts:
2:48 → 2:123 scores 1 and is the pair this product was designed around.

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

### The placement adjudication — asking without telling

The second check with a dedicated tool, and the one to copy when a measurement
here needs a person to settle it. Steps:
`make validate CHECK=placement-correction-by-eye`.

**Never show someone a verdict and ask if they agree.** They agree. The
measurement sounds confident, the honest answer to "does this look right" is "I
suppose so", and what comes back is the machine's own opinion with a human's name
on it — indistinguishable from evidence, and worthless. This check exists because
the surface that already existed (a page of worst-first verdicts, each drawn with
the expected outline beside the claimed rectangle) is exactly that mistake, and it
sat unworked for weeks partly because nobody could say what working it would
prove.

**The shape that does work.** A forced choice between two candidates, nothing on
the screen saying which is ours, and — the part that makes it evidence rather
than a promise — no answer key on disk. `pnpm adjudicate:marks` plans the session
from a seed; `pnpm adjudicate:score` rebuilds the same session from the same seed
afterwards and only then knows which panel was which. Nobody had to be trusted not
to peek, because for the twenty minutes that mattered there was nothing to peek
at. The scorer refuses outright (exit 2) if the underlying measurement moved
between building the session and scoring it.

**A session carries its own controls, and they are not optional.** An easy
condition (a rectangle a whole letter off) so a session worked while distracted
fails visibly instead of adding noise; an unanswerable one (the same rectangle
twice) so a person who always picks something is caught; and a decoy displaced the
*same distance in another direction*, which does two jobs — it measures whether an
eye can resolve a difference that small at all, and it breaks the pattern that
would otherwise be learnable within twenty trials. Without the decoy, "people did
not prefer our correction" and "people cannot see a shift this small" are the same
number, and only one of them is a finding about the data.

**Bank the refusal as carefully as the confirmation.** The most valuable outcome
this can produce is *the decoys were seen clearly and ours still lost* — our
correction is wrong, not the test blunt — and it is the outcome most likely to be
left in a terminal scrollback. `make record` either way.

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
| a check only a human can do | a `docs/validation/ledger.json` entry — non-empty `tunes`, and a `runbook` whose every step has an `expect` |
| a claim about the world outside this repo | a `probe-*` / `check-*` script, opt-in and **never** in `pnpm gates`, whose measurement lands in the relevant `PROVENANCE.md` |

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
