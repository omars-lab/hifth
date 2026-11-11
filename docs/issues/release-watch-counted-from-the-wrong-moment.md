# The iPad release watch started its clock too early

*Found 2026-11-11, while the checks for the pencil's rings were running on a busy laptop.*

## What happened

The last step of an iPad release opens the app on the iPad and watches its output for a set
number of seconds. It fails the release when the app closes by itself or prints an error nobody
caught.

Its test for "an error is caught" failed once, on a laptop that was also running the browser
tests. Run alone it passed.

## What the evidence showed

The watch counted its seconds from the moment it *started* Apple's device tool. On a busy
laptop the tool took longer to start than the whole watch lasted in the test. So the watch
ended, and passed, before the app had printed a single line. The error came afterwards and
nobody was looking.

That is not only a test problem. On a real release the same thing lets a crash through whenever
the device tool is slow to open the app.

## What changed

The watch now counts from the app's first line of output. If the tool prints nothing at all,
the watch starts anyway after 30 seconds, so a silent app is still watched and the release
cannot hang.

A test plays a device tool that is slower to start than the watch is long, and then throws. It
failed before the change and passes now.

## Where

- `native/scripts/release-watch.mjs`
- `scripts/native-release-watch.test.mjs`
