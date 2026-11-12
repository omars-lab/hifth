---
date: 2026-11-11
repo: hifth
session: ipad-screenshot-feedback-capture
branch: walk-feedback-capture, PR #601
folded: no
---

## Snags
- `~/.claude/skills/cloudflare-onboarding/scripts/env-set.sh`: on the laptop's bare Node (v18) it wrote the plain `.env` and only then refused to encrypt, leaving the committed copy behind. It now checks Node first; test in `tests/env-set.test.sh`.
- `cf-zone-check.py` said "done" for a token that could see hifth.app but was refused its DNS records. It now reads the records and names the missing permission; tests 9 and 10 in `tests/cf-zone-check.test.sh`.
- `credential-walkthrough/recipes.md`: still unknown whether the dashboard says "Edit" or "Write" for the DNS permission; nobody read the real wording back.
- Every `make` here needs the Node 22 PATH in front; forgetting it once is what exposed the half-done save.
- Root `Makefile`, `make feature-links`: a switch named `SHOTS=1` was always on, because `native/Makefile.native` (included) sets `SHOTS` to a folder. Before naming a new make switch, grep both Makefiles for it; now `PICTURES=1`, with a test that a plain run takes no pictures.
- `.claude/skills/walk-app/scripts/feature-links.test.mjs`: an Arabic-range regex typed as raw characters included an invisible one (U+FEFF) and eslint refused it at commit; the Edit tool turns `\u` escapes back into raw characters, so `/\p{Script=Arabic}/u` is the form that survives.

## Worth copying
- Owner puts a secret on the clipboard, Claude pipes `pbpaste` straight into `make env-set NAME=…`: the value never appears in chat or on a command line, and every check after prints only counts and yes/no.
- Handing a whole area (hifth.app, the landing page) to another session with one self-contained message, then merging early because that session was waiting, instead of holding it for the feature it was meant to ride with.
