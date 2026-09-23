# How do we check the checking — and how do you know we didn't fudge it?

*The robust-validation design: the part of the trust story that the reader-facing page doesn't
yet cover, and the harder question underneath it — can you trust the code that does the checking?*

There is already a page that tells a hafiz, in plain words, how this app earned their trust:
[how we earned your trust](../validation/how-we-earned-your-trust.html). It walks the method —
build from the printed page, find an independent witness who never saw our work, and either lock
their agreement into an automatic check or examine every difference by hand. Read that first.
**This page does not repeat it.** It picks up two things that page does not yet carry:

1. **The by-eye check of where each vowel mark sits, rebuilt** — because the old version quietly
   stopped being a real test, and a check that cannot be failed is not a check.
2. **How you trust the checking code itself** — the question an outsider actually asks. Every
   safeguard we have pins the *data*; almost nothing pins the *script that reads it*. A stranger
   is right to ask how they know the number a check reports is the number the work earned, and
   not one a convenient script was quietly rewritten to produce. This page is honest about where
   we are strong on that, and where we are not.

It is written for the owner re-reading it in six months, for someone outside the project we show
it to, and for the next person adding a check who needs to see where theirs fits.

---

## A few words, once

- **Verse** (*ayah*) — one numbered unit of the Qur'an.
- **Page / leaf** — one printed page of the physical mus'haf; this app draws the real printed
  page, not its own typesetting.
- **Vowel mark** (*harakah*) — the small sign that tells you how a letter is voweled. There are
  326,515 of them across the book.
- **The mark's ink** vs **the mark's box** — the ink is where the sign is actually printed; the
  box is the invisible rectangle the app draws over it so it can be coloured, tapped, or noted.
  Most of this page is about making the box sit exactly on the ink.
- **A sitting** — a person sitting down to judge by eye something no machine can, and writing
  down what they saw.

---

## Where does the rest of the trust story already live?

So this page can stay pointed, here is what it is *not* restating, and where each lives.

- **The method, and the corpus checks** — is every verse on the right page, do the look-alike
  jumps catch what you would really confuse, do the recitation colours come from somewhere we can
  stand behind, is this the print we say it is, are the fixed facts of the book right — all of
  that, with its witnesses and its honest gaps, is on the trust page and its companion record.
- **Why the mark boxes are placed the way they are** — the full reasoning for putting each mark
  on its own ink, with the fallbacks, lives in the mark-registration design.
- **What only a person can ever check** — the eleven human-only sittings, each with its run-book,
  live in the validation ledger.
- **Every automatic refusal** — the full list of machine checks that refuse a bad change lives in
  its own register; the map below names the *kinds*, not all of them.

The concrete file names for all of these are in the appendix, kept out of the argument on purpose.

---

## Why is there more than one kind of check?

Each family sees a kind of mistake the others are blind to. That is the whole design — they
overlap so that no single blind spot is the app's blind spot.

| Family | What only it catches | Its blind spot |
| --- | --- | --- |
| **A machine that refuses a bad change** | Anything expressible as a rule, checked on every change forever, tirelessly and exactly | Only what someone thought to write down; it cannot catch a rule that is confidently wrong |
| **A second opinion from an outside source** | The case where our own rule *and* our own data are both wrong the same way — so our own machine is happy and still lying | It can only run when someone runs it; it is kept out of the automatic checks on purpose, because a check that reaches the network fails when a far-off site is down and teaches everyone to skip it |
| **A person's eyes or ears** | Whether a box *looks* like it sits on the ink; whether the spoken order makes sense; whether an edge is *true*, not merely well-formed | One person's blind spot, until a second person sits the same thing |
| **A saved picture, compared pixel for pixel** | The silent visual slip nobody wrote a rule for — the thing that just *moved* | Only the exact views that were saved |

