# A reader's own notes: how do they survive, and how does a batch of them leave the phone?

The mistake-marking decision asks whether a reader can keep their own notes on a page —
a short label pinned to a spot, coloured by kind. This record is what comes next if the
answer is yes: those notes are the first thing the app would remember that is *expensive*
to lose, and the desktop triage asked for two things about them the note layer itself does
not settle — that they survive a phone that clears its storage, and that a whole batch can
leave the phone as a file or an email.

It is drawn on real anchors from a real page, so the argument is about a picture anyone can
open:

- **The picture, on the site:** <https://blog.bytesofpurpose.com/hifth/docs/design/notes-export-options.html>
- **The same page, checked in:** [`docs/design/notes-export-options.html`](../design/notes-export-options.html), rebuilt by [`scripts/build-notes-export-options.mjs`](../../scripts/build-notes-export-options.mjs) from page 7's shipped word boxes and the app's design tokens.

This is the export-and-persistence sibling of the confusion map's own export decision. It
borrows that decision's spine — keep it on the phone, save a file, sync to the cloud — and
adds the two things a map of verse references never had to face: an **email** as a channel,
and the question of what a batch **contains** when each note points at a *spot* on a page
rather than at a whole verse.

## A few words, defined once

- **A note** — what the mistake-marking decision would let a reader keep: a short label
  pinned to a spot on a page, coloured by kind (a comment, a correction, or a note to the
  developers).
- **A batch** — all of a reader's notes at once, across pages and verses, as an export or a
  backup would carry them.
- **Durable storage** — the phone's own private store that survives closing the app and
  reloading. It is not a backup: the phone's system can still clear it after about a week of
  the app going unopened, and a lost phone takes it.
- **On the phone only** — the app keeps everything in that private store and sends nothing
  anywhere. This is how everything the app remembers works today.
- **A portable annotation file** — the standard, machine-readable way to record "this note is
  about this rectangle of this page", which the app already reached for once.

## What is being decided?

Two questions, in order, and the second only matters if the first is answered "it leaves".

1. **How does a batch of a reader's notes leave the phone, if at all?** — nothing leaves; a
   file the reader saves and re-imports; an email the reader sends; or automatic cloud sync.
2. **What does an exported batch contain, so it is legible without shipping the Qur'an?** — a
   plain list of references; a list with a small outlined picture of each spot; or a portable
   annotation file.

## Why is this being asked now?

A note is the first thing the app would remember that is costly to lose — the distilled
product of months of revision. The owner has already asked, for the sibling confusion map,
that such a record survive clearing the phone's browser data, "with the option of backing up
to a downloaded file and re-uploading," and one day a cloud copy. The desktop triage asked
the same of marks and comments, and added a channel the map's decision did not draw: an
**email**. Sending a record of where your memory of the Qur'an slips is a bigger privacy step
than saving a file, so it is put on the page as its own option rather than assumed into the
file one.

## What happens if nobody decides?

If notes are kept at all, they sit in the phone's durable storage and go nowhere. That works
today — but the phone can clear that storage after roughly a week of the app going unopened,
and a lost phone loses everything. Nothing else is blocked behind this: notes can be made and
used with no export path at all. The cost of leaving it open is exactly the cost the confusion
map's export decision already names — a reader who trusts the record and then loses the phone
loses the record — and it is the same size here.

## What does the app do today, and what is it costing?

Nothing is kept yet, because the note layer itself is not built. When the app *does* remember
something — where you are in the book, what you have marked as confusing — it keeps it in the
phone's private store and sends it nowhere. So the status quo this decision inherits is option
A of the first question: durable-on-the-phone, no way out. Its cost is measured not in
milliseconds but in the one failure it cannot survive — a phone that clears its storage, or is
lost, takes the notes with it, and there is nothing the reader could have done in advance.

## What do people outside this project do about this?

**A fresh external scan was not done for this page.** Note-taking and habit apps almost
universally offer a way out — a file at the least, cloud sync at the most — which is evidence
that a way out is *expected*, not that any one shape of it is right. The closer reference —
how apps that hold a record of religious practice specifically handle export, and who a batch
is shown to — is the relevant prior art and is owed a proper look before this is settled. The
confusion map's own record flags the same gap; neither should be marked decided on the
strength of general note-app convention alone.

## What have we already decided that touches this?

