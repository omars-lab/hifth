---
name: review-reports
description: Read the report a Hifth test run left behind — Playwright's HTML report, traces, golden-image diffs, Lighthouse, gate output, CI artifacts. Use when a run failed and the log doesn't say why, when a golden diff needs eyeballing, when a test only passed on retry, or when asked to review the results of e2e/CI/Lighthouse. Routes to the artifact that answers the question; it does not restate what the report says.
---

# Reading what a run left behind

A test run is not its log. Playwright writes a full report on every run — the failing
screen, the DOM at the moment of failure, console and network, and for a golden
failure the expected/actual/diff triptych. The terminal shows you a red line; the
report shows you the thing that went red.

This skill is a **router**. It says which artifact answers which question, how to
open it, and the traps that make an artifact lie. It deliberately does not
summarise or restate report contents — a report that exists in two places drifts,
and the drifted copy still looks authoritative. Same rule the validation ledger
runs on.

## The two halves

| | answers | source |
|---|---|---|
| **Playwright report** | did the automated tier hold, and *exactly where* did it break | `make report` |
| **`/validate` + guide** | what does a human still have to do, and what does their verdict tune | `make validate`, `make guide` |

They meet in one direction only: a ledger entry may point *at* a run. It never
copies one in.

## Which artifact

| Question | Open | Notes |
|---|---|---|
| Why did e2e fail? | `make report` | serves :9323, holds the terminal until Ctrl-C |
| What did the screen look like? | same → the test → **Screenshot** | `screenshot: "only-on-failure"` |
| What happened, step by step? | same → the test → **Trace** | retry only — see traps |
| Is this golden diff real? | same → the test → the three images | expected / actual / diff |
| Did anything pass only on retry? | same → the run summary | a flake is invisible from a green ✓ |
| Machine-readable pass/fail | `apps/web/test-results/results.json` | prefer this over scrolling the HTML |
| Why did a gate fail? | `pnpm gates` | plain text, names its own fix |
| Why did Lighthouse fail? | `make lighthouse`, then `.lighthouseci/` | JSON + HTML per run, median of 3 |
| Why did unit tests fail? | `pnpm test` | Vitest, terminal only — no report |
| What's outstanding by hand? | `make validate` | → the `validate` skill |

## From CI

```
gh run list --branch <branch> --limit 5
gh run download <run-id> -n playwright-report && open playwright-report/index.html
gh run download <run-id> -n lighthouse-reports
```

The report is self-contained — the trace viewer ships inside it, so a downloaded
folder opens offline with no server and no network. It uploads on **every** run,
not just failures, because that is the only way a retry-flake is visible after the
fact.

## Traps

Each of these has produced a wrong conclusion at least once.

- **The report is the *last* run only.** `apps/web/playwright-report/` is
  gitignored and overwritten wholesale. `make shots` runs Playwright twice, so
  after it the report is of the screenshot build, not of your e2e run.
- **The first attempt is not traced.** `trace: "on-first-retry"` with `retries: 1`
  means a real failure always produces a traced second attempt — but if you are
  looking at attempt 1, the Trace tab is empty and nothing is wrong.
- **A retry that passes is still a finding.** Playwright scores it green overall
  and flags it flaky in the report. `retries: 1` exists for WebKit launch
  starvation; anything else passing only on retry is a bug that hides.
- **Golden baselines are per-platform.** `e2e/__screenshots__/darwin` is what you
  diff against, `.../linux` is what CI does. A local pass proving nothing about CI
  is expected, not a mystery — reproduce with `make golden-linux`.
- **Never accept a baseline to make a diff go away.** `make golden-update` rewrites
  what "correct" means, permanently and silently. Look at all three images first:
  the gate is agreeing with you, not the other way round.
- **`make e2e` does not run the `shots` project.** Missing guide screenshots are
  `make shots`, not a failure you overlooked.
- **The report never opens itself.** `open: "never"` is set so a failing run cannot
  hang `make ci` behind a web server. `make report` is the only door.
- **Never run Playwright through `pnpm --filter <pkg> exec`.** That path goes
  through pnpm's recursive runner, which on failure prints a bare `undefined`
  where the error should be and buries the reporter's last lines under its own
  banner — the lines you were about to read. `pnpm -C apps/web exec …` is the same
  command with the same exit code and a clean tail. The `make` targets already use
  it.

## Reading a failure

1. `make report` → click the failed test. The error and the failing screenshot are
   at the top; that alone resolves most of them.
2. Still unclear → **Trace**. The timeline gives you the DOM before and after every
   action, plus console and network. This is what a locator that resolved to the
   wrong element looks like.
3. A golden failure → the three images, in the order expected, actual, diff. Ask
   what moved and whether it should have. `maxDiffPixelRatio: 0.005` is
   anti-aliasing tolerance only; a real regression is orders of magnitude bigger.
4. Reproduce narrowly before fixing: `pnpm -C apps/web exec playwright test
   e2e/<file>.spec.ts --project=<iphone|android|golden>`.
5. If the failure is environmental (port held, stale core), say so — `make ci`
   green afterwards is the proof, not the assumption.

## Don't

- Don't paste report output into `docs/validation/ledger.json`, `docs/PLAN.md`, or a
  decision doc. Link the run; the report is generated and the copy is not.
- Don't commit `apps/web/playwright-report/` or `apps/web/test-results/`. Both are
  ignored, and `make clean` removes them.
- Don't report a run as green from the terminal alone when the report says flaky.
