---
name: options-as-obsidian-notes
description: "owner wants options shown as a Markdown note in the docs Obsidian vault, not an HTML page; one line per paragraph; must land on main to be seen"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e85ea537-5f5b-46cb-add4-971a01406e5a
  modified: 2026-10-01T13:10:00.000Z
---

Show options as a Markdown note in the docs vault (reviewed in Obsidian with review-md), not as a generated HTML page. First used for the tap-vs-hold question (docs/design/verse-tap-and-hold.md, PR #189/#190).

**Why:** owner, 2026-09-30, rejected an in-chat question to say: "can we not generate html for these options and show options on md we review in obsidian".

**How to apply:**
- Follow the write-obsidian-note skill: a tip callout for the recommendation, folds for extra pictures, pictures taken with `make drive` and saved in a folder named after the note. See [[obsidian-callouts-and-folds-worked]].
- **Write one line per paragraph.** This vault keeps every typed line break, so text wrapped at 100 columns breaks mid-sentence.
- The vault is the **main checkout's** docs/ folder (registered as hifth0docs0vault01). A note in a worktree is "Vault not found". Merge it, then move the main checkout onto main (fast-forward only) before opening it with `obsidian://open?path=`.
- The decisions check needs `builtBy` for any page, and a hand-written note has no script. Add the decision row with its record once the owner picks, and say that in the PR. See [[decisions-must-be-recorded-at-the-source]].
- **Each option is a real screenshot, never ASCII art** (owner, 2026-09-30, review comment: "Why don't we have tables with html and screenshots? instead of ascii art?"). Mock the option into the live app with a script kept in `docs/design/<note>/mocks/`, run by `make drive … ACT="settle=1000; evalfile=<abs path>"`, then lay the pictures out side by side in a table (one column per option, `![cap\|190](…)` in cells). Mocking into the real app is what found that the top bar has no room for a full-screen button on a phone. Rule now in the decide skill and write-obsidian-note v2.4.0.
- **Table cells shrink pictures unevenly** (the column with the least text got ~130px). Crop each picture to what the option is about (`magick … -crop`), and add one full-width labelled side-by-side picture (`magick montage`) under the table when detail must be read. Keep a `mocks/retake.sh` that retakes, crops and composes every picture. Seen 2026-09-30, #192/#193.
- **When options differ in order or timing (tap vs hold, what happens next), add a looping GIF per option** (owner, 2026-10-01, review comment 95t7gc: "The transition/timeline of this cx is unclear ... can obsidian support gifs?"). Obsidian plays and loops GIFs inline. Recipe in the record-demo skill: `make drive MARKS=1 FRAMES=…` (a real touch, finger ripple or filling ring, numbered `step=` labels), then `make-gif.sh --start 0.8` (skip the mock's set-up), `frame-strip.sh` for the folded stills, `side-by-side.sh --width 300` for all options in one clip under the options heading. Worked example: `docs/design/verse-tap-and-hold/mocks/record.sh` (#197). Recording found what stills hid: a hold already opened the menu today (the note was wrong), C's small menu covered its own verse.
