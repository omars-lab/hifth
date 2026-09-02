# Track B: the wrapper, and the store that will not take it

> Read this *before* writing a line of Capacitor config. The blocker is not technical and
> it is not iOS-specific engineering — it is a licence Hifth does not own, on data Hifth
> cannot drop, and the order [`PLAN.md`](../PLAN.md) §Track B states is not achievable in
> that order.

**Status:** scoping of record for Track B. Nothing is built and nothing should be until the
question in ① is settled. Everything below is measured against the repo at
[`5dc227d`](../../) or cited to a file; the licence reading is an argument, and §⑦ ② names
what would settle it properly.

## How to read this, and what it is not

`docs/decisions/loop-*.md` record what a finished loop settled;
[`docs/design/`](.) is the document you consult *before* changing something. Track B has no
loop and no code, so this file is the whole of it.

Its companions, cited rather than restated:

- [`SOURCES.md`](../../SOURCES.md) — every upstream's terms, verbatim, with provenance.
  This file argues from those terms; it does not re-derive them, and where it quotes it
  quotes the same words `gate:license-copy` binds to `Colophon.tsx`.
- [`LICENSES.md`](../../LICENSES.md) — the per-path bucket map. §③ argues one of its rows
  is wrong.
- [`docs/research/2026-07-20-mobile-svg-pwa.md`](../research/2026-07-20-mobile-svg-pwa.md)
  §6 — the iOS deep-link caveat that is the *stated* reason Track B exists.

**This is not a plan to ship an app.** It is the reason the plan that exists says the wrong
thing, and what a correct one would have to answer first.

---

## ① The order in `PLAN.md` is backwards

[`PLAN.md`](../PLAN.md) §Track B reads "Capacitor iOS, then Android", with Android as a
"~95% shared code" fast-follow. On the licences this repo actually vendors, that order
inverts: **Android is reachable and the App Store is the blocked one.**

Hifth is GPL-3.0-or-later ([`LICENSES.md`](../../LICENSES.md), and the reasoning for plain
GPL over AGPL is there too). A GPL'd binary on Apple's App Store is the oldest known
conflict in this space: Apple's terms impose per-device installation limits and DRM that
GPL §6 and §10 do not permit a distributor to add. The projects that ship anyway —
Signal, OsmAnd, VLC's eventual settlement — all do it the same way, by having **every
copyright holder** grant an additional permission under GPL §7.

Hifth cannot assemble that grant, because it is not the only copyright holder in the
shipped bytes.

## ② What is in the way, specifically

Three vendored corpora, three different problems, and only one of them is fixable by us.

