/**
 * The decision register, drawn.
 *
 * docs/decisions/README.md is the register's reader's page and it is a table:
 * good for finding the row you came for, useless for the two questions people
 * actually arrive with — *what is still open?* and *what is this one leaning
 * on?* A table cannot show the second at all, because relatedness is a fact
 * about a pair and a table has to pick one row to write it in.
 *
 * So this page draws it. Every decision on one time line, an arc between any
 * two that constrain each other, and a card apiece with its options laid out
 * and the winner marked. The three that nobody has chosen yet come first,
 * because they are the only ones anybody can still act on.
 *
 * NOTHING HERE IS TYPED TWICE. The question comes from the register, which is
 * the only place it is stored; the answer-in-one-line is the record's own H1,
 * read at build time for the reason decisions.mjs states beside titleOf() — a
 * title that lives in two files is a copy that stops being true quietly. The
 * counts, the dates, the arcs and the option strips are all derived. If this
 * page and the register ever disagree, the register is right and this page has
 * not been rebuilt.
 *
 *   node scripts/build-decision-board.mjs
 *
 * Published at https://claude.ai/code/artifact/9a42955e-4c2f-4dc9-8c95-a50942c46a00
 * — the copy to send somebody who does not have this repository. Nothing gates
 * that link, so it is written here rather than in a register that would refuse
 * to let it rot.
 *
 * One pass writes the checked-in copy. It carries no page artwork and no
 * external asset, so unlike the options pages there is nothing to inline and
 * the published copy is the same file.
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";
import { readDecisions, titleOf, splitDoc } from "./decisions.mjs";

const OUT = join(ROOT, "docs/design/decision-board.html");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const n = (v) => Math.round(v * 100) / 100;

/** Words of reasoning behind a decision — the record, less its own scaffolding. */
function weightOf(doc) {
  const { file } = splitDoc(doc);
  const path = join(ROOT, file);
  if (!existsSync(path)) return 0;
  return readFileSync(path, "utf8")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[|#*_`>-]/g, " ")
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w)).length;
}

/** A date the reader can read, from the register's ISO one. */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const dayNum = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
};

const decisions = readDecisions();
const byId = new Map(decisions.map((d) => [d.id, d]));

/** Everything the page needs about one decision, all of it derived. */
const rows = decisions.map((d) => ({
  ...d,
  title: titleOf(splitDoc(d.doc).file),
  words: weightOf(d.doc),
  options: d.options ?? [],
  related: d.related ?? [],
}));

const open = rows.filter((r) => r.status === "open");
const living = rows.filter((r) => r.status === "living");
const settled = rows
  .filter((r) => r.status === "decided" || r.status === "superseded")
  .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

/* ── The time line ───────────────────────────────────────────────────────────
 * Dated decisions sit where they happened; the ones with no date — the three
 * still open and the one that is never finished — are parked to the right of a
 * break, because pretending they have a position on a time line would be the
 * one lie a picture like this can tell.
 */
const W = 1000;
const BASE = 112;
const DATED = { x0: 46, x1: 660 };
const PARKED = { x0: 740, x1: 962 };

const dated = rows.filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date));
const parked = rows.filter((r) => !r.date);
const t0 = dayNum(dated[0].date);
const t1 = dayNum(dated[dated.length - 1].date);

const at = new Map();
let deepest = 0;
{
  const seen = new Map();
  for (const r of dated) {
    const x = DATED.x0 + ((dayNum(r.date) - t0) / Math.max(1, t1 - t0)) * (DATED.x1 - DATED.x0);
    const k = Math.round(x);
    const stack = seen.get(k) ?? 0;
    seen.set(k, stack + 1);
    deepest = Math.max(deepest, stack);
    at.set(r.id, { x, y: BASE + stack * 12 });
  }
  const gap = (PARKED.x1 - PARKED.x0) / Math.max(1, parked.length - 1);
  parked.forEach((r, i) => at.set(r.id, { x: parked.length === 1 ? PARKED.x0 : PARKED.x0 + i * gap, y: BASE }));
}

/* Four decisions were made on one day, and they stack downward from the line.
 * The month labels sit below the deepest of them rather than at a fixed drop —
 * a constant looked right until the day that got a fifth. */
const TICK_Y = BASE + deepest * 12 + 30;
const H = TICK_Y + 14;

/** Every constraint, once. `related` is reciprocal, so half of it is a repeat. */
const arcs = [];
for (const r of rows) {
  for (const other of r.related) {
    if (!byId.has(other) || r.id >= other) continue;
    arcs.push([r.id, other]);
  }
}

