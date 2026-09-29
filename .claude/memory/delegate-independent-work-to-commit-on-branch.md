---
name: delegate-independent-work-to-commit-on-branch
description: owner wants independent backlog items carved out and handed to subagents that commit directly to the working branch; carve by disjoint file-set because agents share one worktree
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-23T04:34:34.158Z
---

When the main thread's task is committed and the tree is clean, the owner wants me to
**carve out independent backlog work and give it to a subagent that commits to our branch** —
not to sit idle or ask what to do next. (Omar, 2026-09-22, right after "commit as needed":
"also carve out independent work and give to sub agent to commit to our branch".)

**Why:** the owner's throughput is the bottleneck; parallel delegated commits on the same branch
move the backlog while the main thread reports and reviews.

**How to apply:**
- Carve by **disjoint file-set**, not by task count. Two tasks that touch the same files
  (same grader scripts, same `docs/issues.json` rows, same design doc) go to ONE agent in
  sequence with one commit each — two agents in one worktree would collide on the index and
  the shared files. State that reasoning in one line when handing off.
- Prefer a fresh `general-purpose` agent when the work is unrelated to the main thread's
  context (the context is huge and none of it helps); put the repo discipline in the brief
  explicitly: confirm branch, stage by name, never `git add -A`, never stage
  `docs/design/knowledge-graph-commentary.md` or `.claude/` or `apps/web/public/assets/private/`,
  attribution lines, no push/PR, no `--no-verify`.
- Pick work the agent can *finish*: code-shaped closers with a named test and a register row to
  flip (e.g. #125/#126 from `docs/design/robust-validation.md`). Skip items that need the
  owner's shape decision (#15, #69) or a human sitting (#128).
- Commit the main thread's own work FIRST so the tree is clean before the agent starts.

Related: [[decisions-must-be-recorded-at-the-source]] (commit the decision the same turn),
[[bias-to-demos-over-reading]].
