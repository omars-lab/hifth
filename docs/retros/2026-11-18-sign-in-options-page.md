---
date: 2026-11-18
repo: hifth
session: app store launch, sign-in choices
branch: sign-in-choices
folded: no
---

## Snags
- `scripts/stage-docs.mjs`: a built page that is not committed yet still fails the before-push check of whatever branch is being pushed from the same folder. An untracked options page with one bad link stopped the push of an unrelated branch. Build new pages only after the other branch is pushed, or check their links first.
- `scripts/gate-decisions.mjs`: an option label with a mixed-case product name is refused as "names a symbol". Say what the thing is in plain words in the label.
- `scripts/gate-issues.mjs`: a section heading in a design note must end with one status word in bold, and marking a question answered also means updating every backlog row that waits on it. The check says which rows.
- `scripts/build-design-note.mjs`: hiding every empty heading cell shifted a table's headings one column left when its first heading was blank. Now only a heading row blank all the way across is hidden, and `scripts/build-design-note.test.mjs` checks every built page in Chrome and Firefox. A Mermaid drawing with no lines lays its boxes out in a jumble; chain them with `~~~` to keep their order.

## Worth copying
- `scripts/build-design-note.mjs`: one Markdown note with Mermaid blocks becomes the served page, drawn at build time, so the note and the page cannot disagree. Lines that move show what happens at each step, a thick line is the reader's marks, a dotted line is a step that does not happen.

## Didn't work
- Styling Mermaid's lines from the page's CSS without `!important`: Mermaid writes the dash pattern inline, so the rule was ignored and the lines did not move.
