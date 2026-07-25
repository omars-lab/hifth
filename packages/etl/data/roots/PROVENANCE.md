# quranic-corpus-morphology-0.4.txt — provenance

- **Source:** the [Quranic Arabic Corpus](http://corpus.quran.com) morphology,
  version 0.4 (2011) by Kais Dukes, Language Research Group, University of Leeds.
  Official distribution: <https://corpus.quran.com/download/> (the download form
  asks for a contact e-mail, so it is not a pinnable URL).
- **Vendored via:** <https://github.com/alstat/QuranTree.jl> at commit
  `d7a0fe9c5c7138081aec6683d18e49f9a233d0dd` →
  `https://raw.githubusercontent.com/alstat/QuranTree.jl/d7a0fe9c5c7138081aec6683d18e49f9a233d0dd/data/quranic-corpus-morphology-0.4.txt`,
  retrieved 2026-07-25. Chosen over the email-gated official form purely as a
  **pinnable byte carrier**: QuranTree.jl's own MIT licence covers its Julia
  package, **not** this data — the terms below are the ones that govern.
- **SHA-256:** `a1d12923815341face765083805d2148ed2d9f5cc3f7d6665219d887675d8c46`
  (6,309,503 bytes). Verified byte-identical against a second independent mirror
  (`cltk/arabic_morphology_quranic-corpus@b5abd4d`) and against the file inside
  the official `quranic-corpus-morphology-0.4.zip`; the header block below
  matches the `<pre>` block published on <https://corpus.quran.com/download/>
  word for word.
- **License (the file's own copyright block, verbatim — it is the primary
  source, and the same text is published on the download page):**
  > \#  Quranic Arabic Corpus (morphology, version 0.4)
  > \#  Copyright (C) 2011 Kais Dukes
  > \#  License: GNU General Public License
  > \#
  > \#  The Quranic Arabic Corpus includes syntactic and morphological
  > \#  annotation of the Quran, and builds on the verified Arabic text
  > \#  distributed by the Tanzil project.
  > \#
  > \#  TERMS OF USE:
  > \#
  > \#  - Permission is granted to copy and distribute verbatim copies
  > \#    of this file, but CHANGING IT IS NOT ALLOWED.
  > \#
  > \#  - This annotation can be used in any website or application,
  > \#    provided its source (the Quranic Arabic Corpus) is clearly
  > \#    indicated, and a link is made to http://corpus.quran.com to enable
  > \#    users to keep track of changes.
  > \#
  > \#  - This copyright notice shall be included in all verbatim copies
  > \#    of the text, and shall be reproduced appropriately in all works
  > \#    derived from or containing substantial portion of this file.
  > \#
  > \#  Please check updates at: http://corpus.quran.com/download

  The site footer states, verbatim: *"The Quranic Arabic Corpus is available
  under the GNU public license with terms of use."*, and
  <https://corpus.quran.com/license.jsp> serves the unmodified GPL v3 text.
- **Second notice in the same file (the Arabic text it annotates), verbatim:**
  > \#  Tanzil Quran Text (Uthmani, version 1.0.2)
  > \#  Copyright (C) 2008-2009 Tanzil.info
  > \#  License: Creative Commons BY-ND 3.0 Unported
  > \#
  > \#  - Permission is granted to copy and distribute verbatim copies
  > \#    of this text, but CHANGING IT IS NOT ALLOWED.
  > \#
  > \#  - This quran text can be used in any website or application,
  > \#    provided its source (Tanzil.info) is clearly indicated, and
  > \#    a link is made to http://tanzil.info to enable users to keep
  > \#    track of changes.

  Hifth's shards carry **no Quran text from this file** — only roots, lemmas,
  ayah numbers and page numbers — so the BY-ND text term binds the vendored
  copy here (kept verbatim), not the ETL output.
- **The "CHANGING IT IS NOT ALLOWED" tension (recorded, not resolved):** GPL v3
  §5 grants the right to modify and redistribute; the terms of use forbid
  changing the file. No primary source reconciles the two. Hifth's mitigation
  is to satisfy *both* readings: this file is vendored **verbatim, copyright
  block intact, never edited**, and `build-roots.mjs` derives the shipped
  shards from it at build time. Attribution + a link to corpus.quran.com is
  mandatory under either reading and is honoured in `SOURCES.md`, here, and on
  the RootLens surface in the app.
- **Shape:** tab-separated, one line per morphological **segment**, four
  columns `LOCATION FORM TAG FEATURES`, e.g.
  `(1:1:1:2)\tsomi\tN\tSTEM|POS:N|LEM:{som|ROOT:smw|M|GEN`. `LOCATION` is
  `(surah:ayah:word:segment)`; `ROOT:` and `LEM:` are in the corpus's own
  Buckwalter transliteration (table: <https://corpus.quran.com/java/buckwalter.jsp>,
  transcribed into `build-roots.mjs`). Only STEM segments carry a root.
- **Measured at pin:** 128,219 segments · 77,429 words · **6,236/6,236 ayahs**
  (all 114 surahs) · 49,968 root-tagged segments · **1,642 distinct roots** ·
  4,644 distinct lemmas · 44,431 root↔ayah pairs on 6,214 ayahs. (The 22
  root-less ayahs are the ones made entirely of particles/pronouns and the
  disconnected letters — e.g. 2:1.)
- **Two parsing facts worth knowing** (both handled in `build-roots.mjs`):
  1. A word can carry **two** roots — 20:94's يَبْنَؤُمَّ is one orthographic
     word over two stems (ب ن ي + أ م م). Roots are counted per segment.
  2. 15 lemmas carry a trailing homograph index (`EaSaA2`) separating two
     senses spelled identically; roots never do. The index is dropped, so the
     senses merge under one spelling — which is what a hafiz sees.
- **Immutability:** bytes are vendored verbatim and never edited (PLAN §8 and
  the terms above). Refresh = re-pin a newer release and update this file.
