#!/usr/bin/env bash
# Record the moving pictures for the tap-and-hold note: one clip per option,
# the same three steps each, a finger mark and numbered labels, then its strip
# of stills and one clip with all three side by side. Serve the built app first
# (make preview), then from the repo root:
#   docs/design/verse-tap-and-hold/mocks/record.sh [http://localhost:4173]
# The record-demo skill explains the tools; retake.sh takes the still pictures.
set -euo pipefail
BASE="${1:-http://localhost:4173}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PICS="$(dirname "$HERE")"
TOOLS=.claude/skills/record-demo/scripts
RAW=apps/web/test-results/drive
VERSE='#verse-52'             # 2:45 on page 7: the menu, once open, does not cover it
CLOSE='section[aria-label*="2:45"] button[aria-label="Close"]'

clip() { # name option act
  make drive BASE="$BASE" HASH='#/hafs-kfqc/p7' LOCALE=en-US VIEWPORT=390x844 MARKS=1 \
    FRAMES="test-results/drive/$1" \
    ACT="settle=600; eval=window.MOCK_OPTION=\"$2\"; evalfile=$HERE/gestures.js; $3"
  "$TOOLS/make-gif.sh" --in "$RAW/$1/frames.txt" --start 0.8 --out "$PICS/$1.gif"  # skip the set-up
}
strip() { # name labels  (the same moments in every clip: each step's result)
  "$TOOLS/frame-strip.sh" --in "$PICS/$1.gif" --at "0.3,1.4,2.6,5.0" --labels "$2" --out "$PICS/$1-strip.png"
}

# Every clip: a still start, then three steps at the same times, so they play in step.
clip clip-a A "settle=600; step=1|Tap the page: bars hide; tap=$VERSE; settle=1100; step=2|Tap again: bars return; tap=$VERSE; settle=1100; step=3|Hold a verse: the menu; evalfile=$HERE/fuller-menu-on-open.js; hold=$VERSE|700; settle=1500"
strip clip-a "the page|bars hidden, nothing painted|bars back|the menu"

clip clip-b B "evalfile=$HERE/fuller-menu-on-open.js; evalfile=$HERE/fullscreen-button.js; settle=600; step=1|Tap a verse: the menu; tap=$VERSE; settle=1100; step=2|Close the menu; tap=$CLOSE; settle=1100; step=3|Tap ⤢ for full screen; tap=[aria-label=\"Full screen\"]; settle=1500"
strip clip-b "the page, a full-screen button|the menu|menu closed|full screen, a way back"

clip clip-c C "settle=600; step=1|Tap a verse: the menu; tap=$VERSE; settle=1100; step=2|Close the menu; tap=$CLOSE; settle=1100; step=3|Hold a verse: 2nd menu; hold=$VERSE|700; settle=1500"
strip clip-c "the page|today's menu|menu closed|the second menu"

"$TOOLS/side-by-side.sh" --out "$PICS/clips.gif" --width 300 A="$PICS/clip-a.gif" B="$PICS/clip-b.gif" C="$PICS/clip-c.gif"
