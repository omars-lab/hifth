# What do teams check before putting a new app on the App Store? (research pass A)

*Written 2026-11-15 by one of two independent research passes for the App Store readiness plan
(`.claude/plans/launch-readiness.md`). Pass B is [b.md](b.md); the checked, combined
answer is [research.md](research.md), which is the one to act on.*

**How to read the marks.** **[F]** the page was opened and the claim is from its text.
**[S]** only a search result was seen. **[U]** could not be confirmed.

Pages that came back empty or missing: Apple's privacy-manifest overview, the Xcode crash-reports
page, "describing required reason API" (read through its data file instead) and the app-review
responses page. The Supabase backups page carried a line addressed to automated readers; it was
ignored.

Main sources: Apple's [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) [F],
[upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) [F],
[App Review](https://developer.apple.com/distribute/app-review/) [F].

## 1. Why do apps like ours get turned down?

- **Rule 4.2:** an app must be more than a repackaged website; 4.2.2 bans "web clippings,
  content aggregators, or a collection of links". [F]
- Apple's own list of common rejections includes 4.2, and "over 40% of unresolved issues" fall
  under 2.1, app completeness. [F]
- How wrapped apps get through (opinion, not Apple's rule): handle no connection natively instead
  of showing a browser error, use native sharing and sign-in, and ask what is left if the site
  disappears. One Apple forum thread describes ten 4.2 rejections in a row.
  [mobiloud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper),
  [forum](https://developer.apple.com/forums/thread/806726) [S]
- **2.1(a):** no placeholders; test on a real device; give a demo account "and turn on your
  back-end service!" [F]
- **2.5.6:** browsing must use WebKit; Apple's web view meets this. [F]
- **1.1.5** prohibits "inaccurate or misleading quotations of religious texts". [F]
- **4.3(b)** turns down apps "indistinguishable from what's already widely available"; the review
  notes should say what makes a revision tool different from the many Qur'an readers. [F]

## 2. What do sign-in and accounts require?

- **4.8:** an app using a third-party or social login must also offer an equally private one.
  An app using only its own accounts is exempt. Email plus Sign in with Apple meets it. [F]
- **5.1.1(v):** if an app has no significant account-based features, people must be able to use
  it without signing in. Optional sign-in fits. [F]
- **5.1.1(v):** an app that lets people make an account must let them delete it inside the app. [F]
- [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/) [F]:
  - delete the whole record, not only switch it off;
  - put it where people expect it, usually account settings;
  - no email or support-ticket flow;
  - finishing on a web page is allowed if the app links straight to it;
  - say how long it takes and confirm when done;
  - cancel the Sign in with Apple tokens through Apple's REST API.
- **5.1.1(x):** asking for a name or email must be optional, and no feature may depend on it. [F]
- Apple's native sign-in sheet plus Supabase's `signInWithIdToken` is the documented pattern. A web
  redirect inside the web view is called a rejection risk only in a forum post, and with that flow
  Apple does not send the reader's name.
  [Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple?platform=swift),
  [discussion](https://github.com/orgs/supabase/discussions/2805) [S]

## 3. What does privacy require?

- **A privacy policy link** in App Store Connect and inside the app. It must list the data
  collected, the outside parties and how they protect it, how long it is kept, and how to ask for
  it to be deleted. (5.1.1(i)) [F]
- [Privacy labels](https://developer.apple.com/app-store/app-privacy-details/) [F]:
  - declare all data the app or any outside code collects;
  - "Data collected via web traffic must be declared", which covers the web part;
  - the email list, an account id, and any crash or usage data all count;
  - the answers can be changed without a new build.
- **Tracking** needs Apple's tracking permission; no feature may depend on push or tracking
  permission. (5.1.2) [F]
- **Privacy manifest:** approved reasons for certain system features have been required for
  uploads since 2024-05-01. [F] The app's own code reports in its manifest; each outside library
  reports in its own.
  [data file](https://developer.apple.com/tutorials/data/documentation/bundleresources/describing-use-of-required-reason-api.json) [F]
  - A Swift shell almost certainly uses saved settings (UserDefaults), reason code CA92.1. The
    code is from memory. [U]
  - Whether the web view alone needs a declaration. [U]
- [Outside libraries that need a manifest](https://developer.apple.com/support/third-party-SDK-requirements/):
  Firebase's modules are on it; Supabase and Sentry are not. [F]

## 4. What does the store listing need?

- [Screenshots](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications) [F]:
  - 1 to 10 per size, JPEG or PNG, no transparency;
  - required: iPhone 6.9" (1320 × 2868) or else 6.5" (1284 × 2778);
  - required when the app runs on iPad: 13" (2064 × 2752 or 2048 × 2732);
  - Mac: 16:10, for example 2880 × 1800.
- **2.3.3:** screenshots show the app in use, not a login or splash screen. **2.3.8:** metadata
  suits age 4+. **2.3.7:** name up to 30 characters, no keyword stuffing. [F]
- **Review notes:** "generic descriptions will be rejected" (2.3.1(a)); include a demo account and
  any special setup. [F]
- **Support address** with working contact details (1.5). A broken support or privacy link is a
  listed common rejection. [F]
- [Age rating](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions) [F]:
  a new questionnaire was due 2026-01-31; ratings are 4+, 9+, 13+, 16+, 18+. One question is
  **Unrestricted Web Access** ("navigate to any webpage within the app"), so the web view must not
  wander to arbitrary sites.
- [EU trader status](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements) [F]:
  required, or the app is removed from the EU store. An individual who is a trader publishes an
  address, phone and email; a non-trader publishes nothing but EU readers are told consumer law
  does not apply. No payments points to non-trader, but Apple says judge it yourself.
- [Export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance) [F]:
  set the Info.plist key so the question stops at every upload. The page does not name the key;
  `ITSAppUsesNonExemptEncryption = NO` for an HTTPS-only app is from memory. [U]
- [Accessibility labels](https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels)
  are voluntary for now and will become required at an unstated date; claim a feature only if
  "all of the common tasks" work with it. [F]

## 5. What builds and testing are expected?

- Xcode 26 and the iOS 26 tools required for uploads since 2026-04-28; lowest supported system
  iOS 13 or later since 2026-09-09. [F]
- [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview) [F]:
  up to 100 internal and 10,000 outside testers; public links; the first outside build goes to
  review; builds expire after 90 days; testers send feedback with a screenshot.
- [iPhone and iPad apps on Apple-chip Macs](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-of-iphone-and-ipad-apps-on-macs-with-apple-silicon)
  are offered by default; test there or switch it off. [F]
- **Mac store, 2.4.5:** sandboxed, packaged by Xcode, updated only through the store. [F]
- Test on the newest system ("test on the latest software"). [F] The smallest iPhone, iPad split
  view, no connection, larger text and VoiceOver inside the web view, and a cold start on a slow
  network are common practice. [U]
- Apple publishes no crash-free target. [U]

## 6. How do launches and fixes work?

- [Staged release](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases/) [F]:
  7 days at 1, 2, 5, 10, 20, 50, 100%; pause for up to 30 days in total; anyone can still update
  by hand; iOS and macOS.
- **Review time:** half within 24 hours, nine in ten within 48. Faster review for a critical bug
  needs the steps to reproduce it. One appeal per rejection, to the App Review Board. [F]
- **2.3.12:** a plain "bug fixes" note is acceptable only for bug fixes. [F]
- **Changing the web part without review**, if the app loads it from the web:
  - [Developer agreement 3.3.1(B)](https://developer.apple.com/support/terms/apple-developer-program-license-agreement/) [F]:
    downloaded code must not "change the primary purpose" of the app, get round security, or
    create a shop;
  - **2.5.2** bans downloaded code that "introduces or changes features or functionality" [F].
    Fixes and content are fine in practice; new features go through review.
  - A bug in the native shell always needs a new build.
- **No rollback in the store.** Pausing a staged release only stops it spreading. [U]

## 7. What do one-person teams run after launch?

- **Crash reports:** Xcode Organizer and MetricKit cover only readers who agreed to share
  analytics; Organizer's are readable, MetricKit's need decoding.
  [forum](https://developer.apple.com/forums/thread/733806) [S]. Sentry's free plan: 1 user, 5,000
  errors, 30 days, 50 replays ([pricing](https://sentry.io/pricing/) [F]); it can catch web errors
  too, and must be on the privacy labels.
- **Reviews:** reply in App Store Connect (Admin or Customer Support role); replies appear within
  24 hours, the reader is told, abusive reviews can be reported.
  [respond to reviews](https://developer.apple.com/help/app-store-connect/monitor-ratings-and-reviews/respond-to-reviews/) [S]
- **Backups:** Supabase's free plan has no automatic backups, so export regularly; Pro keeps 7
  days; stored files are never in the backup.
  [backups](https://supabase.com/docs/guides/platform/backups) [F]
- Not sourced, offered as defaults [U]: usage counts that respect privacy, or none; a remote
  settings file with a lowest allowed version and an off-switch; an uptime check on the site and
  the database; a support address and one weekly slot to read it; a written release checklist.

## 8. What is specific to a Qur'an app?

- Accurate religious text: rule 1.1.5. [F]
- [Tanzil's text](https://tanzil.net/docs/text_license) (CC BY 3.0) [F]: verbatim copies only,
  "CHANGING IT IS NOT ALLOWED"; credit Tanzil, link to tanzil.net, keep the notice.
- The King Fahd Complex fonts: the licence file says no copying or changing without written
  approval, the Complex's site says the font is free.
  [licence db](https://scancode-licensedb.aboutcode.org/kfgqpc-uthmanic-script-hafs.html),
  [Complex](https://fonts.qurancomplex.gov.sa/wp02/en/?p=19) [S]. Confirm before embedding. The
  Quran Foundation's own terms:
  [fonts and images](https://api-docs.quran.foundation/legal/mushaf-fonts-and-images/) [S, not read].
- **5.2:** use only content you made or licensed. [F] A way for readers to report text errors,
  and fixing them fast. [U]

## Most often missed

1. Account deletion inside the app, and cancelling the Apple sign-in.
2. Privacy labels that leave out what the web part collects.
3. The saved-settings reason in the shell's privacy manifest.
4. A bare wrapper turned down under 4.2: nothing native, no offline handling.
5. The back end down, or no demo account, during review.
6. No EU trader status, so the app disappears from the EU store.
7. Age questions left unanswered, including unrestricted web access.
8. Never testing the automatic listing on Apple-chip Macs.
9. Web changes that go beyond fixes.
10. Tanzil credit missing, or the font licence never checked.
