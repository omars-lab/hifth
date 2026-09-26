/**
 * The front door — an index of the indexes.
 *
 * Four registers now each answer their own question about this project: what
 * the app does (docs/map.json), what has been decided and how (docs/decisions.json),
 * what has been published (docs/artifacts.json), and what a person still has to
 * check by hand (docs/validation/ledger.json, described but not drawn here).
 * Nothing pointed a stranger at all four from one place, so someone handed a
 * single link had no way to find the running app's own shape, or the five pages
 * that were built to make a design call, or the four pages that were published
 * and belong to nothing.
 *
 * THIS PAGE RESTATES NOTHING IT DOES NOT HAVE TO. The decisions themselves —
 * the timeline, the arcs, the options, the shelf of every published page — are
 * already drawn once, well, at docs/design/decision-board.html, and this page
 * links out to it rather than drawing a second, thinner copy of the same
 * picture. Same rule as every other register in this project: an index points,
 * it does not paraphrase.
 *
 * WHAT THIS PAGE ADDS that the decision board does not: the running app itself,
 * named feature by feature from the map the codebase is oriented by, sitting
 * beside the pages that argue about its details — so a reader can see, in one
 * place, that "the thing being decided" and "the thing that does the deciding"
 * are drawn from two different registers that happen to describe one project.
 *
 *   node scripts/build-experience-atlas.mjs
 *
 * One copy, not two: nothing here is an inlined image or an external asset, so
 * the checked-in file is the same bytes handed to the publish.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { readDecisions } from "./decisions.mjs";

const OUT = join(ROOT, "docs/design/experience-atlas.html");
const MAP_PATH = join(ROOT, "docs/map.json");
const ARTIFACTS_PATH = join(ROOT, "docs/artifacts.json");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "select-an-ayah" → "Select an ayah" — words a stranger reads, not a lookup key. */
const asWords = (id) => {
  const w = id.replace(/-/g, " ");
  return w.charAt(0).toUpperCase() + w.slice(1);
};

/*
 * Two feature ids carry this project's own plumbing words rather than a
 * reader's — "skin" and "a11y" are exactly the shorthand CLAUDE.md's tenet
 * asks to keep out of a heading a stranger has to read cold. The `what` field
 * beside each is already clean; only the card's own title needs the swap.
 */
const TITLE_OVERRIDE = {
  "editions-and-skins": "Editions and colouring",
  a11y: "Accessibility",
};

/* ── The app itself ──────────────────────────────────────────────────────────
 * Every feature the map orients a newcomer with, minus the ones that describe
 * how the project checks its own work rather than what a reader sees on a
 * screen — those are the "instrument" section below, once, not scattered
 * across two.
 */
const map = JSON.parse(readFileSync(MAP_PATH, "utf8"));
const appFeatures = map.features
  .filter((f) => f.layer === "L1 core" || f.layer === "L2 web")
  .map((f) => ({ id: f.id, title: TITLE_OVERRIDE[f.id] ?? asWords(f.id), what: f.what }));

/* ── Pages used to make a design call ────────────────────────────────────────
 * Every row in the decision register that has something to look at — read the
 * same way docs/design/decision-board.html reads it, so the two can never
 * quietly disagree about which rows qualify.
 */
const decisions = readDecisions().filter((d) => d.page);

/* ── Published pages with no home yet ────────────────────────────────────────
 * The genuine orphans: nothing in the tree names them, and if the address they
 * live at ever stops answering, the page is gone. Same filter the decision
 * board's shelf uses for "no copy anywhere".
 */
const artifacts = JSON.parse(readFileSync(ARTIFACTS_PATH, "utf8")).artifacts;
const orphans = artifacts.filter((a) => !a.decision && !a.page);

