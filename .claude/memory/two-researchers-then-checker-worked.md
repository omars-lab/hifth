---
name: two-researchers-then-checker-worked
description: "The \"two independent researchers, then a checker\" pattern was run for the highlighter texture question on 2026-09-30 (PRs #171, #172 → #173); it caught a snippet-only claim, a dropped claim (FigJam), a real app defect, and a genuine disagreement drawn live"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e85ea537-5f5b-46cb-add4-971a01406e5a
  modified: 2026-10-01T13:10:00.000Z
---

Ran the global "two researchers, then a checker" pattern end to end on 2026-09-30 for the
owner's ask "different shape and texture options ... patches of translucency that compose like a
real highlighter - properly websearch and design this". Two fresh agents in their own worktrees
(branches `highlight-texture-a`/`-b`, PRs #172/#171), then a checker that merged both branches
into `highlight-texture` (PR #173), reopened every load-bearing source, and wrote one page.

**Why it earned its cost:** the checker found a claim both had (FigJam darkens overlaps) that the
page does not actually say, kept Kindle/Apple Books as snippet-only and not relied on, confirmed
B's app-today defect (passage ink notch at every verse number) with a real screenshot, and turned
the one true disagreement (verse alone = one pass vs two) into a live toggle instead of a verdict.

**How to apply:** keep doing this for any outside-sourced question that changes what gets built.
Brief: the checker merges both branches (so the research records ship with the page), reopens
sources, draws both sides of a real disagreement live, registers the decision row + defects, opens
its own PR; the researcher PRs then auto-close as merged. Related:
[[bias-to-demos-over-reading]], [[present-options-with-pros-cons-implications]].

**Second run, 2026-10-01** (moving option pictures, #194/#195 → #196, `docs/design/moving-option-pictures.md`): the checker settled the GIF settings (390 wide, 10 a second, 64 colours, under 1 MB, stills folded under), screenshots over browser video, and a real touch through Chromium's own input. Its verdicts were built straight into the record-demo scripts with no rework, so the pattern held a second time.
