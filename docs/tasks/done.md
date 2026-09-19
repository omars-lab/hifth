# Completed tasks

An archive, not a register — the session task tracker (`TaskList`) only shows what's still open,
so a task moves here once it's done rather than staying in that list forever. This file is not
the record of what was decided or found; that lives in the design docs, decisions, and commits
each task fed into. This is a dated pointer back to those, kept so a finished task isn't simply
deleted and forgotten.

Nothing here is hand-restated from those sources beyond a one-line summary — read the linked
commit or design-doc item for the actual reasoning.

## #209 — Rebuild the piece-union candidate script (reach-for-the-ink)

**Done:** 2026-08-19, commit `650ecbd` "Rebuild the piece-union script the doc's numbers came
from, so ㉜ has one".

The "reach for the ink" script behind item ㉘/㉙'s numbers had been run twice and discarded —
never committed, so nothing backed the two aggregate figures on record. Rebuilt as
`packages/etl/scripts/probe-piece-union.mjs`, reusing `readPageInk`/`shapeOf` from
`packages/etl/lib/ink.mjs`. Needed before #210 could test a guard against real per-mark candidate
output rather than two remembered numbers.

## #210 — Score an area-ratio cutoff against the 45 doubled ground-truth marks

**Done:** 2026-08-19, commit `e333652` "The guard ㉜ proposed catches a quarter of what it needs
to; both ways, three in four" — full writeup at
[`docs/design/mark-registration.md` item ㉝](../design/mark-registration.md).

Ran the rebuilt script against all 89 ground-truth marks with a settled reader answer. The guard
exactly as ㉜ proposed it — refuse only when a candidate grows past the shipped rectangle —
catches just 5 of 20 (25%) real disagreements, because 15 of those 20 are candidates that
*shrank*, which a one-sided "too big" test structurally can't see. The same measure read
**symmetrically** (flag both far-too-big and far-too-small) catches 15 of 20 (75%) at one false
flag among 52 good marks (94% precision). Verdict: the guard as literally proposed — kill; the
symmetric reframing — confirmed, and escalated as a revision to ㉜'s own test. Later doubled to
181 marks and re-cut at 1.75/0.571 by item ㉞ — see
[`hifth-continue.md`](../../.claude/prompts/hifth-continue.md) §1 for where that stands now.

## #1 · #3 · #6 · #18 · #19 · #23 — Desktop two-page spread triage: width, tap-shift, zoom, edge-grab turn, level leaves

**Done:** 2026-09-01, commit `b90b450` "Desktop spread triage: edge-grab turns, zoom open, level
leaves, solid beads" (the zoom decisions recorded alongside in `b6933ba`).

The spread's first desktop pass: the reading column stopped stretching too wide, tapping a verse no
longer nudged the page upward, zoom opens to 100% and past, the outer fore-edge turns the leaf under a
hand cursor, and a juz jump lands the two leaves level. The still-missing desktop turn animation was
noted here for a later pass — that fix is #11, still open.

## #2 · #14 · #24 · #25 · #26 — The revision map: numbered cells, activity by month, honest empties, a readable date

**Done:** 2026-09-01, commits `7d4402e` "Number every cell on the revision map, and grow the page cells
to hold it", `ae8d01d` "The map can be asked 'what did I touch this month'", `631278b` "The map keys
'not in this build' only when a cell in fact is", `0ab9619` "The map's date reads as a date a person
writes, not a stamp".

The map that shows what a reader has revised got a number on every cell (with larger cells to hold
it), a time-range picker and the activity calendar in the menu, the "not in this build" state shown
only when a cell truly is absent, and its "active since" line rewritten as a date a person writes.

## #4 · #12 · #16 · #30 — Verse highlights: one swipe per line, and a whole-book sweep for the misdrawn boxes

**Done:** 2026-09-01, commits `b2ffce3` "Draw one swipe per line, and forgive the print its rounding",
`0873c77` "A whole-book sweep finds the next misdrawn verse box by tool, not by eye", `f75acf9`
"Colour the exact letter, and let the palette page know it".

Multi-line verse highlights stopped merging their middle lines into one blob; the odd highlights on
2:249 and 10:44 were fixed, then the whole book was swept by tool to catch every other misdrawn verse
box rather than finding them by eye.

## #17 — The highlight customizer, drawn as shape and strength

**Done:** 2026-09-02, commit `dc247f4` "Draw the highlight customizer as shape and strength, not 'box
vs fill'".

The choice between a boxed and a filled highlight, and its strength, was drawn as a decision page
rather than shipped as a raw toggle.

## #5 · #7 · #8 · #10 · #13 — The ayah drawer and a reader's own marks, each drawn as a decision first

**Done:** 2026-09-01 → 09-02, commits `dd0085e` "An ayah's options rise over the facing leaf, not over
the ayah", `c4a67b5` "A tafseer is a decision before it is a feature, and the options are drawn",
`29e5842` "Record whether a reader can pin their own note to the page", `31867fe` "A batch of a
reader's notes can leave the phone, and it says where without saying what", `97406ae` "Draw the
fold-tap bookmark as two open questions, not one gesture".

The verse-options drawer (rising over the facing leaf), a sourced commentary section, reader
mistake-marks, a batch export of those marks off the phone, and a bookmark by the page's centre seam —
each opened as a drawn decision before becoming a feature. (The facing-leaf placement here is the
earlier rule the ayah-drawer redesign now revisits — see `docs/design/ayah-drawer.md`.)

## #9 — The wordmark reads in English when the app is in English

**Done:** 2026-08-31, commit `(batched)`. The brand wordmark shows in English in English mode while
scripture stays Arabic — the app half of the wider "artifacts speak English" rule kept in memory.

## #20 · #28 · #29 — The page bar: thirty juz detents with a page-shaped handle, and a stage that always lands level

**Done:** 2026-09-01, commits `3a9396a` "The page bar gets thirty juz marks, a page-shaped handle and a
bubble that names the juz", `0035a4d` "Every road into the stage lands level and centred, by one settle
step".

The bottom page scrollbar became thirty juz detents with a draggable page-shaped handle and a
juz-naming bubble (the stray line through the pill items gone with the redesign), and one settle step
now guarantees every road into the stage lands level and centred.

## #27 — Desktop-spread zoom: a dev-only orphan that never reached the built app

**Done:** 2026-09, commit `(batched)` — recorded in memory `desktop-zoom-strictmode-orphan`. "One leaf
grows, one stays" on the spread was a development-mode double-mount artefact; the built app was never
affected, and host teardown now removes the orphan.

## #31 · #32 — The desktop-triage backlog and the page-bar questions, written where the next session will find them

**Done:** 2026-09-01, commits `893ca0a` "The follow-up list stops counting itself", `69c1d74` "Two
page-bar questions put in front of a person: does a mark pull, and whose juz is a boundary page".

