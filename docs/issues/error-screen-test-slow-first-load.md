# The error screen's test failed only when the whole suite ran

**What happened (2026-11-16).** A commit that changed only two Markdown pages was refused. The
error screen's test "offers a problem report that already holds the error" could not find the
"Report a problem" button. Run on its own, the same test passed, taking about 2.3 seconds.

**Why.** The button comes from the rarely used tools' file, which the app loads only after the
error card shows. In a test, the first load of that file also compiles it, and it is large.
Alone that took about 2 seconds; under the full suite, with every other test file compiling at
the same time, it ran past the test's 5-second wait.

**What changed.** The test file loads the rarely used tools' file once before its tests, with a
60-second allowance of its own. The 5-second wait now covers only drawing the button, which is
what the test is about. The wait was not raised and no retry was added.

**If it comes back.** Any test that waits for something from a later-loaded file can hit the same
thing. Load the file in a `beforeAll` first, as this one does, rather than raising the wait.
