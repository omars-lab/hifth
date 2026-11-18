# Why do the apps keep their own crash reports?

*2026-11-17, launch item ⑰.*

## What we planned

The launch plan said: keep Apple's daily crash reports on the device, and add a command that
lists the crashes Apple has collected from readers. The second half assumed Apple's server
holds every crash, from store builds as well as test builds.

## What we found

Reading Apple's developer server's own reference:

- **Test builds' crashes are there**, one per crash, with the device, the system version and
  the build. Each also carries the tester's own comment and email.
- **Store builds' crashes are not**, not for us. Apple shows them only inside Xcode's
  Organizer, from readers who chose to share with developers, and offers no way to fetch them
  from a script.
- **Freezes, slow launches and heavy storage writes are there for every build**, store builds
  included, grouped by where in the code they happen, with a weight for how often.
- **Apple's on-device reports (MetricKit) are handed to the app the next time it opens**, not
  once a day as the plan said. That held from iOS 15 on.

## What we did instead

Two halves, each where the data really is:

1. **The device keeps a store build's crashes.** The app saves each report it is handed, the
   last five, and the reader's problem report lists them under the errors: when, what kind,
   the system's numbers, the app's version, and for the newest crash the innermost places in
   the code. Never the words the system wrote about the crash, which can quote anything the
   app held. Nothing leaves unless the reader sends the report (the reader decides who sees
   their data).
2. **A command reads what Apple's server does hold:** test builds' crashes, and every build's
   freezes and slow launches. It names the fields it asks for, so a tester's comment and email
   are never fetched, printed or kept.

## Two smaller corrections on the way

- The command first used the reviews key. That key's access (support, finance, marketing)
  cannot read test builds; the upload key's (App Manager) can, so it uses that one.
- Comments and the design page said "the day after"; they now say "the next time it opens".

## What is still owed

A crash forced on a test device shows up in the problem report and in the command's list.
That needs the first test build, and the upload key's two ids saved.
