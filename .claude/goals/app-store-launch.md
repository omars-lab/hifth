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

## Are we on it? (checked 2026-11-16)

Not yet: 28 launch rows are open. The App Store is still recorded as "not a target", and the
upload is locked until two rights holders say yes in writing. Everything else goes ahead meanwhile.

Done so far:
- a store build can never be the private build;
- the privacy file;
- the version command;
- a real archive of the store build (Apple's own check of it and the upload are left);
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
| **Unanswered reports and reviews** | Reader reports in the support folder and store reviews with no answer. Zero. | The `operate-app` skill's commands, once built |
| **New crashes** | Crashes from readers' devices not yet in a backlog row. Zero. | The `crash-logs` skill, once it reads readers' crashes |
| **Unsteady tests** | Tests that passed only on a second try in the last push. Zero. | The push's report, once built |
| **Skills with a known gap** | Rows still open in the skills table in the plan. Zero. | The plan's stage 9 |

The first one is the main measure. The others say whether we could run the app once it is out.

## The current numbers

| Measure | Value | As of |
|---|---|---|
| Launch blockers open | **33** of 42: 31 of the 40 on the launch page, and the two older App Store rows on the licence. Six added 2026-11-17 by the first walk as Apple's reviewer (㉟ to ㊵); the first-open ribbon ㊳ closed the same day. Of the 33, **11 can get the app turned down at review**, 8 stop the upload itself (six launch-page items and the two older licence rows), and 14 matter once readers have it (the launch page's "Which of these could get the app turned down" sorts them) | 2026-11-17 |
| Owner steps waiting | **9**, ordered by what each frees in "Waiting on the owner": three sign-in choices; two permission emails and a fallback date; whether the store build shows tajweed; the hifth.app first upload steps; one test problem report seen to arrive; the Mac keyboard test permission; the EU trader answer; delete 134 merged branches and ask GitHub to purge; try the new layout on the iPad | 2026-11-17 |
| Days since a restore was practised | never | 2026-11-15 |
| Days since the release command ran clean | no release command yet | 2026-11-15 |
| Unanswered reports and reviews | no way to receive them yet | 2026-11-15 |
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
| **Hearing about problems** | 6 | Store reviews (`launch-store-feedback`), store numbers (`launch-store-numbers`), the second key on the release page (`launch-keys-on-release-page`), readers' crashes (`launch-readers-crashes`) | The app's log (`launch-logging`) has to load after the page is up, since the first download is full. The support page (`launch-support-page`) can be written now and goes live with hifth.app's first upload. |
| **Shipping a fix fast** | 5 | The release command (`launch-release-command`), the site's undo (`launch-site-undo`), reporting tests that pass only on a second try (`launch-retry-tests-hidden`) | The off-switch (`launch-remote-switch`) and the "new version ready" prompt (`launch-browser-new-version`) load after the page is up, for the same reason. The off-switch's file goes online with hifth.app's first upload; until then it is tested against a local copy. |
| **The licence** | 7 | The citations page (`launch-citations-page`), reading the page artwork's terms (`launch-page-artwork-terms`) and the recitation audio's terms (`launch-recitation-audio-terms`) | The two permissions (`launch-corpus-permission`, `launch-tajweed-permission`) wait on the owner's emails. Fallback if no answer by the date: fetch that data from hifth.app after install, or leave the tajweed colours off. The upload rows (`gpl-and-the-app-store`, `app-store-not-a-target`) close when the answers do. |
| **What Apple requires** | 4 | The Mac sandbox and signing (`launch-mac-sandbox`), the iPad and iPhone permissions file (`launch-ios-entitlements`), the archive up to the locked upload (`launch-archive-upload`) | The screen-reader walk (`launch-screen-reader-walk`): the parts a person must do go on the by-hand list. Checking the Mac app needs the keyboard test permission, or a run while the owner is away. |
| **Listing** | 2 | The store answers (`launch-store-answers`), screenshots at Apple's sizes (`launch-store-screenshots`) | The EU trader answer is the owner's; draft both ways. |
| **Accounts** | 4 | Backups and a practised restore of the notify-me list, which already exists (`launch-backups`); the privacy policy for what the app keeps today (`launch-app-privacy-policy`) | Sign-in (`launch-sign-in`) waits on the three sign-in choices. Deleting an account (`launch-account-deletion`) is built behind a switch that is off once the choice of where accounts live is made. |

## What comes next, in order

Reordered 2026-11-17 after the first walk as Apple's reviewer: what can get the app turned down
comes before what matters once readers have it, since a turned-down build costs a week.

1. **What the reviewer would trip on:** the walk tools' settings out of the store copy (㊱),
   and the rest of the reviewer walk (㉟): iPhone, small iPhone, a first launch with no
   connection, rotation, split view, larger text. (The first-open ribbon ㊳ is fixed.)
2. **Apple's settings:** the Mac sandbox, the permissions file, the archive up to the lock.
3. **What Apple asks to link to:** the support page and the app's privacy policy, then the store
   answers and screenshots.
4. **The licence line:** the citations page and the two terms readings.
5. **The fast-fix line:** the release command, the site's undo, the retry report, then the
   off-switch and the prompt, each loaded after the page is up.
6. **Hearing about problems:** store reviews, store numbers and the release page on the new key;
   the app's log and readers' crashes. (The sources in English ㊴ are fixed.)
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
6. **Let the terminal run the Mac app's keyboard test**, or let it run while you are away. This
   frees checking the Mac app once the sandbox is on.
7. **Whether you trade in the EU.** Apple asks, and the answer decides what contact details are
   published.
8. **Delete the 134 merged branches on GitHub, and ask GitHub Support to purge the old commits.**
   This frees no launch work, but it finishes the clean-up of the old pictures.
9. **Try the new layout on the iPad** (the switch in the info panel). This decides whether it
   becomes the default.

## Where the work stands (2026-11-17)

- Worktree `../hifth-auth`, branch `store-feedback`, made from main after #636 (the new layout
  and the size limit raise). It is pushed, with no pull request yet. It holds the session note,
  the loop's rule on blocks, this page, and the first walk as Apple's reviewer: the review notes
  rewritten to match what the app shows, "A rough build to try" gone from three settings, the
  report's device line, the designs link, two walk scripts, the reviewer section of the walk
  checklist, and six new launch rows (㉟ to ㊵).
- The reviewer walk's commits carry `intent start launch-reviewer-walk`; the store-feedback
  skill's carry `launch-store-feedback`.
- None of the 42 launch rows names who the work is for (a use case), so every commit label
  warns. Add one use case for the launch, such as "a reader hits a problem and gets a fix
  within days", to `docs/use-cases.json` and name it on each launch row.
- Next item: the store-feedback skill (`launch-store-feedback`). The key is `hifth-reviews`;
  its file sits in `~/.appstoreconnect/private_keys/` and is never read or printed.
- The first download is at 160.8 of 161 KB, so new code loads after the page is up.

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

### To build

| What | Tool | Why |
|---|---|---|
| Archive, upload, review, staged release | the `release-app` skill, started 2026-11-16 with the version command | The rest of the release has no command yet |
| Store reviews and ratings, with drafted answers | new `store-feedback` skill, on the `hifth-reviews` key | Nothing reads what readers write in the store |
| Downloads and sales | new `store-numbers` skill, on the same key | Nothing counts them |
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
