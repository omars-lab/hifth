# Adding up the usage counts from the iPad, the Mac and the browser (design, researcher B)

The raw sources behind every claim here are in the sibling findings file (usage-sync-b findings), each marked "fetched" (the page itself was opened) or "snippet only" (only a search result was seen).
Written 2026-10-11. Research only; no app code was changed.

## The short version

- **The question:** the app now counts, per day, how often the owner uses each part of it, on each device, and keeps it on that device. Should the iPad's, the Mac's and the browser's counts be added together into one total, and how?
- **The answer in one line:** keep each device on its own for now (A), but change how a day is stored so that counts from different devices can be added without ever being counted twice. Then, when one total is wanted, carry a file per device through iCloud Drive by hand (B2). Only if the paid Apple developer membership gets bought anyway, for TestFlight, let the two Apple apps sync through the owner's own iCloud (D).
- **The fact that shapes everything:** every way for the app itself to use iCloud needs the $99-a-year Apple developer membership. That is the same unpaid membership already blocking app links and TestFlight. Without it, the only ways across are a file the owner moves, or a server of our own.
- **The second fact:** today a day's record has no device name in it. Two devices' "Tuesday" records would collide, and one would overwrite the other or be added twice, whichever way they travel. That needs fixing whichever way wins, and it is cheap.

## A few words, once

- **iCloud**: Apple's online storage tied to the Apple account on a device. The app can use it in several separate ways: a small settings box (key-value storage), a database (CloudKit), or a folder (iCloud Drive).
- **The paid membership**: the Apple Developer Program, $99 a year. It is what lets an app be signed with permission to use iCloud. The Mac app today is signed "just enough to run here", with no developer team.
- **The shell**: the thin Apple app, one for iPad and one for Mac, that holds the web app inside a built-in browser view.
- **The bridge**: the message channel between the web page inside the shell and the shell's own Swift code. Today it carries three small messages.
- **Adding up correctly**: if the iPad used the jump arrows 5 times on Tuesday and the Mac 3 times, the total must be 8. It must not be 5 or 3 (one overwrote the other), and it must not be 13 after the same file is taken in twice.

## What is being decided?

Whether the counts kept separately on each of the owner's devices should become one total, and if so, by which road. The counts are a few kilobytes a day per device at most: about 40 to 100 KB per device for the 400 days kept, so about 300 KB for three devices at the high end.

## What does it change for the owner day to day?

Today the info panel shows "what you used on this device". With a total, it would show "what you used, everywhere". That is a better picture of which parts of the app earn their place, because the owner revises on the iPad and builds on the Mac, and the two are used for different things. Nothing about reading, turning pages or revising changes under any option. Only the usage panel and, for some options, a once-in-a-while chore of moving a file.

## Why is this being asked now?

Because the counting was just built (feature-usage design, its open question ①). The design already notes that the iPad app, the Mac app and the browser each count separately, even on one machine. The owner will soon want to read the numbers to decide what to keep for the pitch, and three partial pictures are harder to read than one.

## What happens if nobody decides?

Each device keeps counting on its own (option A, already built). Nothing is lost, nothing leaves any device, and the owner reads three panels instead of one. The only cost that grows with time is the record shape: the longer the day-only record stays, the more old records will need a device name filled in later. That is a one-line default ("this device") and does not get harder.

## How do the counts have to be stored so they add up correctly?

This is independent of how they travel, so it comes first.

Today one record per day holds that day's counts, and the day is the only label. If a record for "Tuesday" arrives from the Mac, the iPad has two choices, both wrong. Replace its own Tuesday (the iPad's 5 is lost) or add the Mac's numbers to its own (fine once, but taking in the same file again next week adds the Mac's Tuesday a second time).

The fix is the standard one for counters that several devices change separately. It is called a grow-only counter, and it needs no library:

- **Label each record with the device and the day**, not the day alone. Each device gets a random name, made once and kept, plus a label the owner can read ("iPad", "Mac", "Firefox on the Mac").
- **Each device only ever writes its own records.** The iPad never edits the Mac's Tuesday.
- **When records arrive from elsewhere, keep the larger count for each device and day.** A device's count for a day only ever goes up, so the larger one is always the newer one. Taking the same file in twice changes nothing.
- **The total is the sum across devices.** The panel can show the total and, folded under it, each device's share.

Apple's own sync tools leave conflicts to the app (the CloudKit sync engine says so in as many words; the old iCloud guide says a settings box just tells the app "someone else changed this"). With per-device records there is never a conflict to resolve, on any road. So **do this first, whichever option wins.** Cost: a small change to the usage store and its tests, plus filling in "this device" on the records already kept.

## What happens at forgetting?

"Forget my usage" today clears this device. With other devices' records taken in, it should clear those copies too, and the panel should say that the other devices still hold their own. Under D (below), forgetting would also have to delete this device's records from iCloud. Otherwise they come back on the next sync.

