# The instrument that asks the question has to be trustworthy first

## Context

Sixteen sittings are about to be sat. Between them they cover all **1,851** marks the machine
could not place from ink — every one seen, not sampled — at roughly an hour each. That is
sixteen hours of the scarcest thing this project has.

Before spending it, the page that does the asking was audited against the frontend-design
brief, and three of its findings do not make the sitting *slower*. They make its answers
**mean something other than what they say**:

1. **In dark mode the rectangles are drawn in near-invisible colours.** The crop's paper is
   deliberately never re-themed — a mus'haf page stays on white — but the two rectangle stroke
   colours *are* re-themed, and then drawn on that white. Measured: our box 5.05:1 → **2.49:1**,
   the reader's box 4.89:1 → **1.70:1**, at a constant 1.64px stroke. A reader who cannot see the
   box affirms it. This finding runs in exactly the direction that looks like success.
2. **A destructive control lands where the reader's thumb already is.** The answer list sits
   directly above Back/Next, each answer adds a ~28px row, and the "take it back" button in that
   row is right-aligned — into the corner Next occupied a moment earlier. Two taps of Next can
   retract the answer just given.
3. **Every pointer frame re-parses the page.** The drag handler rebuilds the stage from
   `c.svg` — 2.0 / 9.2 / **23.2 KB** of path data (min/median/max) — on every `pointermove`. A
   correction that stutters is a correction the reader gives up on and affirms instead.

Below those, four findings cost time and accuracy rather than truth: the affirm button looks
the same pressed as unpressed; it sits at y≈842 on a 393px phone, below the fold, behind a
~275px lede that never goes away; 91 of 115 cards carry the mark's containing word and throw it
away, while the sentence naming the mark omits the mark's own name and is the dimmest text on
the card; and four **destructive or load-bearing** controls are under 44px.

**Decided with the reader, 2026-08-14:** the buttons get pinned to the bottom of the screen and
the picture keeps its own shape (nothing ever shrinks); the fixes land **before** part 1 is sat,
which costs nothing because the sixteen parts were re-dealt and **0 of 1,851** have been
answered on the new deal; scope is the three data-corrupting findings plus the four
time-and-accuracy ones.

**Outcome:** all 1,851 marks are answered on one instrument, and the transcript means what it
says.

### What the audit explicitly warns against, and why

- **Do not put the fault buttons behind a disclosure.** Adding a tap to reporting a fault while
  affirming stays free biases the exact ratio the sitting exists to measure. Change weight, not
  cost.
- **Do not highlight the ligature's own ink in the crop.** Where the ink is, is the unknown
  being measured. Also ruled out and not to be revisited here: centring the crop on the mark's
  own ink; SVG resize handles on the rectangle.

---

## Also in scope: the scorer is reporting the wrong number

`score-mark-report.mjs` (~377-387) medians the `by` field across every placement **event**. Two
things are wrong with that, and they were verified against the banked transcript, not argued:

**It medians increments, and increments cancel.** `by` is always an increment — both the nudge
pad (`flush`) and the drag (`pointerup`) send the burst, and `to` is the running total. Of 179
consecutive pairs on the same mark, **133** chain exactly; the other 46 are marks where the
reader pressed *put it back where it was*, and a banked transcript has retractions already
applied, so the superseded placements are gone and the chain legitimately restarts. Nothing is
wrong with the field. What is wrong is medianing it: opposite-signed ±0.1 increments cancel, and
one mark with 44 events outvotes 25 marks with one each. The scorer prints **0.000 / 0.000**.

**And `to` is not the reader's hand.** `to = at + total − box`, so it is measured from the
**shipped** box and already contains the correction the pipeline applied. Three different
numbers, all real, currently collapsed into one wrong one:

| question | across | down |
|---|---|---|
| what the scorer prints today | 0.000 | 0.000 |
| where the reader put it, against what ships | −3.569 | −3.134 |
| **how far the reader's own hand moved it** | **−2.468** | **−2.010** |

The middle row is what corroborates the ink measurement: the corpus sets its text lower and
further across than the ornament fit predicts, `dty` negative on **599 of 600** pages. Two
instruments, same direction, same rough size. That is worth printing correctly.

---

## The work