The session's desktop-triage list moved into the repo's own registers rather than living only in a task
tracker, and the two page-bar questions were written up as decisions a person can answer.

## #33 — A verification recipe: which server, and a real reload

**Done:** 2026-09, commit `(batched)` — recorded in memory `spa-hash-nav-no-reload` and the `run-app`
skill. A fix is checked on the server where it can actually fail, with a forced reload, because a
hash-only navigation keeps the old bundle running.

## #34 — Golden baselines re-based after the owner saw the post-hop framing

**Done:** 2026-09-01, commits `75db3cd` "The twelve goldens agree with the settle step, on both
platforms, because the owner said so", `71cbd65` "Memory: goldens are re-baselined after the owner has
seen the diff".

The stale golden images were re-based on both platforms once the owner confirmed the new post-hop
framing.

## #35 — The pre-commit hook refuses a stale rendered register page

**Done:** 2026-09-01, commit `cc1ec1d` "The hook refuses a stale rendered register, and the plan says
what this branch carries".

## #36 — Retire the false "no page number reaches a root shard" claim

**Done:** 2026-09, commit `(batched)` — what-we-depend-on item ②. The notices trace's outdated claim
was removed once it stopped being true.

## #37 · #38 — The licensing map by door, and the adjacency tree's third parent

**Done:** 2026-09-01, commit `bab3d41` "The licensing map is organised by door, and the adjacency tree
names its third parent".

The licensing map was reorganised by distribution channel and then path, and the CC BY structural
metadata was named as the adjacency data's third source in the row and the shipped notice.

## #39 · #40 — Every design public on the site, and the board's answers folded into records

**Done:** 2026-09-01 → 09-02, commits `0e643ce` "Every design is public: the site serves each page
under docs/ at its own path", `73e2f40` "Fold the board's answers into the records the reader can open".

The build now serves every page under the docs tree at its own address, the colophon links them, and
the decision board's answers were folded into on-site records and the register.

## #41 · #42 · #43 · #44 · #45 — The live-options tenet, and the three open decisions mounted as live options

**Done:** 2026-09-02, commit `0bbc945` "Mount the three open decisions as live options, not only
drawings" (the tenet itself adopted in CLAUDE.md and the `decide` skill alongside, `(batched)`).

A felt difference is now built and mounted live, not only drawn: the juz-detents, boundary-juz and
mark-placement decisions were each built as interchangeable live option components on their on-site
pages and wired into the decision register and gates.

## #46 / #47 — Graduate the page-bar decision winners into the app bar

**Done:** 2026-09-02, commit `1872644` "The page bar now does what its two questions decided"
(branch `graduate-page-bar-winners`) — reasoning in
[`docs/decisions/page-bar.md`](../decisions/page-bar.md) and
[`docs/decisions/graduation-losers.md`](../decisions/graduation-losers.md).

Both page-bar questions were settled by the owner to option C. **Detent strategy C**
(`tapButtonDetent`): each juz marker is a tap-to-open button that turns the book to that juz's
opening; on a fine pointer it swells as the cursor nears it (never during a drag, never eating the
drag), and touch gets a plain button. **Boundary-juz rule C** (`labelBoth`): a page a juz seam
cuts names both juz in the bar's bubble only — "Juz 3 → 4" / "الجزء ٣ ← ٤" — while the shelf and
wheel keep one juz each. Per the felt-losers decision (option A) the losing strategies A/B stay in
core and on the decision page; the app bar imports only C. Covered by
`apps/web/src/components/PageSlider.test.tsx` (24 cases) and `apps/web/e2e/pagebar-detents.spec.ts`
(7 cases, desktop project — the growth is a fine-pointer affordance).

## #48 — Tell a pointed correction apart from a hand one in the sitting pipeline (㉑ + ㉗)

**Done:** 2026-09-02 (branch `graduate-page-bar-winners`, not yet committed) — reasoning in
[`docs/design/mark-registration.md`](../design/mark-registration.md) items ㉑ and ㉗, both now
marked **fixed**.

A tap on the ink emits both a `placement` and a `wrong-shape` event carrying `how: "ink"`, but the
settle/report/score half never read `how`, so a single tap was counted as two goes and filed under
both hand words — a word tally read as a fault-gesture tally. `settle()` now stamps each row with a
`pointed` word, a `points` tap-count kept out of the hand `goes`/`reshapes`, and `placedBy`/`sizedBy`
saying which gesture set place and size. The ruling report splits "moved by hand, over N goes" from
"placed by pointing at the ink, one tap each" (with a guarded line that a tap is one statement, not
two); the scorer's word-frequency table now counts settled words rather than raw kinds, and keeps
taps out of the nudges-and-drags line. Guards: `packages/etl/scripts/lib/mark-settle.test.mjs`
(closedBy for ㉑), `packages/etl/scripts/settle-mark-report.test.mjs` (closedBy for ㉗), plus new
cases in `packages/etl/scripts/score-mark-report.test.mjs`. All 77 across the three files pass;
`pnpm gate:issues` accepts both closures.

## #49 — Measure ink extent under all 8,554 doubled marks vs drawn size (㉖ free half)

**Done:** 2026-09-02 (branch `graduate-page-bar-winners`, not yet committed) — the measurement
and its reading are recorded in [`docs/design/mark-registration.md`](../design/mark-registration.md)
item ㉖, which stays **confirmed**: this discharges the free half it said was owed, it is not a
code fix.

