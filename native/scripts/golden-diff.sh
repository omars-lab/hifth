#!/bin/sh
# Compare every shell screenshot in $1 (current) against $2 (baseline) with
# ImageMagick, writing a diff image per pair into $3. A pair fails when more
# than $4 (a ratio, default 0.005 — the same allowance as the web goldens) of
# its pixels differ after a 5% colour fuzz. Missing baselines fail too: a
# golden with nothing to compare against is not a golden.
set -u
current=$1; baseline=$2; out=$3; allow=${4:-0.005}
mkdir -p "$out"
fail=0; n=0
for cur in "$current"/*.png; do
  [ -e "$cur" ] || { echo "no screenshots in $current"; exit 1; }
  n=$((n+1))
  name=$(basename "$cur")
  base="$baseline/$name"
  if [ ! -e "$base" ]; then
    echo "  ✗ $name: no baseline (make app-golden-update after looking at $cur)"; fail=1; continue
  fi
  total=$(magick identify -format '%[fx:w*h]' "$base")
  differing=$(compare -metric AE -fuzz 5% "$base" "$cur" "$out/$name" 2>&1 >/dev/null | sed 's/ .*//')
  case "$differing" in
    ''|*[!0-9]*) echo "  ✗ $name: sizes differ or compare failed ($differing)"; fail=1; continue ;;
  esac
  ratio=$(printf '%s %s' "$differing" "$total" | awk '{ printf "%.5f", $1 / $2 }')
  if awk "BEGIN { exit !($ratio > $allow) }"; then
    echo "  ✗ $name: $differing of $total pixels differ ($ratio > $allow) — diff at $out/$name"; fail=1
  else
    echo "  ✓ $name ($differing pixels differ)"; rm -f "$out/$name"
  fi
done
[ "$n" -gt 0 ] || { echo "no screenshots in $current"; exit 1; }
exit $fail
