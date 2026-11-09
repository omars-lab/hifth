# How could one reader send their own Hifth data to another reader? Raw findings, researcher B

These are the raw notes behind [the design note](design.md). Written 2026-11-08 by researcher B, working apart from researcher A; A's files were not read.
No app code was changed.

Each source says how it was seen:

- **fetched**: the page was opened and read.
- **snippet**: only a search result summary was seen. Treat it as a lead, not a fact.
- **title only**: the page was opened but came back empty (Apple's documentation pages do this to a plain reader). Those are listed so nobody thinks they were read. Where it mattered, the same page was read again through Apple's data address (the address ending in `.json`), which is marked fetched.

## What does the repository already say?

All read directly in this worktree.

| what | where | what matters here |
| --- | --- | --- |
| The privacy check | `scripts/gate-revision-privacy.mjs` | Guards three records: the revision record (which pages a reader opened, and when), the confusion-jump record (where a reader's memory slips, which is what the Mistake pen feeds), and the usage counts. Each has a closed list of code files allowed to read it, and the record's own files may hold no way off the device (no network call, no address building). The confusion record may leave only through the saved file the reader makes (`packages/core/src/bookmarks.ts`). Any sharing path means a new name on one of those lists, which is a deliberate act the check forces. |
| Where a reader's own record lives | `docs/decisions/storage-model.md` | Today: on the device, plus a file the reader saves. On the day there is sign-in: the reader's own cloud copy. And, in so many words: "A feature whose record is genuinely shared between people, not one reader's own — teacher and student, say. That is a different decision about identity and consent, and it does not adopt this model; it starts its own." So sharing between readers is a **new decision**, not an extension. |
| Should a student hand their confusion map to a teacher? | `docs/design/confusion-points.md` item ⑥, issue `should-a-student-share-a-map-with-a-teacher` | Owner, 2026-08-29: yes, as its own feature. Owner, 2026-11-08: "a live link the student starts and can switch off, and the page it opens has a download button so the teacher can keep a copy." Needs somewhere online to hold the shared map; where is to be settled first. After the Study Quran demo. |
| Pooling where most readers slip | same file, item ⑦ | Owner, 2026-11-08: off until the reader turns it on; turning it on means sharing your own slips too. "The same online store the teacher link needs." |
| The saved file exists | `packages/core/src/bookmarks.ts` | `toBookmarkFile`, `parseBookmarkFile`, `mergeBookmarks`. A reader can already save their bookmarks, notes and jumps to a file and load one back, merging it in. |
| The Apple apps can now save and open a file | `native/Hifth/Web/Downloads.swift`, `native/HifthTests/DownloadTests.swift`, `native/Hifth/Web/ShellModel.swift` (the open-file handler) | The earlier usage-sync research found neither app could save or open a file. That has since been fixed: a download is saved, and the Mac app shows the open window. So "a file sent by hand" works in all four places today. Not walked by hand for this note. |
| Does the app talk to any server today? | searched the web app and the shared core for any Supabase use | **No.** The Supabase project holds outside reference data for the build tools only; the shipped app makes no call to it. A server with readers' data would be a new kind of thing, not an existing one growing. |
| The Supabase project | `.claude/memory/hifth-supabase-via-cli.md` | Project `hifth`, region West US (Oregon), on the owner's separate account, driven by the command line. Called the "dev" store. Holds outside data for the tools today. |
| How the public site is hosted | `.github/workflows/deploy.yml`, `apps/web/vite.config.*` | GitHub Pages (Cloudflare Pages as a hand-started alternative), at `blog.bytesofpurpose.com/hifth/`, a folder of the owner's blog address. Plain files, no server code. |
| Paid extras | `docs/design/paid-features.md` | The Qur'an is never paid for. Sharing a verse, a page or a revision record is the first paid extra the owner named. In-app purchase needs an App Store release, which is held by the licence question (issues `paid-features-which`, `paid-features-app-store`). |
| Own-device sync already picked for the usage counts | issue `usage-sync-own-icloud`; `docs/research/usage-sync-consolidated.md` | Owner's pick: the iPad and Mac apps keep the counts in the owner's private iCloud database; Firefox and the phone join by file. Blocked on the paid Apple membership signing the apps (bought 2026-11-08; the signing step is `testflight-sign-with-paid-team`). The consolidated note also records: Apple's web library for iCloud (CloudKit JS) is not shown to work in Firefox, and the two recent forum threads about it failing have no answers. |

## Apple: sharing a record from one iCloud account with another

| source | seen | what it says that matters |
| --- | --- | --- |
| [Sharing CloudKit data with other iCloud users](https://developer.apple.com/tutorials/data/documentation/cloudkit/sharing-cloudkit-data-with-other-icloud-users.json) (the ordinary page [here](https://developer.apple.com/documentation/cloudkit/sharing-cloudkit-data-with-other-icloud-users) came back title only) | fetched | Records live in the owner's private database; people who accept a share, "called participants, can view or edit the shared record, or stop participating in the share." Apple's ready-made sharing screen lets the owner "send a link, stop sharing the record, change the permission for a participant". Choices include "Anyone with this link can view" (read only). The test setup uses two devices "with a different iCloud account" each. The app must declare it accepts shares. |
| [CKShare reference](https://developer.apple.com/tutorials/data/documentation/cloudkit/ckshare.json) | fetched | "CloudKit limits the number of participants in a share to 100, and each participant must have an active iCloud account." A share can be opened to "anyone with the URL". Writers can change any shared record; "only the owner can delete a shared hierarchy's root record." A participant who leaves is removed; the share stays for the rest. Shareable records must sit in a custom zone in the owner's private database. |
| [Shared database scope](https://developer.apple.com/tutorials/data/documentation/cloudkit/ckdatabase/scope/shared.json) | fetched | Shared records "are counted towards the originating owner's iCloud account storage quota." So the student pays for what the teacher sees, in iCloud space, a few kilobytes here. |
| [quotaExceeded](https://developer.apple.com/documentation/cloudkit/ckerror/quotaexceeded.md), [forum thread 851999](https://developer.apple.com/forums/thread/851999) | snippet | In the shared database the owner's space is the limit and a participant cannot fix it. The forum thread says Apple's wording is not consistent; no answer. |
| [CloudKit JS](https://developer.apple.com/tutorials/data/documentation/cloudkitjs.json) (ordinary page title only) | fetched | "Use CloudKit JS to build a web interface that lets users access the same public and private databases as your CloudKit app". You must "have an existing CloudKit app and enable web services". No word on the shared database, on accepting a share, or on which browsers. No deprecation notice. |
| [Accepting share records (web services)](https://developer.apple.com/library/archive/documentation/DataManagement/Conceptual/CloudKitWebServicesReference/AcceptingShareRecords.html) | fetched | A web endpoint "Accepts a share on behalf of the current user." It is in Apple's documentation archive, last updated 2016. Nothing current says a browser-only person can accept a share. |
| [Search: accepting a CloudKit share in a browser](https://github.com/fatbobman/CoreDataCloudKitShare) and related Stack Overflow copies | snippet | One report of opening a share link in a browser giving "iCloud has stopped responding". No confirmed browser-only path. |
| [If you can't collaborate in the Notes app](https://support.apple.com/en-us/102462) | fetched | On iOS 26 and earlier, "you can only collaborate on notes with someone who also has an Apple device signed in to their Apple Account." Otherwise "you can still send a copy of the note as an email or a message." Apple's own sharing app falls back to sending a copy for people without an Apple device. |
| [Apple's Notes sharing guides](https://support.apple.com/guide/iphone/share-and-collaborate-iphe4d04f674/15.0/ios) | snippet (the newest guide page came back as a table of contents only) | Two settings: who can open it (only invited people, or anyone with the link) and what they can do ("Can make changes" or "View only"). Everyone must be signed in with an Apple account. |

## Signing in, and what each way lets the app see

| source | seen | what it says that matters |
| --- | --- | --- |
| [Sign in with Apple on other platforms](https://developer.apple.com/tutorials/data/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms.json) (ordinary page title only) | fetched | The app may ask for `name`, `email`, both or neither. "If you requested any scopes, the value must be `form_post`": Apple sends the answer back as a form posted to the app's address, which a page made of plain files cannot receive, so a server has to catch it. The return address "can't be an IP address or localhost". Works from Android and other browsers by an ordinary web sign-in. |
| [Sign in with Apple, for users](https://support.apple.com/en-us/102609) | fetched | "At your first sign in, apps and websites can ask only for your name and email address". The reader can hide their email behind a random forwarding address. Apple says it does not track the reader across apps. |
| [Google's list of sign-in permissions](https://developers.google.com/identity/protocols/oauth2/scopes) | fetched (first 100,000 characters) | The three basic ones: `openid` "Associate you with your personal info on Google"; `email` "See your primary Google Account email address"; `profile` "See your personal info, including any personal info you've made publicly available". Nothing else is needed for sign-in. |
| [Google blocks sign-in inside embedded web views](https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/) | fetched | "All embedded webviews will be blocked starting on September 30, 2021." Apps should hand sign-in to the system browser or Safari's in-app browser. The iPad and Mac apps are a web view, so Google sign-in would have to leave the web view. Apple's own sign-in has a system sheet in the Apple apps; not checked here how it reaches the page inside the web view. |
| [Supabase Auth](https://supabase.com/docs/guides/auth) | fetched | Password, "magic link, one-time password (OTP), social sign-in" (Apple and Google among them). The sign-in token "scopes database access on a row-by-row level" with row rules, so each reader's rows can be locked to them. |
| [Supabase passkeys](https://supabase.com/docs/guides/auth/passkeys) | fetched | "Passkey support is experimental." A passkey cannot create an account: the reader must already be signed in another way. "Passkeys are cryptographically bound to the Relying Party (RP) ID" (the site name they were made for); changing it breaks them. Up to 5 origins, each the site name or under it. |
| [Supabase passkeys beta announcement](https://supabase.com/changelog/46458-passkeys-for-supabase-auth-beta) | snippet | Beta, 28 May 2026. |
| [Supabase redirect addresses](https://supabase.com/docs/guides/auth/redirect-urls) | fetched | After sign-in Supabase sends the reader back only to addresses on an allow list. A native app can use its own link scheme as the return address. |
| [web.dev on the passkey site name](https://web.dev/articles/webauthn-rp-id) | fetched | The site name a passkey is made for can be the exact host or a parent "eTLD+1 or higher"; `example.com` covers `login.example.com`; a narrower one covers only itself. |
| Search on passkeys across sub-addresses (mojoauth, corbado, Okta) | snippet | Pick the site name once; it is hard to undo. A passkey on a sub-address you do not fully control is a risk. |

## Where would the data sit, and who can see it on the way?

| source | seen | what it says that matters |
| --- | --- | --- |
| [MDN, same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) | fetched | An origin is scheme, host and port; two pages differing "Only the path" are the same origin. "Each origin gets its own separate storage, and JavaScript in one origin cannot read from or write to the storage belonging to another origin." So the app at `blog.bytesofpurpose.com/hifth/` shares its storage with every page of the blog at the same address. |
| [RFC 6265, cookies](https://www.rfc-editor.org/rfc/rfc6265#section-5.3) | fetched | A cookie with no Domain goes back only to its own host. The Path setting "cannot be relied upon for security" and cookies "do not always provide isolation by path". A cookie scoped to `/hifth/` is not walled off from the rest of the blog. |
| [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | fetched | "GitHub Pages sites shouldn't be used for sensitive transactions like sending passwords or credit card numbers," and not for running a paid service. |
| [What is GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) | fetched | "a static site hosting service". |
| [MDN, the part of a link after #](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment) | fetched | "The fragment is not sent to the server when the URI is requested; it is processed by the client". |
| [Data encryption on Firefox Send](https://irq5.io/2019/05/14/data-encryption-on-firefox-send/) | fetched | Mozilla's old file-sending service locked each file in the browser and put the key after the `#`; "URL fragments are never sent to the server", so "the file blocks are opaque to it." |
| [The Register on Firefox Send](https://www.theregister.co.uk/2019/03/13/mozilla_send_/) and others | snippet | The key after `#` "can be extracted via JavaScript": whoever serves the opening page could read it. Firefox Send shut down in 2020 (date not checked against Mozilla). |

## What do other apps do?

| source | seen | what it says that matters |
| --- | --- | --- |
| [Anki syncing](https://docs.ankiweb.net/syncing.html) | fetched | One free account on Anki's own site syncs a person's cards and reviews across devices. When two copies cannot be merged, Anki makes the person choose: send this device's copy up, or take the online copy down. Data may be deleted after 6 months without use. |
| [Anki exporting](https://docs.ankiweb.net/exporting.html) | fetched | A deck file can "transfer cards between people". With review history off, "Anki will assume that you are sharing the deck with other people" and strips it. **Sharing with someone else drops the personal record by default**; backing up keeps it. |
| [Quran.com single accounts](https://quran.com/product-updates/centralized-accounts-across-quran-foundation) | fetched | 12 November 2025: one sign-in (Google, Facebook, Apple or email) across Quran.com and its reflections site; "Synced progress across browsers", notes, streaks, goals, collections. Sharing between users only for public reflections and groups. No privacy statement on the page. |
| [Quran.com feedback: iOS syncing](https://feedback.quran.com/mobile-app/p/ios-syncing-issues) | snippet | A user says the iOS app syncs bookmarks through iCloud while the website uses the account, and the two did not meet. |
| [Tarteel challenges announcement](https://tarteel.ai/blog/challenges-announcement/) | fetched | 2021: "share unique links to your recitation sessions publicly to get feedback from your instructor or peers". Public link; does not say whether mistakes are in it. |
| Search: Tarteel teacher features, Tarteel Academy | snippet | No private send-to-teacher feature found in Tarteel itself; a separate Tarteel Academy app links students, parents and teachers. Not opened. |
| [Mofassal, App Store page](https://apps.apple.com/us/app/mofassal-quran-hifz-review/id1584188020) | fetched | Teachers make a group, add students, follow each student's plan; members are owner, editor or viewer; a plan can be shared with a parent by link or invite with view or edit access; guest use without an account, sign up later. Each session records a rating, a mistake count and notes. |
| Search: Maktab, Riseup Labs, Hifz Tracker, QuranRecord | snippet | Classroom apps with teacher dashboards and per-word mistake tracking exist. All behind accounts; none opened. |
| [Google Docs sharing help](https://support.google.com/docs/answer/16722399) | snippet | Two settings: "Restricted" (only people added) or "Anyone with the link"; roles viewer, commenter, editor; switch back to Restricted at any time; owners can stop viewers from downloading; some accounts can set an end date on access. |

## What was not looked at

- Whether Sign in with Apple's system sheet inside the iPad and Mac apps can hand its answer to the page in the web view. Not looked.
- Whether a CloudKit share link opened on an Android phone or in Firefox ends anywhere useful today. Not tried; it needs the apps signed by the paid team first.
- The cost of Supabase's paid tier, and whether the free tier pauses an unused project. Not looked.
- Any Islamic-scholarly view on sharing a record of someone's worship. Not looked; it is a question for the owner and the people he trusts, not a web search.
