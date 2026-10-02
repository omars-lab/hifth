---
name: record-demo
description: Record the running Hifth app as a GIF or video — a page turn, a drawer rising, a tool in use — to show something that moves. Use when asked to record, film, capture, or make a GIF, video, clip or demo of the app; when a still screenshot cannot show the thing (motion, a drag, an animation, a sequence of steps); for the Study Quran pitch; for a decision page where options differ in feel; or to show a bug that only appears in motion. Also covers showing a finger on a phone (a tap ripple, a ring that fills while held, numbered step labels), the looping GIF an options note embeds with its folded strip of stills, joining option clips side by side, checking a recording by eye, and which recordings are committed.
---

# Recording a demo

A still shows where things are. A recording shows how they **move**: the page
lifting as it turns, the drawer rising under the verse, a menu opening under a
held finger. For the pitch, that motion is most of the impression; for a
decision whose options differ in timing or gesture, it is the evidence.

## The short version

1. Have a server up: `pnpm dev` (5173) or the built app on 4173 (the `run-app`
   skill has the details and the PATH gotcha).
2. **A clip for a note, on a phone** (a finger, step labels, sharp screenshots):

   ```
   make drive HASH='#/hafs-kfqc/p7' MARKS=1 FRAMES=test-results/drive/hold \
     ACT='settle=400; step=1|Hold a verse; hold=#verse-52|900; step=2|The menu opens; settle=1200'
   .claude/skills/record-demo/scripts/make-gif.sh --in apps/web/test-results/drive/hold/frames.txt --out docs/design/<note>/a-hold.gif
   .claude/skills/record-demo/scripts/frame-strip.sh --in apps/web/test-results/drive/hold/frames.txt \
     --at "0.3,0.9,2.0" --labels "before|finger down|menu up" --out docs/design/<note>/a-hold-strip.png
   ```

3. **A quick look at something moving, not for keeping** (a page turn on the desktop):

   ```
   make drive HASH='#/hafs-kfqc/p8' VIEWPORT=1280x800 MOUSE=1 \
     ACT='settle=400; press=ArrowLeft; settle=800' VIDEO=test-results/drive/turn.gif
   ```

4. **Read the strip before you hand anything over** — see "Checking it by eye".
5. Commit a clip only when a note embeds it, with its strip and the script that
   remakes both (see "What gets committed").

## What goes in the command

| setting | what it does |
| --- | --- |
| `HASH=` | where it opens: `#/hafs-kfqc/p19` is page 19, `#/hafs-kfqc/2:48` selects that verse |
| `VIEWPORT=` | the window: `390x844` (the default) for a phone, `1280x800` or `1440x900` for the open book |
| `MARKS=1` | draw the finger: a grey fingertip under every touch, a ripple for a tap, a ring that fills while held, and the step labels |
| `MARK_HOLD=<ms>` | how long the ring takes to fill (default 500); match the app's own hold time |
| `FRAMES=<dir>` | save sharp screenshots and their timings (`frames.txt`) instead of a video — use this for anything you keep |
| `VIDEO=<path>.gif` / `.webm` | record the browser's own video — quick, half as sharp, and it flickers |
| `MOUSE=1` | a real pointer instead of touch — needed for hover and for grabbing a page's edge |
| `ACT=` | the steps, joined by `;` |
| `LOCALE=en-US` | English controls (the pitch default; scripture stays as it is) |

The steps in `ACT`:

- `settle=<ms>` — wait. **Every recording needs these**: before the first action
  so the page has drawn, and after the last so the motion finishes on camera.
