#!/usr/bin/env node
/**
 * Does each mark's name agree with the text it belongs to?
 *
 * This is the third question a mark can be asked, and the one two documents left
 * open. `probe-mark-ink.mjs` asks whether a mark's rectangle is in the right
 * *place* on the shipped page. `probe-mark-labels.mjs` asks whether the drawing
 * matches the *name* the print gave it — the outline against the canonical
 * example of its label, no page, no text. Both compare a mark to a *drawing*.
 *
 * Neither can catch a mark that is drawn exactly as its name says and is the
 * *wrong name for that word*: a stroke correctly named and correctly shaped as a
 * kasra, sitting where the text writes a fatha. To the drawing check it is a
 * kasra matching a kasra — a clean pass. `docs/design/mark-labels.md` §⑧ names
 * this blind spot and its own item ②, and this probe is the check it describes.
 *
 * ## What it compares, and why it is independent
 *
 * The corpus carries, for every word, the text the marks belong to
 * (`data-hafs`) *and* the name of every mark it drew (`data-diacritic`). Those
 * are two separate records of the same fact, and this asks whether they agree:
 * for each ligature, is the bag of names the print drew exactly the bag of names
 * the text's combining codepoints call for?
 *
 * The map from a codepoint to the name the print draws for it is not built here
 * and not guessed. It is `DRAWN_NAME` in `lib/mark-join.mjs` — recovered by
 * `probe-diacritics.mjs` ⑤ from the corpus by arc consistency, frozen, and
 * re-derived on every ⑤ run so it cannot drift. Building a fresh name→codepoint
 * table by hand is exactly the trap `mark-labels.md` §④ warns of: a wrong entry
 * manufactures a mismatch that was never in the data. So this reuses the pinned,
 * ⑤-validated one and asks only whether it explains every mark.
 *
 * ## What a pass means, and what it does not
 *
 * §⑧ predicts every mark passes: the two records were both derived from the same
 * Arabic, so an internally consistent corpus agrees with itself. A pass confirms
 * that class of error is *empty* — a census over all of it, not a sample, is the
 * only way to say so with a number rather than a hope.
 *
 * It is a **bag** check, and deliberately so — that is the part independent of
 * everything else. It cannot see a mark that is the right name for the word but
 * drawn on the wrong letter *within* its ligature: that needs which mark sits on
 * which letter, which is ⑤'s pairing and, past it, an eye (mark-B). This closes
 * the labelling question at the granularity it can reach on its own.
 *
 * ## Honest denominators
 *
 * Every mark lands in exactly one bucket and the buckets sum to the total, so no
 * percentage here is quietly conditioned on a filter — `mark-labels.md` §④'s
 * rule, kept for the same reason. The two ligature-join residuals (a word whose
 * ligatures do not partition its letters, a ligature whose mark count disagrees)
 * are ④'s three-words-in-86,965, not a naming finding; they are counted and set
 * aside, never folded into the agreement rate.
 *
 * Usage:
 *   pnpm probe:mark-names                 # all 604 cached pages
 *   pnpm probe:mark-names --pages 1,2,7   # a fast subset
 *   pnpm probe:mark-names --json          # the machine report
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
import { DRAWN_NAME, align, expected, letters, pairMarks } from "./lib/mark-join.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PIN = join(HERE, "..", "data", "pages", "word-boxes.pin.json");
const OUT = join(HERE, "..", "out", "mark-names.html");

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

// Every mark lands in exactly one of these, and they sum to `marks`.
const seen = {
  agree: 0, //         the ligature's drawn names are exactly what its text calls for
  disagree: 0, //      counts agree, but the drawn name-bag is not the text's — the finding
  countMismatch: 0, // a ligature whose mark count disagrees with its text (④'s residual)
  unalignable: 0, //   a word whose ligatures do not partition its letters (④'s residual)
  orphan: 0, //        a mark the print set under a word but outside every ligature group
  unmapped: 0, //      a token DRAWN_NAME has no entry for — a dictionary gap, never expected
};
let marks = 0;
let words = 0;
let wordsWithMarks = 0;
let ornament = 0; //   words that draw no letters at all — pause marks, sajda signs, ۞

/** Where each kind of thing was found, a few examples kept for the report. */
const disagreements = []; //  { where, wants: [names], drew: [names] }
const unmappedTokens = new Map(); //  token → [count, exampleWhere]
const residualEx = { countMismatch: [], unalignable: [], orphan: [] };
const keep = (arr, v, n = 12) => {
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

  for (const w of perWord) {
    words += 1;
    marks += w.marks.length;
    if (w.marks.length) wordsWithMarks += 1;
    const where = `p${page} ${w.surah}:${w.aya}#${w.idx} “${w.hafs}”`;

    const drawn = w.ligatures.map((l) => l.text).join("");
    if (!drawn) {
      // No letters, so no text to check a name against — an instrument, not a
      // word (the pause marks ۖ ۗ ۘ ۙ ۚ ۛ, the sajda sign, the ۞ rub' al-hizb).
      // Any marks it carries are orphans by definition and counted as such.
      ornament += 1;
      seen.orphan += w.marks.length;
      if (w.marks.length) keep(residualEx.orphan, `${where} (drew no letters)`);
      continue;
    }

    const ls = letters(w.hafs);
    const plan = align(ls, w.ligatures);
    if (!plan) {
      // ④'s partition residual — no naming claim can be made without a join.
      seen.unalignable += w.marks.length;
      keep(residualEx.unalignable, `${where} → [${w.ligatures.map((l) => l.text).join("|")}]`);
      continue;
    }

    let checked = 0;
    for (const step of plan) {
      if (step.redraw) continue; // a second stroke of a letter already drawn — markless by construction
      const lig = w.ligatures[step.lig];
      const tokens = ls.slice(step.from, step.to).flatMap(expected);
      checked += lig.marks.length;
      if (tokens.length !== lig.marks.length) {
        // ④'s counts residual: the text wants a different number of marks than
        // the print drew. A naming question cannot be asked of a count that does
        // not line up, so it is set aside, not scored as a disagreement.
        seen.countMismatch += lig.marks.length;
        keep(
          residualEx.countMismatch,
          `${where} — “${lig.text}” wants ${tokens.length}, drew ${lig.marks.length}`,
        );
        continue;
      }
      if (!tokens.length) continue; // a ligature with no marks agrees vacuously and carries none

      const missing = tokens.find((t) => DRAWN_NAME[t.token] === undefined);
      if (missing) {
        seen.unmapped += lig.marks.length;
        const e = unmappedTokens.get(missing.token) ?? [0, where];
        unmappedTokens.set(missing.token, [e[0] + 1, e[1]]);
        continue;
      }

      const pairing = pairMarks(tokens, lig.marks);
      if (pairing) {
        seen.agree += lig.marks.length;
      } else {
        // The finding ② is about: counts agree, the dictionary names every token,
        // and still the bag of names the print drew is not the bag the text asks
        // for. That is a mark that is the wrong name for this word.
        seen.disagree += lig.marks.length;
        keep(disagreements, {
          where,
          text: lig.text,
          wants: tokens.map((t) => DRAWN_NAME[t.token]),
          drew: lig.marks.map((m) => diacriticName(m[0])),
        });
      }
    }
    // Marks the flat walk found under this word but inside no ligature group.
    const orphan = w.marks.length - checked;
    if (orphan > 0) {
      seen.orphan += orphan;
      keep(residualEx.orphan, `${where} — ${orphan} mark(s) outside every ligature`);
    }
  }
}

