#!/bin/sh
# Remakes the pictures on the larger-text options page, on the iPhone SE simulator.
#
# Serve the larger-text build first, in another terminal:  make text-grow-serve PORT=5795
# Then:  docs/design/larger-text-options/shoot.sh 5795
#
# Each picture opens verse 2:48 (so its tools drawer is up) in English, with the
# phone's text at its largest size, and one way of growing the bars and panels.
set -eu
PORT="${1:?usage: shoot.sh <port the larger-text build is served on>}"
D="${SIM:-A539A6A5-9D39-4592-A50E-430B87041D7E}"
HERE="$(cd "$(dirname "$0")" && pwd)"

shot() { # name, text size, link query
  xcrun simctl ui "$D" content_size "$2"
  xcrun simctl openurl "$D" "http://localhost:$PORT/?lang=en&$3#/hafs-kfqc/2:48"
  sleep 6
  xcrun simctl io "$D" screenshot --type=png "$HERE/$1.png" >/dev/null
  sips --resampleWidth 480 "$HERE/$1.png" >/dev/null   # small enough for the page, still legible
  echo "wrote $1.png"
}

shot off accessibility-extra-extra-extra-large "grow=off"
shot phone accessibility-extra-extra-extra-large "grow=phone"
shot panels accessibility-extra-extra-extra-large "grow=panels"
shot own-125 large "grow=own&size=1.25"
shot own-150 large "grow=own&size=1.5"
xcrun simctl ui "$D" content_size large
