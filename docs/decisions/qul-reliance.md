# When the app leans on the outside library, does it copy what the library holds, or only measure against it?

**Status:** decided — now **D** (reopened and re-decided 2026-09-07). Originally decided **A** on 2026-09-03. **Decided by:** omar. The reopening and its reasons are the last section below.

## A few words first

*Mus'haf* — a printed copy of the Qur'an; the app shows real printed pages. *Verse* — one
ayah. *Look-alike verses* — the *mutashabihat*: verses that share a run of words with another,
the thing a haafiz most often mixes up. *The outside library* — the Quranic Universal Library
(qul.tarteel.ai), a large public collection of Qur'an datasets: printed-page layouts, verified
letter-by-letter text, per-page fonts, and lists of look-alike verses.

## What is being decided?

The outside library holds things this app could use in two very different ways. It holds
**numbers** — which verse sits on which page, where a line breaks, which verses resemble which,
how many words two verses share. It also holds **the Qur'an itself** — the verified text of
every word, and the fonts that draw those words.

The question is how far the app is allowed to reach into it: does it **copy** what the library
holds into the app that ships to readers, or does it only **measure its own work against the
library and link back out to it**, carrying none of the library's bytes?

## Why is this being asked now?

The look-alike-verse work needs richer data than the app currently carries — in particular,
*which words* make two verses resemble each other, not just that they do. The outside library
has exactly that, and it also, sitting right next to it, has the fully verified text and the
matching fonts. Once you are downloading from it at all, "why not take the verified text and
draw the pages from its font while we are here" is one click away, and that click would quietly
undo the thing this project is most careful about. So the boundary has to be drawn on purpose,
now, before the first download decides it by accident.

## What happens if nobody decides?

The boundary gets drawn by whoever writes the next download script, and probably drawn wide,
because the wide version is less work and looks like more value. That is the expensive outcome:
the app would then carry Qur'an text and fonts under the library's per-item licences, and the
one guarantee this project makes about its own bytes would be gone without anyone having chosen
to give it up.

## What does the app do today, and what is it costing?

Today the app already shows look-alike verses: tap a verse and a rail of its look-alikes
appears, built from a corpus this project vendors and pins as its own, cross-checked against
the outside library's page layout as a *ruler* only. Nothing of the library's own bytes ships;
the printed pages are drawn as anonymous outlined artwork with no letters in them, and
everything else the app carries is numbers.

What that costs: the look-alike rail knows *that* two verses resemble each other but is thin on
*which words* do — word-level spans survive only on the hand-curated edges, not across the
whole corpus. The feature the reader would most value is the one the current data underfeeds.

## What do people outside this project do about this?

Looked. Most Qur'an apps take the wide path without a second thought: quran.com, Tarteel, and
the common mobile mus'haf apps embed the full verified text and render pages from Qur'an fonts,
because their whole purpose is to *display* the text. The printed tradition, of course, prints
the text — that is what a mus'haf is.

Why that answer does not transfer here: those apps are readers of the text and own that
responsibility end to end; this app's job is narrower — to help a haafiz *navigate and
self-check* pages they are reciting from memory — and it deliberately renders the page as
artwork so that it never becomes a thing that could show the Qur'an wrongly. The convention to
embed text is evidence about apps whose job is display, not about this one.

## What have we already decided that touches this?

- **Where the look-alike list comes from** (`loop-4a`): the app already builds its look-alike
  data from a corpus it vendors and pins as its own, and already uses the outside library only
  as the layout ruler. This decision generalises that one habit into a standing boundary.
- **Carrying the whole mus'haf** (`loop-4b`): the pages are carried as outlined artwork, not as
  font-drawn text — the mechanism that keeps text out of the bytes.
- **The standing rule that this repository ships no Qur'an text.** A per-page font of whole
  words *is* Qur'an text; the verified script *is* Qur'an text. Copying either would breach the
  rule, so both are on the far side of this boundary.

## The options

**A — Measure against it, link back to it, copy nothing.** Download the library's datasets once
into a scratch cache that never ships; derive our own numbers, check them against the library's,
keep only the numbers we derived. Where a reader wants the library's own page for a verse, send
them out to it by a link. Zero of the library's bytes ship. *Cost:* the app never renders the
library's verified text or fonts itself; a reader who wants that follows a link.

**B — Copy the verified text, the fonts, and the layout in.** Vendor the letter-by-letter text
and the per-page fonts and draw the pages from them. *Cost:* the app now carries Qur'an text
and fonts under the library's per-item licences; the standing no-text guarantee is gone; every
one of those items needs its own licence cleared before it can ship.

**C — Copy only the layout numbers, not the text or fonts.** Take the page/line/word-range
numbers as data but still ship no text or fonts. *Cost:* mostly redundant — the app already
derives those numbers from its own artwork and only needs the library to *check* them, so
copying them in buys little and starts the habit of copying.

**D — Hold a copy in a store we control, off the repository and off the shipped bundle.**
*(Added when this was reopened, 2026-09-07.)* Keep a copy of the library's page positions
and its word text in a hosted database this project owns — never checked into the repository,
never compiled into the app that ships to readers. The building tools read it; whether any
reader ever does is a separate question this option leaves open. *Cost:* the project now
**holds** a copy of the library's Qur'an text somewhere it controls — a posture the three
earlier options did not have, because each of them was about the bytes that *ship*, and this
is a fourth place bytes can sit. That copy needs each item's licence read before it is held,
and a standing guarantee that the store never leaks into the repository or the build.

