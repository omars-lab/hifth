# May a build of the app that carries The Study Quran's commentary go to a few named outside testers through TestFlight?

*Status: open, since 2026-09-29. Until it is settled the app stays on this project's own
devices, and the two build steps that would upload it refuse to run. Nothing is blocked by
that except the upload itself.*

**The picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/native-testflight-options.html> —
`native-testflight-options.html`, checked in and rebuilt by
`scripts/build-native-testflight-options.mjs`. It draws each option as the path the build
takes from this laptop to a tester's iPad, with what is on board at each stop. The address
is the page's own on the app's site, public the day it is merged.

## A few words, defined once

- **The shell** — the Mac and iPad app. It shows the web app unchanged inside a native
  window and adds no data of its own. How it was built is `docs/design/native-shell.md`.
- **The private build** — the version of the app that carries The Study Quran's commentary
  beside the verses. It is shown only to the people who own that commentary, and the public
  website never carries it.
- **TestFlight** — Apple's way of letting named people install an app before it is in the
  store. An *internal* test goes to people added to the developer account, there is no review
  by Apple, and a build lasts 90 days. It needs a paid developer membership.
- **The verse links** — the app's map of which verses a reader confuses with which. It is
  computed from a scholarly corpus under the GPL, a licence that forbids adding terms of your
  own when you pass the work on.
- **A licensing opinion** — a reading of the licences by someone qualified to give one.
  Everything written here about the GPL so far was written by a non-lawyer.

## What does it change for a hafiz?

Nothing on screen. Every option shows the same mus'haf and the same commentary; only B loses
the verse links. What changes is who can hold the app and where: on their own iPad at home
(A, B), or on the owner's iPad in a meeting (C). For a hafiz on The Study Quran team, that is
the difference between trying the app the way they would use it and watching someone else.

## Why is this being asked now?

Because the app exists. Until 2026-09-29 there was nothing to upload. The Track B note
(`docs/design/track-b-native.md`) argued in August that a GPL binary cannot go to Apple's
store, and nothing in that argument has changed. TestFlight to named testers is a narrower
question the note did not ask, and the pitch wants it answered before the first upload.

## What happens if nobody decides?

Option C, by default. The app runs on the owner's Mac and iPad, the pitch is shown in
person, and `make app-archive` and `make app-testflight` refuse to run while this row is open.
Nothing breaks. The moment a tester asks to keep the app, this question is back.

## What does the app do today, and what does it cost?

The shell is signed for this project's own devices with a development certificate. On a
free team an install lasts seven days; on a paid one, a year. A tester in the room can hold
the owner's iPad; they cannot take it home. The cost is that any interest formed in a
meeting has nothing to act on the next morning.

## What do people outside this project do about it?

Apps that ship GPL code on Apple's platforms (Signal, OsmAnd) do so because every copyright
holder granted an extra permission for the store's terms. This project cannot obtain that
for the corpus it uses; the survey is in the Track B note §②–③ and is reused here, not
redone. **I did not look further** for how other projects treat TestFlight as distinct from
the store, because the answer turns on the licence text, not on what others chose.

## What have we already decided that constrains it?

- The public site carries no scripture text and no held commentary, and the gates enforcing
  that stay on. Nothing here touches them.
- The private build is a mockup of a partnership shown to the people who own the material,
  not a release. TestFlight to those same people is the first time "in a room" would stretch
  to "on their own device", with the commentary resting on Apple's servers on the way.
- The Track B reading that the App Store is closed to a GPL binary stands; its item
  `gpl-and-the-app-store` waits on a licensing opinion. This record does not reopen the
  store.

## The options

Each is drawn on the page as the path the build takes, with what is on board at each stop.
Pros, cons and what each commits us to are on the page beside its drawing.

- **A. Send the whole build to named testers through TestFlight.** The private build goes
  to Apple once and to a handful of named people. The pitch works like a product; the
  licensing opinion stops being deferrable; needs the paid membership; sets the precedent.
- **B. Send a build with the GPL-derived data left out.** Same path, but the verse links
  are stripped first. No GPL question on the upload; the demo loses its headline feature;
  two build flavours to keep working.
- **C. Own devices only; show it in the room.** What happens today. Nothing leaves the
  laptop; the pitch is a demonstration, not a trial.

**Recommendation, for what it is worth from a non-lawyer:** C now, and A the day someone
qualified has read the three licences and said an internal test to named people is not the
distribution the GPL and Apple's terms are about. B is the fallback if that reading goes the
other way and the pitch still needs a home install.

## What else could be considered, and why is it not here?

Ad-hoc signing (a build tied to each tester's device number, sent as a file) needs the same
paid membership, the device numbers in advance, and a cable or a hosted file; it moves the
bytes from Apple's servers to ours and is the harder road on iPad. Sending the Mac app as a
file avoids Apple but trips the "damaged app" warning on every Mac since macOS 15 unless
notarised, which needs the same membership; it is a Mac-only fallback and the pitch is for
the iPad.

## What would change the answer?

A licensing opinion that reads an internal TestFlight test as private sharing makes A
plain; one that reads it as distribution makes B the only upload. Rederiving the verse links
from a permissively licensed corpus would dissolve the GPL half and leave only the
commentary, which is the owners' own.

## What is this not settling?

Not the App Store, which stays closed on the same opinion. Not whether the print's own terms
allow any of this; that reading is still owed by a person and is its own row. Not Universal
Links, which need the same membership and are their own item. Only whether the first upload
to Apple may happen, and with what on board.
