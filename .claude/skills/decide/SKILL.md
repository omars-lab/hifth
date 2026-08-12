---
name: decide
description: Put an open question in front of a person in a form they can actually answer — what is being decided and why now, what the world outside this repo does about it, what we have already decided that constrains it, the options drawn on real data, and what we are choosing not to consider. Registered in docs/decisions.json. Use when a decision needs making and the choice is not obvious, when writing or reviewing an options page, or when recording a decision that has just been made.
---

# Putting a decision in front of a person

Two failures, and the second is the common one.

The first is a page nobody outside this code can read — written in file names and our own
vocabulary, so it has to be re-derived before it can be used. That is the `CLAUDE.md` tenet,
and the second half of this document is that rule as a checklist.

The second is a page that is *legible and still not answerable*: here are three options, pick
one. A person cannot pick one, because the options are the last thing they need and the first
thing they were given. They do not know why this is being asked now, what happens if nothing
is chosen, whether anyone else has solved it already, or which of our earlier decisions have
quietly ruled half the space out. So they either rubber-stamp the recommendation or defer,
and both of those are the decision being made by whoever wrote the page.

**A decision record answers the questions below, in roughly this order.** Not every one needs
a section, and a short decision should stay short — but each one that goes unanswered should
go unanswered *on purpose*, and you should be able to say why.

## The questions a record has to answer

**1 · What is being decided?** One question, in plain words, that a person could answer with
one of the options. Not a topic — a question. This is the sentence that goes in the register.

**2 · Why is this being asked now?** What forced it. A measurement that came back, a feature
that cannot be built until this is settled, a defect that turned out to be a design gap.
"It seemed worth thinking about" is a real answer and worth writing, because it tells the
reader they are allowed to say *not yet*.

**3 · What happens if nobody decides?** Say the cost of the status quo out loud, and be
honest when it is small. Some questions can sit open for a year at no cost, and a reader who
learns that from the page will spend their attention on a different one. Say what *else* is
blocked behind it — decisions with nothing waiting on them are cheaper to leave open than
they look.

**4 · What does the app do today, and what is it costing?** Measured, not remembered. The
status quo is always one of the options, and it deserves the same evidence as the others.
Numbers here are the strongest thing on the page: the mark-granularity decision turned on
one — that 83% of what is annotated renders as nothing — and no paragraph would have produced
it.

**5 · What do people outside this project do about this?** Prior art, and name it. Other
mus'haf apps, the printed tradition, published guidance, how comparable software solves the
comparable problem. Link what you find. Two rules:

- **If you did not look, say you did not look.** A record silent about prior art reads as one
  that found none, which is a much stronger claim than the truth.
- **Say why the answer does not transfer**, when it does not. The reference points here are
  often print, and print has no state, no accessibility tree and no 150 KB budget. A
  convention that exists because of a printing press is evidence about readers, not about
  implementations.

**6 · What have we already decided that touches this?** Name the earlier decisions by their
row in the register, and say what each one *constrains* — not just that it is related. This
is the question that most often turns a three-option page into a two-option one, and it is
the one nobody remembers to ask, because the constraint feels obvious to whoever is holding
it and is invisible to everyone else. If an earlier decision would have to be reopened for an
option to work, that option is not on this page; it is on a bigger one.

**7 · What are the options?** Each one **drawn**, on real data, at the size it would really
be used — see the checklist below. Each with what it takes, what it gets, what it costs.
Doing nothing is always on the list and is often right.

**8 · What else could we consider, and why is it not here?** The options you thought about
and left off, with the reason. This is where a reader adds the one you missed. A page whose
option list arrives with no visible edge invites the reader to trust that the edge was
somewhere sensible, and it usually was not.

**9 · What would change the answer?** The measurement, the device, the person, or the
upstream change that would make a different option win. This is what makes a decision
reopenable on evidence rather than on mood, and it is what you check against when somebody
asks a year later why it was done this way.

**10 · What is this not settling?** State the gap on the page. An options page that reads as
complete when it is not is worse than one that admits its edge, because the gap gets
discovered after the choice instead of before it.

