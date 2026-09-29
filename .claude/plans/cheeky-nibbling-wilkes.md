# Integrate QUL as a pinned validation ruler + ship a huffaz "similar ayat" feature

## Context

QUL (Quranic Universal Library, `qul.tarteel.ai`) is the most complete open hub of
Quranic datasets — scripts, the 604-page QPC V2 mushaf layout, per-page glyph fonts,
metadata, and two distinct similarity corpora. This repo already leans on it as a
*measuring instrument* (`probe-reference.mjs`, `probe-hop-recall.mjs` read QUL resource 73
from a gitignored cache), but the wiring is ad-hoc and the richer resources the owner
pointed at (V2 layout 10, similar-ayahs 4001, the full metadata set) are not yet used.

The owner wants QUL "properly integrated" from a **content** and a **validation** angle,
and specifically wants a **huffaz-facing "similar ayat" feature**. Two forks were decided
this session and MUST be recorded at the source (`docs/decisions.json`) during
implementation, not left verbal:

- **How far: "Ruler + deep-link."** QUL is used as a cached, *pinned* measuring instrument
  and as an outbound deep-link. **Zero QUL bytes ship.** This preserves the repo's
  load-bearing tenet — *nothing this project vendors or ships is Quran text* (the mushaf is
  anonymous SVG path artwork; everything else is numbers) — and sidesteps QUL's unstated
  per-resource licence. Vendoring the QPC V2 glyph text/fonts (a glyph font of whole words
  *is* Quran text) is explicitly **out of scope** here; if ever wanted it is a separate,
  recorded owner decision gated on a licence determination.
- **Mutashabihat: "Build the huffaz feature."** Ship an in-app "this verse resembles N
  others, differing words highlighted" experience — built on the repo's **own** already-
  vendored data (numbers + word geometry), with QUL similarity corpora used only as the
  ruler that validates/enriches it.

