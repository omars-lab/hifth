# How does a change to the code say which task it was for?

*Status: decided. The owner approved the plan that chose "a few lines at the end of each commit
message, added by a hook" on 10 November 2026.*

## A few words, defined once

- **Commit**: one saved change to the code, with a short message saying what changed.
- **Task**: one row in [the backlog](../backlog.md), with a name that does not change.
- **Use case**: one thing a reader wants from the app, in their own words
  ([the list](../use-cases.md)).
- **Feature**: one part of the app ([the map](../map.md)).
- **Plan**: a page that lays out a stretch of work before it starts.
- **Hook**: a small script git runs by itself at a set moment, here just before a commit is saved.

## What is being decided?

Where the link between a change and its reason is kept, and who writes it.

## What does it change for a hafiz?

Nothing they see on the page. It changes how fast a fault they report is traced: from the
line that broke to the task and the use case it was built for, without reading old chats. It
also lets the release notes be drafted from what was really finished for readers.

## Why was this asked now?

The owner asked on 10 November 2026 for a use case to link to its feature, its tasks, the
commits that did them and the plan they came from, with the labels added by a hook. Four
features are about to be built, so they are the first real test.

## What does the project do today, and what does that cost?

A use case names its feature. Nothing else is linked. Of the 492 tasks counted on
10 November, none named a use case, a feature or a commit, and a commit named nothing. The
108 write-ups of finished tasks mention their changes only in sentences, under task numbers
that restart every session and so collide.

## What do people outside this project do?

Git has its own way to add `Key: value` lines to the end of a commit message from a hook and
to read them back, and that is what this uses. Several projects that link work to its purpose
were seen only as search summaries, not read in full, so nothing here rests on them.

## What were the options?

| option | pros | cons | what it commits us to |
| --- | --- | --- | --- |
| **A**: a hook adds a few lines to the end of each commit message, naming the task, the use case, the feature and the plan | the link travels with the change for good; nobody has to remember; git reads the lines back itself | old commits have none; a session must say once per branch what it is working on | a hook that never stops a commit, and a check that lists commits with no lines |
| **B**: a checked-in file lists each commit beside its task | old commits can be covered too; nothing is added to messages | a second thing to keep in step by hand; it is always one commit behind | someone, or something, writing that file after every commit |
| **C**: the task's name goes in the branch name and the pull request title only | no new tool | the name is lost once the branch is deleted; one branch often holds two tasks | reading GitHub, not the code, to answer the question |

## So what was decided?

**A.** The lines all start with `Intent-`, so they are never mistaken for an ordinary line in
an old message. The task and the plan come from what the session set for the branch; the use
case and the feature come from the task's own row in the backlog, which may now name both.
B is kept for old history only: commits made before the hook existed are never rewritten, and
their links will go in a file. C is not used.

The hook never stops a commit. When it cannot run, it says so and the commit goes ahead with
no lines. The check before a push refuses a line that names something that does not exist,
and for now only lists commits that have no lines at all.

The tool is a plugin any repo can use, not code in this one.

## What would change the answer?

If, after the next four features, asking "which commits did this task take?" does not get a
true answer from the lines alone, or sessions keep forgetting to say what a branch is for.

## What is this not settling?

- Whether a push is refused for a commit with no lines. It is counted for two weeks first.
- How far back old history is linked.
- Whether the picture of the links, the roadmap or the release notes go on the public site.
