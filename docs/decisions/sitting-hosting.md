# The instrument needs a house, and today it is one laptop

**Status:** decided — **A**, the laptop, by Omar on 2026-08-17.
**Date opened:** 2026-08-17. **Date settled:** 2026-08-17.
**Asked as:** *"how can we host this review in a way where we can do it from anywhere? can
claude artifacts hold state?"*.
**The picture:** [`docs/design/sitting-hosting.html`](../design/sitting-hosting.html), built by
`node scripts/build-sitting-hosting-options.mjs`, published at
<https://claude.ai/code/artifact/84b4bfe6-f875-4186-9d32-c37f26ad71be>.
**Constrains and is constrained by:** [mark placement](../design/mark-registration.md) — the
question the sittings exist to answer. If that one is settled on the evidence already in hand,
this one evaporates.

## The question

Where a sitting should live: on the laptop that hands it out over the household's private
network, or published as a page anyone can open from anywhere — and if published, whether each
answer is banked as it is given or held in the browser until the end.

| | |
|---|---|
| **A** | Leave it as it is — one laptop hands out the sittings over a private network |
| **B** | Publish each sitting as a page, and hand the answers over at the end |
| **C** | Publish each sitting as a page, and let it bank each answer to a hosted table |

Each is drawn on the options page as the journey a single answer takes, from the reader's
finger to a line checked into the repository, with the steps that can fail marked.

## What was chosen, and what it commits us to

**A.** The laptop keeps handing out the sittings, and the reader reaches them from a phone over
the household's private network. Asked for in these words, the same day the question was opened:
*"have them run locally on this laptop but remember this laptop is setup on tailscale and can
access from phone."*

Be clear about what settled it, because it was not a fresh weighing of three options. The one
thing A costs — the reader has to be somewhere that network reaches — was judged acceptable,
and the two costs that made A *feel* worse than it is turned out to be missing work rather than
properties of the arrangement:

- **Reaching it from the phone at all was an incantation nobody had written down.** The server
  listened only to the machine it ran on unless someone remembered a flag, and no script,
  routine or document anywhere recorded how to start it. It now defaults to the private network,
  and there are two named commands, and the routine has a sixth step that names them.
- **The machine answers to two spellings, and a browser treats them as two different sittings.**
  Nothing said which to use, so the choice was made by whichever one got typed, and a reader who
  came back at the other one was dropped at card one with an hour apparently gone. There is now
  one address, derived rather than typed, printed on start with the others named as the ones not
  to use — and the front door says so on screen when it notices it is being read at the wrong
  spelling.

Two further commitments came with the choice, because a sitting on a phone is a sitting on a
phone and both were broken:

- **A front door that says where you left off.** It counts the marks out of the sittings
  themselves, asks this machine what it has heard, and points at the one to carry on with.
- **Two taps in a row are two answers, not a zoom.** Pressing the same nudge twice magnified the
  page instead of nudging it, which on a phone is most of what nudging is.

B and C stay on the page unbeaten rather than beaten. Neither was tried; A was made good enough
that neither had to be. What would reopen this is unchanged and is listed below — most cheaply,
a sitting actually attempted away from home.

## Why it is being asked now

Because the work is about to get long, and only now is it clear how long. 1,710 marks remain,
in 16 sittings of about 106 — measured by `pnpm audit:sittings`, not estimated. At the pace of
the two sittings already done that is roughly 16 hours of one person's attention, every hour of
which currently needs `pnpm sittings:serve` running on one machine, in one house, with the
reader on the same network.

Nothing is broken, and this is not a defect report. The arrangement was built deliberately —
`packages/etl/scripts/serve-sittings.mjs` replaced `python3 -m http.server` precisely because
answers were living only in one browser's store and going unbanked until the end, which cost a
reader an evening twice. The question is whether the arrangement that fixed *that* is the one
that gets the next sixteen hours done.

## What happens if nobody decides

The sittings carry on exactly as they are, and the cost is real but small: they happen when the
reader and the laptop are in the same house, and not otherwise.

**Nothing is waiting behind this.** No feature is blocked, no other decision depends on it, and
the 578 statements already banked in `packages/etl/out/mark-answers.jsonl` are safe under every
option — the file is only ever appended to, and `packages/etl/scripts/lib/answered.mjs` is the
one reading of it that every consumer shares.

So this can stay open, and saying so is part of the answer. If the remaining hours are going to
happen at a desk at home anyway, the honest choice is A and no work at all.

## What it costs today, measured

Every number below was counted on 2026-08-17 out of `packages/etl/out` by
`node scripts/build-sitting-hosting-options.mjs --extract`, and lives in
`docs/design/sitting-hosting.data.json` so the page rebuilds from committed bytes.

- **1,710** marks unsat, **16** parts of about **106**, **167** already answered, **1,877** in
  all. Confirmed independently by the auditor, which reads what each built part declares it was
  built from rather than trusting the build log.
- **578 statements over 167 marks — 3.5 per mark.** This is the number that separates the
  options. A reader nudges a rectangle a step, looks, nudges again, and each nudge is a separate
  thing said. Anything that banks one at a time does so three or four times a mark, not once.
  By kind: 360 placement, 201 wrong shape, 15 print defect, 2 looks right. About 193 bytes each.
- **1.3 MB is a whole sitting** — median across the sixteen, min 1.26 MB, max 1.43 MB, total
  21.4 MB — against a **16 MB** artifact ceiling. So publishing one is not a technical question,
  which is what makes B and C possible at all.

