# Both plans this file has held are finished

This file has carried two plans. **Neither is outstanding.** It is kept as the record of
what they were and how each was checked, because the second one was audited on
2026-08-17 against the tree rather than against its own account of itself, and that
audit is the useful thing here.

What is left in both cases is **reader work, not code** — sittings that have to be sat, a
verdict that has to be given on a device. Those live in `docs/validation/ledger.json`
and `docs/issues.json`, which are where somebody should look, not here.

---

## Plan one — the repo's most-repeated claim was false

**Landed** across `87b4241`, `5676128`, `a97fa98`, `a053bbd`, with two gaps closed later
in `2ec9f4d`.

Twenty-two times across twenty files this project asserted some version of *there is no
Quran text here*, and two files held running scripture — one of which shipped in the
bundle. Both are gone. The claim is now scoped to what is vendored and shipped, and a
gate refuses the next one.

| item | state |
| --- | --- |
| ① draw the comparison from the page artwork, delete the typed table | done — `verse-diff.ts` replaces `verse-text.ts`, panel redrawn |
| ② the second site, a pipeline test holding a phrase | done |
| ③ a gate that refuses the next one | done — wired into the composite, the Makefile and CI |
| ④ make the licence map see the whole assets folder | done |
| ⑤ say where the transliteration table came from | done |
| ⑥ the nine prose sites stating the rule unscoped | done |
| registers — issues, map, the licensing design doc | done; the second site is tracked on its own row |

**Two things the plan promised and nobody had run, since checked and passing:** none of
the deleted table's 36 distinct token strings is byte-present in the built bundle
(strings recovered from git, never typed); and adding an undeclared tree under the
shipped assets folder now fails the licence map by name — tested by creating one,
confirming the failure, removing it.

**Two gaps the plan did not know it had.** The comparison panel had no row on the code
map — not after the rewrite and not before it, the only trace being a note on the popover
saying it showed "the diff against the current ayah" and pointing at nothing. The map
gate missed it because it only checks pointers in *staged* files, so deleting a mapped
file and adding its replacement passes in silence. Both files have rows now, and the note
on the arithmetic carries *why* the table went, because that is the part a later reader
would otherwise undo: a small text table genuinely does look simpler, and it would bring
back all three defects at once. Separately, a skill heading still asserted the unscoped
claim three lines above quoting the scoped rule that replaced it.

**One measurement worth not re-taking.** Six of fourteen shipped edge notes carry Arabic,
up to five words in one — more than the plan assumed — but the longest fully-vowelled run
across all of them is **0**. Specimens, not passages, so within the rule as the gate
measures it.

---

## Plan two — the instrument that asks the question has to be trustworthy first

**Recovered from `git show 83041f3:.claude/plans/shimmering-wandering-lobster.md` and
audited item by item on 2026-08-17. All of it landed.** It should not be restored as a
plan; this table is what was worth keeping.

Sixteen sittings covering all 1,877 marks the machine could not place from ink were about
to be sat, and an audit of the page doing the asking found three faults that did not make
the sitting slower but made its answers **mean something other than what they say**. The
worst ran in the direction that looks like success: in dark mode the rectangles were drawn
in near-invisible colours on paper that is deliberately never re-themed, and a reader who
cannot see the box affirms it.

| item | state in the tree |
| --- | --- |
| ① parse the page once per card, not once per pointer frame | done — `mount()`/`paint()` split, `non-scaling-stroke` |
| ② keep the rectangles legible on white paper in both themes | done — four never-re-themed tokens, plus a dash pattern so the distinction survives colour-blindness |
| ③a pin the buttons to the bottom | done — a sticky dock, `viewport-fit=cover`, safe-area padding |
| ③b get the destructive control out of the thumb corner | done |
| ④ make the affirm button look pressed | done |
| ⑤ get the lede off the fold without charging a tap for any answer | done — brief/full toggle keyed off a stored flag |
| ⑥ say which mark, properly | done — the containing word is kept, and the mark's name reaches all three branches |
| ⑦ 44px on the four undersized controls | done |
| ⑧ the scorer was medianing increments and printing zero | done — one row per mark, and the reader's hand and the against-what-ships figures printed as two numbers under two sentences |
| the hazard guard — the whole page is one template literal | done — two assertions that the emitted HTML contains no backtick and no interpolation |
| registers — map rows, the ledger, the issues rows | done |

**The item the plan called *owed and still unrecorded* is recorded**, and says more than
the plan expected it to. The check stays `pending` on purpose: only 160 of 1,877 fallback
marks have been sat. It reads the two populations apart — sixty marks placed from their
own ink, every one affirmed, which bounds visible error at about 5% rather than at zero
and carries its own caveat that a gross error was structurally impossible on those cards;
against 160 fallback marks of which 158 carry a complaint. Two further instrument defects
were found *while reading that sitting* and fixed.

**Checked, not assumed:** the ETL suite is 303 tests across 10 files, all passing.

### What is actually left, and it is not code

**1,717 of the 1,877 marks have not been sat.** That is the work. The instrument is
trustworthy now, which was the whole point of the plan — it was never the point that the
instrument existed.

Two verification steps from that plan need a device and a person, and neither can be done
from here: opening a part on the phone over the tailnet in dark mode to confirm by eye
that both boxes are visible on white paper, the buttons do not move between cards, and the
largest card does not stutter under a drag.
