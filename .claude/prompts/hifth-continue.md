# Continuing work on Hifth

You are picking up work on **Hifth**, a Quran app for huffaz (people memorizing/reciting the
Quran). This prompt is self-contained — read it fully before touching anything, then read
`/Users/omareid/Workspace/git/hifth/CLAUDE.md`, which governs how documentation, decisions, and
registers work in this repo and is not repeated here.

## The end goal

**Ship web v1.0.** Per `docs/PLAN.md`'s own tracking table, every engineering loop (0 through 6b)
is complete; **Loop 7 is in flight and what remains is not a loop but a person** — a hafiz
revision session with zero friction notes, plus a handful of on-device checks only a human can
run. Everything below is either (a) work still needed to make that session trustworthy — the
piece-union guard, the open placement decision — or (b) work parked beside it that doesn't block
it — the Experience Atlas page, Track B (Capacitor), the tajweed colour picker.

Do not treat this as a laundry list to clear in order. Read what's open, form a view on what
matters most against the v1.0 goal, and say so before diving in — most of what's below needs a
judgment call, not just execution.

## The working-backwards plan (trust first)

The organizing question is not "what's open?" but **"what has to be true for a hafiz to open this
during revision and trust it — and keep trusting it?"** Everything below is ordered by working
backwards from that, not by task age. A hafiz's eye on the mus'haf is exact: a rectangle a hair off
the mark, an Arabic numeral written wrong, a hop that lands one ayah early — each is seen instantly
and, once seen, discredits the whole instrument. Trust is the product, and it decomposes into three
things, in order of how fast a breach destroys it:

1. **It does not lie about the page.** Every mark sits on the ink it claims; every hop lands where it
   says; nothing user-visible is quietly wrong.
2. **It survives the real session.** On an actual phone, offline, for the length of a revision — no
   jank, no lost place, screen reader intact.
3. **It becomes theirs.** It learns where *this* hafiz personally slips, so it stops being a generic
   tool and becomes their revision companion. (This is the confusion-point feature — new this session.)

Working backwards from those, all meaningful enhancements rank into four tiers. **Tiers A and B are
the road to web v1.0; C and D come after it.**

**Tier A — the v1.0 gate itself (nothing ships without these).**
- **A1. Rule `mark-placement`, then wire the guard.** The piece-union guard's evidence is now
  complete (§1, item ㉟): run on the never-sat marks it endorses ~73% and refuses ~27%, catching the
  swept-in-neighbour candidates. Ruling the open decision (option H) and wiring the 142 endorsed
  corrections into what the app draws is what turns that evidence into a page that doesn't lie. The
  ruling is the owner's; the wiring waits on it. This is the single highest-leverage open item.
