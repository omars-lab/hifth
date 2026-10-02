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
# which tap did what (owner, 2026-10-02: "can we slow down the gifs?"). A GIF
# already made can be slowed by passing it as --in; its frames are kept as they
# are, only shown longer.
#
# The last frame is held --hold-end seconds so the eye can read the end before
# the loop restarts. A GIF over --max-bytes is refused (exit 2) with the width
# and speed to try next; a note that loads several big GIFs gets slow.
set -euo pipefail

IN="" OUT="" WIDTH=390 FPS=10 COLORS=64 START="" SLOW=2 HOLD_END=1.5 MAX_BYTES=1000000
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

slow="setpts=${SLOW}*PTS,"
if [ "${IN##*.}" = "gif" ]; then
  # A finished GIF: its frames, width and timing are already chosen, so it is
  # only slowed. Its own end hold is already in it.
  input=(-i "$IN")
  vf="format=rgb24,${slow}split[a][b];[a]palettegen=max_colors=${COLORS}[p];[b][p]paletteuse=dither=none"
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
[ "${IN##*.}" = "gif" ] || vf="format=rgb24,${skip}${slow}fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,${clean}tpad=stop_mode=clone:stop_duration=${HOLD_END},split[a][b];[a]palettegen=max_colors=${COLORS}[p];[b][p]paletteuse=dither=none"
ffmpeg -loglevel error -y "${input[@]}" -vf "$vf" -fps_mode vfr -loop 0 "$OUT"

bytes=$(wc -c < "$OUT" | tr -d ' ')
echo "ev=gif out=$OUT bytes=$bytes width=$WIDTH fps=$FPS colors=$COLORS"
if [ "$bytes" -gt "$MAX_BYTES" ]; then
  echo "ev=too_big bytes=$bytes limit=$MAX_BYTES try=\"--width $((WIDTH * 85 / 100)) --fps $((FPS > 8 ? FPS - 2 : FPS)) --colors $((COLORS > 32 ? COLORS / 2 : COLORS))\" or a shorter clip" >&2
  exit 2
fi
