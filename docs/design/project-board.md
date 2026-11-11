# The project board: where can someone see what Hifth still needs, at a glance?

*Started 2026-11-09, when Omar asked for "a kanban board of features, what we need to do" on
GitHub, and for a backlog item about giving users a board of their own.*

## The short version

- **The board:** <https://github.com/users/omars-lab/projects/2>, linked to the repository.
  One card for every open item in the backlog and every check only a person can do.
- **It is a picture, not a second list.** The backlog ([backlog.md](../backlog.md), built from
  [issues.json](../issues.json) and the pages each item lives on) stays the one record. A
  script copies it onto the board, one way. Moving a card by hand is undone by the next copy;
  to change an item, change it where it lives.
- **Copy it again:** `make board` (or `make board-dry` to see what would change first).

## A few words, defined once

- **Kanban board** — a page of columns, one per stage of work, with a card for each piece of
  work. A card moves right as the work moves on.
- **Card** — one item of open work on the board. Ours are *draft items*: they live only on the
  board, so the repository still has no list of GitHub issues to keep in step.

## What are the columns?

| column | what lands there |
|---|---|
| Waiting on Omar | the owner's own items: a choice, an account step, a check by hand |
| Next up | an agent's item marked *next* in the backlog |
| To do | every other open item |
| Blocked | an item that waits on another item first |
| Done | an item that was on the board and has since been answered or fixed |

Each card also carries a **Kind** (defect, question, risk, or check by hand) and its
**Backlog id**, which is how the copy finds the card again next time.

## Why copy one way, and not keep the board as the list?

Because the backlog is already checked: a commit is refused while the backlog page is behind
its sources, and every item has one home. A board edited by hand would be a second home, right
for a while and then quietly not. Copying one way keeps the board honest for free; the cost is
that dragging a card does nothing lasting.

## Open questions, and what would answer each

### ① Give the people who use Hifth a board to manage it and review it · **open**

Omar, 2026-11-09: "giving users a kanban board to manage hifth and review". Today the board is
the project's own, and only Omar and the agents work it. The ask is a board the readers and
reviewers themselves can use: the Study Quran team trying the pitch, testers on TestFlight, and
later huffaz who want to say what is wrong or missing.

Things a build would have to settle, none decided yet:

- **Who can write on it.** A GitHub board needs a GitHub account; a scholar trying the app may
  not have one. A board inside the app (or on the share site) would need its own sign-in.
- **What a reviewer adds.** A finding about a page (a wrong mark, a confusing control), a wish,
  or a vote on what to build next. Each wants a different card.
- **Where it lands.** A reviewer's card should arrive in the backlog, worst first, like any
  other item, rather than live on a board nobody copies back.
- **What it must never carry.** No text from The Study Quran, in a card or a picture on it,
  if the board is anywhere outside the private build.

What would answer it: show the pitch to the Study Quran team, and ask how they would want to
send back what they find. A rough board in the app, built and tried once, would find the rest.

### ② A commit does not say which task, use case or plan it was for · **open**

Omar, 2026-11-10: link a use case to its feature, its tasks, the commits that did them and the
plan they came from, checked in, with the labels added by a hook. Today one link is real: a
use case names its feature. A backlog row names no use case, and a commit names nothing, so
"what was this change for?" is answered by reading old chats.

The first part: a row in the backlog may name its use case and its feature, and a git hook
adds a few lines to the end of each commit message naming the task, the use case, the feature
and the plan. The hook never stops a commit; the push check lists commits that have no label.
The tool is a plugin any repo can use, not code in this one.

What would answer it: the next four features built with the labels on. If asking "which
commits did the pencil rings take, and what were they for?" gets a true answer from the
labels alone, the first part works. The later parts (walking the links, a picture of them, old
history, release notes) are in the plan page for this work.