- **A2. The human checks that *are* Loop 7's exit** — `docs/validation/ledger.json`, all `USER:`:
  the on-device perf verdict (#57), the screen-reader walkthrough (#58), offline-survival-8-day,
  revision-record-lands-on-a-phone, and the three placement-by-eye checks
  (`placement-correction-by-eye`, `placement-holds-off-its-own-pages`, `placement-what-kind-of-wrong`).
  These are the literal "not a loop but a person." No agent can run them; help the user run `/validate`.

**Tier B — trust a hafiz's eye would break on (do before or alongside the revision session).**
- **B1. `arabic-number-agreement`** — 37 forms silently substitute Arabic numerals; a hafiz sees a
  wrong numeral at a glance. Each fix is a one-line edit but needs a hafiz's approval, so pair it with
  the revision session rather than guessing.
- **B2. `the-frame-is-registered-on-ornaments-and-used-to-place-text`** — the named root cause of a
  run of alignment symptoms; fixing the root is worth more than the symptoms.
- **B3. `the-crop-draws-neighbours-with-nothing-saying-so`** — `comparison-crop` is decided (F) but
  the build doesn't yet say so on the page.

**Tier C — make it theirs / stop latent rot (deepens trust; not a v1.0 blocker).**
- **C1. The confusion-point feature** — a hafiz documents where their memory slips between ayahs, and
  the app suggests the similar verses (mutashabihat) they likely confused. Design is being drafted this
  session into `docs/design/confusion-points.md` (a design, to become an action plan later).
- **C2. Data-integrity risks** — `diacritic-ids-are-an-unversioned-wire-format`,
  `the-page-table-has-only-one-witness`, `position-might-separate-the-look-alike-pairs`. Latent today;
  they bite a future edition or a future reader.

**Tier D — parked until after web v1.0.**
- **D1. Experience Atlas** — merge the worktree's front-door page + `gate-artifacts.mjs` (§3). A
  convenience, not a trust gate.
- **D2. `mark-C` (#171), `tj-5` colour picker (#176), `mark-D` (#177)** — decided or unblocked, not
  yet built; none block the revision session.
- **D3. Track B (Capacitor, #10)** — gated on web v1.0 and possibly on `gpl-and-the-app-store`.

The rest of this file is the detail behind each tier — read the section a tier points at when you pick
it up. The tier is the priority; the section is the substance.

## Two working trees, same repo

- **Main repo, branch `mark-nudge-identify-the-mark`** — `/Users/omareid/Workspace/git/hifth`.
  Working tree is clean as of this prompt. This is where nearly everything below happens.
- **Worktree, branch `experience-atlas`** — `/Users/omareid/Workspace/git/hifth-experience-atlas`.
  Same repo, checked out separately. Has real uncommitted work sitting in it — see
  "The Experience Atlas worktree" below.

**Standing rule carried into this session: never commit in either tree unless explicitly asked.**
Same for publishing/republishing an artifact to claude.ai — that always needs a per-action ask.

## What's actively open, in priority order

### 1. Task #208 — the piece-union guard (`mark-H/E`), in progress

This is the most-developed open thread and the nearest thing to a v1.0 blocker among the
engineering work. Full narrative lives in `docs/design/mark-registration.md`, items ㉘ through
㉞ (search for `### ㉞` to land on the latest). Short version:

- The app's mark-placement rectangles sometimes come from a "piece-union" candidate that reaches
  for a mark's actual ink rather than resizing a guess toward it. That reach can go wrong two
  ways: growing the candidate too large, or (the more common failure) shrinking it too small.
  Item ㉜ designed a guard that only caught growth; items ㉝ and ㉞ tested it against ground
  truth and found **a symmetric ratio guard — refuse when the candidate's area is more than
  ~1.75x or less than ~0.571x the shipped rectangle's area — catches 87% of real disagreements
  (34 of 39) at a 1.9% false-refusal rate (2 of 106)**, confirmed on 181 ground-truth marks
  (weak-size-part1 + weak-size-part3 sittings combined).
- The scoring script is committed: `packages/etl/scripts/score-piece-union-guard.mjs`.
- **The re-deal is now made — run it now — and executed (item ㉟, this session).** ㉜/㉝/㉞ each
  left open whether to trust the guard's verdicts on the never-sat marks or hold for another
  wrong-size sitting first; the owner chose to run it, on the reasoning ㉞ already surfaced (the
  cutoff held under a *doubling* of ground truth, so a third sitting moves it less than the second
  did, while it blocks nothing). Applied at 1.75/0.571 to every never-sat refused mark with a
  piece-union candidate: **142 of 195 accepted (73%), 53 refused (27%)** — the refusals catching
  candidates grown or shrunk implausibly (worst area ratios 29.6, 20.5, 18.2, plainly swept-in
  neighbours). The accept rate holds at ~73–75% whichever way "never sat" is read. Note the corpus
  has moved well past ㉞'s counts: 209 refused marks now carry a reader's answer (not 145), so
  waiting for `weak-size-part2` buys even less than ㉞ thought.
- **What ㉟ deliberately did NOT do — the one open step here:** wiring the 142 endorsed corrections
  into what the app actually draws. That act *is* adopting option H of the open `mark-placement`
  decision (§2), so it waits on that ruling rather than pre-empting it. ㉟ is the evidence that ruling
  needs; the wiring is A1 in the plan above.
- Related, blocked-on-this: `mark-H/C` (task #188, breaking the fit-to-ink / score-by-ink
  circularity) and `mark-H/D` (task #189, deciding what ships — word boxes move too).

### 2. The open decision: `mark-placement`

`docs/decisions.json` → id `mark-placement`, the only decision left with `status: open` (20
total, 19 decided/living). Six options (A/B/F/G/H/I) for whether the app corrects rectangle
placement per-page, per-line, or per-mark; the page arguing it is
`docs/design/mark-placement.html`, built by `node scripts/build-placement-options.mjs`, published
at `https://claude.ai/code/artifact/7652b2f5-61a1-4072-bfab-ef3b649e55f5`.

**This page changed in the last session** (commit `a5c4160`, already landed): each option now
says what a reader would actually notice, not just how far off the rectangle measures, and a
drawn legend replaced the one-line colour gloss. **The published claude.ai artifact was not
republished with that change — it is currently stale relative to the checked-in page.** Before
this decision gets ruled on, either republish the artifact (ask first — publishing needs explicit
per-action confirmation) or note the drift explicitly if leaving it be for now.

This decision is also the natural output of task #208: option H ("put each mark where its own ink
is, and line the rest up") is the piece-union approach, so how the guard/re-deal question above
resolves is direct evidence for ruling on this.

### 3. The Experience Atlas worktree

`/Users/omareid/Workspace/git/hifth-experience-atlas`, branch `experience-atlas`, has real
uncommitted work — a "Hifth Experience Atlas" landing page (one front door listing every shipped
feature, every design-decision page, every unclaimed published artifact, and the registers'
health) plus a new CI gate, `scripts/gate-artifacts.mjs`, that enforces the `docs/artifacts.json`
schema described in that file's own header comment.

Current `git status --short` in that tree:

```
 M .githooks/pre-commit
 M .github/workflows/ci.yml
 M Makefile
 M docs/artifacts.json
 M docs/design/decision-board.html
 M docs/design/mark-labels.md
 M docs/design/sub-word-marks.md
 M docs/issues.json
 M docs/issues.md
 M docs/map.json
 M package.json
?? docs/design/experience-atlas.html
?? scripts/artifacts.mjs
?? scripts/build-experience-atlas.mjs
?? scripts/gate-artifacts.mjs
```

This was built by an earlier build agent and has already been checked once: a real bug (two
colliding `### ①` open-question headings in `mark-labels.md`, causing `docs/issues.json`'s
`mark-labels-no-register-home` entry to point at the wrong heading) was found and fixed, and all
four gates (`gate-artifacts.mjs` plus the pre-existing three) pass, both full and `--files`-scoped.
The already-published Experience Atlas artifact
(`https://claude.ai/code/artifact/19e5206d-3f76-4c47-ac26-b857b8c8b923`) does not need
republishing for that fix — its build script (`scripts/build-experience-atlas.mjs`) only reads
`decisions.json`, `artifacts.json`, and `map.json`'s `appFeatures`, never `issues.json`.

**What's actually left here is a human decision, not more verification: does this page and gate
get merged into the main branch, and if so, when/how.** It has not been reviewed by the user yet.
Don't re-verify from scratch — the fix is solid — but do check whether anything has moved in the
worktree since (`git status`, `git diff`) before assuming this description is still current.

### 4. Open issues register — `docs/issues.json`

37 open of 150 total (25 question, 4 defect, 8 risk) in the main repo. Full detail lives in the
register and its rendered form (`make issues` / `docs/issues.md`) — don't restate it here, it
rots. The defect/risk items worth knowing about by name before you start:

- `arabic-number-agreement` (defect) — 37 forms silently substitute Arabic numerals; each fix is
  a one-line JSON edit but needs a hafiz's eye to approve.
- `the-crop-draws-neighbours-with-nothing-saying-so` (defect) — decision `comparison-crop` is
  decided (option F) but the build doesn't yet say so on the page.
- `gpl-and-the-app-store` (risk) — Track B (Capacitor/App Store) may be blocked by a GPL/App
  Store licensing conflict; unresolved.
- `track-b-order-is-unachievable` (defect) — half-fixed; a citation was checked and found to not
  fully support the claim it's attached to.
- `diacritic-ids-are-an-unversioned-wire-format` (risk) — marks ship as bare integers, not
  versioned names.
- `the-correction-is-only-judged-where-it-was-fitted` (risk) — placement correction coverage gap.
- `the-frame-is-registered-on-ornaments-and-used-to-place-text` (defect) — named root cause of a
  run of alignment symptoms.
- `reach-for-the-ink-rather-than-resize-toward-it-guard` (risk) — **this is task #208's own
  issues.json row**; its note says explicitly "read item ㉝" for current state, which is now
  superseded by ㉞ (see section 1 above) — the issue row itself may need a refresh once #208's
  re-deal question is settled.
- `the-displacement-correction-could-go-stale` (risk) — only bites if a per-page correction is
  adopted; no re-derivation mechanism exists.
- `position-might-separate-the-look-alike-pairs` (risk) — shape alone can't separate certain
  diacritic pairs (fatha/kasra, fathatan/kasratan).
- `nothing-checks-the-package-tree-licences` (risk) — `gate:license*` gates don't scan
  `node_modules`.
- `the-page-table-has-only-one-witness` (risk) — a single data table backs three shipped outputs
  with nothing cross-checking it.

Run `make issues` (or `node scripts/build-issues-doc.mjs` to rebuild, if it's been hand-edited)
to see the full current picture, including the 25 open questions not listed above.

### 5. Human-only validation — `docs/validation/ledger.json`

9 of 11 checks are `pending`, and **none of them can be run by an agent**:
`perf-verdict-on-device`, `screen-reader-walkthrough`, `kfgqpc-terms-primary-source`,
`edge-spot-audit`, `offline-survival-8-day`, `revision-record-lands-on-a-phone`,
`placement-correction-by-eye`, `placement-holds-off-its-own-pages`, `placement-what-kind-of-wrong`.
These map to task-board items #55, #57, #58, #59, #61 (all tagged `USER:`) and are the literal
"what remains is not a loop but a person" from `docs/PLAN.md`. Don't try to substitute automated
checks for these — flag them to the user and, if useful, help them run `/validate` to walk
through what's needed.

### 6. Parked, not blocking v1.0

- **Task #171 `mark-C`** — ship the shards, gate, and skin at mark granularity (the `B` option
  decided in the last session, see below).
- **Task #176 `tj-5`** — the colour-settings surface itself (readers changing tajweed colours),
  now unblocked by the `tajweed-colours` decision below but not yet built.
- **Task #177 `mark-D`** — whether the ink in the app's boxes matches what it claims.
- **Task #52** — tajweed golden row, **blocked by #9** (Loop 7), gated on hafiz sign-off plus a
  test-only skin flag.
- **Task #10 / Track B** — Capacitor iOS-then-Android wrapping, **blocked by #9**, and possibly on
  the `gpl-and-the-app-store` risk above getting resolved first.

### Task-tool dependency graph, as of this prompt

The session task tracker (`TaskList`) currently holds these 14 open items, with three real
blocking edges — **#9 is the load-bearing one**, since both #10 and #52 sit behind it:

```
#9  Loop 7 → web v1.0        ← blocked by #57, #58   (both USER: on-device checks)
 ├─ #10 Track B (Capacitor)  ← blocked by #9
 └─ #52 Tajweed golden row   ← blocked by #9
```

Everything else (#55, #59, #61, #171, #176, #177, #188, #189, #208) is unblocked in the tracker
and can be picked up independently. **Completed tasks are archived, not left in the live list**:
when a task finishes, write a dated entry to `docs/tasks/done.md` (pointing back to the commit or
design-doc item that carries the actual reasoning — don't restate it there) and then delete it
from the tracker with `TaskUpdate({taskId, status: "deleted"})`. Tasks #209 and #210 (the
piece-union script rebuild and its first area-ratio scoring) were archived there this session —
see that file for what they were before assuming the tracker's history starts at #9.

## What just landed (context, not open work)

Two decisions were ruled on and committed in the last session — mentioned here only so you don't
re-litigate them:

- **`mark-granularity`** — decided **B** (colour the exact letter/mark a rule names, not the
  whole verse), by omar, 2026-08-19. Record: `docs/decisions/mark-granularity.md`. This is what
  unblocks task #171 (`mark-C`) — nothing yet implements it.
- **`tajweed-colours`** — decided **B, with C offered behind an advanced setting**, by omar,
  2026-08-19. Record: `docs/decisions/tajweed-colours.md`. This is what unblocks task #176
  (`tj-5`) — nothing yet implements it either.

Both records and `docs/decisions.json`/`docs/decisions/README.md` were rebuilt and pass
`node scripts/gate-decisions.mjs`. Commit `f75acf9`.

`docs/design/mark-placement.html` also gained the reader-facing rewrite described in section 2
above. Commit `a5c4160`.

### This session (uncommitted as of writing — the standing no-commit rule held)

- **The re-deal was made and executed** (§1). New design-doc item ㉟ in
  `docs/design/mark-registration.md` records it; the `reach-for-the-ink…` issue row was refreshed
  to point at ㉟ instead of the superseded ㉝, and `docs/issues.md` rebuilt. None committed.
- **The confusion-point feature (Tier C1) was handed to a subagent** to draft
  `docs/design/confusion-points.md` — a design, to become an action plan later. Check whether that
  file has landed and read it before picking up C1.
- **This prompt itself was rewritten** with the trust-first working-backwards plan at the top; the
  tiers there are the current priority order.

## Every published artifact, current as of this prompt

This is the full `docs/artifacts.json` register — eleven pages published to claude.ai. Carry all
eleven into the new session; don't rediscover them. `decision`/`page`/`builtBy` null means the
row's own note explains why (usually: published from a scratch directory that's since been
cleared, and never attached to a decision).

| # | title | published | decision | checked-in page | status |
|---|---|---|---|---|---|
| 1 | Where should the sittings live? | 2026-08-17 | `sitting-hosting` | `docs/design/sitting-hosting.html` | decided (A), current |
| 2 | Hifth Decision Board | 2026-08-17 | — | `docs/design/decision-board.html` | current, no decision to attach to |
| 3 | What should the panel show around the ayah? | 2026-08-17 | `comparison-crop` | none checked in | decided (F); see issue `the-crop-draws-neighbours-with-nothing-saying-so` above |
| 4 | Where the rectangles go | 2026-08-15 | `mark-placement` | none checked in | **STALE — checked-in `mark-placement.html` changed this session (commit `a5c4160`) and was not republished. This is the same open decision as section 2 above.** |
| 5 | Registered on the Ornaments | 2026-08-13 | — | none | orphaned diagnosis; feeds the still-open `the-frame-is-registered-on-ornaments-and-used-to-place-text` issue; no home yet |
| 6 | One colour a verse — should Hifth colour tajweed more finely? | 2026-08-08 | `mark-granularity` | none checked in | **now decided (B) — the artifact itself (the three drawn options) doesn't need to change, since the decision was which option, not the drawing** |
| 7 | Whose colours are they? | 2026-08-08 | `tajweed-colours` | none checked in | **now decided (B, with C advanced) — same as above, artifact doesn't need to change** |
| 8 | Two spellings, one word | 2026-08-07 | — | none | orphaned finding; belongs in whatever record covers the two text readings |
| 9 | Two segmentations, one text — PLAN ⑬ | 2026-08-04 | — | none | orphaned; title uses internal shorthand, predates the "page must be checked in" rule |
| 10 | Should the two leaves pan and zoom together? | 2026-08-04 | — | none | orphaned; reads like a decision in everything but filing — should become a real `docs/decisions.json` row |
| 11 | Hifth Experience Atlas | 2026-08-26 | — | `docs/design/experience-atlas.html` | **only exists in the `experience-atlas` worktree, uncommitted — see section 3 above** |

Rows 4, 6, 7 changed meaning or went stale specifically because of this-session-and-last-session
work; the rest are unchanged but listed for completeness per the instruction not to let a
published page exist that the tree doesn't know about.

## How to start

1. Confirm the state is still accurate — `git status` in both trees, `TaskList` for the live task
   set, and re-check whether `docs/decisions.json`'s `mark-placement` is still the only open
   decision. `docs/tasks/done.md` holds what's already been archived out of the tracker — check it
   before assuming a task's history starts at its own ID.
2. **The priority order is the working-backwards plan at the top, not task age.** Tiers A and B are
   the road to web v1.0; C and D wait. The highest-leverage open item is A1 — ruling `mark-placement`
   and wiring the guard (evidence now complete, item ㉟). If you pick up the guard thread, read
   `docs/design/mark-registration.md` from `### ㉟` for where it actually stands (not ㉞ — that's
   superseded).
3. Don't commit or publish anything without asking first, per the standing rule above.
4. Whatever you pick, say *why it's the trust-first move* before diving in — the destination is a
   hafiz who trusts this, and every item earns its place by how directly it serves that.
