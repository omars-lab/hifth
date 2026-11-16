# What does a one-person app need to hear about problems and fix them fast? (research pass B)

*Written 2026-11-15 by the second of two independent research passes for the App Store readiness
plan (`.claude/plans/launch-readiness.md`). Pass A is [a.md](a.md); the checked,
combined answer is [research.md](research.md), which is the one to act on.*

**How to read the marks.** **[F]** the page was opened and the claim is from its text.
**[S]** only a search result was seen. Claims written "if …" depend on how the app loads its web
part; this pass did not know. (It is packed inside the app: `native/Hifth/Web/LocalScheme.swift`.)

## 1. What do readiness reviews ask, cut down to one person?

- [Google SRE launch checklist](https://sre.google/sre-book/launch-checklist/) [F]: architecture,
  capacity, failover, monitoring, security, automation, growth, outside services, rollout. For one
  person: list every outside service (Supabase, the site's host, DNS, Apple) and decide what
  happens when each fails.
- [Google production readiness review](https://sre.google/sre-book/evolving-sre-engagement-model/) [F]:
  dependencies, monitoring, emergency response, capacity, change management, performance.
- [AWS operational readiness questions](https://docs.aws.amazon.com/wellarchitected/latest/operational-readiness-reviews/appendix-b-example-orr-questions.html) [F]:
  - how each outside service fails, and how the app retries;
  - limits on abuse before sign-in;
  - how fast you must restore, "Have you practiced it? Do you have a runbook?";
  - a practice day that proves alerts reach you;
  - a weekly look at open support requests and new runbook entries.
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) [F]:
  - row-level security on, and account access reviewed;
  - your own mail sender: the default allows 2 sign-in emails an hour;
  - a robot check on sign-up, sign-in and password reset;
  - free projects with little use can be paused after 7 days;
  - free projects cannot download backups;
  - mail scanners can use up single-use sign-in links before the reader clicks.
- [Apple's guidelines](https://developer.apple.com/app-store/review/guidelines/) [F]: 1.5 a way to
  contact you; 5.1.1(v) delete the account in the app; 4.2 more than a repackaged website.

## 2. How do we see what goes wrong?

- **Native crashes without an outside library:**
  - TestFlight testers send crash reports automatically; store readers only if they switched on
    "Share With App Developers"; reports can take days.
    [Xcode help](https://help.apple.com/xcode/mac/current/en.lproj/deve2819c518.html) [S]
  - MetricKit hands the app crash details, but the app has to collect and send them; only readers
    who opted in; up to about a day late.
    [article](https://www.luciq.ai/blog/what-metrickit-means-for-in-process-crash-reporting) [S]
- **Sentry:** free plan 1 user, 5,000 errors a month, 30 days; Team $29 a month
  ([pricing](https://sentry.io/pricing/) [F]). Its native library does **not** catch errors in
  the web view; the web part needs its own, and the two can be linked.
  [web view](https://docs.sentry.io/platforms/apple/configuration/webview/) [F]
- [Privacy labels](https://developer.apple.com/app-store/app-privacy-details/) [F]: crash,
  performance and other diagnostics are their own categories; outside libraries' data counts as
  yours; data counts as linked to the reader unless identifiers are stripped first; an optional
  feedback form may be left off only if it meets all four exemption rules (started by the reader
  each time, not the app's main purpose, and so on).
- **"Script error." in the web view:** a page loaded from a file gives no detail to the error
  handler; an Apple engineer suggests serving through the app's own scheme (which Hifth does).
  Nobody confirmed that fixes it. [forum](https://developer.apple.com/forums/thread/768547) [F]
- **Getting logs off a device:** on iOS the system log can be read only for the current run, and
  debug lines are missing in TestFlight builds
  ([forum](https://developer.apple.com/forums/thread/691093) [S]). The usual way is an "export
  diagnostics" button that writes a file and opens the share sheet, so the reader chooses to send
  it ([article](https://steipete.me/posts/2020/logging-in-swift) [S]). Suggestion: keep a small
  log on the web side too.
- **Matching errors to source:** tag each event with the app's build and the web build's commit.
  [example](https://capawesome.io/docs/cloud/native-builds/integrations/sentry/) [S]
- **Stale cached copies:** Vite says "Failed to fetch dynamically imported module" comes from a
  cached page asking for files a new upload deleted; keep old files a while, cache them ahead, and
  reload when a load fails ([Vite](https://vite.dev/guide/troubleshooting) [F]). The emergency fix
  is a self-removing offline cache script at the same address
  ([list](https://lists.w3.org/Archives/Public/public-webapps-github/2021Apr/0241.html) [S]).
- **Offline caching inside Apple's web view:** developers report it works only with "app-bound
  domains", at most 10, and Apple's support is unclear
  ([forum](https://developer.apple.com/forums/thread/773539) [S]). Hifth skips the offline cache
  inside the app and packs the files instead; this matters for the browser version only.

## 3. How do we hear from readers?

- **TestFlight feedback** (screenshots and crashes) can be read through the App Store Connect API
  or sent by webhook ([API](https://developer.apple.com/documentation/appstoreconnectapi/beta-feedback-crash-submissions.md) [S]);
  one post says it broke from 2026-05 ([forum](https://origin-devforums.apple.com/forums/thread/832562) [S]).
- [Reviews](https://developer.apple.com/help/app-store-connect/monitor-ratings-and-reviews/ratings-and-reviews-overview) [F]:
  reply, edit or delete a reply; the reader is told and can change their review; a new version can
  reset the rating. The API has review and reply endpoints; replying reportedly needs an Admin key
  ([forum](https://developer.apple.com/forums/thread/727332) [S]). One indie developer starts from
  "Most Helpful", avoids answering everything with "please email", and writes addresses out
  because links in replies are not tappable
  ([Slopes](https://blog.curtisherbert.com/slopes-diaries-19-app-store-review-replies/) [F]).
- A FAQ page cut one developer's support mail by about 99.9%
  ([Burnout Buddy](https://swiftrocks.com/things-that-did-and-didnt-contribute-to-burnout-buddys-success) [F]).
- No sourced figure was found for how fast indie developers aim to reply.

## 4. How do we ship a fix fast?

- [Review times](https://developer.apple.com/distribute/app-review/) [F]: half within 24 hours,
  nine in ten within 48; ask for a faster review for a critical fix, with the steps to reproduce.
  2026 crowd figures (about 7–15 hours) [S]; a Mac store slowdown early in 2026 [S].
- [Staged release](https://developer.apple.com/help/app-store-connect/update-your-app/release-a-version-update-in-phases) [F]:
  1 to 100% over 7 days; pause up to 30 days in total; manual downloads still work. The page is
  about **updates**; whether it applies to a first release was not confirmed. **A pause recalls
  nothing, so it is not an off-switch.**
- **What the web part may change without review** (only if it is downloaded):
  developer agreement 3.3.1(B) and rule 2.5.2 [F]. Whether rule 4.7 covers your own updating web
  part is not confirmed. Hifth packs its web part, so every change goes through review.
- **Off-switch and lowest version:** a setting from your own server, checked at launch and when the
  app comes back; raise the lowest version only after a staged release finishes
  ([article](https://digitalbunker.dev/how-to-force-update-your-ios-app/) [S]).
- **Database changes:** `supabase db push` applies only new changes; changes made by hand in the
  dashboard break the history; prove changes on a fresh local copy; nothing makes undo steps for you
  ([migrations](https://supabase.com/docs/guides/deployment/database-migrations.md) [S]). Keeping old
  app versions working (add first, remove later) is standard practice, not sourced here.
- [Backups](https://supabase.com/docs/guides/platform/backups) [F]: Pro keeps 7 days; restore to a
  point in time costs about $100–400 a month; stored files are **not** backed up; the project is
  offline during a restore; on the free plan run `supabase db dump` on a schedule and keep copies
  elsewhere. Whether the free plan has any daily backup: sources disagree.
- **Abuse limits** [F, production checklist]: one-time codes 360 an hour, anonymous sign-ins 30 an
  hour per address; robot check by hCaptcha or Turnstile. A form that writes straight to a table
  is not covered by those limits; put it behind a robot check and a server function.
- **Replacing keys:** the old public and service keys are being replaced by new publishable and
  secret keys, the old ones retired by the end of 2026; the new signing keys rotate without signing
  everyone out ([rotate](https://supabase.com/docs/guides/security/rotate-leaked-api-keys) [S]).
- **Scanning:** Dependabot on every plan; secret-scan push protection free on public repositories
  ([GitHub](https://docs.github.com/en/code-security/getting-started/github-security-features) [S]).

## 5. What do first-time launchers wish they had done?

- No usage counts, so bugs could not be reproduced; priced too low
  ([Burnout Buddy](https://swiftrocks.com/things-that-did-and-didnt-contribute-to-burnout-buddys-success) [F]).
- Did not check the idea, no marketing, no measure of who came back
  ([Hackernoon](https://hackernoon.com/lessons-from-my-first-profitable-ios-app-%241400-in-90-days) [F]).
- Backups not automated; now a scheduled export with an alert on failure; read crash reports "even
  when there's only one" ([dev.to](https://dev.to/egor_kabantsov/you-released-an-app-now-what-28jn) [F]).
- "A way for users to tell you what's broken" is first on one list of regrets
  ([dev.to](https://dev.to/shayy/what-most-devs-forget-when-launching-and-regret-later-2fbm) [F]).
- First TestFlight build crashed for half the testers
  ([itnext](https://itnext.io/when-your-app-freezes-in-front-of-your-testers-what-i-learned-about-ego-ios-development-fae8e7461c5a) [S]).
- Launch traffic overwhelmed the server
  ([Indie Hackers](https://www.indiehackers.com/post/how-hacker-news-crashed-our-service-with-2-83-million-server-hits-what-not-to-do-af2e4fed10) [S]).

## The smallest set of operations for one person

1. Crash and error reports from both halves, tagged with the app build and the web commit, and on
   the privacy labels.
2. Read Apple's crash list and any error mail daily for the first two weeks.
3. Test offline on a real device inside the app.
4. Reload when a load fails, with a guard against loops; keep old files for one release.
5. A remote settings file: lowest allowed versions, a maintenance message, features on or off.
6. A "Report a problem" button that the reader chooses to send.
7. A support address and a FAQ or known-issues page, given as the support address.
8. Read and answer reviews daily; read TestFlight feedback.
9. Staged release for updates, knowing a pause recalls nothing.
10. A faster-review request written and ready to paste.
11. A scheduled database export kept elsewhere, an alert on failure, one practised restore.
12. A robot check and your own mail sender on sign-in and the list; dependency and secret scans on;
    a written page for replacing a leaked key.

## Could not confirm

A reply-time benchmark; whether rule 4.7 covers your own updating web part; whether a staged
release applies to a first release; whether the free Supabase plan has daily backups; whether the
old Supabase secret can still be rotated; whether serving through the app's own scheme fixes
"Script error."; Apple's support for offline caching in its web view.
