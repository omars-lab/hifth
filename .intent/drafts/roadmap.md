# What is still open

*This is a draft, written by `intent roadmap` on 2026-11-11. Running the command again writes over it.*

127 open tasks: 6 now, 68 next, 53 later. 5 name a use case, 6 name only a part of the product, 116 are tied to nothing yet.

122 of 127 open tasks name nobody they are for.

## Now

### revise-with-no-network

Open it in a masjid basement, on a plane, a week after I last used it, and have it just work.

- **check-offline-survival**

### Part of the product: settings

The reader's own choices: the reading settings in the top bar (or behind one button, in a drawer), and every "which way do you want this" choice in the info…

- **drawers-for-every-tool**: Owner's page comments of 2026-11-07: settings, verse and word drawers stacked one above the next, look-alike verses as sections with empty placeholders, verse…

### Part of the product: golden-images

The visual gate: highlight geometry the DOM cannot describe, pinned as images.

- **word-drawer-stacks-on-verse**: Owner's page comment of 2026-11-07 asked whether a tap on a word opens a word drawer stacked on the verse drawer.

### Tied to nothing yet (3)

- **pitch-first-passage-ready**: The next most important thing for the pitch (2026-11-09): none of the six chosen passages is demo-ready yet.
- **pitch-commentary-differs-from-print**: Found walking the desktop pitch: 125 notes repeated a passage where the capture took a paragraph twice across a page break; joined in…
- **drawer-holds-its-tools**: Owner's page comment of 2026-11-07 asked for Share, Same roots and the commentary to open as sections inside the verse drawer instead of their own sheets.

## Next

### have-it-my-way-and-keep-it

Where the app could work two ways, let me pick the one I like, and remember it next time.

- **app-pages-settings-and-developer**: Owner's page comment of 2026-11-07: settings should be a page of their own, reached from page icons along the bottom like a Mac app, with the mushaf as the…

### pick-a-pen-without-leaving-the-verse

When I squeeze my pencil, give me the pens right where I am writing, so I can mark a mistake without looking away from the verse.