Fixes are ordered so each lands in one place rather than in a string another fix is about to
rewrite. **Do them in this order.**

### ① Parse the paths once per card — `build-mark-report.mjs`, `paint()` ~1084-1122

Split `paint()` into `mount(c)` and `paint()`.

- Module-level `let drawnFor = null, hitEl = null, boxEl = null, mineEl = null;`
- `mount(c)` writes `stage.innerHTML` **once per card**: `c.svg` plus the `.hit`, `.grab` and a
  hidden reader's rect; caches the three nodes; sets `drawnFor = c.id`.
- `paint()` calls `mount(c)` only when `drawnFor !== c.id`, then `setAttribute`s x/y/width/height
  on the cached nodes and toggles the reader's rect's `visibility`. The `viewBox` write stays.
- The `.hit` slack `t = vb[2]/30` stays per-frame — it is unit-based and framing-dependent.
- **Drop `sw = vb[2] / 220`** and use `vector-effect="non-scaling-stroke"` with `stroke-width` in
  CSS pixels. That constant is 1.64px *only because* the stage is `width: 100%`; leaving it in
  makes stroke width a function of each card's aspect the moment anything sizes the stage
  differently. One fewer per-frame attribute write, too.

This is what `crop()`'s two-viewBox design was always for — the framing toggle becomes one
attribute write instead of a 23 KB reparse — and it has never actually delivered it.

**Correction to the audit:** pointer capture is on the **stage** (`stage.setPointerCapture`,
~1158), gated by `onRect(p)` (~1141) — not on a rect node. `docs/map.json:752` describes the
gate. So rebuilding mid-gesture never risked capture; do this fix for the parse cost alone.

### ② Keep the rectangles legible on white paper, in both themes — CSS ~514-525

The rule to establish and then never break: **nothing drawn on the paper is themed.**

- Add to bare `:root` **only**: `--ours-line`, `--ours-wash`, `--yours-line`, `--yours-wash`
  (suggested `#c2410c` / `#c2410c1f` and `#15803d` / `#15803d24`).
- Leave `--ours` / `--yours` / `--ours-fill` / `--yours-fill` exactly as they are and keep them
  re-themed — they are **chrome** (affirm button, pressed state, focus ring, the answer list, the
  bank panel) and sit on `--field`, so they must stay themed.
- `mount()` draws with the four new tokens. Add one line of comment saying they join `--paper`
  and `--ink` in the never-re-themed set, and *why*.
- Carry the distinction independently of hue at the same time:
  `stroke-dasharray="0.6 0.4"` on the reader's rect. Two rectangles that differ in dash as well
  as colour survive deuteranopia, and survive anyone re-theming the palette later.

Light theme comes out byte-identical. Dark theme returns to 5.05:1 and 4.89:1.

### ③ Pin the buttons to the bottom — markup ~679-697, CSS

Two independent halves; **③b must land whichever layout is chosen.**

**③a — the dock.** Move the affirm row and the Back/Next row into one `<div class="dock">` with
`position: sticky; bottom: 0; background: var(--field); border-top: 1px solid var(--edge);
padding: .5rem 0 calc(.5rem + env(safe-area-inset-bottom));` and bump the main column's bottom
padding. **Sticky, not fixed** — it keeps document flow and does not fight the iOS URL bar.
Requires `viewport-fit=cover` on the viewport meta (~511) or `env()` resolves to zero; that is
also the whole of the safe-area finding.

The picture keeps its natural per-card shape (295–410px judging, 266–529px identifying, measured
across all 1,851 marks). Nothing shrinks, `ptIn()` is untouched, and on the tallest cards the
reader scrolls the picture behind a dock that never moves. **Explicitly not doing:** normalising
the two viewBoxes to a constant aspect inside `crop()` — it either shrinks the mark or makes
every card as tall as the tallest, and the ring clip would have to be re-ordered after the
normalisation or the new margin comes back empty of the ink that belongs in it.

**③b — get the destructive control out of the thumb corner.** In the answer list row, move "take
it back" to the **start** of the row (button, then the kind, then the detail) so nothing tappable
sits bottom-right, and give the list at least 44px of bottom margin. **This must ship before ⑦
enlarges that button to 44px**, or the mis-tap target doubles.

### ④ Make the affirm button look pressed — CSS ~596

