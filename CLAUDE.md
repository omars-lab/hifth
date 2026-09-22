# Working in this repo

## What we are building right now

Hifth is a personal proof-of-concept, not a product we are releasing in this form. The
near-term goal is one thing: **a qualitative demo good enough to show the team behind The
Study Quran, so they want to collaborate with us.** Everything we build now serves that
pitch. We are rushing it on purpose — a demo that *feels* like the real thing, on a few
verses done beautifully, beats a complete app done thinly. Depth of impression over breadth
of coverage.

Two consequences to hold onto:

- **The pitch build is private, and shown to the people who own the material.** It may show
  what a real collaboration would look like — including The Study Quran's own commentary and
  the scripture beside it — because it is shown to them, in a room, not shipped to the world.
  It is a mockup of a partnership, not a release of their book.
- **The public site and its rules do not change.** The tenets below still govern anything
  merged to the public site: designs stay public, and the shipped app carries no Qur'an text
  and no held commentary — the gates that enforce that stay on. The pitch build lives on its
  own private track, outside that pipeline, so nothing in it reaches the public site. When
  the two would collide — a demo that must show held text — the demo is the private one, and
  the public build stays clean.

If a task does not move the pitch forward, it is not urgent right now. When in doubt, build
the thing that will make a scholar lean in.

## Decisions are explained in plain language, or they are not explained

This is the tenet. Everything below is how it is enforced.

And it is not only for pages and records: **always explain things in simple, straightforward language, with no jargon** — in conversation as much as in a checked-in document. When you tell the owner what the options are, what broke, what a choice would cost, or where something stands, use plain words a reader who has never opened this repository would follow, and say the plain thing a jargon term stands for instead of naming the term. Domain words the owner already uses stay; our own words for our own plumbing go.

Hifth is for huffaz, and its decisions get made by people who are not in the weeds of this
code — including the person who owns it, six months from now, and anyone they show it to.
So **every options page and every decision record must be followable by someone who has
never opened this repository.** Concretely:

- **Headings are questions.** "What does the app colour today?", not "Current salience
  model". A reader arrives holding a question; the page's headings are how they find it.
  And the question must be answerable by a stranger cold, grounded in something concrete
  that could actually happen — not an abstract or analogy-shaped framing. "Could someone
  quietly change the checking code without us noticing?", not "Should the code be pinned
  the way the data already is?" — the second is jargon-free and still opaque, because it
  makes the reader decode a metaphor before they can have an opinion. Test: could a reader
  answer it without first unpacking an analogy?
- **No internal identifiers in the prose a reader is meant to follow.** No file names, no
  function names, no gate names, no commands, no backticked code in a question or an option
  label. Those belong in the record's body, where the reasons live, and in the code map —
  not in the sentence a stranger has to understand before they can have an opinion.
- **Domain words stay; jargon goes.** *Verse*, *tajweed*, *madd*, *ghunnah*, *mus'haf* are
  the subject and a reader of this app knows them — but define each one once, in a short
  glossary near the top. *Salience*, *shard*, *skin*, *family*, *ETL* are our words for our
  plumbing, and a reader should never need them to choose between options.
- **Show it, do not only argue it.** An options page draws each option on a real page of the
  mus'haf, at the size it would actually be used. A wash you cannot see at that size is an
  answer, and it is one no paragraph would have given you.

- **If the difference is felt, it is built, not drawn.** Some options differ in something a
  still picture cannot carry — a snap when you let go of a control, a printed line that tilts
  as it corrects, a wash that only reads once your own thumb is moving it. An option like that
  is built as an interchangeable component — one per option, behind a shared interface,
  `OptionA` through `OptionN` — and mounted **live** on the decision page, so the reader
  chooses by doing it rather than by imagining it. The component that wins graduates into the
  app and the losers are deleted, so nothing was throwaway that the choice did not need. An
  option whose difference is purely structural or policy — which of two labels a page carries —
  may still be drawn. The test is whether a reader could be *wrong* about the option from a
  picture and *right* about it from a hand on it; where that is true, drawing it is not enough.

- **A rough build discovers what an upfront list of pros and cons cannot.** Facing a choice,
  the pull is to write out every option with its costs, settle it on the page, then build the
  winner. Resist it: a list made before anything exists can only hold what you already thought
  of, and the considerations that actually decide a feature are the ones no list had a row for
  — the panel that turns out to cover the verse it is about, the reach across the gutter that
  feels wrong, the shape you only notice is confusing once your own hand is on it. So name the
  options you can already see, then build a quick, throwaway POC as the *instrument that finds
  the rest*, and write the pros and cons in full **afterwards** — the ones the demo taught you,
  not only the ones you guessed before. This is not a licence to skip the thinking; it is where
  the thinking gets its evidence. It is the felt-difference rule carried one step earlier: build
  to *find* the options, not only to choose between the ones you already named.

### Legible is not the same as answerable