Findings to fold in (correct the repo's recorded stance):
- Download endpoints are **open** (`/resources/<type>/<hash>/download`, one hash per format,
  JSON + SQLite — verified for script 47), so "login-gated" is now partly stale.
- Licence is **per-resource, not blanket-unstated** (FAQ #3/#9): some resources are public
  domain, some require attribution, some restrict use; commercial use is permitted *subject
  to each resource's own terms*. So the correct posture is a **per-resource licence
  determination + proper attribution**, not a global "forbidden." We still ship zero QUL
  bytes here by the owner's ruler+deep-link decision, but **attribution is required even for
  ruler use and the deep-link**, and each resource's licence + attribution string is recorded
  in `SOURCES.md` and the notices mechanism (`gate:notices` / `gate:license*`).

## What we are NOT doing

- Not vendoring QPC V2 glyph text, the 604 per-page fonts (resource 249), or any script
  Unicode/glyph bytes. No font-based page rendering. The SVG-artwork model stays.
- Not adding any QUL fetch to a `gate:*` (CI) path. QUL reads are **probes** — opt-in, may
  touch cache/network — never gates.
- Not changing the "no Quran text in the tree" tenet. (Optional follow-up: open a `decide`
  record for the vendoring question so it is deliberate, not silently foreclosed.)

## The QUL resources in play (sampled — real schemas pulled 2026-09-03)

All four below were downloaded, cached in gitignored `.cache/` dirs (sha256'd), and sampled;
full detail in `scratchpad/qul-samples.json`. Every field is a number, an id, or a verse
key — **no Quran text in any of them.**

| Purpose | Resource | Schema, as actually sampled (numbers only) |
|---|---|---|
| Page layout authority | **Mushaf layout 10** — `QCF V2 ( 1421H print )`, 604 pp / 15 ln, sqlite | `info(name, number_of_pages=604, lines_per_page=15, font_name='v2')` · `pages` (9046 rows): `page_number, line_number, line_type[ayah\|surah_name\|basmallah], is_centered, first_word_id, last_word_id, surah_number` — `first/last_word_id` are global 1-based word ids; there is **no `text` column**, use the ranges |
| Structural metadata | **quran-metadata** juz set (8 sets: surah/ayah/juz/hizb/rub/manzil/ruku/sajda), json | `juz_number → { juz_number, verses_count, first_verse_key, last_verse_key, verse_mapping:{surah→'from-to'} }` (juz 1 = 148 verses, 1:1..2:141) → cross-check `quran-meta.ts` |
| Phrase look-alikes | **Mutashabihat 73**, json | `phrases.json`: `phrase_id → { surahs, ayahs, count, source:{key,from,to}, ayah:{verse_key→[[fromWordIdx,toWordIdx]]} }` · `phrase_verses.json`: `verse_key → [phrase_id]` |
| Ayah similarity | **Similar ayah 74** (1162 verses / 3552 pairs; coverage 5–200, score 50–100), json | `verse_key → [ { matched_ayah_key, matched_words_count, coverage, score, match_words:[[fromWordIdx,toWordIdx]] } ]` |
| (reference only) | Script 47 V4-glyph+tajweed WBW; font 249 QPC V2 | schema noted for provenance; **not downloaded into anything shippable** |

**Download mechanism (verified, corrects the plan's earlier "confirmed open"):** the
`/resources/<type>/<hash>/download` endpoint is **session-gated** — unauthenticated `curl`
returns a 37 KB HTML sign-in page. From a **logged-in** `qul.tarteel.ai` tab it 302-redirects
to a **public Wasabi S3 zip** (`s3.us-east-1.wasabisys.com/static-cdn.tarteel.ai/qul-exports/…`)
which needs no auth; resolve the S3 URL in-browser (`fetch(url,{method:'HEAD'}).url`) then
`curl` it. Every export is a ZIP. Files land only in **gitignored `.cache/qul*/`** dirs.

## Approach

### Step 0 — Discover resources + download URLs (Claude-in-Chrome), then sample into gitignored caches
The `/download` links are JS-rendered (WebFetch sees `#_` placeholders; the owner surfaced
two working hashes for script 47, so the `/resources/<type>/<hash>/download` endpoint is
confirmed open). Use **Claude-in-Chrome** to (a) crawl the `/resources` index and each
resource page, (b) read the rendered download anchors / embedded JSON to extract the real
per-format hashes, and (c) confirm each relevant resource id (layout 10, mutashabihat 73,
similar-ayahs 4001, the metadata set, script 47 + font 249 for provenance only). Capture the
extracted `{resource, format, url}` map into the scratchpad, not the repo.

Then follow the existing cache convention (`packages/etl/data/mutashabihat/.cache/qul73/`):
pull JSON (and SQLite where query-heavy) into `packages/etl/data/<domain>/.cache/qulNN/`,
confirm it is gitignored (`git check-ignore`), and record a schema sample + the exact
download URL + a SHA-256 in the relevant `PROVENANCE.md` / `SOURCES.md`. Nothing here is
committed except pins and provenance prose. This discover→extract→cache→sample loop is the
core of the skill in Step 5.

### Step 1 — Record the two decisions at the source
Per `.claude/memory/decisions-must-be-recorded-at-the-source.md`: write both decisions
(ruler+deep-link; build-the-feature) into `docs/decisions/` + a row each in
`docs/decisions.json` (question phrased as a question, `related` back-links, an `artifact`
+ checked-in `page` for the open feature-design decision), then `make decisions-doc` and
`pnpm gate:decisions`.

### Step 2 — QUL rulers (validation), following the probe pattern
Mirror `packages/etl/scripts/probe-hop-recall.mjs` (read cache → compute → write a
committed `*.probe.json` of **numbers only** → document under `docs/design/*.data.json`).
Add / extend:
- **Layout-10 pagination probe** — extend `scripts/probe-reference.mjs`: reconcile
  `data/pages/ayah-pages.json` and page/line first/last-word ranges against layout 10's
  `pages` table. Emit disagreements as a pinned report. **Use id 10 (V2), never V1** — the
  two diverge on 36 pages (`packages/etl/data/pages/PROVENANCE.md`).
- **Metadata probe** — cross-check QUL juz/hizb/rub/manzil/ruku/sajda boundaries against
  `AYAH_COUNTS`/`JUZ_STARTS`/`HIZB_STARTS` in `packages/core/src/quran-meta.ts`
  (`toAbsoluteAyah`, `packages/core/src/quran-meta.ts:52`). Where core has no table (rub,
  manzil, ruku), the probe reports what QUL says so a future core table can be typed by hand.
- **Similarity probe** — validate the shipped mutashabihat signal (Waqar144) against QUL 73
  and 4001: agreement rate, coverage/score distribution, orphans. Pin the numbers next to
  `docs/design/hop-recall.data.json`.
- Wire all three into `make probe-reference` (opt-in), never a gate. Add a
  `docs/validation/ledger.json` human-check entry for "QUL licence terms / glyph identity"
  via `scripts/validation-ledger.mjs` + `make validate`.

### Step 3 — `/cms/verses/N` deep-link (blessed shippable output)
Implement the outbound deep-link from `toAbsoluteAyah` (zero new data — see
`.claude/memory/qul-verse-url-mapping.md`). Small: a helper in `packages/core` + a link in
the app's ayah/colophon surface. Ships a URL, not bytes.

### Step 4 — huffaz "similar ayat" feature (built on repo-own data)
Because the difference is **felt/interactive**, the repo tenet ("if the difference is felt,
it is built, not drawn"; "every design is public") requires this go through a **design page**
under `docs/design/` served from the site, with live `OptionA..N` components, before a
winner graduates. So:
- First read `packages/etl/scripts/probe-hop-recall.mjs` + `docs/design/hop-recall.*` and
  the recent "reach-for-ink"/"hop-recall" work to see what similarity surfacing already
  exists and place the feature there rather than duplicating it.
- Data path (ships zero QUL bytes): use the already-vendored mutashabihat word ranges +
  the shipped `word-boxes` geometry (`apps/web/src/assets.ts`, `PageStage.tsx`) to
  **highlight matched/differing words on the page artwork by index** — no text rendered,
  fully consistent with the SVG model. QUL 73/4001 coverage/score are pinned numbers used to
  rank/label, computed offline into a shippable numbers shard.
- Build the design/decision page (options for how similar ayat are surfaced: inline page
  highlight vs side panel vs on-demand overlay), mount live, let the owner choose, graduate
  the winner, delete losers. Golden images for the chosen render.

### Step 5 — package the workflow as a `leverage-qul` skill
Per the owner: leveraging QUL content is its own repeatable workflow, so package it as
`.claude/skills/leverage-qul/SKILL.md` (modeled on `.claude/skills/mushaf-reference/`). The
frontmatter `description` is the dispatch line — write it so it fires on "pull/validate/
cross-check a QUL resource" (a vague description means it never auto-triggers). The skill
body encodes the guardrailed loop:
1. **Discover** — Chrome-crawl `/resources` (or a named resource id) and extract the real
   per-format `/download` hashes from the rendered anchors / embedded JSON.
2. **Cache** — download into a gitignored `.cache/qulNN/`; never into a tracked path.
3. **Sample & pin** — record schema sample + URL + SHA-256 + **the resource's licence and
   required attribution string** in `PROVENANCE.md`/`SOURCES.md`; emit a **numbers-only**
   `*.probe.json`. No resource is used until its licence + attribution are recorded.
4. **Guardrails (load-bearing)** — ship zero bytes (licence is per-resource; ruler use only);
   **attribution is mandatory** (record it, and surface it via `gate:notices`); it is a
   **probe, never a gate**; layout cross-checks use **V2 (id 10), never V1** (36-page
   divergence); `gate:scripture`/`gate:notext` must stay green. Keep a rubric file next to
   `SKILL.md` (resource-id map, V2/V1 note, licence caution) read at run time.

### Step 6 — provenance, attribution, gates, close-out
`SOURCES.md` entries for resources 10, 73, 4001, 47, 249, metadata set — each with its
**per-resource licence** (public-domain / attribution-required / restricted) and the exact
**attribution string**, plus a note that downloads are open but usage is per-resource. Wire
the attributions through the notices mechanism so `gate:notices` / `gate:license*` cover
them. Run the full gate suite (`make ci`, `pnpm gate:*`); `gate:scripture` / `gate:notext`
must stay green — proof no text/glyph leaked in. Update `docs/map.json` (`make map`) and
`docs/issues.json` if scope opens follow-ups.

**Memory to write on approval** (`.claude/memory/qul-licensing.md`, type `reference`, +1 line
in `MEMORY.md`): QUL downloads are open (`/resources/<type>/<hash>/download`, JSON + SQLite);
licence is **per-resource** (FAQ #3/#9) — some public domain, some attribution-required, some
restricted; commercial use allowed subject to each resource's terms. Determine + record
licence and attribution per resource before use; attribute even for ruler use and the
deep-link. Supersedes the older "login-gated, unstated licence" framing. Link
`[[qul-verse-url-mapping]]`, `[[designs-public-on-site]]`.

## Critical files

- `packages/core/src/quran-meta.ts` — `AYAH_COUNTS`/`OFFSETS`/`toAbsoluteAyah`; metadata
  cross-check target + deep-link source.
- `packages/etl/scripts/probe-hop-recall.mjs` — the probe/ruler pattern to copy (cache →
  numbers → pinned `*.probe.json`).
- `scripts/probe-reference.mjs` — extend with the layout-10 + metadata reconciliation.
- `apps/web/src/assets.ts`, `apps/web/src/components/PageStage.tsx` — word-box geometry the
  feature highlights against.
- `docs/decisions.json` + `docs/decisions/` (`decide` skill); `docs/design/hop-recall.data.json`
  (pin format); `docs/validation/ledger.json` + `scripts/validation-ledger.mjs`.
- `SOURCES.md`, `packages/etl/data/pages/PROVENANCE.md`, `.claude/skills/mushaf-reference/SKILL.md`
  (V2-vs-V1 warning), `.claude/memory/qul-verse-url-mapping.md`.
- **New:** `.claude/skills/leverage-qul/SKILL.md` (+ its rubric file); the notices/licence
  path (`scripts/gate-notices.mjs`, `scripts/gate-license*.mjs`) for attributions.

## Verification

- Step 0: confirm every `.cache/qulNN/` path is gitignored (`git check-ignore`); no QUL
  bytes staged.
- Rulers: run each probe, inspect the pinned `*.probe.json`; `make probe-reference` runs
  clean and reports agreement numbers; `make validate` shows the new ledger entry.
- Deep-link: unit-check `toAbsoluteAyah`→URL for known anchors (1:1→1, 2:1→8); click-through
  in the running app (`run` skill).
- Feature: design page renders on the site at its `docs/design/...` path; interact live;
  golden images for the graduated option; e2e (rebuild `dist` first — see
  `.claude/memory/juz-jump-leaf-alignment.md`).
- Global: `make ci` green, `gate:scripture` + `gate:notext` green (no text/glyph leaked),
  `pnpm gate:decisions` + `make map` green.
