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

## Are we on it? (checked 2026-11-17)

Not yet: 29 launch rows are open. The App Store is still recorded as "not a target", and the
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
- the error screen and "Report a problem".

Four facts shape the order:

- **Every fix is a new build through Apple's review**, because the web part is packed inside the
  app. So the off-switch and the release command matter more than they would on a website.
- **Two answers take weeks**, and everything else is days: the rights holders' replies, and
  sign-in (about three weeks of work once the owner makes its three choices). These two set the
  launch date, so they are asked for first, and the rest is built while they wait.
- **The first download is full**: 160.8 of its 161 KB, though the app as a whole has 9 KB of
  room. The app's log, the off-switch and the "new version ready" prompt must each load after
  the page is up, or a trim of the first download must come first.
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
| **Unsteady tests** | Tests that passed only on a second try in the last push. Zero. | The push's report, once built |
| **Skills with a known gap** | Rows still open in the skills table in the plan. Zero. | The plan's stage 9 |

The first one is the main measure. The others say whether we could run the app once it is out.

## The current numbers

| Measure | Value | As of |
|---|---|---|
| Launch blockers open | **24** of 46 (2026-11-17, after the store reviews ㉜, the download numbers ㉝ and the second key on the release page ㉞ closed; `make issues LAUNCH=1` lists them). Before that, **26**: 24 of the 44 on the launch page, and the two older App Store rows on the licence. Seven added 2026-11-17 by the first walk as Apple's reviewer (㉟ to ㊶); the reviewer walk itself ㉟, the first-open ribbon ㊳, the English sources ㊴, the walk tools' launch settings ㊱ and the English top bar at 320 px ㊶ closed the same day, and the archive with Apple's own check ⑪ later that day. Later still the support page ⑳ and the apps' privacy policy ㉙ closed, and one item was added for linking both from inside the app (㊸), which closed the same day. Of the 26, **7 can get the app turned down at review**, 6 stop the upload itself (four launch-page items and the two older licence rows), and 13 matter once readers have it (the launch page's "Which of these could get the app turned down" sorts them) | 2026-11-17 |
| Owner steps waiting | **10**, ordered by what each frees in "Waiting on the owner": three sign-in choices; two permission emails and a fallback date; whether the store build shows tajweed; the hifth.app first upload steps; one test problem report seen to arrive; adding the Mac to the app's store record; the Mac keyboard test permission; the EU trader answer; delete 134 merged branches and ask GitHub to purge; try the new layout on the iPad | 2026-11-17 |
| Days since a restore was practised | never | 2026-11-15 |
| Days since the release command ran clean | no release command yet; its archive, export and Apple's check ran clean on 2026-11-17 | 2026-11-17 |
| Unanswered reports and reviews | **0** store reviews, none waiting (read live with the reviews key; the app is not in the store yet). Reader reports have no folder to land in yet | 2026-11-17 |
| New crashes | readers' crashes cannot be read yet | 2026-11-15 |
| Unsteady tests | not reported yet | 2026-11-15 |
| Skills with a known gap | **10** | 2026-11-15 |

Update this table on every pass of the loop (`.claude/loop-prompts/operational-readiness.md`).

## What is left, by line of work

Six lines of work run side by side. When one is blocked, the loop works around the block or moves
to another line. It asks the owner only when every line is blocked (the rule in "How to use this
page" below). Backlog row names are in brackets.

| Line of work | Open | Free to build now | Blocked, and the way around it meanwhile |
|---|---|---|---|
| **Hearing about problems** | 2 | Readers' crashes (`launch-readers-crashes`). (Store reviews, `launch-store-feedback`, store numbers, `launch-store-numbers`, and the second key on the release page, `launch-keys-on-release-page`, are done; the numbers wait on the owner saving the vendor number.) | The app's log (`launch-logging`) has to load after the page is up, since the first download is full. (The support page, `launch-support-page`, is built and checked: it goes live with hifth.app's first upload.) |
| **Shipping a fix fast** | 5 | The release command (`launch-release-command`), the site's undo (`launch-site-undo`), reporting tests that pass only on a second try (`launch-retry-tests-hidden`) | The off-switch (`launch-remote-switch`) and the "new version ready" prompt (`launch-browser-new-version`) load after the page is up, for the same reason. The off-switch's file goes online with hifth.app's first upload; until then it is tested against a local copy. |
| **The licence** | 6 | (The citations page, `launch-citations-page`, is built and checked: it goes live with hifth.app's first upload.) Reading the page artwork's terms (`launch-page-artwork-terms`) and the recitation audio's terms (`launch-recitation-audio-terms`) | The two permissions (`launch-corpus-permission`, `launch-tajweed-permission`) wait on the owner's emails. Fallback if no answer by the date: fetch that data from hifth.app after install, or leave the tajweed colours off. The upload rows (`gpl-and-the-app-store`, `app-store-not-a-target`) close when the answers do. |
| **What Apple requires** | 3 | (The iPad and iPhone permissions file and the hifth.app file that tells Apple which links open the app, `launch-ios-entitlements`, are built and checked; the site's file goes live with hifth.app's first upload, then a link is tried on the iPad from the by-hand list.) (The archive, the export and Apple's check, `launch-archive-upload`, are done. The Mac sandbox, `launch-mac-sandbox`, is done on this laptop: built, checked by the release check and walked.) | The Mac store archive and its installer package are built and checked (`make app-archive-mac`, `make app-export-mac`, owner's yes 2026-11-17). Apple's check of the Mac package waits on the owner adding the Mac to the app's store record (waiting list, item 6), and its upload on the licence. The screen-reader walk (`launch-screen-reader-walk`): the parts a person must do go on the by-hand list. Checking the Mac app needs the keyboard test permission, or a run while the owner is away. |
| **Listing** | 2 | The store answers (`launch-store-answers`), screenshots at Apple's sizes (`launch-store-screenshots`) | The EU trader answer is the owner's; draft both ways. |
| **Accounts** | 2 | Backups and a practised restore of the notify-me list, which already exists (`launch-backups`). (The privacy policy for what the app keeps today, `launch-app-privacy-policy`, and the info panel's links to it and the support page, `launch-support-links-in-app`, are done.) | Sign-in (`launch-sign-in`) waits on the three sign-in choices. Deleting an account (`launch-account-deletion`) is built behind a switch that is off once the choice of where accounts live is made. |

## What comes next, in order

Reordered 2026-11-17 after the first walk as Apple's reviewer: what can get the app turned down
comes before what matters once readers have it, since a turned-down build costs a week.

1. **What the reviewer would trip on:** all found so far are fixed (the reviewer walk ㉟, the
   first-open ribbon ㊳, the walk tools' settings in the store copy ㊱, and the English top bar
   at 320 px ㊶). The next reviewer walk looks again.
2. **Apple's settings:** the iPad and iPhone permissions file. (The archive up to the lock,
   with Apple's own check passing, is done, and so are the Mac sandbox and the Mac store archive
   and package; Apple's check of the Mac package waits on item 6 below.)
3. **What Apple asks to link to:** the support page and the app's privacy policy are written;
   next, link both from the app's info panel, then the store answers and screenshots.
4. **The licence line:** the citations page and the two terms readings.
5. **The fast-fix line:** the release command, the site's undo, the retry report, then the
   off-switch and the prompt, each loaded after the page is up.
6. **Hearing about problems:** the app's log and readers' crashes. (The sources in English ㊴
   are fixed, and so are store reviews, store numbers and the release page on the new key.)
7. **Accounts**, as far as the sign-in choices allow; all of it once they are made.
8. **Test flight** with a few named readers, then **upload and release** once the permissions
   are in writing.

The plan has the detail of each step.

## Waiting on the owner, most work freed first

1. **The three choices on the sign-in page.** These free about three weeks of work: sign-in,
   deleting an account, and backups of reader data.
2. **Send the two permission emails, and set the date after which we stop waiting.** This frees
   only the upload, but the answer takes weeks, so the sooner it goes the better.
3. **Should the store build show the tajweed colours?** (launch item ㊲) Off: one permission
   leaves the upload's path and a reviewer sees nothing marked "unchecked". On: huffaz keep the
   feature and the upload waits on that permission too.
4. **The hifth.app first upload steps:** the Cloudflare key permission, the database step, four
   secrets, and the mail sender. These put the support page and the off-switch's file online.
5. **Send one test "Report a problem" from the simulator and say whether it arrived** (㊵).
6. **Add the Mac to the app's store record.** (Your yes to the Mac store archive came
   2026-11-17; the archive and its installer package are built and checked, and the one new
   certificate, the Mac installer one, was made.) In App Store Connect, the Mac is added on the
   app's page under "Add platform". Frees Apple's check of the Mac package, the last of launch
   item ⑧.
7. **Let the terminal run the Mac app's keyboard test**, or let it run while you are away. This
   frees checking the Mac app's keys and menus; its first open and its network were checked
   without it.
8. **Whether you trade in the EU.** Apple asks, and the answer decides what contact details are
   published.
9. **Delete the 134 merged branches on GitHub, and ask GitHub Support to purge the old commits.**
   This frees no launch work, but it finishes the clean-up of the old pictures.
10. **Try the new layout on the iPad** (the switch in the info panel). This decides whether it
   becomes the default.
11. **Save the vendor number.** In App Store Connect, open Payments and Financial Reports and
   copy the number at the top left, then type `make env-set NAME=ASC_VENDOR_NUMBER` in your own
   terminal. This frees the download numbers (㉝); `make app-release-setup` then says ok.

(Answered 2026-11-17: Apple may check the exported app before the licence is answered, ㊷; the
site publishes from this laptop, not from GitHub; the Mac store archive and its certificate
may be made.)

## Where the work stands (2026-11-17)

- Worktree `../hifth-auth`, branch `mac-store-archive`, intent `launch-mac-sandbox`. It holds
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
- The first download is at 160.1 of 161 KB (2026-11-17), so new code loads after the page is up.

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
