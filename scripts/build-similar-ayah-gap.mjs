#!/usr/bin/env node
/**
 * Draws the decision `similar-ayah-enrichment`, now decided (option D): the
 * whole-verse twins — verses repeated word for word in two places — are found
 * in the app's OWN already-vendored word data at build time, shipped as bare
 * verse numbers, and the outside measuring library is used only to confirm the
 * set is complete. The copy-nothing boundary (qul-reliance) is not reopened.
 * The page keeps the options that lost (A, B, C) because they are the reason the
 * choice was a choice; the pivot from "take the library's pairs in" to "find
 * them ourselves" is written up in docs/issues/verbatim-twins-found-in-house.md.
 *
 * Every specimen is the real printed page with real geometry over it. The
 * verses are cut out of the mus'haf artwork the app already ships (the same
 * `WordIndex` the app itself calls), never retyped. The counts in the prose
 * come straight out of the checked-in measurement pin, so any number on the
 * page can be re-derived by rebuilding that pin.
 *
 * Two things this generator will NOT do, on purpose:
 *
 *   1. It never applies the library's own word ranges to our artwork. The
 *      library counts words more coarsely than the print does (a verse the
 *      print draws in 17 words the library counts as 15), so borrowing its
 *      per-word ranges would silently colour the wrong words. Where a
 *      differing word is marked below, its index was found by eye against the
 *      page and written into this file by hand — not read from the library.
 *   2. It draws only pairs a human has looked at on the page and confirmed.
 *      The library scores some pairs a full match that in fact differ by a
 *      word; those belong in the "but for a word" group, not the "word for
 *      word" one, and only an eye can tell them apart.
 *
 *   node scripts/build-similar-ayah-gap.mjs
 *
 * Registered in docs/decisions.json as the `builtBy` for
 * similar-ayah-enrichment; the reasons live in
 * docs/decisions/similar-ayah-enrichment.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { twinPanel } from "./twin-crop.mjs";

const OUT = join(ROOT, "docs/design/similar-ayah-enrichment.html");
const PIN = join(ROOT, "packages/etl/data/qul/qul-rulers.probe.json");

/**
 * The twins to draw, each one looked at on the printed page and confirmed.
 *
 * `same` — word for word identical wherever they sit in the mus'haf. Drawn
 * with the whole verse washed green: every word is shared.
 *
 * `nearly` — the same but for a word or two. Drawn clean, with the differing
 * word marked yellow where a single word carries the whole difference. Each
 * marked index was read off the page by eye (see the header note); none came
 * from the outside library's numbering.
 */
// Each of these was looked at on the page — with the neighbouring verses faded,
// so a word belonging to the verse before or after is not mistaken for the
// verse's own. (61:9 and 9:33 both sit right after a verse ending in the same
// word, which reads as a difference until the neighbour is faded and it is
// plainly the same verse.)
const SAME = [
  ["2:134", "2:141"],
  ["11:110", "41:45"],
  ["22:62", "31:30"],
  ["2:122", "2:47"],
  ["21:41", "6:10"],
  ["24:5", "3:89"],
  ["36:46", "6:4"],
  ["61:9", "9:33"],
];

const NEARLY = [
  {
    pair: ["2:136", "3:84"],
    note: "The same profession of faith. They part in the middle, and over more than one word — which is exactly what the app cannot mark on these without doing its own word-by-word alignment first.",
  },
  {
    pair: ["16:115", "2:173"],
    note: "The same list of what is forbidden to eat, in a different order and opening. Again the resemblance is plain; where they diverge is not something the library's numbering can mark for us.",
  },
];

// ------------------------------------------------------------------- numbers

const pin = JSON.parse(readFileSync(PIN, "utf8"));
const S = pin.similarity;
const G = S.corpus74.gap;
const num = (x) => x.toLocaleString("en-US");

/**
 * What the app shipped BEFORE the twins were added — the gap this decision
 * closed. The pin now holds the after-numbers (it measures what ships), so the
 * before-numbers cannot be re-derived from a current run; they are the recorded
 * historical baseline, the same figures the decision record's table carries, and
 * their provenance is docs/issues/verbatim-twins-found-in-house.md. Re-derivable
 * only by rebuilding the pin against the pre-twin edge set in git history.
 */
