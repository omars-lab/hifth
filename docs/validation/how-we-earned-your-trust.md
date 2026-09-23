# How we earned your trust — the record behind the page

The reader-facing page is [`how-we-earned-your-trust.html`](./how-we-earned-your-trust.html),
served on the site at
`https://blog.bytesofpurpose.com/hifth/docs/validation/how-we-earned-your-trust.html`.
That page carries no file names, no item numbers, and no internal vocabulary — it is written
for a hafiz who has never opened this repository. This record is the other half: where the
numbers on that page come from, which register owns each one, and the mermaid source for the
diagram the page draws by hand.

Nothing here restates the page. It points.

## Why a companion record at all

The page draws its validation flow as a hand-authored inline SVG, because every page under
`docs/` must render offline from `file://` — no page in this repo loads a CDN, and `stage-docs.mjs`
serves them all as static bytes. The mermaid source below is the same diagram in the form the
code host renders natively; keep the two in step when either changes. If we ever decide the
offline constraint is worth trading for live mermaid on the HTML page, that is a decision to
record, not a silent edit.

```mermaid
flowchart TD
  build([We build it from the printed page]):::start
  witness[We find an independent witness —<br/>someone who built the same thing,<br/>and never saw ours]
  indep{Is the witness<br/>truly independent?}
  notindep[We say so, and<br/>do not count it]:::warn
  agree{Do they agree,<br/>line by line?}
  lock[They agree — we lock the check<br/>to run on every build]:::good
  examine[We examine every<br/>difference, one at a time]
  outcome[A printing difference?<br/>Our mistake? Or a real gap?<br/>— fix it or log it]
  human[/In parallel: what no witness<br/>can settle goes to a person —<br/>a hafiz's ear, a printed mushaf/]:::human

  build --> witness --> indep
  indep -- no --> notindep
  indep -- yes --> agree
  agree -- yes --> lock
  agree -- no --> examine --> outcome

  classDef start fill:#F5E9CE,stroke:#B0740F;
  classDef good fill:#D8E7E2,stroke:#2C685C;
  classDef warn fill:#EDD6CD,stroke:#A5472C;
  classDef human fill:#E9E1CE,stroke:#90836B,stroke-dasharray:4 3;
```

## Every figure on the page, and where it is owned

The page is deliberately silent about which register owns each check. Here it is not.

| Page's plain-language check | Figure shown | Register of record | Issue index id / status |
| --- | --- | --- | --- |
| Is every verse on the page it is truly on? | 568/604 pages; 6180/6236 cross-check | `docs/design/where-you-slip.md` §page-table; Tanzil cross-check | ⑨ `page-table-unverified-against-an-independent-witness` · **answered** |
| Does the app catch the verses you would actually confuse? | 921/2232 = 41.26%; 1311 only-ruler / 599 only-hop; 677 tight-omission | `docs/design/what-we-depend-on.md` §⑪; probe `packages/etl/scripts/probe-hop-recall.mjs`; finding `docs/design/hop-recall.data.json` | ⑪ `nothing-measures-what-the-hop-misses` · **answered** |
| Do the recitation colours come from somewhere we can stand behind? | 99.80% agreement; 108 divergences; the non-independent cpfair/quran.com match (idgham_mutajanisayn 58=58, idgham_mutaqaribayn 13=13 same ayahs) | `docs/design/tajweed-*.md` (independent-engine cross-check) | ⑧ tajweed divergences · **open** (blocked on a hafiz) |
| Is the printed page really the one we say it is? | 56/56 pages incl. V1/V2 divergence controls | word-geometry / print-identity record | print-identity · **answered** |
| Are the fixed facts of the book actually right? | 318 constants re-derived every build | `gate:quran-meta` against Tanzil metadata ("the model") | structural-constants · **answered** |
| Does every small mark sit on a word that calls for it? | 86,962/86,965 words; 3 set aside | mark-census record | mark-census · **answered** (3 → hafiz) |
| What can no computer ever check? | 2 done / rest open | `docs/validation/ledger.json` (11 human-only checks) | — |

## The divergence framing is not decoration

