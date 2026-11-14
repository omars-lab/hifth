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

### ① Make the App Store Connect record for iPhone and iPad, not iPad only · **answered**

Done 2026-11-09, as "Hifth - The Huffaz Toolkit". Yours, when doing TestFlight step ②: tick both platforms, **iOS** (iPhone and iPad) and **macOS** (the Mac build uses the same ID, so one record covers all three). The build
already says which devices it runs on. **I did not check** whether Apple lets a later version
drop the iPhone once a build that runs on it has gone to testers; it is known to refuse that
for apps in the store, so settle the iPhone before the first upload, not after.

### ② Walk the pitch build in the iPhone simulator, upright and on its side, and fix what is wrong · **open**

The agent's. The web app has a phone layout and phone tests, but the shell on an iPhone has
only been photographed on a few pages, never walked as a reader would: turning pages, the
look-alike chips, the drawers, a bookmark, a mistake noted, the commentary. Every fault found
gets a test and a line on the walk checklist (the `walk-app` skill).

**Walked 2026-11-14, the pitch path** (`make pitch-walk ON="iPhone 17"`, and `UPRIGHT=1`):

- **Found and fixed: the iPhone app did not turn.** Held on its side, the page stayed upright,
  because the app's settings let only the iPad turn. The iPhone now turns to either side (not
  upside down); a test reads the settings (`scripts/ios-orientations.test.mjs`).
- **Upright and on its side, all 14 pitch steps pass**: one page; a tap opens the note in a short
  card at the foot with the verse whole above it; the look-alike lists, the roots list, the surah
  introduction and the Mistake pen all clear of the verse. Reading a note to its end grows the
  card to the full screen, over the page (the pictures of step 4, both ways up).
- **The walk's own checks were iPad-shaped**: they wanted two pages and the commentary in sight
  at once. On a phone the card shows the verse's translation first and the commentary below its
  fold, a scroll away. The checks now expect one page on a narrow screen and scroll the card to
  the commentary. Whether the commentary should start lower like that is ③.
- **Not walked yet:** a page turned by hand and a bookmark, which the pitch path does not cover.

### ③ Where does The Study Quran's note go on a phone? · **answered**

The agent's, built to find out rather than argued. On the iPad the note sits beside the verse;
a phone has no room beside. Likely shapes: a sheet that rises from the bottom over half the
page, a full-screen note with a way back to the verse, or the page shrinking above the note.
Build the main ones as switchable options on the pitch build, try them on the simulator, keep
the best as the default and the others as a setting.

**What the iPhone walk showed (2026-11-14):** today it is the first shape, a card from the
bottom. Held sideways, the card leaves a strip about 150 points tall for the note: the title and
one line of the verse's translation. The commentary itself starts below that, a scroll away, and
upright the long translation of 2:255 pushes it about 200 points below the screen's foot.

**What was built (2026-11-14):** each way was built, and the first of each is the default. Which way stays is still an open choice for the owner (below).
The others are settings in the pitch build's info panel.

- **Upright**, the note leads with two lines of the translation and a "Whole translation" button.
  The commentary starts inside the short card. The other settings are the whole translation
  first (as before) or the note opened full.
- **On its side**, the note stands the full height of the screen beside the page, and the page
  moves over. The other setting is lying across the foot (as before).

Measured on 2:255, before any scroll: 3 lines of the commentary in sight upright, 4 on a
6.3-inch phone on its side and 5 on the largest. Every line of the verse stays clear of the note.
On its side, the bars at the foot of the screen used to cover the end of the verse: the last 2 of
its 6 lines on the smallest phone (375 points tall), and the walk's picture showed the same on the
6.3-inch one. That was already so before this change. Those bars now step aside while the note
stands beside the page (⑪ below, the backlog row `phone-side-foot-bars-cover-verse`). The two choices are the open decisions `phone-note-lead`
and `phone-note-sideways`, drawn on
[the options page](https://blog.bytesofpurpose.com/hifth/docs/design/phone-note-options.html)
and argued in [the decision record](../decisions/phone-note.md).

### ④ Install it on the owner's own iPhone with the paid team · **blocked**

The agent's, now that the app ID is registered (TestFlight ②), once the app is signed with the paid
team (TestFlight ③, which waits on Xcode being signed in). Same install as the iPad:
`make app-release-ipad DEVICE=…` (or `make app-device-install` to skip the checks), over Wi-Fi once the phone is paired.

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

**Recitation on a HomePod (⑧–⑩).** There are two ways, and the second needs Apple's approval,
which is a separate step of its own.

### ⑧ An AirPlay button, so recitation plays on a HomePod or other speaker · **open**

The agent's, after ⑥. AirPlay needs nothing from Apple. Add the button, and tell iOS the
recitation is long listening so the HomePod plays it smoothly.

### ⑨ Answer "Hey Siri, play al-Kahf in Hifth" on the iPhone and iPad · **open**

The agent's, after ⑥. The Siri box on the app's ID allows it; the app then has to answer
Siri's request to play, naming a surah or a page. Built and tried on the phone before ⑩.

### ⑩ Ask Apple to let a HomePod pass those requests to Hifth · **blocked**

Yours, once ⑨ works. A separate approval: a form at
<https://developer.apple.com/contact/request/sirikit-media-intent-for-homepod/>, signed in. The
form is behind Apple's sign-in, so I did not read what it asks; Apple's general rule is that it
is granted to an app that already answers Siri's play requests, so asking before ⑨ works would
likely be turned down. The agent drafts the answers when the time comes.

### ⑪ On a phone on its side, the bars at the foot cover the end of the verse · **fixed**

The agent's, found while measuring ③ (2026-11-14), and already so before it. With a note open
on a phone held on its side, the bars at the foot of the screen take about the lower 40% of the
height. On the smallest phone they cover the last 2 of 2:255's 6 lines, and the walk's picture
shows the same on a 6.3-inch phone. Just after the tap, the page also shows its own foot for a
moment before it moves to the verse.

**What was done (2026-11-14):** while a note stands beside the page on a phone held on its side,
the bars at the foot are hidden; the header stays, and closing the note brings them back. On both
the smallest phone and a 6.3-inch one, every line of 2:255 is now in sight beside the note. In
the iPhone app on its side, the picture taken just after the tap shows the verse at once, with no
bar at the foot, so the page's foot no longer shows first. Tests: the pitch spec's "every line of a six-line verse is in sight
beside its note" on both sizes, and "closing the standing note brings the bars at the foot back".

## What the app's ID allows, and what else may be needed

The ID was registered 2026-11-09 with iCloud, Associated Domains, Siri, Push Notifications and
Sign in with Apple; the app-setup skill lists why each is there. A microphone line is needed only if
the voice coach ships ([maqam-voice-coach.md](maqam-voice-coach.md)). A shared app group is
needed only if a home-screen widget is ever built.
