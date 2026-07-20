# Linker (رابط) — Knowledge-Graph Mushaf Navigator for Huffaz
*(Arabic name رابط; English name is its translation, "Linker" — not a transliteration.)*
## Implementation Specification v0.9

**Identity:** A pure navigation instrument. Select an ayah on a real mushaf SVG page → see typed hop links → jump. No reader features (audio, translation, tafsir reading). The knowledge graph is the routing table; the page is the interface.

---

## 1. Canonical identity scheme

All layers speak one key grammar. Keys are URI-style, edition-scoped, future-proofed for non-Quran nodes.

```
node-key    := corpus "/" edition-or-collection "/" locator [ "#" fragment ]

quran/hafs-kfqc/2:255            an ayah in a specific mushaf edition
quran/hafs-kfqc/2:255#w3-7       words 3–7 of that ayah (1-based, mushaf word order)
quran/hafs-kfqc/p9               a physical page
root/ktb                          a triliteral root node (Buckwalter-ish slug)
lemma/kitAb                       a lemma node
hadith/bukhari/1234              RESERVED — future edge targets
tafsir/tabari/2:255              RESERVED
lexicon/lisan/ktb                RESERVED
```

Rules:
- **Edition is part of every Quran key.** Ayah numbering and pagination differ across qiraat/editions; keys never travel without their edition.
- Cross-edition resolution goes through a `concordance` table (edition-A ayah ↔ edition-B ayah), never by assuming index equality.
- Word indices are *mushaf visual order* (RTL serialization) per the asset's own word groups.

---

## 2. Layer contract

```
┌────────────────────────────────────────────────┐
│  L3  Navigation controller + KG (adjacency)    │   speaks: node-keys, edge types
├────────────────────────────────────────────────┤
│  L2  HIGHLIGHTER (the intermediary)            │   translates keys ⇄ SVG element IDs
├────────────────────────────────────────────────┤
│  L1  Immutable SVG assets + their metadata     │   never modified; styled at runtime
└────────────────────────────────────────────────┘
```

- L1 assets are used **as shipped** (e.g. quranpedia/quran-svg pages with built-in
  `path.ayahPolygon[surah][ayah][number]` hit layers; or MushafDatabase ligature corpus
  for word/ligature granularity). All visual state = runtime CSS classes + an injected
  overlay `<g id="rabit-overlay">`. Nothing is written back to asset files.
- L3 never touches the DOM of a page. L2 never sees edge semantics.

---

## 3. Highlighter API (L2)

```ts
type Target = { key: string }                    // canonical node-key
type Resolved = { page: number; elementIds: string[]; bbox: Rect; markerXY?: Point }

interface Highlighter {
  // --- resolution ---
  resolve(t: Target): Resolved | null            // via resolver tables (see §4)

  // --- state, grouped so independent concerns never clobber each other ---
  highlight(t: Target, style: StyleToken, group: GroupId): void
  clear(group: GroupId): void                    // groups: 'selection' | 'phrase'
                                                 //         'breadcrumb' | 'preview' | ...

  // --- navigation ---
  navigateTo(t: Target, opts?: { pulse?: boolean; zoom?: number }): Promise<void>
      // loads page if needed, pans/zooms to bbox, optional pulse animation

  // --- global skin ---
  setSkin(skin: 'plain' | 'tajweed'): void       // stylesheet swap only; geometry untouched

  // --- events out (the ONLY way L3 learns about user input on the page) ---
  onSelect(cb: (key: string, granularity: 'ayah' | 'word') => void): void
  onRangeSelect(cb: (keys: string[], releasePoint: Point) => void): void
      // drag-highlight gesture: pen-down ON text starts a marquee; pen-down on
      // margins/mat pans. Release fires with every ayah/word key intersected.
  serializeState(): ViewState                    // for share links (§7)
  restoreState(s: ViewState): Promise<void>
}
```

Implementation notes:
- Glyph paths get `pointer-events: none`; polygons receive all hits (per asset README).
- Word-granularity events require the word-level corpus; with ayah-polygon assets the
  highlighter reports `granularity:'ayah'` and word-span highlights fall back to an
  overlay rect computed from line metadata.