const total = seen.agree + seen.disagree + seen.countMismatch + seen.unalignable + seen.orphan + seen.unmapped;
if (total !== marks) {
  // The one invariant that makes every percentage below honest. If it breaks,
  // a mark was double-counted or dropped and no rate on the page can be trusted.
  console.error(`\n  FAIL: buckets sum to ${total} but ${marks} marks were seen — a mark was lost or counted twice\n`);
  process.exit(1);
}

const ms = Date.now() - started;
const checkedForNames = seen.agree + seen.disagree; // the marks a naming verdict was actually reached on
const residual = seen.countMismatch + seen.unalignable + seen.orphan + seen.unmapped;
const clean = seen.disagree === 0 && seen.unmapped === 0;
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(4) : "0.0000");

const report = {
  ran: new Date().toISOString(),
  pages: wanted.length,
  ms,
  words,
  wordsWithMarks,
  ornament,
  marks,
  reachedAVerdict: checkedForNames,
  agree: seen.agree,
  disagree: seen.disagree,
  disagreePct: Number(pct(seen.disagree, checkedForNames)),
  residual: {
    total: residual,
    countMismatch: seen.countMismatch,
    unalignable: seen.unalignable,
    orphan: seen.orphan,
    unmapped: seen.unmapped,
  },
  disagreements,
  unmapped: [...unmappedTokens.entries()].map(([token, [n, where]]) => ({ token, n, where })),
  examples: residualEx,
};

