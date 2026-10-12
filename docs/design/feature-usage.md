# How often do I use each part of the app?

**Status:** built, device-only. One question is open for the owner: ①, whether the counts from the iPad, the Mac and the phone should be added together.

> [!tip] Short version
> The info panel now has a section, *How you use the app*. It lists every feature you have used, most used first, with how many times, a little strip of the last fourteen days, and the last day you used it.
> It counts on this device only, by feature name only. It never records which verse was open, what a note said, or which commentary was read, and nothing leaves the device.
> Recommended: keep it device-only for now (A). Adding devices together (B) is a small step once you want it, and it needs no server.

## Words used here

- **Feature:** one thing the app does that you can choose to use: turning the page, the similar-verses list, the commentary, a pen, and so on. The full list is below.
- **A use:** one opening. Opening the commentary counts once, however long it stays open. Picking the highlighter counts once, however many passages it then marks.
- **The info panel:** the sheet that opens from the app's name in the top bar, where the settings live.

## What does it change for a hafiz?

Nothing on the page. It is for the owner, to see which parts of the app actually get reached for during a revision session and which are built but never touched.
For the pitch, it is a way to say honestly which features carried a week of real use, rather than guessing.
For any hafiz who opens the panel, it is the same promise the record of what you have opened makes: what is counted is yours, it stays on your device, and one button forgets it.

## What does it count?

| feature | counted when |
| --- | --- |
| Turning the page | the page changes after you have touched the app; where the app opens is not a turn |
| Similar verses | the list opens |
| Commentary | the commentary opens |
| Roots | the roots list opens |
| Listening | a recitation starts from the verse menu or a passage |
| Share | the share card opens |
| Go to | the go-to box opens |
| Zoom | you zoom in past the whole page |
| Verse menu | the menu for a verse opens |
| Word parts | a word's parts open |
| What you have opened | the record's map opens |
| Tajweed colours key | the key opens |
| Choosing the mus'haf | the mus'haf chooser opens |
| This panel | the info panel opens |
| Each pen | you pick that pen |

Two pages side by side was left out on purpose: on a wide screen it is on every visit, so it would only count visits.

## Where is it kept, and who can see it?

In this browser's own storage on this device, one line per day, for 400 days (long enough to compare a month with the same month last year).
The privacy check that guards the record of what you have opened now guards these counts the same way. Only four parts of the app may read them, and none of those can send anything off the device. A new reader of the counts fails the checks before it can be pushed.
iOS can empty a web page's storage after weeks without a visit. The panel says the day counting began, so a list that reads "never" after that can be told apart from one that has been counting for a month.

## Open questions, and what would answer each

### ① Should the counts from my iPad, Mac and phone be added together? · **open**

Today each device keeps its own counts, and the iPad app, the Mac app and the browser each count separately even on the same machine.

| | A. Each device on its own (built) | B. Carry a file between devices | C. Keep them in your own online store |
| --- | --- | --- | --- |
| How | nothing more to do | a *Save the counts* button writes a small file; *Add counts from a file* on another device adds it in | each device sends its counts to a store only you can open |
| Pros | nothing leaves any device; already working | one total across devices; still no server; you choose each time | always one total, nothing to remember |
| Cons | three separate lists for one person | done by hand; a file added twice counts twice unless each file carries its own name | the first thing in the app that sends anything off the device; the privacy check would have to make an exception |
| Implications | none | the file's shape becomes something to keep working; a small test for adding a file twice | reopens the rule that personal records never leave the device; needs its own decision, a sign-in, and a server to keep up |

Recommended: **A now, B when you want one total.** C crosses a line the app has held since the record of what you have opened was built, for a convenience B gets without crossing it.
What would answer it: a week or two of using the app on more than one device, and whether three separate lists turn out to be a nuisance.

## What else could it show?

Built: the list, most used first, each with its fortnight strip and last day; the features never used folded underneath, so they are one tap away and not in the way.
Not built yet, and cheap if wanted: a week-by-week view for one feature; counts split by device kind (phone, iPad, Mac) once B exists; a line for how long a session lasted. The last one is the only one that would count time rather than openings, and it is left out until there is a reason to want it.

## What is this not settling?

Anything about other people's use. There is no sending, no dashboard of everyone, and no plan for one. If the app is ever released, whether to ask its readers for anything at all is its own decision, made then.

## Where it lives

The names and the sums: `apps/web/src/usage.ts`. Where the counts are kept: `apps/web/src/usage-store.ts`. The two ways the app says something was used: `apps/web/src/use-count.ts`. The panel section: `apps/web/src/components/UsageReadout.tsx`. The privacy check: `scripts/gate-revision-privacy.mjs`.
Tests: `usage.test.ts`, `usage-store.test.ts`, the privacy check's own tests, and the browser test `e2e/usage.spec.ts`, which caught the app counting where it opened as a page turn.