- Pulse = CSS keyframe on `fill-opacity`; respects `prefers-reduced-motion`.

---

## 4. Resolver tables (built in ETL from asset metadata — never hand-made)

```sql
-- one row per ayah per edition
anchor_ayah(edition, surah, ayah,
            page, element_id,          -- e.g. 'verse-48' in the page SVG
            marker_x, marker_y,        -- medallion centre (asset markers.json)
            bbox_x, bbox_y, bbox_w, bbox_h)

-- only for word-granular assets
anchor_word(edition, surah, ayah, word_idx,
            page, element_id,          -- e.g. 'md-word-...' group id
            bbox_x, bbox_y, bbox_w, bbox_h)

-- cross-edition ayah concordance
concordance(edition_a, key_a, edition_b, key_b)
```

Source of truth per asset family:
- quranpedia: per-page polygon JSON + `markers.json` + polygon attrs in the SVG itself.
- MushafDatabase: `md-word` / line groups + `data-*` attributes.
- QUL Mushaf-layout SQLite (pages/words tables) as an independent cross-check.

---

## 5. Edge-type registry (drives the hop rail; data-driven, additive-only)

```json
{
  "edgeTypes": [
    { "id": "mutashabih",      "label": "Similar wording", "icon": "↻/◀/▶",
      "status": "active",   "sources": ["waqar144-mutashabihat", "qul-phrases"] },
    { "id": "related-meaning", "label": "Related meaning",  "icon": "≈",
      "status": "active",   "sources": ["qursim"], "visualWeight": "secondary" },
    { "id": "shared-root",     "label": "Same root",        "icon": "⬡",
      "status": "active",   "sources": ["quranic-arabic-corpus", "qul-morphology"] },

    { "id": "hadith-citation", "label": "Cited in hadith",  "icon": "⚭",
      "status": "reserved", "plannedSources": ["quran.com-api", "semantic-hadith"] },
    { "id": "tafsir-ref",      "label": "Tafsir cross-ref", "icon": "✎",
      "status": "reserved", "plannedSources": ["semantic-tafsir"] },
    { "id": "lexicon-entry",   "label": "Dictionary entry", "icon": "📖",
      "status": "reserved", "plannedSources": ["lane", "lisan-al-arab"] }
  ]
}
```

- `reserved` types render nothing (or a grayed row in settings). Activating one later
  is a data drop + `status` flip — zero UI/highlighter changes.
- Per-ayah adjacency ships an `ext: []` array from day one for reserved-type edges.

---

## 6. Adjacency data (static JSON, sharded by surah)

```json
// adj/hafs-kfqc/002.json  → keyed by ayah
{
  "48": {
    "edges": [
      { "type": "mutashabih",
        "to": "quran/hafs-kfqc/2:123",
        "span":   { "from": [6, 14] },        // word range on source ayah
        "toSpan": { "from": [6, 13] },
        "dir": { "dSurah": 0, "dPage": 10, "sameJuz": true },
        "src": "waqar144", "ctx": 0 },
      { "type": "shared-root", "root": "root/Skr",
        "to": "quran/hafs-kfqc/2:122#w4", "dir": { "dSurah": 0, "dPage": 12 } }
    ],
    "ext": []
  }
}
```

- `dir` is precomputed at ETL time; the hop rail buckets edges by
  `dSurah < 0` (◀ earlier surahs), `> 0` (▶ later), `= 0` (↻ same surah), plus a
  same-page/juz refinement.
- Popover ordering for huffaz: same page → same juz → earlier surahs → later surahs.
- `root index` is its own shard family: `roots/Skr.json → [ { key, word_idx, page } ]`
  with lemma sub-grouping (`same lemma` edges rank above `same root, other lemma`).

---

## 7. Anchor-link grammar (hash routing; static-host friendly)

```
#/<edition>/<surah>:<ayah>                         select + navigate
#/<edition>/<surah>:<ayah>?w=3-7                   word-span pulse
#/<edition>/2:47-2:48                              highlighted ayah range
#/<edition>/2:255?w=3-7&skin=tajweed               with skin
#/<edition>/2:123?via=2:48                         hop context (breadcrumb restored)
#/<edition>/2:123?trail=2:40,2:47,2:122            full hop chain (shareable drill)
```

