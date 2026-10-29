---
name: losing-option-becomes-setting
description: when the owner picks between built UI options, the runner-up usually becomes a reader setting (winner as default), not deleted
metadata:
  type: feedback
---

When the owner settles a choice between options that are already built into the app, they tend to keep the losers as a setting in the info panel, with the winner as the default, rather than deleting them. Seen twice: tap-and-hold on a verse (2026-10-01, all three kept, C default) and the saved jump arrows (2026-10-03, "this should be a setting": A default, B selectable).

**Why:** different huffaz revise differently (a clean page while testing vs. hints in view); a setting serves both without a redesign.

Made the default on 2026-10-08 ("lets implement in multiple ways and options to toggle"), now a one-line habit in project CLAUDE.md: build the main ways up front, best one default, the rest a setting.

**How to apply:** build several ways by default rather than asking first; for a felt UI choice where both ways are built, ask with "winner by default, the other a setting" as an option — or, when the owner just picks one, propose keeping the other as a setting before deleting it. The pattern is a saved choice kept on the device (see apps/web/src/verse-gestures.ts and jump-arrows.ts) plus a radio group in Colophon.tsx. Related: [[present-options-with-pros-cons-implications]], [[decisions-must-be-recorded-at-the-source]].