const arcPath = ([a, b]) => {
  const p = at.get(a);
  const q = at.get(b);
  const [l, rt] = p.x <= q.x ? [p, q] : [q, p];
  const span = rt.x - l.x;
  const lift = Math.min(84, 14 + span * 0.34);
  const cls =
    byId.get(a).status === "open" || byId.get(b).status === "open" ? "arc arc-live" : "arc";
  return (
    `<path class="${cls}" d="M${n(l.x)} ${n(l.y)} C${n(l.x + span * 0.2)} ${n(l.y - lift)} ` +
    `${n(rt.x - span * 0.2)} ${n(rt.y - lift)} ${n(rt.x)} ${n(rt.y)}"></path>`
  );
};

const dot = (r) => {
  const p = at.get(r.id);
  const label = r.date ? `${esc(r.question)} — decided ${longDate(r.date)}` : esc(r.question);
  return (
    `<a href="#d-${r.id}"><circle class="dot dot-${r.status}" cx="${n(p.x)}" cy="${n(p.y)}" r="5.5">` +
    `<title>${label}</title></circle></a>`
  );
};

const months = [];
{
  const seenM = new Set();
  for (const r of dated) {
    const [y, m] = r.date.split("-").map(Number);
    const key = `${y}-${m}`;
    if (seenM.has(key)) continue;
    seenM.add(key);
    const first = dated.find((x) => x.date.startsWith(`${y}-${String(m).padStart(2, "0")}`));
    months.push({ x: at.get(first.id).x, label: MONTHS[m - 1] });
  }
}

const spine = `
<figure class="spine">
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Every decision on one time line, with an arc between any two that constrain each other.">
    <line class="axis" x1="${DATED.x0 - 24}" y1="${BASE}" x2="${DATED.x1 + 26}" y2="${BASE}"></line>
    <line class="axis axis-parked" x1="${PARKED.x0 - 30}" y1="${BASE}" x2="${PARKED.x1 + 22}" y2="${BASE}"></line>
    ${arcs.map(arcPath).join("")}
    ${rows.map(dot).join("")}
    ${months.map((m) => `<text class="tick" x="${n(m.x)}" y="${TICK_Y}">${m.label}</text>`).join("")}
    <text class="tick tick-parked" x="${n((PARKED.x0 + PARKED.x1) / 2)}" y="${TICK_Y}">no date — still live</text>
  </svg>
  <figcaption>
    Each dot is a decision, on the day it was made. A line between two of them means one
    holds the other up: change either and somebody has to look at both. The four to the right
    of the break have no date because they have no answer yet — three nobody has chosen, and
    one that is never finished by design.
  </figcaption>
</figure>`;

/* ── Cards ────────────────────────────────────────────────────────────────── */

const optionStrip = (r) => {
  if (!r.options.length) {
    return `<p class="no-opts">Written as an argument rather than a menu — it was settled before this register existed, and inventing the choices after the fact would be fiction.</p>`;
  }
  return `<ol class="opts">${r.options
    .map((o) => {
      const won = r.decided === o.id;
      return (
        `<li class="opt${won ? " won" : ""}"><span class="opt-key">${esc(o.id)}</span>` +
        `<span class="opt-label">${esc(o.label)}</span>` +
        `${won ? '<span class="opt-won">chosen</span>' : ""}</li>`
      );
    })
    .join("")}</ol>`;
};

const chips = (r) => {
  const live = r.related.filter((id) => byId.has(id));
  if (!live.length) return "";
  return `<div class="holds">
    <p class="hl">Held up by, and holding up</p>
    <ul class="chip-list">${live
      .map((id) => {
        const o = byId.get(id);
        const label = titleOf(splitDoc(o.doc).file) ?? o.question;
        return `<li><a class="chip${o.status === "open" ? " chip-open" : ""}" href="#d-${id}" title="${esc(o.question)}">${esc(label)}</a></li>`;
      })
      .join("")}</ul>
  </div>`;
};

const links = (r) => {
  const out = [];
  if (r.artifact) out.push(`<a class="go" href="${esc(r.artifact)}">See the options drawn</a>`);
  if (r.page) out.push(`<a href="../../${esc(r.page)}">the same page, kept here</a>`);
  out.push(`<a href="../../${esc(splitDoc(r.doc).file)}">the reasons in full</a>`);
  return `<p class="links">${out.join('<span class="sep">·</span>')}</p>`;
};

