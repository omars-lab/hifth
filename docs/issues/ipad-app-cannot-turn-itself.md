# The iPad app cannot turn itself on its side, so a test turns it

**Found:** 2026-10-10, while trying to watch a recitation turn the open book in the iPad app
(native shell ㉘).

## What happened

The tool that presses things in the iPad app and reports what the page shows (the probe) ran
only upright. The demo will most likely be shown on an iPad on its side, so a fault that shows
only on the open book in the real app could reach the room unseen.

## What was tried, and what the evidence showed

- **Asking the app to turn itself at launch.** The app asked the system to turn its window on
  its side. The system refused every time: an iPad app that may share the screen with other
  apps is not allowed to choose its own orientation (the error says the current windowing mode
  does not allow it). Making the app full-screen only to allow this would change the shipped
  app for the sake of a check, so this was dropped.
- **Turning the simulator from outside by keystroke.** Not tried: this project does not turn the
  simulator by keystroke, because it takes over the laptop's keyboard focus.
- **A UI test turns the simulator, then starts the app with the probe asked for.** This is the
  same way the picture walk already turns it. It works, with one catch found on the way: the
  test cannot read what the app prints, so the app also writes its answer to a file, and the
  first runs never found the file because its path was relative. The app and the test start in
  different folders, so a relative path names two different files. The app now refuses a path
  that is not absolute, and make passes an absolute one.

## What replaced it

`make app-probe TARGET=ipad SIDEWAYS=1` restarts the iPad simulator, and a UI test
(`testProbeOnItsSide`) turns it on its side, starts the app with the probe, waits for the
answer file and fails if the page it answered from was not wider than it was tall (the
simulator sometimes says it turned and stays upright). The unit tests in `ProbeTests.swift`
cover writing the answer, writing nothing when no file is asked for, and refusing a relative
path.

The first real run: a surah played from its corner on the open book turned back to the
opening where the surah starts, forward with the recitation, and ended with its last verse lit
and its Play button up, in a page 1376 wide by 1032 tall.
