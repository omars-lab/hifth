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
| 4. archive | `make app-archive` | refuses unless the web part is public; checks the release build, then makes the Xcode archive and checks the app inside it again (no walk capture, the public build, Apple's privacy file). Stays on the laptop, so the licence does not hold it |
| 5. sign it for the store | `make app-export` | signs the archive for the App Store into `native/build/store/export`. The first run made the team's App Store certificate in the Apple account (owner's yes, 2026-11-16); later runs reuse it. If it is ever revoked, ask the owner before a run makes a new one |
| 6. upload | `make app-testflight` | locked behind the licence decision, checked before anything is built; the upload itself is not built yet |

Commit the change to `native/project.yml` that step 2 makes, in the same commit as the release
it belongs to, so the build number in the repo is always the one last sent.

## Scripts: when to use each

| script | what it does | when to reach for it | command |
|---|---|---|---|
| `scripts/app-version.mjs` | reads and writes the two version lines in `native/project.yml`, and nothing else in it; refuses a version Apple would refuse (more than three numbers, letters, leading zeros) or one lower than today's | before every build meant for Apple | `make app-version [VERSION=x.y.z] [NEXT_BUILD=1]` |

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

The archive and export, the upload, version numbers raised by the release itself, Apple's own
check of the archive, and the steps after upload (review, staged release). Each is a row in the
backlog tagged for the launch (`make issues LAUNCH=1`).
