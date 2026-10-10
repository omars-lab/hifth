# Sourced by frame-strip.sh and side-by-side.sh: the font their labels are drawn in.
#
# ImageMagick finds a default font through its own font list, and a build that
# ships without one (Homebrew's 7.1.2-32, 2026-10-10) refuses every label with
# "unable to read font `'". So the labels name a font file outright: the first of
# these that exists, or ImageMagick's own default where none does.
LABEL_FONT=()
for f in /System/Library/Fonts/Supplemental/Arial.ttf /System/Library/Fonts/Helvetica.ttc \
  /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf; do
  if [ -f "$f" ]; then LABEL_FONT=(-font "$f"); break; fi
done
