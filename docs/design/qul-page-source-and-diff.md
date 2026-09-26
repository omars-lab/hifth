# Could a page come from the other library, and could we check ours against it?

> An index of the decisions that stand between us and two related ideas: drawing a page of
> the mus'haf from an outside library's data instead of our own, and holding our page up
> against that library's to see where the two disagree. It is a map of what has to be
> settled, not a settling of any of it. Nothing here is decided.

**Status:** open — written 2026-09-06 as scoping. Two register rows now point at this page:
one for the checking half and one for the development-only draw; both are open, neither is
chosen. The last section says why those two and not the others.

**Update, 2026-09-07:** the owner chose the *mechanism* for the store, if we draw at all — a
hosted database we control, filled once by a run that reads the library's data and writes it
to the database, with the repository and the shipped bundle both kept free of the words by
construction. That narrows decision ②'s option C and sharpens decision ③, and it is folded in
below. It does **not** settle either open decision: whether to draw at all, and — if we do —
whether that database is read only by developers or by every reader, both remain open.

## A word on the words

- **The other library** — a public collection of Qur'an data that this project already
  reads once, as a ruler, to check its own work. It is named in the source register and in
  the reasons below; a reader does not need its name to weigh the questions.
- **Its page map** — for one particular printing, a table that says, line by line, which
  run of words sits on each line of each page. It carries *positions*, not the words
  themselves: no letters, only "words number X through Y live on this line." To turn that
  into a page a person can read, you still need the shapes of the words, which is a separate
  thing the library also holds.
- **The word shapes** — a font whose every character is a whole printed word. The library
  publishes these fonts itself, so they are a plain download, not a missing piece. But a font
  of whole printed words *is* Qur'an text in the only sense that matters here, and this
  project has a standing rule that it ships none — so the shapes being *reachable* and the
  shapes being *shippable* are two different things.
