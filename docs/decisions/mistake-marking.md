# Should a reader be able to pin their own note to a spot on the page, and to what?

*Status: both questions decided 2026-09-02 by the owner, who reopened the two positions to do
it. A reader can pin a note down to **a single spot or mark** (D of the first question) — and,
past what the options drew, to a **line, a page, or a structural break** (a juz's start, a
hizb-quarter) as well. Notes are **aggregated into one file and shareable by default**, synced
to the reader's cloud once there is sign-in (C of the second question, taking the
[storage model](storage-model.md)). A **fourth kind of note — a question for scholars — is
added** to the comment, the correction and the note to the developers. The options and reasoning
below stand as drawn; the decision, the structural axis the options did not draw, and the new
kind are gathered at the end.*

**The picture:** <https://blog.bytesofpurpose.com/hifth/docs/design/mistake-marking-options.html> —
`mistake-marking-options.html`, checked in and rebuilt by
`scripts/build-mistake-marking-options.mjs` from page 7 of the vendored print, its shipped
word and pause-mark boxes, the stage's zoom ladder and the app's design tokens. The address
is the page's own on the app's site, so it is public the day the page is merged.

## A few words, defined once

- **Verse** — one numbered sentence of the Qur'an. 2:38 is the thirty-eighth verse of the
  second surah, Al-Baqarah, and is the verse every drawing zooms into.
- **Word box** — the app knows a rectangle for every word of every page and uses it when a
  reader long-presses to select words. It does not know a rectangle for a single letter.
- **Harakah** — a small vowel mark written above or below a letter. Naming which one sits
  where is what the finer, unshipped work does.
- **Pause sign** — a mark in the line that tells a reciter where they may stop. Unlike a
  letter, it is counted in the word data, so the app can point at it.
- **The margin** — the space beside the text where a pinned note's marker sits, so it never
  covers the print it is about.
- **Private** — kept in the phone's own storage, sent nowhere. This is how everything the
  app remembers works today.

## Why is this being asked now?

The desktop triage of 2026-09-01 asked for comment-style mistake marking: zoom in, tap a
letter, a vowel mark or a pause sign, and drop a note anchored to that spot, coloured by kind
— a comment, a correction, a note to the developers — with the markers appearing only once
the page is zoomed in, and a hover revealing the span. It is a good idea, and it asks for
three things the project has already taken a position on: a note the reader *types*, an anchor
*finer than a word*, and a note that can *leave the phone*. So this is a decision before it is
code, and each is drawn on the page at the size it would really be used.

## What happens if nobody decides?

Nothing breaks. Today a reader can light a verse or a word but keeps no note; that carries on.
The designed home for "where I go wrong" — a private confusion map — is written down but not
built, and it deliberately keeps no free text either, so part of this decision is whether to
go further than that design chose to. No other feature waits behind this one.

## What does the app do today?

Tap a verse and it lights; long-press and the selection drops to the word under the finger and,
pointedly, does not turn the page. Both are ways of *pointing*, and neither writes anything
down. The one record the app does keep — which parts of the book a reader has opened — is made
for the reader by their taps, not typed by them. So there is no reader-authored note to keep,
and the status quo of the first question is genuinely "nothing".

## What have we already decided that touches this?

- **A drag across text already selects rather than turns the page** (`word-selection`; decided
  2026-09-02). The long press that drops to a word was built never to move the page under a
  finger choosing words. A note anchored to a word or a run inherits that gesture whole; it
  does not invent one. Option C of the first question is that gesture with a note on the end.
- **The page ships as anonymous shapes, and the finer marks are held back** (`mark-granularity`;
  decided B — colour the exact letter or mark, when the geometry exists). Every page is
  outlined paths with no letter identity, and the vocabulary that names each mark — a few dozen
  shapes, measured over all 604 pages — is built but unshipped, judged not yet worth its bytes.
  Anchoring a note to a letter or a harakah means shipping that, so option D at letter grain
  reopens this, not this page.
