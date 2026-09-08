# Now that the app holds a copy of the outside library, what is that copy for?

**Status:** decided — **B**, on 2026-09-07. **Decided by:** omar. This record follows the
boundary drawn in [When the app leans on the outside library, does it copy or only measure?](qul-reliance.md);
that one settled *whether* a copy may be held, and this one settles *what the held copy is for*.

## A few words first

*Mus'haf* — a printed copy of the Qur'an; the app shows real printed pages. *Verse* — one ayah.
*Word-by-word* — the text broken into single words, each in its own place, the way a page of the
Qur'an is actually set. *Look-alike verses* — the *mutashabihat*: verses that share a run of
words with another, the thing a haafiz most often mixes up. *The outside library* — the Quranic
Universal Library (qul.tarteel.ai), a public collection of Qur'an datasets. *The held copy* — the
copy of some of that library, kept in a database this project owns, off the repository and out of
what the app ships, which the earlier decision allowed.

## What is being decided?

The earlier decision said a copy of the outside library *may be held* in a database this project
controls. It deliberately did not say what the copy is for — only that holding one is allowed and
what holding it obliges.

So now: what work is that copy meant to do? Three answers pull in different directions. It could
be a **feeder** — numbers only, there to sharpen the look-alike-verse feature the app already
has, and nothing more. It could be a **second draughtsman** — enough of the library (its
page plan, its word text, its fonts) that the app can *draw its own word-by-word page of the
Qur'an*, set the same way a printed mus'haf is, and stand that drawing next to the printed page
the app already shows, to check that our page is right. Or it could be **held-and-undecided** —
keep the numbers now and choose the bigger question later.

## Why is this being asked now?

The library has just been crawled and its pieces fit together cleanly: the page plan says which
words sit on which line, and the word text supplies those words, and the two line up with no
gaps. That means drawing our own page is now *possible*, not just imaginable — and the moment a
thing is possible, someone has to say whether it is wanted, before a build script decides it by
being the path of least resistance. The look-alike work also needs the numbers regardless, so at
least the feeder use is already owed. The question is whether to stop there.

## What happens if nobody decides?

The held copy gets filled with whatever the next ingest script happens to pull, and its purpose
is read backwards from that later — which is how a store meant to check our pages quietly becomes
a store the app draws its shipped pages *from*, crossing back over the line the earlier decision
was careful to hold. Naming the purpose now is what keeps the copy on the building-tools side of
that line on purpose.

## What does the app do today, and what is it costing?

Today the app shows the mus'haf as **outlined artwork** — the printed page drawn as shapes with no
letters in them — and everything else it carries is numbers. It has no way to render a page from
text, by design, so it also has no independent way to *check* that the artwork it ships is
registered correctly: that the page it shows for a given verse really is that verse's page, that
a line break falls where it should. Checking that today means a human holding a printed mus'haf
against the screen. What it costs: page-registration mistakes are exactly the kind that hide —
the artwork looks like a page whether or not it is the *right* page — and there is no second
witness in the building tools to catch one.

## What do people outside this project do about this?

Looked. The other Qur'an apps (quran.com, Tarteel, the common mobile mus'haf apps) render their
pages *from* the library's text and fonts — so their "draw a word-by-word page" is not a checking
tool, it is the product itself, and they never face this question because the drawn page is the
thing they ship. The printed publishers proof a new mus'haf edition by laying it beside a trusted
one, page for page — which is exactly the side-by-side check option B builds, only done by hand
on paper. That print practice transfers; the app conventions do not, because this app's shipped
page stays artwork and the drawn page is only ever a witness against it.

## What have we already decided that touches this?

- **Whether a copy may be held at all** ([qul-reliance](qul-reliance.md), option D): the parent
  of this decision. It allows a held copy for the building tools and forbids that copy leaking
  into the repository or the shipped bundle, and it insists each item's licence is read before it
  is held. Everything below stays inside that; option B does not ship the drawn page, it draws it
  for the tools to look at.
- **Taking in the look-alike numbers** ([similar-ayah-enrichment](similar-ayah-enrichment.md)):
  the numbers-only use of the held copy is the same body of work seen from the feature side. This
  decision says the store does that *and* more; that one decides the shape of the look-alike
  feature itself.
- **The standing rule that this repository ships no Qur'an text.** The drawn page is made of the
  library's word text and fonts, which *are* Qur'an text — so the drawing lives only in the
  building tools and the held store, never in the repository and never in what the app ships. Any
  option that put the drawn page into the shipped bundle would be the separate display question,
  not this one.

