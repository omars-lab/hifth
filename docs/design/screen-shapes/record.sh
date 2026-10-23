#!/usr/bin/env bash
# Record the public app at four window sizes, the same steps in each (open page 8,
# turn to page 9, pick 2:59), and join them side by side, so a reader can see
# where the two-page spread gives way to one page. Serve the built app first
# (make preview), then from the repo root:
#   docs/design/screen-shapes/record.sh [http://localhost:7123]
# The sizes are the inside of a browser window, with its own bars taken off:
# a 1080 screen, a 900 one, a 768 laptop, and a 720 projector or shared window.
# The record-demo skill explains the tools.
set -euo pipefail
BASE="${1:-http://localhost:7123}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TOOLS=.claude/skills/record-demo/scripts
RAW=apps/web/test-results/drive
SIZES=(1920x970 1440x790 1366x660 1280x610)

for v in "${SIZES[@]}"; do
  make drive BASE="$BASE" HASH='#/hafs-kfqc/p8' VIEWPORT="$v" MOUSE=1 SEEN_COACH=1 LOCALE=en-US MARKS=1 \
    FRAMES="test-results/drive/shape-$v" \
    ACT="settle=800; step=1|A ${v/x/ x } window; settle=900; press=ArrowLeft; settle=1200; click=#verse-66; settle=1400"
  "$TOOLS/make-gif.sh" --in "$RAW/shape-$v/frames.txt" --width 480 --out "$RAW/shape-$v.gif"
done
"$TOOLS/side-by-side.sh" --out "$HERE/four-windows.gif" \
  A="$RAW/shape-1920x970.gif" B="$RAW/shape-1440x790.gif" C="$RAW/shape-1366x660.gif" D="$RAW/shape-1280x610.gif"
"$TOOLS/frame-strip.sh" --in "$HERE/four-windows.gif" --at "1.0,8.0" --labels "page 8|page 9, 2:59 picked" \
  --out "$HERE/four-windows-strip.png"