const stamp = (r) => {
  if (r.status === "open") return `<span class="pill pill-open">Open · nobody has chosen</span>`;
  if (r.status === "living") return `<span class="pill pill-living">Never finished · added to as it happens</span>`;
  return `<span class="pill">Decided ${r.date ? `${longDate(r.date)}` : ""}${r.by ? ` · ${esc(r.by)}` : ""}</span>`;
};

const card = (r, big) => `
<article class="card${big ? " card-big" : ""}" id="d-${r.id}">
  <div class="card-top">${stamp(r)}<span class="weight">${r.words.toLocaleString("en")} words of reasons</span></div>
  <h3>${esc(r.question)}</h3>
  ${r.title ? `<p class="answer"><span class="al">${r.status === "open" ? "Written up as" : "The answer, in one line"}</span>${esc(r.title)}</p>` : ""}
  ${big ? optionStrip(r) : r.options.length ? optionStrip(r) : ""}
  ${chips(r)}
  ${links(r)}
</article>`;

/* ── The page ─────────────────────────────────────────────────────────────── */

const counts = { open: open.length, settled: settled.length, living: living.length };
const totalWords = rows.reduce((a, r) => a + r.words, 0);
const linked = new Set(arcs.flat()).size;

const html = `<title>Hifth Decision Board</title>
<style>
:root {
  /* The app's own tokens. Every other page about this app's surface borrows
     them, and a board that invented a palette beside them would read as a
     different project's document. */
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
  font-weight: 600; letter-spacing: -0.012em; text-wrap: balance; max-width: 22ch;
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

.spine { margin: 3.2rem 0 0; padding: 0; }
.spine svg { display: block; width: 100%; height: auto; overflow: visible; }
.axis { stroke: var(--rule); stroke-width: 1; }
.axis-parked { stroke-dasharray: 3 4; }
.arc { fill: none; stroke: var(--rule); stroke-width: 1.1; }
.arc-live { stroke: var(--terra); stroke-width: 1.4; opacity: 0.65; }
.dot { fill: var(--accent); stroke: var(--ground); stroke-width: 1.5; transition: r 0.12s ease; }
.dot-open { fill: var(--ground); stroke: var(--terra); stroke-width: 2.2; }
.dot-living { fill: var(--ground); stroke: var(--accent); stroke-width: 2.2; }
.spine a:hover .dot, .spine a:focus-visible .dot { r: 8; }
.tick {
  font-family: var(--mono); font-size: 13px; fill: var(--faint);
  text-anchor: middle; letter-spacing: 0.04em;
}
.tick-parked { fill: var(--terra); }
figcaption { font-size: 0.94rem; color: var(--faint); max-width: 44rem; margin: 1.1rem 0 0; }

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
/* Cards size to their own content — one settled decision carries six options and
   the rest carry none, and a stretched row would give the short ones a foot of
   blank paper to explain. */
.deck-tight { grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); align-items: start; }
.card {
  background: var(--raised); border: 1px solid var(--rule); border-radius: 4px;
  padding: 1.25rem 1.4rem 1.35rem; scroll-margin-top: 1.5rem;
}
.card-big { padding: 1.6rem 1.7rem 1.7rem; }
.card-top {
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between;
  gap: 0.5rem 1rem; margin-bottom: 0.9rem;
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
.card h3 {
  font-size: 1.16rem; line-height: 1.34; margin: 0 0 0.7rem;
  font-weight: 600; text-wrap: pretty;
}
.card-big h3 { font-size: 1.4rem; }
.answer { font-size: 0.99rem; color: var(--soft); margin: 0 0 1rem; }
.al {
  display: block; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--faint); margin-bottom: 0.15rem;
}

.opts { list-style: none; margin: 0 0 1.05rem; padding: 0; display: grid; gap: 0.32rem; }
.opt {
  display: grid; grid-template-columns: 1.55rem 1fr auto; align-items: baseline; gap: 0.55rem;
  padding: 0.42rem 0.6rem; border-radius: 3px; background: var(--sunk);
  font-size: 0.95rem; line-height: 1.42;
}
.opt-key {
  font-family: var(--mono); font-size: 11px; text-align: center; padding: 0.1rem 0;
  border-radius: 999px; background: var(--ground); color: var(--soft);
}
.opt.won { background: var(--accent-soft); }
.opt.won .opt-key { background: var(--accent); color: var(--ground); }
.opt.won .opt-label { font-weight: 600; }
.opt-won {
  font-family: var(--mono); font-size: 10px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--accent-ink);
}
.no-opts { font-size: 0.93rem; color: var(--faint); margin: 0 0 1rem; }

.holds { margin: 0 0 1rem; }
.hl {
  font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--faint); margin: 0 0 0.4rem;
}
.chip-list { list-style: none; display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0; padding: 0; }
.chip {
  display: inline-block; padding: 0.16rem 0.6rem; border-radius: 999px;
  border: 1px solid var(--rule); background: var(--ground);
  font-size: 0.83rem; line-height: 1.5; color: var(--soft); text-decoration: none;
}
.chip:hover { border-color: var(--accent); color: var(--accent-ink); }
.chip-open { border-color: var(--terra); color: var(--terra); }

.links { margin: 0; font-size: 0.92rem; }
.links .sep { color: var(--rule); margin: 0 0.5rem; }
.go { font-weight: 600; }

.note {
  margin-top: 4.6rem; padding-top: 1.5rem; border-top: 1px solid var(--rule);
  font-size: 0.9rem; color: var(--faint); max-width: 46rem;
}
@media (max-width: 34rem) {
  .card-top { flex-direction: column; }
  .opt { grid-template-columns: 1.55rem 1fr; }
  .opt-won { grid-column: 2; }
}
</style>

<div class="wrap">
<header>
  <p class="eyebrow">Hifth · the decision board</p>
  <h1>What has been decided here, and what is still waiting on somebody?</h1>
  <p class="stand">Every question this project has had to answer, on one page: the ones that
  are settled, the ones nobody has chosen yet, and the lines between them that mean two
  answers have to agree. Each card carries the question in plain words, the options as they
  were actually put, and a way through to the drawing and to the reasons.</p>

  <ul class="tally">
    <li class="open"><span class="fig">${counts.open}</span><span class="lab">still open</span></li>
    <li><span class="fig">${counts.settled}</span><span class="lab">decided</span></li>
    <li><span class="fig">${counts.living}</span><span class="lab">never finished</span></li>
    <li><span class="fig">${arcs.length}</span><span class="lab">constraints, across ${linked} of them</span></li>
    <li><span class="fig">${(totalWords / 1000).toFixed(1)}k</span><span class="lab">words of reasons behind it</span></li>
  </ul>

  ${spine}
</header>

<section>
  <div class="col">
    <h2><span class="n">Waiting on you</span>What is still open?</h2>
    <p>These are the only ones anybody can still act on. Each has its options drawn on a real
    page of the mus'haf, at the size they would actually be used, because a wash you cannot
    see at that size is an answer and it is one no paragraph would have given you.</p>
    <p>Nothing here breaks while it stays open — an unanswered question is the normal state of
    a live project. What it costs is written on each one's own page.</p>
  </div>
  <div class="deck">${open.map((r) => card(r, true)).join("")}</div>
</section>

<section>
  <div class="col">
    <h2><span class="n">Never finished</span>What gets added to rather than answered?</h2>
    <p>One record is a running list by design. Every time a choice goes differently on a wide
    window than on a phone, a row goes here with the reason for the difference — and the reason
    is the column it exists for. A table of two behaviours with no reasons is a list of
    inconsistencies.</p>
  </div>
  <div class="deck">${living.map((r) => card(r, false)).join("")}</div>
</section>

<section>
  <div class="col">
    <h2><span class="n">Settled</span>What has already been answered?</h2>
    <p>Newest first. The line under each question is the record's own title, which is the
    answer stated in one sentence — read at build time from the record itself rather than
    copied here, so it cannot quietly stop being true.</p>
  </div>
  <div class="deck deck-tight">${settled.map((r) => card(r, false)).join("")}</div>
</section>

<p class="note">Drawn from this project's decision register on every build. The questions, the
options, the dates, the arcs and the counts are all read from it — nothing on this page is
typed a second time, so if it ever disagrees with the register, the register is right and this
page has not been rebuilt. Rebuild with <code>node scripts/build-decision-board.mjs</code>.</p>
</div>
`;

writeFileSync(OUT, html);
console.log(
  `${OUT.replace(ROOT, "")}  ${(html.length / 1024).toFixed(0)} KB — ` +
    `${rows.length} decisions (${counts.open} open, ${counts.settled} decided, ${counts.living} living), ` +
    `${arcs.length} constraints across ${linked}, ${totalWords.toLocaleString("en")} words of reasons`,
);
