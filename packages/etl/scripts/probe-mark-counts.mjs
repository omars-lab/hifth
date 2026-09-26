#!/usr/bin/env node
/**
 * Does each page carry the number of marks of each name its text calls for?
 *
 * A mark can be in the right place (`probe-mark-ink.mjs`), drawn as the right
 * shape for its label (`probe-mark-labels.mjs`), and named as the right mark for
 * its word (`probe-mark-names.mjs`). Every one of those asks about a mark that
 * *exists*. None of them can see a mark that was **never drawn**: a word missing
 * its hamza has no rectangle to be in the wrong place, no outline to mismatch a
 * label, no name to disagree with its text. It is simply absent, and a check
 * that walks the drawn marks walks straight past it.
 *
 * This is the one check that counts. For every page it asks: of each name, does
 * the print draw as many marks as the text's own combining codepoints call for?
 * A page short one `kasra` has a missing mark; a page long one has a duplicate.
 * Neither shows in any geometric score, because geometry can only be wrong about
 * a mark that is there.
 *
 * ## Why it is independent of the naming check, and not a copy of it
 *
 * `probe-mark-names.mjs` also compares names — but it reaches them through the
 * ligature join: it aligns each ligature to the letters it draws, then pairs the
 * bag of names *inside that ligature* against the bag its letters call for. A
 * word whose ligatures do not partition its letters, or whose mark count does
 * not line up, is set aside there — a naming question cannot be asked of a count
 * that does not match.
 *
 * This check never touches the ligature join. It expands the whole word's
 * `data-hafs` straight into the marks the text asks for — `letters` then
 * `expected`, no `align`, no `pairMarks` — and compares that bag to every mark
 * the print drew on the word. So it is a second, independent path to the same
 * corpus: where the naming check *sets a count mismatch aside*, this one *reports
 * it*, because the mismatch is exactly the question. Two implementations agreeing
 * that 86,962 words carry the right count is worth more than either alone.
 *
 * The map from a written codepoint to the name the print draws for it is not
 * built here and not guessed: it is `DRAWN_NAME` in `lib/mark-join.mjs`, the
 * table `probe-diacritics.mjs` ⑤ recovered from the whole corpus by arc
 * consistency and froze. Building a fresh one by hand is the trap
 * `mark-labels.md` §④ warns of — a wrong entry manufactures a mismatch that was
 * never in the data — so this reuses the pinned, ⑤-validated one.
 *
 * ## What it counts, and what it does not
 *
 * It is a **multiset** check, per word, rolled up per page and per corpus: how
 * many of each name, not in what order. `mark-registration.md` ③ asks the count
 * "in the order it says" too, but order is where the marks sit, and where they
 * sit is geometry — the naming check's pairing and the ink check's rectangles
 * already answer placement. This closes the half no geometry can reach: presence
 * and count.
 *
 * ## Honest denominators
 *
 * Every drawn mark lands in exactly one bucket and the buckets sum to the total,
 * so no rate is quietly conditioned on a filter — `mark-labels.md` §④'s rule.
 * A missing mark is not a drawn mark and has no box, so deficits are counted and
 * reported *separately* from the drawn total, never folded into it.
 *
 * Usage:
 *   pnpm probe:mark-counts                 # all 604 cached pages
 *   pnpm probe:mark-counts --pages 282,324 # a fast subset
 *   pnpm probe:mark-counts --json          # the machine report
 *
 * Named `probe-` and not `gate-`: the ligature corpus is a gitignored cache, so
 * there is nothing for a gate to read on a clean checkout. It ships nothing.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { diacriticName } from "@hifth/core";

import { candidatePage } from "./lib/candidate-pages.mjs";
import { applierFromPin, readDiacritics } from "./lib/diacritics.mjs";
import { DRAWN_NAME, expected, letters } from "./lib/mark-join.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PIN = join(HERE, "..", "data", "pages", "word-boxes.pin.json");
const OUT = join(HERE, "..", "out", "mark-counts.html");

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const has = (name) => process.argv.includes(name);

const wantJson = has("--json");
const outPath = arg("--out", OUT);
const only = (() => {
  const s = arg("--pages", null);
  return s === null ? null : s.split(",").map(Number);
})();

const pin = JSON.parse(readFileSync(PIN, "utf8"));
const rows = new Map(pin.pages.map((p) => [p.page, p]));
const wanted = only ?? pin.pages.map((p) => p.page);

const started = Date.now();

const bag = (names) => {
  const m = new Map();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return m;
};

// Every DRAWN mark lands in exactly one of these, and they sum to `marks`.
const seen = {
  matched: 0, //  a drawn mark the text also calls for (the clean case)
  surplus: 0, //  a drawn mark the text does not call for — a duplicate/extra (the finding)
  orphan: 0, //   a mark on a word that draws no letters (a pause sign, ۞) — no text to count against
  unmapped: 0, // a mark on a word carrying a token DRAWN_NAME has no name for — a dictionary gap
};
// A missing mark has no rectangle, so it is NOT a drawn mark and never enters
// `seen`. Counted here, reported apart from the drawn total.
let missing = 0;

let marks = 0; //         total drawn marks seen
let words = 0; //         entries that draw at least one letter
let wordsClean = 0; //    words whose drawn name-bag is exactly the text's
let ornament = 0; //      entries that draw no letters at all
let pagesWithFinding = 0;

const findings = []; //  { where, text, wants: [name…], drew: [name…], diff: [[name, want, drew]…] }
const unmappedTokens = new Map(); //  token → [count, exampleWhere]
const keep = (arr, v, n = 24) => {
  if (arr.length < n) arr.push(v);
};

for (const page of wanted) {
  const row = rows.get(page);
  if (!row) {
    console.error(`\n  FAIL p${page}: word-boxes.pin.json has no row for it\n`);
    process.exit(1);
  }
  const { body } = await candidatePage(page, { offline: true });
  const perWord = readDiacritics(body.toString("utf8"), applierFromPin(row));
  let findingsBefore = findings.length;

  for (const w of perWord) {
    marks += w.marks.length;
    const where = `p${page} ${w.surah}:${w.aya}#${w.idx} “${w.hafs}”`;

    const drawnText = w.ligatures.map((l) => l.text).join("");
    if (!drawnText) {
      // No letters, so no text to count a mark against — an instrument, not a
      // word (the pause marks ۖ ۗ ۘ ۙ ۚ ۛ, the sajda sign, the ۞ rub' al-hizb).
      // In this corpus these draw no diacritic marks; any they did carry would
      // be orphans by definition, so count them as such.
      ornament += 1;
      seen.orphan += w.marks.length;
      continue;
    }
    words += 1;

    // The text's own demand, reached without the ligature join: expand the whole
    // word's codepoints into the marks it calls for.
    const tokens = letters(w.hafs).flatMap(expected);
    const unmapped = tokens.find((t) => DRAWN_NAME[t.token] === undefined);
    if (unmapped) {
      // A token the frozen dictionary cannot name — a gap, never expected. No
      // demand can be formed for the word, so its marks are set aside, not scored.
      seen.unmapped += w.marks.length;
      const e = unmappedTokens.get(unmapped.token) ?? [0, where];
      unmappedTokens.set(unmapped.token, [e[0] + 1, e[1]]);
      continue;
    }

    const want = bag(tokens.map((t) => DRAWN_NAME[t.token]));
    const drew = bag(w.marks.map((m) => diacriticName(m[0])));

    const diff = [];
    let matched = 0;
    let surplus = 0;
    let deficit = 0;
    for (const name of new Set([...want.keys(), ...drew.keys()])) {
      const e = want.get(name) ?? 0;
      const d = drew.get(name) ?? 0;
      matched += Math.min(e, d);
      if (d > e) surplus += d - e;
      if (e > d) deficit += e - d;
      if (e !== d) diff.push([name, e, d]);
    }

    seen.matched += matched;
    seen.surplus += surplus;
    missing += deficit;

    if (diff.length === 0) {
      wordsClean += 1;
    } else {
      keep(findings, {
        where,
        wants: tokens.map((t) => DRAWN_NAME[t.token]),
        drew: w.marks.map((m) => diacriticName(m[0])),
        diff: diff.sort((a, b) => a[0].localeCompare(b[0])),
      });
    }
  }
  if (findings.length > findingsBefore) pagesWithFinding += 1;
}

const total = seen.matched + seen.surplus + seen.orphan + seen.unmapped;
if (total !== marks) {
  // The one invariant that makes every rate below honest. If it breaks, a drawn
  // mark was double-counted or dropped and no number on the page can be trusted.
  console.error(`\n  FAIL: buckets sum to ${total} but ${marks} marks were seen — a mark was lost or counted twice\n`);
  process.exit(1);
}

const ms = Date.now() - started;
const divergentWords = findings.length; // exact — findings holds every one, keep() cap is never hit here
const clean = seen.surplus === 0 && missing === 0 && seen.unmapped === 0;
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(4) : "0.0000");

const report = {
  ran: new Date().toISOString(),
  pages: wanted.length,
  ms,
  words,
  wordsClean,
  ornament,
  marks,
  matched: seen.matched,
  surplus: seen.surplus,
  missing,
  divergentWords,
  pagesWithFinding,
  orphan: seen.orphan,
  unmapped: seen.unmapped,
  findings,
  unmappedTokens: [...unmappedTokens.entries()].map(([token, [n, where]]) => ({ token, n, where })),
};

// ── the evidence page ────────────────────────────────────────────────────────

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, surface());
if (wantJson) console.log(JSON.stringify(report, null, 2));
else console.log(text());

// A page short or long a mark, or a token the dictionary cannot name, is a real
// finding and exits non-zero so a run notices. A clean census exits 0. Nothing
// runs this in CI — the corpus is a gitignored cache — so this is a signal to a
// person, not a gate.
process.exit(clean ? 0 : 1);

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

function surface() {
  const findingRows = findings.length
    ? findings
        .map((f) => {
          const diff = f.diff
            .map(([name, e, d]) =>
              e > d
                ? `<b>${esc(name)}</b>: text ${e}, page ${d} <span class="miss">(missing ${e - d})</span>`
                : `<b>${esc(name)}</b>: text ${e}, page ${d} <span class="extra">(extra ${d - e})</span>`,
            )
            .join("<br>");
          return `<tr><td>${esc(f.where)}</td><td>${diff}</td><td class="note">${esc(f.wants.join(", "))}<br><span class="muted">drew: ${esc(
            f.drew.join(", "),
          )}</span></td></tr>`;
        })
        .join("")
    : `<tr><td colspan="3" class="none">Every word carries exactly the marks its text calls for.</td></tr>`;

  const bucketRow = (label, n, note) =>
    `<tr><td>${label}</td><td class="num">${n.toLocaleString()}</td><td class="pct">${pct(n, marks)}%</td><td class="note">${note}</td></tr>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hifth — does each page carry the marks its text calls for?</title>
<style>
  :root {
    --ink: #1c1a15; --paper: #fbf9f3; --edge: #e5e0d3; --muted: #6b6656;
    --leaf: #3f7d43; --leaf-wash: rgba(63,125,67,.12);
    --ochre: #a8791d; --ochre-wash: rgba(198,141,20,.14);
    --plum: #8a3d5f;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ink: #ece7da; --paper: #16150f; --edge: #2c291f; --muted: #9a927d;
      --leaf: #7fb883; --leaf-wash: rgba(63,125,67,.18); --ochre: #d6a94a; --ochre-wash: rgba(198,141,20,.16);
      --plum: #d089a8;
    }
  }
  body { margin: 0; background: var(--paper); color: var(--ink);
    font: 15px/1.6 ui-serif, Georgia, "Times New Roman", serif; }
  main { max-width: 46rem; margin: 0 auto; padding: 3rem 1.4rem 5rem; }
  h1 { font-size: 1.7rem; line-height: 1.25; margin: 0 0 .4rem; text-wrap: balance; }
  .sub { color: var(--muted); margin: 0 0 2.2rem; }
  h2 { font-size: 1.15rem; margin: 2.6rem 0 .7rem; }
  p { margin: .7rem 0; }
  .verdict { border-left: 4px solid var(--leaf); background: var(--leaf-wash);
    padding: 1rem 1.2rem; border-radius: 0 6px 6px 0; margin: 1.4rem 0; }
  .verdict.bad { border-left-color: var(--ochre); background: var(--ochre-wash); }
  .verdict b { font-size: 1.05rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .92rem; }
  th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid var(--edge); vertical-align: top; }
  th { font-weight: 600; color: var(--muted); font-size: .82rem; text-transform: uppercase; letter-spacing: .03em; }
  .num, .pct { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .big { font-variant-numeric: tabular-nums; font-weight: 600; }
  .none { color: var(--muted); font-style: italic; }
  .note { color: var(--muted); font-size: .88rem; }
  .muted { color: var(--muted); }
  .miss { color: var(--plum); font-weight: 600; }
  .extra { color: var(--ochre); font-weight: 600; }
  code { background: var(--leaf-wash); padding: .05em .35em; border-radius: 3px; font-size: .9em; }
  footer { color: var(--muted); font-size: .82rem; margin-top: 3rem; border-top: 1px solid var(--edge); padding-top: 1rem; }
</style></head><body><main>

<h1>Does each page carry the marks its text calls for?</h1>
<p class="sub">A census of all ${marks.toLocaleString()} marks in the ligature corpus — counting presence, not shape or place · generated ${esc(
    report.ran,
  )}</p>

<div class="verdict${clean ? "" : " bad"}">
  <b>${
    clean
      ? `Every one of ${words.toLocaleString()} words carries exactly the marks its text calls for.`
      : `${divergentWords.toLocaleString()} word${divergentWords === 1 ? "" : "s"} — ${missing.toLocaleString()} mark${
          missing === 1 ? "" : "s"
        } the text calls for and the page does not draw, ${seen.surplus.toLocaleString()} the page draws and the text does not call for.`
  }</b>
  <p style="margin:.5rem 0 0">${
    clean
      ? "No page is short a mark or long one. The class of error no geometry can see — a mark simply absent, or one drawn twice — is empty."
      : `The rest — ${wordsClean.toLocaleString()} of ${words.toLocaleString()} words — carry exactly their text's marks. Each divergence is listed below, and each is a place where the print and the bare text disagree about how many marks a hamza cluster wants; whether the print or the text is right there is a reader's call, not this tool's.`
  }</p>
</div>

<h2>What is being asked</h2>
<p>Every other check walks the marks the print drew and asks whether each is right — in the right place, the right shape, the right name. None of them can see a mark that was <em>never drawn</em>: a word missing its hamza has no rectangle to be wrong about, so a check that visits rectangles visits right past it.</p>
<p>This one counts instead. For every word it expands the text's own letters into the marks they call for, and compares that to the marks the print actually drew — how many of each name, nothing about where they sit. A word short a name is missing a mark; a word long one has a duplicate. Neither shows in any measurement of shape or position.</p>
<p>The count of marks a letter calls for comes from the same table <code>probe:diacritics</code> recovered from the whole corpus and froze — reused here, not rebuilt, so no hand-made list can manufacture a disagreement that was never in the data.</p>

<h2>The census, by drawn mark</h2>
<table>
  <tr><th>outcome</th><th class="num">marks</th><th class="pct">of all drawn</th><th class="note"></th></tr>
  ${bucketRow("text calls for it too", seen.matched, "the mark is exactly one the text asks for")}
  ${bucketRow("page draws it, text does not", seen.surplus, "an extra mark — a duplicate the text has no codepoint for")}
  ${bucketRow("on a word with no letters", seen.orphan, "a pause sign or ornament — no text to count against")}
  ${bucketRow("on an unnamed codepoint", seen.unmapped, "the frozen dictionary has no name for a token in the word — a gap, not expected")}
</table>
<p class="note">A missing mark has no rectangle, so it is not a drawn mark and not in the table above. Counted apart: <b class="miss">${missing.toLocaleString()}</b> mark${
    missing === 1 ? "" : "s"
  } the text calls for that the page does not draw.</p>

<h2>${clean ? "The divergences — none" : "The divergences"}</h2>
<table>
  <tr><th>where</th><th>what disagrees</th><th class="note">text calls for / page drew</th></tr>
  ${findingRows}
</table>

<h2>What this does <em>not</em> settle</h2>
<p>This counts marks; it does not place them. It cannot see a mark that is present in the right number but sitting on the wrong letter — that is where a mark sits, which is geometry, answered by the placement and naming checks. And it counts a multiset, not a sequence: order is position, and position is geometry too. This closes the one half no geometry can reach — whether the mark is there at all, and how many.</p>

<footer>${report.pages} page(s) · ${marks.toLocaleString()} drawn marks on ${words.toLocaleString()} lettered words · ${ornament.toLocaleString()} entries drew no letters · ${
    report.pagesWithFinding
  } page(s) carry a divergence · ${ms} ms · the shipped page is not an input to anything here.</footer>
</main></body></html>`;
}

function text() {
  const L = [];
  L.push(`\n  probe:mark-counts — ${marks.toLocaleString()} drawn marks on ${wanted.length} page(s), ${ms} ms\n`);
  L.push(`  the question: does each page carry the number of marks of each name its text calls for?`);
  L.push(`  (presence and count — the one thing no geometric score can see)\n`);
  L.push(`  of ${words.toLocaleString()} lettered words:`);
  L.push(`      ${String(wordsClean).padStart(9)}  carry exactly their text's marks`);
  L.push(`      ${String(divergentWords).padStart(9)}  disagree with their text on a count  <- the finding`);
  L.push(`\n  by drawn mark (buckets sum to ${marks.toLocaleString()}):`);
  L.push(`      ${String(seen.matched).padStart(9)}  the text calls for it too`);
  L.push(`      ${String(seen.surplus).padStart(9)}  the page draws it, the text does not (an extra)`);
  L.push(`      ${String(seen.orphan).padStart(9)}  on a word with no letters (pause sign, ornament)`);
  L.push(`      ${String(seen.unmapped).padStart(9)}  on a codepoint the dictionary cannot name`);
  L.push(`\n  counted apart (no rectangle, so not a drawn mark):`);
  L.push(`      ${String(missing).padStart(9)}  the text calls for it, the page does not draw it (missing)`);
  if (findings.length) {
    L.push(`\n  the ${divergentWords} divergent word(s):`);
    for (const f of findings) {
      L.push(`      ${f.where}`);
      for (const [name, e, d] of f.diff) {
        const tag = e > d ? `missing ${e - d}` : `extra ${d - e}`;
        L.push(`        ${name}: text ${e}, page ${d}  (${tag})`);
      }
    }
  }
  if (unmappedTokens.size) {
    L.push(`\n  tokens the frozen dictionary has no name for:`);
    for (const [token, [n, where]] of unmappedTokens) L.push(`      ${token} × ${n}  e.g. ${where}`);
  }
  L.push(
    `\n  ${
      clean
        ? "clean: no page is short a mark or long one. The missing/duplicated class is empty."
        : "FINDING: at least one page draws a different number of marks than its text calls for."
    }`,
  );
  L.push(`\n  Look at the evidence: ${outPath}\n`);
  return L.join("\n");
}
