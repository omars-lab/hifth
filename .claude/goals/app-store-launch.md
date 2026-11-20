# Is Hifth ready for the App Store, and could we run it once readers have it?

*Written 2026-11-15, when the owner asked for a plan to harden the app before the App Store and
to be ready to hear about problems and fix them fast. Status: **current goal, beside the pitch**.
The list of all goals is [README.md](README.md).*

*Name: `app-store-launch`. Plan that serves it: `launch-readiness`
(`.claude/plans/launch-readiness.md`). What teams check before a launch, with sources:
`docs/research/app-launch/research.md`.*

## The goal

**Hifth on the App Store for iPad, iPhone and Mac, and a way to hear about a problem, find its
cause and ship a fix within days.**

Readers can sign in at launch. Crash reports come from Apple's own reports and from a report the
reader chooses to send. No outside company receives anything.

This goal runs beside the pitch goal, not instead of it. Where the two collide, the pitch build
stays private and the store build stays the public one.

## What does done look like?

- **Launch-ready:** every launch row in the backlog is closed except the upload itself, and the
  upload waits only on the two written permissions.
- **Able to run it:** every other measure below is at its target, so a problem a reader
  hits can be heard about, traced and fixed within days.
- **Done:** the app is in the store on all three devices and those measures have held for a month.

## Are we on it? (checked 2026-11-19)

Not yet: 19 launch rows are open (`make issues LAUNCH=1`). The App Store is still recorded as "not a target", and the
upload is locked until two rights holders say yes in writing. Everything else goes ahead meanwhile.

Done so far:
- a store build can never be the private build;
- the privacy file;
- the version command;
- a real archive of the store build, and the export and upload take only an archive that
  command made, and Apple's own check of it, passed on 2026-11-17 (the owner said yes to the
  check the same day, ㊷; the upload still waits on the licence);
- the outside-links test;
- sound with the silent switch on;
- the review notes, with a no-connection first launch;
- the error screen and "Report a problem";
- sign-in, built on the laptop and switched off (2026-11-18 and 19): Apple's sheet in the app,
  hifth.app's server code, staying signed in, delete my account, the invite code, the limit on
  tries, the account section, and the button that keeps a copy of a reader's marks on hifth.app.
  What is left of it is on the owner's side (the waiting list below) or needs the owner's iPad;
- the push names every browser test that passed only on its second try (㉕);
- backups of readers' data, with a restore practised on made-up rows (㉘).

Four facts shape the order:

- **Every fix is a new build through Apple's review**, because the web part is packed inside the
  app. So the off-switch and the release command matter more than they would on a website.
- **Two answers take weeks**, and everything else is days: the rights holders' replies, and
  sign-in (about three weeks of work; the owner made its three choices by 2026-11-18). These two set the
  launch date, so they are asked for first, and the rest is built while they wait.
