#!/usr/bin/env bash
# Turn a recording into the looping GIF an options note embeds.
#
#   make-gif.sh --in <frames.txt | video | clip.gif> --out <clip.gif>
#               [--width 390] [--fps 10] [--colors 64] [--start <secs>]
#               [--slow 2] [--hold-end 1.5] [--max-bytes 1000000]
#
# --in is either the timed list the drive tool's --frames mode writes (its
# screenshots, each with how long it shows) or a video from --video. Frames are
# the default for a clip you commit: they are phone-sharp and have no flicker.
# A video gets two extra passes: smoothing the flicker the browser's recorder
# adds, and dropping frames that barely changed. Both shrink it, but dropping
# can freeze a fading finger mark on the last frame, so record videos with the
# finger mark set to vanish at once, and look at the last frame.
#
# --start skips that many seconds from the beginning (a page still being set up).
#
# --slow plays the clip that many times slower than it was recorded. The default
# is 2: at the speed the app really moves, a reader watching a note cannot follow
# which tap did what (owner, 2026-10-02: "can we slow down the gifs?"). The
# frames are picked first, --fps a second of the recording, and slowed after, so
# each is shown exactly --slow/--fps seconds: 0.2 s, the one pace every clip in
# the docs keeps (the docs check refuses any other). A picture repeated exactly
# is kept as one longer frame. A GIF already made, at any pace, is re-timed to
# the standard by passing it as --in.
#
# Last, gifsicle packs the file without changing a pixel (2 to 9% smaller) and
# sets the last frame's hold.
#
# The last frame is held --hold-end seconds so the eye can read the end before
# the loop restarts. A GIF over --max-bytes is refused (exit 2) with the width
# and colours to try next; a note that loads several big GIFs gets slow.
set -euo pipefail

IN="" OUT="" WIDTH=390 FPS=10 COLORS="" START="" SLOW=2 HOLD_END=1.5 MAX_BYTES=1000000
while [ $# -gt 0 ]; do
  case "$1" in
    --in) IN="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --width) WIDTH="$2"; shift 2 ;;
    --fps) FPS="$2"; shift 2 ;;
    --colors) COLORS="$2"; shift 2 ;;
    --start) START="$2"; shift 2 ;;
    --slow) SLOW="$2"; shift 2 ;;
    --hold-end) HOLD_END="$2"; shift 2 ;;
    --max-bytes) MAX_BYTES="$2"; shift 2 ;;
    *) echo "make-gif: unknown argument $1" >&2; exit 64 ;;
  esac
done
[ -n "$IN" ] && [ -n "$OUT" ] || { echo "make-gif: --in and --out are required" >&2; exit 64; }
mkdir -p "$(dirname "$OUT")"

# Pick frames at the recording's own speed, keep an exact repeat as one longer
# frame, then slow: every frame lasts a whole number of SLOW/FPS steps.
pace="fps=${FPS},mpdecimate=hi=1:lo=1:frac=0,setpts=${SLOW}*PTS,"
# The end hold is set on the last frame when the file is packed: held clones
# would only be merged back into it.
hold=$(awk "BEGIN { printf \"%d\", ${HOLD_END} * 100 }")
# A finished GIF keeps every colour it has (up to the 256 a GIF can hold): a
# side-by-side of four clips holds more than one clip's 64, and squeezing it
# back down changed half its pixels.
[ "${IN##*.}" = "gif" ] && COLORS="${COLORS:-256}" || COLORS="${COLORS:-64}"
palette="split[a][b];[a]palettegen=max_colors=${COLORS}[p];[b][p]paletteuse=dither=none"
if [ "${IN##*.}" = "gif" ]; then
  # A finished GIF: its width is already chosen, so it is only re-timed, and
  # its end held like any other.
  input=(-i "$IN")
  vf="format=rgb24,${pace}${palette}"
  WIDTH=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$IN")
elif [ "${IN##*.}" = "txt" ]; then
  input=(-f concat -safe 0 -i "$IN")
  clean=""
  # The screenshots start before the first step, so a script that sets the page
  # up shows its first moments undone; --start drops them.
  skip="${START:+trim=start=${START},setpts=PTS-STARTPTS,}"
else
  skip=""
  input=(${START:+-ss "$START"} -i "$IN")
  # Smooth the recorder's flicker over time, then drop frames that barely changed.
  clean="atadenoise,mpdecimate,"
fi

# Colours are drawn from the clip itself, so the page's paper and ink stay true.
[ "${IN##*.}" = "gif" ] || vf="format=rgb24,${skip}scale=${WIDTH}:-1:flags=lanczos,${clean}${pace}${palette}"
ffmpeg -loglevel error -y "${input[@]}" -vf "$vf" -fps_mode vfr -loop 0 "$OUT.tmp.gif"
frames=$(gifsicle --info "$OUT.tmp.gif" | sed -n 's/.* \([0-9][0-9]*\) images.*/\1/p')
if [ "${frames:-1}" -gt 1 ]; then
  gifsicle -O3 "$OUT.tmp.gif" "#0--2" -d"$hold" "#-1" -o "$OUT"
else
  gifsicle -O3 -d"$hold" "$OUT.tmp.gif" -o "$OUT"
fi
rm -f "$OUT.tmp.gif"

bytes=$(wc -c < "$OUT" | tr -d ' ')
echo "ev=gif out=$OUT bytes=$bytes width=$WIDTH fps=$FPS colors=$COLORS"
if [ "$bytes" -gt "$MAX_BYTES" ]; then
  echo "ev=too_big bytes=$bytes limit=$MAX_BYTES try=\"--width $((WIDTH * 85 / 100)) --colors $((COLORS > 32 ? COLORS / 2 : COLORS))\" or a shorter clip" >&2
  exit 2
fi
