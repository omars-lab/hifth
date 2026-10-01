#!/usr/bin/env bash
# Record the pictures for the scoped-notes options note: one clip per answer to
# question 4 (what the note tool does on a tap), each with the same three steps,
# a finger mark and numbered labels, then its strip of stills and one clip with
# all four side by side; then a still of each answer to question 6 (how the page
# shows a verse is in a note). Serve the built app first (make preview), then
# from the repo root:
#   docs/design/scoped-notes-feel/mocks/record.sh [http://localhost:4173]
# The record-demo skill explains the tools.
set -euo pipefail
BASE="${1:-http://localhost:4173}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PICS="$(dirname "$HERE")"
TOOLS=.claude/skills/record-demo/scripts
RAW=apps/web/test-results/drive
TOOL='tap=[aria-label^="Page tools"]; settle=350; tap=[role="radio"][aria-label="Note"]'
LOOK='#verse-54'   # 2:47, a look-alike of 2:122
SLIP='#verse-51'   # 2:44, a slip on this page

drive() { # name option mockfile act  (frames when name ends in a clip, else one still)
  make drive BASE="$BASE" HASH='#/hafs-kfqc/p7' LOCALE=en-US VIEWPORT=390x844 "${@:5}" \
    ACT="settle=600; eval=window.MOCK_OPTION=\"$2\"; evalfile=$HERE/page.js; evalfile=$HERE/$3; $4"
}
clip() { # name option mockfile act
  drive "$1" "$2" "$3" "$4" MARKS=1 FRAMES="test-results/drive/$1"
  "$TOOLS/make-gif.sh" --in "$RAW/$1/frames.txt" --start 0.8 --out "$PICS/$1.gif"  # skip the set-up
}
still() { # name option mockfile act
  drive "$1" "$2" "$3" "$4" DRIVE_OUT="test-results/drive/$1.png"
  cp "$RAW/$1.png" "$PICS/$1.png"
}
strip() { # name labels  (the same moments in every clip: each step's result)
  "$TOOLS/frame-strip.sh" --in "$PICS/$1.gif" --at "0.3,1.9,3.2,5.4" --labels "$2" --out "$PICS/$1-strip.png"
}

# Question 4. Every clip: a still start, then three steps at the same times.
clip tap-a A none.js "settle=600; step=1|Pick the note tool; $TOOL; settle=900; step=2|Tap 2:47: a new note; tap=$LOOK; settle=1100; step=3|Tap 2:44: the tool is down; tap=$SLIP; settle=1500"
strip tap-a "the page|tool picked|a new note, empty|2:44 opens the verse menu"

clip tap-b B q4.js "settle=600; step=1|Pick the note tool; $TOOL; settle=900; step=2|Tap 2:47: which note?; tap=$LOOK; settle=1100; step=3|Choose a note; tap=.sn-sheet [data-note=look]; settle=1500"
strip tap-b "the page|tool picked|the list of notes|added, with Undo"

clip tap-c C q4.js "settle=600; step=1|Pick the note tool; $TOOL; settle=900; step=2|Tap 2:47: new note + choices; tap=$LOOK; settle=1100; step=3|Tap a choice instead; tap=[data-note-box] [data-note=look]; settle=1500"
strip tap-c "the page|tool picked|a new note, three choices|2:47 now in the old note"

clip tap-d D q4.js "settle=600; step=1|Pick the note tool; $TOOL; settle=900; step=2|Tap 2:47: added; tap=$LOOK; settle=1100; step=3|Tap 2:44: added there too; tap=$SLIP; settle=1500"
strip tap-d "the bar says where taps go|tool picked|2:47 added, no box|2:44 went there too"

"$TOOLS/side-by-side.sh" --out "$PICS/taps.gif" --width 240 A="$PICS/tap-a.gif" B="$PICS/tap-b.gif" C="$PICS/tap-c.gif" D="$PICS/tap-d.gif"

# The first try at C, with each choice as a full row: kept to show what it covered.
still tap-c-rows C q4.js "eval=window.MOCK_ROWS=true; $TOOL; settle=400; tap=$LOOK; settle=900"

# Question 6: the same four verses marked each way.
still page-a A q6.js "settle=400"
still page-a-open A q6.js "settle=400; tap=.sn-mark[data-verse=\"51\"]; settle=500"
still page-b B q6.js "settle=400"
still page-c C q6.js "tap=$SLIP; settle=900"
still page-d D q6.js "settle=400"
magick "$PICS/page-a.png" "$PICS/page-b.png" "$PICS/page-c.png" "$PICS/page-d.png" -resize 50% +append "$PICS/pages.png"