// ── the evidence page ────────────────────────────────────────────────────────

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, surface());
if (wantJson) console.log(JSON.stringify(report, null, 2));
else console.log(text());

// A disagreement, or a token the dictionary cannot name, is a real finding and
// exits non-zero so a run notices. A clean census exits 0. Nothing runs this in
// CI — the corpus is a gitignored cache — so this is a signal to a person, not a
// gate.
process.exit(clean ? 0 : 1);

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}

function surface() {
  const findingRows = disagreements.length
    ? disagreements
        .map(
          (d) =>
            `<tr><td>${esc(d.where)}</td><td>${esc(d.text)}</td><td>${esc(d.wants.join(", "))}</td><td>${esc(
              d.drew.join(", "),
            )}</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="4" class="none">No ligature drew a name its text did not call for.</td></tr>`;

  const residualRow = (label, n, note) =>
    `<tr><td>${label}</td><td class="num">${n.toLocaleString()}</td><td class="pct">${pct(n, marks)}%</td><td class="note">${note}</td></tr>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hifth — does each mark's name agree with its text?</title>
<style>
  :root {
    --ink: #1c1a15; --paper: #fbf9f3; --edge: #e5e0d3; --muted: #6b6656;
    --leaf: #3f7d43; --leaf-wash: rgba(63,125,67,.12);
    --ochre: #a8791d; --ochre-wash: rgba(198,141,20,.14);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ink: #ece7da; --paper: #16150f; --edge: #34302408; --edge: #2c291f; --muted: #9a927d;
      --leaf: #7fb883; --leaf-wash: rgba(63,125,67,.18); --ochre: #d6a94a; --ochre-wash: rgba(198,141,20,.16);
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
  code { background: var(--leaf-wash); padding: .05em .35em; border-radius: 3px; font-size: .9em; }
  footer { color: var(--muted); font-size: .82rem; margin-top: 3rem; border-top: 1px solid var(--edge); padding-top: 1rem; }
</style></head><body><main>

<h1>Does each mark's name agree with the text it belongs to?</h1>
<p class="sub">A census of all ${marks.toLocaleString()} marks in the ligature corpus — every one, not a sample · generated ${esc(
    report.ran,
  )}</p>

<div class="verdict${clean ? "" : " bad"}">
  <b>${
    clean
      ? `All ${checkedForNames.toLocaleString()} marks a verdict was reached on carry a name their own text calls for.`
      : `${seen.disagree.toLocaleString()} mark(s) carry a name their text does not call for${
          seen.unmapped ? `, and ${seen.unmapped.toLocaleString()} sit on a codepoint the dictionary cannot name` : ""
        }.`
  }</b>
  <p style="margin:.5rem 0 0">${
    clean
      ? "The class of error this check exists to find is empty. A mark drawn exactly as its name says, but the wrong name for its word, would show here — none does."
      : "Each is listed below: what the text asks for, beside what the print drew."
  }</p>
</div>

<h2>What is being asked</h2>
<p>Every other check compares a mark to a <em>drawing</em> — is the outline in the right place, does it match the shape of the name it was given. None of them can catch a mark that is drawn perfectly and simply <em>named wrong for the word it sits in</em>: a stroke correctly shaped and labelled a kasra, where the text writes a fatha, passes a drawing check cleanly.</p>
<p>This asks the independent question. The corpus keeps two records of the same fact — the text a word is set in, and the name of every mark drawn on it. For each ligature it checks whether the bag of names the print drew is exactly the bag the text's own marks call for. The table from a written mark to the name the print draws for it is not invented here; it is the one <code>probe:diacritics</code> recovered from the whole corpus and froze, so this reuses a proven map rather than guessing a new one.</p>

<h2>The census</h2>
<table>
  <tr><th>outcome</th><th class="num">marks</th><th class="pct">of those judged</th><th class="note"></th></tr>
  <tr><td>name agrees with the text</td><td class="num big">${seen.agree.toLocaleString()}</td><td class="pct">${pct(
    seen.agree,
    checkedForNames,
  )}%</td><td class="note">the drawn names are exactly what the text asks for</td></tr>
  <tr><td>name the text does not call for</td><td class="num big" style="color:var(--ochre)">${seen.disagree.toLocaleString()}</td><td class="pct">${pct(
    seen.disagree,
    checkedForNames,
  )}%</td><td class="note">the finding — a mark named wrong for its word</td></tr>
</table>

<h2>What could not be judged, and why it is set aside</h2>
<p>A naming verdict can only be reached where the marks line up with the letters. These are the corpus's own join residuals — the same three-in-86,965 <code>probe:diacritics</code> ④ reports — counted here so no rate above is quietly conditioned on a filter, and never mixed into the agreement.</p>
<table>
  <tr><th>set aside</th><th class="num">marks</th><th class="pct">of all marks</th><th class="note">why</th></tr>
  ${residualRow("count disagrees", seen.countMismatch, "the text wants a different number of marks than the print drew")}
  ${residualRow("no letter join", seen.unalignable, "the word's ligatures do not partition its letters")}
  ${residualRow("outside every ligature", seen.orphan, "a mark set under a word but in no ligature group — no text to check against")}
  ${residualRow("codepoint unnamed", seen.unmapped, "the frozen dictionary has no name for this written mark — a gap, not expected")}
</table>

<h2>${clean ? "The findings — none" : "The findings"}</h2>
<table>
  <tr><th>where</th><th>ligature</th><th>text calls for</th><th>print drew</th></tr>
  ${findingRows}
</table>

<h2>What this does <em>not</em> settle</h2>
<p>This is a check on <em>bags</em> — the set of names in a ligature against the set its text asks for. It cannot see a mark that is the right name for the word but drawn on the <em>wrong letter</em> inside its ligature; telling those apart needs which mark sits on which letter, which is the pairing <code>probe:diacritics</code> ⑤ recovers and, past it, a reader's eye. This closes the naming question only at the granularity it can reach without a drawing or a page.</p>

<footer>${report.pages} page(s) · ${marks.toLocaleString()} marks on ${wordsWithMarks.toLocaleString()} of ${words.toLocaleString()} words · ${ornament.toLocaleString()} entries drew no letters · ${ms} ms · the shipped page is not an input to anything here.</footer>
</main></body></html>`;
}

function text() {
  const L = [];
  L.push(`\n  probe:mark-names — ${marks.toLocaleString()} marks on ${wanted.length} page(s), ${ms} ms\n`);
  L.push(`  the question: does each mark carry a name its own text calls for?`);
  L.push(`  (name against carried text — independent of the drawing and of the page)\n`);
  L.push(`  of the ${checkedForNames.toLocaleString()} marks a verdict was reached on:`);
  L.push(`      ${String(seen.agree).padStart(9)}  (${pct(seen.agree, checkedForNames).padStart(8)}%)  agree with the text`);
  L.push(
    `      ${String(seen.disagree).padStart(9)}  (${pct(seen.disagree, checkedForNames).padStart(8)}%)  named wrong for the word  <- the finding`,
  );
  L.push(`\n  set aside (no verdict possible — ④'s join residuals, not a naming finding):`);
  L.push(`      ${String(seen.countMismatch).padStart(9)}  count disagrees`);
  L.push(`      ${String(seen.unalignable).padStart(9)}  no letter join`);
  L.push(`      ${String(seen.orphan).padStart(9)}  outside every ligature`);
  L.push(`      ${String(seen.unmapped).padStart(9)}  codepoint the dictionary cannot name`);
  if (disagreements.length) {
    L.push(`\n  the ${disagreements.length} finding(s):`);
    for (const d of disagreements.slice(0, 20)) {
      L.push(`      ${d.where}`);
      L.push(`        text wants: ${d.wants.join(", ")}`);
      L.push(`        print drew: ${d.drew.join(", ")}`);
    }
  }
  if (unmappedTokens.size) {
    L.push(`\n  tokens the frozen dictionary has no name for:`);
    for (const [token, [n, where]] of unmappedTokens) L.push(`      ${token} × ${n}  e.g. ${where}`);
  }
  L.push(
    `\n  ${
      clean
        ? "clean: no mark carries a name its text does not call for. The class of error is empty."
        : "FINDING: at least one mark is named wrong for its word, or sits on a codepoint the dictionary cannot name."
    }`,
  );
  L.push(`\n  Look at the evidence: ${outPath}\n`);
  return L.join("\n");
}
