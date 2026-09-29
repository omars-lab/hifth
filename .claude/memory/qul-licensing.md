---
name: qul-licensing
description: "QUL (qul.tarteel.ai) /download is login-gated but resolves to a public S3 object; licence is per-resource — determine and attribute case-by-case before use"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2d06a126-c11f-4081-bd4d-6a82cacfbae2
  modified: 2026-09-21T02:34:07.992Z
---

**Download mechanism (verified 2026-09-03, corrects an earlier wrong note that said
"downloads are open, not login-gated"):** each resource page exposes
`https://qul.tarteel.ai/resources/<type>/<hash>/download` links (one hash per format, JSON /
SQLite / DOCX / font; hashes are JS-rendered — extract them from the page's anchors via
Claude-in-Chrome). That `/download` endpoint **is session-gated**: an unauthenticated `curl`
gets a 37 KB HTML sign-in page, not the data. When the browser session is **logged in**, the
endpoint **302-redirects to a public Wasabi S3 object**
(`https://s3.us-east-1.wasabisys.com/static-cdn.tarteel.ai/qul-exports/<type>/<ts>-<id>-<name>.zip`),
and that S3 object needs no auth — once you have the resolved URL you can `curl` it directly.
So the working recipe is: from a logged-in `qul.tarteel.ai` tab, `fetch(<download-url>,
{method:'HEAD'})` and read `r.url` to get the S3 URL, then `curl` the S3 URL into a gitignored
cache. A plain anchor click also works (downloads to `~/Downloads`) but only for links whose
native markup carries `target="_blank"`; a JS-forced `_blank` click is popup-blocked. Every
export arrives as a **ZIP** (even `*.json.bz2`-named ones are really ZIPs).

Licence is **per-resource, not a blanket grant** (QUL FAQ #3 and #9, <https://qul.tarteel.ai/faq#faq-9>): some resources are
public domain, some require attribution, some restrict use; commercial use is permitted
*subject to each resource's own terms*. So the correct posture is a **per-resource licence
determination + proper attribution recorded before use** — not a global "forbidden," and
not "unstated/login-gated" either. This supersedes the older framing in
[[qul-verse-url-mapping]] and SOURCES.md that treated QUL as uniformly login-gated with an
unstated licence.

Attribution applies **even when we ship zero bytes** (ruler/probe use and the `/cms/verses`
deep-link): record each used resource's licence + exact attribution string in `SOURCES.md`
and surface it through the notices mechanism (`gate:notices` / `gate:license*`). The repo's
standing decision was ruler + deep-link only (ship no QUL Quran text/glyphs/fonts — see
[[designs-public-on-site]] and the "no Quran text in the tree" tenet). **As of 2026-09-07 the
owner reopened that decision** (`qul-reliance`) to hold a copy of QUL page-positions + word
text in a hosted database we control (off-repo, off-build), on branch `qul-etl-supabase` off
`qul-integration` — so the per-resource licence check for QPC V2 layout (id 10) + its glyph
font is now **owed, not deferred**. FAQ #9 confirms commercial use is allowed but only
*subject to each resource's own terms*, and QUL states no blanket attribution rule.

**Per-resource verdicts for the DEV held copy (read 2026-09-08; the held copy is V4:
layout id 21 + word text id 47 + fonts 457/462 + QAC morphology — NOT V2/id10, that
stale note above predates qul-store-purpose):**
- **DigitalKhatt 15-line layout (id 21)** — SIL **Open Font License 1.1**. Copy/hold freely,
  attribution + reserved-name rule. We hold numbers only. → clear to hold.
- **Quranic Arabic Corpus morphology (root/lemma/stem)** — **GNU GPL**. Copyleft attaches on
  *distribution*, not on holding a private copy tools read. A dev copy that ships nothing is
  unencumbered beyond attribution (already in SOURCES.md). → clear for dev; if grammar-derived
  bytes ever ship, GPL share-alike attaches then.
- **QPC V4 word text (id 47) + surah-name font (id 457) + Nastaleeq font (id 462)** — all
  **KFGQPC (King Fahd Complex)** property, and there are **TWO conflicting licence texts** under
  the Complex's name: a permissive one ("Use, Copy, Distribute" free; no sell/modify/reverse-eng
  — held copy OK) and a restrictive one ("may not be reproduced [or] modified without express
  written approval" — held copy needs written permission). Which binds depends on the exact
  licence bundled with the specific QUL resource. **CLEARED: the owner verified per item and
  cleared all three to hold in the dev store on 2026-09-08.** This was the one thing the held copy
  waited on; it is lifted.

Findings banked in `docs/decisions/qul-store-purpose.md` (trailer, 2026-09-08); ledger check
`qul-held-copy-licensed-and-offbundle` is **done** (verified 2026-09-08). The only remaining
owner-owed step is the signed-in store-boundary confirmation, re-checked after each hold — it does
not gate the licence clearance. See [[qul-etl-plugin-tenet]].

**Owner stance, 2026-09-20 ("qul allows open access, remember this"):** for the pitch/POC work
the owner treats QUL as openly accessible — proceed to use QUL resources (e.g. the audio CDN for
the per-verse play button, task #67) without waiting on a per-item access gate. This is a green
light on *access*, not a licence to drop attribution: keep the per-resource attribution posture
above (record in `SOURCES.md`, surface via the notices gates). See [[qul-signed-in-download-permission]]
and [[poc-for-study-quran-team]].
