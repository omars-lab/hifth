# What are we trying to do right now, and how do we know we are getting there?

*Written 2026-11-09, when the owner asked "what would you say our current goal is and how can
we measure progress?" Status: **current goal**. Read this at the start of a session, before
picking work. The list of all goals is [README.md](README.md).*

*Name: `study-quran-pitch`. Plans that serve it: `open-work-2026-11`. Use cases it is measured
by: the ones the six-passage walk covers, under "How we measure progress" below.*

## The goal

**A demo good enough to show The Study Quran's team, so that they want to work with us.**

A few verses done beautifully on the iPad, with their own commentary beside the scripture,
shown privately in a room. How deep the impression is matters more than how much is covered.
The long version is the top of the repo's `CLAUDE.md`.

## Are we on it? (checked 2026-11-09)

Partly. The last few days went mostly into Apple setup: the membership, the app ID, TestFlight,
the licence brief, HomePod and Siri, the paid features, sharing between readers.

- **Serves the pitch:** signing the app with the paid team. An install on the owner's iPad then
  lasts a year, so the demo cannot expire the week it is shown. It waits only on the owner
  signing in to Xcode.
- **Does not serve the pitch yet:** TestFlight to outside testers (only matters once they say
  yes), HomePod and Siri, selling the app, sharing between readers.

Of the 119 open backlog items that day, the guess is fewer than 20 sit on the path a scholar
would actually see.

## How we measure progress

| Measure | What it is | Where it lives |
|---|---|---|
| **The pitch walk passes on the real iPad** | A fixed demo script: open the app, go to the chosen pages, tap the look-alike verses, open the commentary, mark a mistake, and so on. Count the steps that work and look right. The goal is all of them, every time. | The pitch script (to write, below), walked on the owner's iPad, not only the simulator |
| **Faults on the pitch path** | Open backlog items a scholar would hit during that script. The count should fall toward zero. | A "pitch" tag on backlog rows |
| **Verses that are demo-ready** | How many of the chosen passages are fully done: page, marks, look-alikes and commentary all right and polished. | A short list in the pitch script |
| **A date to show it** | When the demo is in front of them. Without a date, setup work keeps growing. | The owner sets it; it is tracked here |

The first one is the main measure. The other three explain why it passes or fails.

## The current numbers

| Measure | Value | As of |
|---|---|---|
| Pitch walk steps passing on the iPad | **14 of 14** a machine can check, in the iPad simulator on its side, in one run (`make pitch-walk`, 45 seconds); 2 steps are by hand; not yet walked on the owner's own iPad. Walked again 2026-11-14 with the checks that ask the window for one page or two: 14 of 14 on the iPad mini on its side (one page) and the 13-inch iPad Pro on its side (two pages) | 2026-11-14 |
| Pitch walk steps passing on the iPhone | **14 of 14** a machine can check, in the iPhone 17 simulator, upright and on its side (`make pitch-walk ON="iPhone 17"`, `UPRIGHT=1`); one page, each note in a card at the foot; how the note should sit on a phone is still open (docs/design/iphone-app.md ③) | 2026-11-14 |
| Pitch steps passing in the browser (`make pitch-script`) | **14 of 14** a browser can check, in Safari's and Chrome's engines; 2 steps are by hand | 2026-11-09 |
| Open faults on the pitch path | **8** (`make issues PITCH=1`): 5 the agent's, 2 waiting on a device or the Xcode sign-in, 1 by-hand check | 2026-11-09 |
| Demo-ready passages | **6 of 6** in the iPad simulator, each note read against the printed pages (one wrong capital fixed, in 2:255). Two gaps: 10:15 → 19:73 has no note, so it is checked by picture only; the own notes of 18:62–82 beyond 18:65 are off the demo's path and not yet read against the print. Not yet walked on the owner's own iPad | 2026-11-09 |
| Date to show it | not set | 2026-11-09 |

Update this table whenever a walk is run or the backlog is tagged, so it shows the trend.

## What comes next, in order

1. **Write the demo script:** done as a draft, [pitch-script.md](../skills/walk-app/pitch-script.md)
   (2026-11-09). The owner corrects it: the passages, the order, what "right" means.
2. **Tag the backlog items on that path:** done, `"pitch": true` on 7 rows; `make issues PITCH=1`
   lists them. A fault found on a walk gets the tag too.
3. **Sign in to Xcode** (the owner, about a minute), so the agent can sign the app and install it
   on the iPad for a year.