const html = `<title>Hifth Experience Atlas</title>
<style>
:root {
  /* The same tokens docs/design/decision-board.html uses — this page sits
     beside it and a different palette would read as a different project's
     document about the same project. */
  --ground: #f4efe6;
  --raised: #fbf8f2;
  --sunk: #ece4d6;
  --ink: #26201a;
  --soft: #5c5347;
  --faint: #6b6255;
  --rule: #ded4c3;
  --rule-soft: #eae1d2;
  --accent: #1f6f66;
  --accent-ink: #17544d;
  --accent-soft: #d7e7e3;
  --terra: #a23b2c;
  --terra-soft: #f3ded8;
  --serif: "Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", "Hoefler Text", Georgia, serif;
  --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  --measure: 37rem;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #17140f;
    --raised: #201c16;
    --sunk: #100e0a;
    --ink: #ece3d3;
    --soft: #b4a893;
    --faint: #918675;
    --rule: #352f26;
    --rule-soft: #262019;
    --accent: #5fb0a3;
    --accent-ink: #7cc4b8;
    --accent-soft: #1c3a35;
    --terra: #d9826c;
    --terra-soft: #3a201a;
  }
}
:root[data-theme="dark"] {
  --ground: #17140f;
  --raised: #201c16;
  --sunk: #100e0a;
  --ink: #ece3d3;
  --soft: #b4a893;
  --faint: #918675;
  --rule: #352f26;
  --rule-soft: #262019;
  --accent: #5fb0a3;
  --accent-ink: #7cc4b8;
  --accent-soft: #1c3a35;
  --terra: #d9826c;
  --terra-soft: #3a201a;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--serif);
  font-size: 17px;
  line-height: 1.62;
  -webkit-text-size-adjust: 100%;
}
.wrap { max-width: 74rem; margin: 0 auto; padding: 0 clamp(1.25rem, 4vw, 3rem) 6rem; }
.col { max-width: var(--measure); }
p { margin: 0 0 1.05em; text-wrap: pretty; }
a { color: var(--accent-ink); text-underline-offset: 2px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 2px; }

header { padding: clamp(3rem, 8vw, 5.5rem) 0 0; }
.eyebrow {
  font-family: var(--mono); font-size: 12px; letter-spacing: 0.13em;
  text-transform: uppercase; color: var(--faint); margin: 0 0 1.1rem;
}
h1 {
  font-size: clamp(2rem, 4.6vw, 3.05rem); line-height: 1.1; margin: 0 0 1.1rem;
  font-weight: 600; letter-spacing: -0.012em; text-wrap: balance; max-width: 26ch;
}
.stand { font-size: 1.16rem; color: var(--soft); max-width: var(--measure); }

.tally { display: flex; flex-wrap: wrap; gap: 0 2.6rem; margin: 2.2rem 0 0; padding: 0; list-style: none; }
.tally li { display: flex; flex-direction: column; }
.tally .fig {
  font-family: var(--mono); font-size: 1.9rem; line-height: 1.1;
  font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
}
.tally .open .fig { color: var(--terra); }
.tally .lab { font-size: 0.86rem; color: var(--faint); }

section { margin: 4.4rem 0 0; }
h2 {
  font-size: clamp(1.4rem, 2.6vw, 1.85rem); line-height: 1.2; margin: 0 0 0.7rem;
  font-weight: 600; letter-spacing: -0.008em; text-wrap: balance;
}
h2 .n {
  display: block; font-family: var(--mono); font-size: 12px; letter-spacing: 0.13em;
  text-transform: uppercase; color: var(--faint); margin-bottom: 0.5rem; font-weight: 400;
}

.deck { display: grid; gap: 1.1rem; margin-top: 2rem; }
.deck-tight { grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); align-items: start; }
.card {
  background: var(--raised); border: 1px solid var(--rule); border-radius: 4px;
  padding: 1.25rem 1.4rem 1.35rem;
}
.card h3 {
  font-size: 1.1rem; line-height: 1.34; margin: 0 0 0.55rem;
  font-weight: 600; text-wrap: pretty;
}
.card p { font-size: 0.97rem; color: var(--soft); margin: 0; }
.card-top {
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between;
  gap: 0.5rem 1rem; margin-bottom: 0.7rem;
}
.pill {
  display: inline-block; padding: 0.16rem 0.62rem; border-radius: 999px;
  border: 1px solid var(--rule); font-family: var(--mono); font-size: 11.5px;
  letter-spacing: 0.04em; color: var(--soft); background: var(--sunk);
}
.pill-open { border-color: var(--terra); background: var(--terra-soft); color: var(--terra); }
.pill-living { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-ink); }
.weight {
  font-family: var(--mono); font-size: 11.5px; color: var(--faint);
  font-variant-numeric: tabular-nums;
}
.links { margin: 0.8rem 0 0; font-size: 0.92rem; }
.links .sep { color: var(--rule); margin: 0 0.5rem; }
.go { font-weight: 600; }
.orphan-note {
  font-size: 0.9rem; color: var(--soft); margin: 0.8rem 0 0;
  padding: 0.6rem 0.8rem; border-radius: 3px; background: var(--terra-soft);
}
.pub-loose { border-color: var(--terra); }

.instrument {
  background: var(--raised); border: 1px solid var(--rule); border-radius: 4px;
  padding: 1.6rem 1.7rem 1.7rem; max-width: var(--measure);
}
.instrument p:last-child { margin-bottom: 0; }

.note {
  margin-top: 4.6rem; padding-top: 1.5rem; border-top: 1px solid var(--rule);
  font-size: 0.9rem; color: var(--faint); max-width: 46rem;
}
@media (max-width: 34rem) {
  .card-top { flex-direction: column; }
}
</style>

<div class="wrap">
<header>
  <p class="eyebrow">Hifth · the experience atlas</p>
  <h1>Where does this project's work actually live, and how do you get to it?</h1>
  <p class="stand">Hifth is one running app and a shelf of pages built to argue about how it
  should look and behave. Nothing before this page said where all of that lives in one place —
  a reader handed a single link had to already know that the app itself, the pages arguing over
  its details, and the pages that got published and forgotten were three different things kept
  in three different registers. This page is the front door to all three, plus the fourth: the
  way this project checks that any of the above is actually right.</p>

  <ul class="tally">
    <li><span class="fig">${appFeatures.length}</span><span class="lab">things the app does</span></li>
    <li><span class="fig">${decisions.length}</span><span class="lab">pages built to argue a design call</span></li>
    <li class="${orphans.length ? "open" : ""}"><span class="fig">${orphans.length}</span><span class="lab">published pages with no home yet</span></li>
  </ul>
</header>

<section>
  <div class="col">
    <h2><span class="n">The app</span>What does Hifth actually do?</h2>
    <p>One line per thing a reader can do in the running app today, taken from the same map
    the codebase itself is oriented by — so this list cannot say more than the app actually
    does. There is no public link yet: today the app only runs from a helper on the machine
    that built it, and the check that would say whether a build is fit to hand to a stranger
    fails on purpose while the project stays private. That check exists and is run on demand;
    it is not silence, it is a known answer.</p>
  </div>
  <div class="deck deck-tight">${appFeatures
    .map(
      (f) => `