- **A store we control** — a hosted database, standing outside this repository, that we fill
  once from the library (a run reads the library's data and writes it to the database) and
  then read from at run time. It is a third place the words could live, next to *in the
  shipped files* (which the rule forbids) and *fetched live from the library each time*. It
  keeps the words out of the repository by construction — but it also means we are *holding a
  copy* of them on our own infrastructure, a posture this project has not taken before, which
  the licence question below has to cover.
- **Witness vs. source** — a *witness* is something we read only to check ourselves against;
  nothing of it reaches the reader. A *source* is something we build the shipped app out of,
  so whatever terms come with it travel all the way to the reader. The whole first half of
  this document turns on which of these we mean.

## Why this is being asked now, and what it is really two of

The question arrived as one — "what would it take to base a page on the other library, and
to diff our page against it and mark the problems?" It is really two questions with very
different costs, and the honest first move is to split them:

1. **Draw a page from the library's data.** In a public build this runs straight into the
   rule that we ship no Qur'an text (see the first decision). But it need not be a public
   build: a development-only route (decision ②, option C) makes drawing genuinely reachable
   while the public app is untouched. This is the half that *could* change what a reader
   sees — and the live question is whether to keep it from ever doing so.
2. **Check our page against the library's and record the disagreements.** Cheap, and almost
   entirely on the safe side of that rule, because a page map can be compared to a page map
   without any letters changing hands. This is the half that changes nothing a reader sees
   and only tells *us* where to look.

The app already has the plumbing for more than one page source (a named edition, chosen by a
single label, with a registry that lists the printings we know about and marks which ones we
actually carry). So the *machinery* of a second source is not the hard part. The hard parts
are a rule, a licence, and a set of safety checks that currently assume one printing — and
those are the decisions below.

## What already constrains all of this

Three earlier things bound the space before any option is drawn, and every decision below
inherits them:

- **We ship no Qur'an text.** A standing rule, kept by the shipped bytes and not only by
  policy: the pages we carry are outline drawings, not letters. The library's word-shapes are
  *reachable* — it publishes the fonts directly — so nothing technical stops us drawing a page
  with them. What stops us is this rule: those shapes are the very thing it forbids in shipped
  bytes. The block is ours, not the library's — which matters, because a rule we own is one we
  can reword on purpose (decision ②, option C).
- **We already treat the library as a ruler, and only a ruler.** Two finished loops cross-
  checked all 604 pages of our own page table against the library's page map for one
  specific printing, and settled that this printing — not an older one that disagrees on
  dozens of pages — is the one to check against. That work banked the library as a witness
  and went no further.
- **Read-to-check, copy-nothing.** The recorded posture is that we may measure against the
  library but vendor nothing from it, and that attribution is owed even when zero bytes ship.
  What was never done is a per-resource licence reading for the two specific things a drawn
  page would need — the page map and the word-shapes.

## Prior art

I looked only inside this project for this scoping pass, and should say so plainly. The
outside world's practice — how other mus'haf apps source their pages — was surveyed in the
dependency audit this project already holds, and is not re-gathered here; a real decision on
the drawing half (the first below) should pull that survey forward rather than take my word
that it exists. The comparison half has direct internal prior art: this project has twice
built an independent-witness check (a page table against an outside page source, a word-
splitting habit against a third grammar), and those set the pattern the comparison decisions
lean on.

---

## The decisions

Eight, grouped: the first four are about *drawing a page from the library*; the next three
are about *checking our page against it*; the last asks how many of these are really one.

### ① If a page "came from the other library," what would actually be coming — a picture, a map of where the words go, or the words themselves?

**Why now:** every later question changes shape depending on this answer, so it goes first.
**What we do today:** our pages are outline drawings we vendored and pinned; they carry the
shapes and the tappable ayah regions in one self-contained file. **The cost of leaving it:**
none — this is a fork in the road, not a leak. **What already constrains it:** the no-text
rule, sharply.

The library offers three different things a person might mean:

| | What it is | What it collides with |
| --- | --- | --- |
| **A** | A ready-made picture of the page | We would be shipping someone else's rendered Qur'an page — the no-text rule in spirit, and a licence question on the image itself. |
| **B** | The map of which words sit on which line | Carries no letters, so it does **not** break the no-text rule on its own — but it is only half a page. To *draw* from it you still need the word-shapes (row C), which do break the rule. As a thing to *check against*, it is enough by itself. |
| **C** | The words themselves (the word-shape font) | Reachable — the library publishes the font, it is a download away — but it is the very thing the ship-rule forbids putting into shipped bytes. The barrier is our rule, not availability. |

**What is excluded:** re-typing the text ourselves in an ordinary font — a different project
with its own correctness burden, out of scope here. **What would change the answer:** all
three are *reachable* — the library publishes both the map and the shapes. What varies is what
may **ship**: only B may enter a public build. A development-only route (decision ②, option C)
lets even C be drawn without shipping it; relaxing the no-text rule for a store build would be
the other way to put A or C into a public build, and there is no reason to do that today.

### ② Do we want the library to *check* our pages, or to *build* them?

**Why now:** this is the licence fork, and it is worth stating before any work because the
two answers cost wildly different amounts. **What we do today:** check only — the library is
a ruler, nothing of it ships. **The cost of leaving it:** none; check-only is a settled,
working posture.

- **A — keep it a witness (check only).** Read the page map to compare against our own,
  ship nothing, owe attribution. Nearly free, and it is where the whole comparison half of
  this document lives. Its licence reach is the lightest possible: nothing the library owns
  reaches the reader.
- **B — make it a public source (build the shipped page from it).** Compute the page readers
  receive out of the library's data. Then whatever terms sit under the page map — and under
  the word-shapes it would need — travel to the reader, and the no-text rule has to be
  answered, not sidestepped.
- **C — build from it, but only in a development build.** The public app stays exactly as it
  is today — our own drawn pages, the library a witness only — while a developer running the
  app locally can load the library's words and shapes at run time and see a page drawn from
  them. This is a real third answer, not a hedge, and it needs a reworded rule to stand on.

  *The rule it needs.* Today "ship no Qur'an text" is one boundary that holds for free. It is
  really three surfaces, and this option splits them:
    - the checked-in files carry zero Qur'an text, ever — unchanged;
    - the public build served to readers carries zero Qur'an text — but now enforced on
      purpose, not for free;
    - the app while a developer runs it may load the words and shapes at run time from an
      outside source.

  *What keeps it honest.* The project's own line is that the no-text rule is kept by the
  shipped bytes, not by policy — so a toggle merely *promised* to be development-only is
  exactly the policy-not-bytes version the project distrusts. Three legs make it bytes again:
    - the words and shapes never enter the checked-in files — loaded from an ignored local
      cache, or live from the library, and never committed — so every existing check on
      committed bytes is untouched;
    - the development path is compiled out of the public build behind a build switch;
    - a new check reads the built public bundle and fails if any Arabic letter, or the loader
      code that reaches for the library, appears in it.
  That last check is what turns "development-only" from a promise into a fact, the same way
  the existing checks turn "no text" into a fact.

  *What it costs to adopt.* A reworded tenet (the three surfaces above), one new bundle-reading
  check, a "development-only" mark on the printing registry so the source can never be chosen
  in a public build, and one ignore rule for the local cache. That is the whole bill — and it
  buys a page drawn from the library that a developer can see beside our own without a single
  Qur'an letter reaching a reader.

  *Where the words would live (the owner's current direction).* The store need not be a cache
  on one developer's machine. The chosen mechanism is a hosted database we control, filled
  once by a run that reads the library's data and writes it there, and read at run time by the
  app. This keeps the words out of the repository by construction, and it makes the side-by-
  side reachable from any developer's machine rather than only the one that ran the import. It
  does not, on its own, answer the one question that decides everything else about it: **who is
  allowed to read from that database.**
    - *Read only by developers.* The app readers receive is compiled without the code that
      reaches the database, and only an authenticated developer build fetches from it. The
      public build stays exactly as today; the reader receives no library byte. This is option
      C proper — the three honest legs above already describe it, with the bundle-reading check
      now also refusing the fetch code, not only the letters.
    - *Read by every reader.* The shipped app streams the words from the database and draws
      them for anyone. That is not option C at all; it is option B (a public source) with the
      words arriving from our database instead of our bundle. The reader now *receives* Qur'an
      text — streamed rather than shipped, but received — and every term under it travels the
      whole way.
    The database is a delivery mechanism, not a decision: it can serve either surface. Which
    surface it serves is the decision, and it is the same witness-or-source fork this whole
    section turns on. Choosing the hosted store settles *where* the words sit; it leaves *who
    reads them* exactly where it was.

**What already constrains it:** the read-to-check posture already chose A once, for the page
table. This decision asks whether page *rendering* should be the place we cross into B or C —
and C exists precisely so the crossing never reaches the reader. **What would change the
answer:** wanting a second printing *on offer to readers* is the only thing that makes B pay
for itself; wanting to *see* the library's page beside ours while developing is what makes C
pay for itself, and it pairs naturally with the comparison half below.

### ③ Before we read a single byte for this, whose terms come with the page map and the word-shapes, and where would they bite?

**Why now:** the one piece of homework that was explicitly deferred and never done. **What we
do today:** we have a general posture (per-resource, attribution owed) but no licence reading
for these two specific resources. **The cost of leaving it:** small as long as we stay a
witness; blocking the moment we try to draw from the library, because you cannot ship what
you have not cleared.

The library's terms are **per resource**, not one blanket grant — some resources are public
domain, some ask only for attribution, some restrict use. The determination for the page map
and for the word-shape font was never made. Two things to settle here:

- **The reading itself** — what each of the two resources actually permits, recorded in the
  source register the same way every other upstream is.
- **Which channels a restrictive term would bite.** On the web the app serves today, most
  terms cost nothing anyone has to act on. In a build submitted to an app store, a share-
  alike or non-commercial term would bite hard. This is the same channel-by-channel
  reasoning the distribution map already uses, and it should be answered there, not guessed
  here.
- **How far the development-only route shrinks this.** A restrictive or share-alike term that
  only ever touches a build the public never receives (decision ②, option C) reaches no
  reader, where the same term in a public source reaches every reader. That shrinks the blast
  radius sharply — but the reading is still owed before even the development path loads a
  byte, because you are loading it, just not shipping it. What drops is the *stakes* of the
  answer, not the need for it.
- **Holding a copy at all is a new posture.** The recorded stance is *copy-nothing* — read the
  library to measure, vendor none of it. A store we control (the owner's current direction)
  holds a copy of the library's data on our own infrastructure, which "copy-nothing" as
  written does not allow. So the reading has to answer not only "may we ship it" and "may we
  read it," but "may we *hold* a copy and serve that copy" — and to whom. A term that permits
  a private working copy for a handful of developers is a very different grant from one that
  permits serving a copy to the public, and the who-reads-from-it fork in decision ② is what
  decides which grant we need. Whichever it is, the copy-nothing posture would have to be
  reworded to say "copy-nothing into the repository and the shipped bundle" rather than
  "copy-nothing anywhere," and that rewording is part of this decision, not a footnote to it.

**What is excluded:** attribution wording — a smaller, downstream task once the terms are
known. **What would change the answer:** a channel being chosen where store terms bite turns
this from paperwork into a gate.

### ④ If we did add a second page source, what does it cost to make our safety checks speak more than one printing?

**Why now:** the app's machinery already handles a second source cleanly, so the real bill is
elsewhere — in the checks, which today quietly assume one printing. **What we do today:**
several automated checks carry constants true only of the printing we ship (its exact page
count, which pages are allowed a decorated exception, where its files live). **The cost of
leaving it:** none until a second source exists; a hard blocker the day one does, because the
checks would either reject the newcomer or, worse, wave through a real defect.

- **A — generalise the checks per printing.** Teach each check to look up a printing's own
  expected numbers instead of a baked-in constant. More work up front; the checks then guard
  every source honestly. **B — special-case the second source.** Duplicate or branch each
  check. Less work now, a mess that compounds with every printing after.

**What is excluded:** the app's own rendering path, which is already source-blind and needs
nothing here. **What would change the answer:** intending *several* future printings argues
for A now; a single one-off comparison might tolerate B, or neither.

### ⑤ When we hold our page up against the library's, what exactly are we comparing, and how close counts as the same?

**Why now:** the first real question of the comparison half, and the one that decides whether
the comparison can stay on the safe side of the no-text rule. **What we do today:** nothing —
the 604-page cross-check compared page tables at the level of "which ayah starts which page,"
not the finer structure. **The cost of leaving it:** we keep a coarse check where a finer one
would catch more.

The good news: everything worth comparing can be said in *word numbers*, with no letters
anywhere. Four things to choose among (any, all, or a subset):

- which line of the page each word falls on,
- where each line breaks,
- where each ayah begins and ends,
- where each page begins and ends.

And a tolerance for each: an exact match, or a match within some slack. Comparing word-to-
line assignment is the strictest and the most revealing; comparing only page boundaries is
what we already did.

**What is excluded:** anything that would need the letters (the exact pixel shape of a word)
— that is the drawing half, not the checking half. **What would change the answer:** finding
that our page map and the library's use word numbers that do not line up one-to-one would
force an alignment step first (the project already owns one such map for a different pair).

### ⑥ How do we tell a real mistake from a difference of habit?

**Why now:** the lesson the last two witness checks taught, and the one most likely to be
forgotten. **What we do today:** not applicable — no fine comparison runs yet. **The cost of
leaving it:** a comparison with no answer here would cry "defect" at every place the two
printings simply follow different conventions, and drown the real findings.

The two printings will disagree in ways that are nobody's error — a word a hafiz would never
question, split or joined differently by two houses that both have a tradition behind them.
The project already learned this the hard way with word-splitting, and the rule it drew is:
**a difference of convention is not a mistake to correct.** So a decision is owed on what
counts as a genuine discrepancy versus a known, catalogued habit — and probably a small list
of the habits, so the comparison subtracts them before it reports.

**What would change the answer:** a hafiz looking at a sample of the disagreements and
telling us which kind each is; nobody has done that yet.

### ⑦ When the comparison turns up a disagreement, where does it go and who owns it?

**Why now:** a finding with nowhere to land is a finding that evaporates — the project has
watched exactly that happen. **What we do today:** open work lives in a small set of
registers, indexed in one place; the whole-book box sweep is the model — it holds a count and
turns a new stray into an event. **The cost of leaving it:** a comparison that only prints to
a screen once teaches nothing the next person can find.

Two shapes to choose between, and a couple of smaller calls inside:

- **A — a one-time report.** Run the comparison, read the list, act on what matters, done.
  Right if the disagreements are few and mostly conventions. **B — a held count that guards
  forever.** Bank the number of real disagreements and let an automated check flag any change
  to it, the way the box sweep does. Right if we expect the set to stay small and want a new
  one to be noticed.

And, whichever: which register a genuine disagreement is filed under, how bad it is called,
and whether it is ours to fix or the printing's to explain.

**What would change the answer:** the size and nature of the first run's output — a short
list of conventions argues for A, a handful of true defects for B.

### ⑧ Is this one decision, or several — and which, if any, should be written down now?

**Why now:** so the owner is not handed one giant question when most of these can wait.
**What we do today:** nothing is recorded; this scoping doc is the whole of it.

My read: the two halves are genuinely separate decisions and should never be one row. The
**checking** half (⑤⑥⑦) is close to a single decision — "should we build the fine page-to-
page check, and how strict" — and it is cheap, aligned with work already done, and blocked by
nothing. The **drawing** half (①②③④) used to look like one large, always-shut question.
Option C changes that: a development-only draw is genuinely reachable — gated by a reworded
rule and one new bundle-reading check — and it pairs naturally with the comparison half, since
the cleanest way to *see* a disagreement is to draw the library's page beside ours while
developing. So the drawing half is now worth opening as its own decision *if the owner wants
that side-by-side*, with the public build never carrying it either way. What still should not
be opened is the public-source version (option B): ② and ③ have no forcing reason to reach the
reader today.

**Where I was unsure:** whether ① and ② are one decision or two. They are coupled — "what
form does the content take" and "witness or source" push on each other — but I kept them
apart because ② can be answered *witness* while ① is still unsettled (you can check against
the page map without ever deciding what a drawn page would be made of), and that combination
is exactly the cheap path. If they were merged, the cheap path would be buried inside a
question that also drags in the word-shapes and the no-text rule. I also hovered over whether
④ (the checks) belongs to the drawing half or is its own thing; I left it in the drawing half
because nothing forces it until a second source exists, but it is the one drawing-half item
that a serious *checking* effort might also want, if the check starts wanting per-printing
numbers of its own. Option C sharpens this last point: because a development-only draw commits
no per-printing files, it does not trip the existing per-printing checks at all — it *adds* a
new check (the bundle reading) rather than needing the old ones generalised. So ④ stays a cost
of the public-source path (B), not of C.

---

## What this is not settling

It does not decide whether we ever draw a page from the library, nor whether we build the
fine comparison — only what each would require. It records that a hosted database we control
is the chosen *mechanism* for where the library's words would live if we draw from them, but
it does not settle who may read from that database — developers only, or every reader — which
is the same witness-or-source fork named above, nor whether the licence permits our holding a
copy at all. It does not read any licence; it names the reading as owed. It does not touch
which printing is the right witness (already settled) or re-open the page table (already
cross-checked). And it takes no position on whether a second printing belongs in the *public*
app at all — the forcing question behind option B — nor on whether a developer-only side-by-
side is worth building, the lighter want behind option C. Neither is asked here.

## The one-paragraph recommendation

The two halves are not the same size. **Checking our page against the library's is cheap and
already in the project's grain** — the machinery to read the library as a witness exists, the
comparison can be done entirely in word numbers with no letters and no licence reaching the
reader, and there is a clear internal pattern to copy. If anything here is worth opening as a
real decision now, it is that one (⑤⑥⑦ as a single record). **Drawing a page from the library
is reachable, but only two ways** — into a public build, which the no-text rule forbids and no
present want justifies; or into a development build only (option C), which a reworded rule and
one new bundle-reading check make genuinely safe, and which pairs with the comparison so a
developer can see the disagreement drawn rather than listed. That development-only draw is
worth opening as its own decision *if the owner wants the side-by-side*; the public draw stays
named-but-shut until someone actually wants a second printing readers can choose. The owner
has now chosen a hosted database as the store for that drawing half — which settles *where*
the words would live, not *who reads them*. Keep that database read only by developer builds
until the licence for holding and serving a copy is read; kept that way, the draw stays as
safe as option C promises, and the moment a reader build is allowed to fetch from it, we are
in option B and owe every term to every reader. 