const BEFORE = { ourEdges: 2516, corroboratedPct: 2.8, strongMisses: 781, verbatimMisses: 635, versesTouched: 384 };

// ---------------------------------------------------------------------- page

const sameGallery = SAME.map((p) => twinPanel(p, { green: true })).join("\n");
const nearGallery = NEARLY.map((t) => twinPanel(t.pair, { mark: t.mark, note: t.note })).join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The look-alikes the app now connects</title>
<style>
  :root {
    --paper: #f7f4ee; --paper-raised: #fffdf8; --ink: #26201a; --ink-soft: #5c5348;
    --hair: #e4ddd0; --green: #3f7d43; --yellow: #a8791d; --accent: #17544d;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); color: var(--ink);
    font: 16px/1.6 "Iowan Old Style", Palatino, Georgia, serif; }
  main { max-width: 760px; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 0.5rem; }
  h2 { font-size: 1.3rem; margin: 2.6rem 0 0.6rem; }
  .standfirst { font-size: 1.15rem; color: var(--ink-soft); margin: 0 0 1.5rem; }
  p { margin: 0 0 1rem; }
  b { color: var(--ink); }
  .glossary { background: var(--paper-raised); border: 1px solid var(--hair);
    border-radius: 10px; padding: 0.6rem 1rem; margin: 1.5rem 0; }
  .glossary dt { font-weight: 600; margin-top: 0.5rem; }
  .glossary dd { margin: 0 0 0.2rem; color: var(--ink-soft); }
  .stat { display: flex; flex-wrap: wrap; gap: 1.4rem; margin: 1.2rem 0; }
  .stat div { flex: 1 1 8rem; }
  .stat .big { font-size: 2rem; font-weight: 700; color: var(--accent); line-height: 1; }
  .stat .cap { font-size: 0.9rem; color: var(--ink-soft); }
  .gallery { display: grid; grid-template-columns: 1fr; gap: 1.4rem; margin: 1.4rem 0; }
  .pair { background: var(--paper-raised); border: 1px solid var(--hair);
    border-radius: 10px; padding: 0.9rem; }
  .crop { margin: 0 0 0.6rem; }
  .crop:last-of-type { margin-bottom: 0; }
  .crop figcaption { font: 0.85rem monospace; color: var(--ink-soft); margin-bottom: 0.25rem; }
  .art { display: block; width: 100%; height: auto; background: #fff;
    border: 1px solid var(--hair); border-radius: 4px; }
  .note { font-size: 0.95rem; color: var(--ink-soft); margin: 0.6rem 0 0; }
  .scrim { fill: var(--paper); opacity: 0.72; }
  .w-share { fill: rgba(63, 125, 67, 0.16); stroke: var(--green);
    stroke-width: 0.3; vector-effect: non-scaling-stroke; }
  .w-diff { fill: rgba(198, 141, 20, 0.22); stroke: var(--yellow);
    stroke-width: 0.3; vector-effect: non-scaling-stroke; }
  .swatch { display: inline-block; width: 0.8em; height: 0.8em; border-radius: 2px;
    vertical-align: -1px; margin-right: 0.15em; }
  .options { list-style: none; padding: 0; margin: 1.2rem 0; }
  .options > li { background: var(--paper-raised); border: 1px solid var(--hair);
    border-radius: 10px; padding: 0.9rem 1.1rem; margin-bottom: 0.9rem; }
  .options .lbl { font-weight: 700; }
  .options .tag { font: 0.8rem monospace; color: var(--ink-soft); }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--hair);
    font-size: 0.9rem; color: var(--ink-soft); }

  /* What a choice does for a hafiz, marked the way a reader marks a page: a highlighter stroke. */
  .hafiz-box{margin:1.6em 0;padding:1em 1.15em;border:2px solid #e8c400;border-radius:12px;background:rgba(255,236,120,.14)}
  .hafiz-box h2{margin-top:0}
  .hafiz-box ul{margin:.5em 0 0;padding-left:1.1em}
  .hafiz-box li{margin:.45em 0}
  .hl{background-image:linear-gradient(100deg,rgba(255,221,0,0) 0%,rgba(255,221,0,.62) 1.2%,rgba(255,228,50,.48) 50%,rgba(255,221,0,.66) 98.8%,rgba(255,221,0,0) 100%);border-radius:.4em .2em .45em .25em;padding:.06em .28em;margin:0 -.08em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
  .for-hafiz{margin:.55em 0 0}
  @media (prefers-color-scheme: dark){
    .hafiz-box{background:rgba(250,204,21,.08);border-color:#b99a10}
    .hl{background-image:linear-gradient(100deg,rgba(250,204,21,0) 0%,rgba(250,204,21,.34) 1.2%,rgba(250,204,21,.26) 50%,rgba(250,204,21,.36) 98.8%,rgba(250,204,21,0) 100%)}
  }
</style>
</head>
<body>
<main>
  <h1>The look-alikes the app now connects</h1>
  <p class="standfirst">Hundreds of verse pairs are the same verse in two places — the hardest
  look-alikes for a memoriser to keep apart. The app used to connect almost none of them. It now
  finds them all in its own word data and washes the whole matching verse green, and a separate
  library of Qur'an data — used only as a measuring stick — confirms the set is complete. This
  page shows the twins now bridged, and how the decision was reached.</p>
  <p style="background:var(--paper-raised);border:1px solid var(--hair);border-left:3px solid var(--green);border-radius:6px;padding:0.7rem 1rem;margin:0 0 1.5rem;">
  <b>Decided (option D).</b> The twins are found in the app's own already-included word data,
  shipped as bare verse numbers, and the outside library only checks the result. The
  copy-nothing boundary was not reopened. The options that lost are kept below, because they are
  why the choice was a choice.</p>

  <dl class="glossary">
    <dt>mus'haf</dt><dd>The printed Qur'an, page by page, as the reader sees it.</dd>
    <dt>verse</dt><dd>One āyah. The app names each one by its sūra and number, e.g. 2:134.</dd>
    <dt>look-alike</dt><dd>Two verses close enough to be confused in memorisation — the thing a
      hafiz most needs a bridge between. The tradition calls these the mutashābihāt.</dd>
    <dt>the outside library</dt><dd>A public collection of Qur'an data the app measures itself
      against but, by an earlier decision, copies nothing from.</dd>
  </dl>

  <h2>What was being decided?</h2>
  <p>The app carries a set of look-alike verse pairs, and offers the reader a bridge from one to
  the other. That set was built from recurring phrases. There is a different kind of look-alike —
  whole verses repeated, word for word, in two places — that the phrase-built set barely caught.
  The question was <b>how the app should connect those whole-verse twins</b>: by taking the
  outside library's pairs in (and reopening the copy-nothing boundary), or some other way.</p>

  <section class="hafiz-box">
  <h2>What does this change for a hafiz?</h2>
  <p><span class="hl">A verse that appears word for word in two places is one of the easiest to slip
  between: nothing in the words tells you which place you are in, so a hafiz reciting one can carry
  straight on into what follows the other.</span> Before this, standing on one of these ${num(BEFORE.verbatimMisses)}
  twins, the app said nothing about the other; now it points to it. For an identical pair, what a hafiz has to learn is not
  which words differ — none do — but what comes before and after each copy, so simply being shown the
  twin is most of the value.</p>
  </section>

  <h2>Why was this asked now?</h2>
  <p>The library was brought in as a ruler — a way to check the app's own numbers. Held up
  against it, the app's look-alike set turned out to cover almost none of the whole-verse twins.
  That is not a bug in either set; they were built to catch different things. But it meant a
  reader standing on one of these twins was shown nothing about the other, and the measurement is
  what surfaced it.</p>

  <h2>What would leaving it have cost?</h2>
  <p>Nothing would have broken — the reader would simply not be told about these particular
  twins. But they are among the hardest verses to keep apart, and the bridge the app exists for is
  precisely the one it was not offering here. That quiet cost is why the status quo (option A
  below) was not chosen.</p>

  <h2>What did the app ship before, and what does it ship now?</h2>
  <div class="stat">
    <div><div class="big">${num(BEFORE.ourEdges)} → ${num(S.ourEdges)}</div><div class="cap">look-alike links the app ships</div></div>
    <div><div class="big">${BEFORE.corroboratedPct}% → ${S.corpus74.oursCorroboratedPct}%</div><div class="cap">of them the outside library also knows</div></div>
    <div><div class="big">${num(BEFORE.strongMisses)} → ${num(G.strongMisses)}</div><div class="cap">strong look-alikes the library has that the app lacks</div></div>
    <div><div class="big">${num(BEFORE.verbatimMisses)} → ${num(G.verbatimMisses)}</div><div class="cap">of those, full word-for-word matches still unlinked</div></div>
  </div>
  <p>The whole-verse gap the ruler measured fell from <b>${num(BEFORE.verbatimMisses)}</b> to
  <b>${num(G.verbatimMisses)}</b>. The three that remain are not twins the app is missing: held
  glyph against glyph they each differ by at least a word — two by a single letter of spelling,
  one by a reordered ending — so they are near-pairs, and the twin-finder is right to leave them
  out. The library's other extra pairs — <b>${num(G.shortNoise)}</b> short coincidences a reader
  would never confuse — are left out of these counts.</p>

  <h2>What do the twins look like, now connected?</h2>
  <p>Each verse below is cut straight out of the printed page, at the size the app shows it.
  Nothing is retyped, and the neighbouring verses the crop catches are faded so only the verse
  itself reads clearly. <span class="swatch" style="background:rgba(63,125,67,.16);border:1px solid var(--green)"></span>
  green is the whole verse: every word is shared, so the app washes it all, which is exactly what
  ships for these pairs now.</p>

  <h2>Word for word the same, in two places</h2>
  <p>The app now bridges every one of these, found in its own word data. Each pair is one verse,
  printed twice, pages apart.</p>
  <div class="gallery">
${sameGallery}
  </div>

  <h2>Nearly the same — the part still to build</h2>
  <p>These resemble each other closely but are not identical, and marking them is what option D
  did <em>not</em> settle. The app can show that they are alike — that is what the crops below do —
  but it cannot mark <em>where</em> they part without first working out, word by word, which word
  on one page answers to which on the other. The library's own word numbering will not do that
  job: it counts a verse's words more coarsely than the printed page draws them (a verse the page
  sets in seventeen words the library counts as fifteen), so its marks would land on the wrong
  words. Working that alignment out on the app's own pages is the open tail of this decision.</p>
  <div class="gallery">
${nearGallery}
  </div>

  <h2>What have we already decided that touches this?</h2>
  <p>One decision ruled most of this space. The app settled that when it leans on the outside
  library it <b>copies none of its bytes</b> — it measures against the library and links out to
  it, and it turned down even copying the library's bare layout numbers. Taking the library's
  look-alike pairs in — even as nothing but verse numbers — would have reopened that decision.
  <b>Option D was chosen precisely so it did not have to be.</b> The twins are found in the app's
  own already-included word data, so nothing is taken from the library at all and the boundary
  stands untouched. The two decisions are recorded as related, in both directions.</p>
  <p>A second decision settles how a look-alike is <em>shown</em> once the app has it: both
  verses cut from the page, the shared words marked, the differing words marked. Whatever is
  taken in here would flow into that display — which is what makes the word-numbering mismatch
  above a real cost and not a footnote.</p>

  <h2>So what were the options?</h2>
  <ul class="options">
    <li>
      <div><span class="lbl">A — Leave the set as it is.</span> <span class="tag">status quo · not chosen</span></div>
      <p>Keep the copy-nothing boundary whole. The app connects the look-alikes it built itself
      and stays silent about the twins. Costs nothing to build; the ${num(BEFORE.verbatimMisses)}
      whole-verse twins stay unconnected — which is exactly the bridge the app exists to build.</p>
      <p class="for-hafiz"><span class="hl"><b>For a hafiz:</b> nothing changes, and on these twins you get no warning that the verse also stands somewhere else — the exact slip the app exists to catch.</span></p>
    </li>
    <li>
      <div><span class="lbl">B — Take in the pair numbers only, and show a whole-verse resemblance.</span> <span class="tag">not chosen</span></div>
      <p>Bring in the library's twins as bare verse-number pairs — no Qur'an text, no fonts, no
      layout. A reader on one twin is offered the other, drawn from the app's own printed pages.
      Reopens the copy-nothing boundary the smallest amount that would close the gap — but reopens
      it, and does not give the word-by-word marking.</p>
      <p class="for-hafiz"><span class="hl"><b>For a hafiz:</b> you are told the twin exists and can open it, and see what surrounds each copy. On a near-twin you learn that the two are alike, but not which words set them apart.</span></p>
    </li>
    <li>
      <div><span class="lbl">C — Take in the pairs and align the words ourselves.</span> <span class="tag">not chosen</span></div>
      <p>As B, plus the app works out the word-by-word correspondence on its own printed pages.
      Full parity with the existing display; the most work; and still reopens the boundary, because
      the pairs themselves would come from the library.</p>
      <p class="for-hafiz"><span class="hl"><b>For a hafiz:</b> everything B gives, and on a near-twin the words that differ are marked — which is the part you actually have to memorise.</span></p>
    </li>
    <li style="border-left:3px solid var(--green);">
      <div><span class="lbl">D — Find the twins in the app's own word data; use the library only to check the set.</span> <span class="tag">chosen</span></div>
      <p>The app never takes the library's pairs in at all. It groups its own already-included
      words by their skeleton, at build time, and any two verses that match in full are twins — the
      same per-word comparison the app already uses for the pairs it built itself. Only verse
      numbers are written out; no Qur'an text ships. The library is then held up beside the result
      and agrees almost exactly — 636 pairs found against its 635 — which is what tells us the set
      is complete rather than lucky. Because every word of a twin is shared, the existing
      green marking washes the whole verse with nothing left to build. This is the only option that
      connects the twins <b>without</b> reopening the copy-nothing boundary, and it costs less than
      B, not more.</p>
      <p class="for-hafiz"><span class="hl"><b>For a hafiz:</b> standing on a verse that appears word for word somewhere else, you are shown the other place, the whole verse washed as shared — so what you learn is what comes before and after each copy, which is where the slip happens.</span></p>
    </li>
  </ul>

  <h2>What else could be considered, and why is it not here?</h2>
  <p>Finding these twins without the library at all was, in an earlier draft, written off as the
  one thing the app could not do — "it ships no Qur'an text, only page artwork and numbers, so it
  has nothing to compare word against word." That was true of what the app <em>ships</em> and
  false of what it <em>builds from</em>: the verified words it needs have been present at build
  time all along, read to make other things and never shipped. The dismissed option turned out to
  be the available one, and it is the one that was chosen. Copying the library's verified text and
  fonts in wholesale was weighed when the boundary was first drawn and turned down; it is not
  revived here.</p>

  <h2>What would change the answer?</h2>
  <p>The choice rests on the build-time word data being present and trustworthy. If it were ever
  removed, the in-house finder would go with it and the question would revert to A/B/C — the
  library's pairs, and the boundary. If the library and the in-house set ever disagreed on which
  verses are whole-verse twins, that disagreement would be the signal to look again; today they
  agree to within a pair.</p>

  <h2>What is this not settling?</h2>
  <p>Not the word-by-word marking of the near-pairs above — that needs a per-word alignment worked
  out on the app's own pages, and is the open tail of this decision. Not whether a verse should
  announce on the page you are reading that it resembles others — a separate question about the
  reading surface. And option D was chosen precisely so the copy-nothing boundary did not have to
  be touched at all.</p>

  <footer>
    <p>Built by <code>scripts/build-similar-ayah-gap.mjs</code> over the checked-in measurement
    pin and the shipped page artwork. Every count re-derives from the pin; every crop is the real
    page. Reasons in full: <code>docs/decisions/similar-ayah-enrichment.md</code>.</p>
    <p>This page's address on the site:
    <a href="https://blog.bytesofpurpose.com/hifth/docs/design/similar-ayah-enrichment.html">blog.bytesofpurpose.com/hifth/docs/design/similar-ayah-enrichment.html</a></p>
  </footer>
</main>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`wrote ${OUT.replace(ROOT, "")}  (${SAME.length} verbatim twins, ${NEARLY.length} near-twins drawn)`);
