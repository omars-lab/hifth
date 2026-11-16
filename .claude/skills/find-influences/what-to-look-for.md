# What to look for

This is the rubric each researcher is handed in full.
It is read fresh every round, so sharpen it when a round teaches something.

## Which apps count?

An app is worth reading closely when most of these are true:

- **Its code is public** on GitHub, with a licence file. Write the licence down. GPL and AGPL mean ideas only.
- **People really use it.** It ships in an app store or to a large public site, it has releases in the last year, and its issue tracker is alive. Stars are a hint, not proof.
- **It runs on more than one of Mac, iPhone or iPad, and web.** Say how: one web codebase in a wrapper, one native codebase for all Apple devices, or separate apps. An app built like ours (web inside a native shell) is worth the most.
- **It has a problem like ours.** Reading page by page, moving through a long book, marking with pens, a right-to-left book, a long settings list, links that open a place inside the app, working with no connection, teaching a new reader.

A web-only or phone-only app still counts when it is the best known answer to one question (a drawing tool for where pens go, a PDF viewer for jumping and coming back). Say that it is being read for that one thing.

Good places to start: readers for books, PDFs, comics and scripture; note and drawing apps for pens; feed readers and reference apps for moving around; any app that says it is "one codebase" across Apple devices and the web.

## What to read inside each app

Pin everything to an exact version: a commit or a release tag, never a branch name.
For each app, look for these, in roughly this order of value to us.

| Question | Where the answer usually lives |
| --- | --- |
| How does the reader move through the book, and get back after a jump? | The slider or progress bar component, the history or "back" code, the table-of-contents panel |
| What changes between a phone, a tablet and a wide window? | The width breakpoints, the files named for a sidebar, toolbar or bottom bar, any "compact" or "regular" size checks |
| When are the bars shown and hidden? | Tap, hover and timer handlers on the reading surface; issues about bars not appearing |
| Where do pens and marking tools sit, and can the reader move them? | The annotation toolbar, its position setting, undo and redo for a stroke |
| How is the settings list grouped, and what is kept out of it? | The settings screen's sections; which choices live on the reading screen instead |
| How does a link open a place inside the app? | The custom address scheme, the web link handler, and whether one parser reads both |
| How is a new reader taught? | First-run flags, tip or hint components, "what's new" screens, anything shown once |
| How is a right-to-left book handled? | The slider's direction, the page order in a two-page spread, which edge turns forward |
| What happens when something is empty, fails or is undone? | Empty-state components, error screens, undo toasts |
| What is asked of the reader, and when? | Notification, storage and sign-in prompts and the moment each appears |
| How does the same code become a Mac, iPhone and web app? | The wrapper or shell folder, the bridge between web and native, what the shell adds |

Also look for the **reason**, which is worth more than the layout itself: a design note in the repo, a pull request description, a code comment, an issue where readers complained and the layout changed.
A layout with a reason can be argued with. A layout without one is only an example.

## How to write a finding

Each finding in the findings file has five parts:

1. **What the app does**, in one or two plain sentences a stranger could follow.
2. **Where**, as a link to the file and lines at the pinned version.
3. **How it was seen**: the file was opened and read; or it was only seen in a search result; or it is a claim from the README or the store page. Never round up.
4. **Why they did it**, if a reason was found, with its own link. If none was found, say none was found.
5. **What it would mean for a page reader like ours**, kept apart from the facts above.

Say plainly what was not done.
The usual gaps: the app was not run, no screenshot was looked at, the issue tracker was not read, the store page was not opened, a word search may have missed something named differently.

## What makes a finding weak?

- It rests on one app. Say so; one app is an example, not a pattern.
- It rests on a name. A file called "onboarding" may hold almost nothing.
- It describes position or feel from code alone. Size, spacing and feel need the running app or a picture.
- It comes from a search for one word. Name the word, so the next round can try others.
- The two researchers disagree. That is useful: the checker opens the source and says which side it supports.

## What we already know to look for next

- No app has yet been run or looked at on a screen. A round that installs three or four of the catalog's apps and takes pictures at phone, tablet and wide sizes would settle most "position and feel" doubts.
- Nothing was found on a revision calendar, look-alike passages, a pen for marking mistakes, or sharing a passage as a picture. Language-learning and flashcard apps are the likely place to look.
- Issue trackers were barely read. Complaints about a layout are the best source of reasons.
