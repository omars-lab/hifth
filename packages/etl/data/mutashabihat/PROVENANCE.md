# mutashabiha_data.json — provenance

- **Source:** https://github.com/Waqar144/Quran_Mutashabihat_Data
- **Commit pin:** `f35f6d5d6e7d07f44e6a652d868b298fcd12e318` (2026-03-09, "Update data")
- **Retrieved:** 2026-07-25, via
  `https://raw.githubusercontent.com/Waqar144/Quran_Mutashabihat_Data/f35f6d5d6e7d07f44e6a652d868b298fcd12e318/mutashabiha_data.json`
- **SHA-256:** `785d5efa266a19c405a449b0a01ebf34fe7dc09836d5b6ef301eae874db780f0`
- **License (README §LICENSE, verbatim — the repo has no LICENSE file):**
  > The data in this project is free to use as you see fit. However, I would
  > appreciate if you mention the use of this project in your app or any other
  > kind of work if you decide to use this data.
- **Attribution plan:** credit the project (and its basis, the work of Qari
  Idrees Al-Asim, رحمه الله) in the app's about/credits surface.
- **Shape:** JSON object keyed by juz "1"–"30"; each entry
  `{ src: { ayah: n | n[] }, muts: [{ ayah: n | n[] }], ctx?: 2 }` where every
  `ayah` is an **absolute ayah number** (1–6236). `ctx` marks entries whose diff
  should show continuation context (maps to DiffView's ctx line).
- **Measured at pin:** 1,344 entries · 2,448 directed edges · all 30 ajzāʾ ·
  ayah range 9–6200 · 43 multi-ayah `src` ranges.
- **Curation stance (README):** deliberately *not* exhaustive — "most common
  mutashabihas that confuse huffaz", based on Qari Idrees Al-Asim's work + the
  author's own hifz. Matches PLAN §10's non-goal (curated hifz sets, not
  exhaustive phrase matching).
- **Immutability:** bytes are vendored verbatim and never edited; refresh =
  re-pin a newer commit and update this file.
