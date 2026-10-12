# Parked by-hand checks

Saved for later — nothing here is waiting on the owner today. Highest priority first. Each item
says what to look at, what right looks like, and what test it becomes once it has been checked.
The phone-and-device checks keep their full steps in the validation ledger
(`make validate CHECK=<id>`, or `make guide` to open them on the phone); this list only names them.

Two ways to open the app: this laptop, `make pitch` then `http://localhost:5173/#/hafs-kfqc/...`
(the private demo build, with the Study Quran notes); or the public site,
`https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/...` (no notes).

## Parked

1. **The bookmarked corner, in Firefox.** Bookmark a page on a computer, one page and two-page
   (`#/hafs-kfqc/p6?view=one`, `?view=two`). Right: the ribbon hangs from the top of its own page
   near the spine, the folded corner is clear of it and a little darker than the page.
   Already a test (edge-peel spec); by eye only because the look was the complaint.

2. **Walk the demo as a scholar would**, on a phone and on a computer (private build). Open The
   Study Quran's note on a verse, follow a related verse, come back. Right: every step lands where
   you expect and nothing looks unfinished. Each rough edge found becomes its own Playwright test
   of that flow.

3. **The demo on the real iPad, in the app, with the network off.** Plug the iPad in, run
   `make app-web FLAVOUR=pitch`, then `make app-device-install DEVICE=<its name> ROUTE=/hafs-kfqc/2:255`,
   turn Wi-Fi off, hold it sideways and walk the demo: 2:255's note, 2:48's look-alikes, 18:60's
   note and its link to 18:65 and back. Right: it opens on the page quickly, with no long blank
   screen; the note reads sharp, in the book's typeface; a page turn follows your finger; nothing
   says it needs a connection. The simulator walks all of this by machine, but only the real
   device shows its own speed, its fonts and how a turn feels. Anything wrong becomes an XCUITest
   or Playwright case.

4. **Arabic number wording.** Open `docs/design/arabic-number-agreement-review.html` and read the
   counts as they appear in the Arabic interface (best with a hafiz). Right: each count agrees
   with its noun the way a reader would say it. Corrections become unit tests on the wording.

5. **Four phone checks** (steps in the ledger):
   - smooth enough on a real phone — `perf-verdict-on-device`
   - usable with the screen reader — `screen-reader-walkthrough`
   - still works offline after 8 days — `offline-survival-8-day`
   - a two-day revision record lands on the phone — `revision-record-lands-on-a-phone`

   These need a real phone and time, so they stay by hand; each verdict is saved with
   `make record CHECK=<id> RESULT='…'`, and any part a machine can repeat goes into that check's
   `evidence` block.

6. **By-eye placement sitting** (about 60 quick taps: each shows one mark with two boxes; tap the
   box that sits where the print has it). Run `pnpm sit:serve` in the harakat worktree and open
   the page it prints. Its ruling unlocks the per-line bend fix, and it becomes the answer key the
   automated scorer measures against from then on. Ledger: `placement-correction-by-eye`,
   `placement-holds-off-its-own-pages`, `placement-what-kind-of-wrong`.
   Later, a **second person** sits the same trials, so we can see how often two readers agree —
   that agreement is what tells us how far to trust one reader's answer key.

7. **Cloudflare: Always Use HTTPS.** The site still answers on plain http, where the offline app
   does not work. Flip the setting in the Cloudflare dashboard. Once it is on, a check that plain
   http redirects to https replaces this item.

8. **Licensing questions** — the App Store, the page layout's licence, the third upstream source.
   Needs someone qualified to read licences; not needed for the pitch. Answers go into the
   decision records, not tests.

9. **Pinch on a Mac trackpad, inside the Mac app.** `make app-run-mac ROUTE=/hafs-kfqc/p45`,
   then pinch on the page and on the two-page spread. Right: the page zooms under your
   fingers, smoothly, and nothing else on the window zooms with it. Anything wrong becomes an
   XCUITest or Playwright case (issue `mac-trackpad-pinch-unfelt`, design/native-shell.md §⑧ ②).

