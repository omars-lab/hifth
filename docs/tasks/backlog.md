# Confusion-points feature — open backlog

The open-side companion to [`done.md`](done.md). That file archives finished tasks; this one
holds what is still open on the **confusion-points feature**, so a clean session that starts
with an empty session tracker still knows where the work stands and can be useful in its first
five minutes.

Like every register in this repo, it **indexes — it does not restate.** Each open question below
is already a row in `docs/issues.json` (rendered into `docs/issues.md`) with its full reasoning;
here it gets one line and a pointer. If a line here disagrees with the issue row, the row wins.

## Where this sits in the bigger plan

This is **Tier C1 — "make it theirs"** in `.claude/prompts/hifth-continue.md`, the file that
governs the whole road to web v1.0. That file is the map of the whole project; this one is the
confusion-points thread in detail. Confusion-points is *not* a v1.0 gate — it deepens trust after
the app stops lying about the page — so nothing here blocks a ship. Keep the two in sync: if this
feature's tier or framing changes, change it there too.

## What is already done — so a clean session does not redo it

- **The feature is designed and drawn.** `docs/design/confusion-points.md` holds the whole
  feature; the eight-screen walkthrough *Where You Slip* is published (artifact
  `b0b6d0b5-5bec-4309-8dc4-701ab767e4a1`) and checked in at `docs/design/where-you-slip.html`.
  It is the page the owner has been leaving feedback on.
- **The export question is opened, drawn, and published.** Decision *"Should a reader be able to
  copy their confusion map off the phone?"* — record `docs/decisions/confusion-map-export.md`,
  data `docs/design/confusion-map-export.data.json`, generator
  `scripts/build-confusion-export-options.mjs`, checked-in page
  `docs/design/confusion-map-export.html`, artifact
  `1d9c4cff-f0a5-4aa3-a70b-2717f0814b1a`. Registered in `docs/decisions.json` and
  `docs/artifacts.json`. Both artifact comment threads are resolved.
- **The privacy stance was sharpened** from *"nothing leaves the phone"* to **"nothing leaves
  unless it is in the reader's interest, and under their control,"** carried into
  `docs/design/revision-record.md` item ④.
- Committed in `a5d41af` (feature) and `6dc0b81` (memory). All gates green.

## The open questions — each is already a row in `docs/issues.json`

Owner is **`user`** on every one: these are the owner's to answer, not an agent's. An agent's job
is to *draw and redraw the options* on a real mus'haf page, keep the records honest, and open the
next question — never to choose.

Ordered by what to look at first.

1. **`should-a-confusion-map-leave-the-device`** — *Should a confusion map ever leave the device?*
   **This one is live now:** the published `confusion-map-export` decision answers its
   file-backup half and awaits the owner's pick (options A/B/C on the page). Sync and
   teacher-sharing are named there as the heavier mechanisms it deliberately does not take yet.

2. **`is-the-privacy-rule-nothing-leaves-or-nothing-that-doesnt-serve`** — *Is the rule "nothing
   leaves the device," or "nothing leaves unless it serves the reader"?* The app-wide framing
   question the export decision forced. Sourced in `docs/design/revision-record.md` ④; does **not**
   loosen the revision-privacy gate — it asks whether the sentence that gate defends has the right
   wording.

3. **`should-the-app-learn-where-most-readers-slip`** — *Should the app learn where most readers
   slip, not just where you do?* Flagged as the **sharpest privacy tension in the feature**:
   pooling across readers contradicts the on-device-private design. Answer this before any
   analytics work is even sketched.

4. **`should-a-student-share-a-map-with-a-teacher`** — *Should a student be able to hand their
   confusion map to a teacher?* A genuinely valuable use the app's navigation nature does not
   otherwise serve; likely its **own future feature**, not a toggle on the export page.

5. **`who-sets-a-confusion-seams-state`** — *Who sets a seam's state — the reader, or the app's
   guess from the data?*

6. **`does-a-captured-slip-become-navigable`** — *Does a captured slip become navigable like a
   corpus edge?*

7. **`how-are-slip-candidates-ranked`** — *How are slip-candidates ranked, and is the opening-word
   signal worth building?* (severity: risk)

8. **`how-durable-must-a-confusion-map-be`** — *How durable must a confusion map be, given iOS
   wipes it?* Tied to #1 — a durable backup is one reason a map would want to leave the device.

## What a clean session should do first

1. Read `CLAUDE.md`, then `docs/design/confusion-points.md`, then this file.
2. `node scripts/gate-issues.mjs` and `node scripts/gate-decisions.mjs` — confirm the tree is
   consistent before touching anything. (`pnpm` is not on PATH in this shell; call the scripts
   directly.)
3. If picking up an open question, the move is almost always: **draw the options on a real page**
   with a committed generator, publish (with a per-action ask), and register the decision — the
   `decide` skill walks the whole thing. The owner then answers.

## Standing constraints a clean session must not trip over

- **No Qur'an scripture or Arabic codepoints in any committed page** — enforced by the shipped
  bytes, not only policy. Generators guard against it; keep that guard.
- **Artifacts speak English** — mocks and walkthroughs use English chrome; only scripture inside
  them stays Arabic.
- **Never publish or republish an artifact without a per-action ask.** Publishing mints a public
  address; it always needs the owner's yes first.
- **Never commit unless explicitly asked.**
- After any publish, `scripts/artifact-sweep.mjs` (a hook, not a gate) checks the page got a row
  in `docs/artifacts.json` — it only runs where the session log lives, so do not assume CI caught
  a missing row.
