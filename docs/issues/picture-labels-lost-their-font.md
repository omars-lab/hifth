# The labelled pictures stopped being made: the image tool lost its fonts

**2026-10-10.** The checks that run before every commit include two tests of the scripts that make
the pictures for options pages: one lays chosen moments of a clip side by side with a numbered label
under each, the other joins option clips into one moving picture with a letter above each. Both
started failing on this laptop with "unable to read font", on a change that touched neither script.

## What the evidence showed

The image tool (ImageMagick) had been updated by Homebrew to 7.1.2-32, and that build ships with an
empty list of fonts. Asked to write a label without naming a font, it looks in that list, finds
nothing, and refuses. Asked with a font file named outright, the same label draws. Nothing about the
scripts had changed; any picture with a word on it would have failed the same way.

## What changed

The two scripts now name the font file their labels are drawn in: the first that exists of Arial and
Helvetica (both come with macOS) and DejaVu Sans (common on Linux), falling back to the tool's own
default only where none of them is there. The choice lives in one small file both scripts read, so
the rule is in one place.

The two existing tests were the check: red for the real reason before the change, green after it,
with nothing about them loosened.
