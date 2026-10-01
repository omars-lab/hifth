#!/usr/bin/env bash
# Lay chosen moments of a recording side by side as one picture, numbered, for
# the folded strip under a clip in a note and for checking a clip by eye.
#
#   frame-strip.sh --in <frames.txt | clip.gif | video> --at <secs,secs,...>
#                  --labels "<label>|<label>|..." --out <strip.png> [--width 1400]
#
# --at picks each moment by its time in seconds from the start; --labels gives
# one label per moment, and each is numbered in order ("1  before").
set -euo pipefail

IN="" AT="" LABELS="" OUT="" WIDTH=1400
while [ $# -gt 0 ]; do
  case "$1" in
    --in) IN="$2"; shift 2 ;;
    --at) AT="$2"; shift 2 ;;
    --labels) LABELS="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --width) WIDTH="$2"; shift 2 ;;
    *) echo "frame-strip: unknown argument $1" >&2; exit 64 ;;
  esac
done
[ -n "$IN" ] && [ -n "$AT" ] && [ -n "$LABELS" ] && [ -n "$OUT" ] || {
  echo "frame-strip: --in, --at, --labels and --out are required" >&2; exit 64; }

IFS=, read -r -a times <<< "$AT"
IFS='|' read -r -a labels <<< "$LABELS"
[ "${#times[@]}" -eq "${#labels[@]}" ] || {
  echo "frame-strip: ${#times[@]} moments but ${#labels[@]} labels" >&2; exit 64; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
if [ "${IN##*.}" = "txt" ]; then input=(-f concat -safe 0 -i "$IN"); else input=(-i "$IN"); fi
# Every frame at a steady 10 a second and the phone's width, so a time is a frame number.
ffmpeg -loglevel error -y "${input[@]}" -vf "format=rgb24,fps=10,scale=390:-1:flags=lanczos" "$work/%05d.png"
last=$(find "$work" -name '*.png' | wc -l | tr -d ' ')

montage=()
for i in "${!times[@]}"; do
  n=$(awk -v t="${times[$i]}" -v last="$last" 'BEGIN { n = int(t * 10 + 0.5) + 1; print (n > last ? last : n) }')
  montage+=(-label "$((i + 1))  ${labels[$i]}" "$work/$(printf %05d "$n").png")
done
mkdir -p "$(dirname "$OUT")"
magick montage "${montage[@]}" -tile "${#times[@]}x1" -geometry +8+0 -pointsize 18 -background "#faf7f0" "$work/strip.png"
magick "$work/strip.png" -resize "${WIDTH}x>" -colors 128 -depth 8 "$OUT"
echo "ev=strip out=$OUT bytes=$(wc -c < "$OUT" | tr -d ' ') stills=${#times[@]}"
