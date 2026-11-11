# Git's own label reader missed labels typed one paragraph too high

**2026-11-11.** Each commit message ends with lines that say what the commit was for
(`Intent-Task:`, `Intent-Use-Case:`, `Intent-Feature:`, `Intent-Plan:`). A hook adds them, and a
tool reads them back to answer "why was this change made?".

## What was tried

The tool read the lines back with git's own reader for such lines. The plan chose it on purpose,
so that we would not write a reader of our own.

## What the evidence showed

Git's reader only looks at the last paragraph of a message. Six commits had their label typed by
hand one paragraph above the credit lines at the very end. To git's reader those six had no
label. The hook that adds the lines looks at the whole message, saw the label, and added nothing.
So the hook counted them as labelled and the reader counted them as unlabelled, and the two
could never agree.

## Why the approach changed

History is not rewritten here, so the six commits stay as they are. A reader that cannot see
them would report a gap that is not real, on every run, for good.

## What replaced it

The tool now counts any line of the message that starts `Intent-<Name>:` as a label, wherever in
the message it sits. The hook and the reader use the same rule, so they agree. The names all
start with `Intent-`, so an ordinary sentence in a message is not mistaken for one.

Still git's own tool: adding the lines, which puts them in the last paragraph where git expects
them. Only the reading changed.

The plan says the same in short: `.claude/plans/intent-tracking.md`, under "How a commit knows
what it belongs to". The tests are in the tool's own repo (the intent-manager plugin).
