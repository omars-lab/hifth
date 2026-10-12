# Adding up the usage counts across devices: what is out there (researcher A, raw findings)

Searched 2026-10-11 for the open question in the feature-usage design note: should the counts from the iPad app, the Mac app and the browsers be added together, and how.
This file is the raw record. The design note built on it is `usage-sync-a-design.md`, next to this one.

**How to read each entry.** *Fetched* means the page itself was opened and read. *Snippet only* means only a search result's summary was seen, so the claim is weaker. *Failed* means the page could not be opened, and why.
Apple's documentation pages render with script, so most were read through Apple's own documentation data address (the same page, served as data). Where the normal page gave nothing, that is said.

## What is the app's own starting point?

These are not web sources, but every option below has to fit them.

- **What is counted, and how big it is.** One record per calendar day, holding a count for each of 22 features (14 parts of the app and 8 pens), kept 400 days. A full day with every feature used is about 400 bytes written out; a typical day with half a dozen features is nearer 150. So one device's whole history is roughly 60 KB typical and 160 KB at the very most.
- **The privacy rule.** The app's privacy check holds the usage counts to the same rule as the record of what you have opened: only a closed list of parts of the app may read them, and the parts that keep them may contain no way of sending anything. Any option where the counts leave the device, even to the owner's own iCloud, needs that rule changed on purpose and the bridge to the Apple apps added to the list of readers.
- **What the owner has already decided for other personal records.** The storage decision (the reader's own record) says: today the record stays on the device and the reader can save it to a file and load it back; on the day there is sign-in, each reader gets their own cloud file on the project's hosted storage, "written all at once", and sign-in is "not this year". The notes-export decision (owner, 2026-09-02) already asked for "a separate export for usage activity". So a file for the counts is partly decided already.
- **One place the existing model does not fit.** "Written all at once" means a file replaced whole each time. For counts that is wrong: two devices each replacing one shared file would wipe out each other's days. Counts need one part per device, added up on reading (see the merge entries below).
- **How the Apple apps are signed today.** The Mac app is signed with a stand-in signature that costs nothing and carries no permissions; its permissions file is empty. The iPad build is signed with the developer certificate found on this laptop. On this laptop the only signing certificate is an everyday development one; there is no App Store distribution certificate and no Developer ID certificate. That does not prove the owner has no paid Apple Developer membership (a paid member can have only the development one too), but nothing here shows one. A TestFlight route exists in the build, held shut until the licence decision is settled.
- **The bridge.** The web page and the Apple apps talk through a small message bridge that today carries three messages: ready, a route change and share. A fourth message for the counts would be new.

## Apple: iCloud key-value storage

### Apple's reference page for the key-value store
<https://developer.apple.com/documentation/foundation/nsubiquitouskeyvaluestore> — **fetched** through Apple's documentation data address (`/tutorials/data/documentation/foundation/nsubiquitouskeyvaluestore.json`). The normal page returned only a title; the first summary of it was the reading tool's own guesses and is not used here.
- "The total amount of available storage space for all values is 1 megabyte." "Your app can have no more than 1024 keys." "The maximum length for each key string is 128 characters." A single value can be up to 1 MB.
- A write that breaks a limit fails and posts a change note with a "quota violation" reason.
- Writes are kept in memory, written to disk later, and forwarded by iCloud "at appropriate times". No timing is promised. With no Apple account signed in, changes stay on the device and are sent when one signs in.
- "To use this object, you must distribute your app through the App Store or Mac App Store, and you must request the iCloud key-value store entitlement." **Tension:** the developer-forum threads below show developers syncing with it during development, and Apple's capability tables (below) list it for Developer ID Mac apps too. Not resolved here; the plain reading is that a development build works and the sentence is about shipping.
- No conflict rule is named. The page says only that iCloud "reconciles" the values. Commonly it is said to be last-writer-wins per key; the page does not say so.
- Platforms: iOS/iPadOS 5, macOS 10.7, and others. Not deprecated.

### The key-value store identifier permission
<https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.ubiquity-kvstore-identifier> — **fetched** (data address).
- "The container identifier to use for iCloud key-value storage." Added by turning on iCloud and "Key-value storage" in Xcode. Says nothing on sharing between an iOS and a Mac app.

### Synchronizing app preferences with iCloud (Apple sample article)
<https://developer.apple.com/documentation/foundation/synchronizing-app-preferences-with-icloud> — **fetched** (data address).
- The sample runs on iOS and macOS, and "It's important that the key-value store ID portions are the same between both targets." So one store can be shared between the iPad app and the Mac app if both carry the same identifier and the same team.
- "The key-value store is intended for storing data that changes infrequently … The more frequently the app make changes, the more likely the changes will be deferred." Counts change many times a day, so writes should be batched (say, once when the app goes to the background), not on every tap.
- Meant for "preference, configuration, and app-state data". A few KB of counts per device fits the size; "infrequently changing" is a stretch unless writes are batched.
- If iCloud is off, "the app still keeps a local copy". Setup check: "verify that iCloud Drive is turned on. Then log into both devices with the same iCloud account."

### Developer forum: first-launch delay (March 2023)
<https://developer.apple.com/forums/thread/726593> — **fetched**.
- On a newly signed-in device a value read as empty at launch and appeared after about a minute. An Apple engineer: many parts of iCloud sync at first sign-in, so there may be a delay, though the store "should automatically try to fetch at a higher priority" at launch. No way to force it.

### Developer forum: iPhone and Mac synced at once; the watch never did (September 2022)
<https://developer.apple.com/forums/thread/715381> — **fetched**.
- The poster's "iPhone app and Mac app … change happens almost immediately". The watch app never synced because its key-value identifier defaulted to a different value; Apple's fix was to make the identifier "the same across all platforms". **Lesson:** a mismatched identifier fails silently.

### Developer forum: is the data there at launch on another device? (August 2025)
<https://developer.apple.com/forums/thread/796134> — **fetched**.
- Apple engineer: "a synchronization activity happens shortly after a CloudKit app is launched. (NSUbiquitousKeyValueStore is based on CloudKit, btw.)" Listen for the change note rather than assume the value is there at launch.

### A value of about 100–160 KB that never synced
**Snippet only**, from a search summary of forum threads; the thread itself was not identified or opened.
- A developer reported one key holding about 160 KB that did not reach the other device. Treat as a warning to keep each value small (for example one key per device per month, a few KB each), not as a fact.

## Apple: who may use iCloud at all

### Supported capabilities, iOS and iPadOS
<https://developer.apple.com/help/account/reference/supported-capabilities-ios> — **fetched** (raw page downloaded and its table read; the reading tool lost the tick marks, so the table was parsed directly).
- Columns: paid Apple Developer Program, Enterprise, and the free Apple Account.
- App groups: all three. **iCloud CloudKit, iCloud documents, iCloud key-value storage: paid and Enterprise only. Not the free account.**

### Supported capabilities, macOS
<https://developer.apple.com/help/account/reference/supported-capabilities-macos> — **fetched** (raw page parsed).
- Columns: paid Program, Developer ID, free Apple Account. App groups: all three. **iCloud CloudKit, documents, key-value: paid Program and Developer ID only. Not the free account.**
- So every iCloud option needs the paid membership, and the Mac app would have to move from its free stand-in signature to signing with the team and a provisioning profile.

### What the Apple Developer Program includes
<https://developer.apple.com/programs/whats-included/> — **fetched**.
- "99 USD per membership year." CloudKit is listed as a membership service, "up to 1PB of free storage for each app".

## Apple: CloudKit (Apple's own database service)

### CloudKit framework overview
<https://developer.apple.com/documentation/cloudkit> — **fetched** (data address).
- "A valid iCloud account is only necessary when you want to save data that is specific to a single user."

### CloudKit product page
<https://developer.apple.com/icloud/cloudkit/> — **fetched**.
- "Store private data securely in your users' iCloud accounts." "Seamlessly syncs across iOS, iPadOS, macOS, tvOS, watchOS, visionOS and the web." "Configure fields in private CloudKit databases to be encrypted."

### The private database
<https://developer.apple.com/documentation/cloudkit/ckdatabase/scope/private> — **fetched** (data address, plain-text form).
- Records in a private database "are not visible to the application developer via the Developer Portal" and "are counted towards the owner's iCloud account storage quota". So the counts would sit in the owner's own iCloud, using a few KB of the owner's own storage, unseen by the developer.

### CloudKit container and quota errors
<https://developer.apple.com/documentation/cloudkit/ckcontainer> and the quota-exceeded error page — **snippet only**.
- Private data is charged to the user's iCloud storage; using the private database needs an active iCloud account on the device.

### Apple's ready-made sync loop for CloudKit
<https://developer.apple.com/documentation/cloudkit/cksyncengine-5sie5> — **fetched** (data address).
- iOS 17 and macOS 14, which are exactly this app's lowest versions. Pushes and pulls changes for the app, retries network errors, only syncs with an account signed in. Needs the CloudKit and remote-notification permissions.
- "CKSyncEngine does *not* handle errors that require application-specific logic." The app must still decide how two edits of one record combine, and must save the engine's own state between launches. Timing "is indeterminate".

### SwiftData with CloudKit
<https://developer.apple.com/documentation/swiftdata/syncing-model-data-across-a-persons-devices> — **fetched** (data address).
- Needs iCloud and background remote notifications; "The iCloud capability requires an active Apple Developer account". Syncs to the private database. CloudKit cannot enforce "unique"; changes arrive "in an indeterminate order". No conflict rule is described.
- For this app it would mean a second, Swift-side copy of the counts, because the counts live in the web page's storage. The web page would still need the bridge.

### CloudKit JS (Apple's library for reaching CloudKit from a web page)
<https://developer.apple.com/documentation/cloudkitjs> — **fetched** (data address).
- Lets a web page reach "the same public and private databases as your CloudKit app on iOS or macOS". Needs an existing CloudKit container, web services turned on, and an API token "for websites, embedded web views, or when you need to authenticate the user". Loaded from Apple's address (`cdn.apple-cloudkit.com/ck/2/CloudKit.js`). Not marked deprecated. **No browser list is given.**

### CloudKit Web Services reference (archived guide)
<https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/SettingUpWebServices.html> — **fetched**. Last updated 2016-06-13, in Apple's documentation archive, so possibly out of date.
- "Some database operations require that users sign in using their Apple ID … Apple will present the actual sign-in page through a redirect." The sign-in token lasts 30 minutes, or 2 weeks with "Keep me signed in". So a Firefox page would need the owner to sign in to Apple at least every two weeks.

### Developer forum: CloudKit JS sign-in returns nothing (July 2025)
<https://developer.apple.com/forums/thread/795097> — **fetched**.
- Sign-in succeeded but the app saw no user; Apple's reply was only "check the token and container, regenerate the token, try the catalog sample". No accepted answer. Shows the web path is fiddly and thinly supported.

### Does CloudKit JS work in Firefox?
**Snippet only.** A search found an old tutorial's general claim that CloudKit JS works in "mainstream browsers" including Firefox, and an Android web-view user whose Apple sign-in hung. Nothing current or tested. **Untested here:** whether CloudKit JS works in Firefox today, and whether it would work from the Apple apps' own private web address at all. Do not treat either as working.

## Apple: files, app groups and the bridge

### iCloud Drive container
<https://developer.apple.com/documentation/foundation/filemanager/url(forubiquitycontaineridentifier:)> — **fetched** (data address).
- Gives the app its own iCloud Drive folder, declared in the app's permissions; may be slow, so call it off the main thread; returns nothing if iCloud is unavailable.

### Making that iCloud Drive folder visible in Files and Finder
<https://developer.apple.com/documentation/bundleresources/information-property-list/nsubiquitouscontainers> — **failed** (not found at the data address). From memory, not checked: a setting in the app's information list makes the folder show in Files and Finder under the app's name. Needs checking before it is relied on.

### App groups
<https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.application-groups> — **fetched** (data address).
- Lets apps from one developer team share a folder and talk to each other on one device. Nothing about syncing between devices. Free accounts may use it. Firefox is not one of our apps, so it cannot join.

### Asking the Apple app a question from the page and getting an answer back
<https://developer.apple.com/documentation/webkit/wkscriptmessagehandlerwithreply> — **fetched** (data address).
- The page sends a message and the app replies. This is the shape a "read the other devices' counts" message would take.

### Saving a file from the page inside the Apple apps
<https://developer.apple.com/documentation/webkit/wkdownload> — **fetched** (data address).
- iOS 14.5 and macOS 11.3. A file the page saves has to be caught by the app; the share sheet the bridge already uses is the other route.

## Apple: its own usage numbers

### App Analytics usage metrics
<https://developer.apple.com/help/app-store-connect-analytics/engagement/app-usage> — **fetched**. (The older overview address <https://developer.apple.com/help/app-store-connect/view-app-analytics/view-app-analytics-overview/> **failed**, page not found.)
- "Sessions: The number of times the app has been used for at least two seconds." Also active devices, crashes, installs, deletions. Broken down by version, device, platform, region, date.
- "App usage data is collected only from users who have agreed to share diagnostics and usage information with app developers."
- Nothing about features inside the app or custom events. That it covers only App Store and TestFlight copies is **not stated on the page** and is not checked; it is the common understanding.

### Device Activity (the developer face of Screen Time)
<https://developer.apple.com/documentation/deviceactivity> — **fetched** (data address).
- Watches "application and website activity" by app, category and website, for things like bedtime limits. Nothing about features inside an app. Parental-control permissions are widely said to be needed; the page does not say.

### Screen Time on the Mac
<https://support.apple.com/guide/mac-help/mchlf2c0c770/mac> — **fetched**.
- Reports time by app, category and website, plus pickups and notifications, for one device or all devices. Nothing inside an app.
- The "Share across devices" switch (add time from other devices on the same Apple account): **snippet only**, from Apple help pages seen in a search.
- The iPhone Screen Time page <https://support.apple.com/guide/iphone/get-started-with-screen-time-iphbfa595995/ios> **failed**: the reading tool cut it off before the content.
- **So:** Screen Time can say "Hifth, 40 minutes today, on all devices", which already adds up across devices, but only for the Apple apps, only as time, and never per feature.

## Privacy-first analytics services

### TelemetryDeck (German analytics service built for Apple apps)
<https://telemetrydeck.com/privacy> — **failed** (secure connection refused, both through the reading tool and directly).
<https://github.com/TelemetryDeck/JavaScriptSDK> — **fetched**.
- A web library exists for "modern evergreen browsers"; you give it any string that names the user, and it is "cryptographically anonymized with a hash". So the same name on every device would let one person's devices be added up on their dashboard.
- Pricing, free allowance (50K or 100K events a month depending on the source), and the on-device double hashing: **snippet only**.
- Data goes to TelemetryDeck's servers, under the developer's TelemetryDeck account.

### Aptabase (open-source analytics for apps)
<https://github.com/aptabase/aptabase> — **fetched**. (The home page **failed**, secure connection refused.)
- "Collect minimal usage data without using unique identifiers", built around sessions. Server is open source (AGPL v3), can be self-hosted "free, but you are responsible for maintenance". Libraries for Swift and for web apps.
- No user identifier at all means it cannot add up one person's devices; it counts sessions.

### PostHog, self-hosted
<https://posthog.com/docs/self-host> — **fetched**.
- Self-hosting is "officially unsupported"; the minimum server is 4 processors, 16 GB of memory, 30 GB disk. The hosted version's free allowance is 1M events a month.

### Plausible (privacy-first website analytics)
<https://plausible.io/docs/custom-event-goals> — **fetched**. <https://plausible.io/data-policy> — **fetched**.
- Custom events are for web pages. Visitors are told apart by a hash of the site, the address, the browser and a salt that changes daily, which "does not let us recognize the same visitor across days, across devices". So it cannot add up one person's devices, by design. Data held in the EU.

**What all four share:** they are built to count many people for a developer. They send data to a server (a company's or one you run), under the developer's account. For one owner counting their own use they add a server and a sending path and give back less than the counts already shown in the info panel.

## Web: syncing without a server of our own

### Automerge (a library for data that merges by itself)
<https://automerge.org/docs/hello/> — **fetched**. <https://automerge.org/docs/reference/documents/counters/> — **fetched**.
- "A pure data structure library that does not care about what kind of network you use." Something must still carry the data between devices.
- Its counter type adds concurrent increments: from 3, one device adding 2 and another adding 3 gives "the desired value of 8", where a plain number would give 5 or 6.
- For daily counts the same result is reached with no library (see the next entry).

### Yjs (another library of this kind)
<https://docs.yjs.dev/> — **fetched**.
- Merges without conflicts; "doesn't make any assumptions about the network". Real-time sync usually runs through a small relay server (WebSocket or WebRTC signalling). Same lesson as Automerge.

### Grow-only counters (the textbook way to add counts from several devices)
<https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type> — **fetched**.
- Each device "is assigned its own slot … which it increments locally". Merging takes the larger number per slot; the total is the sum of the slots. "The merge function is commutative, associative, and idempotent", which means merging the same copy twice changes nothing.
- **For this app:** keep counts as device → day → feature → number. Each device only raises its own numbers. Adding another device's file takes the larger number for each of that device's days. Adding the same file twice, or an older copy, does nothing. This removes the "a file added twice counts twice" problem the design note lists against carrying a file.

### remoteStorage (an open standard for storage the user owns)
<https://remotestorage.io/> — **fetched**. <https://github.com/remotestorage/remotestorage.js> — **fetched**.
- The user connects their own storage account; the app needs no back end. The library can also use "a person's Dropbox or Google Drive account". Says it is "actively maintained"; no release date visible.
- The only route found that would reach Firefox automatically without a server we run, at the cost of a third account (a remoteStorage provider, Dropbox or Google) and a sign-in flow from inside the web page.

### Saving and opening files from a web page, by browser
<https://developer.mozilla.org/en-US/docs/Web/API/Window/showSaveFilePicker> — **fetched** (says "Limited availability", "experimental"; its table did not come through).
Mozilla's browser support data, version 8.1.5 dated 2026-10-08, from <https://unpkg.com/@mdn/browser-compat-data/data.json> — **fetched** (downloaded and looked up directly):
- Save-file and open-file pickers: Chrome only. **Not in Firefox, not in Safari.** So a page cannot keep a file open and rewrite it in place in the owner's browsers.
- The share sheet from a web page: Safari on iPhone yes; **Firefox on the desktop only behind a hidden setting**.
- A plain file chooser (choose a file to load) and a plain download: everywhere.
- The browser's private file space and the "please keep my storage" request: Firefox 111+ and 57+, Safari 15.2+.
- **So:** a file the owner saves and later loads is the one file route that works in Firefox, Safari on the phone and the Apple apps alike.

### WebKit: storage that clears itself
<https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/> — **fetched** (2020).
- Safari deletes a site's stored data after "seven days of Safari use without user interaction on the site". Home-screen web apps keep their own count and are not expected to lose data. Not said for apps that host a web view.
<https://webkit.org/blog/14403/updates-to-storage-policy/> — **fetched** (2023).
- A site can ask to be kept ("persistent mode"); Safari grants it on its own judgement, for example for a home-screen web app.
- **For this app:** the phone's counts in Safari can vanish after a quiet week. Any adding-up option is also a backup of that phone's counts, which is a reason to want one.

## How established personal apps sync one person's devices

### Apple Books
<https://support.apple.com/guide/books/icloud-read-listen-devices-ibks86dab303/mac> — **fetched**.
- Reading position, bookmarks, highlights, notes and collections sync through the owner's iCloud; same Apple account and iCloud Drive with Books turned on. Apple devices only.

### Kindle (Whispersync)
**Snippet only**, from 2011–2014 pages and a forum. Last page read, bookmarks, highlights and notes sync through the Amazon account, including in a web reader. Amazon runs the server.

### Day One (journal)
<https://dayoneapp.com/guides/day-one-sync/day-one-sync-faq/> — **fetched**.
- Built its own sync service because "Dropbox and iCloud were never 100% successful for all of our users" (duplicates on Dropbox, data loss on iCloud). Needs a Day One account; has a web version.
- That some data, including "usage statistics", is not end-to-end encrypted, and that iCloud holds the encryption key: **snippet only** (Day One's encryption FAQ, seen in search).

### Things (to-do app)
<https://culturedcode.com/things/support/articles/2803586/> — **fetched**.
- Free Things Cloud account by email; "Third-party services like iCloud, Dropbox, etc. are not supported"; no browser access. Encrypted in transit and at rest on their server.

### Obsidian
<https://obsidian.md/help/sync/security> — **fetched**. <https://obsidian.md/help/sync-notes> — **fetched**.
- Paid Obsidian Sync with end-to-end encryption ("We can't read your data"), servers on DigitalOcean. Or iCloud, OneDrive, Google Drive, Syncthing (device to device), or Git. Warns: "Avoid syncing the same vault across multiple services."

### Streaks (habit tracker)
<https://apps.apple.com/us/app/-/id963034692> — **fetched**.
- "Tasks sync across all of your devices using iCloud." Privacy label: crash data only, not linked to you. Apple devices only. (A review saying sync is quick and that theme settings do not sync: **snippet only**.)

**The pattern.** Apps that stay on Apple devices use the owner's iCloud (Books, Streaks). Apps that also reach a browser or other systems run their own server and their own account (Day One, Kindle, Obsidian Sync, Things). None found reaches a non-Apple browser through iCloud alone. Hand-carried or folder-synced files (Obsidian with iCloud, Syncthing or Git) are the route for people who want no one's server.

## What was not checked

- Whether the owner already pays for an Apple Developer membership.
- Whether CloudKit JS signs in and works in today's Firefox, or from the Apple apps' private web address.
- How Apple settles two devices writing one key-value entry at the same moment (not documented; the per-device design avoids needing to know).
- The exact name of the setting that shows an app's iCloud Drive folder in Files and Finder (page not found).
- TelemetryDeck's own pages (could not connect).
