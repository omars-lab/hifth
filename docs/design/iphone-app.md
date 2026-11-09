# The iPhone app: what does it take for a hafiz to revise on a phone?

*Started 2026-11-09, when Omar said "i also want an iphone app".*

## The short version

- **It is the same app.** The iPad app's project already builds for iPhone too: one build,
  one ID (`com.bytesofpurpose.hifth`), one App Store Connect record for both. The iPhone
  simulator already runs it, and screenshot tests already check a few iPhone pages.
- **So nothing new needs registering.** Step ② of the TestFlight plan (register the ID, make
  the record) covers the iPhone as long as the record is made for iOS and macOS, not iPad only. The
  links and IDs are in the `app-setup` skill.
- **What is not known yet** is whether a page of the mus'haf, the tools and The Study Quran's
  notes work on a screen that small. That is the open work below, and it is the agent's.

## A few words, defined once

- **Mus'haf** — the printed Qur'an, page for page; the app draws its pages.
- **The shell** — the native iPhone, iPad and Mac app that shows the web app inside its own
  window ([native-shell.md](native-shell.md)).
- **The pitch build** — the private version with The Study Quran's commentary beside the
  verses, shown only to its owners.

## What does it change for a hafiz?

A phone is what a hafiz has on them all day: on the train, between prayers, away from the
desk. The iPad is the closest thing to holding the mus'haf; the phone is where revision
happens in the gaps. A phone page is small, so the look-alike verses, the marks and the notes
all compete for the same few centimetres.

## Why is this being asked now?

Because the Apple membership is active and the app ID is about to be registered. The record
made then decides whether the iPhone is in from the start.

## Open questions, and what would answer each

### ① Make the App Store Connect record for iPhone and iPad, not iPad only · **open**

Yours, when doing TestFlight step ②: tick both platforms, **iOS** (iPhone and iPad) and **macOS** (the Mac build uses the same ID, so one record covers all three). The build
already says which devices it runs on. **I did not check** whether Apple lets a later version
drop the iPhone once a build that runs on it has gone to testers; it is known to refuse that
for apps in the store, so settle the iPhone before the first upload, not after.

### ② Walk the pitch build in the iPhone simulator, upright and on its side, and fix what is wrong · **open**

The agent's. The web app has a phone layout and phone tests, but the shell on an iPhone has
only been photographed on a few pages, never walked as a reader would: turning pages, the
look-alike chips, the drawers, a bookmark, a mistake noted, the commentary. Every fault found
gets a test and a line on the walk checklist (the `walk-app` skill).

### ③ Where does The Study Quran's note go on a phone? · **open**

The agent's, built to find out rather than argued. On the iPad the note sits beside the verse;
a phone has no room beside. Likely shapes: a sheet that rises from the bottom over half the
page, a full-screen note with a way back to the verse, or the page shrinking above the note.
Build the main ones as switchable options on the pitch build, try them on the simulator, keep
the best as the default and the others as a setting.

### ④ Install it on the owner's own iPhone with the paid team · **blocked**

The agent's, once the app ID is registered (TestFlight ②) and the app is signed with the paid
team (TestFlight ③). Same install as the iPad: plug in, `make app-device-install DEVICE=…`.

**Recitation on the phone and the iPad (⑤–⑦).** The app already plays each verse's recitation, streamed from Quran.com's public audio site.
Nothing on Apple's ID page is needed for that. What is missing is in the app itself.

### ⑤ Keep recitation playing when the iPhone's ring switch is on silent · **open**

The agent's. Tell iOS the app is for listening, the way a music app is, so the silent switch
does not mute it. A test checks that the setting is made when the app starts.

### ⑥ Keep recitation playing when the screen locks or the reader switches apps · **open**

The agent's. Turn on audio in the background in the app's project settings, then try it on
the simulator. The recitation plays inside the app's web view, and iOS may still pause that in
the background. If it does, playback moves to the native side of the app.

### ⑦ Show play and pause on the lock screen and on AirPods · **open**

The agent's, after ⑥. Tell the lock screen which verse and reciter are playing, and answer its
play, pause and next buttons.

## What the app's ID allows, and what else may be needed

The ID was registered 2026-11-09 with iCloud, Associated Domains, Push Notifications and Sign
in with Apple; the app-setup skill lists why each is there. A microphone line is needed only if
the voice coach ships ([maqam-voice-coach.md](maqam-voice-coach.md)). A shared app group is
needed only if a home-screen widget is ever built.