㉖'s free half asked for the one thing every placement pass could not: measure the ink extent
under *all* 8,554 doubled marks against the box we draw, accepted marks included, not just the
refused slice. Done by teaching `probe-piece-union.mjs` a `--set doubled` population and a
width/height + accepted-vs-refused breakdown, then running it over the whole-book rows (8,463 of
8,554 resolve to an ink piece). Finding: across the population the box is **not** too small —
84.7% sit within half a unit of their ink in both axes, the median box is a hair larger than the
ink, only 2.5% have ink past the box by more than half a unit, and the gap varies rather than
being one constant, confirming the reader's "varying branch" a second time and by a different
instrument. "Drawn too small" is confined to the refusal: accepted doubled marks 2.0% too-small,
refused 24.3% (a floor, since the middle-inside-box union drops a too-small box's far stroke).
Per-mark candidates written to `packages/etl/out/doubled-ink.json`; rebuilt any time by
`probe-piece-union.mjs --set doubled`. The item stays open because the per-mark size repair for
refused doubled marks is still unbuilt and untested — the free half only bounds its target and
forbids it from touching the accepted marks.

## #50 — Gate the reach-for-ink cluster on the placement decision

**Done:** 2026-09-01, commit `65acd27` "Gate the reach-for-ink cluster on the placement ruling it
waits on".

The reach-for-ink measurement campaign is complete but every repair it points at waits on the
owner's `mark-placement` ruling (adopting a correction that moves each mark to its own ink is
option H, the owner's call). Recorded that dependency machine-readably rather than leaving it in
prose: added `blockedBy: ["the placement decision"]` to the nine confirmed/open rows in
`docs/issues.json` that cannot proceed until it is settled (㉖, ㉘, ㉙, ㉚, ㉛, ㉜, ㉝, ㉞, ㉟), so
`make issues` shows the whole cluster as waiting on one thing. Pure triage hygiene — no status
changed, no measurement re-run.

## #51 — Build comparison-crop option F into the look-alike panel (word-indexing ⑥)

**Done:** 2026-09-02, commit `f7763de` "Veil the crop's neighbours, and colour by what the words
are, not which ayah".

The `comparison-crop` decision (option F, omar, 2026-08-16) built into `DiffView`, the component
it was proven against. A paper scrim (even-odd path — padded frame minus the ayah's own lines)
veils the neighbouring ink the crop caught; the shared opening is washed green and each divergent
run ochre, the same two colours on both halves. Closed word-indexing ⑥ with
`apps/web/src/components/DiffView.test.tsx`, whose scrim test pins the even-odd path so a return
to the un-veiled crop fails it.

## #52 — Check each mark's name against the text it sits on (mark-labels ②)

**Done:** 2026-09-02, commit `515489e` "Ask each mark's name of its text, and hear the whole
corpus agree".

The third and last of the mark-name checks, and the one two documents left open. Place
(`probe-mark-ink`) and drawing (`probe-mark-labels`) both compare a mark to a drawing, so neither
can see a mark drawn exactly as its name says and the wrong name for its word. This — new
`probe-mark-names.mjs` (`pnpm probe:mark-names`) — compares the name to the carried text: for each
ligature, is the bag of drawn names the bag the text's own codepoints call for? It reuses the
`DRAWN_NAME` table `probe-diacritics` ⑤ recovered and froze, so it cannot hand-build the mismatch
§④ warns of. Census over all 326,515 marks: 326,506 reach a verdict (the other 9 are ④'s count
residual), and every one carries a name its text calls for — none wrong, exactly as §⑧ predicted.
A bag check by design; the wrong-letter-within-a-ligature half needs ⑤'s pairing and an eye, and
stays open. Answered mark-labels ② (open → answered) in the doc and `docs/issues.json`; indexed
the probe in `docs/map.json` beside its two siblings. No test named in `closedBy` because it is a
measurement that re-runs on demand, not a code fix — `answered`, not `fixed`.

## #53 — Count each page's marks against the text (mark-registration ③)

**Done:** 2026-09-02, commit `056e929` "Count the marks a page should have, and hear all but
three agree".

The fourth mark question, and the only one that can see a mark that is *not there*. Place, drawing
and name all walk the marks the print drew, so none can catch a mark the text calls for and the
print never drew — a missing mark has no rectangle to be wrong about. This — new
`probe-mark-counts.mjs` (`pnpm probe:mark-counts`) — counts instead: it expands each word's text
straight into the marks it calls for and compares that bag, name by name, to the bag the print
drew, never touching the ligature join, so it is a second path to the corpus independent of the
name check's align. Census over all 326,515 marks / 86,965 lettered words: 86,962 carry exactly
their text's marks; the missing/duplicated class is empty save for three words — the same three
the naming check sets aside as its print-vs-text count residual (two missing a hamza on an initial
alef, one seated-hamza cluster the print draws with two extra marks). A multiset check, blind to
order and placement by design — those are geometry, and the other three probes' job. Answered
mark-registration ③ (open → answered) in the doc and `docs/issues.json`; indexed the probe in
`docs/map.json` beside its three siblings. No test in `closedBy`: a census that re-runs on demand,
not a code fix — `answered`, not `fixed`.

## #54 — Gate the installed package-tree licences over what ships (what-we-depend-on ⑤)

**Done:** 2026-09-03, commit `cd00797` "Check the licence of every package that reaches a device,
not just the ones we declare".

The fifth licence gate, and the first that watches code instead of vendored data. The other four
watch the page artwork, the colophon's quotation and the asset trees; the packages that actually
run in the browser were watched by nobody but the 2026-08-16 hand audit, which read all 565
installed packages across twelve buckets and found them clean — the good time to add the check,
not the bad one. A naive "production dependencies" gate would have been wrong in the direction that
hides things: the two packages the record flagged both ship without being declared as runtime deps
— `workbox-window`, dev-declared yet pulled into the bundle through the offline-support register
shim, and `idb`, declared by nothing in the repo at all, riding the generated service worker
because the page cache is expiry-bounded. So new `scripts/gate-license-tree.mjs`
(`pnpm gate:license-tree`) computes the ship set from the two channels the app emits — the browser
bundle (workspace runtime deps + `workbox-window`) and the service worker (the `workbox-*` family
`workbox-build` lists, a deliberate superset that can only over-report) — takes the transitive
closure over runtime deps of each, and fails on any package whose SPDX licence is off a small
permissive allow-set; everything else fails closed. Ship set today: 24 packages, 23 MIT and idb's
one ISC. Proven to fail 2026-09-03 by dropping ISC, which named `idb@7.1.1` exactly, then restored;
the empty-channel case (no `workbox-build`) correctly drops idb so a removed PWA leaves no phantom
worker. Wired into the gates composite, `make ci` and CI, as `gate:gates` requires. Fixed
what-we-depend-on ⑤ (open → fixed, `closedBy: scripts/gate-license-tree.mjs`) in the doc and
`docs/issues.json`; indexed the gate in `docs/map.json` under the provenance group. A `fixed`, not
an `answered`: a gate that fails if a shipped package's licence goes unclassified is itself the
regression guard.

## #55 — Measure hamza sideways displacement whole-book: tail or class? (mark-registration ㉒)

**Done:** 2026-09-03, commit `3603adf` "The weakest matches wander with the tail, not with the letter they mark".

Sixty marks drawn by hand from the two lowest bands the ink search still accepts had raised a
question §④'s book-scale refutation could not reach: every hamza among them, eleven of eleven, was
pushed about a page unit sideways in the same direction with its size correct, while every other
mark sat still. Eleven marks leaning one way is either a bug in what the search matches against or a
case for a per-class nudge — both actionable — so ㉒ asked whether a whole class goes wrong by name
rather than at random. The record set the closure test itself: re-measure the sideways offset for
hamza alone across the whole book, which separates a property of the weak tail from a property of
hamza, and only then, if it is the tail, test whether the search settles on the letter under the
hamza. The first step settled it. Across every placed mark in the book — 16,295 hamzas among
325,847 — sorted into the same match-quality bands, the hamza sits at or below the class middle
everywhere: its typical sideways offset is a little under half a unit where the placed population
runs a little over, and the share landing more than three-quarters out sideways is the *lowest* of
any common mark (38.9%, against 41–44% for fatha, kasra, shadda and sukun). In the barely-accepted
band itself the hamza is the fourteenth most displaced of seventeen classes, better placed than
fatha and kasra and far better than the marks that truly struggle there (a small waw off by more
than a whole unit). The leftward direction the sitting saw is real but shared by every class — the
print sets its whole text low and across — and the hamza's lean is milder than the shadda's or the
kasra's, not an outlier. The sitting's one-unit hamza was a draw from the tail: the book-wide middle
in that same band is under half a unit and the eleven simply landed high. So the halving between the
two bands and the eleven-in-one-direction were both real and both a fact about the weak tail and the
common lean, not about the hamza. No class leans on its own, which is what §④'s ink refutation and
§㉓'s class-by-class residue had already said, so the second step was never needed. Resolved as
`answered`, not `fixed` — a measurement banks no code, so nothing is owed a regression guard; the
finding lives in the ㉒ record and the index note. The whole-book scored rows it rests on are the
ones a fresh run of the ink scorer reproduces mark-for-mark (checked on a page: zero difference).

## #56 — Measure spans kept if adjacency runs are computed over the print's own words (what-we-depend-on ⑦)

**Done:** 2026-09-03, commit `8fad8db` "The print-native hop is drawable now: it trades 114 spans for 150".

The look-alike hop paints, on each of two similar verses, the exact run of words they share, and
today that run is found over a copyleft-licensed morphology corpus and then converted into the
print's own word numbering. ⑦ asked whether the run could be found over the print's words directly —
which would drop the copyleft dependency and delete the conversion step — but the record set its own
gate: until somebody knew how many of the shipped spans survive that change, the option had no cost
attached and could not honestly be drawn on an options page. The print splits proclitics the corpus
joins, so the shared runs come out at different lengths and the rule that keeps a span only where the
run is unique keeps a different set. A probe replays the shipped edge set through that same
uniqueness rule but over print words, holding the corpus side as a control that must reproduce the
shipped 2,544 — and it does, exactly, which is what makes the print number trustworthy. The print
keeps 2,580. Net +36, but the two sets are not nested: 2,430 are common, 150 are new, and 114 a
reader can currently land on would vanish. The mechanism is the split itself — a shared phrase is
never fewer print words than corpus words and is often more (longer on 1,414 of the shared pairs,
the same on 1,130, shorter on none), so some runs grow long enough to break a uniqueness tie while
repeated common proclitics forge new ties elsewhere. The four verses whose two printings cannot be
aligned take no part in the churn, so this is the ordinary behaviour of the rule and not an artefact
of the hard cases. So the cost is churn, not a free gain: adopting it trades 114 spans for 150 and
sheds the copyleft dependency. The row stays `open`, but its blocker is no longer the missing number
— it is a decision-register ruling weighing that trade, with both span sets drawn on real pages. The
probe is committed beside build-adjacency and mapped under the edge-data feature, so the 2,580 can be
re-derived rather than trusted; it reads the gitignored ligature cache, which is why it is a probe
and never a gate.

## #57 — Bank the fired falsification test into etl-pipeline ① + repair §⑤ census

**Done:** 2026-09-03, commit `cebdfe7` "The hand-kept script census had rotted, so ⑤ now points at the map".

The etl orientation document held an open question — should it be generated rather than
written by hand? — and that question named its own test: if a script is ever added and the
document does not mention it, the balance was wrong. This session ran that test and it
failed. The scripts directory now holds thirty-three; the document enumerates about fourteen,
draws four probes where twelve exist, and names an entire mark-registration family — a dozen
build-, probe- and score- scripts — nowhere at all. The drift accrued unseen because the map
gate only checks that the pointers already written down still resolve; it has no way to notice
a script that was never written down, so the single check the hand-maintained census leaned on
could never have caught this. The section that carried the count was rewritten to state a
definition and point at the map as the authoritative census instead, so it cannot rot the same
way again, and the four probes it still draws are named as the etl core rather than the whole
set. The open question keeps its status: whether the diagrams themselves should be generated so
no hand copy of derivable facts survives is the owner's ruling to make, and the measured drift
is now attached to the record as the evidence it was waiting for.

## #58 — Corroborate the shipped page table against an independent page-per-ayah source (what-we-depend-on ⑨)

**Done:** 2026-09-03, commit `53868c6`, corrected the same day (redundant probe removed, record rewritten) — see below.

The item asked whether the table that says which leaf each verse sits on had ever been checked
against a source outside this project. I first answered it the expensive way: I wrote a probe
that read a published page-per-verse table, expanded it to all 6,236 verses, and compared —
6,180 matched, and the 56 that did not were all off by one leaf and all inside the short
stretches where the two printings of this mus'haf are known to break their pages differently.
A clean result. It was also redundant. The project already runs exactly this comparison against
a different published table, and had recorded its answer — 568 of 604 pages agree, the other 36
being the known divergence — beside the table itself, ten days before this item was written
calling the table "corroborated by none". It was not; the phrase was wrong, and I repeated the
mistake by not checking for the existing witness before building a second one. So the correction
commit deletes the redundant probe and its pin, and rewrites the record to say what is actually
true: the correctness question was already answered from outside the repo, and a fresh run
confirmed it again live.

What the item genuinely wanted, underneath the correctness check, was a witness of a particular
kind — a page-per-verse source under a permissive licence, which would double as a candidate
replacement for the pagination the app currently depends on a single upstream for. That source
could not be found: the project that once held it is gone, and its one surviving copy has been
placed under a no-commercial-use, no-derivatives licence. That is the one durable finding of the
whole exercise, and it is evidence for a different, still-open question — whether any freely
usable replacement for the pagination exists at all — so it was handed to the record that owns
that question rather than kept here. The correctness half of ⑨ is closed against the witness the
repo already had; the replacement half stays open where it belongs.

The lesson is the reason the next task exists: before going out to ask the world whether it still
agrees with us, look first at whether we already asked it. The repo centralises every
outside-witness check in one place and records each answer beside the data it is about; a new one
almost always belongs there as another reference, not as a parallel script.

## #59 — Create/enhance a skill for independent-witness validation (corroborate a derived artifact against an outside source)

**Done:** 2026-09-03, commit `81cfd33` "validate skill: guard against building a probe the repo already runs".

The request came out of the ⑨ run above: there should be a skill for the "does the world still
agree with our X?" kind of validation, and it should be enhanced rather than started fresh. It
already existed — the validation skill has a whole section on the checks that ask somebody
outside the supply chain, what they prove, and why none of them is allowed to be a build gate.
What it lacked was the one guardrail the ⑨ run showed it needed: a reminder to look before you
build. So the skill now fires on the phrase a person would actually use — corroborate something
against an outside source — and carries a short checklist to run before writing any new
outside-witness check: read the list of probes that already exist, read the record kept beside
the data you mean to check, and prefer adding a new outside source as one more reference to the
single probe that already asks the world, rather than as a parallel script nobody will
rediscover. It also draws the line the same run blurred: reading an outside source to check a
number is a different thing from adopting it, and a source being free enough to check against
does not make it free enough to depend on. The concrete incident — a duplicate page-table probe
written and then reverted because the check already existed — is named in the skill as the
reason the guardrail is there, so the lesson stays attached to the mistake that earned it.

## #60 — Register the print-vs-corpus adjacency-span decision (what-we-depend-on ⑦)

**Done:** 2026-09-03, commit `8ddba21` "Draw both ways of counting a look-alike's shared words, and ask which".

The measurement was already in hand from #56: run the same uniqueness rule over the printed
page's own words instead of the vendored word-by-word corpus and you keep 2,580 shared runs
against today's 2,544 — but the sets are not nested, and the difference is 150 runs only the
page finds and 114 only the corpus keeps and the page would lose. What was owed was not another
number but the thing the ⑦ note itself asked for: a ruling put in front of a person, with both
span sets drawn on the real pages so the 114 lost and the 150 gained are things you can look at
rather than a count to take on trust. So this task built the decision — a record in the register,
an on-site page that crops each specimen from the page it sits on and washes the shared run
exactly as the look-alike panel does, and a row that ties it both ways to the crop decision it
shares its span geometry with. The generator follows the extract/render split the decide skill
asks for when the finding needs a cache the repo does not carry: an opt-in `--extract` reads the
ligature cache, reproduces the shipped 2,544 as a control so the print figure is trustworthy, and
writes a small findings JSON carrying only verse keys and box geometry — no scripture; the default
render draws the page from those committed bytes alone, so it rebuilds on a fresh clone. The ⑦ row
stays open, but its blocker changed: it now waits on the owner's choice between the two ways, not
on any missing measurement or picture, so its issue moved to owner: user. The choice itself — A,
keep the corpus; B, count in the page and shed the share-alike licence at the cost of the 114 —
is the owner's to make from the page.

## #61 — Measure the hop's recall against an external ruler (what-we-depend-on ⑪)

**Done:** 2026-09-03, commit `dfdd34f` "Fetch a ruler; the hop keeps its own counsel" — finding
in [`docs/design/hop-recall.data.json`](../design/hop-recall.data.json), reasoning at
[`docs/design/what-we-depend-on.md` item ⑪](../design/what-we-depend-on.md).

⑪ had no number for what the hop leaves out, so its edge count could be read as neither thorough
nor thin. This read a second, independently built look-alike catalogue — QUL's Mutashabihat
resource 73, login-gated and unstated-licence — once from a gitignored cache as a measuring
stick, took one number, and left none of its bytes in the build; `packages/etl/scripts/probe-hop-recall.mjs`
refuses to run without the cache and cannot fetch it. The probe reads the shipped shards, so the
"ours" side is exactly what the app serves. The answer is framed as a divergence on purpose: the
two catalogues are different kinds of thing (ours hand-picks the verses a hafiz confuses, the
ruler mechanically records every repeated word-run), so neither contains the other and a close
match would read as copying rather than rigour. Ayah recall is 41%, the sets are not nested (921
shared, 1,311 only-ruler, 599 only-hop), and the misses split 677 tight-phrase omission
candidates against 634 broad-formula recurrences the hop is silent on by design. The hop is not
finished but not thin and not a subset; the 677 are a new item if anyone opens them, not this one.
⑪ moved open→answered.

## #63 — Record QUL (qul.tarteel.ai) in SOURCES.md as a corroboration goldmine

**Done:** 2026-09-03, commit `169952a` "Record QUL as a goldmine to measure against, not a shelf
to vendor" — entry in [`SOURCES.md`](../../SOURCES.md) Pending sources.

The user asked to add QUL alongside the other sources. It was already named there for its layout
DB; this widened the entry to the library QUL actually is — mushaf layouts, word morphology, a
syntactic treebank / ayah-dependency graph, tajweed spans and look-alike phrase catalogues — and
recorded the standing rule that governs all of it: every resource reviewed is login-gated with no
licence stated, so nothing ships, and its only use is as a build-time ruler read once from a cache
to check a number we derived ourselves. Names the Mutashabihat resource 73 used for the hop's
recall (#61) and cross-links ⑪, so the precedent sits in the file a licence question is answered
from.

## #62 — Build an on-site "how we earned your trust" validation page

**Done:** 2026-09-03, commit `14f7bb8` "A page that shows a stranger how the app earned their
trust" — page [`how-we-earned-your-trust.html`](../validation/how-we-earned-your-trust.html) and
its companion record [`how-we-earned-your-trust.md`](../validation/how-we-earned-your-trust.md).

A shareable page for a hafiz who has never opened this repository: it gathers the independent-
witness checks scattered across the design records — the page a verse sits on (568/604, the 36 the
printings themselves split on), the look-alikes (a deliberate 41% subset of a larger catalogue,
framed as divergence not shortfall), the recitation colours (99.80% against a text-free engine,
with the false second witness named and not double-counted), the print identity (56/56 incl. the
divergence-band controls), the fixed numbers of the book (318 re-derived every build), the small
marks (86,962/86,965) — and tells each as a question a reader arrives holding, with no file names
or item numbers in the prose. It draws the checking loop as a hand-authored SVG so it renders
offline like every docs page, states the four honest gaps still owed to a human, and links every
outside source it measured against. The companion record carries the mermaid source and maps each
figure back to the register that owns it. Served from the site at its own path on merge; the
front-door link is the canonical site address so it survives being sent to anybody.

## #64 — Settle which printing's fonts produced the shipped pages (mark-registration ④)

**Done:** 2026-09-03, commit `0e3a4b9` "Settle by looking: the shipped pages are ayah artwork,
not word fonts" — marker in [`mark-registration.md`](../design/mark-registration.md#-which-of-the-two-printings-fonts-produced-the-pages--answered)
flipped ④ open → answered, index row in [`issues.json`](../issues.json) rewritten.

The question was whether the shipped pages came from the publisher's per-page word fonts — if so,
the finest addressable unit would be a whole word and the "ask the font, not the picture"
cross-check would be impossible in principle rather than merely awkward. Settled by looking, as ④
said it would be: all 604 page SVGs are flattened, ayah-tagged vector artwork whose finest unit is
the ayah (surah/ayah/number attributes, 6,236 each; ayah:x/ayah:y anchors; nothing per-word,
per-glyph or per-ligature, no text/use/font-family/@font-face). There is no font on the pages to
ask. Word geometry lives in a separate per-ligature path corpus (measurable outline geometry, not
a font); both sources are the V2/1421H printing, fixed by the 56/56 pagination cross-check over the
four V1/V2 divergence bands — the single readable number. Answered, no code owed. The §⑧
cross-check stays rejected on its own grounds (shadda-merged marks, contextual-variant outlines).

## #65 — Generate the ETL script census from disk + map; wire it to the anti-drift hook (etl-pipeline ⑦①)

**Done:** 2026-09-03, commit `a9a6404` — the open question in
[`etl-pipeline.md`](../design/etl-pipeline.md) §⑦① flipped open → answered, index row in
[`issues.json`](../issues.json) set to answered, new generated census at
[`etl-scripts.md`](../design/etl-scripts.md).

The question was whether the ETL orientation document should generate itself, opened because a
hand-drawn list of scripts is exactly the drift this repo gates against — and on 2026-09-03 the
list's own falsification test was found to have fired silently: it named about a third of the
scripts and missed an entire family, because the check it leaned on validates the pointers that
exist and structurally cannot see a script that is absent. Owner chose Option 1: generate the one
part that is derivable — the census — and keep the flow diagrams and the prose hand-written,
because their edges and reasons live in no register and deriving them would need an invented
edge-map that would drift in turn.

Built to the repo's existing generated-register idiom: a shared payload+hash module
(`scripts/etl-scripts.mjs`) enumerates every script under `packages/etl/scripts` straight off the
**filesystem** — not `map.json`, which had itself gone short by nine — grouped by role and
annotated with each script's one-line note from the code map (a script the map does not name is
marked so, keeping the map↔disk gap visible). `build-etl-scripts.mjs` renders the hash-stamped
`docs/design/etl-scripts.md`; `gate:etl-scripts` refuses a commit where the committed copy was
built from a different source. The gate is wired into all three sites `gate:gates` insists on (the
`gates` composite, `make ci`, the CI workflow) plus the pre-commit staleness loop and
`make render-docs`. A script added, renamed or re-described now moves a stamped hash and the
commit is refused; a directory cannot be missing a file it contains, which is the guarantee the
old map-pointer balance could not give. 69 scripts on disk, 59 named in the map.

## #70 — Settle whether a spacing-aware comparison is worth building (mark-labels ①)

**Done:** 2026-09-03, commit `66aa610` — the open question in
[`mark-labels.md`](../design/mark-labels.md) §⑩① flipped open → answered, index row in
[`issues.json`](../issues.json) set to answered.

Settled by the numbers already on the page, no reader owed: the whole prize is five marks of
326,515 — the right strokes at an unusual distance apart — and nothing in the app depends on
them. The naive spacing-aware comparison §⑧ warns against would stop reading arrangement as part
of the shape, and arrangement is the only thing separating a *fathatan* from two successive
*fathatas* — a distinction carrying 3,635 marks. Building it would corrupt 3,635 to rescue 5. A
careful two-number version (strokes and arrangement scored apart) would avoid the harm, but a
second comparison axis to maintain forever is not earned by five already-explained marks, so the
status quo stands. Reopens only if the five grow into a class that matters, or a recitation-rule
colouring makes the iqlab and doubled-vowel marks load-bearing — at which point a *targeted* (never
the naive) two-number comparison becomes a new item, not this one reopening.

## #71 — Should the licence trace follow the shared core's imports? (2026-09-03, `53948cf`)

`what-we-depend-on` ③, the open design half, is now **answered: no**. The heading marker on the
[record](../design/what-we-depend-on.md) and the index status in [`issues.json`](../issues.json)
both moved open → answered.

Answered by weighing the machinery against the exposure, no reader owed. The one derivation that
reaches the shipped shards through the shared core — the same-part flag computed off the CC BY
structural tables — is already named in its licensing row and in the notice that ships beside the
data, so today's exposure is shut. Walking the core's import graph to catch the *next* one is the
move to refuse: that graph is large and almost entirely unlicensed, so a follower is mostly noise
and still leaves the hard call — which reach is actually a licensed derivation — to a human. What
remains is a precedent rather than a defect: a new upstream reached through core would ship unnamed.
If that is ever worth closing, the shape is the inverse of graph-walking — the core package declares
its few licence-bearing exports and the trace checks that any bucket importing one names it — and
that is a narrower new item, not this row reopening. Reopens only if a new licensed upstream, a
copyleft one above all, reaches a shipped bucket through core.

## #72 — Stamp the placement page: H is decided (2026-09-03, `fb5b9f1`)

The `mark-placement` decision was recorded in the register as **decided: H** in `0881048`, but
the [drawn page](../design/mark-placement.html) and its [record](../design/mark-registration.md)
still read as an open question that recommended F. They now say what the register says.

A "Decided — H" banner opens the page in the shape the page-bar decisions use; every place F was
badged "the recommendation" now names it as the line-by-line fix H falls back to where it cannot
place a mark from its own ink. Every option stays drawn — losing options are the reason H was a
choice, and section 7 still shows why the numbers ran past F to I. The record gains a decision
note and its §⑦ Option-F marker moved recommended → "the fallback under H", so page, record and
register agree.

The remaining work — graduating H into the app (the per-mark ink displacement plus the guard) and
closing the reproduced mark defects dammed behind the placement decision — is the follow-on, tracked
separately. This closed only the "the page still asks a decided question" gap.

## #73 — Graduate H: auto-place trusted marks on their ink, hand-place the hard core

**Done:** 2026-09-04, commit `cab8c42` "Each mark ships where its own ink is, and the hard core
keeps the hand that placed it".

The owner's placement ruling (H) reaches the ship asset: a mark the ink search trusts is placed on
its own ink at build time; the hard core the search cannot place is read from the hand-sitting
table instead. Rests on `5cd6c1d` (the 209 hard-core marks sat on their own ink by hand),
`66f4797` (reading those hand placements back into a table a builder can ship) and `54294a6`
(unblocking the reach-for-ink frontier once the ruling was made).

## #74 — Fold both refused-mark refinements into the placement asset

**Done:** 2026-09-04, commit `d8443f3` "A refused mark reaches for its own ink, guarded, instead of
only tilting".

A refused mark no longer merely tilts toward its ink — it reaches for it, under the symmetric
too-big/too-small guard #210 escalated, so a candidate that would grow or shrink past the shipped
rectangle is held back.

## #75 — Reconcile the option-H decision page with the ship asset's per-mark reach (㊱)

**Done:** 2026-09-04, commit `a87e64b` "The decision page reads each mark's own reach, as the ship
asset does".

The drawn placement page now reads each mark's own reach the same way the shipped asset does, so
the picture a reader decides from and the bytes the app serves cannot drift apart.

## #76 — Sit the remaining 259 boundary-hit marks, or decide they ship as-is (㉛)

**Done:** 2026-09-05, commit `1db1b6b` "A hafiz sits the 259 edge marks by hand; the code owes
nothing more".

The 259 marks that hit a boundary were sat by hand and found already at the ink search's best
answer — `77e7007` showed eighty were fixed already, `65671e3` asked whether those eighty were a
fair sample of the rest (they were), and `527a00b` surveyed how other Qur'an projects place marks
and confirmed our route is the only one that fits. The code owes nothing further here.

## #78 — Corroborate the word-segmentation split against a disinterested third corpus (⑩)

**Done:** 2026-09-05, commit `5aacec0` "A third grammar reads the split the same way both incumbents
already do".

A third, independently built grammar reads the contested word-segmentation split the same way both
incumbent corpora already do, corroborating it as a convention rather than an error — the witness
technique of counting a tag-independent signature across a disinterested corpus. `d4c59f4` records
how the neighbour-rail decision heard that third grammar and how the next witness-check inherits the
method.

## #79–#82 — Reopen the page-curl decision on a board where each turn is felt by hand

**Done:** 2026-09-04, commit `f465818` "Reopen the page-curl question on a board where each turn is
felt by hand".

The four curl tasks — study the turn machinery and the prior live-options pattern, build the live
curl option components behind one interface, draw the options page under `docs/design/`, and register
the reopened decision — landed together: the difference between the options is felt, not drawn, so
each is a live interchangeable component mounted on the decision page and tried by hand. `b7159ff`
("Sort every encumbered input into ingredient or instrument") is the companion that sorted each
gesture the board takes into what it operates on versus what operates it.

## #83 — Repair two off-grid ayah boxes (PLAN 17: 68:3 p564, 107:2 p602)

**Done:** 2026-09-06, commit `4d33246` "Stretch two short ayah tails to the foot of their line".

The two verses whose tap boxes sat off the line grid (68:3 on page 564, 107:2 on page 602) now
stretch their short tails to the foot of their line, so the tappable area matches the ink.

## #84–#86 — Design the outside page library as a held store, and open its decisions

**Done:** 2026-09-07, commits `51567fd`, `a5a4ebc`, `2f15b32`, `1ced08b`.

`51567fd` opened the two questions about the other page library — check it, and draw from it in dev.
`a5a4ebc` folded the hosted-database store into the page-source design; `2f15b32` reopened the
copy-none boundary for a store we *hold* (not bytes we ship); `1ced08b` linked the repo to its own
hosted database project. The design.md of these decisions and their register rows are the through-line
of the cluster.

## #87 · #89 · #91 · #93 — Map the whole outside library, and draw it on our own site

**Done:** 2026-09-07 → 09-09, commits `e0b8daa`, `8c45b71`, `a94052c`, `3b4bdcf`, `b0f9089`.

`8c45b71` read the whole layout without the read overflowing (the inventory + join model crawl of the
qul-data folder); `e0b8daa` drew the whole outside library as one entity diagram with keys and counts
(the ERD artifact and the join-map graduated into the ETL design page); `a94052c` made the store draw
itself on our own site and `3b4bdcf` marked the held copy as loaded on the map; `b0f9089` logged the
finished ERD redraw. The full ERD and store schema are rendered on-site as hand-drawn SVG so they open
from a clone.

## #88 — Record the qul-store-purpose decision (render V4 + side-by-side validation)

**Done:** 2026-09-07, commit `68ccb0a` "Settle what the held copy is for, and point the store at V4".

Settled what the held copy is for — rendering the V4 page and validating our own numbers side by side
against it — and pointed the store at the V4 printing rather than the earlier V2 scaffold.

## #90 — Realign the store scaffold from V2 to V4, and extend the licence gate

**Done:** 2026-09-07, commit `f645acb` "Build the text-free QUL store, gated where a byte would be
held".

The text-free store scaffold was realigned to V4 (resources 21+47) and gated where a byte of held
scripture could leak. `d0a910a` gave the held copy its own licence check, distinct from the ruler
check, so the two boundaries are policed separately.

## #92 — Record the QUL held-copy licence reads into SOURCES.md and the ledger

**Done:** 2026-09-07 → 09-08, commits `69ddbfb`, `abb493f`, `d624371`.

`69ddbfb` banked the held-copy licence reads and named the one blocker still owed; `abb493f` recorded
the owner's licence clearance for the dev held copy; `d624371` read the Complex's terms at the source
and confirmed the shipped colophon holds. Rests on the earlier QUL boundary work (`8ebbdc1`,
`acff60d`, `9fb1d6b`) that established per-resource attribution and copy-nothing.

## #94 · #99 — The page-diff workbench, drawn in the print's own per-page letters

**Done:** 2026-09-08, commit `868cbc2` "Stand the library's page beside ours, drawn in the print's own
per-page letters".

The dev page-diff workbench stands the library's page beside ours. The per-page word font (resource
240) replaces the earlier Nastaleeq box — each page drawn in its own `pN.ttf` letters, fetched and
served in dev only — so the ERD and the workbench both reflect the real per-page font.

## #95 · #96 — One store-page component, mounted in the workbench and laid over the print in-app

**Done:** 2026-09-08, commit `8b73a59` "The store's page is drawn once, and laid over the print in the
running app".

The store-page drawing was lifted into one component both the workbench and the app mount. An in-app
dev toggle lays the store's page over the print in the running app, compiled out of the public build.

## #97 — Gate the built public bundle against held scripture and any road to it

**Done:** 2026-09-09, commit `6b1d523` "A gate weighs the built app and refuses the store's letters or
a road to them".

A gate weighs the *built* public bundle and refuses it if it carries the store's Arabic letters, the
store loader, or a dev-fixture path — the held-copy tenet enforced on shipped bytes, not just policy.

## #100 — Register the app's tap shapes against the store's word boxes, all 604 pages

**Done:** 2026-09-09, commit `699a5e6` "Lay the app's tap shapes over the store's page and name every
word that lands wrong".

The diff view lays the app's tappable ayah areas over the store's word boxes and names every word that
lands wrong. `e95ffe5` swept all 604 pages (the tap shapes answer with the right ayah everywhere) and
`120e192` measured the residue with the store removed — what remains is boundaries, not misregistration.

## #102 — Register #95–#101 in PLAN + issues, and re-render the docs

**Done:** 2026-09-09, commit `2defa22` "Re-render the stale tasks doc".

Registered the then-open store/diff tasks in the roadmap and issue index and re-rendered the generated
tasks doc. The done.md move this task also named — archiving the finished QUL tasks — is what the
current archive pass (#73–#111) completes, since that half never reached this branch.

## #103–#107 — Sharpen the harakah picker: precise, spaced, named and tallied

**Done:** 2026-09-09 → 09-11, commits `0cc420f`, `9852508`, `3515bee`, `baba179`, `072b02b`,
`2980c69`, `d365ac8`.

The sign-picker became a precision picker (`0cc420f`), its rows sized to the word's real shape rather
than the panel width (`9852508`); it picks a letter by colour rather than by cutting (`3515bee`) and a
reader can take one letter out of a joined word, with visible space between separable clusters
(`baba179`); a side panel names what you took (`072b02b`) and aggregates it into named counts —
letters by name, not just a tally (`2980c69`); and the picker's verse is shaped from its own font so a
single part can be taken alone (`d365ac8`). Centring the picked word landed in the same series.

## #108 — Reconstruct-word layout in the word drawer picker

**Done:** 2026-09-19, commit `4ca583b` "Draw each vowel-sign stacked on its own letter, in the word's
own order".

Each vowel-sign is drawn stacked in its own base letter's column — above or below by type — with the
letters in a row in the word's own order, so the grid spells the word.

## #109–#111 — Live bottom-sheet word and ayah drawers, tap versus long-press

**Done:** 2026-09-19, commit `c48472a` "Open the word tools with a tap and the verse tools with a hold,
in one bottom sheet".

A quick tap on a word opens the word drawer (the fine part-picker); a press-and-hold opens the ayah
drawer (whole-verse tools); both are the same bottom sheet on desktop and mobile, built live on the
page so the reader decides by doing it. The same commit wrote the decision record
[`selection-drawer.md`](../decisions/selection-drawer.md) and its on-site page
[`selection-drawer.html`](../design/selection-drawer.html), and registered the `selection-drawer`
decision (status open) with reciprocal links to the harakah-pick, mistake-note-anchor and
word-selection decisions — gates green.

## #1–#45 — The desktop-triage, revision-map, page-bar and live-options era

**Done:** 2026-07-25 → 2026-09-02, across many earlier sessions on branch `harakat-marking`.

These are the earliest tracked tasks — the ones that predate this archive's first numbered entry
above — moved here in one pass so the session task tracker only carries open work. They are grouped
because they were done in themed runs, not one at a time, and their reasoning already lives in the
design docs and registers each one fed (see [`docs/design/`](../design/), [`docs/decisions/`](../decisions/),
[`docs/issues.json`](../issues.json), and [`docs/PLAN.md`](../PLAN.md)); the exact commit for any one is
in the branch history for that date range. Nothing here is restated beyond its one-line subject.

**Reading, highlighting and the ayah drawer**
- #3 — Fix the mushaf shifting up when an ayah is tapped
- #4 — Fix the odd highlight on ayah 2:249
- #7 — Add a tafseer section to the ayah drawer, with sourced text and provenance validation
- #8 — Comment-style ayah mistake-marking (annotations)
- #12 — Fix a multi-line ayah highlight merging its middle lines into one blob
- #16 — Fix ayah 10:44 not highlighting like the others
- #17 — Highlight-style customizer (shape and strength) — see [`docs/design/highlight-style-options.html`](../design/highlight-style-options.html)
- #30 — Whole-book highlight sweep: find the next 2:249 / 10:44 by tool, not by eye

**The book: zoom, page-turn and the two-leaf spread**
- #6 — Allow zooming to and past 100%
- #18 — Edge/corner grab-to-turn with a hand cursor on the page edges
- #19 — Fix leaves misaligned vertically after a juz jump
- #22 — Fix leaf misalignment after flipping pages (the turn path)
- #23 — Investigate the missing page-turn animation/corners on desktop — see [`docs/design/page-turning.md`](../design/page-turning.md)
- #27 — Fix desktop-spread zoom (one leaf grew, one stayed) — a dev-only StrictMode orphan host
- #29 — One post-navigation invariant for the stage: every road lands level and centred
- #34 — Re-baseline the golden images (darwin + linux) after the owner confirmed the post-hop framing

**Revision map and activity calendar**
- #2 — Draw division numbers on the revision-map cells and enlarge the page cells
- #14 — Add an activity calendar to the menu bar
- #24 — Remove the "Not in this build" absent state from the revision map
- #25 — Reword and reformat the map's "since" line to "Active since Sept 1st, 2026"
- #26 — Add a time-range pill picker to the revision map (All Time / Last Month / This Month)

**Page bar (the bottom scrollbar)**
- #1 — Constrain the page-slider width on desktop
- #20 — Fix a line striking through the page-bar pill items
- #28 — Redesign the bottom page scrollbar: 30 juz detents, a draggable page-icon handle, a popover — see [`docs/design/page-bar-options.html`](../design/page-bar-options.html)
- #32 — Record the page-bar decisions: detents as landmarks or magnets, and which juz a boundary page belongs to

**Navigation, chrome and persistence**
- #5 — Desktop: show the ayah-options drawer on the opposite page of a spread (**note:** revisited in the ayah-drawer design — the owner now wants the drawer on the *same* side as the clicked leaf)
- #9 — English branding/wordmark in English mode
- #10 — Local persistence plus batch export/email of marks and comments
- #13 — Bookmark a page by clicking its centre seam
- #21 — Update the URL anchor when a page is flipped

**Process, registers and the live-options tenet**
- #31 — Put the desktop-triage backlog in a repo register, not only in the session task list
- #33 — Verification recipe: which server, and a real reload, so a fix is checked where it can fail
- #35 — Pre-commit refuses a stale rendered register page
- #36 — Notices gate: retire the false "no page number reaches a root shard" claim
- #37 — Name the CC BY structural metadata in the adjacency licence row and shipped notice
- #38 — Reorganise the licensing map by channel, then by path
- #39 — Every design is public on the site: stage `docs/` into the build, derive decision addresses, link from the colophon
- #40 — Fold the board's decision-answers into on-site records and the register
- #41 — Adopt the live-options tenet in CLAUDE.md and the `decide` skill
- #42 — Build the live juz-detents options (A/B/C) as interchangeable components on their on-site page
- #43 — Build the live boundary-juz options (A/B/C) as interchangeable components on their on-site page
- #44 — Build the live mark-placement options (A/B/G/H/F/I) as interchangeable components on their on-site page
- #45 — Wire the three live pages into the decision register and gates

## #112–#115 — The private Study-Quran pitch layer on al-Fātiḥah

**Done:** 2026-09-19, in the working tree on branch `harakat-marking` — **not yet committed** (held for
the owner's say-so), so there is no commit link yet. The reasoning is in CLAUDE.md → "What we are
building right now" and the code in `apps/web/src/pitch/`.

The private pitch build (`make pitch`, guarded by the build-time `VITE_PITCH` flag) loads The Study
Quran's held commentary and cross-references for al-Fātiḥah — the demo shown, in a room, to the
rights-holders, never deployed.
- #112 — Extract the curated al-Fātiḥah pitch data into gitignored private JSON
- #113 — Wire the Study Quran surah intro and commentary into the verse drawer (pitch build only)
- #114 — Wire the editors' cross-references and curated meaning-jumps as tappable verse-to-verse hops
- #115 — Verify the held-copy gates pass and the private pitch layer stays out of the public build
