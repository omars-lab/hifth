---
name: qpc-v4-font-is-per-page
description: The QPC V4 word font is one file per page (pN.ttf, codepoints FC41+ per page); QUL resource 240 is the per-page pack (tajweed colours), 462 "KFGQPC Nastaleeq" is a general text face that draws the wrong ligatures
metadata:
  type: project
---

The store's QPC V4 word text is a run of private codepoints per page (page 1: U+FC41…U+FC64, one
per printed word, in order). Only that page's own font file, `pN.ttf`, maps the run to the words;
a general Arabic face (including QUL 462 "KFGQPC Nastaleeq", fetched by mistake 2026-09-08) shows
the block's official two-letter ligatures instead. Sources: QUL resource 240 "QPC V4 Tajweed Font
(Page by Page)" — 69 MB zip, 604 files, cached at
`packages/etl/data/qul/.cache/qul-fonts/qpc-v4-tajweed/` (gitignored); plain black cut only on
`https://static.qurancdn.com/fonts/quran/hafs/v4/ttf/pN.ttf` (47–150 KB each).

**Why:** cost a whole detour; the record is in docs/issues/qul-diff-render-needs-font.md.

**How to apply:** any renderer of store words declares one @font-face per page and serves
`/dev-fixtures/fonts/pN.ttf` (dev only, never the bundle). See [[qul-signed-in-download-permission]],
[[qul-licensing]].
