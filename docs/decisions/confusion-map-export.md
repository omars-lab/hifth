# Should a reader be able to copy their confusion map off the phone?

*Status: open. This record states the question and draws the options; it does not choose.*

**The picture:** <https://claude.ai/code/artifact/1d9c4cff-f0a5-4aa3-a70b-2717f0814b1a> — the three
options drawn at phone size, on a sample map that carries verse references only and no scripture.
Checked in as `confusion-map-export.html`, rebuilt by `scripts/build-confusion-export-options.mjs`
from the committed data beside it.

## A few words, defined once

- **Confusion map** — the private record this feature keeps of the exact places one reader's
  memory slips from a verse onto a similar-sounding one. It is built up, slip by slip, over
  months of revision, and it is personal: it is a map of where *this* reader is weak.
- **A slip** — the moment the tongue takes a wrong turn onto a verse that opens the same way.
  Recording one is what fills the map.
- **On the phone only** — the app keeps everything in the phone's own private storage and
  sends nothing anywhere. This is how everything the app remembers works today.

## What is being decided?

Should the confusion map be something a reader can copy off their phone — to keep it safe, or
to move it to a new phone — and if so, by which of two very different means: a file they save
themselves, or an automatic copy to a cloud service?

A reader could answer with one of the options below.

## Why is this being asked now?

Reviewing the feature's walkthrough, the app's owner asked for exactly this: that the map be
durable enough to survive clearing the phone's browser data, "with the option of backing up to
a downloaded file and re-uploading," and — one day, once there is a phone app — saved to the
cloud. That is a direct request, and answering it means first sharpening the stance the app
has leaned on everywhere else — from a flat *nothing leaves the phone* to *nothing leaves unless
it is in the reader's interest, and under their control* (see below). Changing a stance the whole
app rests on is decided in the open, not built quietly.

## What happens if nobody decides?

The map stays on the phone only, and that has a real cost the owner has already named: the map
is the distilled product of months of revision, and the phone can wipe it silently. On one
common phone, a web app that has not been opened in about a week can have its stored data
cleared by the system with no warning and no way to get it back. Installing the app to the home
screen makes that far less likely, but "far less likely" is not "safe," and the whole point of
the map is that a reader comes to rely on it.

Nothing else is blocked behind this. The feature can be built, and used, with the map on the
phone only; this decision changes how well it survives, not whether it works. So it can sit open
without stopping other work — but every week it sits open is a week a reader could lose the map.

## What does the app do today, and what is it costing?

Today the app keeps everything on the phone and offers no way to copy anything off it — no
export, no backup, no sync. That is a deliberate, settled stance for everything the app has
remembered so far, and for good reason: the app has, until now, only remembered things that are
cheap to lose (which page you last had open, which page you pinned). The confusion map is the
first thing the app would remember that is *expensive* to lose. So the stance that was free for
everything before now carries a cost for the first time, and this decision is where that cost
gets weighed rather than inherited.

## What do people outside this project do about this?

**We looked, and here is the honest state of it.** Note-taking and habit apps that hold
personal history almost universally offer *some* way out — an export file at the least, cloud
sync at the most — precisely because users will not trust months of their own data to a single
device. That is evidence that a way out is expected, not that any particular one is right.

The closer reference — how other apps handle a record of *religious practice* specifically — we
did **not** research in depth, and should before settling, because the privacy weight here is
different from a habit tracker's. A record of where a person's memory of the Qur'an fails is
intimate in a way a reading streak is not, and the norms that intimate-health and faith apps
have converged on are the relevant prior art. This record does not claim to have surveyed them.

## What have we already decided that touches this?

Two things constrain the space, and neither is a formal entry in this register — they are
stances written into how the app already works:

- **Nothing leaves unless it is in the reader's interest.** Until now the app has kept everything
  private and local, and that read as a flat rule — *nothing leaves the phone*. The owner has
  sharpened it: the durable rule is not that nothing leaves, but that nothing leaves *unless it
  serves the reader, and stays under their control*. A flat *nothing leaves* breaks the first time
  the reader's own interest points outward — as it does here, where they want their hard-won map to
  survive a lost phone — and once broken it reads as a promise abandoned. Naming the test instead
  keeps the promise: a thing may leave when, and only when, it is in the reader's interest and they
  hold the controls. That reframes this whole decision — the question is not *whether to make the
  first exception to "nothing leaves,"* but *which of these ways of leaving actually serves the
  reader, and at what cost to them.*
