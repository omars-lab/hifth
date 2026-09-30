# Writing a link by hand: which mus'haf names may a link use, and where does a person build one?

**Status:** decided by the owner, 2026-09-29: the builder lives on the readable contract page
**and** in the app's share sheet (question 2, option B); editions are listed in full and unknown
names refused (question 1, option A); the contract pages get no customising of their own
(question 3). The docs-page builder and the edition list ship first; the share sheet follows in
its own change once its form has been drawn on a phone.

**What is being decided:** three things that came up one after the other once the app's link
contract was written down and drawn (the [readable contract](app-url-scheme.html) and the
[same contract in Swagger UI](app-url-scheme.swagger.html)):

1. How does a person find out which mus'haf a link may name, and what happens when they name
   one we do not have?
2. Where does a person go to build a link they have never written before, and what does that
   place show them?
3. Do the two contract pages need any more customising, or is the contract itself what needs
   improving?

**What it changes for a hafiz:** a link is how a teacher sends a student to a verse, and how a
Shortcut or another app opens the mus'haf at the right place. Today a student who gets a link
naming a mus'haf we do not ship lands on the wrong pages with no warning, and a teacher who
wants to write a link has to read a reference page and type it blind. After this, the app says
"that mus'haf is not here" instead of pretending, and a person builds a working link by picking
from lists and copying it. It does not change anything on the page while reciting.

**Why now:** the contract page now exists, and reading it raised each question in turn. It says
the edition is "lower-case letters, digits and dashes", which is a shape, not a list; it draws
every link form, but nobody can compose one without typing; and it renders two ways, which
begged the question of whether either view needs work of its own.

**If nobody decides:** links keep working for the one mus'haf we ship, because that name is the
default. A wrong name keeps opening the wrong pages silently, and anyone wanting a link past the
simplest form keeps typing it from the reference and testing by trial.

## Words used here

- **Mus'haf** — a printed Qur'an. Different prints follow different readings (**riwayah**) and
  paginate differently; page 45 of one is not page 45 of another.
- **Edition** — our name for one specific mus'haf the app can show, written as a short
  lower-case id in every link, such as `hafs-kfqc` (the King Fahd Complex print in the Hafs
  reading, the only one the app ships today).
- **Link** — an address that opens the app somewhere. A site link
  (`https://blog.bytesofpurpose.com/hifth/#/hafs-kfqc/2:255`), a plain app link
  (`hifth:///hafs-kfqc/2:255`), or an app request another app sends and hears back from
  (`hifth://x-callback-url/open?verse=2:255`).
- **The contract** — the one file that says every link form, key and allowed value, with
  worked examples that the tests run against the code. Two pages are drawn from it: a
  readable one, and the same thing in Swagger UI, a standard viewer for such files.
- **Refuses** — the app treats a bad link as not a link. A plain link is dropped silently; an
  app request is answered on the caller's error address with a reason.
- **Builder** — a form where a person picks what the link should open and gets the address
  written for them.

## The short version

| question | recommendation | what it gives a person |
| --- | --- | --- |
| 1 · Which mus'haf may a link name? | List all four editions in the contract, shipped or not, in English, and refuse any other name with a reason that lists them | A link naming a mus'haf we know but do not ship is refused with "not shipped yet", not opened on the wrong pages |
| 2 · Where is the builder? | On the readable contract page as a live form, and inside the app's share sheet (decided 2026-09-29) | Pick a place, a mus'haf, a tool, a panel, a layout; read the address, copy it, open it in the app |
| 3 · Customise the pages? | No. Improve the contract; both pages redraw from it | One place to edit, two views for free |

## 1 · How does a person find out which mus'haf a link may name?

### What does the app do today, and what does it cost?

The app knows four editions. One is shipped; the other three are named in its edition picker
with the reason they are not (two are licensed for non-commercial use only and need
permission; one has no licensed page source yet). The picker shows their names in Arabic, or in
English when the app is in English.

The link contract knows none of this. It says an edition is "lower-case letters, digits and
dashes", gives one example, and says the default is the shipped one. So:

- A person reading the contract cannot learn a second name, and cannot tell whether
  `warsh-libya` would work.
- The web app accepts any name in that shape. Run through the app's own link reader,
  `#/warsh-libya/2:255` is read as a valid place and written back unchanged, and the app then
  shows the Hafs pages under an address that says Warsh. Checked on 2026-09-29 with the link
  reader's tests; nothing on screen says anything is off.
- The Mac and iPad shell passes the name through unchecked too, so an app request with a
  wrong edition is answered as a success with an address that lies.

The cost is small today, because almost every link is written by the app itself and carries
the shipped name. It grows the day a second mus'haf ships, or the first time a teacher guesses.

### What do others do about it?

I did not look at how other Qur'an apps name a mus'haf in a link. The x-callback-url
convention itself says nothing about value lists; it leaves that to each app's documentation.