- **pencil-pens-as-rings**: Owner, 2026-11-10: the pens at the Apple Pencil's tip laid out as rings around it, with an outer ring for a tool's own choices (the highlighter's four pens…

### see-what-i-have-not-opened-lately

Keep a private record of what I have actually opened, see it — which pages, hizb or juz have gone weeks without me — and press the one that has waited longest…

- **calendar-of-each-days-work**: Owner, 2026-11-10: a calendar with numbers for each day (mistakes added, pages they fall on, pages and verses opened).

### see-what-each-change-was-for

For any commit, see which task it did, which use case and feature that task serves and which plan it came from, without reading a chat log.

- **label-commits-with-what-they-are-for**: Owner, 2026-11-10: link a use case to its feature, its tasks, the commits that did them and the plan they came from, checked in, with the labels added by a…

### Part of the product: native-shell

The Mac and iPad app: a thin native window around the web build, served from inside the app bundle at a private address, opened at a route from a hifth:// link…

- **device-list-from-apple**: 2026-11-10: `make app-devices` counts the devices on this laptop's signing profiles, so the slots-left number is only the most that could be left.

### Part of the product: encoding-inspector

Four descriptions of one text — the print, the ligature corpus, the QAC word index and the tajweed codepoint offsets — on one screen, with every place they…

- **testflight-upload-key**: Make the App Store Connect API key under Users and Access, Integrations; the key file goes in ~/.appstoreconnect/private_keys/ (where the upload tools look)…

### Part of the product: performance

How fast the app opens on a slow phone, the code-size cap that stands in for it, and the charts that say whether the cap can move.

- **move-12-kb-out-of-startup**: The app downloads 171 KB before the first page can be used, and start-up drops from about 2290 ms to about 2140 ms once that is under about 160 KB.

### Tied to nothing yet (61)

- **does-a-real-fore-edge-stack-vary**: Curiosity, not a blocker — SS4.6 fixes it constant here regardless. But if the reference does vary it, that is a design it got wrong for a memoriser.
- **check-perf-verdict-on-device**
- **check-screen-reader-walkthrough**
- **check-kfgqpc-terms**
- **check-qul-rulers-terms-and-text-free**: The human half of the qul-reliance boundary.
- **check-qul-held-copy-licensed-and-offbundle**: The human half of the held-copy boundary, and the mirror image of the ruler check: where that one confirms an export carries NO text, this one confirms the…
- **check-source-offer-resolves**
- **check-edge-spot-audit**: The only check that can establish the scripture data is correct.
- **check-revision-record-on-a-phone**
- **check-placement-correction-by-eye**: The runnable half of nobody-has-looked-at-the-placement-verdicts: that row is the question, this row is the twenty minutes that answers it.
- **check-placement-residual-by-hand**: The other half hour, and it asks a question the first one cannot.
- **check-placement-holds-off-its-own-pages**: The third sitting, and the first one that can be wrong.
- **check-placement-what-kind-of-wrong**: The fourth sitting, and the first one that does not answer in a distance.
- **a-preference-does-not-say-how-far**: Opened 2026-08-12 by building the instrument that answers it: a forced choice yields at most one bit per trial — is the proposed move preferred to the…
- **the-correction-is-only-judged-where-it-was-fitted**: Opened 2026-08-12 as 'only forty pages have a measured correction'; renamed the same day when the coverage half was closed and the name stopped being true.
- **the-frame-is-registered-on-ornaments-and-used-to-place-text**: Opened 2026-08-13 as the ROOT CAUSE under a run of rows that each measured a symptom of it.
- **print-oddities-called-out-by-eye**: Raised 2026-08-15 by the sittings so far over the fallback population.
- **pointed-answers-are-not-hand-placed-ones**: Raised 2026-08-15, from what the first sitting over the fallback population cost: 127 of the 128 marks the reader worked through were moved, over 226 separate…
- **the-displacement-correction-could-go-stale**: Only bites if the per-page correction is adopted.
- **position-might-separate-the-look-alike-pairs**: Shape does not separate fatha from kasra (0.968) or fathatan from kasratan (0.914), and no better shape comparison will — what separates them is which side of…
- **structural-metadata-could-be-public-domain**: The structural tables this app uses — ayah counts, part and half-part starts — come from a source licensed CC BY 3.0, whose §4(a) forbids applying…
- **how-are-slip-candidates-ranked**: The smart-suggestion half of the feature reuses the app's existing resemblance edges (twin / shared-run) to offer the verses a hafiz likely slipped toward.
- **who-sets-a-confusion-seams-state**: Each confusion point carries a state — every-pass, sometimes, used-to, dismissed — that drives warning weight, list grouping and map colour.
- **should-a-student-share-a-map-with-a-teacher**: A hafiz revises with a teacher whose job is to drill them exactly where they are weak — which is what the confusion map records — so there is a real pull to…
- **should-the-app-learn-where-most-readers-slip**: Across many readers the same look-alike verses would cluster — there are places the whole tradition slips on.
- **rigor-stack-pins-the-checking-code**: The umbrella.
- **second-reader-on-the-placement-sitting**: Subtask of rigor-stack-pins-the-checking-code (①).
- **second-independent-mark-ink-instrument**: Subtask of rigor-stack-pins-the-checking-code (①), and the deepest hole: the one error no fingerprint can catch is the measuring code agreeing with itself…
- **mark-labels-no-register-home**: A finished measurement that decided nothing and changed no code has no row in docs/decisions.json and, until now, none here either — the only way to find it…
- **sub-word-marks-no-register-home**: A design-of-record cited from mark-granularity.html's decision row and from mark-labels.md, but carrying no row of its own in docs/decisions.json — it settles…
- **qul-command-line-tool**: Parked 2026-09-29 when the session task list was cleared; until then it was written down only in that list and the old confusion-points backlog's parked…
- **swap-to-apple-webview**: iOS 26 / macOS 26 ship a SwiftUI web view; the shell wraps the older one because the new one hides the scroll view and raises the minimum OS.
- **testflight-after-own-use**: The owner settled the TestFlight question on own devices only (2026-10-11) and plans to move to sending the whole build to named testers once they have used…
- **iphone-walk-pitch**: Walk the pitch build in the iPhone simulator app, upright and on its side, as a reader would; every fault found gets a test and a walk-checklist line.
- **iphone-commentary-shape**: A phone has no room beside the verse for the commentary.
- **recitation-plays-on-silent**: On an iPhone with the ring switch on silent, the verse recitation may not be heard. Tell iOS the app is for listening, as a music app does.
- **recitation-plays-in-background**: Recitation stops when the screen locks or the reader switches apps.
- **testflight-archive-builds**: Archive and export settings, privacy manifest, encryption answer, a build number that counts up, and the sandbox Apple requires of a Mac build sent through…
- **testflight-licence-reading**: Send docs/design/testflight-licence-brief.md (written 2026-11-08) to a qualified reader; a yes moves native-testflight-licence to A, a no leaves B as the…
- **paid-features-which**: Owner, 2026-11-08: paid features behind an in-app purchase, a lot of the sharing first; the Qur'an itself (reading, pages, search, recitation) is never gated.
- **paid-features-sell-a-text**: Owner, 2026-11-08: maybe an in-app purchase for a specific text, such as a commentary.
- **icloud-sync-revision-record**: Should the record of what you have opened follow you to your other Apple device through your own iCloud?
- **icloud-sync-deletions**: When you delete a bookmark or note on one device, should it go from the other too?
- **icloud-sync-where-left-off**: When you open the Mac, should it offer the page where the iPad left off?
- **icloud-sync-settings**: Which settings should follow you between iPad and Mac?
- **icloud-sync-road**: Should every record take the same road the usage counts take: Apple's ready-made sync loop, one copy per device per kind, carrying the same text the saved file…
- **icloud-sync-build-unsigned**: Build the parts that do not touch Apple, each with its test: the fold-in rules with removal marks, the record each device hands over, the two new bridge…
- **sharing-own-icloud**: Say yes or no to your mistakes, notes and bookmarks following you between your own iPad and Mac through your own private iCloud; the build rides on the…
- **sharing-consent**: Decide whether a student's mistakes may be sent to another person at all, and what the student sees before saying yes; a new decision record, since sharing…
- **sharing-which-way**: Pick how mistakes first reach a teacher; recommended: the teacher's view fed by the saved file first, then the live locked link with no accounts, accounts only…
- **sharing-reading-times**: Decide whether the record of when you read ever goes with a share; suggested never by default, and only as a separate tick each time, which means naming one…
- **sharing-link-ending**: Decide whether a shared link stops working by itself after a while, and whether the teacher sees new mistakes live or on reopening.
- **sharing-cloudflare-setup**: Set up hifth.bytesofpurpose.com/share on Cloudflare with its free database behind it: the address entry, a small server at /share, a placeholder page with no…
- **kanban-board-for-users**: Give the people who use Hifth (the Study Quran team, testers, later huffaz) a kanban board to manage it and review it, beside the project's own GitHub board.
- **sharing-teacher-view**: Build the teacher's view two rough ways, mistakes on the real page and as a list, open both on an iPad, and keep the loser as a setting.
- **full-screen-side-tool-bar**: Owner's page comment of 2026-11-07: in full screen, keep the tool bar down the left or right edge, with a switch to hide and show it like the Mac Dock.
- **bookmark-vs-left-off-ribbon**: Owner's page comment of 2026-11-07: the navy bookmark tabs and the red 'where you left off' ribbon look alike, so it is not clear which is which.
- **bookmark-pull-by-hand**: Owner's page comment of 2026-11-07: asked how to pull a bookmark down or push it up, in full screen or not.
- **full-screen-keeps-tools**: Owner's page comment of 2026-11-07: 'Where is the side tool bar?' Full screen hides every bar, the tools too, so marking means leaving it.
- **verse-glows-on-drawer-hover**: Owner's page comment of 2026-11-07 asked for the lit verse to glow while the pointer rests on its drawer.
- **comment-bar-covers-bottom-row-on-phone-width**: On the dev server at phone width the comment tool's bar lies over the bottom of the app, so a bottom row of icons cannot be pressed until the bar is hidden.

## Later, waiting on something

### Part of the product: native-shell

The Mac and iPad app: a thin native window around the web build, served from inside the app bundle at a private address, opened at a route from a hifth:// link…

- **testflight-sign-with-paid-team**: 2026-11-10: the iPad is done.

### Tied to nothing yet (52)

- **does-the-fold-read-at-all**: A design judgement with no evidence behind it. There is no cheaper instrument than putting it in front of someone and no measurement substitutes for it.
- **turn-cost-gated-on-the-perf-verdict**
- **second-mount-frame-budget**: loop-4b dropped off the blocker list by happening: the second mount is real on every spread now, which is what made the risk measurable rather than…
- **warmth-thresholds**: A ledger candidate. The bands decide what `cold` means, and a threshold chosen by whoever wrote the renderer is a claim about somebody else's revision habit.
- **arabic-number-agreement**: 37 forms Arabic silently substitutes today.
- **adj-shards-carry-a-third-upstream**: Found by gate:notices on the first run it ever did, which is the strongest thing that can be said for having built the trace.
- **gpl-and-the-app-store**: Track B's blocker is a licence Hifth does not own.
- **track-b-order-is-unachievable**: HALF FIXED 2026-08-15: PLAN.md:1297 now cites research §6.
- **track-b-payload-has-narrowed**: Track B's stated payload was: bundle the corpus offline, native share sheet, Universal Links, haptics, state restoration, iPad two-page spread, App Store…
- **tajweed-span-to-named-mark**: Narrowed again 2026-08-07 by mark-B, and the offline half is now ANSWERED — the remaining half needs an eye and nothing else.
- **diacritic-shards-need-a-caller**: Measured with mark-A and deliberately not spent: the mark tree would be 7.35 MB raw / 2.28 MB gz across 604 shards, weighed as the shard text build-words.mjs…
- **diacritic-ids-are-an-unversioned-wire-format**: A mark ships as an integer and not a name because a page carries ~540 of them and the names are the larger half of the bytes.
- **perf-verdict**: The keystone. The oldest open item in the project and the one the most others inherit from.
- **perf-on-real-mid-tier-android**: The probe removed the tooling dependency for the reader and not the hardware dependency for the claim.
- **ci-frame-budget-is-emulated**: The only mechanical part of the perf verdict, listed separately so it is not forgotten once the interesting part is settled.
- **site-answers-on-plain-http**: Reproduced 2026-08-06 with two curl lines against the deployed site: http:// returns 200 and the whole app in cleartext — not a redirect — and the https…
- **plan-perf-verdict**
- **plan-per-edition-licence-review**: Substantially closed.
- **plan-loop-assigned-deferrals**: loop-4b came and settled the half that was about vendoring; what it did not do is give the other half what it was waiting for.
- **plan-screen-reader-pass**
- **plan-tajweed-golden-row**: Two preconditions, both of which must hold: the palette sign-off, and a test-only way to drive the skin — a production-readable skin= param would ship a…
- **nobody-has-looked-at-the-placement-verdicts**: The placement measurement has been reproduced twice and its controls hold, but no human has looked at a single verdict.
- **whether-what-is-left-over-is-even-ours**: Opened 2026-08-13 as the named half of the tail the-frame-is-registered-on-ornaments-and-used-to-place-text refused to average into its figures.
- **the-boundary-marks-that-ship-as-placed-were-never-read**: the-search-reported-answers-it-never-checked fixed the code bug: a mark whose search ran out of room could slip past the check meant to catch that and ship as…
- **the-pagination-question-covers-three-outputs**: adj-shards-carry-a-third-upstream asks whether a table of which page an ayah falls on carries its source's terms forward, and scopes the question to one asset…
- **the-tajweed-spans-could-be-generated-not-vendored**: An MIT-licensed engine ships a corpus-free core of about 34 KB that would mean vendoring no annotation data and no Quran text at all, emits the same…
- **whether-a-store-build-carries-every-tree**: The store channel is the only one carrying a blocker, and it does not have to carry what the site channel carries.
- **whether-a-permissive-relicence-is-available-at-all**: Worth separating from the store question because someone may want it answered for unrelated reasons — a reader wanting to build a different mus'haf on…
- **plan-graduate-page-bar-winners**: The page-bar's two questions were both decided C on 2026-09-02 (decisions juz-detents and boundary-juz): a juz marker is a tap-to-open button that grows as the…
- **storage-not-kept**: Owner, 2026-09-25: the 'offline storage is not guaranteed' banner was a warning with no action for the reader, so it came out of the app and the underlying…
- **plan-qul-harakat**: CORRECTED 2026-09-09 after checking the mark-work branch directly.
- **mac-ui-test-needs-permission**: Apple's UI test runner drives the Mac app through Accessibility; the terminal must be allowed once by hand.
- **mac-trackpad-pinch-unfelt**: WebKit forwards the pinch as gesture events the web app already handles, so no code was written and nothing has felt it.
- **universal-links-need-paid-team**: A tapped site link opens Safari, not the shell.
- **app-store-not-a-target**: The shell carries the same GPL-derived data as the site; a store listing waits on the licensing opinion.
- **streak-filter-iphone-speed**: The page-wide streak filter has not been timed on a phone.
- **mark-reveal-in-safari**: The wipe animates a clip on the band's group. Unchecked in Safari on a device; failing safe means the mark shows whole.
- **iphone-own-device-install**: Install on the owner's own iPhone with the paid team, the same way as the iPad.
- **recitation-lock-screen-controls**: Show the verse and reciter on the lock screen and answer its play, pause and next buttons, and AirPods presses.
- **recitation-airplay**: An AirPlay button so recitation plays on a HomePod or other speaker. Needs nothing from Apple.
- **siri-play-recitation**: Answer "Hey Siri, play al-Kahf in Hifth" on the iPhone and iPad. The Siri box on the app's ID allows it.
- **homepod-siri-request**: Ask Apple, signed in, to let a HomePod pass Siri play requests to Hifth: https://developer.apple.com/contact/request/sirikit-media-intent-for-homepod/ .
- **testflight-upload-step**: Write the one-command upload once the decision says A and the key exists.
- **testflight-invite-testers**: External tester group, email invites only, no public link; the agent drafts a short note for testers.
- **paid-features-app-store**: In-app purchases need an App Store release, which the licence question holds (app-store-not-a-target).
- **paid-features-build**: Apple's purchase system in the iPad and Mac app, and one switch the web app reads per paid feature, with the free path tested on its own.
- **usage-sync-own-icloud**: Build the owner's pick for the usage counts: per-device names and keep-the-larger merging first, then the iPad and Mac apps syncing through the owner's private…
- **icloud-sync-try-signed**: Turn on iCloud for the iPad and Mac apps and try sync on the owner's own devices: make the app's iCloud container, add the iCloud and push-notice permissions…
- **icloud-sync-publish-layout**: Publish the database's layout in Apple's CloudKit console before the first TestFlight upload, because testers use the live database.
- **sharing-sign-in**: If accounts come: try Sign in with Apple and an email link inside the iPad and Mac apps on a throwaway test project; Google later through the system browser.
- **sharing-paid**: Whether sending a share is a paid extra and opening one always free waits on the list of what is paid.
- **sharing-icloud-non-apple**: Test whether a teacher with no Apple device can open an iCloud share, and whether Apple's web library works in Firefox; only worth doing if iCloud sharing is…
