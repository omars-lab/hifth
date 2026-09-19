---
name: design-iterate
description: The build-to-choose loop for a design question whose answer is felt, not read — implement each option (A, B, C … N) as an interchangeable live component on one decision page, render it with Playwright, look at the actual pixels, and iterate before anyone picks. Use when a choice differs in something a still picture cannot settle (where a panel opens, how a control snaps, whether something covers the thing it is about), when building or revising an options page under docs/design, or whenever you catch yourself writing a pros-and-cons list before anything is built.
---

# Iterating a design by building it

This is the step between framing a question and recording its answer. The `issues` and `decide`
skills own those ends; this owns the middle, where a felt choice is *built so it can be chosen by
hand* rather than argued on paper.

It exists because of two things the repo already believes, said in one place:

- **A felt difference is built, not drawn** (CLAUDE.md, and the `decide` skill). Some options
  differ in something no still picture carries — where a drawer opens, whether it covers the verse,
  a snap when you let go. Those are built as interchangeable components, one per option, mounted
  live, and chosen by doing.
- **A rough build discovers what an upfront list of pros and cons cannot** (CLAUDE.md). The
  considerations that decide a feature are usually the ones no list had a row for. You find them by
  building the rough thing and *looking*, not by thinking harder before you start.

So the loop is: **frame → implement → preview → review → iterate → decide.** The discovery happens
in *review*; everything else is in service of getting there fast.

## The loop

### 1 · Frame — name the options you can already see
List the options you can see now — `A` is almost always the status quo (the thing to beat), `B`…`N`
the alternatives. Do **not** try to enumerate every pro and con first; that list can only hold what
you already thought of. Name them, mark which differ in something *felt*, and move to building.
Where a real question is being decided, this is also a `decide` record — write the record's shell,
but let the live page fill in the pros and cons afterwards.

### 2 · Implement — one page, every option as an interchangeable component
Build a single decision page at `docs/design/<slug>-options.html`, with each option behind one
shared frame so the reader flips between them with a control (`OptionA` … `OptionN` — a segmented
button, a toggle). Rules that keep the page honest and publishable:

- **Real data, real art, real size.** Draw on the actual pages the app ships
  (`../../apps/web/public/assets/pages/hafs-kfqc/<page>.svg`, referenced relatively so the page
  opens from a clone), at the size a reader really uses. A mock cannot surprise you; the surprise
  is the whole point. Verse geometry to make regions tappable is in
  `apps/web/public/assets/words/hafs-kfqc/<page>.json` (`[x,y,w,h]` boxes in the page's 235-space).
- **Self-contained.** Full HTML document, inline CSS and JS, no CDN and no runtime `fetch` (it
  fails from `file://`); inline any small data you need. Vanilla JS is enough for most; use the
  app's own components only when the feel depends on them.
- **Public-safe.** The page is served from the site the moment it merges (see CLAUDE.md → "Every
  design is public"), so it carries **zero Arabic codepoints and no held copy** — the vendored art
  is outlined paths, and related-verse / commentary content on the page is a stand-in that shows
  the shape, not the scripture. Verify, don't assume.
- **Opens doing something.** Select a real verse on load so the first frame shows the feature at
  work, not an empty shell.

### 3 · Preview — render it with Playwright and capture every state
Look at the running thing, not the source. Two ways in:

- **The app itself** (a change already wired into the app): the `run-app` skill's driver,
  `make drive HASH=… ACT=… EXPECT=… OUT=…` (`apps/web/e2e/tools/drive.mjs`) — deep-link a state,
  run a short action list, write a PNG.
- **A static options page** (`docs/design/<slug>-options.html`): a short headless screenshot
  script. Playwright resolves `@playwright/test` only from inside the workspace, so put the temp
  script where the driver lives (`apps/web/e2e/tools/`), point it at `file://…/<slug>-options.html`,
  click each option/screen control, screenshot each state, and **delete the temp script after**.
  Node is `v22.22.3` (`export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`; matches
  `.nvmrc`). Capture *every* option and both the wide spread and the phone/one-page view — the
  options that share a shape on a phone often diverge only on the spread, and that is a cost worth
  seeing.

### 4 · Review — open the PNGs and write down what you saw
This is the step the whole loop is for. Read each screenshot with your own eyes. Say what the
picture shows that the plan did not predict — that is the discovery. (Worked example below: an
82%-wide same-leaf panel turned out to *cover* the verse it is about at true leaf size, a cost no
paragraph had named.) Record it on the page's own "what would change the answer" / "what to feel
for" section and, if it changes the shape of an option, in the `decide` record.

### 5 · Iterate — fix what the render showed, re-render
A two-way door: editing a local page and re-screenshotting is cheap and reversible, so just do it —
no need to ask. Loop 3–5 until the options are each honestly the best version of themselves (no
option written to lose). Then stop; the choice is the owner's.

### 6 · Decide — put it in front of the owner, then record
Hand the owner the live page and let them pick by doing. Record the choice with the `decide`
skill: the winning component **graduates into the app**, the losers are **deleted**, and the row in
`docs/decisions.json` names the options page as both its `artifact` (the site address) and its
`page` (checked in). Nothing was throwaway that the choice did not need.

## Where this sits in the lifecycle

```
issues / decide (frame the question)
        ↓
design-iterate  ← you are here: build the options, render, look, iterate
        ↓
decide (record the answer; winner graduates, losers deleted)
        ↓
testing (hold the winner still: e2e / golden)
```

It is not for every change. A choice that is purely structural or policy — which of two labels a
page carries — can be drawn or just decided; skip straight to `decide`. Reach for this loop when a
reader could be **wrong** about an option from a picture and **right** about it from a hand on it.

## Worked example — the one to copy

`docs/design/ayah-drawer-options.html` — where should a verse's drawer open? Four options behind
one frame (A scattered / B bottom-always / C same-leaf / D other-leaf), a wide-vs-phone toggle,
drawn on the real al-Fātiḥah spread with tappable verses from the app's own word geometry. Built,
rendered in every state, and the render found the nuance (C covers the verse) that sent the
question back to the drawing. Its written record is `docs/design/ayah-drawer.md`.

## What this skill will not do

- **Let you skip looking.** A screenshot you did not open is not a review.
- **Let a felt difference be settled in prose.** If it is felt, it is built and tried.
- **Publish scripture or held copy to a public page.** Zero Arabic codepoints; stand-ins only.
- **Leave the temp render script in the tree.** It is a one-off; delete it.
