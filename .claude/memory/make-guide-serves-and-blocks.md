---
name: make-guide-serves-and-blocks
description: "hifth `make guide` regenerates guide.html THEN starts a blocking server on :4174 — it never returns on its own"
metadata: 
  node_type: memory
  type: reference
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-21T15:28:12.291Z
---

In the hifth repo, `make guide` does two things: it renders `docs/validation/guide.html`
from `docs/validation/ledger.json` (prints `guide → docs/validation/guide.html (N checks,
ledger <hash>)` on line 1), **then** starts a static server on `http://<lan-ip>:4174` and
**blocks** ("Ctrl-C to stop"). A backgrounded `make guide` therefore shows empty output and
looks hung — it isn't, the file is already written; it's serving.

**How to apply:** to regenerate the guide non-interactively, run `make guide` in the
background, wait for line 1 to confirm the file wrote (or just confirm `git diff --stat
docs/validation/guide.html` is small), then `TaskStop` the shell. Don't wait for it to
return. After editing the ledger, regenerate the guide and run `pnpm gate:validation`
(ledger well-formedness + guide freshness). Related: [[hifth-app-identity]].
