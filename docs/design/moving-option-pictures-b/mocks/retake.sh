#!/usr/bin/env bash
# Retake the sample clip for the moving-option-pictures note: option A of the
# tap-and-hold note, a finger held on verse 2:48 with a ring filling, then the
# fuller verse menu. Serve the built public app first (make preview PORT=4182),
# then from the repo root:
#   docs/design/moving-option-pictures-b/mocks/retake.sh [http://localhost:4182]
set -euo pipefail
BASE="${1:-http://localhost:4182}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PICS="$(dirname "$HERE")"
TAP="$(dirname "$PICS")/verse-tap-and-hold/mocks"
RAW="$(mktemp -d)"
trap 'rm -rf "$RAW"' EXIT

node apps/web/e2e/tools/drive.mjs --base "$BASE" --hash '#/hafs-kfqc/p7' --locale en-US --viewport 390x844 --settle 0 \
  --act "settle=900; evalfile=$HERE/touch-marks.js; eval=__touch.label(1, \"Hold a verse\"); settle=800; eval=__touch.down(200, 664); eval=__touch.ring(550); click=#verse-55; settle=250; eval=__touch.up(); evalfile=$TAP/fuller-menu.js; eval=__touch.label(2, \"Its menu rises: 4 new buttons\"); settle=2400" \
  --video "$RAW/a-hold.webm" --out "$RAW/end.png"

# Skip the blank first half second; smooth the flicker the browser recording adds
# between frames and drop frames that barely changed (without this the same clip
# came out anywhere from 0.8 to 2.8 MB run to run); hold the last frame 1.5 s so
# the loop pauses; 340 wide, 12 frames a second, 96 colours taken from the clip,
# only the changed part of each frame redrawn.
ffmpeg -loglevel error -y -ss 0.5 -i "$RAW/a-hold.webm" \
  -vf "fps=12,hqdn3d=0:0:12:12,scale=340:-1:flags=lanczos,mpdecimate=hi=2048:lo=960:frac=0.5,tpad=stop_mode=clone:stop_duration=1.5,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$PICS/a-hold.gif"

# The still under it: four numbered frames, taken from the recording at the same
# moments (frame 10, 25, 29 and 60 at 15 a second, after the trim).
ffmpeg -loglevel error -y -ss 0.5 -i "$RAW/a-hold.webm" -vf "fps=15,scale=360:-1:flags=lanczos,select=eq(n\,10)+eq(n\,25)+eq(n\,29)+eq(n\,60)" -fps_mode passthrough "$RAW/sb-%d.png"
magick montage -label "1  before" "$RAW/sb-1.png" -label "2  holding: ring fills" "$RAW/sb-2.png" \
  -label "3  ring full: hold done" "$RAW/sb-3.png" -label "4  menu up, finger lifted" "$RAW/sb-4.png" \
  -tile 4x1 -geometry +10+0 -pointsize 20 -background "#faf7f0" -depth 8 "$RAW/strip.png"
magick "$RAW/strip.png" -resize 1200x -colors 128 -depth 8 "$PICS/a-hold-strip.png"
ls -la "$PICS/a-hold.gif" "$PICS/a-hold-strip.png"
