# The QUL resource rubric

The per-resource table the `leverage-qul` skill reads at run time, and the one the
validation check `qul-rulers-terms-and-text-free` keeps honest. It answers two questions
for every QUL resource this repo leans on:

1. **Is the export text-bearing?** — does the file we cache and measure against contain
   any Qur'an text or glyphs, or only numbers, ids and verse keys? A text-bearing export
   is off-limits to the probe: reading one as a ruler is exactly the boundary
   `qul-reliance` forbids. This column is settled by *opening the cached file and
   looking*, not by trusting a name.
2. **What licence and attribution does it owe?** — QUL states terms **per resource**
   (their FAQ #3/#9), so this cannot be filled in from a site-wide grant. It is read off
   *that resource's own page*, signed in, by a human — the ledger check
   `qul-rulers-terms-and-text-free`. Until that read happens for a resource, its licence
   here says **PENDING**, and PENDING means *not yet confirmed*, not *assumed fine*.

Sharpen this file as resources are read; the skill body does not change when the rubric
does.

## The resources

| id | resource | export shape (looked at) | text-bearing? | licence / attribution |
|---|---|---|---|---|
| **10** | KFGQPC QCF V2 (1421H) page layout | SQLite: `pages` rows of `page_number`, `line_number`, `line_type`, `surah_number`, `first/last_word_id`; `info` table of counts | **No** — ids, line types and counts. The word *ids* are numbers, not glyphs. | **PENDING** — read resource 10's page on qul.tarteel.ai. It is the V2 layout authority (`mushaf-reference` names it); confirm its terms permit ruler use + our page fingerprinting. |
| **73** | phrase-level similarity | JSON: `phrases.json` = phrase_id → `{ ayah: { verse_key: [[from,to]] } }`; `phrase_verses.json` = the verses each phrase spans | **No** — verse keys and word-index ranges (`[from,to]` integers). No phrase *text*. | **PENDING** — read resource 73's page. |
| **74** | ayah-level similarity (whole-verse look-alikes) | JSON: verse_key → `[{ matched_ayah_key, score, coverage, matched_words_count, match_words }]` | **No** — verse keys and match scores/counts. `match_words` is index ranges, **not** text — and coarser than our print's word count, so it must not drive per-word rendering. | **PENDING** — read resource 74's page. This is the corpus behind the open `similar-ayah-enrichment` decision. |
| — | juz metadata | JSON: `"1": { first_verse_key, verses_count, ... }` | **No** — verse keys and counts. | **PENDING** — read the metadata resource's page. |

## How to fill a PENDING row

Follow the ledger runbook `qul-rulers-terms-and-text-free` (owner: user):

1. Signed in to qul.tarteel.ai, open the resource's page and read the licence and the
   attribution it asks for. If the page forbids the use we make of it, **stop the probe
   reading that resource** and record why here and in `docs/decisions/qul-reliance.md`.
2. Write the resource's licence + attribution into `SOURCES.md` verbatim, and update this
   row from PENDING to the licence name + a pointer to the SOURCES.md entry.
3. Open two or three of the cached files the probe pin lists under `reads` and confirm by
   eye they hold numbers/verse-keys only — no Arabic script, no glyph blobs. If any file
   carries a text column, flip its **text-bearing?** to **Yes** here, and the probe must
   stop reading it.
4. Bank the round: `make record CHECK=qul-rulers-terms-and-text-free RESULT='...'`.

## Why "no text" here is not the same as the tree's gates

`gate:scripture` and `gate:notext` prove the *repository* carries no Qur'an text. They
cannot see these exports, because the exports live in a **gitignored** cache the tree
deliberately does not carry. So the text-bearing column is the only place a text-bearing
export is caught before the probe feeds on it — which is why it is settled by eye and
recorded here, not inferred from a green build.