- **The cloud option is not reachable soon.** A web page in a browser cannot copy anything into
  a personal cloud like the one built into the phone; that needs a real installed phone app. That
  app is on the long-term plan, but it is held up by a licensing question the project cannot
  answer itself and is waiting on qualified advice for. So the cloud option below is real, but it
  is not something that can ship this year regardless of what is decided here.

That second constraint does most of the work: it takes the heaviest option off the near-term
table on its own, and leaves the near-term choice as *on the phone only* versus *a file the
reader saves*.

## What are the options?

Each is drawn, at phone size, on the published page this record points to —
<https://claude.ai/code/artifact/1d9c4cff-f0a5-4aa3-a70b-2717f0814b1a>. In short:

### Option A — Keep it on the phone only

Change nothing. The map lives in the phone's private storage and never leaves. A reader who
wants it safer installs the app to their home screen, which makes a silent wipe far less likely.

- **Takes:** nothing — this is what the app does today.
- **Gets:** the strongest possible privacy. The map physically cannot leak, because it never
  exists anywhere but the one phone.
- **Costs:** the map can still be lost — to a wipe, a broken phone, a new phone — and when it is
  lost it is lost silently and completely. This is the cost the owner asked to remove.

### Option B — A file the reader saves and restores *(the owner's lean)*

The app grows two plain actions: save a backup, which hands the reader a single file they put
wherever they like; and restore from a backup, which reads that file back. Nothing leaves the
phone unless the reader deliberately saves the file, and it goes only where they choose to put
it — including, if they like, their own cloud drive.

- **Takes:** a modest, self-contained piece of work — turn the map into a file and back — with no
  server, no account, and no change to the app's stay-on-the-phone nature.
- **Gets:** the map survives a wiped or lost phone and moves to a new one, while the reader keeps
  full control of the one copy that ever leaves. The privacy exception is small and reader-driven.
- **Costs:** a saved file is a file — it can be read by anything the reader lets near it, and a
  reader who never saves one is no safer than under Option A. It protects those who use it; it
  cannot protect those who do not.

### Option C — A cloud-sync switch the reader controls

The reader turns on a sync switch; from then on the map keeps a copy in the personal cloud built
into their phone — so it survives a lost phone and appears on every device they own — with tooling
to see and clear what is stored, and the copy reachable through the phone's own Files. The owner's
note is the reason it is drawn as a switch and not as something always on: sync that serves the
reader is sync the reader turned on and can turn off — which is the governing rule above, applied.

- **Takes:** the installed phone app that does not yet exist, and which is blocked on the
  licensing question above — plus the switch, the management tooling, and the Files access that
  keep it under the reader's control. Not reachable this year.
- **Gets:** once switched on, the map is safe without the reader having to remember to do
  anything, and follows them across devices — the strongest protection against loss.
- **Costs:** while the switch is on, an intimate record lives continuously on someone else's
  servers, not only when the reader reaches for it. Making it a switch the reader controls — not
  something on by default — is what keeps it inside the "only in the reader's interest" line; the
  record is still off the phone the whole time it is enabled.

## What else could we consider, and why is it not here?

- **Letting a teacher see a student's map.** A genuinely valuable use — a teacher could drill a
  student exactly where they are weak — and a real pull toward some way out of the phone. It is
  left off this page because it is a *sharing* decision, not a *backup* decision: it sends the map
  to another person, which is a different and larger privacy question than a reader keeping their
  own copy. It deserves its own page if it is ever wanted, and Option B does not settle it (a
  backup file a reader chooses to send a teacher is not the app sharing it).
- **A password on the backup file.** Worth considering as a refinement of Option B, not a rival
  to it — so it belongs in the building of B, not as a separate option here.

## What would change the answer?

- If the closer prior art — how faith and intimate-health apps handle export — comes back saying
  even a reader-saved file is a norm those apps deliberately avoid, that would weigh against B.
- If the licensing question that blocks the phone app were answered in the app's favour, Option C
  would move from "not this year" to a live choice, and the question would become B versus C
  rather than A versus B.
- If real use showed readers almost never clear their phone's data or lose the map in practice,
  the cost of Option A would shrink and doing nothing would look better.

## What is this not settling?

It is not settling teacher-sharing (named above and deliberately held apart). It is not settling
the shape of the backup file, whether it is encrypted, or what it is called — those are the
building of Option B, once B is chosen. And it is not settling anything about the cloud option's
timing beyond "not this year," because that timing is owned by a different, unanswered question.
