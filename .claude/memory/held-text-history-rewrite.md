---
name: held-text-history-rewrite
description: "how held text in a committed picture was scrubbed from hifth's public history (2026-10-08) — strip by blob id, branches + PR refs still hold it"
metadata:
  node_type: memory
  type: project
  originSessionId: e85ea537-5f5b-46cb-add4-971a01406e5a
  modified: 2026-10-08T23:00:20.071Z
---

On 2026-10-08 the owner approved rewriting hifth's history to remove two app comparison pictures that showed Study Quran text (native-shell.md ⑲). Main went f94a8f1 → bac4da8 via `git filter-repo --strip-blobs-with-ids` in a fresh clone, then a force-push.

**Why:** the new public-build pictures reuse the same file names, so stripping by path would have deleted them too; stripping by blob id kept them and left main's tip tree byte-identical (check `main^{tree}` before and after).

**How to apply:** a rewrite alone does not hide anything on GitHub. Every merged branch still on origin and every `refs/pull/*` copy keeps the old commits. The auto-mode permission check refused `git push origin --delete` of the 134 merged branches, so that step and the GitHub Support purge are the owner's. A backup mirror and the commit map were kept in that session's scratchpad. Related: [[no-held-text-in-pr-bodies]].