The outside-opinion family is worth dwelling on, because it is where the deepest trust comes from.
A machine check and the data it checks can both be wrong in the same direction, and then the
machine passes and the app still lies. The only cure is a witness we do not control: someone who
built the same thing from the same printed page and never saw our work. Two of these are
deliberately pointed in *opposite* directions — one that must *agree* with us everywhere and one
that must *disagree* on exactly the pages where the two known printings differ — because a witness
that can only ever agree cannot catch the mistake of matching the wrong thing. A witness that
turns out not to be independent (one that shares our underlying data) is said so and not counted;
that has already happened once, with a recitation-colour source that looked like a second opinion
and was the same data underneath.

---

## The by-eye placement check, rebuilt to hunt disagreement

This is the check the page grew out of, so it gets the fullest treatment.

### Why the old version stopped working

The app now puts each vowel mark's box where that mark's own ink is, and lines the rest up. We can
count exactly how well that lands: of 326,515 marks, **325,508 — 99.69% — sit on their own
measured ink.** Only 892 are placed by hand, 47 fall back to a per-line tilt because their ink
could not be found, and 68 are patched.

The old by-eye check showed a reader one mark twice, side by side, and asked which box sat on it
better — the corrected one or the old one. That was a fair test *before* the correction was this
good. Now it is a landslide: the corrected box is drawn *on the ink*, so a reader picks it almost
every time, and a near-unanimous "yes" tells you almost nothing. **A check that cannot be failed
is not a check.** It has to be rebuilt to point at the marks where the answer is genuinely in
doubt.

### The rebuilt idea: show the marks the app is least sure of

Instead of drawing marks at random, the rebuilt sitting draws from the roughly **1,007 marks the
correction is least confident about** — the 892 placed by hand, the 47 tilted, the 68 patched,
plus any whose ink was faint or ambiguous and any that poke out of both candidate boxes. On those
marks a human and the machine can genuinely disagree, so every trial is a real contest, and a
mistake surfaces fast instead of drowning in thousands of easy wins.

### What one screen looks like

The same mark is shown twice, at the size it is actually read at on a real page — not blown up,
because a box that only looks right when magnified is not right. The reader picks which box sits on
the mark. The screen carries no running score and no hint of which answer is "expected."

```
              الْحَمْدُ                         الْحَمْدُ
        ┌───────────┐                     ┌───────────┐
        │    [A]    │                     │    [B]    │
        └───────────┘                     └───────────┘

        A — the left box sits on it
        B — the right box sits on it
        space — I can't tell them apart
        N — neither box sits on it
```

On a phone the two stack vertically. Nothing else is on the screen.

### Four kinds of trial, shuffled so the reader can't tell them apart

That the reader never knows which kind they are on is what makes the result honest.

| Kind | What is shown | What it measures |
| --- | --- | --- |
| **The real question** | The corrected box vs the old box, on a least-sure mark | Does the correction actually win where it's in doubt? |
| **The yardstick** | The corrected box vs a decoy the same distance away but in the wrong direction | The best score anyone could get — whether a person can even *see* a shift this small. The real score is read against this, never on its own |
| **Are you looking?** | The corrected box vs a box a whole letter away | A miss here voids the reader's nearby answers |
| **Are you guessing?** | The exact same box shown as both A and B | The only honest answer is "can't tell"; a confident pick between two identical boxes is a tell |

### How it feels to sit

A five-line plain onboarding, then trials one after another. It saves as it goes, so a reader can
stop the moment they tire and pick up later with nothing lost. No trial is timed. There is no way
to "do well" except by looking honestly — the reader cannot see the score, and cannot tell the
real questions from the checks on themselves.

### What comes out of it

Three numbers and one list:

- **The preference rate** — how often the correction won on the real, in-doubt marks — read
  *against the yardstick*, because a raw percentage means nothing without knowing the best a
  perfect reader could have scored on that same hard set.
- **The looking-and-not-guessing pass rates** — if these fail, the run is thrown out, not quietly
  averaged in.
- **The disagreement list** — the named marks where the reader's eye and the machine parted ways.
  This is the real prize: a short, specific, human-checked list of exactly where to look next. We
  are not claiming the machine is perfect; we are showing precisely where it and a careful human
  still differ.

---

## Where are the holes?

An honest validation page names what nothing catches. Foregrounded, worst first:

