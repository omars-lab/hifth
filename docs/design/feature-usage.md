# How often do I use each part of the app?

**Status:** built, device-only. The owner chose (①, 2026-10-11) to have the iPad and Mac apps keep their counts in step through the owner's own iCloud; that waits on the paid Apple membership (②). Until then each device keeps its own list.

> [!tip] Short version
> The info panel now has a section, *How you use the app*. It lists every feature you have used, most used first, with how many times, a little strip of the last fourteen days, and the last day you used it.
> It counts on this device only, by feature name only. It never records which verse was open, what a note said, or which commentary was read, and nothing leaves the device.
> Chosen: the iPad and Mac apps will keep the counts in step through your own iCloud (D), with Firefox and the phone joining by a file. It waits on the paid Apple membership; until then each device counts on its own.

## Words used here

- **Feature:** one thing the app does that you can choose to use: turning the page, the similar-verses list, the commentary, a pen, and so on. The full list is below.
- **A use:** one opening. Opening the commentary counts once, however long it stays open. Picking the highlighter counts once, however many passages it then marks.
- **The info panel:** the sheet that opens from the app's name in the top bar, where the settings live.

## What does it change for a hafiz?

Nothing on the page. It is for the owner, to see which parts of the app actually get reached for during a revision session and which are built but never touched.
For the pitch, it is a way to say honestly which features carried a week of real use, rather than guessing.
For any hafiz who opens the panel, it is the same promise the record of what you have opened makes: what is counted is yours, it stays on your device, and one button forgets it.

## What does it count?

| feature | counted when |
| --- | --- |
| Turning the page | the page changes after you have touched the app; where the app opens is not a turn |
| Similar verses | the list opens |
| Commentary | the commentary opens |
| Roots | the roots list opens |
| Listening | a recitation starts from the verse menu or a passage |
| Share | the share card opens |
| Go to | the go-to box opens |
| Zoom | you zoom in past the whole page |
| Verse menu | the menu for a verse opens |
| Word parts | a word's parts open |
| What you have opened | the record's map opens |
| Tajweed colours key | the key opens |
| Choosing the mus'haf | the mus'haf chooser opens |
| This panel | the info panel opens |
| Each pen | you pick that pen |

Two pages side by side was left out on purpose: on a wide screen it is on every visit, so it would only count visits.

## Where is it kept, and who can see it?

In this browser's own storage on this device, one line per day, for 400 days (long enough to compare a month with the same month last year).
The privacy check that guards the record of what you have opened now guards these counts the same way. Only four parts of the app may read them, and none of those can send anything off the device. A new reader of the counts fails the checks before it can be pushed.
iOS can empty a web page's storage after weeks without a visit. The panel says the day counting began, so a list that reads "never" after that can be told apart from one that has been counting for a month.

## Open questions, and what would answer each

### ① Should the counts from my iPad, Mac and phone be added together? · **answered**

Today each device keeps its own counts, and the iPad app, the Mac app and the browser each count separately even on the same machine.
Two researchers looked at what Apple and others offer, and a third checked them; the checked note is [usage-sync-consolidated.md](../research/usage-sync-consolidated.md), with the sources behind each claim.

**Answered 2026-10-11 by the owner: D**, the owner's own iCloud for the two Apple apps, picked with the paid membership and the privacy-rule change in front of them. What it waits on and what building it involves is ②.

Two things hold whichever option is chosen. Each device's counts must carry that device's name, and arriving counts keep the larger number for each device, day and feature, so the same file taken in twice changes nothing. And the iPad and Mac apps could not save or open a file when this was asked; that is now fixed (native-shell ㉛), so the file leg no longer waits on anything.

