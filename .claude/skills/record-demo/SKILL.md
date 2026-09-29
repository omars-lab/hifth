---
name: record-demo
description: Record the running Hifth app as a GIF or video — a page turn, a drawer rising, a tool in use — to show something that moves. Use when asked to record, film, capture, or make a GIF, video, clip or demo of the app; when a still screenshot cannot show the thing (motion, a drag, an animation, a sequence of steps); for the Study Quran pitch; for a decision page where options differ in feel; or to show a bug that only appears in motion. Also covers checking a recording by eye and why recordings are not committed.
---

# Recording a demo

A still shows where things are. A recording shows how they **move**: the page
lifting as it turns, the drawer rising under the verse, the magnifier following
the pointer. For the pitch, that motion is most of the impression; for a
decision whose options differ in feel, it is the evidence.

## The short version

1. Have a server up: `pnpm dev` (5173) or the built app on 4173 (the `run-app`
   skill has the details and the PATH gotcha).
2. Record:

   ```
   make drive HASH='#/hafs-kfqc/p8' VIEWPORT=1280x800 MOUSE=1 \
     ACT='settle=400; press=ArrowLeft; settle=800' VIDEO=test-results/drive/turn.gif
   ```

3. **Look at it before you hand it over** — see "Checking it by eye" below.
4. Do not commit it. Keep the command instead (see "Why not commit it").

## What goes in the command

| setting | what it does |
| --- | --- |
| `VIDEO=<path>.gif` | record the run and make a GIF (needs ffmpeg — installed here) |
| `VIDEO=<path>.webm` | record the run as plain video (no ffmpeg needed; smaller, sharper) |
| `HASH=` | where it opens: `#/hafs-kfqc/p19` is page 19, `#/hafs-kfqc/2:48` selects that verse |
| `VIEWPORT=` | the window: `1280x800` or `1440x900` for the open book, `390x844` for a phone |
| `MOUSE=1` | a real pointer instead of touch — needed for hover and for grabbing a page's edge |
| `ACT=` | the steps, joined by `;` |
| `LOCALE=en-US` | English controls (the pitch default; scripture stays as it is) |

The steps in `ACT`:

- `settle=<ms>` — wait. **Every recording needs these**: before the first action
  so the page has drawn, and after the last so the motion finishes on camera.
- `press=<Key>` — `ArrowLeft` turns forward in a right-to-left book, `Escape` closes.
- `drag=<x>,<y>><x>,<y>` — press, glide, let go: turning a page by its edge the way
  a hand does. Coordinates are in the window's own points.
- `click=<css>`, `clickrole=<role>|<name>` — tap a control or a verse.
- `move=<x>,<y>` — move the pointer (hover states, the magnifier).
- `wait=<css>`, `waitrole=<role>|<name>` — wait for something to appear.

The GIF's size and smoothness: add `--gif-width` / `--gif-fps` by calling the
tool directly (`node apps/web/e2e/tools/drive.mjs … --video x.gif --gif-width 960`).
Defaults are 720 wide at 15 frames a second, which keeps a few-second clip to a
couple of MB.

## Checking it by eye

A recording nobody watched can show a blank page, a loading screen, or the wrong
spread and still look like a success. Pull a strip of frames and read the PNG:

```
ffmpeg -i turn.gif -vf "select=not(mod(n\,8)),scale=320:-1,tile=4x2" -frames:v 1 sheet.png
```

Say what the frames show — "loading, then pages 7–8, then the turn to 9" — and
fix the steps if the motion is cut off (add `settle`) or the start is blank
(settle longer before the first action).

## Why not commit it

A recording is a few MB, it goes stale the moment the app changes, and the
command remakes it in seconds. So **keep the command, not the file**: in the
PR description, the issue, the decision record, or the pitch runbook. If a
particular clip must survive — one shown to someone, say — put it somewhere
durable on purpose and say where; the scratch folder is emptied on restart.

A recording of the app shows only what the app ships, so it carries no held
commentary unless a pitch build is being recorded — and a pitch-build recording
is private, like the pitch build itself. Never post one publicly.

## What holds it still

`apps/web/e2e/drive-video.spec.ts` makes a GIF against the test server on every
push and checks it is a real GIF with more than one frame. The recorder is the
`--video` option of `apps/web/e2e/tools/drive.mjs`; `make drive` is the call site.