- **A private record stays private by construction** (the revision record's privacy gate). Its
  privacy is a gate, not a good intention, because "add it to the share sheet" is always one
  convenient import away. Any note the reader keeps inherits that stance.
- **A personal layer never rides along in a shared link** (the confusion map's design, which
  inherits the shared-link rule). Opening someone else's shared verse can never switch a
  personal layer on for a reader who never chose it. A note layer is exactly such a layer.
- **Nothing leaves unless it serves the reader, and stays in their hands** (`confusion-map-export`;
  open). The rule the app is sharpening for the confusion map's backup. The "note to the
  developers" kind is the first thing here that would test it, and the second question leans on
  wherever that one lands.
- **A rectangle is how a region is named** (`comparison-crop`, which reaches for the standard
  web way of recording "a note is about this rectangle of this page", with a finer selector
  when the region is not a rectangle). The anchor here is that same shape.

## What can a reader pin their own note to?

**The options**, each drawn on page 7 at the zoom it would be used:

- **A · Nothing: the reader writes no note** — today. Takes nothing. The app stays a place to
  find verses, not to annotate them, and no private record has to be held safe. Costs a reader
  who wants to remember a hard spot, or to say the print looks wrong, any place in the app to
  put it. The confusion map — the designed, unbuilt home for "where I go wrong" — bars free
  text anyway, so this is the honest status quo.
- **B · A note on the whole verse** — tap a verse, pin a short note, a marker shows in the
  margin. Takes only the verse geometry the app already draws. Gets an exact anchor for every
  verse and matches the one record the app was already going to keep. Costs precision: it
  cannot say which word, still less which letter.
- **C · A note on a word or a run of words** — the long press that already drops to a word
  carries the note to the word under the finger; a drag extends it across a run. Takes the word
  boxes the app ships and the selection gesture it already built. Gets an exact anchor on all
  604 pages, reached by a gesture readers already use, with the drag-selects-not-turns rule
  already settled. Costs nothing new in geometry, and stops at a word — as fine as the shipped
  bytes go.
- **D · A note on a letter, a vowel mark, or a pause sign** — zoom in and pin to the exact
  mark, which is what the triage asked for. Takes, for a pause sign, the mark boxes the word
  data already flags — reachable now. Takes, for a letter or a harakah, geometry finer than a
  word, which the app does not ship. Gets the finest anchor the request imagines. Costs a
  reopening of a settled choice: the shipped page is anonymous shapes, so pinning to a glyph
  means shipping the finer corpus, judged not yet worth its bytes. It is a larger decision
  wearing this one's clothes.

**When the markers show.** The triage asked for markers that appear only once the page is
zoomed in. The app's zoom is a fixed ladder of steps, so "zoomed in" has an exact meaning:
below a chosen rung the markers on one small area collapse into a single badge that counts
them, and above it each shows on its own spot, with a hover revealing the span it covers. The
page draws this at the app's own rungs.

## What kinds of note are there, and does any leave the phone?

This only matters if a note layer is added at all. The request names three kinds, and they
split cleanly: two are a reader's private business, and the third is a message to someone else.
A message has to leave the phone to arrive, which is the line the whole app has been careful
about.

**The options:**

- **A · Private notes only, kept on the phone** — a comment and a correction, in the phone's
  own private storage like everything else the app remembers, never leaving, never encoded in
  a shared link. Gets the strongest privacy: a record of where a person's memory of the Qur'an
  slips cannot leak, because it never leaves the one phone. Costs the "note to the developers"
  kind, dropped — a reader who spots a real print defect cannot tell anyone from inside the app.
- **B · Private notes, plus a report the reader chooses to send** — the comment and the
  correction stay; the "to the developers" kind is a deliberate send, a file or a message the
  reader hands over, reusing the export question already open for the confusion map. Gets a
  channel for real defects without a private log ever leaving by reflex. Costs one more surface
  to build and keep honest, leaning on a backup-and-export decision that is itself still open.
- **C · Every note is a report that syncs** — every note copied off the phone automatically.
  Gets the developers everything with no reader effort. Costs a server, an account, and the
  always-on copy the rest of the app avoids; it turns a private study aid into a feedback
  funnel and crosses the privacy line the whole app rests on. Drawn for the edge of the space,
  not because it fits it.

## What do people outside this project do?

**A fresh external scan was not done for this page.** The session's research assistant hit its
limit before it returned, so rather than pretend otherwise: what is drawn here rests on prior
art already inside this project. An earlier decision reached for the standard web way of
recording "a note is about this rectangle", and the tajweed-mark work is itself a study of how
finely this print can be addressed. The comparable practices worth a proper look before this is
settled — how a hafiz marks a slip in a paper mus'haf, and how Tarteel, Figma, document
comments and web-annotation tools handle a marker that hides at low zoom, reveals on hover, and
is coloured by kind — are owed that look and have not had it here.

## What else could be considered, and why is it not here?

- **A free-text journal.** A long note, not a short label. The confusion map's design already
  ruled it out — at most a short optional label, never a journal — because the data cannot see
  recitation and a page of prose over it would claim more than it knows. Kept to a short label
  here for the same reason.
- **Feeding a reader's marks back into the shared hop rail.** Turning one person's private
  slips into navigation everyone sees. That blurs a private log into the public routing table
  and is its own privacy and provenance decision, not a default of this one.
- **A teacher seeing a student's marks.** Useful, and a different question — sending the record
  to another person, not a reader keeping their own. Its own page if it is ever wanted.
- **Shipping the finer mark corpus just to enable letter anchoring.** Left off because it is
  the larger decision option D leans on; this page draws its cost rather than pre-empting it.

## What would change the answer?

- A hafiz saying, after a month with a word-grain note, that they keep wanting to point at one
  letter. That is the measurement that would justify shipping the finer geometry option D needs.
- The finer mark corpus being shipped for another reason — a per-rule tajweed colour, say —
  after which letter anchoring is a rendering change rather than a new payload.
- The confusion map's backup question being settled, which decides the machinery the "note to
  the developers" kind would reuse.
- A real print defect a reader could only report by leaving the app, which would weigh the
  second question toward B.

## What is this not settling?

- How a note is stored, or how long it is kept. That is the private-record machinery, and the
  backup question owns part of it.
- Whether the confusion map and this note layer are one feature or two. They share a grain and
  a privacy stance; whether they share a store is a later question.
- The exact zoom rung the markers appear at, or the colours of the three kinds. Drawn from the
  app's ladder and a first palette; both are tuning, not the decision.
- Anything about the maintainer's own mark-review instrument, which is a separate tool with its
  own record and is not a reader feature.

## So what is being decided?

Two things, in order. First, whether a reader can pin their own note to the page and to what:
nothing (A), a verse (B), a word or a run (C), or a single letter, harakah or pause sign (D) —
where the last reopens the settled choice to ship the page as anonymous shapes. Second, only if
a note layer is added: which kinds there are and whether any leaves the phone — private only
(A), private plus a report the reader sends (B), or everything synced (C). The finer anchor and
the note that leaves the phone are the two the app has already taken a position on, so both are
the owner's to reopen.

## What was decided (2026-09-02)

The owner reopened both positions and answered.

- **What a note pins to — D, the finest spot, and a structural axis the options did not draw.**
  A reader can pin a note to a single mark — a pause sign now, from the mark boxes the word data
  already flags; a letter or a harakah once the finer corpus ships, which the mark-granularity
  decision already committed to *when the geometry exists*, so this inherits that timing rather
  than reopening it. The owner then went past the drawn options: a note should also pin to **a
  whole line, a whole page, and a structural break** — a note about a juz sits on that juz's
  start, a note about a hizb-quarter on its own break. That is a second axis the options page
  (verse → word → mark, all *inside* the text) never drew, and it is the honest gap in this
  decision: *that* these anchor scopes exist is decided; what the marker for a page-level or a
  juz-break note looks like, and where it sits so it does not crowd the text, is a new open
  question, noted below.
- **What kinds, and whether any leaves the phone — C, shareable by default.** Every note is
  aggregated into one client-side file and is shareable rather than sealed to the one phone;
  when a reader can sign in, that file syncs to their own cloud. This takes the
  [storage model](storage-model.md), the same as the bookmarks and the confusion map — so C
  here is not the original "always-on server sync" but the phased model: one local aggregate
  now, the reader's cloud file on sign-in.
- **A fourth kind of note: a question for scholars.** Alongside the comment, the correction and
  the note to the developers, a reader can pin a **question** to a spot — something they want
  answered about the verse, not a mistake they are recording. It is drawn the same way and
  anchored the same way; what makes it its own kind is where it is *meant to go*. The near-term
  build is only the kind and its anchor. The farther aim — that when enough readers pin a
  similar question, a scholar's answer with references can appear against the verse — is a whole
  feature of its own, recorded in the roadmap under *Someday*, not settled here.

**Still open, folded into the building:**

- **The structural-anchor marker.** A note on a line or inside a verse sits in the margin beside
  the text, as drawn. A note on a whole page, a juz's start or a hizb-quarter has no single spot
  in the text to sit beside — so where its marker goes (at the break itself, in a gutter, on the
  page's edge) and how it reads as *about the whole page* rather than one line of it is undrawn,
  and is the first thing the building has to draw.
- **Whether the four kinds share one store and one anchor model** or the question-kind needs its
  own — the anchor is shared; whether a question that is meant to travel to a scholar is kept
  and synced exactly as a private correction is a privacy question the storage model frames but
  does not answer.
