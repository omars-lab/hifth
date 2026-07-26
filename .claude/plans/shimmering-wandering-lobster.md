# The verification story: one source, three renderers

## Context

**Do we have a good verification story? Half of one.**

The automated half is genuinely strong and needs no rescuing: eight testing tiers, six
`gate:*` scripts, eleven e2e specs, golden images, Lighthouse, and `make ci` mirroring CI
exactly.

The manual half — the checks that decide the rendering architecture, the a11y floor, and
whether the *scripture data is true* — has a register (`docs/validation/ledger.json`), a gate
that keeps it honest (`scripts/gate-validation.mjs`), and a skill that catalogues it. What it
does **not** have is a runbook. Each check's `how` is one sentence of prose. Nothing anywhere
says which URL to open, what should appear on screen, what a pass looks like versus a fail,
or what to do when it fails. And these checks happen **on a phone**, while every word of
guidance lives in a terminal the phone cannot see.

That gap is not theoretical. Follow-up ① sat open for six loops behind four steps of DevTools
friction; `make phone-perf` removed the friction, and the check still has no page telling the
person holding the phone what they are looking at. Six checks are outstanding, five block a
loop, and one of them (the edge spot-audit) is the only check that can establish the data is
correct.

**Outcome:** every manual check becomes runnable by someone holding a phone with no memory of
this conversation — commands to run, URLs to open, what to expect on screen, how to read the
result, and one line that records it. Written once, in the ledger; rendered to the terminal,
to a phone-readable guide, and to the skill that drives the session.

## The shape

One source, three renderers. The rule this tier already runs on — a manual result must
tighten something automated — extends to the instructions themselves: a runbook lives in one
file or it drifts, and a drifted runbook is worse than none because it fails silently.

```
docs/validation/ledger.json          ← the only place a runbook is written
   │   (per check: needs · setup · steps[{do, expect}] · reading · record)
   │
   ├── make validate CHECK=<id>      → the runbook in the terminal
   ├── make guide                    → docs/validation/guide.html, served to the phone
   └── /validate skill               → drives a session: pick → run → read → record
```

## Work

### 1. `docs/validation/ledger.json` — add `runbook` to all six checks

New field per check, documented in the existing `$comment` block:

```jsonc
"runbook": {
  "needs":  ["a mid/low-tier Android or an older iPhone", "same Wi-Fi as this laptop"],
  "setup":  [{ "run": "make phone-perf",
               "expect": "prints http://<lan-ip>:4173 and holds the terminal open" }],
  "steps":  [{ "do": "Open that URL on the phone",
               "expect": "a dark slab across the top: «قياس الأداء على هذا الجهاز» + an ابدأ button" },
             { "do": "Tap ابدأ and follow the bar: pan 5s, pinch 5s, tap ayahs 5s",
               "expect": "a per-segment countdown; the slab stops taking taps while recording" }],
  "reading": ["p95 ≤ 16.7 ms and jank < 10% on all three → inline-SVG everywhere holds",
              "pinch p95 far worse than pan → re-raster past the backing store → content-visibility or raster fallback",
              "«too few frames — not driven» → that segment was never gestured; re-run it"],
  "record": "make record CHECK=perf-verdict-on-device RESULT='<paste the JSON>'"
}
```

All six get one, written from what the code actually does — the probe's own Arabic strings
(`apps/web/src/perf/probe.ts`), the real label shape emitted by `enhancePolygons()`
(`packages/core/src/highlighter.ts:236`: `role="button"`, `tabindex="0"`,
`aria-label="الآية ٢:٤٨"`), the page SVG's `role="group"` + `aria-labelledby` set in
`PageStage.tsx`, the colophon opening from the wordmark (`aria-label="عن حِفظ"`), and
`make audit-edges N=20 SEED=1`'s printed output. Where a check is not yet runnable —
`offline-survival-8-day` needs Loop 6b's pin-a-juz UI — its `needs` says so plainly instead
of describing a button that does not exist.

### 2. `scripts/gate-validation.mjs` — three additions

- **`--check <id>`** prints one check's full runbook, numbered, ending in the record command.
  Backs `make validate CHECK=<id>`. No-arg behaviour is unchanged.
- **New invariant:** a `pending`, `owner: "user"` check with no `runbook.steps` fails the
  gate. Same reasoning as the existing `tunes` rule — a check nobody can follow will not be
  run, and it should not be able to sit in the ledger looking tracked. Still no failure for
  merely being `pending`.
