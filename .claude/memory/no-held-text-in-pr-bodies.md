---
name: no-held-text-in-pr-bodies
description: "never quote Study Quran translation or commentary in commit messages or PR bodies; describe the change, not the text"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-27T02:43:18.172Z
---

Commit messages and PR descriptions are public on GitHub, so they must never quote the held Study Quran text: no translation lines, no commentary, not even a short sample from an eye check. Describe what changed ("each card shows the start of the target verse's translation") instead.

**Why:** 2026-09-26, PR #109. A PR body that quoted two translation lines was blocked by the permission check. The owner then gave explicit permission to push, and the PR was opened with no quotes.

**How to apply:** keep eye-check quotes in chat or private notes only. Before any `gh pr create` or commit, scan the text for held content. Related: [[poc-for-study-quran-team]].
