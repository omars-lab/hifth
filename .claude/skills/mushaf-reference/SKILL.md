---
name: mushaf-reference
description: Find and use a second opinion on the printed mushaf — a published scan, page table or layout to compare Hifth's data against. Use when asked to check the data against a real mushaf, to run or unblock the edge spot-audit, to verify an ayah is on the page we claim, to confirm which print revision we match, or when a hop looks wrong and someone needs to know whether it actually is. Names which references are reachable (measured), what each can and cannot settle, and the rules that keep a reference a reference and never a source.
---

# A second opinion on the print

Hifth's page artwork **is** the KFGQPC Madani print — vendored, pinned, byte-checked
(`SOURCES.md` → `hafs-kfqc`). So "find a scan of a printed mushaf" is not about
getting the pages. It is about getting a copy of the print that **we did not build**,
so a claim can be checked against something outside our own pipeline.

That distinction decides everything below. Ask which of the two questions is live:

| The question | What answers it |
|---|---|
| *Are we still the print we think we are?* | An independently published page table. Machine-checkable, **available today** |
| *Do these two ayahs genuinely resemble each other?* | A reader. No scan settles this — see [Where this stops](#where-this-stops) |

The first is the one this skill discharges. The second is `edge-spot-audit`, and it
stays a human check.

## Before anything else: the revision

**Our print is KFGQPC QCF V2 / 1421H. It is not V1 / 1405H**, and the difference is not
academic — the two lay out **36 pages** differently. `packages/etl/data/pages/quran-svg.pin.json`
says so in a `print` field, and `packages/etl/data/pages/PROVENANCE.md` shows the working:
at the first divergence our corpus puts 5:77 on p120, and V2's word range for that page
exceeds V1's by exactly 5:77's 23 words plus its ayah marker. Both boundaries match V2.

The consequence PROVENANCE.md draws is the single most important line in this skill:

> any cross-check source must be the V2 layout … V1-based tables (Tanzil metadata et al.)
> disagree on 36 pages and must not be used for this edition.

**Most of the internet is V1.** quran.com is V1. Tanzil's page metadata is V1. Pick a
reference without checking, compare a page in the 583–600 band, and you will "discover"
a defect that is a revision difference. That mistake is one page-turn away at all times.

## Start here

```bash
make probe-reference            # which references answer today, measured now (~15s)
make probe-reference PAGES=1    # 29 sampled pages: does our pagination still read as V2?
make probe-reference ALL=1      # all 604 (~4 min); prints only what neither print explains
```

`scripts/probe-reference.mjs` reaches the network, so it is **opt-in and never a gate**.
SOURCES.md already wrote that rule down for the quran-meta tables: a gate that reaches
the network fails when a host is down, which teaches everyone to skip it. The probe's
output is evidence a human banks with `make record`; it is not a red build.

### What `PAGES=1` / `ALL=1` actually assert

Not "do we agree with quran.com" — we must not, on 36 pages. **A pagination is a
fingerprint.** A V2 corpus checked against a V1 table has to agree on 568 pages and
differ on exactly the other 36. So the probe asserts both halves, and a page that agrees
where it should differ is as much a finding as the reverse. Measured 2026-08-06:
**568 agree, 36 diverge, 0 surprises** — our corpus still reads as V2 from outside the
repo, which is Loop 4a's identification re-derived by a party that has never seen it.

## The references, and what each one settles

Reachability measured **2026-08-06** from the maintainer's machine. Re-measure rather than
trust the table — that is what the bare `make probe-reference` is for.

| Reference | Reachable | Layout | Use it for | Do not use it for |
|---|---|---|---|---|
| **api.quran.com** `verses/by_page/N` | ✓ 292 ms | **V1** | fingerprinting our pagination; looking an ayah up by key | deciding what belongs on a page |
| **quran.com/page/N** | ✓ | **V1** | reading an ayah a human way | any page in the 36 |
| **QUL layout 10** (`qul.tarteel.ai/resources/mushaf-layout/10`) | ✓ | **V2** | the authority for this edition — what the Loop 4a pin was matched against | automation: the export is a download, and it is upstream of us, so agreement is partly circular |
| **archive.org** `mushaf_madinah_tercetak` | ✓ | mixed, **per item** | photographs of twelve printed KFGQPC masahif, in a BookReader | anything automatic, and six of the twelve outright — see below |
| **tanzil.net** | ✓ | **V1** | the tokenisation the tajweed offsets index | pages. It is not a layout |
| **dm.qurancomplex.gov.sa** | ✗ | — | *(would be the best reference there is — the printer's own)* | unreachable, permanently: see below |

**The KFGQPC portal is not coming back.** It times out at TCP 443 from a GitHub-hosted
runner (2026-07-27), from the maintainer's machine, and again on 2026-08-06. Two
unrelated networks failing at the transport layer is not a bot filter a header can talk
past, and `web.archive.org` is not fetchable from this tooling either. Research ⑦ was
**cancelled** over this, not deferred. Do not build a watcher, do not retry it in a loop,
and do not treat its absence as a task anyone can close. `docs/validation/ledger.json` →
`kfgqpc-terms-primary-source` keeps it as a permanent human check for exactly this reason.

### Choosing among the archive.org scans — the trap

`mushaf_madinah_tercetak` holds twelve prints. **Six of them are the wrong reference**,
and using one produces confident, wrong verdicts:

- `03 الدوري`, `04 ورش`, `08 قالون`, `09 شعبة`, `11 السوسي` — **different qira'āt**. Different
  wording in places, different ayah numbering in places. A pair that looks wrong in Warsh
  can be perfectly right in Hafs.
- `10 خط نسخ تعليق` — a different **script**, so a different pagination.

The Hafs candidates are `01`, `02`, `05`, `06`, `07`, `12`, and they span 1984–2017. Do
not pick by year, and do not assume the newest is ours. **Pick by the 36 pages**: open the
candidate at **p592** and check it starts at 87:11 (V2, ours) rather than 87:16 (V1). One
page decides it. Confirm with p120 — ours ends with 5:77 on it — and p531, which we run to
55:18 where V1 stops at 55:16. A scan that fails those is a different print, and every
disagreement it produces afterwards is noise.

## The rules

These are not style preferences. Each one is a rule this repo already enforces somewhere.

1. **A reference is never a source.** Nothing fetched here gets vendored, committed, or
   shipped. `SOURCES.md` records why a second page table would be actively harmful:
   the geometry comes from the vendored KFGQPC SVGs, and a differently-printed page table
   would be "a source of disagreement rather than of truth." Check against it; do not
   import it.
2. **Nothing we vendor and nothing we ship is Quran text.** Not the unscoped form
   this heading used to carry — it contradicted the rule quoted directly beneath it,
   and the tree has never satisfied it. The standing rule is in
   `packages/etl/scripts/morphology.mjs` — *"nothing this project vendors, and nothing it
   ships, is Quran text"* — and `gate:scripture` is what enforces it, failing on any run of
   three consecutive fully-vowelled words in any source file. It is not `gate:notext`, which
   this line used to name: that one forbids `<text>` elements in page artwork, for a Safari
   paint bug, and the misreading of its name cost two loops of work. The probe asks for
   verse *keys* only (no `fields` parameter), so the text never crosses the wire. Keep it
   that way: it is much easier to stay clean than to prove you got clean.
3. **Record verdicts, not scripture.** A note in `verified-edges.json`, `issues.json` or a
   commit message says *"16:112 / 6:99 — genuinely mutashabihat, shared run of 5 words"*.
   It does not quote the ayahs. Same rule, one layer up.
4. **Ask before downloading anything.** The archive.org PDFs run 64 MB to 711 MB. Read
   them in the BookReader at `https://archive.org/details/mushaf_madinah_tercetak` — one
   page at a time, nothing on disk. If a local copy is genuinely needed, name the file,
   the source and the size and get a yes first.
5. **Check the licence before relying on one.** `mushaf_madinah` carries a Public Domain
   Mark; `mushaf_madinah_tercetak` carries no `licenseurl` and no `rights` field at all.
   Reading a scan to check our arithmetic is fine either way. Redistributing one is a
   different act, and this repo does not do it.

## The procedure

### Confirming we are still the print we say we are (machine, ~4 min)

```bash
make probe-reference ALL=1
```

Exit 1 means a **surprise** — a page that agreed where the two prints must differ, or
differed where they must not. The 36 known divergences are not surprises and are not
printed unless something about them changed.

**A surprise is not proof we are wrong.** Settle it against the artwork before touching
anything, because the SVG for that page *is* the print and it is already in the repo. The
polygon ids are absolute ayah numbers, which is what the manifest was derived from:

```bash
grep -o 'id="verse-[0-9]*"' apps/web/public/assets/pages/hafs-kfqc/<N>.svg | head
make dev     # then open #/hafs-kfqc/p<N> and read the page
```

If the artwork sides with us, the reference re-based its layout and the finding is about
the reference. If the artwork sides with *them*, the finding is `gate:pages`-shaped and
belongs in `docs/issues.json` today — that is the shape of #80, the off-by-one that put
47.8% of hop edges on the wrong ayah.

### Running the edge spot-audit with a screen instead of paper

```bash
make validate CHECK=edge-spot-audit     # the full runbook
make audit-edges N=20 SEED=<fresh>      # the draw
```

Then, per pair, keep the print and the reference in different windows:

- **Our page** — `#/hafs-kfqc/p<N>`, the ayah highlighted. This is the print's own artwork.
- **The reference** — look the pair up **by key, not by page**: `https://quran.com/16:112`
  resolves an ayah without either side needing to agree about pagination, which keeps the
  36-page V1/V2 delta out of a check that is not about pagination at all. Reach for
  `quran.com/page/<N>` only outside those 36 pages, and for the BookReader when you want a
  real photographic page.

Read the two ayahs and judge whether they are genuinely mutashabihat. Record **every**
verdict, right and wrong, in `packages/etl/data/qa/verified-edges.json` — `gate:verified-edges`
is what turns the reading into a permanent test, and a round that records only the failures
teaches the gate that everything else was never looked at.

The reference earns its place here for one specific reason: our app tells you *which*
polygon is ayah 16:112. If that mapping were wrong you would read the wrong text and mark a
true pair false. Looking the key up somewhere we do not control takes our resolver out of
the loop.

## Where this stops

Say this plainly rather than letting a green probe imply more than it proved.

- **A page table cannot judge resemblance.** Agreement on all 604 pages says every ayah is
  where we say it is. It says nothing about whether the edge joining two of them is real.
  `edge-spot-audit` remains `owner: user`, and its `needs` still says a hafiz is worth more
  than a second reference.
- **A scan cannot answer the fore-edge question.** `does-a-real-fore-edge-stack-vary` asks
  how a physical stack of leaves behaves. That is paper, in a hand, and nothing on a screen
  substitutes.
- **A scan cannot confirm KFGQPC's terms.** Those live on an unreachable host and stay a
  human check, permanently.
- **Circularity has a shape here.** qul.tarteel.ai is upstream of our page pin, so it
  agreeing with us is close to us agreeing with ourselves. api.quran.com and the archive.org
  photographs are independent of our pipeline; prefer them when independence is the point.

## After a round

Bank it, or it has to be re-run by hand forever:

```bash
make record CHECK=edge-spot-audit RESULT='20 pairs from SEED=<n> read against <reference> on <date> — <n> correct, <n> wrong, verdicts in verified-edges.json'
```

The `/validate` skill's rule applies unchanged: **a manual result must end up tightening
something automated.** A page-table round tightens nothing by itself — it is a probe, not a
gate — so what it produces is a dated line in the ledger's evidence and, if it disagreed, a
row in `docs/issues.json`. An edge round tightens `gate:verified-edges` directly, which is
why it is the round worth the most per minute spent.