### What have we already decided that constrains this?

- The contract is one file, and three tests hold it to the code: the shell's own list of
  names, the web app's list of panels and tools, and the rendered page. Any new list of
  editions joins that arrangement or it rots.
- The edition list already lives in one place in the code, with each edition's id, its
  status, and the reason it is not shipped. That list is the source; the contract copies it
  and a test checks the copy.
- A plain link refuses silently; an app request refuses with a reason. Editions follow the
  same split.
- The shell's error codes are fixed words the contract lists. A refused edition is a
  "bad-route" like a misspelt panel, not a new code.

### The options

|  | A · List every known edition, refuse the rest | B · List only what ships, refuse the rest | C · Leave it a free shape (today) |
| --- | --- | --- | --- |
| **For a hafiz** | A link to a mus'haf we know but do not ship says "not shipped yet"; a misspelling says which names exist | Same refusal, but a link to a mus'haf we plan to ship is a "no such name" until the day it ships | A wrong name opens the wrong pages silently |
| **Pros** | The contract shows the same four names the app's picker shows, with the same reasons; a Shortcut written for Warsh today works unchanged the day Warsh ships | Smallest list; nothing in the contract promises what we cannot show | Nothing to build |
| **Cons** | Three of the four entries say "not shipped"; a reader has to notice the status column | The contract and the app's picker disagree about what exists; each new mus'haf changes the contract twice (add, then mark shipped) | The address can say one mus'haf while the page shows another |
| **Implications** | The shipped/not-shipped flag is what the shell checks, so shipping a mus'haf is a one-word change in the source list; the web app's own link reader stays as it is, because it is the shell that answers callers, and the web app never sees an edition it did not build | The shell holds a one-entry list until a second mus'haf ships; the reason a mus'haf is missing is nowhere in the contract | Question 2's builder would offer a free text box for the edition, which is the same guess with a nicer font |

**Recommendation: A.** The list already exists with its reasons; copying it into the contract
and refusing anything outside it is the smallest change that makes the address stop lying.
Both refusals use the existing "bad-route" code, with a message that names the allowed ids.

### What else could be considered, and why it is not here

- **Refusing unknown editions in the web app too.** Reasonable, but the web app only ever
  builds one mus'haf into itself, and a site link with a wrong edition is already outside
  anything the app writes. It can be added later without touching the contract; it is a
  backlog note, not an option here.
- **Accepting the riwayah name instead of the edition id** (`warsh` for `warsh-libya`). Nice
  to type, but two editions can share a riwayah, and the builder makes typing unnecessary.

## 2 · Where does a person build a link, and what does the builder show?

### What does the app do today, and what does it cost?

Nothing builds a link for a person. The app's share button writes a site link for the place on
screen, and that is the only link the app ever composes. Anyone wanting an app request (a
Shortcut that opens a verse with the note tool in hand, a teacher's link that opens a panel)
reads the contract, types the address, and finds out by opening it. The readable page draws
twenty-four worked examples, which is the closest thing to a builder there is.

The cost is time and wrong guesses, for the few people who write such links. Today that is the
owner and, once the demo is shown, anyone on The Study Quran team who wants to wire the app
into their own tools.

### What do others do about it?

I did not survey other apps' link builders. Two shapes are common in general: a form on the
documentation page that composes the address as you pick (many web APIs), and a "copy link
to this" inside the app that composes it from what is on screen (most reader apps, including
ours for site links).

### What have we already decided that constrains this?

- The readable page is generated from the contract by one script, and a test refuses a page
  that is out of step. A builder on that page is generated the same way, with the lists and
  the route grammar injected from the contract, or the test cannot hold it.
- Every design page is served from the site at its own path, offline, with no outside script.
  The readable page is self-contained today; a builder on it stays so. The Swagger page is the
  one exception, and it stays the exception.
- The shell's parser is the truth for what an app request opens. A builder that predicts the
  result is a port of that parser, and it must be run through every worked example in the
  contract and agree, or it is a second parser with its own opinions.
- Try-it-out in Swagger UI is switched off on purpose: it would send an http request to a
  server that does not exist. It is not a builder.

### The options

|  | A · A live builder on the readable page | B · A, plus "copy an app link" inside the app's share sheet | C · Try-it-out in the Swagger page |
| --- | --- | --- | --- |
| **For a hafiz** | Nothing while reciting; a teacher builds a link at a desk | A hafiz sharing a verse can also copy a link that opens the app, not only the site, and choose what it opens with | Nothing; it composes http requests, and hides the result behind "execute" |
| **Pros** | One page, offline, no app change; the same lists and grammar the tests already hold; the predicted route and the "open in app" button test the shell too | The builder meets the person where the place already is, with the edition, verse and words filled in from the screen | Already drawn |
| **Cons** | A person must know the page exists; the link is composed away from the place it points at | Two builders (the docs page and the share sheet) or one shared piece of code the web app and the docs page both use; the share sheet grows from one button to a small form; more strings to translate | Wrong tool: an http client for addresses that never reach a server |
| **Implications** | Ships this week with the edition list; the page is already reachable from the app's colophon through the docs front door, so nothing in the app changes | The builder logic moves into the core package so both callers share it, which is the right home anyway; the share sheet design becomes its own small decision page with the form drawn on a phone; the hafiz-facing part waits on that | Would have to be turned on and pointed at a fake server; not pursued |