**The Quranic Arabic Corpus** (`packages/etl/data/roots/`, © 2011 Kais Dukes) is the hard
one. Its own header — quoted verbatim in [`SOURCES.md`](../../SOURCES.md#quranic-arabic-corpus)
and pinned into the app's colophon by `gate:license-copy` — grants the GPL and then says
copies may be distributed but **"CHANGING IT IS NOT ALLOWED"**. `SOURCES.md` already records
that this is in tension with GPL §5 and explains how Hifth satisfies both readings: vendor
the file verbatim, derive the shards at build time. That resolution works for a website. It
does not extend to granting a §7 App Store permission, because a §7 additional permission is
a *change to the licensing terms*, and it can only be granted by the copyright holder. Kais
Dukes is not reachable through a repo commit.

**quran-tajweed** (`assets/skins/**`) is CC BY 4.0, and CC BY 4.0 §2(a)(5)(B) forbids
applying "Effective Technological Measures" to the licensed material where doing so
restricts the rights the licence grants. App Store FairPlay is exactly such a measure. This
one is real but narrower than the QAC problem: the skin is one edition among several and
could in principle be omitted from a store build. The QAC-derived data cannot — see ③.

**KFGQPC** (`assets/pages/**`, `packages/etl/data/**`) is neither GPL nor CC; it is "each
source's own terms", and [board item #55](../issues.md) — confirming those terms with a
human at qurancomplex.gov.sa — is still open. A store submission is precisely the context
in which "we have not read the terms" stops being deferrable.

## ③ `LICENSES.md:17` understates the exposure

`LICENSES.md` buckets `apps/web/public/assets/adj/**` under "Free use with attribution
(inherited) — Waqar144's", i.e. the mutashabihat dataset's terms alone. That was true when
the shards carried only edge endpoints. It is no longer true.

[`build-adjacency.mjs:45`](../../packages/etl/scripts/build-adjacency.mjs) imports
`wordsByAyah` and `sharedRuns` from
[`morphology.mjs`](../../packages/etl/scripts/morphology.mjs), whose own header states what
it reads: the Quranic Arabic Corpus morphology. `spansOf` (`:287`) calls `sharedRuns`, and
the result is written into every shard at `:342` as `span` / `toSpan`. So the shipped
adjacency shards contain values *computed from* GPL'd data — under the same strict reading
of "derivative" that this repo applies to itself elsewhere, `assets/adj/**` is a GPL
derivative and the row in `LICENSES.md` names one of its two parents.

This matters here and not on the web, and that asymmetry is the point: on a static site the
GPL is satisfied by construction (the browser is handed the whole bundle; §4–6 are already
discharged, which is the argument `LICENSES.md` makes for plain GPL over AGPL). Inside a
store binary it is the thing that has to be licensed, and the licence has a hole in it.

**This row should be corrected regardless of whether Track B ever happens**, because it is
wrong today. It is ⑦ ① below.

**Corrected 2026-08-15.** The row now names both parents, and `LICENSES.md` carries a section
saying how the second one arrived. Two things the correction did not settle went to ⑦ ⑤ and
⑦ ⑥: the adjacency shards still ship no `NOTICE.txt`, and nothing anywhere would notice the
next asset tree that gains an upstream this way. The paragraphs above are left in the present
tense on purpose — they are the record of what was wrong, and rewriting them into the past
would leave this document unable to say what it caught.

## ④ What Track B was actually for, and how much of it survives

The stated payload in `PLAN.md` is: bundle the corpus offline, native share sheet,
**Universal Links**, haptics, state restoration, iPad spread, App Store review notes.

Reading them one at a time against what the web build now does:

| Promise | Still worth a wrapper? |
|---|---|
| Corpus bundled, offline by default | **No.** Loop 6b ships pin-a-juz packs over Cache Storage, and §⑤ says the *whole* print is smaller than the delivery plan assumed. |
| Universal Links | **This is the one.** Research §6 is a genuine platform limit: a tapped hop link cannot open an installed iOS PWA. |
| Native share sheet | Partly — `navigator.share` already exists; the wrapper buys the fallback, not the feature. |
| iPad two-page spread | **No.** [`PLAN.md:1038`](../PLAN.md) already records this became a web concern; `desktop.md` shipped it. |
| Haptics, state restoration | Nice, small, not a reason. |

So the honest summary is that Track B has narrowed to **one** load-bearing promise — deep
links into an installed app on iOS — and that promise is on the platform whose store is the
one blocked. `PLAN.md:1297` also cites this as "research §5"; §5 is *"Offline: quota is a
non-issue; eviction is the issue"* and §6 is the deep-link caveat. The citation is off by
one and is ⑦ ③.

## ⑤ The corpus is smaller than the risk register assumes

Measured, not estimated — `pnpm gate:assets` on the tree at time of writing:

```
26834.4 KB gz  604 files  pages/hafs-kfqc
  885.6 KB gz  604 files  words/hafs-kfqc
  532.3 KB gz  147 files  roots/hafs-kfqc
  207.7 KB gz  115 files  skins/hafs-kfqc
   79.5 KB gz  114 files  adj/hafs-kfqc
gate:assets — OK (28539.5 KB gz across 1584 files in 5 trees)
```

**27.87 MB gzipped, 1,584 files.** That is under every app-store size threshold that would
have forced staged delivery, and it retires the delivery plan's On-Demand-Resources /
asset-pack concern outright: an iOS or Android binary can simply contain the whole mus'haf.
One fewer reason to build Track B, and one fewer risk if it is ever built.

## ⑥ One thing that would break the day a wrapper shipped

[`ShareSheet.tsx`](../../apps/web/src/components/ShareSheet.tsx) builds its share URL from
`window.location.origin + window.location.pathname`. Under a Capacitor wrapper that origin
is the local WebView scheme — `capacitor://localhost/` on iOS, `http://localhost/` on
Android — so every shared hop link would be **unopenable by the recipient**, on any device,
including the sender's own browser.

It is a small fix (a configured canonical origin rather than the live one) and it is written
down here rather than fixed now for the reason the repo applies elsewhere: a change with no
caller is a change nobody will test. But it is the concrete answer to "how much of the web
build survives wrapping unchanged", and the answer is *not all of it* — which is worth
knowing before anyone budgets Track B as "wrap and ship".

## ⑦ Open questions, and what would answer each

### ① `LICENSES.md` buckets `assets/adj/**` under one of its two upstreams · **answered**

The shards carry `span` / `toSpan` values computed by `sharedRuns` out of the GPL'd QAC
morphology (`build-adjacency.mjs:45`, `:287`, `:342`), and the row names only Waqar144's
mutashabihat terms. Independent of Track B and wrong today.

**Answered 2026-08-15.** The row was corrected, and the claim it rested on was re-measured
before anything was edited rather than taken from this document on trust: **2,544 of 3,002
edges across 114 shipped shard files carry a span**, and 85 of the 114 files contain a
`toSpan`. That is the common case, not an edge case, so the strict reading applies and the row
now reads GPL-3.0 *and* free-use-with-attribution, naming both parents. `LICENSES.md` gained a
section explaining how the second parent arrived — as a feature, with no licence file touched
— because a two-parent row with no story behind it invites someone to simplify it back.

Two things the edit did not settle, and they are not the same question, so they are split:
the notice does not travel with the adjacency data the way it does with the root data (⑤),
and nothing would catch the next one (⑥, which is the gate question this item originally
carried).

### ② Whether the GPL/App-Store reading in ①–③ is right · **open**

Everything above is argued from licence text by a non-lawyer. The conclusion — that Hifth
cannot assemble a §7 additional permission because one copyright holder is unreachable and
another's terms forbid changes — is the kind of claim this repo requires evidence for, and
"I read the licence" is not the same standard as `gate:*`.

**What would answer it:** a licensing opinion from someone qualified, scoped to the three
upstreams by name. Until then Track B stays gated and this document stays the reason.

### ③ `PLAN.md` states an unachievable order and one wrong citation · **open**

§Track B says "Capacitor iOS, then Android"; §② says the store that blocks is Apple's, so
the reachable order is Android first. `PLAN.md:1297` cites research §5 for the deep-link
caveat, which is §6.

**The citation half is fixed, 2026-08-15.** `PLAN.md:1297` now cites §6. It was checked
rather than trusted first: §5 of the research note is the offline finding — quota is not the
problem, eviction is — and §6 is the iOS deep-link caveat, so the item was right about which
number was wrong. That half was safe to take alone because it is a pointer, not a plan: it
changes nothing about what Track B does or in what order.

**The order half stands, and stays blocked on ②.** It is still `open` for that reason and
that reason only.

**What would answer it:** the licensing opinion ② is waiting on. A roadmap edit that changes
a loop's stated order should be its own decision with its own record, and if the opinion comes
back saying the §7 route is open after all, the order it dictates changes again — editing the
roadmap twice is worse than editing it once.

### ④ Whether Track B should exist at all after ④ and ⑤ · **open**

Its payload has narrowed to one promise (iOS deep links into an installed app) on the one
platform whose store is blocked. The remaining honest options are: drop Track B; ship
Android only and accept the asymmetry; or keep waiting on ⑦ ② and treat the iOS deep-link
gap as a documented limitation the onboarding already respects (research §6 says onboarding
"must not promise link-into-app on iOS", and it does not).

**What would answer it:** web v1.0 shipping and someone using it. Track B was always gated
on that, and the gate has done its job — a year of platform work was not spent on a wrapper
whose reason has since been half-dismantled by the web build itself.

### ⑤ The adjacency shards ship without the notice their upstream requires · **fixed**

`LICENSES.md` names two consequences of a bucket being a GPL derivative: the corresponding
source reaches recipients, and *the notice travels with the data*. Once ① is taken, the
adjacency bucket owes both, and it discharges only the first.

Measured, not assumed: `apps/web/public/assets/roots/hafs-kfqc/NOTICE.txt` and
`apps/web/public/assets/skins/hafs-kfqc/NOTICE.txt` exist and are emitted by their builders
(`build-roots.mjs:271`, `build-tajweed.mjs:211`); `apps/web/public/assets/adj/hafs-kfqc/`
holds 114 shard files and nothing else. So two of the three derived trees keep the convention
and the third never joined it — which is what makes this a defect rather than a difference of
opinion. It was invisible for the same reason ① was: the spans arrived as a feature, and a
feature has no reason to look at what a sibling build step writes beside its output.

**What would answer it:** `build-adjacency.mjs` emitting a `NOTICE.txt` beside the shards,
quoted verbatim from the source header the way `build-roots.mjs` does it, and naming both
upstreams rather than the one the file is mostly about. That is a build change and a rebuild
of a shipped asset tree, which is why it was not folded into the licence-file correction.

**Fixed 2026-08-16.** `build-adjacency.mjs` now writes the notice, and it names both parents
— the failure available here was fixing the one-parent error in the other direction, by
discharging the GPL half and dropping Waqar144's attribution. The corpus's copyright block is
no longer copied: `morphology.mjs` gained `copyrightBlock()`, `build-roots.mjs` was moved onto
it, and the two trees now reproduce one quotation rather than two copies that can drift. The
root shards rebuilt **byte-identical**, which is what makes that extraction a refactor rather
than a claim. `gate:notices` is the test that would fail if the notice went away.

### ⑥ Nothing would notice the next asset tree that gains an upstream · **fixed**

This is the general form of ① and ⑤, kept separate from both because it outlives them: ①
corrects one row, ⑤ writes one file, and neither makes the next occurrence any more visible
than this one was. The drift here ran for the whole life of the spans feature, and every
mechanism that could have caught it was pointed somewhere else. `gate:license-copy` pins the
licence text quoted in `SOURCES.md` against the copy in the colophon — a strong check on
whether a quotation drifted, and no check at all on whether the *set of things being quoted*
is still complete. Nothing in the repo greps for `NOTICE` at all: two builders write one by
convention and nothing verifies either.

The honest difficulty is that "an asset tree gained a new upstream" is a fact about an import
graph, not about a directory. A gate that could see it would have to trace what each builder
reads — transitively, since `build-adjacency.mjs` never touches the morphology file itself and
reaches it two hops out through `morphology.mjs`. That is real work and a real chance of a
gate that is wrong in a way nobody notices, which is worse than none.

**What would answer it:** deciding which of the two shapes is worth building — the cheap one
(every directory under `assets/` that a builder writes must carry a `NOTICE.txt`, and the set
of upstreams named across them must match `LICENSES.md`'s bucket table), or the real one (the
import trace). The cheap one would have caught ⑤ and would not have caught ①. Not obviously
worth it either way, which is why this is a question and not a task.

**Fixed 2026-08-16 — both shapes, because the cheap one alone re-runs this item.** The
question above frames it as a choice, and building it showed the choice was false: the cheap
half catches a missing notice and is blind to the wrong bucket row, which is the defect that
actually happened. `gate:notices` does three ties. The table against the shipped bytes — every
inherited row must ship a notice naming what the row names, in both directions, so a new
inherited bucket cannot be added to the table without arriving in the gate. The names against
`SOURCES.md`, so a renamed project fails instead of matching nothing. And the trace: each
builder is walked through its transitive relative imports, and every vendored input the
resulting module graph reads must carry a verdict. **An input the trace finds and the
declaration does not mention fails the build** — so the next time a feature reaches a new
upstream, the person who wrote the feature is the one who has to say what it means.

The import trace was the half that looked too expensive to be worth it. It was not, because
the scope that matters is small: relative imports inside one package, and string literals
matched against the vendored files that actually exist. What it cannot see is written into the
gate's own header rather than left to be discovered — it does not resolve dynamic paths, does
not follow `@hifth/core`, and treats `*.pin.json` and `*.probe.json` as this project's own
artefacts, so a builder that reaches a new upstream *only* through a pin is invisible to it.

The exemption list is the part worth defending, since `gate-gates.mjs` says in as many words
that an allow-list is how this goes wrong every time. This one cannot go quiet: a deferred
input must name an issue id that exists in `docs/issues.json` **and is still open**, so closing
the question breaks the build until the declaration is revisited. It found ⑦ on its first run.

### ⑦ A third upstream reaches the adjacency shards · **open**

Found by ⑥'s trace on the first run it did, which is the strongest thing that can be said for
building it. `build-adjacency.mjs` reads `data/pages/ayah-pages.json` — the ayah→page table —
and writes `page` and `dPage` into **every** edge in all 114 shards. That table is derived from
the KFGQPC page corpus, and `LICENSES.md` buckets that corpus separately as *not ours to
relicense*, naming terms neither of the adjacency row's two upstreams grants.

So the shards may have three parents rather than two. They may equally have two: a table of
which page each ayah falls on is arguably a fact about a printing rather than expression, and
this repo already treats it as a measurement — the same table is used in reverse to *identify*
which print a corpus follows, which is not a thing one does with someone else's authorship. The
adjacency shards also carry no page image, no glyph and no text: they carry the integer.

**This is not decidable here, and guessing costs more than waiting.** Naming KFGQPC on the row
without grounds overstates what the app owes and would propagate into the notice shipped to
every reader; leaving it unnamed understates it if the answer is the other way. Both are worse
than an open question with the number attached.

**What would answer it:** the same licensing opinion ② is already waiting on, with this added
to its scope — it is a fourth question for a reader who is being asked three. Until then
`gate:notices` carries the deferral explicitly and will not let it be forgotten, since the
deferral is only valid while this item is open.
