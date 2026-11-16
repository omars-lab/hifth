# What does Hifth need before the App Store, and to run it after?

*Written 2026-11-15 by the checker. It is built from two independent research passes:
[a.md](a.md) (what teams check before a launch) and [b.md](b.md) (what one person needs to run
an app after launch). This is the document to act on; the two passes stay as the record.*

**How to read the marks.**
**[F]** the page was opened and the claim comes from its text.
**[S]** only a search result was seen.
**[U]** not confirmed.
**(re-opened)** means the checker opened that page again today.
A mark with no "(re-opened)" is carried over from a pass without being checked again.
**[R]** is the checker's own reasoning from how Hifth is built: its web part is packed inside the
app and served from the app itself, not loaded from the internet.

Three Supabase pages carried a line asking automated readers to file a feedback report.
It was ignored, as was a similar line seen by pass A.

## What did both passes agree on?

Two passes found these separately, which counts as evidence.

- An app must be more than a repackaged website (rule 4.2). [F, re-opened]
- An app that lets people make an account must let them delete it inside the app (rule 5.1.1(v)). [F, re-opened]
- An app needs a working way to contact its maker (rule 1.5). [F]
- App review: half of apps are reviewed within 24 hours, nine in ten within 48. [F]
- A faster review can be asked for a critical bug, with the steps to reproduce it. [F]
- Staged release spreads an update over 7 days and can be paused for up to 30 days in total. [F, re-opened]
- Pausing a staged release does not take the update back from people who have it. [U]
- Downloaded code may not change what the app is for or add features (developer agreement 3.3.1(B); rule 2.5.2). [F; rule 2.5.2 re-opened]
- Apple's own crash reports cover only readers who agreed to share data with developers. [S]
- Sentry's free plan: 1 user, 5,000 errors a month, 30 days of history. [F]
- Crash, error and usage data must appear on the App Store privacy labels, including what outside libraries collect. [F]
- A settings file on our own server, with a lowest allowed version and a way to switch features off, is the usual safety net. [U in A, S in B]
- Supabase Pro keeps 7 days of daily backups. [F, re-opened]
- Supabase backups never include stored files, only the database. [F, re-opened]
- On the free Supabase plan, the answer is a scheduled database export kept somewhere else. [F, re-opened]

## Where did they disagree, and what does the source say?