**Decided (2026-09-03): A.** The app measures against the outside library and links back to it,
and copies none of its bytes. Attribution to each library item used is still required and
recorded, even though nothing of it ships. *This held until 2026-09-07; see the reopening below.*

## What else could be considered, and why is it not here?

Copying the text but not the fonts (render our own way from verified text) — rejected with B,
because the verified text alone is still Qur'an text and still breaches the standing rule.
Mirroring the library's pages on our own host instead of linking out — rejected as republishing
someone else's bytes under our name, the same problem as B wearing a link's clothes.

## What would change the answer?

If the project ever decided its job had grown to *displaying* the Qur'an text itself — a
different app than the one described here — B would be back on the table, gated on clearing each
item's licence. Nothing smaller reopens it: richer look-alike data (the reason this came up) is
fully served by path A, because word-level resemblance is numbers about words, not the words.

## What is this not settling?

It does not settle **how** the look-alike feature shows the reader the differing words — that is
its own open question, decided on a page a reader can try. It does not settle which specific
outside-library items get used as rulers, nor their individual licences and attributions; those
are recorded item by item as each is picked up.

## Reopened, 2026-09-07 — why, and what changed

### Why open a settled question again?

The look-alike-verse work reached the point the 2026-09-03 record foresaw: to enrich *which
words* make two verses resemble each other across the whole book, the building tools need the
library's word text staged somewhere they can query it repeatedly, not read once from a scratch
folder and thrown away. The owner chose to stage it — the page positions **and** the word text —
in a hosted database this project controls, rather than re-derive it each run. That is a copy
held on our own infrastructure, which is the thing option A was written to avoid, so the
boundary had to be redrawn on purpose instead of being moved by a build script.

### Did the earlier answer actually forbid this?

Not exactly, and that is the point. Every one of the first three options was framed around the
bytes that **ship to readers**: A ships nothing, B ships text and fonts, C ships numbers. A
database the project owns, that the building tools read and readers do not, is a place none of
those three named. So this is genuinely a new option — **D** — not a reversal of A on A's own
terms. The repository still carries no Qur'an text; the app that ships to readers still carries
none. What is new is that a copy now sits in a store we control, between the library and our
own tools.

### What does holding a copy oblige us to?

Reading the licence first. The outside library states plainly that using its data commercially
is allowed, but only *subject to each resource's own terms* — some items are public domain, some
require attribution, some restrict use, and there is no blanket grant (its own guidance,
<https://qul.tarteel.ai/faq#faq-9>). So before the printed-page layout we lean on and the font
that draws its glyphs may be **held** in our store, each one's individual licence has to be read
and its attribution recorded — a check that was owed-in-theory under A and is owed-in-fact under
D, because now we hold the bytes rather than only measuring against them.

### What is this reopening deciding, and what is it not?

**Deciding (2026-09-07): D.** A copy of the library's page positions and word text may be held
in a hosted database this project controls, kept out of the repository and out of the shipped
bundle, for the building tools to read.

It is **not** deciding that any reader ever receives those bytes. Whether the app streams the
held text to the people using it — which would make the store part of what ships, and land it
back at option B — is a separate open question, decided on its own page, not here. Until that is
decided, the store is for the building tools alone. It is also not deciding the individual
licences of the specific items held; those are read and recorded item by item, and the layout
and its font are the first two owed.

### What would change this answer?

If the licence read on the printed-page layout or its font came back as *may not be copied or
held*, D is off the table for that item and it stays a ruler measured against, never held. And
if the project decided readers should receive the held text, that is not a tweak to D — it is
the separate display question, gated on clearing each item's licence to ship, not merely to
hold.

---

*Where this lives in the code:* the QUL rulers are cross-checked by
`packages/etl/scripts/probe-qul-rulers.mjs` (run it with `make probe-qul`), which reads the
library from a gitignored `.cache/qul*/`, measures its page layout, juz boundaries and two
similarity corpora against what we ship, and emits the numbers-only pin
`packages/etl/data/qul/qul-rulers.probe.json` — following the same ruler/probe pattern as
`probe-reference.mjs`. The no-text guarantee is enforced by `gate:scripture` / `gate:notext`;
the per-resource licence read and the by-eye confirmation that each cached export is text-free
are the human check `qul-rulers-terms-and-text-free` in `docs/validation/ledger.json`; per-item
attribution is recorded in `SOURCES.md` and surfaced through `gate:notices`. The download
mechanism and per-resource licence posture are in the `leverage-qul` skill and the
`qul-licensing` memory.

*Under option D (2026-09-07):* the held copy lives in a hosted database reached through the
Supabase command-line tool (project ref `zbkqfstkjmgzsrraodez`), populated by an ingest
step on branch `qul-etl-supabase` (off `qul-integration`); its source inputs stay in a
gitignored `.cache/` so nothing lands in the tree. The no-text guarantee `gate:scripture` /
`gate:notext` now reads as *the repository and the shipped bundle carry no Qur'an text* — the
store is deliberately outside both. The per-resource licence read for the QPC V2 page layout
(library id 10) and its glyph font is the now-owed human check
`qul-rulers-terms-and-text-free` in `docs/validation/ledger.json`.