10. **A kept juz on a phone that would not promise to keep it.** On a phone, keep a juz from the
   packs sheet, then use the phone normally for a week without opening the app. Right: the juz
   is still there offline, or the app says it was cleared and fetches it back on the next visit
   with a connection, without you doing anything. Anything else becomes a Playwright test of
   the "kept juz is gone" notice and its refetch (issue `storage-not-kept`, performance.md ⑰).

11. **A recitation in the iPad app on a slow connection.** The simulator shares the laptop's
   connection, so slow it in System Settings with Apple's Network Link Conditioner (a 600 ms
   delay and a 400 kbps download, the walk's "poor" speed), then run the gap walk in the iPad
   app on its side at `/hafs-kfqc/p600` (the command is in the walk-app skill). Right: every
   gap reads "held" and about 0.03 s, including the long verse 98:4 after the short 98:3. A
   gap read from the network means fetching ahead fell behind; that becomes a unit test of the
   case (issues `run-gap-on-poor-wifi`, `run-gap-short-then-long`, PLAN 63 and 64).

12. **The first Play on the real iPad, just after installing.** Install the pitch build on the
   iPad (`make app-device-install`), open it, hold the surah corner on any page and press Play,
   counting to the first sound. In the simulator that takes about a second even though the
   verse's file is already in hand, and every verse after it starts at once, so the second is
   likely the simulator starting its sound, not the app. Right: under half a second on the real
   iPad. About a second there too means the app should start its sound sooner, and that becomes
   a backlog item with the walk's gap script as its measure.
13. **Turning the real iPad with a note open, and back.** On the pitch build, lay the iPad on
    its side, tap a demo verse so its note opens, then hand it to someone and let it turn upright
    in their hands, then back. The simulator check can only start on its side, not turn mid-walk,
    and the browser test only changes the window's size. Right: the note stays open each way up,
    across the page when upright and over the facing page on its side, with every line of its verse
    in sight above or beside it. Anything else becomes a backlog item and a test.
14. **Dragging the real Mac app's window smaller with a note up, and back.** On the pitch build,
    open the Mac app at a demo verse so its note is up, then drag the window's corner in until it
    shows one page (narrower than about 1024 wide, or shorter than about 740), then back out. The
    browser test only sets the window's size; it cannot drag a real Mac window. Right: the note
    stays open the whole time and every line of its verse stays in sight and clear of it, with no
    flicker between one page and two while the corner moves. Anything else becomes a backlog
    item and a test.

15. **Loading a bookmarks file in the real Mac app.** In the Mac app, save the bookmarks from the
    bookmarks shelf (the save window drops down; save it anywhere), then press the shelf's load button and pick that
    file. The Mac app's window for choosing a file opens on the laptop's own screen and waits for a
    real click, so no automatic walk can drive it without taking over the keyboard and mouse.
    Right: the choose-a-file window drops down from the app's title bar, the file can be picked,
    and the shelf shows the bookmarks it held. Anything else becomes a backlog item and a test
    (docs/design/native-shell.md, item ㉛).

16. **Watching the note move as a recitation crosses the open book.** On the pitch build, lay
    the iPad on its side, tap a demo verse so its note opens, then play the surah from its corner
    and let it run across two openings. The note moves to the other page each time the recitation
    reaches the page it is over, about once a page. The walk measured where it stands but cannot
    say how the move feels. Right: each move reads as the note getting out of the way, not as a
    note that will not sit still. If it reads as restless, that becomes a backlog item, with a
    smaller note while the recitation plays as the first thing to try (docs/PLAN.md, item 85).
17. **Feeling the page shrink a little when a card opens beside it.** On the laptop, show one
    page, zoom in a step or two, tap 2:45 and open its roots list; on the small iPad on its side,
    open 2:255's note. The page is drawn a little smaller, up to a fifth, so the whole verse
    stands beside the card, and it goes back to your size when the card closes. The tests
    measure the sizes but cannot say how the shrink feels. Right: it reads as the page making
    room, not as the app undoing your zoom. If it feels like the app fighting you, that becomes
    a backlog item, with keeping the size and showing only the verse's start as the first thing
    to try (docs/PLAN.md, items 92 and 93).

## Done

(Items move here with the date and where their test or ledger record is.)
