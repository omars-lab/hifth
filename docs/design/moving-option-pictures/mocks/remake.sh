#!/usr/bin/env bash
# Remake the checker's two sample clips (today's tap, option A's hold) and the
# hold's still strip. Serve the built public app first (make preview PORT=4183),
# then from the repo root:
#   docs/design/moving-option-pictures/mocks/remake.sh [http://localhost:4183]
# The frames are screenshots at the phone's full pixel size, so there is no
# video flicker to smooth and no frame needs dropping; see the note for why.
set -euo pipefail
BASE="${1:-http://localhost:4183}"
HERE="docs/design/moving-option-pictures/mocks"
PICS="$(dirname "$HERE")"
RAW=apps/web/test-results/remake

for press in tap hold; do
  rm -rf "$RAW/$press"
  node "$HERE/remake.mjs" --base "$BASE" --press "$press" --out "$RAW/$press"
  # 390 wide (the phone's own width), 10 a second, 64 colours from the clip.
  # No frame dropping and no change-only redraw: both left a half-faded finger
  # mark frozen on the last, longest-held frame in the checker's tests.
  ffmpeg -loglevel error -y -f concat -i "$RAW/$press/frames.txt" \
    -vf "fps=10,scale=390:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none" \
    "$PICS/$press.gif"
  bytes=$(stat -f %z "$PICS/$press.gif")
  echo "ev=gif out=$PICS/$press.gif bytes=$bytes"
  [ "$bytes" -le 1000000 ] || { echo "ev=too_big bytes=$bytes limit=1000000"; exit 1; }
done

# The hold as five numbered stills, taken at the moments that tell the story.
ffmpeg -loglevel error -y -f concat -i "$RAW/hold/frames.txt" \
  -vf "fps=10,scale=390:-1:flags=lanczos,select=eq(n\,4)+eq(n\,10)+eq(n\,17)+eq(n\,18)+eq(n\,30)" \
  -fps_mode passthrough "$RAW/hold/still-%d.png"
magick montage \
  -label "1  before" "$RAW/hold/still-1.png" \
  -label "2  finger down" "$RAW/hold/still-2.png" \
  -label "3  ring full" "$RAW/hold/still-3.png" \
  -label "4  let go: menu rising" "$RAW/hold/still-4.png" \
  -label "5  menu up" "$RAW/hold/still-5.png" \
  -tile 5x1 -geometry +8+0 -pointsize 18 -background "#faf7f0" "$RAW/hold/strip.png"
magick "$RAW/hold/strip.png" -resize 1400x -colors 128 -depth 8 "$PICS/hold-strip.png"
echo "ev=strip out=$PICS/hold-strip.png bytes=$(stat -f %z "$PICS/hold-strip.png")"