The hop-recall row (41.26%) is framed on the page as deliberate divergence, never as a coverage
shortfall or an agreement score. That is a legal and intellectual-honesty requirement, not a
tone choice: the ruler (QUL resource 73) is login-gated with an unstated licence, used only as a
build-time measuring stick, and **a near-identical independent recompute would read as evidence
of copying**. The page says the worrying result would have been a high match — this is why. See
the header comment of `probe-hop-recall.mjs` and the §⑪ paragraphs in `what-we-depend-on.md` for
the full reasoning. We ship zero bytes from the ruler.

## The tajweed "second witness" that wasn't

The page tells the reader plainly that a source which looked like a second independent witness
turned out to be the same underlying data. Internally: quran.com's tajweed annotation matched the
cpfair engine exactly — `idgham_mutajanisayn` 58=58, `idgham_mutaqaribayn` 13=13 on the very same
13 ayahs — so it was not counted as a second witness. The independent witness that *does* count is
the MIT-licensed, pause-aware engine that ships no Qur'an text of its own (99.80% agreement, 108
catalogued divergences). That engine has no published URL in our docs, so the page describes it
and does not link it — do not fabricate a link.

## Sources the page links, and why each

Every source on the page is public and citable. The five links, and what each was used for:

- `https://qul.tarteel.ai/resources/mutashabihat/73` — the larger look-alike catalogue; the ruler for ⑪.
- `https://quran.com` — the independent page-for-every-verse table; the 568/604 witness for ⑨.
- `https://tanzil.net` — the reference reckoning; the 318 structural constants re-derived on every build.
- `https://corpus.quran.com` — the word-by-word morphology behind the shared-word underline.
- `https://github.com/quranpedia/quran-svg` — the printed-page geometry every check is built on.

## Re-score a ruling yourself

The page's figures about mark placement come from sittings whose answers are committed under
`docs/validation/rulings/`. One of them can be re-scored by anyone, from the repository and one
pinned download, without taking our word for anything. What to do:

```
git clone https://github.com/omars-lab/hifth.git
cd hifth
pnpm install
pnpm --filter @hifth/etl build:words --fetch          # the word-corpus pages the marks are read from; ~350 MB, hash-checked
make rescore RULING=2026-08-12T1650-placement-residual-by-hand.seed23
```

What you should see: a small table with three rows that matter — the fingerprint of the
measurement the sitting was shown against, the fingerprint of the grading code, and the headline
— each with a *recorded* column and a *now* column and the word `same` beside it, then the line
`everything agrees`, and an exit code of 0. The headline for that sitting is
`98.3% [91.1% – 99.7%] 59/60`: sixty placements over forty pages, fifty-nine of which a reader
put nearer our correction than the box as first printed. If any row says `DIFFERS`, the command
exits 1 and says which one and what that means; that is the finding the command exists to make
public, and we would want to hear about it.

How it works, briefly: the trials of a sitting are never stored, only the answers. The seed in the
file name rebuilds the trial list; the committed measurement beside it (its fingerprint is in its
name) is what the reader was shown; the scorer runs again on those and prints its result; and the
*recorded* column comes from a receipt committed beside the ruling, which holds what the scorer
said on the day, so the comparison is between a published number and a recomputed one — not
between two runs on our machine.

What this does not yet cover: the nine settled tables in the same directory, which are collapsed
from transcripts and a large derived measurement that were never committed. `make rescore` with
no ruling named lists every file there and says, for each, whether it can be replayed. And nobody
outside the project has run this yet — when someone does, that is the half of the check we
cannot do ourselves.

## Honest gaps the page states

Kept in sync with `docs/issues.json` and `docs/validation/ledger.json`:

- The look-alike list is not finished — 677 tight-echo pairings not yet flagged (⑪, answered as a
  measurement; any new work on the 677 is a *new* item, not this one).
- Which words to underline when two verses share an opening is undecided (open decision).
- The 108 tajweed divergences await a hafiz (⑧, open).
- One licence (the printing authority's own site) is read secondhand because the site refuses to
  load from several networks — recorded in the ledger as reachable only secondhand.