| | A. Each device on its own (built) | B. Carry a file between devices | B2. One file per device, in an iCloud Drive folder (new) | C. Keep them in your own online store | D. Your own iCloud, for the two Apple apps (new) |
| --- | --- | --- | --- | --- | --- |
| How | nothing more to do | a *Save my counts* button writes a small file; *Add counts from a file* on another device takes it in | as B, but each device saves under its own name into one iCloud Drive folder, replacing its last file; *Add up all devices* takes in every file there | each device sends its counts to a store only you can open | the iPad and Mac apps keep each device's counts in your private iCloud database, with Apple's ready-made sync helper; the browsers join by file |
| Reaches | each device sees only itself | all four: iPad app, Mac app, Firefox, the phone | all four | all four | the two Apple apps automatically; Firefox and the phone only by file |
| Pros | nothing leaves any device; already working | one total; no server, no account, no money; adding a file twice is harmless; a backup of the phone's counts | as B, and no pairing devices up: iCloud Drive carries the files; you save with the system's own window, so no paid membership | always one total, nothing to remember | automatic between iPad and Mac, usually within a minute; in your own Apple account, unseen by the app's maker |
| Cons | four separate lists for one person | done by hand; only as fresh as the last file; the Apple apps need the file fix first | still a tap to refresh; the iPad fetches new iCloud Drive files only when asked; the Apple apps need the file fix first | the first thing in the app that sends anything off the device; the privacy check would have to make an exception | needs the paid Apple membership (99 US dollars a year) and proper signing; the most code; does not reach Firefox or the phone |
| Implications | none | the file's layout becomes something to keep readable; tests for adding a file twice and an older file | the same as B; makes D an easy later step, since D carries the same per-device counts | reopens the rule that personal records never leave the device; needs its own decision, a sign-in, and a server to keep up | changes the privacy rule on purpose, even if only to your own iCloud; the shape of a record in Apple's database can only grow once live; the same road could later carry bookmarks and notes |

Not offered, and why: Apple's small iCloud settings box (Apple says not to keep personal information in it, and to move to its database past tens of kilobytes); Apple's web library for Firefox (nothing current shows it working there); analytics services (they all send to a server).

Recommended when asked: A now, B2 for one total, D only once the paid membership is bought. The owner chose D.
C was not chosen and stays set aside: it would send the counts to a store outside Apple, crossing a line the app has held since the record of what you have opened was built.

### ② Keep the iPad and Mac counts in step through my own iCloud · **blocked**

Waiting on the paid Apple membership and proper signing: the iCloud database will not open for an app signed the way the apps are signed today, so nothing built for it could be tried for real. The same membership is owed before sending the app to named testers (native-shell ㉚).

**What it changes for a hafiz:** for the owner, one list of what got used across the iPad and the Mac, without doing anything; for any other reader, nothing until they choose to turn it on.

What building it involves, in order, once the membership is in hand:

1. Each device's counts carry the device's name, and arriving counts keep the larger number for each device, day and feature. Every road needs this, and it can be tested on its own.
2. The two Apple apps keep each device's counts in the owner's private iCloud database, with Apple's ready-made sync helper. The page hands its counts to the app and reads the others back; the page itself still sends nothing anywhere.
3. Firefox and the phone join by a file: *Save my counts* on one, *Add counts from a file* on another, using the save and open windows the apps now have.
4. The privacy check fails any new reader of the counts on purpose. This is the deliberate exception to it: the app's own bridge, named in the check and written down in this page when it is added, not slipped past it.
5. Following the rule that a built runner-up stays as a setting: syncing is the default once built, and *each device on its own* stays in the info panel for a reader without iCloud or who would rather not.

What would unblock it: the membership being bought, which the TestFlight move needs anyway.

## What else could it show?

Built: the list, most used first, each with its fortnight strip and last day; the features never used folded underneath, so they are one tap away and not in the way.
Not built yet, and cheap if wanted: a week-by-week view for one feature; counts split by device kind (phone, iPad, Mac) once B exists; a line for how long a session lasted. The last one is the only one that would count time rather than openings, and it is left out until there is a reason to want it.

## What is this not settling?

Anything about other people's use. There is no sending, no dashboard of everyone, and no plan for one. If the app is ever released, whether to ask its readers for anything at all is its own decision, made then.

## Where it lives

The names and the sums: `apps/web/src/usage.ts`. Where the counts are kept: `apps/web/src/usage-store.ts`. The two ways the app says something was used: `apps/web/src/use-count.ts`. The panel section: `apps/web/src/components/UsageReadout.tsx`. The privacy check: `scripts/gate-revision-privacy.mjs`.
Tests: `usage.test.ts`, `usage-store.test.ts`, the privacy check's own tests, and the browser test `e2e/usage.spec.ts`, which caught the app counting where it opened as a page turn.
