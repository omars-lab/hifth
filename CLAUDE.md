# Working in this repo

## Decisions are explained in plain language, or they are not explained

This is the tenet. Everything below is how it is enforced.

Hifth is for huffaz, and its decisions get made by people who are not in the weeds of this
code — including the person who owns it, six months from now, and anyone they show it to.
So **every options page and every decision record must be followable by someone who has
never opened this repository.** Concretely:

- **Headings are questions.** "What does the app colour today?", not "Current salience
  model". A reader arrives holding a question; the page's headings are how they find it.
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

An **open** decision must carry two things or the gate fails: an `artifact` — the published
page anyone can open in a browser — and a `page`, the same thing checked into `docs/`. Both,
always. A link with no copy dies the day the host does; a copy with no link cannot be sent to
anybody. Whatever is checked in names the script that rebuilds it, and the record links to
both. The `decide` skill walks the whole thing.

A row also names the decisions that constrain it, in `related` — the one part of a decision
no single record can hold, because relatedness is a fact about a *pair* and the second half
is usually written months after the first, by which time the first is not what anybody is
opening. Say it in both rows; the gate insists, since a link a reader can only follow one way
is one they will not find from the end they happen to be standing at.

### What the gate actually refuses

A question that is not a question · a question written in file names, paths, symbols or
commands · an artifact link that is not an absolute `https://claude.ai/…` URL · an artifact
with no checked-in page, or a page with no link · a page nobody can rebuild · a record that
never links its own picture · an open decision with fewer than two options · a decision
marked settled that does not say who settled it · a related decision that does not name it
back · a record in `docs/decisions/` with no row in the index · a stale `README.md`.

It does **not** refuse an open decision. Unanswered questions are the normal state of a live
project, and a gate that failed for having one would be switched off inside a week.

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
a page nobody had thought to attach to a decision.