## Which of the owner's devices could each way reach?

| | iPad app | Mac app | Firefox on the Mac | Safari on the phone |
|---|---|---|---|---|
| A: each device on its own | own count only | own count only | own count only | own count only |
| B: carry a file by hand | yes, once the shell can save and open a file | yes, once the shell can save and open a file | yes (download and file picker work today) | yes (share sheet works today) |
| B2: one file per device in iCloud Drive | yes, as B | yes, as B | yes, through the Mac's iCloud Drive folder | yes, as B |
| C: our own small server with a sign-in | yes | yes | yes | yes |
| D: the owner's own iCloud, used by the two apps | yes, automatic | yes, automatic | only by file (B2) | only by file (B2) |
| E: Apple's iCloud web library in the browser | through D | through D | exists; unverified in Firefox today | exists; unverified |

Only B, B2 and C reach every device. D reaches the two Apple apps automatically and needs a file for the browser.

## What are the options?

### A: Each device keeps its own counts (built, today)

- **Pros:** nothing to build; nothing leaves any device; passes the privacy check as it stands.
- **Cons:** three panels, no total; a phone that clears its storage after a week unused loses its counts.
- **Implications:** closes no door. Every other option can start from here at any time, more easily once records carry a device name.
- **Day to day:** the owner opens the panel on each device and adds the numbers in their head.

### B: Carry a file by hand

Each device can save its records to a file and take in another device's file; the panel then shows the total.

- **Pros:** no server, no account, no money; works in Firefox today; the same kind of "a file the reader chooses to make" the confusion-map export already uses, which the privacy check already allows; the notes-export decision already promised "a separate export for usage activity".
- **Cons:** the owner has to remember to do it, and the total is only as fresh as the last file. Also, **the shell cannot do this today.** Apple's documentation says the Mac's built-in browser view refuses file picking unless the app adds code for it, and saving a download needs code the shell does not have. So both apps need a small piece of Swift, or a bridge message that hands the file to the share sheet the shell already shows.
- **Implications:** the file's shape becomes something to keep reading in later versions. The per-device records make that shape simple and stable. Whatever is built here is reused by B2, C and D's browser half.
- **Day to day:** now and then, save on one device, open on another. A minute.

### B2: One named file per device, kept in iCloud Drive (new)

The same as B, but with a habit that removes most of the chore: each device saves its file under its own name ("usage, iPad", "usage, Mac") into one iCloud Drive folder, replacing the last one. To see the total, any device takes in all the files in that folder.

- **Pros:** everything B has, plus the owner never has to pair devices up. iCloud Drive does the carrying, using the system's own save and open windows, which **need no Apple membership and no permission in the app**. Because each device only writes its own file, iCloud never sees two devices changing one file, which is where Apple's guide says file conflicts come from. Firefox on the Mac reaches the same folder through the Finder; Apple's iCloud website also lists Firefox as supported (snippet only).
- **Cons:** still a deliberate tap on each device to refresh; an iPad only pulls new iCloud Drive files when asked, so a just-saved Mac file may take a moment to appear there. Needs the same Swift work as B.
- **Implications:** the folder is the owner's own, in their own iCloud, visible and deletable in the Files app, so nothing about it needs explaining. It leaves D as an easy later step, because D would sync the same per-device records.
- **Day to day:** "Save my usage" on each device when it occurs to them; "Add up all devices" on whichever one they are reading.

### C: Our own small server, with a sign-in

The app sends each device's records to a store the project runs; every device reads the total back.

- **Pros:** automatic, everywhere, Firefox included.
- **Cons:** the first time the app's own code sends a personal record off the device, which is exactly what the privacy check is built to refuse. It needs a sign-in, which does not exist and is tied to the licensing question. And it is a server to keep running and secure for one person's few kilobytes.
- **Implications:** commits the project to accounts. That is a decision far bigger than usage counts, and the storage-model decision already puts it "not this year". If sign-in arrives for other reasons, usage would ride on it at little extra cost.
- **Day to day:** sign in once per device; after that, nothing.

### D: The owner's own iCloud, used by the two Apple apps (new)

The shell uses Apple's own syncing helper for its database (the CloudKit sync engine, which needs exactly the shell's minimum system versions) to keep each device's records in the owner's private iCloud database. The web page hands its records to Swift over the bridge and gets the other devices' records back. The browser joins by file, as in B2.