- `tap=<css | x,y>` — a real finger, down and up. `tap=#verse-52` taps verse 2:45
  (verse ids count from the start of the mus'haf: 2:45 is the 52nd verse).
- `hold=<css | x,y>|<ms>` — a real finger kept down that long, then lifted.
- `step=<n>|<text>` — the numbered label at the top of the clip. **Under 28
  letters**, or it wraps at phone width; the tool warns.
- `evalfile=<path>` — run a script in the page: how an option that is not built
  yet is mocked into the real app. **Load it before the step that shows it.**
- `press=<Key>` — `ArrowLeft` turns forward in a right-to-left book, `Escape` closes.
- `drag=<x>,<y>><x>,<y>` — press, glide, let go: turning a page by its edge.
- `click=<css>`, `clickrole=<role>|<name>` — click a control.
- `move=<x>,<y>` — move the pointer (hover states, the magnifier).
- `wait=<css>`, `waitrole=<role>|<name>` — wait for something to appear.

`tap=` and `hold=` aim at a point the browser itself says is on the element: a
verse that wraps a line has a gap at its middle that belongs to the next verse.
Pick a verse the menu will not cover (on page 7, 2:45 rather than 2:48).

## The scripts

All in `scripts/` next to this file; each one's header says the rest.

| script | what it does |
| --- | --- |
| `touch-marks.js` | the finger, the ring, the ripple and the step labels (loaded by `MARKS=1`) |
| `make-gif.sh` | frames or a video → the looping GIF: 390 wide, 10 a second, 64 colours, the last frame held 1.5 s; refuses anything over 1 MB and says what to try. `--start <s>` skips the first moments, while a mock script is still setting the page up. Plays at half the recorded speed by default (`--slow 2`; the owner found real speed too quick to follow); pass a finished `.gif` as `--in` to slow one already made |
| `frame-strip.sh` | chosen moments, numbered and labelled in a row — the folded picture under a clip, and the way to check it |
| `side-by-side.sh` | two to four option clips in one GIF under their letters, playing in step; `--width 300` brings three phones under 1 MB |

## Putting clips in an options note

- One clip per option, the same length, in the options table (`![A, hold\|190](note/a-hold.gif)`),
  and under it one `side-by-side.sh` GIF so the options play together at a readable size.
- Under every clip, its strip folded shut: `> [!example]- The steps, still` — for
  a reader who wants to stop on one moment, and for print.
- GIF, not video: Obsidian plays a GIF on its own and loops it; a video needs a
  click and does not loop. Not animated WebP either: bigger, and GitHub's preview
  shows it still.
- Why, in full: `docs/design/moving-option-pictures.md`.

## Checking it by eye

A clip nobody watched can show a blank page, a loading screen, the wrong verse,
or a finger mark frozen half-faded on the last frame. Make the strip at the
moments that matter and read the PNG. Say what each still shows — "page 7, then
the finger on 2:45, then the menu with 2:45 in its title" — and fix the steps if
the motion is cut off (more `settle`) or the start is blank (settle longer first).

For a `VIDEO=` recording, the same works on the GIF:

```
ffmpeg -i turn.gif -vf "select=not(mod(n\,8)),scale=320:-1,tile=4x2" -frames:v 1 sheet.png
```

## What gets committed

- **Commit** the clip an options note embeds, its strip, and the script that
  remakes both (in the note's `mocks/` folder: `docs/design/verse-tap-and-hold/mocks/record.sh` is a worked example). Each GIF is
  under 1 MB; `make-gif.sh` refuses more. Keep clips under about 7 seconds.
- **Never commit** raw frames, browser videos, or a clip nobody embeds: they go
  stale the moment the app changes, and the command remakes them in seconds.
  Keep the command instead, in the PR, the issue or the decision record.
- **Only the public app.** A clip of the public app carries no held commentary.
  A pitch-build recording is private, like the pitch build itself: never commit
  it and never post it.

## What holds it still

- `apps/web/e2e/drive-touch.spec.ts` checks the finger mark sits under a real
  touch and its ring fills, that `tap=` opens the verse's menu, and that
  `FRAMES=` writes sharp, timed screenshots.
- `scripts/record-demo.test.mjs` checks the three shell scripts: the GIF's
  width, loop and held last frame, the 1 MB refusal, the strip, and the joiner.
- `apps/web/e2e/drive-video.spec.ts` checks `VIDEO=` makes a real GIF.