The second failure is quieter than the first: a page anyone can read, which still nobody can
act on, because it opens with three options and the options are the *last* thing a person
needs. So a decision — the record and the page both — answers these, in roughly this order:

what is being decided · why it is being asked now · what happens if nobody decides · what
the app does today and what that costs, measured · what people outside this project do about
it, linked, and *if you did not look, say you did not look* · what we have already decided
that constrains it · the options, each one drawn · what else could be considered and why it
is not here · what would change the answer · what this is not settling.

Not every one needs its own section, and a small decision stays small — but each one skipped
should be skipped on purpose. The `decide` skill is this list in full.

### The register

`docs/decisions.json` indexes every decision this project has made or is still holding open,
and `docs/decisions/README.md` is its rendered face. It stores **one sentence of its own** —
the plain-language question — and points at the record for everything else. Never paraphrase
a decision into it: a copy is right for a while and then quietly stops being right.

Adding one:

```
  write the record in docs/decisions/            the reasons, in full
  add a row to docs/decisions.json               the question, the status, the links
  make decisions-doc                             re-render the reader's page
  pnpm gate:decisions                            it refuses the ways this rots
```

An **open** decision must carry two things or the gate fails: an `artifact` — the page's own
address on the site, which anyone can open in a browser — and a `page`, the same thing
checked into `docs/`. Both, always, and they must agree: the address is derived from the
path, so the gate can tell when a row says anything else. A link with no copy dies the day
the host does; a copy with no link cannot be sent to anybody. Whatever is checked in names
the script that rebuilds it, and the record links to both. The `decide` skill walks the whole
thing.

A row also names the decisions that constrain it, in `related` — the one part of a decision
no single record can hold, because relatedness is a fact about a *pair* and the second half
is usually written months after the first, by which time the first is not what anybody is
opening. Say it in both rows; the gate insists, since a link a reader can only follow one way
is one they will not find from the end they happen to be standing at.

### What the gate actually refuses

A question that is not a question · a question written in file names, paths, symbols or
commands · an artifact link that is not the checked-in page's own address on the site · an artifact
with no checked-in page, or a page with no link · a page nobody can rebuild · a record that
never links its own picture · an open decision with fewer than two options · a decision
marked settled that does not say who settled it · a related decision that does not name it
back · a record in `docs/decisions/` with no row in the index · a stale `README.md`.

It does **not** refuse an open decision. Unanswered questions are the normal state of a live
project, and a gate that failed for having one would be switched off inside a week.

## Every design is public

The second tenet, and the reason the first one can be held to. A page drawn to decide
something is served from the app's own site, at the same path it has in this repository, from
the moment it is merged: `docs/design/page-bar-options.html` in the tree is
`https://blog.bytesofpurpose.com/hifth/docs/design/page-bar-options.html` on the web, and the
front door to all of them is `https://blog.bytesofpurpose.com/hifth/docs/`. The build stages
them and the app's colophon links them. Publishing a design is a merge to main and nothing else.

So **a page that only exists as a link on some other host is not published; it is lost
slowly.** A copy put elsewhere for a conversation is fine, and `docs/artifacts.json` lists
those, but the address a record gives a reader is the one on the site, and the decision gate
refuses any other. Nothing is hidden from the people the app is for: the reasoning is as public
as the result, and a reader who disagrees with a choice can open the page it was made on.

## The other registers

Same rule in each: they index, they do not restate.

| register | question it answers | driver |
| --- | --- | --- |
| `docs/map.json` | where does this feature live? | `make map` · the `extend` skill |
| `docs/issues.json` | what is still open, worst first? | `make issues` · the `issues` skill |
| `docs/use-cases.json` | who uses this, and what proves it? | `make use-cases` |
| `docs/decisions.json` | what did we decide, and why? | `make decisions` · the `decide` skill |
| `docs/validation/ledger.json` | what can only a human check? | `make validate` |
| `docs/artifacts.json` | what have we published, and can anyone still see it? | `pnpm artifacts` |

`docs/map.json` and every other JSON register is **hand-edited, never generated**.

### The one register no gate can check

Publishing a page mints its address on somebody else's host, and nothing writes that address
back here. The only record that a publish happened at all is the session log it happened in,
which lives outside this repository on one laptop — so `pnpm artifacts` can only run where the
evidence is, and a gate would pass in CI by being unable to look. It is not called one for that
reason. A hook runs it the moment a page is published and says what is missing, which is the
only point at which the page, its subject and the reason for it are all still in hand.

This was written after counting. Nine pages had gone out and the tree named five; the other
four had been drawn in a scratch directory that was later emptied, so a diagnosis, a comparison
carrying a recommendation, a plan and a finding now exist only as links. That is the failure
the decision gate already refuses — *a link with no copy dies the day the host does* — reaching
a page nobody had thought to attach to a decision. Since 2026-09-01 the build serves every
page under `docs/` from the site, so a merged page cannot leave by that door at all; the
register is for the copies that still do.