**Recommended A now, B as a follow-up; the owner chose B (2026-09-29).** A is the whole
builder for the people who write links today, and it ships first. B puts the same builder
where the place already is, and it follows in its own change: the share sheet's form is drawn
on a phone on its own small page before it is built, because its difference is felt, not read.
To keep B cheap, A puts the composing logic in the core package rather than in the page's
script, so the share sheet calls the same code.

### What does the builder show?

One form, generated into the readable page, in this order:

1. **What to open** — a page number, a verse (with an optional run and optional words), or a
   surah. Exactly one; the form makes the other two inactive.
2. **Which mus'haf** — the edition list from question 1, shipped ones first, unshipped ones
   marked; default the shipped one.
3. **How to show it** — the tool in hand, the panel open on arrival, one or two pages; each a
   drop-down from the contract's lists, each optional.
4. **Who to tell** — the success and error addresses for an app request, optional; a note
   that a plain link tells nobody.

Under the form, three things update as you pick, with no button:

- The **plain app link** (`hifth:///…`), the **app request** (`hifth://x-callback-url/open?…`)
  and the **site link** (`https://…/#/…`), each with a copy button.
- **What the app will do**, in the same words the contract's examples use ("open
  `#/hafs-kfqc/2:255?w=3-7`", or "refused: words need a verse"). This is the port of the
  shell's parser, run through every example in the contract by a test.
- An **open in the app** button on the plain link, for a Mac or iPad with the app installed.

## 3 · Do the two contract pages need customising?

**No.** Both are drawn from the contract; the readable one by our own script, the Swagger one
by a standard viewer plus one small addition that draws the contract's worked examples under
each request, since the standard has no place for whole-address examples. Everything a reader
found missing so far (the edition list, examples, the builder) is either missing from the
contract or belongs on the readable page. The Swagger page stays a second view for people who
already know the standard, and gets nothing of its own.

What would change this: if someone outside the project wants to generate a client from the
contract, the Swagger page is where they would look, and it might then earn a download link
and a note on which parts of the standard we use.

## What gets built, in what order?

Each step ships with its test, written first. All of it lands on one branch from the native
worktree, as one pull request, except the share-sheet follow-up if it is wanted.

| step | change | the test that ships with it |
| --- | --- | --- |
| 1 | The contract gains an edition schema: the four ids as an allowed list, each with its English name and whether it ships, and both edition parameters point at it. A new worked example: an unknown edition is refused. | The core test that already holds the contract's panel and tool lists to the code gains the edition list, held to the edition source. |
| 2 | The shell refuses an edition outside the list, after the route is composed, so a whole `route=` is checked too; the message names the allowed ids. | The shell's example test runs the new refused example; a table row for a known-but-unshipped id and for a misspelt one. |
| 3 | The composing and predicting logic lives in the core package: given the form's values, write the three links and say what the shell will do. | A core test runs every app-request example in the contract through the predictor and compares to the example's stated result. |
| 4 | The readable page's script injects that logic, the lists and the route grammar, and draws the form and its three links. | The page test already refuses a stale page; it gains checks that the form's lists match the contract and that the page still loads no outside script. A browser test picks a verse, a mus'haf and a panel and reads the composed links. |
| 5 | The shell skill, the native-shell design page and the earlier links page mention the edition refusal and the builder; the code map's shell row names this page. The readable page is already listed on the docs front door the app's colophon opens, so nothing in the app changes. | The register gates. |

Order matters only in that 1 comes before 2 and 3 comes before 4. Steps 1, 3, 4 and 5 touch
no Swift and can be checked on any machine.

## What would change the answer?

- A second mus'haf actually shipping. Then question 1's answer stays, but the builder's
  mus'haf list becomes something a hafiz uses, and B in question 2 gets its person.
- The app reaching other people's phones through TestFlight. Then sharing an app link from a
  phone is real, and B is worth its own page.
- A server ever answering these addresses. Then Swagger's try-it-out stops being the wrong
  tool.

## What this is not settling

The share sheet's design if B is wanted (its own page, drawn on a phone). Whether the web app
should refuse unknown editions on the site (a backlog note). Whether links carry the app's
language. And the still-open question on the native-shell page of driving one app request
through the real operating system end to end.