`button.affirm[aria-pressed="true"]` gets a solid fill: background `var(--ours)`, text
`var(--field)`, matching border. Inverts legibly against both themes and reads as *on* without a
second glance. Add a check glyph via `::before` on the pressed state only. **Do not change the
label text** — that would move the fold ⑤ just fixed.

*(The audit's specificity claim was off by one rule: `button.affirm` and the generic pressed rule
are both (0,1,1) and settled by source order; the actual out-specifier is
`button.affirm[aria-pressed="true"]` at (0,2,1). Conclusion unchanged.)*

### ⑤ Get the lede off the fold without touching the fault buttons — markup ~640-646

Split the lede into the full text and a one-line brief, with a quiet toggle between them. The
brief shows once the reader has demonstrably read it: `seen > 0`, persisted through a
`keepRead`/`keptRead` pair written **exactly** like the existing `keepSeen`/`keptSeen`
(~733-736) — try/catch on every call, because a `file:` origin throws.

Roughly 230px comes off the fold. **No answer costs a tap more than it does today**, so the
affirm/fault ratio the sitting measures is untouched. That constraint is the whole design.

### ⑥ Say which mark, properly — `identify()` ~1240-1264

- The card already carries the containing word and throws it away for the 91 cards that have
  both it and a single letter. Keep the big letters as they are, and append the word after them
  at ~1rem, dim, `lang="ar" dir="rtl"`.
- Put the mark's **name** into all three branches. It reaches only the `of === 1` branch today.
- The sentence naming the mark is the question, not a footnote: `--dim` → `--text`,
  .82rem → .9rem.

### ⑦ 44px on the four — CSS

All four are omissions from a convention this file already keeps elsewhere (the note pad and the
chips are already 44/48):

| control | today | why it matters |
|---|---|---|
| take it back | ~24px | destructive — **land ③b first** |
| the two view toggles | ~31px | pressed constantly, both framings |
| hand over what I have said | ~29px | the reader's safety net |
| put it back where it was | 34px | destructive; also give it `margin-left: auto` so it is not shoulder-to-shoulder with "Finer steps" |

Land **after** ⑤ and ③, since each of those moves the fold.

### ⑧ The scorer — `score-mark-report.mjs` ~377-387

Do 1-4 **before** 5. Steps 1-4 work on the two transcripts already on disk, which cannot be
re-recorded; once the headline reads `to`, the rename stops being load-bearing.

1. Collapse to **one row per mark** — walk in order, keep the last placement carrying a `to`.
2. Print the reader's **hand**: `to` minus the displacement already shipped
   (`drawnAt(r) − r.box`, both already available). Median/p90/worst of the magnitude, plus signed
   per-axis medians. **−2.468 / −2.010** on the banked sitting.
3. Print, under a **separately worded** sentence, where they landed **against what ships** —
   median final `to`, **−3.569 / −3.134** — and say in the prose that this one includes the
   correction the pipeline already applied, so no reader ever differences the two.
4. Say *n marks*, and say how many events those marks took. 26 marks / 205 events is itself a
   finding about the nudge pad.
5. ~~Rename the drag's field.~~ **Dropped.** Both paths genuinely send an increment and `to` is
   the running total, so one name is right, and a rename would only make the two transcripts
   already on disk unreadable. (The drag path does not need `flush()`'s save-and-restore around
   `dropVague` either: it captures the total at ~1190, before, and reassigns at ~1199, after.)

---

## The hazard, and the guard for it

**The whole page — CSS, markup and JS — lives inside a template literal.** Backticks are
forbidden anywhere in the emitted region *including comments*, and `${` must not appear except
as a deliberate interpolation. This has broken the file three times.

Add two assertions to `build-mark-report.test.mjs` that say so out loud: the emitted HTML
contains no backtick and no `${`. Two lines, and they document the trap.

## Tests

The suite today parses the head and the cards out of the emitted HTML and string-matches the
emitted script. Both styles extend cleanly; there is no visual coverage and none is being
invented here.

