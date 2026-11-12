# Trims — the list, and how to take one on

Read by the optimizing-performance skill each time it runs, so this list can change without the
skill changing. Re-run `make perf-report` rather than trusting the sizes here; they are here so the
first candidates are not rediscovered from scratch.

## Where the room goes (2026-09-27, ~149 KB in all, 138 KB in the main script)

| part | size | trim | catch | status |
| --- | --- | --- | --- | --- |
| React's page-drawing library (`react-dom`) | ~42 KB | swap for Preact's compatibility layer (~4 KB) | every component and `@use-gesture` must still behave; needs a full e2e and golden run | **done** 2026-10-03, #215: start-up script 132.4 → 96.4 KB, time to answer a tap 2554 → 1956 ms; Preact needed React's after-input timing put back (`docs/issues/preact-swap.md`) |
| our components | ~39 KB | load rarely used tools (crop, diff view, settings) when first opened | a short wait the first time; the service worker must cache the extra files for offline | **done** 2026-09-29, #149: start-up script 134.3 → 121.6 KB; the tools come as one 14.6 KB file on first open |
| English **and** Arabic interface text | ~10 KB | load only the reader's language | the language switch must fetch the other one, and offline must still have both | **done** 2026-09-29, #148: start-up script −11 KB; each reader downloads 3.9–5.1 KB less |
| shared logic (`packages/core`) | ~15 KB | little: it is what the first page needs | none | — |
| gesture library | ~9 KB | none worth the risk | none | — |

**What slowed start-up, found 2026-11-11.** Not work at start-up: size. Start-up time goes up
one step of about 150 ms at a time as the start-up download grows (main script, English words,
style sheet). The step from about 2140 ms to about 2290 is near 160 KB; the app is at 171 KB;
the next step is past 190. So two things changed here. The size check now has a second limit,
185 KB on the start-up download, and prints that number on every run. And the two candidates
below are worth taking after all: they do not lower the total the cap counts, but moving about
12 KB out of start-up wins back 150 ms (`docs/performance.md` ㉑, backlog row
`move-12-kb-out-of-startup`). Nothing the app ships changed size. Full account:
`docs/issues/startup-slowed-in-a-month.md`.

**Measured again 2026-11-10 (night), with nothing else running: cap raised to 210 KB.** Start-up
came out in order this time: 2306 ms as built (five runs, 2297 to 2405), 2450 ms with 25 KB added,
2451 ms with 50 KB added, 2746 ms with 100 KB added, against the 2500 ms goal. So 25 KB of
download-only code fits cleanly. 50 KB fits too, but by 49 ms and with one run of five at 2854,
so it is not counted on. The cap went up by 10 KB, under half of the 25, which leaves 10.7 KB for
the pencil rings, the pens page and the calendar. Two things to carry forward: start-up as built
has crept from 2138 ms (2026-10-11) to 2306 ms, and the room is now thin enough that the next
raise should not happen without a trim or a faster start first. The two candidates below still
only move code between files, so they free no room; finding what does, and what slowed start-up,
is its own open item (⑳ in `docs/performance.md`, backlog row `startup-slowed-in-a-month`).

**Trimmed 2026-11-12: the words table, −4.1 KB, nothing a reader sees changed.** With the app at
210.0 of 210 KB and two small carries waiting, the owner chose finding code to delete over raising
the limit. A map of the main script by source file showed `i18n.tsx` at 7.4 KB gz, most of it 537
lines that each copied one message across under its own name (`about: m.about,`). One spread of
the catalog (`...m`) now does that, and only the messages that need adapting (digits, surah names,
choices) are written out. 210.0 → 205.9 KB, main script 139.1 → 135.0 KB. A unit test checks every
plain sentence in both languages still comes from its own catalog, word for word, and the language
browser tests pass in Chrome, Firefox and iPhone Safari. How the map was made: build with
`--sourcemap` into a scratch folder and add up each source file's share of the main script; worth
keeping in mind as the first look next time, before guessing.