1. **Nothing pins the checking code itself.** Every safeguard we have pins *data* — a strong hash
   over the printed pages, a fingerprint over the measurements a score ran on. Nothing pins the
   *script*. A quietly modified scorer, or a modified machine check, would pass every other check
   and report a different verdict from identical inputs, and nothing downstream would notice. This
   is the exact "is the script right and unmodified" question, and today the honest answer is: we
   make it hard to fake a result by swapping the *data*, and we do almost nothing to stop a swap of
   the *code*. The next section is how we close it.
2. **The instrument that grades is the instrument that was graded.** The same measuring code that
   found where each mark's ink is, is the one that later scores whether the box sits on the ink. A
   consistent bug in it would be present in both places and would agree with itself. This is
   partly answered — the correction is graded on a random half of each page it was never fitted
   on, and against the ayah-end ornaments, an object the ink-fit never saw and could not have been
   fitted to — but the residual is still measured by the same family of code, so a shared bug is
   not fully ruled out.
3. **A pin proves nothing moved since it was written, not that it was ever right.** The one witness
   that can say *true* rather than *well-formed* — a person with a printed mus'haf — is a
   bottleneck, and several of those sittings have been waiting for months.
4. **The fingerprint that welds a score to its inputs is short and not cryptographic.** It is
   backstopped by a second, independent guard, but the general habit of trusting a small
   fingerprint is weak against a motivated forger.
5. **Most sittings are one person.** The blind design supports a second reader, but inter-reader
   agreement is largely unmeasured — so a single reader's blind spot is currently the app's.
6. **The outside witnesses cannot run automatically** (on purpose — a network check that fails when
   a far site is down teaches people to skip it), so the strongest independence claims are only as
   fresh as the last time a person ran them by hand.

---

## How do you know the score wasn't rigged?

This is the question a wall of green check-marks does not answer. Anyone can write a script that
prints "99.69% correct." The trust is not in the number; it is in whether a stranger can
**reproduce the number themselves, from the committed inputs, without trusting us** — and in
whether we *could* have quietly tuned the checker to pass. Here is what already makes that hard,
and what we should add to make it hard enough.

### What already makes a faked result hard

- **The checker cannot peek at the answers.** The by-eye sitting is blind: the screen never shows
  which box is correct, and the answer key is not stored anywhere. It is **rebuilt from a committed
  seed at scoring time** — the same seed always produces the same sitting and the same key, and
  there is no answer file to leak or to edit. Nobody had to be trusted not to peek, because there
  was nothing to peek at.
- **Every input is fingerprinted, and the fingerprint is committed with the result.** A score
  records the fingerprint of the exact measurements it ran on, so a result is welded to the data
  that produced it. Re-measure and re-run, and the fingerprint no longer matches, and the mismatch
  is loud — the scorer refuses to score a ruling built from different measurements. A second,
  independent guard refuses even a matching fingerprint if the pages drawn don't line up with the
  measurements, and a forged transcript is told apart from a merely stale one.
- **The source bytes are pinned by a strong hash, re-checked offline on every build.** A single
  changed glyph in any of the 604 printed pages fails the check, with no network needed.
- **The build re-derives its own foundation from scratch.** The first pages the whole app was built
  on are re-derived byte-for-byte from their pin before the other 601 are trusted; the pipeline
  refuses to stand on its own earlier output if it doesn't come out identical.
- **A result carries what a stranger needs to reproduce it.** A ruling is named and stored with its
  seed and its input fingerprint — "the input a scorer needs to arrive at the same verdict a second
  time, on a different machine, months later." Separated from its seed, it is just a column of
  numbers.

### What we should add, to close the code gap the rest can't

The safeguards above make it hard to fake a result by swapping the *data*. To make it hard to fake
by swapping the *code*, and easy for an outsider to check, the strongest additions — each of which
extends a pattern already in the repo — are:

