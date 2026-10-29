---
name: option-gifs-half-speed
description: Option-clip GIFs play at one standard pace (half speed, frames in 0.2 s steps) and are gifsicle-packed; gate:gifs enforces it on every GIF under docs/
metadata:
  type: feedback
---

Every GIF in the docs plays at half the app's real speed: each frame 0.2 s (or whole 0.2 s steps for still moments), last frame held 1.5 s, packed with `gifsicle -O3`, under 1 MB.

**Why:** owner, 2026-10-02: "can we slow down the gifs?", then "slow all gifs … standardize the speed", then "does our hook also make sure the gif is as efficient/small as possible?". Real speed was too quick to follow.

**How to apply:** make clips with record-demo's make-gif.sh (default `--slow 2`) and join with side-by-side.sh; both pace and pack. Re-time an old GIF by passing it as `--in` (keeps width and colours). `pnpm gate:gifs` (in the push checks) refuses another pace, an unpacked file, or one over 1 MB. It cannot catch a clip slowed MORE than standard (looks like still moments). Related: [[options-as-obsidian-notes]].
