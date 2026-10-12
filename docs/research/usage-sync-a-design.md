# How should my usage counts from the iPad, the Mac and the browser be added together? (researcher A)

> [!tip] Short version
> We searched what Apple and others offer. The Apple routes (iCloud) are real and cheap in code, but they all need the paid Apple Developer membership, they only reach the iPad and Mac apps, and they never reach Firefox or Safari on the phone.
> Nothing found reaches all of your devices automatically without either a server or someone else's account.
> The search also found a fix for the file option: if each device keeps its own column of counts, adding a file twice can no longer count twice.
> **Recommended: carry a file, built the per-device way, now. Add iCloud for the two Apple apps later, only if you already pay for the developer membership and carrying the file between the iPad and the Mac becomes a chore.**

The raw sources, each marked as opened or only seen in a search, are in `usage-sync-a-findings.md` next to this note.

## Words used here

- **Device:** each place the app keeps its own counts. The iPad app, the Mac app, Firefox on the Mac and Safari on the phone are four, even when two of them are on the same machine.
- **iCloud:** Apple's online storage tied to your Apple account. Data an app keeps there is in *your* account, uses a little of *your* iCloud space, and the app's maker cannot see it.
- **Developer membership:** Apple's paid programme for people who build apps, 99 US dollars a year. Without it, an app cannot use iCloud at all.
- **A column per device:** keeping the counts as "this device, this day, this feature, this number", so each device only ever changes its own column, and the total is the columns added up.

## What does it change for a hafiz?

Nothing on the page, for any option. This is about the owner seeing one honest total of which features carried a week of revision, across every device it happened on, instead of three or four separate lists.
For the pitch, a single total is the stronger claim: "over a month, on every device, the similar-verses list was opened 300 times" beats "on the iPad, 120".

## Why is this being asked now?

The counting is built and is device-only. The owner asked, before choosing, whether we had looked at what the Apple world already offers for this. We had not; this note is that look.

## What happens if nobody decides?

Each device keeps its own list (option A). Nothing breaks. The cost is that the total stays in the owner's head, and the phone's counts in Safari can vanish after a quiet week, with no copy anywhere.

## What does the search say, in a few lines?

