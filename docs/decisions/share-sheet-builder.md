# When you share a verse from a phone, what should the app ask, and which links should it hand you?

*Status: decided 30 September 2026 by the owner: **C**, the tray with one question first.
The owner chose it from pictures of all three trays open on a phone, with one condition: **the
verse being shared stays in sight.** In those pictures C's tray rose over most of a verse low
on its page, so the reader was asked what to send with the verse hidden behind the asking. The
page now moves the verse up clear of the tray, the way it does for the commentary note, and a
browser test holds it there. C is what the app shows; A and B stay on the decision page, still
tryable by their address, as the rule on losing options asks.*

**The page:** <https://blog.bytesofpurpose.com/hifth/docs/design/share-sheet-options.html> —
`share-sheet-options.html`, checked in and rebuilt by `scripts/build-share-sheet-options.mjs`.
It draws nothing: it mounts the real app three times at phone size, one shape each, picked by
`?share=a|b|c` in the app's address. It carries no Qur'an text.

## A few words, defined once

- **Website link** — an ordinary web address; anyone with a browser can open it.
- **App link** — an address that opens the Mac and iPad app itself, on the verse it names.
  A phone's share sheet may refuse it, so the app copies it to the clipboard instead; inside
  the Mac and iPad app the app's own share sheet takes it.
- **Look-alikes** — verses that resemble this one closely enough to be confused with it
  while reciting from memory.
- **Roots** — the three-letter stems the verse's words are built on.
- **The contract page** — the page on the site that describes every address the app
  answers, with a builder that writes one by hand. Its link is in the record's body below.

## What is being decided?

What the Share button does on a phone: whether it hands over one link or two, and whether it
asks what the link should open when it arrives. Only the sheet: the address grammar the
links use is already settled and the same for every caller.

## What does it change for a hafiz?

A hafiz mid-revision who wants to show a teacher, or a student, exactly what they are looking
at. Today the link opens the verse and stops; what to look at next has to be said in words.
With C the link can open the verse's look-alikes or its roots as it arrives, and it can open
the app on an iPad rather than a browser tab. With A nothing changes. With B the app link
arrives but the "what to open" still has to be said in words.

## Why is this being asked now?

Because the app now has two kinds of link and one button. On 2026-09-29 the owner decided
that the link builder belongs in the share sheet as well as on the contract page (question 2,
option B, in `docs/design/app-links-editions-and-builder.md`). The contract page's builder
shipped that day; the sheet still wrote one website link. This closes that gap and asks the
one thing the page could not settle on its own: what a sheet the size of a thumb should ask.

## What happens if nobody decides?

The app keeps showing C. A and B stay reachable only by their address. Nothing breaks.

## What did the app do before, and what did that cost?

One tap on Share put the website link into the phone's share sheet, or copied it. There was
no way to get an app link from the phone at all: the only builder was on the contract page,
on a computer. And a link could not say what to open on arrival, though the address grammar
has carried `open=` since the contract page shipped. The cost was that the one place a reader
actually has a verse in hand, the phone, was the one place a full link could not be written.

## What do people outside this project do about it?

Reading apps with a share button (Apple Books, Kindle, the Quran apps the owner uses) hand
over one link or a quote and ask nothing. Apps with two kinds of link (a web link and a
deep link into the app) mostly write one universal link that does both, which needs a paid
developer membership this project does not yet have; that is its own row
(`native-testflight-licence`). **I did not look further** than the apps already on the
owner's phone, because the sheet's question is about this app's panels, which no other app
has.

## What have we already decided that constrains it?

- The address grammar (`docs/design/app-url-scheme.openapi.json`) is the one contract; a
  link the sheet writes must be one the Mac and iPad app accepts. The unit test runs each
  link the sheet writes through the same rules the contract page's builder uses.
- The verse's tools live in one drawer at the bottom of a phone (`ayah-drawer`). The share
  button is in it, so the sheet opens from there and sits over it.
- A losing option stays reachable by its address rather than being deleted, the way the
  phone toolbar's did (`phone-toolbar`, `graduation-losers`).
- The public site carries no held text. The commentary panel is offered on the sheet only in
  the private pitch build, where the panel exists.

## The options

Each is built into the app and mounted live on the page. Pros, cons and what each commits us
to are on the page beside its frame.

- **A. One tap, the website link.** The sheet as it was. One tap, nothing to read; no app
  link, no say in what opens.
- **B. Two links, no questions.** A small tray with two buttons: the website link (shared),
  the app link (copied). The app link reaches the phone; still no say in what opens.
- **C. Two links, and what the link opens.** The same tray, with one question above the
  buttons: the verse as it is, its look-alikes, its roots (and in the pitch build, the
  commentary). The plain link is still two taps.

**Recommendation:** C. It is the only one where a teacher can send a student straight to a
verse's look-alikes without typing an address, and a reader who wants the plain link is not
slowed down.

## What else could be considered, and why is it not here?

- **One universal link that does both.** The website address, registered with Apple so the
  app claims it when installed. Needs the paid membership; its own row.
- **Asking whether to tell another app back.** The contract page's builder asks this ("tell
  nobody / tell this app"). A share sheet is handing a link to a person and cannot know which
  app, if any, will want telling. Left on the contract page on purpose.
- **A range or a trail with a panel.** A highlighted passage is shared without the question:
  the panels are about one verse. A trail keeps its walk and the panel opens on the verse at
  its end.

## What would change the answer?

A phone share sheet that accepts the app link would make the "copy" button a "share" button
and shrink the difference between B and C to the question alone. A universal link would fold
the two links into one and leave only the question, which is C with one button.

## What is this not settling?

Not which panels a link may open; that is the address grammar's list. Not universal links or
the paid membership. Only what the Share button asks and hands over on a phone.

## Where is the code?

`apps/web/src/share-links.ts` writes the two links and reads the shape from the address;
`apps/web/src/components/ShareSheet.tsx` is the sheet. `apps/web/src/share-links.test.ts`
holds each written link to the contract; `apps/web/e2e/share-sheet.spec.ts` sends a link
from each shape on a phone. The contract page is `docs/design/app-links-editions-and-builder.md`.
