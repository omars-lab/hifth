# Should the app have pages of its own, beside the mushaf?

**Short version:** the owner asked (2026-11-07) for the app to have pages of its own,
switched by a row of icons along the bottom the way a Mac app switches its views. The
mushaf is the default page, settings get a page of their own, and a developer page shows
only on this laptop. A rough build of the row and the settings page is in the app since
2026-11-11, switched off until the owner has tried it.

**To try it:** open the info panel (the app's name, top corner), find "Page icons along the
bottom" and press On. Press Off there to go back.

**Today, with the row off:** there is one page, the mushaf. The reading settings sit behind
the ⚙ button in a drawer, and every other setting lives in the info panel, opened from the
app's name. The developer views are scattered: a separate side-by-side comparison page and
flags set when the app is built.

## Open questions, and what would answer each

### ① Should settings be a page of their own, reached from a row of page icons? · **open**

**Asked by the owner, in a comment on the app's page:** *"where are we with having a settings
button that shows a settings tab ... we should have page icons on the bottom like a mac app
... where default is the mushaf page, another page is the settings page"*.

**What it changes for a hafiz:** settings stop sharing a panel with the app's notes about
itself, so a reader looking for one switch finds it on a page made for switches. The cost
is one more row along the bottom, which takes height from the page.

**What is built (2026-11-11), as a setting, off by default:** a row under everything else
with two icons, each with its name: the mus'haf and settings. Settings fill the screen down
to the row. They are the same switches the info panel has, without the app's notes about
itself, its licence and its sources, which stay in the info panel. The mus'haf is not taken
down while settings show, so the page, its magnification and a selected verse are as they
were left. Escape, or the mus'haf icon, goes back.

**What the rough build showed, that the question did not say:**

- **The row costs 52 points of height on every screen**, plus the home bar's strip on an
  iPad or iPhone. On a phone held upright that is about one line of the page.
- **The row has to be the lowest bar**, under the page slider, or two bars each keep room
  for the home bar. The slider gives its room up when the row is on.
- **On a wide screen the info panel is a narrow card at the side; a page is not.** The first
  build kept the card's width, which a picture showed and no test did. The switches now
  keep a column 640 points wide in the middle of the page.
- **Keys had to be thought about.** While settings show, the arrow keys must not turn the
  page behind them. A test holds that.
- **There are now three ways to reach a setting** when the row is on: the row, the ⚙ drawer
  for the reading settings, and the info panel. That is one too many to keep. If the row
  wins, the info panel should lose its switches and keep only the app's notes about itself.

**Still to answer, by the owner trying it:** does the row earn its height? If yes, it becomes
the default and the info panel keeps only the notes. If no, it stays a setting, as built.

### ② What should a developer page hold, shown only on this laptop? · **answered**

**Asked by the owner, in the same comment:** *"i also want a developer page that shows in
localhost mode"*.

**What it changes for a hafiz:** nothing; a real build never carries it.

**What was checked by hand before it (2026-11-11):**

- **How the app was started.** Three switches are set when the app starts and nothing on
  screen says which are on: the private pitch layer, the library's page laid over ours, and
  the speed probe.
- **The library's page beside ours**, a separate page whose address had to be remembered.
- **Switches typed into the address bar:** the language, the two older layouts of the phone's
  toolbar, the two older shapes of the share sheet.
- **What the browser remembers for the app.** About forty remembered choices, read and cleared
  one at a time in the browser's own developer tools.
- **The screen:** its size, how sharp it is, whether it takes touch, the language and reading
  direction, and which browser it is.

**What is built (2026-11-11):** a third icon in the row, "Developer", that only the laptop's
dev server shows. Its page has those five things in one place: each start-up switch with on
or off and the command that starts it, the screen's numbers, links for the comparison page
and each address-bar switch (each keeps the place in the book), and the list of what the
browser remembers with a Forget button beside each. It is in English whichever language the
app is in, since only the maintainer reads it.

**To see it:** start the app with `make dev`, switch the row on (① above), press Developer.

**How a real build is kept free of it:** the app reaches the page only when it runs from the
dev server, so a build leaves the page and its file out. The size check then looks through
every built file for the page's own marker and refuses the build if it finds it, the pitch
build included. This was watched failing once, by letting the page into a build on purpose.

**What the rough build showed:**

- **The speed probe cannot be on at the same time as this page on a phone.** The phone's
  probe is a build, and no build has this page. On the laptop the two can run together.
- **On a narrow window, the comment tool's bar sits over the row's icons.** The comment tool
  is also dev-server only. Its Hide button clears it. Written down for the build-and-test
  work, not fixed here.
- **Forgetting a remembered choice shows after the next load**, since the app read it when
  it started. The page says so.

**Not here, on purpose:** the row itself stays a setting on the dev server too, so the
maintainer sees the app as a reader does until they switch it on.
