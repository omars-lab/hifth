# How does a reader tell us something is wrong?

*Written 2026-11-16 for item ⑱ on the [launch page](app-store-launch.md), "a reader has no way to
tell us something is wrong". The button is built; this page says what it does and why.*

## The short version

- **Where it is:** a "Report a problem" button in the info panel, under "Something not working?",
  and on the card the reader sees when the page stops working.
- **What it does:** shows the reader the whole report first, says where it goes, and only then
  offers to open their own mail app with it filled in. They can also copy it instead.
- **What it holds:** which app and version, the build it came from, the device, the screen size,
  the language, the time, the last five errors the page noticed, and the names of the last ten
  steps the reader took, such as "turned to another page (12 times)".
- **What it never holds:** the reader's notes, marks or bookmarks, a list of the pages they
  read, which page or verse a step was on, or anything they typed.
- **Where it goes:** hello@hifth.app, and only when the reader presses send in their mail app.

![The report in the info panel on a phone: the explanation, the address, the full report, and
the buttons to open it in a mail app, copy it or close it](report-a-problem/info-panel-phone.png)

## Words used here

- **Mus'haf:** a printed copy of the Qur'an, page for page.
- **Info panel:** the panel that opens from "About Hifth", with the app's settings and sources.
- **Error card:** what the reader sees instead of a blank screen when the page stops working
  (item ⑮ on the launch page).

## What does a reader see when they press it?

The panel opens in place, under its own small heading. From top to bottom:

1. One sentence saying this is the whole report, what it does not hold, and that nothing leaves
   the device until they press send.
2. The address it goes to, in bold.
3. The report itself, in a box they can scroll and read line by line.
4. Three buttons: **Open it in your mail app** (the one accent), **Copy** and **Close**.

The mail opens with a subject that names the app, an empty space at the top for the reader's own
words ("What happened? Write it here if you like."), and the report below a line. The reader can change or delete anything
before sending.

On the error card the same panel opens, and the report already lists the error that stopped the
page, so a reader who hits a broken page can tell us exactly what broke.

## Why does the reader see the whole report before it can go?

Because the reader decides who sees their data. A report that is sent quietly, or that shows a
summary while sending more, asks the reader to trust us. A report shown in full, sent from their
own mail app, asks nothing: what they read is what we get, and nothing leaves until they act.

This is also why there is no server in between. The app never sends the report itself; it hands
it to the reader's mail app, which they already trust with their mail.

## Could a report give away what the reader has been reading?

Not as a list. The report reads only the app's own facts, the browser's description of the
device, and the errors kept in memory. It does not open the reader's stored notes, marks,
bookmarks or reading history. A test writes made-up notes to the device and checks they are not
in the report or the mail.

One honest exception: an error's own words can name a page. If page 45 failed to load, the error
says so, because that is what we need to fix it. So the explanation promises "no list of the
pages you read", not "no page number ever". A test holds the wording to that promise in both
languages.

## Why mail, and not a form?

| Choice | What it buys | What it costs | What it commits us to |
|---|---|---|---|
| **The reader's own mail app** (built) | Nothing of ours in between; the reader sees and keeps what was sent; we can reply | The reader needs a mail account set up on the device | Reading a mailbox; a command to turn mail into backlog rows later (launch plan, stage 4) |
| A form that posts to our server | Works with no mail set up | A server that receives reader data, its security and privacy policy, abuse limits | Running and guarding that server |
| Apple's own feedback tools | No work | Only for test-flight readers, not the store | Nothing for store readers |

Mail was the owner's choice on 2026-11-15, with Apple's crash reports beside it. If a reader has
no mail app, **Copy** puts the report on the clipboard so they can paste it anywhere.

## What are "the last steps", and why only their names?

Added 2026-11-17 for item ⑲. An error on its own often does not say how the reader got there.
"Chose several verses, then followed a link to another verse, then the page went blank" does.

The app notes each step by a fixed name from a short list: opened the app, opened a link,
turned to another page, chose a verse, chose several verses, let go of the verse, followed a
link to another verse, went back along the trail, changed the colouring, changed the desk. The
same step twice in a row is one line with a count, so thirty page turns are one line, not thirty.
The report shows the last ten, oldest first, each with the time.

A step never says which page or verse it was on. A name with a page number in it would be a list
of the pages read by another route, which is exactly what the report promises not to hold. A
test checks no step name has a digit in it, and another checks the page numbers of the pages
turned to are nowhere in the report.

The steps live only in the page's memory. Nothing writes them to the device, so closing the app
forgets them, and they are never sent anywhere except inside a report the reader chose to send.

## What is not settled here

- **The picture** above was taken before the steps were added; the next time it is rebuilt it
  shows them.
- **Apple's crash reports** from readers' devices are item ⑰. When the apps keep them, the report
  can offer to include the latest one, shown in full like the rest.
- **Reading what arrives.** A command that turns each mail into a backlog row is later work in
  the launch plan.

<details>
<summary>Where it lives in the code, and the tests that hold it</summary>

- The report is built in `apps/web/src/problem-report.ts`; the errors it lists come from
  `apps/web/src/fault-log.ts`, and the steps from `apps/web/src/step-log.ts`, which the hash
  router (`useHashRouter.ts`) feeds each time the view changes.
- The apps' own lines go to the system log through `native/Hifth/App/AppLog.swift`, each one
  carrying the version and the build's commit (tests: `native/HifthTests/AppLogTests.swift`).
- The panel is `apps/web/src/components/ReportProblem.tsx`, used by the info panel
  (`Colophon.tsx`) and the error card (`PageStopped.tsx`).
- The apps pass their version to the page through the shell's bridge (`native/Hifth/Web/Bridge.swift`).
- Unit tests: `problem-report.test.ts`, `ReportProblem.test.tsx`, `Colophon.test.tsx`,
  `PageStopped.test.tsx`.
- Browser test: `apps/web/e2e/report-problem.spec.ts`, on phone, Android, desktop and Firefox:
  the whole report shows before the mail link, the mail link goes to the right address, a
  made-up note on the device never appears, and the error card's report names the error.
- The picture is rebuilt with the `make drive` command, clipped to the report section
  (`CLIP=0,191,390,484`, phone, English, after scrolling the section into view).

</details>