- **iCloud key-value storage** (Apple's small settings store that follows your Apple account) holds 1 MB and 1,024 entries. Your whole history is about 60 KB per device, so it fits. The iPad app and the Mac app can share one store if both carry the same identifier. Developers report changes arriving "almost immediately" between iPhone and Mac, and up to a minute on a newly signed-in device. It needs the paid membership, and it only reaches apps, not web pages.
- **CloudKit** (Apple's database in your iCloud) can, in principle, also be reached from a web page with Apple's own web library, after you sign in to Apple in that browser; the sign-in lasts at most two weeks. We found no current evidence that it works in Firefox, and it would be a large build.
- **iCloud Drive** (your iCloud files) can hold a file per device that the Apple apps write themselves; a browser on the Mac could then load it by hand.
- **Apple's own numbers** do not help. App Store analytics counts sessions from people who opted in, never features. Screen Time adds up time across devices, but per app, never per feature, and not for Firefox.
- **Privacy-first analytics services** (TelemetryDeck, Aptabase, PostHog, Plausible) are built to count many people for a developer and send everything to a server. Plausible says outright that it cannot tell one person across devices.
- **Merging libraries** (Automerge, Yjs) add counts correctly but still need something to carry the data. Counts are simple enough to add correctly without them.
- **Apps people know.** Apple Books and Streaks use your iCloud and stay on Apple devices. Day One, Kindle, Things and Obsidian Sync run their own servers and accounts. None found reaches a non-Apple browser through iCloud alone.
- **Firefox cannot keep a file open and rewrite it.** A page there can only save a download and load a file you choose. So any route that includes Firefox is either a file you carry or a server.

## How do two devices' counts add up without losing or doubling any?

This is the same for every option that adds anything up, so it is settled once here.

- **Keep a column per device.** Each device gets a random name the first time it counts. Its counts are stored under that name. A device only ever raises numbers in its own column.
- **Combine by taking the larger number for each device and day**, never by adding two copies of the same column. The total shown is every column added up.
- What that buys: adding the same file twice changes nothing; adding an older file changes nothing; two devices writing at the same moment never touch the same entry, so there is no "last one wins" to lose a day.
- **The shared storage decision says a reader's record is "written all at once" as one file.** For counts that would be wrong: two devices each replacing the one file would wipe out each other's days. Counts need the column-per-device shape instead. This is the one place that record's shape does not fit.
- **Forgetting.** On a device, "forget" clears its own column. Clearing other devices' columns is only possible where they are all in one shared place (iCloud, or a server). With files, each device forgets its own.

## What are the options?

Seven were looked at. Five are put to the owner; the rest are under "what else". A to C are the three first offered; D onward are new from the search.

### A. Each device on its own (built)

Each device shows its own list. Nothing leaves any device.

| | |
| --- | --- |
| Pros | Already built and tested. No new rule. Nothing to maintain. |
| Cons | Three or four lists for one person. The phone's Safari counts can be wiped after a quiet week with no copy. |
| Implications | None. Every other option can still be added later. |
| Day to day | Open the info panel on each device and add up in your head. |

### B. Carry a file, the per-device way (improved since first offered)

A *Save my counts* button writes a small file of this device's column and every column it has already been given. *Add counts from a file* on another device takes in the columns it has not seen, and the larger number for ones it has.

| | |
| --- | --- |
| Pros | Works on every device you use: the iPad and Mac apps, Firefox, Safari on the phone. No server, no account, no membership. Adding a file twice is harmless. Doubles as a backup of the phone's counts. Matches the notes decision, which already asked for a separate usage export, and the storage decision's "save a file, load it back". |
| Cons | Done by hand. A total is only as fresh as the last file carried. |
| Implications | The file's layout becomes something to keep readable from now on (it carries a version number). The counts leave the device only as a file you choose to save, which the privacy rule already allows for the confusion map; the check's reader list gains the save-and-load part. A test for adding the same file twice, and one for an older file. |
| Day to day | Now and then: save on the iPad, send the file to the Mac (AirDrop, the share sheet the app already has, or iCloud Drive in Files), load it there. Firefox on the Mac can load the same file. |

### D. Your own iCloud, for the iPad and Mac apps (new)

The iPad app and the Mac app each keep their column in your iCloud key-value store, one entry per device per month, a few KB each. Each app reads the others' columns and the panel shows the total. The browsers join by file (B).

| | |
| --- | --- |
| Pros | Automatic between the two Apple apps, usually within seconds to a minute. In your own Apple account, not a server we run; the app's maker cannot see it. Far inside Apple's size limits. "Forget" can clear every Apple device at once. Small code: one store, one bridge message, one listener for changes. |
| Cons | **Needs the paid developer membership** (99 US dollars a year), unless you already have it; nothing on this laptop shows one. The Mac app must move from its free stand-in signature to proper signing with permissions. Does nothing for Firefox or Safari on the phone. A mistyped store name fails silently; one forum report says values around 100–160 KB did not sync. |
| Implications | **Changes the privacy rule:** the counts would leave the device, to your iCloud, by the app's own code. That is a deliberate exception the owner has to make, and the bridge joins the list of parts that may read the counts. Ties the Apple apps to Apple's signing and membership from then on. Does not rule out B for the browsers, or C later. |
| Day to day | Nothing, once both Apple apps are signed in to the same Apple account with iCloud Drive on. The browsers still need a file now and then. |

### E. A file per device in your iCloud Drive (new)

Like D, but each Apple app writes its column as a file in its own iCloud Drive folder, which shows in Files and in Finder. The Apple apps read each other's files. Firefox on the Mac loads them by hand with B's button.

| | |
| --- | --- |
| Pros | Automatic between the Apple apps. The files are yours to see, copy and delete. Firefox on the Mac gets a file already sitting in a folder, with no carrying. |
| Cons | All of D's costs (membership, Mac signing, privacy rule), plus more moving parts: files that may not have downloaded yet, and folder setup we could not confirm from Apple's page. Safari on the phone still carries by hand. |
| Implications | Same as D. A step toward the storage decision's "your own cloud file", but in iCloud rather than the project's storage. |
| Day to day | Nothing for the Apple apps. In Firefox, load the newest file from the iCloud Drive folder now and then. |

### C. Your own online store (as first offered)

Each device sends its column to a store only you can open, behind a sign-in. The storage decision already plans this for every personal record "on the day there is sign-in", and says that is "not this year".

| | |
| --- | --- |
| Pros | Every device, Firefox included, automatic. One place to see and clear everything. |
| Cons | Needs a server to keep up and a sign-in. The first part of the app that sends something off the device on its own. |
| Implications | Reopens the rule that personal records stay on the device; its own decision. Should use the column-per-device shape, not "written all at once". Waits on sign-in, which waits on the licence question. |
| Day to day | Sign in once per device; nothing after. |

## What else was considered, and why is it not an option here?

- **CloudKit with Apple's web library (F).** The only route found that could reach Firefox through your own Apple account instead of a server of ours. Not offered because it costs everything D costs, plus a database layout, a sign-in to Apple in each browser at least every two weeks, and a web library with a thin, fiddly record (a July 2025 forum thread with no answer) and no current evidence that it works in Firefox. Worth a throwaway trial only if automatic sync in Firefox becomes the thing you most want and C is still far off.
- **remoteStorage, Dropbox or Google Drive from the page.** Reaches Firefox automatically with no server of ours, but adds a third company's account and a sign-in inside the page, for a few KB of counts.
- **Analytics services** (TelemetryDeck, Aptabase, PostHog, Plausible). Built for counting many people; every one sends to a server under the developer's account. Against the privacy rule, and less than the panel already shows.
- **Apple's App Store analytics and Screen Time.** Sessions or time per app, never per feature; App Store analytics only for people who opted in.
- **App groups.** Share data between our own apps on one device only. Nothing across devices, and Firefox cannot join.
- **Merging libraries** (Automerge, Yjs). Correct, but the column-per-device rule gives the same correctness in a few lines, and they still need a carrier.

## What would change the answer?

- **You already pay for the developer membership** and use the iPad and Mac apps far more than the browsers: put D first, with B for the browsers.
- **Sign-in arrives** (after the licence question): C takes over, using the column-per-device shape.
- **Automatic sync in Firefox becomes the thing that matters most** before sign-in: try F as a throwaway first, and expect it to be hard.
- **A week or two on several devices shows three lists are no nuisance:** stay on A.

## What is this not settling?

- Anything about other people's use. No sending, no dashboard of everyone.
- Whether the record of what you have opened, or notes, should sync the same way. They are bigger, more personal, and already have their own decisions.
- Whether the Apple apps go to TestFlight or the App Store.

## Recommendation

**B, built the per-device way, now; D for the two Apple apps later, only if the developer membership is already paid and carrying files between them becomes a chore.**
What would change it: a paid membership already in hand together with mostly Apple-app use (then D first), or sign-in arriving (then C).
