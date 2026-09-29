---
name: qul-page-preview-witness-decision
description: "Owner said GO on wiring QUL's page-preview as a redundant 4th page-registration witness, despite it being redundant/gated"
metadata: 
  node_type: memory
  type: project
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-21T14:17:02.419Z
---

Task #66. On 2026-09-20 the owner chose **"wire it in as a 4th witness"** for QUL's
`mushaf_page_preview` (`https://qul.tarteel.ai/cms/mushaf_page_preview?page=N&mushaf=M`),
over my recommendation to decline-and-log.

**What the finding said (and why I recommended decline):** the preview is login-gated
(anon request 302 → `/users/sign_in`); `mushaf=1` is very likely the V1/1405H printing
(the V2 authority on QUL is a *different* resource, `mushaf-layout/10`), so it would
disagree with our shipped V2/1421H pages on exactly the 36 known V1/V2 divergence pages;
and the question it would answer ("is every verse on the page it's truly on") is already
settled by three independent witnesses — quran.com's 568/604 + 6180/6236, plus an existing
probe that passed 56/56 pages across every V1/V2 divergence band. So it is a redundant
fourth on a settled question.

**The owner overrode that — they want the extra cross-check anyway.** So the build is:
a build-time page-map-to-page-map cross-check (per-page verse spans only, **zero QUL bytes
stored**, attributed), comparing QUL's preview spans against `packages/etl/data/pages/ayah-pages.json`.
Positions carry no letters, so this does NOT break the no-text rule (it's "almost entirely
on the safe side"); pulling word/line **geometry** would cross into the forbidden "draw the
page" half — so positions only.

**Blocked on gated access:** need the owner's signed-in Chrome (extension was disconnected
2026-09-20) to (1) read the licence on the page-map resource — never read before, (2) confirm
which `mushaf=M` id is V2/1421H (mushaf=1 is probably V1 → wrong witness), (3) see whether the
preview exposes structured per-page verse ranges (data-surah/data-aya) vs. just a page image.

**DONE 2026-09-21 (commit bfd7050 on `harakat-marking`).** The build differed from the
open-decision framing in two ways that mattered, both recorded in the decision:
- The **preview** (`mushaf_page_preview`, gated, `mushaf=M`) is NOT what got wired. The
  authority used is the **layout export** `mushaf-layout/10` (QCF V2/1421H, 604pp/15 lines) —
  the SQLite our edition was pinned to in PROVENANCE Loop 4a. Read via `node:sqlite
  --experimental-sqlite`, path passed in, zero bytes stored.
- **Line-by-line is unsound**, so it was NOT built: QUL's 83668 word ids ≠ our QAC
  segmentation, so a word-for-word line-up invents convention-not-error disagreements. The
  sound, tag-independent signals were compared instead: **surah first-ayah page (114/114
  agree)** + structural constants (604/15). Banner page differs for 18 surahs (QUL prints the
  banner on the previous page) — reported for the eye, not asserted.

The open row was `qul-page-cross-check` (not a new decision) — **decided B** (a report a person
runs, not a forever-guard). C was infeasible: gated download can't feed CI, and a banked copy
would compare our table to a frozen copy of itself. Shipped: `scripts/probe-qul-v2-layout.mjs`
+ `make probe-qul-v2 DB=<file>` (opt-in, twin of `probe-reference`); SOURCES.md attribution;
ledger spot-audit runbook line beside its twin. Task #66 closed.

Related: [[qul-licensing]], [[qul-gap-record-dont-import]], [[segmentation-witness-technique]],
[[qul-signed-in-download-permission]], [[decisions-must-be-recorded-at-the-source]].
