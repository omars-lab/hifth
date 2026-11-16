---
date: 2026-11-15
repo: hifth
session: hifth.app front page and its safety
branch: hifth-app-next, PR #631; hifth-app-read-csp
folded: no
---

## Snags
- Commit hook labels: committing with a trimmed `PATH` (only node and the system folders) skipped the `intent` labelling hook without an error, so the commit had no task lines. Committing with Node 22 put in front of the normal `PATH` fixed it. The hook should say when it cannot run rather than stay silent.
- Merging main into a feature branch left conflicts only on the count and fingerprint lines of `docs/backlog.md`, `docs/issues.md` and `docs/waiting-on-you.md`, while `docs/issues.json` merged cleanly. The fix was to rebuild them with `make issues-doc tasks-doc` and diff against main to prove only this branch's own rows changed. The CLAUDE.md rule against regenerating a conflicted file has no clause for generated pages; one would save the next session from second-guessing.
- `scripts/gate-issues.mjs`: a fixed backlog row needs its design page item headed **fixed**, not **answered**. The `issues` skill could say which word goes with which status, so a closing edit passes the first time.
- The chrome-devtools tools cannot write screenshots to the session's scratch folder ("not within workspace roots"). Use inline screenshots, or curl for headers.

## Worth copying
- Serving the exact release folder with `wrangler pages dev` and reading each page's headers with curl showed which pages Cloudflare adds `_headers` to (not the server code's answers), which no reading of the docs had settled.
- For a page script whose words change with every build, a gap in `_headers` that the release fills with the script's fingerprint, plus a release check that refuses the gap left unfilled, kept `unsafe-inline` out without hand-copying a hash.