**Checked again 2026-11-12, nothing taken, nothing left.** 210.0 KB against the 210 KB cap. Of the
+2.5 KB, 2.2 KB is carrying marks from the old address to hifth.app (the card at the old address,
the new tab's half and their words in the two languages), which went in without the baseline
moving, and 0.3 KB is the carry bringing where the reader left off. Most of it is in the start-up
script, since both halves listen from the first moment; moving them to a later file would ease
start-up but not the counted total. The carry still owes the revision record and the settings
(backlog row `carry-leaves-settings-behind`); neither fits, so they need a trim, a raise after a
clean `make perf-sweep`, or to wait.

**Checked again 2026-11-11 (late night), nothing to take.** 207.6 KB against the 210 KB cap,
unchanged after the page-edge strip learned to measure again when a page changes side (+0.0 KB:
a timer swapped for a watcher). 2.4 KB of room is left.

**Checked again 2026-11-11 (night), nothing to take.** 207.6 KB against the 210 KB cap, after
the developer page (+0.1 KB). The page itself is in no build: the app reaches it only from the
dev server, and the size check refuses any build that holds it. The 0.1 KB is the row learning
to show a third icon. 2.4 KB of room is left.

**Checked again 2026-11-11 (evening), nothing taken.** 207.5 KB against the 210 KB cap, after
the row of page icons along the bottom and settings as a page (+0.9 KB). 0.6 KB of that is in
the start-up script: the row, its style, the switch that turns it on and the wiring. 0.3 KB is
the words in the two languages and the settings page's style. The row could load later, since
it is off by default, but that would save about 0.3 KB of start-up, add nothing to the room,
and make the page jump when the row arrives, so it was left; the list above says under 2 KB is
rarely worth a new loading path. 2.5 KB of room is left. If the owner makes the row the
default, the info panel loses its switches and that is the time to look again. The open item
`startup-slowed-in-a-month` is still the one that could free room.

**Checked again 2026-11-11 (later), one small trim taken.** 206.6 KB against the 210 KB cap,
after the record's two by-day layouts (+2.4 KB). Of that, 1.8 KB is the two layouts and their
day-by-day count, which load with the record sheet and not at start-up, 0.3 KB is in the
start-up script (the switch's words and keeping what kind of mistake was marked), and 0.3 KB is
their words in the two languages. The trim: the day-by-day count first sat in the same core file
as the code that records a look, so it loaded at start-up though only the record sheet reads it.
In a file of its own it moved out, 0.4 KB off start-up; the total is the same. The load-later
browser test now fails if that file is found in the start-up script again. Worth copying
whenever a function only a late-loading screen uses is added to a core file start-up reads.
3.4 KB of room is left, and the page icons along the bottom are still to come, so the next
feature that adds to start-up needs a trim first. The open item `startup-slowed-in-a-month` is
still the one that could free room.

**Checked again 2026-11-11, nothing taken.** 204.2 KB against the 210 KB cap, after the page
that explains the pencil's pens (+3.7 KB). Of that, 1.8 KB is its words in the two languages,
1.5 KB is the page itself, which already loads only when settings first open, and 0.5 KB is in
the start-up script (the toolbar's fuller lines for Select and Highlight). 5.8 KB of room is
left for the calendar. The two candidates below still only move code between files, so neither
was taken; the open item `startup-slowed-in-a-month` is still the one that could free room.

**Checked again 2026-11-10 (later), nothing taken.** 199.3 KB against the 200 KB cap, after
the setting for showing which drawer sits on which (+0.9 KB). 0.7 KB of room is left. The two
candidates below move code between files, so they would not lower the counted total; the next step
is the clean sweep the note below asks for (nothing else running), done before the next feature.

**Checked again 2026-11-10, sweep run, cap kept.** 198.4 KB against the 200 KB cap, after the
reading settings behind one button (+1.5 KB). A fresh `make perf-sweep` gave 2553 ms with nothing
added, 2443 ms with 25 KB and 50 KB added, and 2745 ms with 100 KB added. It was run with the dev
server and a preview server also running, so the readings are noisy (adding code came out faster
than adding none). They do not show the clear room the skill asks for before raising, so the cap
stays at 200 KB. Before the next raise, rerun the sweep with nothing else running, or take one of
the two candidates below. Only 1.6 KB of room is left, so the next feature over that size needs
one or the other.

**Checked again 2026-10-16, nothing taken.** 191.9 KB against the 200 KB cap, after the page
beside a card landing at one size whichever came in first; about 54 KB of real room is left, so the
two candidates below still wait.

**Checked again 2026-10-15 (later), nothing taken.** 191.6 KB against the 200 KB cap, after
fixes to where the cards stand on a phone on its side and the slider stepping out of sight under a
verse's tools; about 54 KB of real room is left, so the two candidates below still wait.

**Checked again 2026-10-15, nothing taken.** 191.3 KB against the 200 KB cap, after the setting
that keeps a surah once it has been heard through (+1.0 KB). 19.6 KB of the ~75 KB of real room
the 2026-10-11 sweep found is now used, so about 55 KB is left; the two candidates below still
move code between files rather than out of the count, so they still wait. Run a fresh
`make perf-sweep` before the cap is next raised.

**Checked again 2026-10-13, nothing taken.** 190.3 KB against the 200 KB cap, after the setting
that keeps the page in the middle beside a card (+1.1 KB). Since the 2026-10-11 sweep 18.6 KB of
its ~75 KB of real room is used, so the two candidates below still wait.

**Checked again 2026-10-11, cap raised, nothing taken.** 171.7 KB against the 175 KB cap, so a fresh
sweep was run: ~75 KB of real room, and the cap went to 200 KB by the skill's rule. The two next
candidates named below (moving the desktop-only page-edge grab code, 3 KB, out of the phone's
start-up, or splitting the page stage) move code between files: they would help start-up time but
not the counted total, so they stay candidates.

**Checked again 2026-10-10 (night), nothing taken.** 170.5 KB against the 175 KB cap, after a
run's end lights its last verse and the turn-by-hand setting; still well inside the ~50 KB of real
room.

**Checked again 2026-10-10 (evening), nothing taken.** 169.5 KB against the 175 KB cap, after
the page started following a run of verses; still well inside the ~50 KB of real room.

**Checked again 2026-10-10 (later), nothing taken.** 168.2 KB against the 175 KB cap, after the
short-ribbon setting; still well inside the ~50 KB of real room.

**Checked again 2026-10-10, nothing taken.** 167.4 KB against the 175 KB cap, up 6.8 KB in a day
of fixes to where the cards stand; still well inside the ~50 KB of real room below, so the two
candidates there wait until the room, not the cap, runs short.

**Checked again 2026-10-09, nothing taken.** 160.6 KB in all against the 175 KB cap; the main
script is 112.6 KB, of which our page stage, app shell and shared logic are ~93 KB and the gesture
library and Preact the rest. Start-up was 2254 ms, and the sweep met the 2.5 s promise with +50 KB
more code and found +25 KB cost no time at all, so the real room is near 50 KB, not the 14 KB the
cap shows. Every row left is either the first page's own code or "none worth the risk". Next
candidates if the room runs short: split `PageStage.tsx` (14.9 KB) so the zoom and edge-turn code
loads after first paint, or move `EdgeGrabRails` (3 KB, desktop only) out of the phone's start-up.
Later the same day the long-verse setting brought it to 162.0 KB (+1.4 KB); still well inside that
room, so still nothing taken. The passage-rows setting (item 47) brought it to 164.3 KB (+1.0 KB),
10.7 KB under the cap; checked again and still inside the ~50 KB the sweep found, so nothing taken.

When a trim lands, set its status to **done**, with the date, the PR and the bytes saved, and
update the sizes from a fresh `make perf-report`.

## Why the size check went up when start-up went down

The size check adds up **every** file we ship, including the ones a reader only fetches later. So
a trim that moves code out of the start-up script shows as the same or slightly more in total
(each extra file carries a little of its own wrapping), even though the first visit downloads
less. Read the per-file lines in the baseline diff, not only the total. After both trims above:
158.3 → 160.3 KB in all, while the start-up script fell to 121.6 KB.

## Taking one on — the checklist

1. **Measure first.** `make build`, then `pnpm gate:budget` and `make perf-report`. Write down the
   total and the part you are trimming.
2. **Write the failing test first.** Usually two: a check on the build output that the moved code
   is no longer in the start-up script, and a Playwright test that the moved thing still opens and
   works (desktop and desktop-firefox). Watch both fail before the change.
3. **Make the change.** Load it later with a dynamic `import()`, or swap the library.
4. **Things to look for** — each of these has bitten a trim somewhere:
   - **A flash or a jump** the first time the moved thing opens. Show nothing, or a quiet
     placeholder of the same size — never a spinner that shifts the page.
   - **Offline.** Every later-loaded file is its own file; the service worker must cache it, or it
     will not open with no connection. Check with the offline tests.
   - **The pitch build.** It must still build, and its private code must still stay out of the
     public build (the size check fails if it leaks).
   - **A saving too small to matter.** Under ~2 KB is rarely worth a new loading path; say so and
     stop.
   - **A tiny shared file.** Two later-loaded files that share a small helper make the build
     ship the helper on its own: one more request before the first paint. The build folds any
     shared file under 2 KB into the main script, and refuses to build if a language file still
     needs one (`docs/issues/one-language-startup-check.md`).
   - **A top-level wait in the main script.** A later-loaded file can import things from the main
     script. If the main script is paused at the top waiting for that file, each waits for the
     other and the page never paints. Load, then draw, from a promise.
   - **Which start-up step you land on.** Start-up time moves in ~150 ms steps (see the sweep in
     the skill); a trim that does not cross a step down saves bytes but not time.
5. **Measure again**, `make budget-update`, read the baseline diff, and put before → after in the
   commit message.
6. **Run `make lighthouse`** on the trim branch, with nothing else running on the machine. The
   size cap stands in for it but is not it: it is how the tiny-file and top-level-wait problems
   above were found. Its five runs split into ~2100 ms and ~2550 ms groups for a reason inside
   the measurement (same issue file); compare against main measured the same way before blaming
   the trim.