## What other people do about this

**Nobody looked.** The session's web-search budget was exhausted before this page was written,
and no prior art was consulted. That is stated on the options page in the same words, because a
record silent about prior art reads as one that found none.

The comparable question — how projects that ask many people to judge many pictures get those
judgements home safely — has a large literature behind it in crowd-judged science, in map
correction, and in image-labelling tooling. What is worth looking up specifically, if this is
going to be decided rather than left: how those tools handle a judgement given while the device
is offline, and whether they bank each judgement as it is given or in batches. That single
detail is what separates the three options, and somebody has certainly measured it.

## What we have already decided that constrains it

- **Mark placement is open, and this exists only to serve it.** The sittings are how that
  question gets evidence. If it is answered on what is already in hand, the remaining 1,710
  marks stop being urgent and this closes unmade.
- **What a reader does inside the app never leaves their device.** That is settled, and it is
  about *the app*. A sitting is not the app — it is a maintainer's instrument shown to one or
  two people who know what they are agreeing to — so the rule does not forbid C. But the
  instinct behind it should be brought to C deliberately rather than forgotten, and C is the
  only option that has to answer for it.
- **This project ships static files on purpose.** That is what rules out the fourth option
  below, and it is also why B and C are cheap: a sitting is already one self-contained file with
  no external references, because it was built to be opened from `file://`.
- **An answer already given is never at risk.** Whatever wins, the settling run
  (`pnpm sittings:settle`) reads the same append-only log, and `pnpm audit:sittings` will notice
  if a rebuilt sitting stops agreeing with it.

## What each option actually costs

**A — the laptop.** Every answer is banked the moment it is given, so a closed lid costs at most
one statement, and the count of what is left falls as the reader works. Two costs. The first is
the one this question is about: the reader must be somewhere that network reaches. The second is
sharper and less obvious — restarting the server mints a fresh token, and every page a reader
already has open quietly stops banking. The answers keep appearing to send and stop arriving.
That is why `review-sitting` says not to restart the server to pick up a rebuild.

**B — publish, hand over at the end.** This is what was in place before the laptop was taught to
receive, and it is known to fail: a browser's store belongs to one address, so the same machine
reached two ways is two memories of the same sitting and neither can see the other. Nothing is
banked until the end, so a cleared browser loses the hour, and the remaining count cannot fall
until a file comes back. It buys exactly one thing, and it is the thing being asked for: any
device, any place, nothing running at home.

**C — publish, bank each answer.** Everything A gets with none of what A costs. It is also the
only option here that does not exist: it needs a table, a shape agreed for what one statement
looks like, a page that writes to it, and a step that pulls the rows back down into the same
log. And its failure mode is the one nobody has met. The connector is granted by the reader on
their own account, per reader, which is a real constraint and also the thing that keeps the
answers from being handed to anybody who finds the link.

## What else could be considered, and why it is not an option here

- **Publish the page, and have it post back to the laptop.** The obvious middle, and it cannot
  work: a published page is served under a policy that blocks every external host. It would not
  fail loudly — it would simply never arrive.
- **Put the sittings on the open web with a small service behind them.** A bill, an account, and
  a thing to keep running, for an instrument two people will use for perhaps sixteen hours.
- **Send the sitting as a file and get it back as a file.** Already works, and it is what B
  degrades to when nobody publishes anything. Not listed separately because the only difference
  is whether the reader receives a link or an attachment, and everything after that point is
  identical.
- **Expose the laptop to the open internet rather than the private network.** Deliberately not
  drawn. It turns a household instrument into a public one for the sake of convenience, and the
  private network already reaches every device the reader owns when they are at home — which is
  where the problem is not.

## What would change the answer

- **A sitting attempted away from home.** If the reader tries and cannot, A has been measured
  rather than assumed, and this stops being hypothetical. This is the cheapest thing on the list
  and it should happen before anything is built.
- **1,710 still being 1,710 in a month.** Then the arrangement is the suspect, whatever anybody
  thinks of it in principle.
- **A second reader.** Every option assumes one person answering. Two makes A awkward and C
  obvious, because two readers on one laptop's network is not an arrangement anybody would
  choose.
- **Mark placement being settled.** Closes this unmade.

## What this is not settling

Whether the rectangles are right — that is [mark placement](../design/mark-registration.md), and
it has its own page. What a hosted table would actually hold: C describes a shape that does not
exist, so choosing it is choosing to design it, not choosing a design. And nothing about the app
itself — no option here changes one thing a reader of the mus'haf would see.

## Where the numbers come from

`scripts/build-sitting-hosting-options.mjs` has two modes. `--extract` reads
`packages/etl/out` — the sixteen built parts and the answer log, neither of which is committed —
and writes `docs/design/sitting-hosting.data.json`, which is. The default mode renders the page
from that file and nothing else, so it rebuilds on a fresh clone.

The specimen card on the page is one real question lifted from the first part, with the two
fields carrying Arabic dropped: the printed ink is outlined paths from the vendored print, and
the generator refuses to write a page containing an Arabic codepoint. The card's ink and paper
colours are pinned inside the card rather than inherited, because the page's own theme tokens
share those names and a dark theme would otherwise print black on black — the defect
`mark-registration.md` ⑪ records as already fixed once, in the instrument itself.
