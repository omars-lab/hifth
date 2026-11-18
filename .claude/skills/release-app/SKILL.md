---
name: release-app
description: Take a store build of the iPad, iPhone and Mac app from a version number to an upload to Apple: use when asked to set or raise the app's version or build number, archive the app for the App Store or TestFlight, check what Apple requires of a store build (the privacy file, the public build only, no walk capture), or plan a release. The upload stays locked until the licence decision is settled. Not for building or running the app on the laptop, the simulator or the owner's iPad (use native-shell), and not for publishing the website (use deploy-site).
---

# Releasing the app to the App Store

The launch plan is `docs/design/app-store-launch.md`, and its measures live in
`.claude/goals/app-store-launch.md`. This skill is the commands, in the order a release uses
them. Each is a `make` target from `native/Makefile.native`.

## Short version

| step | command | what it does |
|---|---|---|
| 1. see where the version stands | `make app-version` | says the version readers see and the build number |
| 2. set the version for this release | `make app-version VERSION=1.0.0` | sets it and raises the build number; a lower version is refused |
| 2b. or only a new build of the same version | `make app-version NEXT_BUILD=1` | raises the build number by one |
| 3. put the public build in the app | `make app-web FLAVOUR=public` | the store build is never the private one |
| 4. archive | `make app-archive` | refuses unless the web part is public; checks the release build, then makes the Xcode archive and checks the app inside it again (no walk capture, the public build, Apple's privacy file). Once every check passes, it writes a receipt beside the archive. Stays on the laptop, so the licence does not hold it |
| 5. sign it for the store | `make app-export` | refuses an archive with no receipt, or one whose app has changed since; then signs the archive for the App Store into `native/build/store/export`. It signs with Apple's online store certificate through Xcode's own sign-in (Xcode > Settings > Accounts); the store key has no right to that certificate. The sign-in expires: "Your session has expired" means the owner signs in again there (2026-11-17). The first run made the team's App Store certificate in the Apple account (owner's yes, 2026-11-16); later runs reuse it. If it is ever revoked, ask the owner before a run makes a new one |
| 6. Apple's check | `make app-store-check` | refuses an export older than the archive's receipt, or an archive the receipt no longer matches; then sends the exported app to Apple to check its signing, icons, permissions and privacy file. It makes no build anyone can install, puts nothing in the review queue and uses no build number, so the owner allowed it before the licence answer (launch item 42, 2026-11-17) |
| 7. upload | `make app-testflight` | locked behind the licence decision, checked before anything is built; runs Apple's check before sending; the upload itself is not built yet |
| 4m. the Mac archive | `make app-archive-mac` | the same as step 4 for the Mac app, in `native/build/store-mac/`: the Mac release check first, then the sandboxed archive signed by the team under the real app id (the project signs the everyday Mac app ad hoc; only this command signs it with the team). It takes the archived copies off macOS's list of apps that open `hifth://` links, so a link never opens the store copy with its empty data. Owner's yes, 2026-11-17 |
| 5m. the Mac package | `make app-export-mac` | the same as step 5, making `Hifth.pkg`; then opens the package and checks the app inside it, since the export signs the app again and that is the copy that would be sent. The first run made the team's Mac installer certificate (owner's yes, 2026-11-17) |
| 6m. Apple's check of the Mac package | `make app-store-check-mac` | the same as step 6 for the package. Not run until the Mac is added to the app's record in App Store Connect ("Add platform"); the owner's yes to Apple's check covered the iPad and iPhone app |
| the store's screenshots | `make app-store-shots` (after step 3) | takes each screen of the public build on the iPhone (6.9 and 6.3 inch), iPad (13 inch) and Mac, in English and Arabic, into `native/shots/store/<language>/<device>/`; takes out any see-through layer, then refuses a picture of a size the store does not take. Refuses the private build. Look at every picture before it goes up: a first-run tip or a half-drawn page is not something a check can see. The pictures stay on the laptop |

Commit the change to `native/project.yml` that step 2 makes, in the same commit as the release
it belongs to, so the build number in the repo is always the one last sent.

## Scripts: when to use each

| script | what it does | when to reach for it | command |
|---|---|---|---|
| `scripts/app-version.mjs` | reads and writes the two version lines in `native/project.yml`, and nothing else in it; refuses a version Apple would refuse (more than three numbers, letters, leading zeros) or one lower than today's | before every build meant for Apple | `make app-version [VERSION=x.y.z] [NEXT_BUILD=1]` |
| `scripts/store-shots.mjs` | holds the list of screens, devices and Apple's sizes (read 2026-11-17 from Apple's screenshot specifications page); `plan` prints one line per picture for the make command; `check DIR` refuses a missing picture, one not in the plan, one of a size the store does not take for its device, or one with a see-through layer | to add or change a screen or a device, edit its lists; the check runs at the end of `make app-store-shots`. By hand to check a folder of pictures before an upload | `node .claude/skills/release-app/scripts/store-shots.mjs check native/shots/store` |
| `scripts/archive-receipt.mjs` | `--write` fingerprints every file in the app inside the archive and saves it, with the commit and whether the work was all committed, as `Hifth.xcarchive.receipt.json`; `--check` refuses an archive with no receipt, or whose app has any file changed, added, removed or renamed since | never by hand for a release: `make app-archive` writes it and `make app-export` and `make app-testflight` check it; the Mac commands pass `--by "make app-archive-mac"`, so the receipt and any refusal name the Mac command. By hand to ask whether the archive on disk may still be signed | `node .claude/skills/release-app/scripts/archive-receipt.mjs --check native/build/store/Hifth.xcarchive` |

The release check that step 4 runs lives with the walk, in
`.claude/skills/walk-app/scripts/release-check.mjs`, since it was written to keep the walk
capture out of release builds; with `--flavour public` it also checks the public build and the
privacy file.

## Apple's privacy file

`native/Hifth/Resources/PrivacyInfo.xcprivacy`, in both apps. It says the app tracks nobody,
names no tracking address and collects nothing, and lists none of the system features Apple asks
a reason for, because the shell uses none. When the shell starts using one (saved settings, file
dates, the time since start-up, free disk space, the keyboard list), add it there with Apple's
reason code; the release check refuses a listed feature with no reason. When sign-in or the
reader-sent problem report arrives, the collected-data list changes with it.

## Not built yet

The upload itself, one
command that runs the whole release with the version raised, and the steps after upload
(review, staged release). Each is a row in the backlog tagged for the launch
(`make issues LAUNCH=1`). The whole road, its one-time setup and what each step guards against
are explained in the `understanding-processes` skill's `app-release.md`; `make app-release-setup`
checks the setup.
