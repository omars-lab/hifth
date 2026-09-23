---
name: leverage-qul
description: Pull a dataset from the Quranic Universal Library (qul.tarteel.ai) and turn it into a ruler for our own numbers, or an outbound link — never a vendored source. Use when asked to check our pagination, juz boundaries or mutashabihat against QUL, to add or refresh a QUL-backed probe, to find a QUL download URL, or whenever a QUL resource is about to be relied on. Walks discover → cache → sample → pin, and holds the guardrails that keep every byte of QUL text out of the repo and every resource's licence checked before it is trusted.
---

# Leaning on the Quranic Universal Library

QUL (`qul.tarteel.ai`) is a large, well-kept collection of Qur'an datasets — page
layouts, structural metadata, similarity corpora, morphology. This project uses it in
exactly two ways, and this skill is how you stay inside them.

## The one rule everything else serves

`qul-reliance` (`docs/decisions/qul-reliance.md`) was **reopened and re-decided D on
2026-09-07**. It first settled (A, 2026-09-03) that QUL is a **ruler and an outbound link,
and this repo copies none of its bytes** — and that still holds for the repository and the
shipped bundle. What D adds is a third, deliberately narrow place a copy may live: a hosted
database this project controls, off the tree and off the build, for the building tools to
read. So the ways this project uses QUL are now:

- **A ruler** — read a QUL dataset from a gitignored cache, measure our shipped numbers
  against it, and pin the *agreement figures* (verse keys, ids, boundary counts) plus a
  SHA-256 of each file read. Numbers about numbers. No glyph, no codepoint of Qur'an text
  ever enters the repo. This is `packages/etl/scripts/probe-qul-rulers.mjs`.
- **An outbound link** — send a reader to QUL's own page for a verse by its ordinal:
  `https://qul.tarteel.ai/cms/verses/N`, where N is the global 1-based ayah number
  (1:1 → 1). A URL, not the text. This is the `HopPopover` outbound link for an
  un-vendored target.
- **A held copy — the store (option D).** A copy of the page positions and the word text may
  be *held* in the hosted database this project controls (reached through the Supabase
  command-line tool), populated by `ingest-qul-supabase.mjs` from the same gitignored
  `.cache/`. It never enters the repository or the shipped bundle, and it is read by the
  building tools alone — whether any reader receives those bytes is a separate open question,
  not settled by D. The text-bearing word export may be held only after its licence is read
  (the ledger check `qul-rulers-terms-and-text-free`); the ingest refuses it otherwise.

Putting QUL's *content* into the **tree** — its text, its fonts, its per-word ranges laid
onto our shipped artwork — remains out of bounds: D moved the boundary to admit a store we
control, not the repository and not the build. Holding a text-bearing export in that store
still waits on that resource's licence read, and shipping any of it to readers is a further
decision (see `similar-ayah-enrichment`, and the open question of who reads the store).

This skill is the **content + validation** half. For which *reference* answers which
question, the V1/V2 revision trap, and the edge spot-audit, read the sibling skill
`mushaf-reference` first — it owns the "is our print still V2, do these two ayahs really
resemble each other" side and names layout 10 as the V2 authority. Do not duplicate it
here.

## The resources this repo rules against

Each QUL resource has a numeric id in its URL (`qul.tarteel.ai/resources/.../<id>`). The
ones already wired into the probe, with the cache path each is read from:

| id | what it is | cached at | rules against |
|---|---|---|---|
| **10** | KFGQPC QCF V2 (1421H) page layout, a SQLite DB | `packages/etl/data/pages/.cache/qul-layout10/qpc-v2-15-lines.db` | our `ayah-pages.json` — the V2 fingerprint |
| **73** | phrase-level similarity (phrases + the verses each spans) | `packages/etl/data/mutashabihat/.cache/qul73/{phrases,phrase_verses}.json` | our mutashabihat edges, phrase-corroboration |
| **74** | ayah-level similarity (whole-verse look-alikes) | `packages/etl/data/similar-ayah/.cache/qul74/matching-ayah.json` | our edges, and the twin **gap** |
| — | juz metadata (structural boundaries) | `packages/etl/data/meta/.cache/qul-metadata/quran-metadata-juz.json` | our `JUZ_STARTS` |

Whether each resource's export is **text-bearing** (off-limits) or **numbers-only** (safe
to rule against), and what licence and attribution each owes, lives in the rubric beside
this file — [`resources.md`](resources.md). It is read at run time and sharpened as each
resource's session-gated licence page is actually read (the ledger check
`qul-rulers-terms-and-text-free`); consult it before relying on any resource, and treat a
row still marked **PENDING** as *not yet cleared*, not *assumed fine*.

Every one of these paths is under a `.cache/` directory that is **gitignored**. That is
deliberate and load-bearing: the cache is machine-local evidence, never committed, which
is *why* the probe is opt-in and never a gate (a clean CI checkout has no cache, so a
gate over it would fail for everyone but the maintainer).

## The loop