- **Whether a reader keeps notes at all is itself still open** — the mistake-marking decision
  ([what a note can be pinned to](mistake-marking.md#what-can-a-reader-pin-their-own-note-to),
  [what kinds of note there are](mistake-marking.md#what-kinds-of-note-are-there-and-does-any-leave-the-phone)).
  This page only matters if a note layer is added, and it inherits the kinds from there.
- **The confusion map's own export is an open decision with the same spine** —
  [keep it on the phone, a file, or a cloud switch](confusion-map-export.md), the owner leaning
  toward the file. This page is the sibling for reader-authored notes; it adds the email
  channel and the question of what a batch *contains*, which the map (verse references only)
  never had to answer.
- **Nothing leaves unless it is in the reader's interest, and under their control** — the
  stance the app is sharpening from a flat "nothing leaves the phone". A file and an email both
  pass that test only as a deliberate, off-by-default act.
- **A private record stays private by construction** — the revision record's privacy is a gate,
  not a good intention. An export path is exactly the "one convenient import away" that gate
  exists to refuse, so it is built as a deliberate door, never a reflex.
- **The app ships no Qur'an text** — every shipped file is checked for it. An export that
  carries a picture of the print carries outlined shapes only, kept honest by the same guard
  these design pages use.
- **A note is about a rectangle of a page** — the [comparison-crop decision](comparison-crop.md)
  already reached for the standard annotation shape to record which region a comparison covers.
  A machine-readable export is that same shape.

## How does a batch of a reader's notes leave the phone?

Each option below is drawn on the picture linked at the top, on three real notes across verses
2:38, 2:44 and 2:48 of page 7 — one of each kind — at phone size. This question runs from the
private default to the automatic copy the rest of the app avoids; a file and an email are both
a deliberate tap, and what separates them is that an email travels through a mail provider.

- **A — Nothing leaves: durable on the phone only** *(what the status quo would give)*. The
  strongest privacy — a record of where a reader's memory slips cannot leak, because it never
  leaves the one phone — but the phone can still evict the storage, and a lost phone loses the
  lot.
- **B — A file the reader saves and re-imports** *(the owner's lean, matching the confusion
  map)*. A backup that survives a wiped phone, entirely in the reader's hands, touching no
  server. Its cost is that the reader has to remember to make it; nothing reminds them.
- **C — An email the reader sends.** A backup and a way to show a teacher, with no new storage
  for the app to hold. But an email passes through a mail provider on its way — a bigger
  privacy step than a file that stays on the phone — so what it carries (the second question)
  matters most here, and it should never be the default.
- **D — Automatic cloud sync.** A backup with no reader effort, and the same notes on every
  device — but it needs a phone app and an account that do not exist yet, and it crosses the
  privacy line the app rests on. Blocked, and drawn for the edge of the space.

## What does an exported batch contain, so it is legible without the Qur'an?

This is the question the confusion map never had to answer, because it only ever carried verse
references. A reader's note points at a *spot*, so an export has to say where the spot is
without putting the print's words in the file. Three ways, each drawn as the reader would see
it before sending.

- **A — A plain list of references.** Each note as its verse, its kind and the reader's label,
  in words. The smallest and most private export, but it cannot show *where* on the page the
  note sits; the reader opens the app to place it.
- **B — A list with a picture of each spot.** The same list, each note carrying a small
  outlined picture of the exact spot — the way these design pages draw the print. Legible on
  its own, so a teacher can see the spot, while still shipping no scripture, only outlined
  shapes. A larger file, and the no-Qur'an-text rule has to be kept by the same guard these
  pages use.
- **C — A portable annotation file.** The standard machine shape for "a note about this
  rectangle of this page", the same selector the comparison decision reached for. The most
  interoperable, and the least human-readable — it answers the backup question but not the
  show-a-teacher one, so it is offered alongside a readable shape, not instead of one.

## What else could we consider, and why is it not here?

- **Printing the batch.** A paper list for a teacher — a print stylesheet over the second
  question's option B, really, not a separate destination. Left off until the readable file
  exists to print.
- **Sending straight to a teacher's account.** A share between two people's apps, which is a
  different decision about identity and consent, not a reader backing up their own record.
- **One combined export with the confusion map.** Tempting, since both are private reader
  records — but the map is auto-recorded and these are authored, and merging their decisions
  would hide that difference. Kept as siblings that link, not one page.
- **An always-on local backup to a second file.** Belt-and-braces durability with no reader
  effort; a refinement of the first question's option A once the phone-only tier is chosen,
  not a separate answer.

## What would change the answer?

- The confusion map's export decision landing on a file — this one would follow it for
  consistency, and the contents question would carry straight over.
- A reader saying they revise with a teacher, which weighs toward the email channel and the
  readable, thumbnailed shape over the plain list.
- A phone app with accounts arriving, which is what unblocks the cloud option.
- The offline store being taught to keep authored text durably, which every option here
  assumes and none of them builds.

## What is this not settling?

- Whether a reader keeps notes at all. That is the mistake-marking decision; this one is
  conditional on it.
- How the confusion map exports. Its own open decision — this page only borrows its spine and
  says where it differs.
- Exactly how long the phone keeps a note before eviction, or the file's name and extension.
  Tuning, not the decision.
- Any sharing between two people. Every option here is a reader moving their *own* record;
  showing it to someone else is a separate question.