1. **Fingerprint the scorer, not just its inputs.** Stamp every result with a hash of the scoring
   script and the small libraries it leans on, alongside the input fingerprint it already carries.
   Then a result names the exact code that produced it, and a modified scorer producing a different
   verdict from identical inputs becomes detectable. The repo already computes a hash over its
   build scripts for a different check; this is the same move, pointed at the scorers. This is the
   single highest-value gap-closer on this page.
2. **Give each scorer a known-answer self-test it runs unconditionally.** Bake a tiny fixture with a
   known verdict into each scorer, so a scorer that has been quietly changed fails its own self-test
   before it scores anything real. The build already does exactly this for the foundation pages —
   it re-derives three known pages every run and refuses to continue if they drift.
3. **Publish the seed and the ruling, so an adversary re-scores.** With the committed seed, the
   committed inputs and their fingerprints, a stranger can regenerate the exact sitting, apply the
   committed answers, and get our number — or not. Reproduction by someone who wants us to be wrong
   is worth more than any assurance we write.
4. **Add a genuinely separate second instrument for the deepest hole.** The one error the
   fingerprints can't catch is the measuring code agreeing with itself. The fix is a *different*
   measurement — a second, independently written rasteriser, or an outside corpus, or a human — used
   to grade the first. The by-eye sitting above is exactly this: a human instrument grading the
   machine on the marks it is least sure of, and the disagreement list it produces is the audit
   trail.
5. **Have a second person sit the same trials.** Cheap, and it turns "one person's eyes" from a hole
   into a corroboration.

Taken together, the claim we can honestly make to an outsider is not "trust our number." It is:
"here is the seed, here are the fingerprinted inputs, here is the scoring code and its fingerprint —
run it yourself and you will get the same number; and here is the named short list of the few places
even we don't fully agree with the machine."

---

## Open questions, and what would answer each

The holes above are named; these are the ones this page is holding open as work to do, and the
catalog tracks them from here. Together they are one body of work — the *rigor stack* — that closes
the first hole above: every safeguard we have pins the *data*, and none pins the *checking code*.
The first item is that whole gap as a single decision; the five under it are the concrete steps that
would close it, in the order that returns the most for the least. The fuller argument for each is in
the section just above, "What we should add, to close the code gap the rest can't."

### ① Could someone quietly change the checking code without us noticing? · **open**

Right now we can prove our *data* has not been tampered with: we take a fingerprint of the printed
pages and of the measurements, and if a single number changes, a check fails loudly. We do none of
that for the checking *scripts* themselves. So someone could quietly edit a script that grades our
work, and it would pass every other check while reporting a different answer from the same inputs —
and nothing would catch it. This is the one question the five below break into concrete steps.
**What would answer it:** deciding to build those steps, in roughly the order given — or deciding a
lighter bar is enough and writing down why, so the next person inherits the call instead of asking
it over again.

### ② Should every result carry a fingerprint of the grading code, not just its inputs? · **fixed**

The single highest-value step. Stamp each result with a hash of the grading script and the small
libraries it leans on, beside the input fingerprint it already carries, so a result names the exact
code that produced it. **What would answer it:** a changed grader that returns a different verdict
from the same inputs becomes detectable from the result alone.