### 1 — Discover the download URL

QUL's per-resource **Download** button is login-gated, but the download it triggers is a
302 redirect to a **public** object on Wasabi S3 — no auth on the object itself once the
URL is resolved. Two ways to get that resolved URL:

- **Claude in Chrome.** Open the resource page, click through to the download, and read
  the resolved request URL from the network panel (`read_network_requests`). This is the
  reliable way when the redirect chain or a signed query string is involved.
- **curl the redirect.** Once you have the `/download` URL, `curl -sIL` follows the 302
  to the Wasabi object and prints its final location; that object is then curl-able
  directly.

Record what you resolved — the resource id, the date, and the object URL — so the next
person does not re-derive it. A good home is a comment on the probe's cache section or a
line in the session log.

### 2 — Cache it (ask first)

QUL data drops range from small JSON to multi-hundred-MB SQLite. **Downloading anything
needs a yes** — name the resource, the URL and the size, then fetch into the exact
`.cache/` path the probe expects (table above). Do not put it anywhere the tree tracks;
`git status` after caching should show **nothing**. If it shows the file, the path is
wrong or the `.gitignore` does not cover it — fix that before going on, because the whole
"none of its bytes" guarantee rests on the cache staying out of git.

### 3 — Sample it, with your own eyes

Before trusting a resource's shape, look at a few rows of it directly (`sqlite3` for a
DB, a slice of the JSON for a drop). Two things this catches that a schema never will:

- **What the fields actually mean.** Layout 10's `surah_number` is populated only on the
  `surah_name` header line and empty on ayah lines; the probe's layout check depends on
  that and says so. You only learn it by reading rows.
- **Where a QUL count will not survive the trip.** QUL numbers a verse's *words* more
  coarsely than our print draws them (2:134 = 15 for QUL vs 17 shapes on our page). So
  QUL's per-word `match_words` ranges **cannot** be laid over our artwork — they would
  mark the wrong words. This is the entire cost basis of the `similar-ayah-enrichment`
  decision. Any new probe that touches QUL word indices must respect it: measure
  agreement, do not render QUL's indices on our pages.

### 4 — Pin the numbers

Extend `probe-qul-rulers.mjs` (or add a check beside it) so it reads the cache, measures
against what we ship, and writes **numbers only** into
`packages/etl/data/qul/qul-rulers.probe.json`: agreement figures, and the SHA-256 of
every file read via the `note()` helper, so a rerun either reproduces or says loudly that
upstream moved. Then:

```bash
make probe-qul            # measure and print
make probe-qul WRITE=1    # also refresh the pin
```

A missing cache is not an error — the check returns `{ skipped: ... }`, the section is
absent from the pin, and exit stays 0. Keep it that way: a probe that fails on a machine
without the cache would get switched off.

## The guardrails

Each is a rule this repo enforces somewhere; none is a preference.

1. **None of its bytes.** No Qur'an text — no glyph, no codepoint — crosses the wire into
   the repo or into a committed file. The probe requests keys, ids and counts only.
   `gate:scripture` (three consecutive fully-vowelled words in any source file) and
   `gate:notext` (`<text>` in page artwork) stay green, and it is far easier to stay
   clean than to prove you got clean after the fact.
2. **The cache is gitignored, always.** Machine-local evidence, never committed. `git
   status` shows nothing after a cache. This is what lets the probe be opt-in rather than
   a gate.
3. **Ask before downloading.** Name the resource, URL and size; wait for a yes. Prefer
   reading a resource in place over putting it on disk when you can.
4. **Check the licence per resource, before relying on it.** QUL states terms
   *per resource*, not once for the site (their FAQ #3/#9). Reading a drop as a ruler is
   one act; the attribution owed still has to be determined from *that resource's* stated
   terms, even for zero-byte ruler use. Record what you found in `SOURCES.md` (the QUL
   entry) and, where the app surfaces QUL to a reader, in the colophon. See the
   `qul-licensing` memory for the standing summary, and re-check the resource page rather
   than trusting a months-old note.
5. **Record verdicts and figures, not scripture.** The pin holds numbers and hashes; a
   commit message says "635 verbatim twins QUL knows that we do not", never the verses
   themselves. Same rule, one layer up.

## Where this stops

- **A ruler agreeing with us is not always independent.** Layout 10 is *upstream* of our
  page pin — it agreeing with us is close to us agreeing with ourselves. When
  independence is the point, prefer a source outside our pipeline (see `mushaf-reference`
  on api.quran.com and the archive.org photographs). The probe records the agreement
  either way; just do not oversell a circular one.
- **A count is not a claim about resemblance.** The probe can say QUL scores two verses a
  100% match; whether they read as genuine look-alikes on the page is a human check, and
  the `similar-ayah-enrichment` page only draws pairs that were eye-verified first.
- **Word indices do not transfer.** Restated because it is the easiest guardrail to
  forget: QUL's per-word ranges are coarser than our print and must not drive per-word
  rendering on our artwork.