- **Guide staleness:** hash the ledger's runbook payload and compare against the
  `data-ledger-hash` attribute baked into `guide.html`; a mismatch fails with "run
  `make guide`". Mirrors the ETL determinism rule — a committed generated artifact is only
  trustworthy if a gate proves it was regenerated.

### 3. `scripts/build-validation-guide.mjs` (new) → `docs/validation/guide.html`

Self-contained (inline CSS, zero external requests), mobile-first, committed so it also reads
on GitHub. Design brief — deliberately **not** the app's paper-and-ink palette; the probe set
this precedent with its `#14110d` slab, and an operator tool that looks like the product is a
tool someone will mistake for the product:

- Dark field-guide look, one check per card, large type, 44px targets, `dir="ltr"` shell with
  the Arabic UI strings quoted inline as they appear on screen.
- Per card: what it blocks · what you need · commands in `<pre>` · numbered steps each with
  its own **Expect** line · how to read the result · the exact `make record …` line.
- **No copy buttons.** A LAN preview is plain `http://`, not a secure context, so the
  Clipboard API is unavailable — the same trap the probe already hit. A dead button is worse
  than no button.
- Checkboxes persisted in `localStorage`, so a 15-minute walkthrough survives a screen lock.
- Header states the standing rule (a result must tune something) and each card names what it
  blocks, so the person holding the phone knows what their fifteen minutes unblocks.

`make guide` regenerates the file and serves `docs/validation/` over the LAN, printing the
phone URL. The server is ~20 lines of `node:http` inside the same script (`--serve`), not
`python3 -m http.server` — `python3` here resolves to a conda env and is not a dependency
this repo should acquire. Port 4174, so it can run beside `make phone-perf` on 4173 and the
guide and the app under test are open on the same phone.

### 4. `scripts/record-validation.mjs` (new) — write the verdict back

`make record CHECK=<id> RESULT='…'` sets `status: "done"`, `verifiedOn` (today), and
`result`; refuses an unknown id; then **prints that check's `tunes` list as the work now
owed** and re-runs the gate. Hand-editing JSON at the end of a walkthrough is exactly where
results get lost, and the `tunes` reminder is the step that converts a verdict into a
permanent test instead of a note.

### 5. `.claude/skills/validate/SKILL.md` — Tier 7 becomes a driver

Tier 7 stops restating each check's how-to (that now lives in the ledger and renders itself)
and gains an explicit session procedure: `make validate` → pick a check → `make validate
CHECK=<id>` or `make guide` → run it → `make record …` → do what `tunes` printed → commit.
Tiers 0–6 are untouched.

### 6. `docs/PLAN.md` — stop restating runbooks

§Testing plan points at `make guide`; follow-ups ②④⑤ keep their *reasoning* and drop their
how-to sentences in favour of the ledger id — so there is exactly one description of how to
run each check, in the file the renderers read.

### Files

| File | Change |
|---|---|
| `docs/validation/ledger.json` | `runbook` on all six checks; `$comment` documents the field |
| `scripts/gate-validation.mjs` | `--check`, the runbook invariant, guide-staleness hash |
| `scripts/build-validation-guide.mjs` | new — ledger → `guide.html`, plus `--serve` |
| `scripts/record-validation.mjs` | new — record a verdict, then name what it tunes |
| `docs/validation/guide.html` | new, generated + committed |
| `Makefile` | `validate CHECK=`, `guide`, `record` (beside `phone-perf`, reusing `LAN_IP`) |
| `package.json` | `guide`, `record` scripts, so `pnpm` and `make` stay in step |
| `.claude/skills/validate/SKILL.md` | Tier 7 → driver procedure |
| `docs/PLAN.md` | §Testing plan + follow-ups ②④⑤ point at the ledger |

## Verification

1. `make validate` → unchanged list. `make validate CHECK=perf-verdict-on-device` → the full
   runbook, numbered, ending in its record command.
2. `make guide` → open the printed URL on the phone and walk the perf card end to end against
   `make phone-perf` in a second terminal. Every **Expect** line must match what the phone
   actually shows; a line that does not match is a bug in the runbook, and fixing it is the
   point of the step.
3. **Negative tests, induced then reverted** — the pattern both existing gates were verified
   with: strip `runbook.steps` from a pending user check → gate fails; edit a runbook without
   running `make guide` → staleness failure naming the fix; `make record CHECK=nope` → refuses.
4. `make record CHECK=kfgqpc-terms-primary-source RESULT='…'` against a scratch copy of the
   ledger → status/`verifiedOn`/`result` stamped, `tunes` list printed, gate still green.
5. `make ci` green; commit code and docs separately.

**Not doing:** publishing the guide to any external host, and any change to testing tiers 0–6.
