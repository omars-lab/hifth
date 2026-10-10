#!/usr/bin/env bash
# Join two to four option clips into one GIF, side by side, each under its
# letter, so they play in step. Use it when the clips in a table's cells drift
# apart or come out at different sizes; one full-width GIF under the table then
# shows the options moving together.
#
#   side-by-side.sh --out <options.gif> A=<a.gif> B=<b.gif> [C=<c.gif>] [D=<d.gif>]
#                   [--width <each clip>] [--max-bytes 1000000]
#
# A shorter clip rests on its last frame until the longest one ends. --width
# narrows every clip to that many pixels, to bring three or four under the limit.
#
# The clips are make-gif clips, already at the docs' one pace (each frame 0.2 s),
# so the joined clip keeps it: an exact repeat is kept as one longer frame rather
# than doubled at 0.1 s, the file is packed with gifsicle, and the end is held
# 1.5 s like a single clip's.
set -euo pipefail
. "$(dirname "$0")/label-font.sh"

OUT="" MAX_BYTES=1000000 WIDTH="" letters=() clips=()
while [ $# -gt 0 ]; do
  case "$1" in
    --out) OUT="$2"; shift 2 ;;
    --max-bytes) MAX_BYTES="$2"; shift 2 ;;
    --width) WIDTH="$2"; shift 2 ;;
    ?=*) letters+=("${1%%=*}"); clips+=("${1#*=}"); shift ;;
    *) echo "side-by-side: unknown argument $1" >&2; exit 64 ;;
  esac
done
n=${#clips[@]}
[ -n "$OUT" ] && [ "$n" -ge 2 ] && [ "$n" -le 4 ] || {
  echo "side-by-side: --out and two to four LETTER=clip.gif are required" >&2; exit 64; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
probe() { ffprobe -v error -select_streams v:0 -show_entries "$1" -of csv=p=0 "$2"; }

longest=0
for c in "${clips[@]}"; do
  d=$(probe format=duration "$c")
  longest=$(awk -v a="$longest" -v b="$d" 'BEGIN { print (b > a ? b : a) }')
done

inputs=() graph="" stacked=""
for i in "${!clips[@]}"; do
  w=${WIDTH:-$(probe stream=width "${clips[$i]}")}
  magick -size "${w}x44" xc:"#faf7f0" ${LABEL_FONT[@]+"${LABEL_FONT[@]}"} -fill "#14181c" -pointsize 28 -gravity center \
    -annotate +0+0 "${letters[$i]}" "PNG24:$work/h$i.png"
  d=$(probe format=duration "${clips[$i]}")
  rest=$(awk -v a="$longest" -v b="$d" 'BEGIN { printf "%.2f", a - b }')
  gap=$([ "$i" -lt $((n - 1)) ] && echo 12 || echo 0)
  inputs+=(-loop 1 -i "$work/h$i.png" -i "${clips[$i]}")
  graph+="[$((2 * i + 1)):v]format=rgb24,fps=10,scale=${w}:-2:flags=lanczos,tpad=stop_mode=clone:stop_duration=${rest}[g$i];"
  graph+="[$((2 * i)):v]format=rgb24,fps=10[h$i];"
  graph+="[h$i][g$i]vstack=shortest=1,pad=iw+${gap}:ih:0:0:color=#faf7f0[c$i];"
  stacked+="[c$i]"
done
graph+="${stacked}hstack=inputs=${n},mpdecimate=hi=1:lo=1:frac=0,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=none"

mkdir -p "$(dirname "$OUT")"
ffmpeg -loglevel error -y "${inputs[@]}" -filter_complex "$graph" -fps_mode vfr -loop 0 "$work/joined.gif"
gifsicle -O3 "$work/joined.gif" "#0--2" -d150 "#-1" -o "$OUT"
bytes=$(wc -c < "$OUT" | tr -d ' ')
echo "ev=side_by_side out=$OUT bytes=$bytes clips=$n secs=$longest"
if [ "$bytes" -gt "$MAX_BYTES" ]; then
  echo "ev=too_big bytes=$bytes limit=$MAX_BYTES try=\"--width $(( ${WIDTH:-390} * 80 / 100 ))\"" >&2
  exit 2
fi
