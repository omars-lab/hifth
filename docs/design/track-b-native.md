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

### ① `LICENSES.md` buckets `assets/adj/**` under one of its two upstreams · **confirmed**

The shards carry `span` / `toSpan` values computed by `sharedRuns` out of the GPL'd QAC
morphology (`build-adjacency.mjs:45`, `:287`, `:342`), and the row names only Waqar144's
mutashabihat terms. Independent of Track B and wrong today.

**What would answer it:** an edit to the row, naming both parents — and a decision about
whether `gate:license-copy`'s reach should extend to `LICENSES.md`'s bucket table, since the
drift here was introduced by a *feature* (`word-D1`, the spans) rather than by anyone
touching a licence file. A gate that notices "an asset tree gained a new upstream" is the
shape that would have caught it.

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

**What would answer it:** editing both, in a change that also links here — deliberately
*not* done in the commit that introduced this file, because a roadmap edit that changes a
loop's stated order should be its own decision with its own record, not a footnote to a
scoping doc.

### ④ Whether Track B should exist at all after ④ and ⑤ · **open**

Its payload has narrowed to one promise (iOS deep links into an installed app) on the one
platform whose store is blocked. The remaining honest options are: drop Track B; ship
Android only and accept the asymmetry; or keep waiting on ⑦ ② and treat the iOS deep-link
gap as a documented limitation the onboarding already respects (research §6 says onboarding
"must not promise link-into-app on iOS", and it does not).

**What would answer it:** web v1.0 shipping and someone using it. Track B was always gated
on that, and the gate has done its job — a year of platform work was not spent on a wrapper
whose reason has since been half-dismantled by the web build itself.
