---
date: 2026-11-11
repo: hifth
session: ipad-screenshot-feedback-capture
branch: walk-feedback-capture, PR #601
folded: 2026-11-19
---

## Snags
- `~/.claude/skills/cloudflare-onboarding/scripts/env-set.sh`: on the laptop's bare Node (v18) it wrote the plain `.env` and only then refused to encrypt, leaving the committed copy behind. It now checks Node first; test in `tests/env-set.test.sh`.
  - Landed: belongs to another place (the laptop's own skills folder, `cloudflare-onboarding`), where it is held by its test `scripts/tests/env-set.test.sh`. This repo's `scripts/env/` holds a copy. Marked only.
- `cf-zone-check.py` said "done" for a token that could see hifth.app but was refused its DNS records. It now reads the records and names the missing permission; tests 9 and 10 in `tests/cf-zone-check.test.sh`.
  - Landed: belongs to the same place, held by its test `scripts/tests/cf-zone-check.test.sh` there; this repo's `scripts/env/cf-zone-check.py` is the same file. Marked only.
- `credential-walkthrough/recipes.md`: still unknown whether the dashboard says "Edit" or "Write" for the DNS permission; nobody read the real wording back.
  - Landed: the owner's. Only someone looking at the real Cloudflare page can say; the recipe (in the laptop's own skills folder) still marks the word as unconfirmed.
- Every `make` here needs the Node 22 PATH in front; forgetting it once is what exposed the half-done save.
  - Landed: already in run-app ("The PATH gotcha") and testing ("Running them").
- Root `Makefile`, `make feature-links`: a switch named `SHOTS=1` was always on, because `native/Makefile.native` (included) sets `SHOTS` to a folder. Before naming a new make switch, grep both Makefiles for it; now `PICTURES=1`, with a test that a plain run takes no pictures.
  - Landed: extend, "Traps" (search both Makefiles first); the switch itself is held by a test: `.claude/skills/walk-app/scripts/feature-links.test.mjs`.
- `.claude/skills/walk-app/scripts/feature-links.test.mjs`: an Arabic-range regex typed as raw characters included an invisible one (U+FEFF) and eslint refused it at commit; the Edit tool turns `\u` escapes back into raw characters, so `/\p{Script=Arabic}/u` is the form that survives.
  - Landed: testing, under "Unit tests".

## Worth copying
- Owner puts a secret on the clipboard, Claude pipes `pbpaste` straight into `make env-set NAME=…`: the value never appears in chat or on a command line, and every check after prints only counts and yes/no.
  - Landed: the owner's. The secrets skill says saving a value is the owner's own job, at a hidden prompt in their own terminal; this way has Claude run the save, so it is left for the owner to allow or not, and not written into the skill.
- Handing a whole area (hifth.app, the landing page) to another session with one self-contained message, then merging early because that session was waiting, instead of holding it for the feature it was meant to ride with.
  - Landed: already in the repo's `CLAUDE.md` ("a fix someone is waiting on still merges alone").