- **Pros:** automatic between the iPad and the Mac, with no server of ours and no sign-in of ours. Apple says the private database is visible only to the owner, "isn't visible in the developer portal", and counts against the owner's own iCloud storage. The storage-model decision already foresaw this road: if sign-in is answered without an account of our own, "the cloud half is replaced by whatever a reader's own cloud drive can hold". The sync engine handles retries and Apple's slowdowns itself.
- **Cons:** needs the $99-a-year membership, and a properly signed app on both platforms. A database's shape can only grow once it is live, and the app's own area in iCloud cannot be renamed or deleted. It is the most code of any option: Swift for the engine, a two-way bridge message, saving the engine's state. It does not reach Firefox. And it is the app's own code sending a personal record off the device, even if only to the owner's own account. Whether that crosses the privacy rule is a question for the owner, not settled here.
- **Implications:** once paid for, the same membership unblocks TestFlight and app links, so the cost is shared. The same machinery could later carry the bookmarks and notes, the storage model's "cloud half", which is a much bigger prize than usage counts. Doing D for usage first would be a small, low-stakes trial of that road.
- **Day to day:** nothing. The iPad and Mac panels agree within a minute or so. The browser still needs a file now and then.

### Why not iCloud's small settings box?

It is the obvious first thought, and the simplest code. But Apple's own pages argue against it here. It is meant "for app preferences", and Apple's engineer says to "stay far away" from its 1 MB limit, moving to CloudKit for "tens of KiB" (we are in that band). Apple says not to put "personal or sensitive information" in it, because it is stored unencrypted. Its rule for two devices changing it is "one wins, the other is told". It needs the same paid membership as D, and one Apple page says it needs App Store distribution. So it costs what D costs and is a worse fit.

### Why not a ready-made analytics service?

TelemetryDeck, Aptabase, PostHog and Plausible all exist to count many people's use and send it to a server, theirs or one we run. Every one is a network call from the app with usage in it, which the privacy check refuses, and each is built for crowds rather than one person. A self-hosted PostHog wants a 16 GB server. Aptabase is the lightest and open source, but it still needs a server and still sends events. Apple's own App Analytics shows only installs, sessions and crashes, nothing per feature, and the shell is not in the App Store, so it shows nothing today. Screen Time shows time in the app, never which part. None of them answers the question.

### Why not a ready-made merging library?

Automerge does have a counter that adds correctly, and Yjs and remoteStorage can carry data between devices. But they still need a way to carry the changes, a server or a file. The per-device rule above already gives the correct total in a few lines for the one shape we have. A library would be worth it only if many kinds of record (notes, bookmarks) needed to merge, which is the later storage-model question, not this one.

## What do established apps do?

- **Apple Books** syncs reading place and highlights through iCloud Drive and the owner's Apple account; that is the whole design. (fetched)
- **Things** and **Obsidian** run their own sync service with their own account, and say outright not to mix in iCloud or Dropbox. (fetched)
- **Day One** moved off both Dropbox and iCloud, saying it had duplicates on one and "data loss" on the other, and built its own service. (fetched) That is a warning for precious records. For counts that can be rebuilt from nothing, the stakes are low, so it cuts much less here.
- **Kindle** uses Amazon's own servers for the furthest page read (snippet only). **Streaks** syncs habits through iCloud, slowly on the Mac (snippet only). **Loop Habit Tracker** does not sync at all, just a backup file moved by hand (snippet only).

The pattern: apps with a business behind them run their own server (C); Apple's own app uses iCloud (D); small privacy-first apps use a file (B).

## What does each option cost to build here?

| option | new code | money | can it be undone? |
|---|---|---|---|
| per-device records (do first) | usage store and its tests | none | yes |
| A | none | none | yes |
| B | save and take-in in the panel; save and open in both apps' shells | none | yes |
| B2 | B, plus "take in every file in this folder" | none | yes |
| C | a server, a sign-in, a sync client | hosting | hard; commits to accounts |
| D | the CloudKit sync engine in Swift, a two-way bridge message, saved state | $99 a year | the app's iCloud area and the record shape are permanent |

## What would change the answer?

- **The membership being bought for TestFlight**, which makes D's money free and makes D the natural next step for the two apps.
- **The owner saying the counts are not personal enough to need the privacy rule**, or that their own iCloud is "on the device" in spirit. That would make D straightforward on principle.
- **Sign-in arriving for other reasons**, which makes C cheap.
- **The owner finding they never read the per-device panels**, which makes all of this not worth building. A stays.
- **A check showing Apple's iCloud web library works in Firefox today**, which would let the browser join D without a file. Two recent forum reports of it failing in other browsers, both unanswered, make that unlikely.

## What is this not settling?

- Whether bookmarks, notes and the confusion map should sync. That is the storage-model decision, and D for usage would only be a trial run of it.
- Whether to buy the membership. That is the TestFlight-licence decision.
- The exact file name, format or how many days a carried file keeps.

## Recommendation

Change the records to one per device and day now, keep A, add B2 (one named file per device in iCloud Drive) when one total is wanted, and switch the two apps to D only if the paid membership is bought for TestFlight and the owner says their own iCloud is fair to use.