| fix | what a test would actually assert |
|---|---|
| ② **highest value** | the dark block re-themes **none** of the paper, the ink, or the four new rectangle tokens; and both rectangle line colours clear 3.0:1 against the paper. Twelve lines, no browser, and it is precisely the invariant that broke. |
| ① | the paint function contains no `innerHTML`, and `c.svg` appears exactly once in the emitted script, inside `mount`. Coarse, in the same spirit as the existing replay test, and it catches the regression that matters. |
| ⑥ | data, not layout: a single-letter card always carries a longer containing word — this is what makes the fix possible and what would silently stop being true. Plus that the mark's name reaches all three branches. |
| ⑤ | the brief lede exists and the collapse is keyed off the stored flag; a regression deletes the second copy. |
| ⑧ | in `score-mark-report.test.mjs`, which already builds synthetic transcripts and asserts on stdout: one mark nudged +0.5, −0.4, +0.4 (final `to` 0.5) and a second moved once by 0.5 — assert the printed median is **0.5, not 0.4**, and that the line says **2 marks**, not 4 events. That fixture would have caught this. |
| ③④⑦ | not testable here beyond CSS-text presence. Fold position, per-frame cost and thumb geometry need a browser, and there is no in-repo harness for one. |

## Registers

- **`docs/map.json:752`** — the `build-mark-report.mjs` note is the canonical home and already
  records *why* each control sits where it does, including two prior interaction regressions.
  Fixes ①②③ belong there. Hand-edited.
- **`docs/map.json`** — `serve-sittings.mjs` has **no row anywhere in `docs/`**. It needs one;
  it is the thing that makes an answer survive the browser losing it.
- **`docs/validation/ledger.json` → `placement-what-kind-of-wrong`** — its 13 runbook steps
  **are** the reader's on-screen instructions. ⑤ and ⑥ change what the reader sees; the steps
  change with them. Then `pnpm guide`.
- **`docs/issues.json`** — only for the findings that **distorted a measurement**, which is this
  repo's convention for a review tool (precedent: the "wrong instrument" paragraph inside
  `nobody-has-looked-at-the-placement-verdicts`). That is finding ② and the scorer ⑧ — not the
  ergonomics. Then `pnpm issues:doc && pnpm gate:issues`.
- **A design doc is not warranted yet.** `docs/design/encoding-inspector.md` is the template if
  it ever is.

### Owed from the sitting already completed, and still unrecorded

`make record CHECK=placement-what-kind-of-wrong RESULT='…'` — sixty marks from the placed set,
every one explicitly affirmed, no faults. Bounds visible placement error at about **5%, not at
zero**. The caveat that must survive into the wording: the placed population is defined by a
match of 0.55 or better and a displacement under 3 units on a mark 5.6 × 3.6, so **gross errors
were structurally impossible on those cards**. The check also owes its `tunes` step — a manual
result must tighten something automated, and the gate fails if it tunes nothing.

## Verification

1. Rebuild all sixteen and confirm the deal is unchanged — same slice fingerprint, 1,851 marks
   across sixteen parts, 0 answered marks re-asked:
   `for n in 1..16; node scripts/build-mark-report.mjs --rows out/mark-rows.line-tilt.json
   --set fallback --seed 23 --part $n/16 --answered … --out out/sit.fallback-$n-of-16.html`
2. `pnpm --filter @hifth/etl test` — the new assertions above, including the two hazard guards.
3. Re-run the scorer over the two banked transcripts and confirm it prints the hand and the
   against-what-ships figures as **two** numbers under two sentences.
4. Open part 1 on the phone over the tailnet, in **dark mode**, and confirm by eye: both boxes
   visible on white paper; the buttons do not move between cards; the drag does not stutter on
   the largest card; affirm is above the fold and obviously pressed when pressed.
5. `pnpm issues:doc && pnpm gate:issues`; `pnpm guide` after the ledger edit;
   `pnpm gate:validation`.
6. `git add -A && make ci`. Commit code and docs **separately**.

## Operational

- `cd /Users/omareid/Workspace/git/hifth && ./scripts/with-lock.sh <label> "sh -c '<cmd>'"`, and
  re-export `PATH` **inside** the quoted command every time.
- Registers are hand-edited, never generated. Never `--no-verify`.
- `build-mark-report.mjs`, `serve-sittings.mjs`, `score-mark-report.mjs` and their tests are all
  still **untracked** — CI does not run them today. This work arrives as part of their first
  commit, not as a diff against a baseline.
