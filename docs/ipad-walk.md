# What to check next time you have the iPad

Everything that only the real iPad can show, in one list. Started 2026-11-10, when the pitch build was put on the iPad and the walk waited for an unlock that never came.

Tick a box as you go, and write what you saw under it in your own words. Anything wrong becomes a test and a new line on the walk checklist, and the agent updates the pitch numbers.

> [!tip] Before you start (two minutes)
> 1. Plug the iPad into the laptop and unlock it. Settings → Display & Brightness → Auto-Lock → **Never**, for the walk.
> 2. The pitch build is already on it (signed until 2027-11). To put a newer one on: `make app-web FLAVOUR=pitch`, then `make app-release-ipad DEVICE="Omar Eid’s iPad (2)"`. It now waits for you to unlock.
> 3. Turn **Wi-Fi off**. Hold the iPad **on its side**.
> 4. If the app ever closes by itself: `make app-crash-logs DEVICE="Omar Eid’s iPad (2)"` says why.

## The pitch walk, about ten minutes

The same steps the simulator walks by machine. The real iPad is the only place to see its own speed, its fonts, and how a turn feels.

- [ ] **Open the app.** It lands on two pages quickly, with no long blank screen and no tour bubble.
- [ ] **Turn a page by its outer edge, then back.** The page follows your finger and settles, with no flash.
- [ ] **Tap 2:255.** Its note opens beside it, and the whole verse stays in sight.
- [ ] **Read 2:255's note to the end.** Sharp, in the book's typeface; slanted words slanted; it ends above the bar at the bottom.
- [ ] **Open 2:255's related places.** 8 cards and a "more"; each card opens its verse.
- [ ] **Open 2:255's number menu, then the roots list.** The menu stands clear of the verse; the open root group stays open while the rest arrive.
- [ ] **Go to 2:48 and open its look-alikes.** Every row says why it is there; the passage row reads "2:122–2:123".
- [ ] **Open the row for 2:123.** The comparison opens with the shared words marked, its name in sight under the title.
- [ ] **Go to 10:15, later surahs, open 19:73.** The shared opening marked green, the one word spelled differently ochre.
- [ ] **Go to 15:30, later surahs, open the passage in surah 38.** Its name stays in sight under the list's title.
- [ ] **Open al-Kahf's introduction from the surah's name (page 293).** It lies over the facing page; the surah's name stays in sight.
- [ ] **Tap 18:10 and read its note.** The slanted terms are slanted; no stray box or mark.
- [ ] **Tap 18:60 and follow its link to 18:65, then back.** It lands on 18:65 with the verse lit, and there is a way back.
- [ ] **With a note open, play the surah from its corner.** It recites, and the verse being recited is never under the note.
- [ ] **Pick the Mistake pen, tap a word, mark it, erase it, then Undo.** The question stands clear of the word; the mark shows, goes, and comes back.
- [ ] **Tap a verse nobody planned for (say 2:37).** Its note opens like the others, never empty, never a wait that does not end.
- [ ] **All the way through:** nothing says it needs a connection.

## Other checks that need the real iPad

Each is parked on the by-hand list because the simulator cannot show it. Do any you have time for.

- [ ] **The first Play, just after installing.** Hold the surah corner on any page and press Play, counting to the first sound. Right: under half a second. About a second means the app should start its sound sooner.
- [ ] **Turn the iPad with a note open, and back.** Tap a demo verse so its note opens, stand the iPad upright, then lay it on its side again. Right: the note stays open each way up, with every line of its verse in sight.
- [ ] **Feel the page shrink when a note opens.** Open 2:255's note. The page is drawn a little smaller so the whole verse stands beside the note. Right: it reads as the page making room, not as the app undoing your zoom.
- [ ] **Keep a long surah on ordinary Wi-Fi** (Wi-Fi back on for this one). Hold Al-Baqarah's name at the top of the page and keep its recitation, about 131 MB. Right: the count keeps moving, Stop stops it, and once done it plays with Wi-Fi off.
- [ ] **Apple Pencil double-tap and squeeze**, if a pencil is at hand. Try each pencil setting in the iPad's Settings → Apple Pencil. Right: the tool palette setting opens Hifth's pens; eraser or last-tool swaps between the last pen and plain selecting; nothing on the page is lost.

## Two drawer settings waiting for your choice

Both are built and sit in the info panel (the "About Hifth" button). Today's way is still the default for each. Try the other way on the iPad, then say which should be the default.

- [ ] **Where a verse's tools open.** Pick "Inside the verse's drawer", tap a verse, and press Share, Same roots and Listen in turn. Each opens under the drawer's buttons instead of on a card of its own, and the verse stays in sight above. Which feels better in the hand?
- [ ] **Tapping the lit verse again.** Pick "Opens the word you tapped", tap a verse, then tap one of its words. The word's letters and signs open in a drawer on top of the verse's, and the verse stays lit. A tap elsewhere closes the word's drawer. Should this replace putting the verse out?

## What you saw

Write here, in any words. The agent turns each line into a test.

-

## Where these come from

The pitch steps are the pitch script (`.claude/skills/walk-app/pitch-script.md`); the other checks are items 3, 12, 13, 17, 18 and 19 of the by-hand list (`.claude/skills/manual-testing/checklist.md`); the two drawer settings are the open drawer questions in the issue list (`docs/issues.json`: `drawer-holds-its-tools`, `word-drawer-stacks-on-verse`). When a check here changes, change it there too.
