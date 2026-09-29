---
name: short-first-guides-mermaid
description: "pages the owner works from lead with a short version (question, need, time, one line per step), full detail folded; processes with order/branches are Mermaid diagrams drawn to SVG at build time"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c8c77742-fa0c-48ea-9c25-4e720245832a
  modified: 2026-09-28T18:42:23.388Z
---

On 2026-09-28 the owner called the checks guide "a huge wall of text" and asked for "a simple guide … where we still cover everything but with minimalistic, proper explanation", with "mermaid diagrams as needed" for processes.

**Why:** a page that holds every reason at the same volume can't be worked from. The detail still matters, so it gets folded away, not cut.
**How to apply:**
- Lead with the question, what you need, how long, when it is done, and one short line per step. Fold the rest.
- Where order or a fork matters, draw a Mermaid flowchart. Don't draw a straight list; the numbered steps are already that picture.
- Draw diagrams to SVG at build time so the page works offline.
- For the checks guide, the rules live in the `validate` skill and the build check enforces them. Project CLAUDE.md has the general rule.

Related: [[plain-language-covers-conversation]], [[fundamentals-first-minimal]].
