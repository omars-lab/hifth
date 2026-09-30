---
name: review-md-vault-and-hook
description: docs/ is an Obsidian vault (since 2026-09-30) with BRAT + review-md; the review-md Claude Code plugin is installed at user scope; a SessionStart hook / `make reviews` prints threads waiting on claude
metadata:
  type: project
---

Set up 2026-09-30 after the owner asked "did we download and install omars-lab/review-md with
BRAT? and properly set it up? and review its skills to see how we can monitor comments/updates
on our design files". Before that the Claude Code plugin sat in the cache uninstalled, and
`hifth/docs` was not a vault (Obsidian only knew the earlbear wiki and 3d-models/docs).

- **Vault:** `docs/` is registered in Obsidian as vault `docs`; `docs/.obsidian/` commits only
  app.json, community-plugins.json, and the two plugins' data.json (same gitignore as
  3d-models/docs). Plugin code is local; BRAT reinstalls review-md on a fresh clone.
- **Claude Code plugin:** `review-md@review-md` (marketplace omars-lab/review-md), user scope.
  Its `reviews` CLI lives at `~/.claude/plugins/cache/review-md/review-md/<ver>/bin/reviews`.
- **Monitoring:** `scripts/hook-reviews.mjs` runs at SessionStart and prints open threads where
  someone other than claude spoke last (silent when none); `make reviews` is the same by hand,
  `make reviews-all` lists every open thread with obsidian:// links. Comment threads live in
  git-tracked `.<doc>.comments.md` sidecars, so a fresh clone can read them; replies go through
  `reviews reply … --author claude`, which needs Obsidian open on the vault.

**How to apply:** when the hook prints threads, act on each and reply on the thread; never edit
a sidecar by hand; never resolve for the reviewer. Related: [[designs-public-on-site]],
[[backlog-is-the-only-record]].