**Closed by** one small shared helper, `packages/etl/scripts/lib/grader-code.mjs`, that hashes a
grading script together with every library it reaches through its own imports (the same strong
hash the build-script census already uses, pointed at one script's imports instead of a directory).
All five graders carry it: the four scorers (`score-mark-adjudication`, `score-mark-nudge`,
`score-placement-contest`, `score-mark-report`) print a `graded by … · code …` line beside the
input-fingerprint line they already printed, and the settler (`settle-mark-report`) writes a
`code` block — script, fingerprint, and the list of files the fingerprint covers — into every
ruling it produces, beside `rowsFingerprint`. Rulings written before this existed carry no stamp
and read as "unstamped", never as an error; none were rewritten. The input hash each instrument
keeps its own copy of is deliberately untouched — sharing that one would let a single edit
re-bless every old ruling, and the code hash has no such trap. The test that would fail if this
regressed is `packages/etl/scripts/lib/grader-code.test.mjs`: it proves a touched grading script,
or a touched library two imports away, changes the fingerprint, an unrelated file does not, and
each real grader resolves to a distinct twelve-digit stamp; `settle-mark-report.test.mjs` proves
the stamp actually lands in a written ruling.

### ③ Should each grader refuse to run until it passes a known-answer self-test? · **open**

Bake a tiny fixture with a known verdict into each grader, so one that has been quietly changed
fails its own test before it scores anything real — the same move the build already makes when it
re-derives its foundation pages every run. **What would answer it:** a grader that no longer produces
the known verdict stops itself, instead of shipping a wrong number.

### ④ Should the seed and the ruling be published, so an outsider can re-score? · **open**

With the committed seed, the committed inputs and their fingerprints, a stranger who wants us to be
wrong can regenerate the exact sitting, apply the committed answers, and get our number — or not.
**What would answer it:** someone outside the project reproduces the number without trusting us, or
shows they cannot.

### ⑤ Should a second person sit the same trials, to measure reader agreement? · **open**

Cheap, and it turns "one person's eyes" from a hole into a corroboration. Most sittings are one
reader, so a single blind spot is currently the app's. **What would answer it:** a second reader's
answers on the same trials, and a measured level of agreement between the two.

### ⑥ Should a second, independently written instrument grade the first? · **open**

The one error the fingerprints cannot catch is the measuring code agreeing with itself. The fix is a
*different* measurement — a second, independently written way of finding where each mark's ink is —
used to grade the first. **What would answer it:** a separate instrument produces its own verdict on
the marks the first is least sure of, and the two either agree or hand us a named list of where they
do not.

---

## What this page is not settling

- It does not re-open the placement decision — that the box goes on the mark's own ink is settled.
  This is about how that decision is *checked*.
- It does not claim the 99.69% is exact truth. It claims the number is reproducible and the
  remaining doubt is named, not hidden.
- It does not replace any check with another. Every family here catches something the others cannot;
  the design is that they overlap.
- Of the additions above, the code fingerprint is built (②); the self-test and the rest are still
  proposals. Whether to build those, and in what order, is tracked as the open questions above,
  not settled here.

---

## Where each of these lives

*(The concrete names, for the person adding a check — kept out of the argument above on purpose,
because a reader deciding whether to trust the app should not need a filename to follow it.)*

- **The reader-facing trust narrative and its companion record** — `docs/validation/how-we-earned-your-trust.html`
  and `.md` (the method, the figure→register table, the witnesses, the honest gaps).
- **Why the mark boxes are placed as they are** — `docs/design/mark-registration.md` (the held-out
  halves are §⑦; the two-instruments-agreeing argument is §⑫).
- **The human-only sittings** — `docs/validation/ledger.json`; the by-eye placement check is the
  entry `placement-correction-by-eye`, and its run-book is what this page's rebuilt design replaces.
- **The rebuilt sitting's machinery** — `packages/etl/scripts/build-mark-adjudication.mjs`,
  `score-mark-adjudication.mjs`, and `lib/adjudication.mjs` (the seed-rebuilt key and the four trial
  kinds); the least-sure marks come from `packages/etl/data/pages/mark-boxes.pin.json`.
- **The independent instrument for the homework problem** — `packages/etl/scripts/probe-ornament-witness.mjs`.
- **The data pins and the offline re-check** — `packages/etl/data/pages/*.pin.json`, `PROVENANCE.md`,
  and the gates `gate:pages`, `gate:words`, `gate:mark-placements`.
- **The foundation self-test** — `packages/etl/scripts/vendor-pages.mjs` (`--verify-loop0`, run
  unconditionally).
- **The build-script hash the code-fingerprint idea extends** — `scripts/gate-etl-scripts.mjs`.
- **The grading-code fingerprint itself** — `packages/etl/scripts/lib/grader-code.mjs`, read by
  every `score-*` and `settle-*` script; a ruling's `code` block is what it writes.
- **The full list of machine checks** — the `gate:*` scripts under `scripts/`, aggregated by the
  `gates` script and mirrored in the continuous-integration workflow.
