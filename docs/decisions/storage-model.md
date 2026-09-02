# Where does a reader's own record live, and when may it leave the phone?

**This is a living record. It holds a stance the whole app is coming to share; append to it as
each feature adopts it, and do not summarise it away.**

Three separate questions arrived at the same answer within a week of each other — where a
bookmark is kept, how a batch of notes leaves the phone, whether a confusion map can be copied
off it. Rather than answer the same thing three times and let the three answers drift, this
record states the model once, and the three point at it. It is the shape every private reader
record now takes.

## A few words, defined once

- **A reader's own record** — anything the app remembers *for* one reader: where they are in
  the book, the pages they pinned, the notes they wrote, the map of where their memory slips.
  Not the app's own code or the print, which everyone shares — the part that is theirs.
- **The phone's own store** — the private storage a browser keeps on the one device. It
  survives closing the app and reopening it, but it is not a backup: the phone's system can
  clear it after about a week of the app going unopened, and a lost phone takes it.
- **Signing in** — the future point at which a reader has an account. There is no account today;
  the app runs entirely in a browser with nothing behind it. This record says what changes on
  the day there is one, so the features built before it are built to expect it.
- **The reader's own cloud file** — once signed in, one file per reader, held on the project's
  hosted storage, that is theirs: they can see it, clear it, and carry it between devices.
- **Written all at once** — the file is replaced as a whole each time the reader changes
  something, not edited in place field by field. A half-written record is never a state the
  reader can be left in.

## What is being decided?

Not *whether* a reader's record can leave the phone — the app has settled that it may, when it
serves the reader and stays in their hands. What this settles is the **shape** of that, the same
shape for every such record:

1. **Today, with no account:** the record lives in the phone's own store, and the reader can
   save it to a file and load it back. Nothing leaves the phone unless the reader saves it.
2. **On the day there is sign-in:** the same record also keeps the reader's own cloud file,
   written all at once whenever the reader changes something, so it survives a lost phone and
   follows them across devices. It is theirs to see and clear.

The near-term half is buildable now; the cloud half waits on an account that does not exist yet.
A feature adopts this by keeping its record in the phone store today and leaving room for the
file to sync when the account arrives — not by inventing its own answer.

## Why is this being asked now?

Because three features asked it at once, and the app's owner gave the same answer to each: start
on the phone, add a saved file, and — once a reader can sign in — give them their own cloud file
that updates whenever they change a setting. Left un-unified, that would be three subtly
different persistence stories to build and keep honest. Named once, it is one story the three
features share, and a fourth will inherit it without re-deciding.

## What happens if nobody holds to it?

Each feature answers persistence on its own, and the answers drift — one keeps a bookmark only in
the address, another syncs notes always-on, a third saves a file with a different shape. A reader
who trusts one to survive a cleared phone and another not to is a reader who has been surprised,
and surprise about where a private record went is the worst kind. Holding the model in one place
is what lets a reader learn it once.

## What have we already decided that touches this?

- **Nothing leaves unless it serves the reader, and stays under their control** — the stance the
  app sharpened from a flat *nothing leaves the phone*. Both halves of this model obey it: the
  saved file is a deliberate act, and the cloud file is the reader's own, off until they sign in.
- **A private record stays private by construction** — the revision record's privacy is a gate,
  not a good intention. The cloud file passes through the same gate: it is the reader's, not a
  feed to anyone else.
- **The cloud half needs an installed account the project does not have yet** — noted in the
  [confusion map's export decision](confusion-map-export.md), and blocked there on the same
  licensing question the phone app waits on. So the cloud half of this model is real but not
  this year, and every feature adopts the phone half first.

## The features that adopt this model

Each keeps a reader record, and each now takes this shape rather than its own. The row belongs
here because the model is one thing; the *reason each record is private* belongs in that record.

| record | what it keeps | how it adopts the model |
|---|---|---|
| [Where a bookmark is kept](bookmark-fold.md#where-is-a-bookmark-kept-so-tapping-the-fold-still-means-something-next-week) | the pages a reader pinned, each named | phone store now, saved file, own cloud file on sign-in — decided the store that can be carried off the phone |
| [How a batch of notes leaves the phone](notes-export.md#how-does-a-batch-of-a-readers-notes-leave-the-phone) | the notes a reader wrote, pinned to spots | phone store now, a saved file and an email the reader sends; automatic cloud sync on sign-in |
| [Whether a confusion map can be copied off the phone](confusion-map-export.md) | where this reader's memory slips | phone store now, a saved file the reader restores; the file lives in the reader's cloud on sign-in |
| [What kinds of note there are, and whether any leaves the phone](mistake-marking.md#what-kinds-of-note-are-there-and-does-any-leave-the-phone) | the notes, aggregated into one file | one client-side aggregate now, synced to the reader's cloud on sign-in |

## What would change the model?

- The sign-in question being answered against an account at all — in which case the cloud half
  is replaced by whatever a reader's own cloud drive can hold, and the file shape carries over.
- A feature whose record is genuinely shared between people, not one reader's own — teacher and
  student, say. That is a different decision about identity and consent, and it does not adopt
  this model; it starts its own.
- The phone store proving durable enough in practice that readers never lose a record — which
  would weaken the case for the file, though never for the cloud copy that crosses devices.

## What is this not settling?

- The exact bytes of any file, or the fields a given record carries. Each feature's own record
  and its export decision own that.
- Anything shared between two readers. Every record here is one reader's own.
- The timing of sign-in beyond "not this year," which is owned by the licensing question the
  phone app waits on.
- Merging the records into one store. They share a *model*, not a file; whether a bookmark, a
  note and a map ever live in one place is a later question, kept apart because they are pinned,
  authored and recorded respectively, and hiding that difference would cost more than it saves.
