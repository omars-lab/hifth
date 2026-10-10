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

## Done

(Items move here with the date and where their test or ledger record is.)
