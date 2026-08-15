/**
 * The front door to the sittings, with counts it cannot get wrong.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 *
 * There was a front door already, and it was hand-written. On 2026-08-15 it was
 * telling a reader that 26 marks were answered and 1,851 were left, cut into
 * sixteen sittings of about 116. Every one of those numbers was false: 167 were
 * answered, 1,710 were left, and the sittings behind the very links on that page
 * held 106 or 107 apiece. The page had not moved since the day it was typed, and
 * the sittings behind it had been rebuilt twice.
 *
 * That is not a typo, it is the shape of the mistake. A page whose numbers are
 * typed is right on the day it is typed and drifts silently every day after,
 * and this one drifts in the direction that costs the most: a reader who is told
 * there are 1,851 marks left budgets sixteen hours against a number that is a day
 * and a hundred and forty-one marks out of date, and nothing on the screen ever
 * admits it. The count is the only reason to open this page rather than the
 * sittings directly.
 *
 * ── Where the numbers come from ──────────────────────────────────────────
 *
 * Every sitting already carries its own census. `build-mark-report.mjs` writes a
 * HEAD block into each emitted page recording the population it was drawn from,
 * how many marks were already answered and so left out, how many it is showing,
 * and the fingerprint of the deal. This reads those blocks back and adds them up.
 *
 * So the page cannot disagree with the sittings it links to, because it is built
 * out of them. Rebuild the sittings, rebuild this, and the two move together. If
 * a sitting is missing from disk it does not appear here — a link to a page that
 * is not there is worse than no link.
 *
 * The one thing it does NOT read out of them is the prose describing each band of
 * confidence. Those are editorial — "barely accepted", "where nine marks in ten
 * live" — and belong to whoever is explaining the plan, not to the data.
 *
 * ── The stamp ────────────────────────────────────────────────────────────
 *
 * The page says when it was built and against which deal. That is what lets the
 * next person spot in one glance what nobody spotted for a day: a front door older
 * than the rooms behind it.
 *
 * Usage:
 *   node packages/etl/scripts/build-sittings-index.mjs [--dir packages/etl/out]
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const DIR = resolve(arg("--dir", new URL("../out", import.meta.url).pathname));
const OUT = join(DIR, arg("--out", "index.html"));

// Roughly what a mark costs a reader, in seconds. Taken from the sittings already
// sat rather than guessed: the hand-written page it replaces put 30 marks at about
// a quarter of an hour and 116 at about an hour, which is the same rate twice.
// It is an estimate and the page says so; it exists to stop somebody opening a
// sitting expecting five minutes.
const SECONDS_PER_MARK = 31;

// The editorial half. Keyed by the band each sitting was built with, because that
// is what the file carries. A band with no entry here still gets listed — under
// its own range, which is ugly and visible, rather than dropped, which is not.
const BANDS = [
  ["0.55-0.65", "Barely accepted", "the weakest matches that were still allowed through"],
  ["0.65-0.75", "Not very sure", "a poor match, but not the worst"],
  ["0.75-0.85", "Fairly sure", "a decent match"],
  ["0.85-0.95", "Sure", "where nine marks in ten live"],
  ["0.95-1.01", "As close as it gets", "near-perfect matches"],
];

const WORDS = [
  "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen", "twenty",
];
const word = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const Word = (n) => { const w = word(n); return w[0].toUpperCase() + w.slice(1); };
const num = (n) => n.toLocaleString("en-US");

// About how long a sitting of n marks takes, said the way a person would say it.
function howLong(n) {
  const mins = Math.round((n * SECONDS_PER_MARK) / 60);
  if (mins < 45) return `about ${Math.round(mins / 5) * 5} minutes`;
  if (mins < 80) return "about an hour";
  return `about ${(mins / 60).toFixed(1).replace(/\.0$/, "")} hours`;
}

// ── Read the sittings back ───────────────────────────────────────────────
//
// Each emitted sitting declares `const HEAD = { … }` in its script. Find the
// declaration and walk braces rather than regexing the object out: the block
// contains nested objects and a regex that got this right would be less readable
// than the loop.
function head(file) {
  const html = readFileSync(file, "utf8");
  const m = /const HEAD\s*=\s*\{/.exec(html);
  if (!m) return null;
  const start = html.indexOf("{", m.index);
  let depth = 0, end = start;
  for (; end < html.length; end++) {
    if (html[end] === "{") depth++;
    else if (html[end] === "}" && --depth === 0) { end++; break; }
  }
  try {
    return JSON.parse(html.slice(start, end));
  } catch {
    return null;
  }
}

if (!existsSync(DIR)) {
  console.error(`  no such directory: ${DIR}`);
  process.exit(2);
}

const sittings = [];
for (const name of readdirSync(DIR).sort()) {
  if (!name.startsWith("sit.") || !name.endsWith(".html")) continue;
  const h = head(join(DIR, name));
  if (!h) {
    console.error(`  ${name}: no readable header — skipped`);
    continue;
  }
  sittings.push({ name, ...h, built: statSync(join(DIR, name)).mtime });
}

const bands = sittings.filter((s) => s.band);
const parts = sittings
  .filter((s) => s.part)
  .sort((a, b) => Number(a.part.split("/")[0]) - Number(b.part.split("/")[0]));

if (!bands.length && !parts.length) {
  console.error(`  no sittings found in ${DIR} — nothing to index`);
  process.exit(1);
}

// ── The fallback census ──────────────────────────────────────────────────
//
// Population, already-answered and pool are properties of the DEAL, not of any one
// part, so they are read off the first part and then checked against the rest. A
// mismatch means the parts on disk are from two different builds, which is the one
// state where an index would quietly mislead about how much work is left.
const deal = parts[0] ?? null;
const mixed = deal
  ? parts.filter((p) => p.slice?.split("-").pop() !== deal.slice?.split("-").pop())
  : [];
if (mixed.length) {
  console.error(`  parts on disk are from more than one deal:`);
  for (const p of [deal, ...mixed]) console.error(`    ${p.name}  ${p.slice}`);
  console.error(`  rebuild all of them before indexing.`);
  process.exit(1);
}

const shown = parts.reduce((t, p) => t + (p.shown ?? 0), 0);
const answered = deal?.alreadyAnswered ?? 0;
const population = deal?.population ?? 0;
const per = parts.length ? Math.round(shown / parts.length) : 0;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Local time, not UTC. The reader compares this against a file listing on the same
// machine, and a stamp five hours off the listing reads as a stale page when the
// page is fine — which is the exact confusion this line exists to prevent.
const newest = sittings.map((s) => s.built).sort((a, b) => b - a)[0];
const pad = (n) => String(n).padStart(2, "0");
const stamp =
  `${newest.getFullYear()}-${pad(newest.getMonth() + 1)}-${pad(newest.getDate())}` +
  ` ${pad(newest.getHours())}:${pad(newest.getMinutes())}`;

// ── The page ─────────────────────────────────────────────────────────────

const bandRows = bands
  .map((s) => {
    const [, title, blurb] = BANDS.find(([id]) => id === s.band) ?? [null, s.band, "a band of confidence"];
    return `  <li><a class="sit" href="${esc(s.name)}">
    <span class="name">${esc(title)}<small>${esc(blurb)}</small></span>
    <span class="n">${num(s.pool ?? 0)}</span></a></li>`;
  })
  .join("\n");

const partRows = parts
  .map((s) => {
    const n = s.part.split("/")[0];
    return `  <li><a class="sit" href="${esc(s.name)}">${esc(n)}</a></li>`;
  })
  .join("\n");

const bandsSat = bands.filter((s) => (s.alreadyAnswered ?? 0) > 0).length;
const bandCheck = bandsSat
  ? `<strong>${Word(bandsSat)} of the ${word(bands.length)} ${bandsSat === 1 ? "has" : "have"} been started.</strong>`
  : `<strong>Nothing has ever checked that.</strong>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Which sitting?</title>
<style>
  :root {
    --ground: #fbfaf7;
    --raised: #ffffff;
    --ink: #16171a;
    --dim: #5c6068;
    --faint: #8b9098;
    --line: #e2e0da;
    --amber: #9a6a10;
    --amber-soft: #f6efdf;
    --green: #2f6b45;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0d0f12;
      --raised: #14171c;
      --ink: #e8e6e1;
      --dim: #a3a8b0;
      --faint: #6f757e;
      --line: #262a31;
      --amber: #d9a441;
      --amber-soft: #24201a;
      --green: #6bbf8e;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0d0f12;
    --raised: #14171c;
    --ink: #e8e6e1;
    --dim: #a3a8b0;
    --faint: #6f757e;
    --line: #262a31;
    --amber: #d9a441;
    --amber-soft: #24201a;
    --green: #6bbf8e;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, sans-serif;
    padding: 24px 18px calc(48px + env(safe-area-inset-bottom));
    max-width: 46rem;
    margin-inline: auto;
    -webkit-text-size-adjust: 100%;
  }

  h1 { font-size: 1.55rem; line-height: 1.2; margin: 0 0 .4em; text-wrap: balance; }
  h2 {
    font-size: 1.15rem; line-height: 1.3; text-wrap: balance;
    margin: 2.4em 0 .3em; padding-top: 1.1em; border-top: 1px solid var(--line);
  }
  p { margin: 0 0 1em; color: var(--dim); }
  p.lede { color: var(--ink); }
  strong { color: var(--ink); font-weight: 600; }

  .cost {
    font: 600 .72rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    letter-spacing: .1em; text-transform: uppercase;
    color: var(--faint); margin: -.2em 0 1.2em;
  }

  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }

  a.sit {
    display: flex; align-items: baseline; gap: 12px;
    min-height: 56px; padding: 13px 15px;
    background: var(--raised); border: 1px solid var(--line); border-radius: 11px;
    color: inherit; text-decoration: none;
  }
  a.sit:active { border-color: var(--amber); }
  a.sit:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }

  .name { flex: 1; font-weight: 600; }
  .name small {
    display: block; font-weight: 400; font-size: .82rem; color: var(--faint);
    letter-spacing: 0; text-transform: none;
  }
  .n {
    font: 600 .8rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums;
    color: var(--faint); white-space: nowrap;
  }

  .parts { flex-direction: row; flex-wrap: wrap; gap: 8px; }
  .parts a.sit {
    flex: 0 0 auto; min-width: 62px; min-height: 54px;
    justify-content: center; align-items: center;
    font-variant-numeric: tabular-nums; font-weight: 600;
  }

  .first {
    background: var(--amber-soft); border-color: var(--amber);
    border-radius: 11px; padding: 14px 16px; margin: 0 0 1.3em;
  }
  .first p { margin: 0; color: var(--ink); font-size: .94rem; }

  .stamp {
    margin-top: 3em; padding-top: 1.1em; border-top: 1px solid var(--line);
    font: .78rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--faint);
  }
</style>
</head>
<body>

<h1>Which sitting?</h1>

<p class="lede">Each one shows you a mark on a page of the mus'haf with a box drawn around it,
one at a time, and asks whether the box is on the right thing. There is no score and no running
tally — a reader who can see the score answers the score.</p>

<h2>Does the machine know which ones it got wrong?</h2>

<p>Every mark carries a number saying how well its box matched the ink underneath. The whole
plan below rests on that number meaning something: that the marks it was least sure about really
are the ones most likely to be wrong. ${bandCheck}</p>

<p>These ${word(bands.length)} sittings check it. Each draws ${word(bands[0]?.shown ?? 0)} marks from a
different level of confidence. If the barely-accepted ones turn out no worse than the near-perfect
ones, the number is not telling us where to look, and there is no point following it through the
sittings below.</p>

<p class="cost">${Word(bands.length)} sittings · ${num(bands[0]?.shown ?? 0)} marks each · ${howLong(bands[0]?.shown ?? 0)} each</p>

<div class="first"><p><strong>Start with the first one.</strong> It is the least convincing
band — if anything is wrong anywhere, it is likeliest to be wrong here.</p></div>

<ul>
${bandRows}
</ul>

<h2>The marks nothing could place</h2>

<p>For <strong>${num(population)} marks</strong> the machine could not find its own ink well enough
to trust, so it fell back to putting them where the printed line said. These are the ones most
likely to be visibly wrong, and they are few enough to look at <em>all</em> of them.</p>

<p><strong>${num(answered)} ${answered === 1 ? "is" : "are"} answered and gone.</strong> What is
left is <strong>${num(shown)}</strong>, cut into ${word(parts.length)} sittings of about ${per}.
Every mark appears in exactly one sitting, so finishing all ${word(parts.length)} means every one
has been seen — not sampled, seen.</p>

<p>The ${word(parts.length)} are re-dealt each time answered marks come out, so a part is a fresh
mix rather than the part of the same number you sat before. Nothing is asked twice and nothing is
dropped.</p>

<p class="cost">${Word(parts.length)} sittings · about ${per} marks each · ${howLong(per)} each</p>

<ul class="parts">
${partRows}
</ul>

<h2>Where do your answers go?</h2>

<p>Two places, both the moment you give the answer — nothing waits for the end. The browser you
are holding keeps its own copy, and the Mac writes the answer down as it arrives.</p>

<p>The Mac's copy is what makes the count come down. Marks you have answered are left out of the
next set of sittings, so the numbers on this page fall as you work rather than staying where they
started.</p>

<p>Under every card there is <strong>Hand over what I have said so far</strong>. It does not end
the sitting and it does not lose your place — it hands over a complete copy of everything you
have said and lets you carry on. Press it whenever you like, as often as you like.</p>

<h2>What if a sitting opens as though you had never touched it?</h2>

<p>It will not stay that way. A browser sometimes loses what it was keeping — most often
because the same sitting was opened at a different address, which counts as somewhere else
entirely as far as the browser is concerned. When that happens the page asks the Mac for
everything you have said, puts every corrected box back where you put it, and drops you one
card past the last one you answered. Give it a second; it will tell you how many came back.</p>

<p>So <strong>nothing you have answered is ever lost by opening the wrong link</strong>. What
does not come back is anything you gave while the Mac was asleep and have not handed over
since — that lives only in the browser you gave it in.</p>

<h2>What if it offers you a download instead?</h2>

<p>Then the Mac is not hearing you, and that browser holds the only copy of what you have said.
Keep the file — it has everything, including anything that did not reach the Mac.</p>

<p>The likeliest reason is a page that was already open before the Mac started listening. Reload
it and carry on; your answers and your place both survive a reload.</p>

<p>While it is offering downloads it also cannot give a sitting back to you, so a sitting the
browser has forgotten will stay forgotten until the Mac is answering again.</p>

<h2>Does it work while the Mac is asleep?</h2>

<p>No. The pages are served from it, so if it sleeps they stop loading until it wakes, and it
stops hearing answers while it is out. A sitting already open on the screen keeps working and
keeps its own copy of everything you say — so what a sleeping Mac costs you is the next page you
try to load, not the hour you have already spent. Press <strong>Hand over what I have said so
far</strong> once it is awake again and the two are back in step.</p>

<h2>Are these numbers current?</h2>

<p>They are counted out of the sittings themselves rather than typed here, so this page cannot
say one thing while the sittings behind the links say another. Timings are estimates. The newest
sitting on this machine was built at the moment below; if that is older than the last time the
sittings were rebuilt, this page was not rebuilt with them.</p>

<p class="stamp">built ${esc(stamp)} · deal ${esc(deal?.slice?.split("-").pop() ?? "?")} · ${num(shown)} of ${num(population)} left</p>

</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`  index → ${OUT}`);
console.log(`  ${bands.length} band sittings · ${parts.length} parts · ${num(shown)} of ${num(population)} marks left (${num(answered)} answered)`);
