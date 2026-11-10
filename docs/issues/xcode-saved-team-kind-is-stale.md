# Xcode's saved settings call a paid team "Personal Team"

**2026-11-09.** Before installing on the owner's iPad we wanted to stop early if only a free team
would sign the app, because a free team's install stops opening after 7 days.

## What was tried

The first check read Xcode's saved settings on the laptop, which keep a list of teams with a
flag for whether each is a free "Personal Team". The check stopped the install unless a paid
team was listed.

## What the evidence showed

The settings still listed team 76NHKA839A as a free Personal Team. But Xcode's own Accounts
screen showed the same team as the paid "Developer Team", role Admin, with two devices set up
for testing. Quitting and reopening Xcode did not update the settings. So the check would have
stopped a good install.

## What replaced it

Two checks, each reading something that cannot go stale:

- **Before the build:** is any Apple account signed in to Xcode at all? The account list in the
  settings is reliable; only the team flag is not.
- **After the build:** the signing profile inside the built app. It says when it runs out. The
  install goes on only if it has 30 days or more left, which a paid team's year-long profile has
  and a free team's week-long one never does. It counts from today, so a year-old profile that
  Xcode reused also stops the install before it runs out in the week of the meeting.

The scripts are `native/scripts/xcode-account.sh` and `native/scripts/profile-lasts.sh`; the
install target in `native/Makefile.native` runs both.