**1. Does the free Supabase plan keep any automatic backups?**
Pass A: no. Pass B: sources disagree.
The source supports pass A. [F, re-opened]
- The backups page says daily backups are taken for "Pro, Team, and Enterprise Plan projects". [F]
- The pricing page lists automatic backups for Free as "Not included". [F]
- The production checklist says backups "are not available for download for Free Plan projects". [F]
- Read with the two lines above, that means there is nothing to download, not that hidden backups exist. [R]
- Links: [backups](https://supabase.com/docs/guides/platform/backups), [pricing](https://supabase.com/pricing),
  [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).

**2. Can Sentry's Apple library catch errors in the web part?**
Pass A: it "can catch web errors too". Pass B: not on its own; the web part needs its own library.
The source supports pass B. [F, re-opened]
- Sentry's page says its Apple library "doesn't capture errors that happen inside a web view".
- The web part needs Sentry's JavaScript library, started when the web view is created.
- The two can be joined so one problem shows both halves.
- Link: [Sentry web view](https://docs.sentry.io/platforms/apple/configuration/webview/).

**3. Does staged release work for the first version?**
Pass A did not say. Pass B left it open.
- Apple's pages describe staged release only for "a version update". [F, re-opened]
- No Apple page that was opened says outright that a first version is excluded. [U]
- Third-party guides say it is for updates only. [S]
- Staged release only holds back automatic updates for people who already have the app. [F, re-opened]
- So a brand-new app has nobody to hold back, and cannot be staged in practice. [R]
- Plan the first release as going to everyone at once. [R]
- A search summary claimed an Apple page excludes first versions. On opening it, that line was about the release-notes field, not staged release.
- Link: [staged release](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/).

## Which claims did only one pass find?

These are flagged, not dropped and not trusted blindly.

**Checked and confirmed today**
- Deleting an account must also cancel the reader's Sign in with Apple tokens, through Apple's web service (pass A). [F, re-opened]
- That cancel call needs a secret signed with the Apple sign-in key, and the reader's Apple refresh or access token. [F, re-opened]
- Apple sends the reader's name only on the very first sign-in, not in the sign-in token, so save it then (pass A). [F, re-opened]
- Export compliance: set `ITSAppUsesNonExemptEncryption` to NO when the app uses only the system's own HTTPS (pass A said this from memory). [F, re-opened]
- The saved-settings privacy reason is CA92.1 (pass A said this from memory). [F, re-opened]
- Uploads must be built with Xcode 26 since 2026-04-28 (pass A). [F, re-opened]
- iPhone and iPad apps must support iOS 13 or later since 2026-09-09 (pass A). [F, re-opened]
- TestFlight: up to 100 internal and 10,000 outside testers; builds last 90 days; the first build for outside testers goes to review (pass A). [F, re-opened]
- Supabase's built-in mail sender allows only 2 sign-in emails an hour (pass B). [F, re-opened]
- Free Supabase projects with little use can be paused after 7 days (pass B). [F, re-opened]
- Supabase limits: 360 one-time codes an hour; 30 anonymous sign-ins an hour per address (pass B). [F, re-opened]
- Rule 4.7 is about mini apps, games and plug-ins that are not packed in the app (pass B left it open). [F, re-opened]
- So rule 4.7 does not apply to Hifth's own web part. [R]
- Firebase is on Apple's list of libraries that must carry their own privacy file; Supabase and Sentry are not (pass A). [F, re-opened]

**Corrected today**
- Screenshots (pass A). Pass A said the required iPhone set is the largest current iPhone, or else the older large Face ID iPhone.
  - Apple's page now says, in its "Required device sizes" section, at least one screenshot for the **medium** Dynamic Island iPhone (1179 × 2556 or 1206 × 2622). [F, re-opened]
  - The same page still marks the older large Face ID set as required when the largest set is missing. [F, re-opened]
  - The page contradicts itself; see "Still not confirmed".
- EU trader status (pass A). Pass A marked "or the app is removed from the EU store" as [F].
  - Apple's trader page does not say that. [F, re-opened]
  - News sites report that apps without trader status were removed from the EU store in February 2025. [S]

**Carried over, not checked again**
- Mail scanners can use up a single-use sign-in link before the reader clicks it (pass B). [F]
- Asking for a name or email must be optional, and no feature may depend on it (pass A, rule 5.1.1(x)). [F]
- No feature may depend on allowing tracking or notifications (pass A, rule 5.1.2). [F]
- The app name is at most 30 characters, with no stuffed keywords (pass A, rule 2.3.7). [F]
- Accessibility labels on the store page are voluntary for now; claim a feature only if all common tasks work with it (pass A). [F]
- The age rating asks about unrestricted web access, so the web view must not wander to other sites (pass A). [F]
- iPhone and iPad apps are offered on Apple-chip Macs by default (pass A). [F]
- List every outside service (Supabase, the site's host, the domain, Apple) and decide what happens when each fails (pass B, from Google's launch checklist). [F]
- Dependency and leaked-password scans are free on GitHub (pass B). [S]
- A page loaded from a file reports only "Script error." to error handlers (pass B). [F]
- Serving through the app's own address may fix that; nobody confirmed it (pass B). [U]
- On iOS, logs can be read only for the current run (pass B). [S]
- An "export diagnostics" button that the reader sends is the usual answer (pass B). [S]
- TestFlight feedback can be read through Apple's web service (pass B). [S] One post says it broke in 2026-05. [S]
- Reviews can be answered, and the reader is told (pass A [S], pass B [F]).
- Supabase's old keys are being replaced, with the old ones retired by the end of 2026 (pass B). [S]
- Tanzil's text licence allows only verbatim copies, with credit and a link (pass A). [F]
- The King Fahd Complex font licence may need written approval (pass A). [S]
- First-time launchers regret having no usage counts and no automatic backups (pass B). [F]

## What is the checklist for Hifth?

**What changes because the web part is packed inside the app?** [R]
- Every fix, web or native, is a new build that goes through review. Plan on a day or two per fix.
- The rules about changing a downloaded web part without review do not help Hifth.
- Offline caching inside the web view does not matter for the app; the files are already on the device.
- The "failed to load a newer file" problem Vite describes does not happen inside the app; it matters for the browser version only. [F for the problem itself]
- An off-switch or lowest-version setting must come from our own server, since the app cannot change without review.

### What do Apple's rules ask?
- Give the app real native parts: native sign-in, sharing, and a proper screen when there is no connection (rule 4.2). [F for the rule, S for the advice]
- Let people use the app without signing in (rule 5.1.1(v)). [F, re-opened]
- If any outside sign-in is offered, also offer an equally private one, which Sign in with Apple is (rule 4.8). [F, re-opened]
- Make name and email optional; nothing may depend on them (rule 5.1.1(x)). [F]
- Put account deletion in the app's settings, with no email step; say how long it takes and confirm when done. [F, re-opened]
- On deletion, cancel the Apple sign-in tokens using a signed secret and the reader's Apple token. [F, re-opened]
- That probably means a small server function that holds the Apple key. [R]
- Find out whether Supabase keeps the reader's Apple token; if not, get one at first sign-in. [U]
- Make the review notes specific: what makes a revision tool different from Qur'an readers (rule 4.3(b)). [F]
- Keep the server running during review, and give a demo account if any feature needs sign-in (rule 2.1). [F]
- Mac store version: sandboxed, packaged by Xcode, updated only through the store (rule 2.4.5). [F]

### What does privacy ask?
- A privacy policy link in App Store Connect and inside the app (rule 5.1.1(i)). [F]
- Privacy labels that cover the web part, the account, the email list and any crash reports. [F]
- The labels can be changed without a new build. [F]
- If the shell uses saved settings, its privacy file declares reason CA92.1 ("only accessible to the app itself"). [F, re-opened]
- Use 1C8F.1 instead only if settings are shared with an extension through an app group. [F, re-opened]
- Check the shell for the other four listed kinds of call: file dates, system boot time, disk space, active keyboards. [F, re-opened]
- Apple's list of five kinds does not include the web view itself. [F, re-opened]
- No other declaration for the web view was found. [U]
- Any outside library added later (for example Sentry) brings its own privacy file and goes on the labels. [F]

### What does the store listing need?
- iPhone screenshots for the medium Dynamic Island iPhone, plus the largest iPhone to be safe. [F, re-opened; "to be safe" is R]
- iPad screenshots for the 13-inch iPad (2064 × 2752 or 2048 × 2732). [F, re-opened]
- Mac screenshots at 16:10, for example 2880 × 1800. [F, re-opened]
- Up to 10 per size, JPEG or PNG, no transparency. [F, re-opened]
- Screenshots show the app in use, not a sign-in screen (rule 2.3.3). [F]
- A name of 30 characters or fewer. [F]
- A support page with working contact details. [F]
- Answer the age rating questions, including unrestricted web access. [F]
- Set EU trader status. A hobby app with no payments may be "not a trader", but Apple says to judge it yourself. [F, re-opened]
- Set `ITSAppUsesNonExemptEncryption` to NO, so the export question stops at every upload. [F, re-opened]

### What builds and testing are expected?
- Build with Xcode 26; support iOS 13 or later. [F, re-opened]
- Run a TestFlight round with outside testers before launch; the first build goes to review. [F, re-opened]
- The iPad app is offered on Apple-chip Macs by default. [F]
- Hifth ships its own Mac app, so that listing should probably be switched off. [U]
- Test on the newest system, on a real device. [F]
- Also test: smallest iPhone, iPad split view, no connection, larger text, VoiceOver. [U, common practice]

### How do we hear about problems?
- Read Apple's crash list in Xcode; it only covers readers who agreed to share. [S]
- If we add Sentry, it needs both its Apple library and its JavaScript library. [F, re-opened]
- Tag each report with the app's build number and the web part's version. [S]
- Put Sentry on the privacy labels if we add it. [F]
- Add a "Report a problem" button that writes a small log and opens the share sheet, so the reader chooses to send it. [S]
- Read TestFlight feedback and App Store reviews daily for the first two weeks. [F for reviews, S for TestFlight]
- Give a support address and a short FAQ or known-issues page. [F]

### How do we ship fixes?
- Each fix is a new build: test, upload, review, release. [R]
- Use staged release for updates, knowing a pause does not take the update back. [F, re-opened; the second half is U]
- Keep a faster-review request written and ready to paste. [F]
- Write "bug fixes" in release notes only when that is all it is (rule 2.3.12). [F]
- Keep a settings file on our server: lowest allowed version, a message, features on or off. [S]
- Raise the lowest allowed version only after a staged release finishes. [S]

### What do accounts and the server need?
- List each outside service and what the app does when it is down. [F]
- Use our own mail sender for sign-in mail; the built-in one allows 2 an hour. [F, re-opened]
- Build email sign-in so a mail scanner opening the link first does not lock the reader out. [F]
- Add a robot check to sign-up, sign-in and the email list. [F]
- Put any form that writes to the database behind a robot check and a server function. [F]
- Turn on Supabase's per-row access rules, so each reader can reach only their own data, and review who has access. [F]
- Keep the project from being paused: the free plan can pause after 7 quiet days. [F, re-opened]
- The free plan has no automatic backups: run `supabase db dump` on a schedule, keep copies elsewhere, alert on failure, and practise one restore. [F, re-opened]
- Make database changes only through change files kept in the repository, never by hand in the dashboard. [S]
- Turn on GitHub's dependency and leaked-password scans. [S]
- Write a short page on replacing a leaked key. [S]

### What is specific to a Qur'an app?
- Rule 1.1.5 bans inaccurate or misleading quotations of religious texts. [F, re-opened]
- Give readers a way to report a text error, and fix real ones quickly. [U]
- Credit Tanzil, link to tanzil.net, keep its notice, and do not change the text. [F]
- Confirm the King Fahd Complex font licence before embedding it. [S]
- Use only content we made or have a licence for (rule 5.2). [F]

## What is still not confirmed?

- Which iPhone screenshot set Apple actually requires. The page names the medium iPhone in one place and the large ones in another. [F, contradictory] Check in App Store Connect when uploading.
- Whether any Apple page says outright that a first version cannot be staged. [U]
- Whether a paused staged release can be taken back from people who already have it. [U]
- Whether Supabase keeps the Apple token needed to cancel Apple sign-in on deletion. [U]
- Whether the web view needs any privacy declaration beyond the shell's own. [U]
- Whether serving through the app's own address fixes "Script error." [U]
- Whether TestFlight feedback is still readable through Apple's web service after 2026-05. [S]
- How quickly small developers aim to answer readers. No figure was found. [U]
- Apple publishes no crash-free target. [U]
- Pages that could not be opened: Apple's privacy-manifest overview and the Xcode crash-reports page (pass A).
- Apple's page for the export-compliance setting came back as a title only; the setting was confirmed from its data file instead.
