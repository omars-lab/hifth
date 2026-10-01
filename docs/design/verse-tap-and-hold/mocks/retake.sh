#!/usr/bin/env bash
# Retake the option pictures for the tap-and-hold note. Serve the built app
# first (make preview), then from the repo root:
#   docs/design/verse-tap-and-hold/mocks/retake.sh [http://localhost:4173]
set -euo pipefail
BASE="${1:-http://localhost:4173}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PICS="$(dirname "$HERE")"
RAW=apps/web/test-results/drive

shot() { # name hash act
  make drive BASE="$BASE" HASH="$2" LOCALE=en-US VIEWPORT=390x844 ACT="$3" OUT="test-results/drive/$1.png"
}
whole() { magick "$RAW/$1.png" -resize x900 "$PICS/$1.png"; }
# The menus: the lower part of the screen, so the buttons can be read.
menu() { magick "$RAW/$1.png" -crop 780x1088+0+600 +repage -resize 560x "$PICS/$1.png"; }

shot a-tap '#/hafs-kfqc/p7' "settle=1000; evalfile=$HERE/bars-hidden.js; settle=1200" && whole a-tap
shot b-button '#/hafs-kfqc/p7' "settle=1000; evalfile=$HERE/fullscreen-button.js; settle=300" && whole b-button
shot b-full '#/hafs-kfqc/p7' "settle=1000; eval=window.MOCK_WAY_BACK=1; evalfile=$HERE/bars-hidden.js; settle=1200" && whole b-full
shot menu-fuller '#/hafs-kfqc/2:48' "settle=1000; evalfile=$HERE/fuller-menu.js; settle=300" && menu menu-fuller
shot c-tap '#/hafs-kfqc/2:48' "settle=1300" && menu c-tap
shot c-hold '#/hafs-kfqc/2:48' "settle=1000; evalfile=$HERE/separate-menu.js; settle=300" && menu c-hold