## The plain-language rule, as a checklist

Run this over anything you are about to publish. Every line is a way a page stops being
answerable by the person it is for.

**Headings**

- [ ] Every section heading is a **question a reader might arrive holding**. "What is it
      leaving out?" — not "Discarded annotations". A noun-phrase heading is describing the
      machinery instead of answering the reader.
- [ ] The last heading is the decision itself: *so what is being decided?*

**Words**

- [ ] No file names, paths, function names, gate names, or commands anywhere a reader is
      meant to follow. They belong in the body of the record, where the reasons are.
- [ ] Domain words stay — *verse*, *tajweed*, *madd*, *ghunnah*, *mus'haf*, *waṣl*. A reader
      of this app knows them, and translating them out makes the page vaguer, not simpler.
- [ ] Our words for our plumbing go — *salience*, *shard*, *skin*, *family*, *pipeline*,
      *annotation*. If one is load-bearing, say the thing it means instead.
- [ ] A short glossary near the top for the domain words. Three or four lines, once.
- [ ] Read the page out loud as if to someone who has never seen the app. Every place you
      would have to add a sentence of explanation is a place the page is missing one.

**Evidence**

- [ ] Each option is **drawn**, at the size it would really be used. Not described.
- [ ] It is drawn on real data from this project, not a mock. A mock cannot surprise you, and
      the surprise is the reason to draw it — a wash that turns out invisible at print size
      has answered the question no paragraph would have.
- [ ] Any number on the page can be re-derived by running the generator.
- [ ] No option is written to lose. If one is obviously worse, either it is not a real option
      or the page is arguing rather than presenting.

## Building it

The page is generated from committed data by a script, so the numbers stay true and anybody
can rebuild it. Split the generator when the data needs something not in the repo: an
`--extract` mode that reads whatever large local cache is involved and writes a small JSON of
findings, and a default mode that renders from **committed bytes only**. Then the page
rebuilds on a fresh clone and the expensive half runs once.

Two outputs, and the gate refuses one without the other:

- **the checked-in page**, under `docs/`, a full HTML document — a fragment renders in quirks
  mode from `file://`, which is where it is read from
- **the published copy**, which is what a person is actually sent

The published copy is served under a policy that blocks every external host, so **inline
everything**: no relative URLs, no CDN links, no external fonts. A referenced asset does not
error, it silently renders nothing. Where the same picture repeats, define it once and
reference it rather than embedding several copies.

Before publishing, check what the bytes carry. This repo ships **no Qur'an text** — a
standing rule kept by the shipped bytes, not only by policy. A page built from mus'haf assets
must contain zero Arabic codepoints and no text elements; the vendored print is outlined
paths, so it does not, but verify rather than assume.

## Registering it

A decision that is not in the register does not exist — nothing counts it as open, and
nothing notices when it goes stale.

```
  add a row to docs/decisions.json     question, status, options, artifact, page, builtBy, doc, related
  make decisions-doc                   re-render docs/decisions/README.md
  pnpm gate:decisions                  the check
```

The row stores **one sentence of its own**: the plain-language question. Everything else it
points at. Do not summarise the decision into the register — the record owns the answer, and a
copy would be right for a while and then quietly stop being right.

`artifact` is the published link; `page` is the same page checked in here. Both, always: a
link with no copy dies when the host does, and a copy with no link cannot be sent to anybody.
The record named in `doc` has to link to each, or its argument is about a picture the reader
cannot reach.

`related` lists the ids of decisions that constrain or are constrained by this one — question
6, made machine-checkable. It is the one piece of a decision that no single record can hold,
because relatedness is a fact about a pair, and the second half is usually written months
after the first. Fill it in **both** directions; the gate says so, since a link a reader can
only follow one way is one they will not find from the end they are standing at.

When the decision is made: set `decided` to the option that won, `status` to decided, and `by`
and `date` to who chose and when. The losing options stay on the page. They are the reason the
choice was a choice, and the next person to reopen this will want them — along with question
9's answer, which is what tells them whether anything has actually changed.