## The options

**A — Only sharpen what we already print.** Hold the library's numbers — which words make two
verses look alike, which verse sits on which page — and use them only to enrich the look-alike
feature. Draw no page of our own. *Cost:* leaves the page-registration blind spot exactly where
it is; the building tools still have no second witness that a shipped page is the right page.

**B — Draw our own word-by-word mus'haf, keep the printed page as the default, and stand the two
side by side to check our pages — and hold the numbers too.** Hold enough of the library (its
page plan, its word text, its fonts) that the building tools can draw a word-by-word page set the
way a printed mus'haf is, and place that drawing beside the outlined-artwork page the app ships,
to confirm our page shows the right verse in the right place. The drawn page is a checking
instrument for the building tools; the printed artwork stays what readers see. Also hold the
look-alike numbers and the page facts, so option A's benefit is included, not traded away.
*Cost:* the held copy now carries word text and fonts, not just numbers — so more items' licences
must be read and recorded before they may be held, and the project takes on maintaining a second
way of drawing a page whose only job is to check the first.

**C — Hold the numbers now, decide the drawing later.** Do option A today, and keep option B as a
question for when the look-alike work is done. *Cost:* the page-registration check keeps waiting;
and the licence reads that B needs get put off rather than done, so the day the check is finally
wanted it is still blocked on the same upstream terms.

**Decided (2026-09-07): B.** The held copy is both the feeder for the look-alike numbers and the
source for a word-by-word page the building tools draw and stand beside the shipped page to check
it. The printed artwork remains what readers see; the drawn page never ships.

## What else could be considered, and why is it not here?

Shipping the drawn page to readers as a real text mus'haf — not here; that is the separate display
question the parent decision explicitly left open, and it would put Qur'an text into the shipped
bundle, which this decision does not do. Drawing the page from the library's fonts but not holding
the word text (drawing from letters alone) — not a real option, because a word-by-word page needs
the words; there is nothing to place without the text. Building the side-by-side check as a
throwaway script that reads the library from a scratch folder each run instead of a held store —
rejected because the check is meant to be run again and again as our pages change, and the parent
decision already chose a held store over re-reading a scratch folder for exactly that reason.

## What would change the answer?

If the licence read on the page plan, the word text, or the fonts came back as *may not be held*,
that item drops out of B and the drawn-page check is built only from whatever cleared — possibly
falling back to A for anything blocked. And if the project ever decided readers should receive the
drawn text, that is not a change to this decision — it is the separate display question, gated on
clearing each item's licence to *ship*, not merely to hold.

## What is this not settling?

It does not settle whether any reader ever sees the drawn page — they do not, under this decision;
that stays the parent's open display question. It does not settle the individual licences of the
page plan, the word text, or the fonts; those are read and recorded item by item, and until each
is cleared that item is not held. And it does not settle exactly how the side-by-side check is
shown to whoever runs it — that is a matter for the tool, decided by building it, not on this page.

---

*The picture:* the pieces of the outside library, how they join, where their keys line up and
where they do not, and what each one is for, are drawn in the ETL join map at
`docs/design/qul-data-join-map.html` — served on the app's own site once merged, at
`https://blog.bytesofpurpose.com/hifth/docs/design/qul-data-join-map.html`. The same join drawn
as one full entity diagram, every box and every row count, is `docs/design/qul-data-erd.md`.

*Where this lives in the code:* the held copy is reached through the Supabase command-line tool
(project ref `zbkqfstkjmgzsrraodez`) and populated by the ingest step on branch
`qul-etl-supabase` (off `qul-integration`); its source inputs stay in a gitignored `.cache/` so
nothing lands in the tree. The word-by-word page is drawn from the digital-khatt 15-line layout
(library id 21) and the QPC V4 word text (library id 47), with the surah-name and Nastaleeq fonts
(library ids 457 and 462); the look-alike numbers are the matching-ayah set. The map node
`qul-store` in `docs/map.json` points at the ingest script and the two store migrations. The
no-text guarantee `gate:scripture` / `gate:notext` reads here as *the repository and the shipped
bundle carry no Qur'an text* — the drawn page and its fonts live only in the held store and the
building tools. The per-resource licence reads owed before the layout, the word text and the
fonts may be held are the human checks in `docs/validation/ledger.json`; per-item attribution is
recorded in `SOURCES.md`.