- **The first download is nearly full**: 159.2 of its 161 KB, and the app as a whole 219.7 of
  its 220 KB (2026-11-19, after the line telling a hafiz a verse link went nowhere, ㊽, used the
  room the account words' move, ⑳ on the sign-in page, made). The app's log, the off-switch and
  the "new version ready" prompt must still load after the page is up. The whole app has 0.3 KB
  left, so the next addition to it needs a trim first (the optimizing-performance skill's list).
- **Some checks need a device and a person** (the screen-reader walk, the new layout on the
  iPad). They go on the by-hand checklist and are done in batches, never one at a time.

## How we measure progress

| Measure | What it is | Where it lives |
|---|---|---|
| **Launch blockers open** | Backlog rows tagged for the launch that would stop an upload or a review. Goes to zero. | `make issues LAUNCH=1` (rows with `"launch": true` in `docs/issues.json`) |
| **Owner steps waiting** | Things only the owner can do (emails, sign-in choices, store forms). | The "Waiting on the owner" list below |
| **Days since a restore was practised** | A backup put back into a scratch database and its rows counted. Under 30. | This page |
| **Days since the release command ran clean** | Version bump to a built, checked archive, upload still locked. Under 14. | This page |
| **Unanswered reports and reviews** | Reader reports in the support folder and store reviews with no answer. Zero. | Store reviews: `make app-store-reviews ARGS=pull` (the `store-feedback` skill). Reader reports: the `operate-app` skill's commands, once built |
| **New crashes** | Crashes from readers' devices not yet in a backlog row. Zero. | The `crash-logs` skill, once it reads readers' crashes |
| **Unsteady tests** | Tests that passed only on a second try in the last push. Zero. | The push prints them after each browser run; `make second-tries` lists the worst over the last 20 runs (the `testing` skill) |
| **Skills with a known gap** | Rows still open in the skills table in the plan. Zero. | The plan's stage 9 |

The first one is the main measure. The others say whether we could run the app once it is out.

## The current numbers

| Measure | Value | As of |
|---|---|---|
| Launch blockers open | **19** (2026-11-19, `make issues LAUNCH=1`: 15 open, 4 blocked; 9 of them are the owner's). Since 2026-11-17: the retry report ㉕ and the store pictures' clock ㊹ closed; sign-in ㉖, account deletion ㉗ and backups ㉘ are built but stay open on owner steps and the iPad sitting. Before that, **24** of 46 (2026-11-17, after the store reviews ㉜, the download numbers ㉝ and the second key on the release page ㉞ closed; `make issues LAUNCH=1` lists them). Before that, **26**: 24 of the 44 on the launch page, and the two older App Store rows on the licence. Seven added 2026-11-17 by the first walk as Apple's reviewer (㉟ to ㊶); the reviewer walk itself ㉟, the first-open ribbon ㊳, the English sources ㊴, the walk tools' launch settings ㊱ and the English top bar at 320 px ㊶ closed the same day, and the archive with Apple's own check ⑪ later that day. Later still the support page ⑳ and the apps' privacy policy ㉙ closed, and one item was added for linking both from inside the app (㊸), which closed the same day. Of the 26, **7 can get the app turned down at review**, 6 stop the upload itself (four launch-page items and the two older licence rows), and 13 matter once readers have it (the launch page's "Which of these could get the app turned down" sorts them) | 2026-11-17 |
| Owner steps waiting | **14** items on the list (18 steps, counting sign-in's five separately), ordered by what each frees in "Waiting on the owner". The key file and the accounts database were done 2026-11-18; five sign-in steps were added as sign-in got built (the yes for the marks table, Apple's notice address, the invite codes, the privacy draft's questions, one iPad sitting). Later on 2026-11-19 four were added inside items already listed, which the list had left out: the third email and the website's recitation (item 3), the verse-number ring (item 11), and hearing that the upload makes the team id public (item 1) | 2026-11-19 |
| Days since a restore was practised | **0**, on made-up rows only (`make hifth-app-backup-drill`: the list, and accounts from the sign-in branch's tables). No real copy yet: that waits on the owner's yes. `make hifth-app-backup-status` re-counts it | 2026-11-19 |
| Days since the release command ran clean | **2**: the release command was built 2026-11-17, and its archive, export and Apple's check ran clean that day. No run counted since | 2026-11-19 |
| Unanswered reports and reviews | **0** store reviews, none waiting (read live with the reviews key; the app is not in the store yet). Reader reports have no folder to land in yet | 2026-11-17 |
| New crashes | none can arrive yet: reading readers' crashes is built (`launch-readers-crashes`), but no build has reached a reader or a test device to send one | 2026-11-19 |
| Unsteady tests | **0**: the last push ran 2,076 browser tests, every one on its first try (the push names any that needed a second, ㉕) | 2026-11-19 |
| Skills with a known gap | **6 rows and 28 notes**: re-counted 2026-11-19. Of the plan's skills table, `testing`, `deploy-site`, `native-shell` and `walk-app` are done and 6 rows are open; 28 session notes in `docs/retros/` say `folded: no` (this session's own was folded the same day). Before: 9, rows only, not re-counted | 2026-11-19 |

Update this table on every pass of the loop (`.claude/loop-prompts/operational-readiness.md`).

## What is left, by line of work

Seven lines of work run side by side. Every open launch row is named in this table; `node
.claude/skills/issues/scripts/goal-names-every-row.mjs` lists any that are not, and the loop runs
it on every count. When one is blocked, the loop works around the block or moves
to another line. It asks the owner only when every line is blocked (the rule in "How to use this
page" below). Backlog row names are in brackets.

| Line of work | Open | Free to build now | Blocked, and the way around it meanwhile |
|---|---|---|---|
| **Hearing about problems** | 2 | Nothing (checked 2026-11-19). (Readers' crashes, `launch-readers-crashes`, are built; the row closes when a crash forced on a test device shows, which needs the first test build. The app's log, `launch-logging`, store reviews, `launch-store-feedback`, store numbers, `launch-store-numbers`, and the second key on the release page, `launch-keys-on-release-page`, are done; the numbers wait on the owner saving the vendor number.) | (The support page, `launch-support-page`, is built and checked: it goes live with hifth.app's first upload.) Whether a "Report a problem" sent from the app reaches the support folder (`launch-support-mail-arrives`) waits on the owner sending one from the simulator (waiting list, item 6). |
| **Shipping a fix fast** | 1 | Nothing (checked 2026-11-19). (The release command, `launch-release-command`, the off-switch, `launch-remote-switch`, and the "new version ready" prompt, `launch-browser-new-version`, are done 2026-11-17; reporting tests that pass only on a second try, `launch-retry-tests-hidden`, 2026-11-19.) | The site's undo (`launch-site-undo`) is built; its drill waits on hifth.app's first upload. The off-switch's file goes online with that upload; until then it is tested against a local copy. |
| **The licence** | 8 | Nothing (checked 2026-11-19). (The citations page, `launch-citations-page`, is built and checked: it goes live with hifth.app's first upload. Reading the page artwork's terms, `launch-page-artwork-terms`, and the recitation audio's terms, `launch-recitation-audio-terms`, are done, 2026-11-17. The verse-number rings, `launch-artwork-font-or-drawings`, are built and switched off; which ring is the owner's choice.) | The two permissions (`launch-corpus-permission`, `launch-tajweed-permission`) wait on the owner's emails. Fallback if no answer by the date: fetch that data from hifth.app after install, or leave the tajweed colours off. The upload rows (`gpl-and-the-app-store`, `app-store-not-a-target`) close when the answers do. The recitation (`launch-recitation-permission`) waits on the owner's third email, to Quran.com; it does not hold up the upload, since the store build leaves recitation out. Whether hifth.app/read keeps streaming it meanwhile (`launch-website-recitation`), and whether the store build shows the tajweed colours (`launch-tajweed-in-store`), are the owner's calls (waiting list). Which verse-number ring the pages use (`launch-artwork-font-or-drawings`) is the owner's choice too; the rest is ours once they choose. |
| **What Apple requires** | 4 | The machine half of the screen-reader walk (`launch-screen-reader-walk`) is done: Apple's accessibility check passes on the iPad and the iPhone, and axe covers the page, a chosen verse, the look-alikes list, the record, the shelf, the tips and the info panel, in Arabic and English, on the phone browsers (2026-11-19). Left: axe on the bookmark, note and mistake screens and the computer layout (`a11y-axe-remaining-screens`), and a rough build of the larger-text options (`a11y-larger-text`). Its by-hand listen stays on the by-hand list. (The iPad and iPhone permissions file and the hifth.app file that tells Apple which links open the app, `launch-ios-entitlements`, are built and checked; the site's file goes live with hifth.app's first upload, then a link is tried on the iPad from the by-hand list.) (The archive, the export and Apple's check, `launch-archive-upload`, are done. The Mac sandbox, `launch-mac-sandbox`, is done on this laptop: built, checked by the release check and walked.) | The Mac store archive and its installer package are built and checked (`make app-archive-mac`, `make app-export-mac`, owner's yes 2026-11-17). Apple's check of the Mac package waits on the owner adding the Mac to the app's store record (waiting list, item 7), and its upload on the licence. So do Sign in with Apple and hifth.app links on the Mac (`launch-mac-links-and-sign-in`, the Mac half of ⑨), since Apple turns both on per device. The screen-reader walk (`launch-screen-reader-walk`): the parts a person must do go on the by-hand list. Checking the Mac app needs the keyboard test permission, or a run while the owner is away. |
| **Listing** | 1 | The Arabic listing (`launch-store-answers`). (The store pictures are done: `make app-store-shots`, 2026-11-17; since 2026-11-19 the phone and tablet pictures show the clock and battery, ㊹.) (The English listing, the privacy, age and export answers and the category are drafted and checked by `make app-store-listing`.) | The EU trader answer, the price and the copyright line are the owner's (waiting list). The content-rights answer waits on the permissions, the same lock as the upload. |
| **Accounts** | 3 | (Backups, `launch-backups`, are built and the restore practised on made-up rows, 2026-11-19; the first real copy, the schedule, where copies live, how long and whether they are locked are the owner's.) (The privacy policy for what the app keeps today, `launch-app-privacy-policy`, and the info panel's links to it and the support page, `launch-support-links-in-app`, are done.) | Sign-in (`launch-sign-in`) and deleting an account (`launch-account-deletion`) are built on the laptop and switched off (2026-11-18 and 19), tested with stand-ins for Apple, the app and the server. The key file and the real database were done 2026-11-18. What is left is the owner's: hifth.app's upload with sign-in switched on, Apple's notice address, the invite codes, the privacy draft's questions, the yes for the marks table (㉑), then one sitting with the iPad (⑭). (The account words now load only with the account section, ⑳, 2026-11-19, which made room at start-up.) |
| **Skills and the loop** (no backlog rows; the plan's skills table) | 6 rows, 28 notes | All of it, and it splits well across helper agents (the loop prompt's section 3): the 28 session notes in `docs/retros/` not yet folded into skills, and the plan's open skill rows (`operate-app`, store steps in `app-setup`, the launch checks in `manual-testing`, readers' crashes in `crash-logs`, the rest of `release-app`, every skill's first line) | Nothing blocked |

## What comes next, in order

Reordered 2026-11-17 after the first walk as Apple's reviewer: what can get the app turned down
comes before what matters once readers have it, since a turned-down build costs a week.

1. **What the reviewer would trip on:** all found so far are fixed (the reviewer walk ㉟, the
   first-open ribbon ㊳, the walk tools' settings in the store copy ㊱, and the English top bar
   at 320 px ㊶). The next reviewer walk looks again.
2. **Apple's settings:** the iPad and iPhone permissions file. (The archive up to the lock,
   with Apple's own check passing, is done, and so are the Mac sandbox and the Mac store archive
   and package; Apple's check of the Mac package waits on item 6 below.)
3. **What Apple asks to link to:** the support page, the app's privacy policy, the info panel's
   links to both and the English store answers are done; next, the screenshots.
4. **The licence line:** the citations page and the two terms readings.
5. **The fast-fix line:** the release command, the site's undo, the retry report, then the
   off-switch and the prompt, each loaded after the page is up.
6. **Hearing about problems:** the app's log and readers' crashes. (The sources in English ㊴
   are fixed, and so are store reviews, store numbers and the release page on the new key.)
7. **Accounts:** sign-in is built and switched off (2026-11-19); the rest waits on the owner's
   steps and an iPad sitting. The account words now load only when the account section opens
   (⑳, done 2026-11-19), which freed room at start-up, and the line telling a hafiz a verse
   link went nowhere used it (㊽, done 2026-11-19).
8. **Test flight** with a few named readers, then **upload and release** once the permissions
   are in writing.

The plan has the detail of each step. Items 2 to 6 are built as far as they go without the
owner (checked 2026-11-19); "Where the work stands" names the next free item.

## Waiting on the owner, most work freed first

1. **Upload hifth.app and switch sign-in on there** (item 5 below, plus `SIGN_IN` and
   `APPLE_APP_IDS` on the live project). Frees the first real sign-in, the iPad trials, the site's
   undo, and puts the support page and citations online. Know before it goes: the upload makes
   the Apple team id public, inside the file that tells Apple which hifth.app links open the app.
   Apple requires it there, and every app that opens links does the same; it is not a secret, but
   it is the first time it appears anywhere public.
2. **Sign-in's own small steps** (the sign-in page): register hifth.app's notice address on
   Apple's developer site (step 13); make the invite codes and set them on the site (⑯); answer
   the privacy draft's seven questions (step 19); say yes or no to adding the marks-copy table to
   the real accounts database (㉑); with it, choose whether a sign-in renews each time the marks
   copy uses it or ends 60 days after sign-in (⑫; options on the sign-in page, recommended: keep
   the 60 days for testers); then one sitting with your iPad to try it all (⑭).
3. **Send the three permission emails, and set the date after which we stop waiting.** The first
   two (the word-root corpus and the tajweed data) free the upload; the answer takes weeks, so the
   sooner they go the better. The third, to Quran.com about the recitation (㊻), brings recitation
   back to the store apps; it does not hold up the upload. All three are drafted in
   `docs/design/store-permission-emails.md`. With it: **does hifth.app/read keep streaming the
   recitation** while the answer is out, or switch it off as the store build does (㊻)?
4. **Should the store build show the tajweed colours?** (launch item ㊲) Off: one permission
   leaves the upload's path and a reviewer sees nothing marked "unchecked". On: huffaz keep the
   feature and the upload waits on that permission too.
5. **The hifth.app first upload steps:** the Cloudflare key permission, the database step, four
   secrets, and the mail sender. These put the support page and the off-switch's file online.
6. **Send one test "Report a problem" from the simulator and say whether it arrived** (㊵).
7. **Add the Mac to the app's store record.** (Your yes to the Mac store archive came
   2026-11-17; the archive and its installer package are built and checked, and the one new
   certificate, the Mac installer one, was made.) In App Store Connect, the Mac is added on the
   app's page under "Add platform". Frees Apple's check of the Mac package, the last of launch
   item ⑧.
8. **Let the terminal run the Mac app's keyboard test**, or let it run while you are away. This
   frees checking the Mac app's keys and menus; its first open and its network were checked
   without it.
9. **Whether you trade in the EU.** Apple asks, and the answer decides what contact details are
   published.
10. **Delete the 134 merged branches on GitHub, and ask GitHub Support to purge the old commits.**
   This frees no launch work, but it finishes the clean-up of the old pictures.
11. **Try the new layout on the iPad** (the switch in the info panel). This decides whether it
   becomes the default.
   **With it, choose the verse-number ring** (㊺): the Complex's own medallion, taken from its
   drawing files, or our own plain ring. Both are built and switched off; the pages keep today's
   ring, whose source is not known, until you choose. Then we switch it on, re-copy the pages and
   show you the before-and-after pictures.
12. **Save the vendor number.** In App Store Connect, open Payments and Financial Reports and
   copy the number at the top left, then type `make env-set NAME=ASC_VENDOR_NUMBER` in your own
   terminal. This frees the download numbers (㉝); `make app-release-setup` then says ok.
13. **Three store answers only you can give** (㉚, at upload): whether you are an EU "trader"
   (a trader's address, phone and email show on the store page to everyone; one person with a
   free app and no sales can usually say no), the price (drafted as free), and the copyright
   line (it shows your name). The rest of the listing is drafted on the listing page.
14. **Four answers about backing up readers' data** (㉘; the copy and a practised restore are
   built). Where copies live: this laptop only, or a second place too. How long they are kept: a
   reader who leaves the list stays in older copies until those are pruned, so a shorter time
   means fewer copies of someone who asked to go. Whether copies are locked with a password. And a
   yes to the first real copy and to running it on a schedule. The first real copy also needs
   the database password in the saved keys (`make env-set NAME=SUPABASE_DB_URL`, in your own
   terminal).

(Done 2026-11-18: the Sign in with Apple key file, and the accounts database made on hifth.app's
Cloudflare, its tables in place and empty.)

(Answered 2026-11-18: the three sign-in choices. A reader's marks follow them; accounts are kept
by our own small code on hifth.app's Cloudflare with its free database; the copy on our server is
not locked at first.)

(Answered 2026-11-17: Apple may check the exported app before the licence is answered, ㊷; the
site publishes from this laptop, not from GitHub; the Mac store archive and its certificate
may be made.)

## Where the work stands (2026-11-19)

- **Now:** worktree `../hifth-auth`, branch `sign-in-server`, draft pull request #655, intent
  `launch-sign-in`. The pull request stays a draft until the owner has seen sign-in; it carries
  sign-in steps 10 to 21, the backups (㉘), the size trim, the account words loading only with
  the account section (⑳, pushed), and the line for a link that goes nowhere (㊽, backlog row
  `app-link-it-cannot-place`, 2026-11-19).
- **Done since:** the machine half of the screen-reader walk (⑯) is finished. Apple's
  accessibility check passes on the iPad and on the iPhone 17 simulator (`make app-test
  ONLY=AccessibilityAuditTests`, with `IPAD="iPhone 17"` for the phone; 2026-11-19, no code change
  needed on the phone). Axe now looks at the main screens a reader opens by link or from the page: the page, a chosen verse, the
  look-alikes list, the record, the saved-offline shelf, the tips, the info panel, and the page and
  info panel in English, with a planted nameless button proving the check still catches a fault
  (commit 3db0c0c9). The research comparison found nothing new: every line is done or has a row.
- **Next item:** for readers, larger text (`a11y-larger-text`): the bars, buttons and panels
  ignore the phone's text size; build the options roughly so the owner can choose by hand. Then
  axe on the screens still unscanned (`a11y-axe-remaining-screens`). Then the skill gaps, as helper batches (the loop prompt's section 3): the session
  notes in `docs/retros/` not yet folded into skills (a helper is folding the seven oldest, from
  Nov 10 to 12), and 6 open rows in the plan's skills table (the `operate-app` skill, store steps
  in `app-setup`, the launch checks in `manual-testing`, readers' crashes in `crash-logs`, the
  rest of `release-app`, every skill's first line). A free side item: `notify-list-keep-awake`,
  a daily timer so the free list database is not paused (built off; going live needs the owner).
  Only the by-hand VoiceOver listen and the larger-text choice wait on the owner. Checked
  2026-11-19: every other launch row is fixed or waits on the owner. ⑫ on the sign-in page (renew
  on use or a fixed 60 days) is the owner's choice, written up with its options on that page and
  tied to ㉑. The Arabic listing waits on the English wording being settled.
- **The loop is running** (from 2026-11-19), from the prompt in
  `.claude/loop-prompts/operational-readiness.md`, pacing itself between passes.

Older notes, kept for what they say about how things work:

- (2026-11-17) Worktree `../hifth-auth`, branch `mac-store-archive`, intent `launch-mac-sandbox`. It holds
  the Mac store archive and package commands (`make app-archive-mac`, `make app-export-mac`),
  run once from the committed tree on 2026-11-17: the receipt says all committed, and the app
  inside the package passed the store check with no problems. Its pull request merges when
  green. Apple's check of the package (`make app-store-check-mac`) waits on item 6 below.
- Signing for the store goes through Xcode's own sign-in to the Apple account, not the store
  key (Apple refuses the key that certificate). The sign-in expires; the export then says to
  sign in again in Xcode > Settings > Accounts.
- The Mac app's saved data must never be cleared (only the `.release` copy's folder may be
  emptied), and the Mac keyboard test never runs while the owner is at the laptop.
- Done since: the citations page (②), then the support page (⑳) and the apps' privacy policy
  (㉙) on branch `support-and-privacy-pages`; all three go live with hifth.app's first upload.
  The info panel links the support and privacy pages (㊸) since branch `support-links-in-app`.
  Then ⑨ on branch `ios-permissions`: the iPad and iPhone permissions file, the app taking
  hifth.app reader links, and the site's file that tells Apple which links open the app, which
  the release writes from this laptop's signing team (the team's id becomes public in it, which
  is how Apple asks for it). That merged as pull request 646.
- Then, on branch `launch-store-feedback`: the store-feedback skill (㉜, `make app-store-reviews`),
  the store-numbers skill (㉝, `make app-store-numbers`) and the release page and setup check on
  the second key (㉞). Both skills share the signed-request code in `scripts/lib/app-store-connect.mjs`
  and keep what Apple sends in `.store/`, which git ignores. The reviews pull ran live and found
  0 reviews. The numbers need the vendor number, which waits on the owner. The `hifth-reviews`
  key's file in `~/.appstoreconnect/private_keys/` is never read or printed.
- Then, on the same branch: the English store answers (㉚) on `docs/design/store-listing.md`,
  checked by `make app-store-listing`, and both privacy pages now say the sound is asked for
  before Play and name the setting that stops it.
- The first download was at 160.1 of 161 KB earlier on 2026-11-19, after sign-in pushed it over
  and two build settings brought it back (159.2 later that day; the numbers table has today's),
  so new code loads after the page is up.

## The tools that make this repeatable

### Already there: use these

| Step | Tool |
|---|---|
| Track the work | `issues` skill, `docs/issues.json`, `make issues`, `make backlog` |
| Fix with a test | `testing` skill |
| Build and run the apps | `native-shell` skill, `app-setup` skill |
| Read crashes from a device on a cable | `crash-logs` skill |
| Walk the app | `walk-app` skill |
| Publish the site | `deploy-site` skill |
| Keys and secrets | `secrets` skill |
| A choice to record | `decide` skill |
| Release notes | `intent-manager:write-release-notes` |
| Store reviews, with answers sent only on the owner's yes | `store-feedback` skill, `make app-store-reviews` |
| Downloads, updates and downloads again from Apple's daily reports | `store-numbers` skill, `make app-store-numbers` |

### To build

| What | Tool | Why |
|---|---|---|
| Archive, upload, review, staged release | the `release-app` skill, started 2026-11-16 with the version command | The rest of the release has no command yet |
| Reading crashes and reports; the fix-in-a-hurry path | new `operate-app` skill | Nothing covers running the app once it is out |
| The numbers kept up to date | the loop, `.claude/loop-prompts/operational-readiness.md` | A table nobody updates is worse than none |

## How to use this page

- Before picking launch work, ask: does it close a launch blocker, or make a measure above
  better? If not, it waits.
- Take the next item in "What comes next". When it is blocked, work around it (a draft, a build
  behind a switch that is off, the fallback, the half that needs no answer), write the block in
  "Waiting on the owner" and its backlog row, and move on. Ask the owner only when every line of
  work is blocked, in one list, except a block on weeks of work, which is named early.
- Update "The current numbers", "What is left" and "Where the work stands" on every pass.
- When the app is out and the measures hold for a month, mark this goal **done** at the top and
  in the README.
