---
name: qul-signed-in-download-permission
description: Standing permission (2026-09-08) to download QUL resources through the owner's signed-in Chrome without asking each time; if not signed in, ask them to sign in
metadata:
  type: feedback
---

When a QUL (qul.tarteel.ai) resource is login-gated, do not ask permission per download. If the
owner's Chrome session is signed in, browse to the resource and download what the task needs
(into the gitignored ETL cache, never the tree). If it is not signed in, ask the owner to sign in
and continue. Owner's words, 2026-09-08: "im signed in, browse and download what you need, don't
ask for this permission next time, if im signed in, use it, if not, ask me to sign in."

**Why:** the `leverage-qul` skill's guardrail #3 ("ask before downloading") was costing a round
trip on every gated file; the owner wants the licence read to be the gate, not the click. Licence
cover for the held copy is already recorded (ledger check `qul-held-copy-licensed-and-offbundle`).

**How to apply:** prefer reading the download's redirected address in-browser (fetch with
credentials, read `response.url`) and then `curl` it, so the file lands in the cache and not in
~/Downloads. Still name what was fetched (resource id, URL, size, sha) in the session and in the
ETL's SOURCES record. See [[qul-licensing]] and [[qul-etl-plugin-tenet]].