4. **Pause the work that is not on the path** until after the meeting: TestFlight to outside
   testers, HomePod and Siri, paid features, sharing between readers. Nothing is deleted; the
   rows stay in the backlog.
5. **Walk the six passages on the owner's real iPad** (next, 2026-11-10). The app is on it and
   no longer closes on a touch, but every walk so far ran in the simulator, which missed that
   crash. Install with `make app-release-ipad DEVICE=…`, then walk the pitch script on the iPad:
   `docs/ipad-walk.md` is the list to tick through, with the other checks only the iPad can show.
   2026-11-10: the pitch build is on the iPad; the walk waits for the owner.

## The tools that make this repeatable

The measuring only means something if it is done the same way every time. So each step runs
through a Claude tool (a skill, a hook, a make command) rather than by memory. Some exist
already; some still have to be built, and building them is part of the goal.

### Already there: use these

| Step | Tool | What it does for this goal |
|---|---|---|
| Walk the demo | `walk-app` skill, `make drive` | Walks the app page by page in each device and saves a picture of each step; its checklist grows with every fault found |
| Run the pitch build | `run-app` skill (web), `native-shell` skill (`make app-run-ipad`, `make app-shot`) | Opens the real app, in the browser or the iPad simulator, at a given page |
| Put it on the iPad | `make app-release-ipad DEVICE=…` (`native-shell`, `crash-logs`, `app-setup` skills) | Runs the verse-touch test on the iPad's own OS in the simulator, signs with the paid team, installs, then opens the app watched and fails on a new crash report. `make app-crash-logs DEVICE=…` says what stopped the app if it closes |
| Track the faults | `issues` skill, `docs/issues.json`, `make issues`, `make backlog`, `make board` | One row per fault, rendered into the backlog page and the project board |
| Fix with a test | `testing` skill | Every fault found on the walk gets a test that would catch it coming back |
| Checks only a person can do | `manual-testing` skill | Parks the by-hand checks for the owner; each answer becomes a test |
| A choice that is felt, not read | `design-iterate` skill, `decide` skill | Builds the options live so the owner chooses by trying them; records the choice |
| Show something that moves | `record-demo` skill | A GIF or video of a turn or a drawer, for the owner to judge |
| Comments on a page | `development-manager:answer-page-comments` skill | The owner's comments on local pages turn into fixes |

### To build: so the numbers come out the same every time

| What | Tool to make or change | Why |
|---|---|---|
| ~~**The pitch script**~~ done | `.claude/skills/walk-app/pitch-script.md`: the passages, then each tap in order, each with what "right" looks like | The first measure needs a fixed list of steps, or each walk counts something different |
| ~~**A one-command pitch walk**~~ done: `make pitch-walk` (and `make pitch-script` for the browser) | A script in `.claude/skills/walk-app/scripts/` (with a row in that skill's scripts table) and a make target, which walks the pitch script in the iPad simulator and prints "N of M steps pass" plus the pictures | Turns the main measure into one command anyone can run. **How it drives the app (2026-11-09):** the app gets a list of steps when it starts and works through them alone: open each passage, wait, tap, take a picture, write down what it measured. We chose that over a live helper that sends the app one command at a time, because the steps never change, so there is nothing to decide between them. One start of the app, turned on its side once, instead of one start per step (about 40 seconds each). |

| ~~**A "pitch" tag on backlog rows**~~ done | `"pitch": true` on `docs/issues.json` rows; `make issues PITCH=1` lists and counts them; the backlog check refuses any other value | The second measure, without re-reading 119 rows |
| **The numbers kept up to date** | A step at the end of the pitch walk that rewrites "The current numbers" table above | The trend is the point; a table nobody updates is worse than none |
| **A reminder at the start of a session** | A SessionStart hook that prints this goal's current numbers and asks, with AskUserQuestion, if the session's planned work is on the pitch path | Stops the drift into setup work that this page was written to catch |
| **A goals skill, if this pattern sticks** | A small skill that reads `.claude/goals/`, says which goal is current, and shows its numbers | Only once there is a second goal; until then this page and the README are enough |

## How to use this page

- Before picking work, ask: does it make the pitch walk pass, or fix a fault on it? If not, it
  waits, unless the owner says otherwise.
- When this goal is met or replaced (say, after the meeting), mark it **done** at the top and
  in the README, and start a new file for the next goal. Don't write the new goal in this file.