- Share = `highlighter.serializeState()` → string. Open = parse → `restoreState()`.
  Same code path as a live hop (no separate deep-link logic to drift).
- If the recipient's default edition differs: resolve through `concordance`, show a
  one-line "viewing in <edition>; switch?" affordance.

---

## 8. Tajweed skin (runtime, no new assets)

ETL pass, offline:
1. Take rule annotations from the quran.com `tajweed` project (madani scheme)
   — rule spans over text positions per ayah.
2. Map text positions → asset element IDs (ligature/word groups) using the
   resolver's word tables → emit `skins/tajweed/<page>.json`:
   `{ "md-lig-00412": "tj-madd", "md-lig-00413": "tj-ghunnah", ... }`
3. Runtime `setSkin('tajweed')` = add classes from that map + attach one stylesheet.
   `setSkin('plain')` = remove. Geometry, polygons, hop anchors: identical in both.

Palette classes: `tj-madd` (red family), `tj-ghunnah` (green), `tj-qalqalah` (blue),
`tj-ikhfa` , `tj-silent` (gray) — user-tunable; color-blind alt palette ships in v1.

---

## 9. Memorization-specific UI rules

- **Hop rail appears automatically on every selection.** Surfacing links IS the product.
- **Drag-to-highlight → hop menu.** Dragging across the text highlights a passage
  (highlighter-pen style, its own group so it never clobbers selection/breadcrumbs)
  and releases into a compact context menu at the pen-up point:
  *Hop to similar verses (merged, deduped edges of every highlighted ayah/word)* ·
  *Root lens* · *Copy anchor link (range form)* · *Clear*. On word-granular assets the
  same gesture yields word-span keys, so a highlighted half-ayah hops on exactly that
  phrase.
- **Hop affordance is a leaping arc-arrow**, used consistently: rail chips (mirrored
  for earlier-surah direction, closed loop for same-surah), menu items, and every
  "Hop there" action. One glyph = the app's single verb.
- Diff popover is mandatory for `mutashabih` edges: token-level diff of the two texts,
  differing tokens color-coded; identical twins labelled "identical — context differs".
- `ctx` flag on an edge ⇒ popover shows the following ayah's opening (the standard
  hifz disambiguator: "which continuation belongs here?").
- Breadcrumb trail renders as a persistent bead strip; every bead is a back-hop.
  A trail is serializable (§7) → a teacher can send a confusion-cluster walk as a URL.
- Direction glyphs always visible on chips with counts: `↻ 3` `◀ 1` `▶ 2` `⬡ 12`.

---

## 10. ETL pipeline (all offline, output = static files)

```
assets in (unmodified) ─┐
                        ├─ extract → resolver tables (§4)
mutashabihat (hifz-curated + QUL phrase ranges)
QurSim pairs (weighted)          ├─ normalize to canonical keys
corpus morphology (root/lemma)   ├─ compute dir annotations
tajweed rule spans               ├─ emit: adj/*  roots/*  skins/*  registry.json
                        └─ validate: every edge endpoint resolves in anchor tables
                                     every polygon id in SVG exists in anchor tables
```

Licensing gate in CI: each dataset carries its license note; build fails if a source
is added without one. (QUL permits commercial use but terms vary per resource.)

---

## 11. Build phases

| Phase | Scope | Exit criterion |
|---|---|---|
| 1 | Asset audit + resolver ETL | every ayah key resolves to page+element on chosen edition |
| 2 | Hop-edge ETL (mutashabih, phrases, QurSim, roots) + dir annotations | adjacency shards validate 100% |
| 3 | Highlighter module + headless test harness | scripted hop tour runs green |
| 4 | Navigation UI: stage, hop rail, diff popovers, bead trail, share links, skin toggle | core loop usable one-handed |
| 5 | Hifz polish: popover ordering, ctx continuations, keyboard/gesture nav | revision session friction-tested with huffaz |
| 6 | Reserved edges go live (hadith/tafsir/lexicon) | data drop + registry flip only |

## 12. Non-goals (v1)
Audio, translations, tafsir reading, quizzes, user accounts, server backend,
editing/creating SVG assets, exhaustive phrase matching beyond curated hifz sets.
