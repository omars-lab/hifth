#!/usr/bin/env bash
# Record the moving pictures for the saved-arrows note: one clip per way on
# trial, the same three steps each, on a phone, then its strip of stills and
# one clip with both side by side. Serve the built app first (make preview),
# then from the repo root:
#   docs/design/jump-arrows-options/mocks/record.sh [http://localhost:4173]
# The record-demo skill explains the tools.
set -euo pipefail
BASE="${1:-http://localhost:4173}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PICS="$(dirname "$HERE")"
TOOLS=.claude/skills/record-demo/scripts
RAW=apps/web/test-results/drive
MARK='[data-confusion-mark="2:58"]'

clip() { # name way act
  make drive BASE="$BASE" HASH='#/hafs-kfqc/p9' LOCALE=en-US VIEWPORT=390x844 MARKS=1 \
    FRAMES="test-results/drive/$1" \
    ACT="settle=600; eval=window.ARROWS=\"$2\"; evalfile=$HERE/seed-jumps.js; settle=2000; $3"
  "$TOOLS/make-gif.sh" --in "$RAW/$1/frames.txt" --start 2.8 --out "$PICS/$1.gif"  # skip the set-up
}
strip() { # name labels
  "$TOOLS/frame-strip.sh" --in "$PICS/$1.gif" --at "0.3,2.0,4.5,8.5" --labels "$2" --out "$PICS/$1-strip.png"
}

clip clip-a stays "settle=300; step=1|The arrows stay, faint; settle=1100; step=2|Tap the mark: its list; tap=$MARK; settle=1400; step=3|Close it: still there; press=Escape; settle=1600"
strip clip-a "the page, arrows on it|the arrow, before the tap|the list|closed, arrows stay"

clip clip-b asked "settle=300; step=1|No arrows on the page; settle=1100; step=2|Tap the mark: its list; tap=$MARK; settle=1400; step=3|Close it: arrow goes; press=Escape; settle=1600"
strip clip-b "the page, no arrows|the mark, before the tap|the list, arrow behind it|closed, no arrows"

"$TOOLS/side-by-side.sh" --out "$PICS/clips.gif" --width 300 A="$PICS/clip-a.gif" B="$PICS/clip-b.gif"
