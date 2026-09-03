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
