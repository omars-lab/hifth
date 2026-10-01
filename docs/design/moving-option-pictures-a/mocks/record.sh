#!/usr/bin/env bash
# Record the two sample clips for the moving-option-pictures note: option A's
# hold, and today's tap, each with a finger mark and numbered step labels.
# Serve the built app first (make preview PORT=4181), then from the repo root:
#   docs/design/moving-option-pictures-a/mocks/record.sh [http://localhost:4181]
# A rough proof, not the finished tool: the note says what the real one should do.
set -euo pipefail
BASE="${1:-http://localhost:4181}"
HERE="docs/design/moving-option-pictures-a/mocks"
M="../../$HERE" # the driver runs from apps/web
PICS="$(dirname "$HERE")"
RAW=apps/web/test-results/drive

rec() { # name act
  make drive BASE="$BASE" HASH='#/hafs-kfqc/p7' LOCALE=en-US VIEWPORT=390x844 \
    ACT="$2" VIDEO="test-results/drive/$1.webm" OUT="test-results/drive/$1-end.png"
}
# Cut the page loading off the front (the driver records from the moment the
# browser opens), hold the last frame for 1.5 s so the eye can read the end,
# 10 frames a second, 64 colours, no dither: about 0.9 MB for 6.5 s.
gif() { # name start-seconds
  ffmpeg -loglevel error -y -ss "$2" -i "$RAW/$1.webm" \
    -vf "fps=10,tpad=stop_mode=clone:stop_duration=1.5,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
    "$PICS/$1.gif"
}
# The same clip as a row of stills, for checking by eye and for anywhere a
# moving picture does not play (a printout, a PDF export).
strip() { # name
  ffmpeg -loglevel error -y -i "$PICS/$1.gif" -vf "select=not(mod(n\,8)),scale=130:-1,tile=8x1" -frames:v 1 "$RAW/$1-strip.png"
}

rec a-hold "settle=1500; evalfile=$M/touch-marks.js; evalfile=$M/fuller-menu-on-open.js; eval=window.HOLD_LABEL=\"Keep holding: the ring fills\"; eval=__step(1, \"A: put a finger on a verse\"); settle=900; evalfile=$M/press-verse.js; eval=__step(3, \"Let go: the verse menu rises\"); settle=2200"
gif a-hold 1.7 && strip a-hold

rec today-tap "settle=1500; evalfile=$M/touch-marks.js; eval=__step(1, \"Today: tap a verse\"); settle=900; eval=window.PRESS_MS=90; evalfile=$M/press-verse.js; eval=__step(2, \"The verse is painted, the menu rises\"); settle=2200"
gif today-tap 1.7 && strip today-tap