<article class="card">
  <h3>${esc(f.title)}</h3>
  <p>${esc(f.what)}</p>
</article>`,
    )
    .join("")}</div>
</section>

<section>
  <div class="col">
    <h2><span class="n">The design calls</span>What pages were built to help make a decision?</h2>
    <p>Every one of these draws its options on a real page of the mus'haf, at the size it would
    actually be used, because a wash you cannot see at that size is an answer and it is one no
    paragraph would have given you. The reasoning behind each — why it was asked now, what
    happens if nobody decides, what would change the answer — is written where the decision
    itself lives, not repeated here. <a href="https://claude.ai/code/artifact/9a42955e-4c2f-4dc9-8c95-a50942c46a00">The decision board</a>
    draws every one of these on a single time line together with the ones still waiting on
    somebody; this page only points at each in turn.</p>
  </div>
  <div class="deck deck-tight">${decisions
    .map(
      (d) => `
<article class="card">
  <div class="card-top">
    <span class="pill${d.status === "open" ? " pill-open" : d.status === "decided" ? " pill-living" : ""}">${esc(d.status)}</span>
  </div>
  <h3>${esc(d.question)}</h3>
  <p class="links">
    <a class="go" href="${esc(d.artifact)}">Open the page</a>
    <span class="sep">·</span>
    <a href="../../${esc(d.page)}">the same page, kept here</a>
  </p>
</article>`,
    )
    .join("")}</div>
</section>

<section>
  <div class="col">
    <h2><span class="n">Published, and homeless</span>What has gone out with nowhere pointing at it?</h2>
    <p>Each of these is a real page, published and shown to somebody, and still not named by any
    decision or checked into this repository — so the address on the card is, right now, the
    only copy. They stay here rather than being quietly fixed, because the fix for each is a
    person's call about where the finding belongs, not a rewrite this page can make for them.</p>
  </div>
  <div class="deck deck-tight">${orphans
    .map(
      (a) => `
<article class="card pub-loose">
  <div class="card-top">
    <span class="pill pill-open">No copy — the link is all there is</span>
  </div>
  <h3><a href="${esc(a.url)}">${esc(a.title)}</a></h3>
  <p>${esc(a.shows)}</p>
  <p class="orphan-note">${esc(a.note)}</p>
</article>`,
    )
    .join("")}</div>
</section>

<section>
  <div class="col">
    <h2><span class="n">The instrument</span>How does this project check that any of the above is right?</h2>
    <p>Every one of the pages above rests on a claim about the printed page — that a rectangle
    sits where it should, that a colour reads clearly, that a crop shows the right verse. Those
    claims get checked by a person sitting with the app and a real mus'haf open beside it, one
    verse at a time, and the settled answer for where that checking happens is described below
    rather than linked: the sessions themselves render real verses of the Qur'an, and this
    project ships none of that text to a page anyone outside it can open.</p>
  </div>
  <div class="instrument">
    <p>A checking session is opened by its address on the household's private network, from
    whichever phone or laptop is at hand. Every answer a person gives is posted back the instant
    it is given and appended to a plain record on that same machine — nothing is sent anywhere
    else, and nothing about a session is reachable from outside that network. The two published
    alternatives — handing a session to a stranger as a page, with or without a place for their
    answers to land — were drawn, compared, and set aside for the same reason: either one would
    put verses of the Qur'an on a server this project does not control, and nothing about how
    the rectangles line up is worth that trade.</p>
  </div>
</section>

<p class="note">Drawn from this project's own registers on every build: the app's shape from
the map it is oriented by, the design calls and their pages from the decision register, and the
homeless pages from the list of everything this project has published. Nothing on this page is
typed a second time — if it ever disagrees with one of those, the register is right and this
page has not been rebuilt. The decisions themselves, drawn in full with every option and every
constraint between them, are one page over at the decision board linked above.</p>
</div>
`;

writeFileSync(OUT, html);
console.log(
  `${OUT.replace(ROOT, "")}  ${(html.length / 1024).toFixed(0)} KB — ` +
    `${appFeatures.length} app features, ${decisions.length} design-call pages, ${orphans.length} homeless pages`,
);
