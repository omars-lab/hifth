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
 * and the fingerprint of the deal. This reads those blocks back — through the one
 * reading in `lib/sitting-file.mjs`, shared with the auditor — and adds them up.
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
 * ── Why it also asks the serving side, in the browser ─────────────────────
 *
 * Everything above is true at the moment of the build, and a rebuild drops every
 * answered mark — so at the moment of the build every part is untouched and each
 * one's progress is zero. That is exactly the number a reader cannot use. What
 * they want from a front door is *which part am I in the middle of*, and that
 * question is only answerable from the answers given since the rebuild, which
 * live on the machine doing the serving.
 *
 * So the page asks. It knows which marks each part holds, it fetches everything
 * this machine has heard, and it counts the overlap. Marks in the log that belong
 * to no part on this page are answers from an earlier deal — already subtracted at
 * build time — and dropping them is what stops the page counting them twice.
 *
 * The rule for *which answers still stand* is not restated here. It is one
 * function in `lib/answered.mjs`, written closed over nothing for this reason, and
 * its own source text is inlined into the page. Two runtimes, one reading.
 *
 * ── The stamp, and the address ───────────────────────────────────────────
 *
 * The page says when it was built and against which deal. That is what lets the
 * next person spot in one glance what nobody spotted for a day: a front door older
 * than the rooms behind it.
 *
 * It also knows the one address it is meant to be reached at, and says so when it
 * is being read at another spelling of the same machine. A browser keeps a
 * reader's place per address, compared as text, so the name and the number are two
 * different memories of the same sitting — a trap that has already cost this
 * project an hour of somebody's confidence.
 *
 * Usage:
 *   node packages/etl/scripts/build-sittings-index.mjs [--dir packages/etl/out]
 *   node packages/etl/scripts/build-sittings-index.mjs --answered out/mark-answers.jsonl
 */
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { readAnswered, standingIds } from "./lib/answered.mjs";
import { readSitting } from "./lib/sitting-file.mjs";
import { canonicalAddress } from "./lib/tailnet.mjs";

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

if (!existsSync(DIR)) {
  console.error(`  no such directory: ${DIR}`);
  process.exit(2);
}

// ── Read the sittings back ───────────────────────────────────────────────

const sittings = [];
for (const name of readdirSync(DIR).sort()) {
  if (!name.startsWith("sit.") || !name.endsWith(".html")) continue;
  const s = readSitting(join(DIR, name));
  if (!s) {
    console.error(`  ${name}: no readable header — skipped`);
    continue;
  }
  // A part whose card list is torn still gets listed, because its header carries
  // the counts and dropping it would understate the work left. It cannot show
  // progress, and the fault is printed so the reason is not a mystery.
  for (const fault of s.faults) console.error(`  ${name}: ${fault}`);
  sittings.push({ name, ids: s.ids, ...s.head, mtime: statSync(join(DIR, name)).mtime });
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

/**
 * How far each part has got, as it stands on disk at this moment.
 *
 * Defaulted, unlike the auditor's identical-looking flag, and the difference is
 * the point of each. The auditor delivers a verdict on freshness, so a default
 * there would let it pronounce confidently on a list it invented. This delivers a
 * progress bar which the page re-fetches and overwrites the moment it is opened
 * against a live server — so the cost of reading the wrong file is a number that
 * is briefly stale, and the cost of reading nothing is a page that always opens
 * claiming no work has been done. What it read is printed either way.
 */
const answeredPaths = String(arg("--answered", ""))
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);
if (!answeredPaths.length) {
  const running = join(DIR, "mark-answers.jsonl");
  if (existsSync(running)) answeredPaths.push(running);
}
const standing = answeredPaths.length ? readAnswered(answeredPaths) : new Set();
const progressAt = (s) => s.ids.filter((id) => standing.has(id)).length;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Local time, not UTC. The reader compares this against a file listing on the same
// machine, and a stamp five hours off the listing reads as a stale page when the
// page is fine — which is the exact confusion this line exists to prevent.
const newest = sittings.map((s) => s.mtime).sort((a, b) => b - a)[0];
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

/**
 * One tile per part, carrying its own progress.
 *
 * The tiles used to be bare numbers, which meant the only thing a reader could
 * learn from sixteen of them was that there were sixteen. Every question they
 * actually arrive with — where was I, which of these have I finished, is there any
 * point opening number nine — was unanswerable from the front door, so the way to
 * find out was to open parts until one of them looked familiar.
 *
 * `data-ids` is what lets the page recount itself against the server without
 * asking this script to have been re-run. It is the marks the part holds, and it
 * is the only heavy thing on the page: about twelve bytes a mark, against a
 * megabyte-and-a-third for each of the sittings it links to.
 */
const partRows = parts
  .map((s) => {
    const n = s.part.split("/")[0];
    const done = progressAt(s);
    const of = s.ids.length || s.shown || 0;
    return `  <li><a class="sit part" href="${esc(s.name)}" data-part="${esc(n)}" data-of="${of}" data-ids="${esc(s.ids.join(" "))}">
    <span class="pn">${esc(n)}</span>
    <span class="bar"><i style="width:${of ? Math.round((done / of) * 100) : 0}%"></i></span>
    <span class="pc">${done} of ${of}</span></a></li>`;
  })
  .join("\n");

const bandsSat = bands.filter((s) => (s.alreadyAnswered ?? 0) > 0).length;
const bandCheck = bandsSat
  ? `<strong>${Word(bandsSat)} of the ${word(bands.length)} ${bandsSat === 1 ? "has" : "have"} been started.</strong>`
  : `<strong>Nothing has ever checked that.</strong>`;

const WHERE = canonicalAddress();

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
    --green-soft: #e4efe7;
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
      --green-soft: #16241c;
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
    --green-soft: #16241c;
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
    /* Two taps in quick succession are how this page is used — a reader coming back
       from a part and going straight into the next one — and a phone reads two taps
       a moment apart as an instruction to magnify. manipulation is the ordinary
       behaviour minus that one gesture; pinch still zooms, which is the gesture
       somebody actually wants here. */
    touch-action: manipulation;
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

  /* A grid rather than a row of squares, because each tile now carries a bar and a
     count and a square cannot hold them. It reflows to one column on a narrow
     phone without a breakpoint of its own. */
  .parts {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: 10px;
  }
  a.sit.part {
    display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto;
    gap: 4px 12px; align-items: center; min-height: 72px; padding: 12px 14px;
  }
  .pn {
    grid-row: 1 / 3; font-variant-numeric: tabular-nums;
    font-weight: 600; font-size: 1.5rem; line-height: 1; color: var(--ink);
  }
  .bar {
    align-self: end; height: 6px; border-radius: 3px;
    background: var(--line); overflow: hidden;
  }
  .bar i { display: block; height: 100%; background: var(--amber); }
  .pc {
    align-self: start;
    font: .74rem/1 ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums; color: var(--faint);
  }
  a.sit.part.done { background: var(--green-soft); border-color: var(--green); }
  a.sit.part.done .bar i { background: var(--green); }
  a.sit.part.done .pc { color: var(--green); }
  a.sit.part.here { border-color: var(--amber); box-shadow: inset 0 0 0 1px var(--amber); }

  .first, .warn {
    background: var(--amber-soft); border: 1px solid var(--amber);
    border-radius: 11px; padding: 14px 16px; margin: 0 0 1.3em;
  }
  .first p, .warn p { margin: 0; color: var(--ink); font-size: .94rem; }
  .warn { margin-bottom: 1.6em; }
  .warn code {
    font: .88em ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-all;
  }
  .warn a { color: inherit; }
  #carry { display: none; }
  #carry a { color: inherit; font-weight: 600; }

  .stamp {
    margin-top: 3em; padding-top: 1.1em; border-top: 1px solid var(--line);
    font: .78rem/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--faint);
  }
</style>
</head>
<body>

<div class="warn" id="elsewhere" hidden><p></p></div>

<h1>Which sitting?</h1>

<p class="lede">Each one shows you a mark on a page of the mus'haf with a box drawn around it,
one at a time, and asks whether the box is on the right thing. There is no score and no running
tally — a reader who can see the score answers the score.</p>

<div class="first" id="carry"><p></p></div>

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

<p><strong id="gone">${num(answered)} ${answered === 1 ? "is" : "are"} answered and gone.</strong> What is
left is <strong id="left">${num(shown)}</strong>, cut into ${word(parts.length)} sittings of about ${per}.
Every mark appears in exactly one sitting, so finishing all ${word(parts.length)} means every one
has been seen — not sampled, seen.</p>

<p>The ${word(parts.length)} are re-dealt each time answered marks come out, so a part is a fresh
mix rather than the part of the same number you sat before. Nothing is asked twice and nothing is
dropped.</p>

<p class="cost">${Word(parts.length)} sittings · about ${per} marks each · ${howLong(per)} each</p>

<ul class="parts">
${partRows}
</ul>

<h2>Which address should I open this at?</h2>

<p>${WHERE.onPrivateNetwork
  ? `This one: <strong>${esc(WHERE.host)}</strong>. The Mac answers to other spellings of the same
name, and every one of them is somewhere else entirely as far as a browser is concerned — a
sitting begun at one opens at card one at the other. Nothing is lost when that happens, because
the Mac hands everything back, but the minute of wondering what went wrong is real. Use the same
spelling every time and it never comes up.`
  : `Wherever this page is being served from — the private network is not up on the Mac, so there
is only one address and it only works on the Mac itself. A phone cannot reach these sittings until
that network is running.`}</p>

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
say one thing while the sittings behind the links say another. The bars on the sittings are asked
of the Mac each time this page is opened, so they are current to the second while it is
answering — and frozen at the moment below when it is not. Timings are estimates.</p>

<p class="stamp">built ${esc(stamp)} · deal ${esc(deal?.slice?.split("-").pop() ?? "?")} · ${num(shown)} of ${num(population)} left</p>

<script>
/* The one address this is meant to be read at.

   Only the spellings this machine is known to answer to raise the notice. Anything
   else — a page opened off the filesystem, a tunnel somebody set up on purpose — is
   not a mistake this page can diagnose, and a false alarm on a front door is worse
   than no alarm at all. */
var CANON = ${JSON.stringify(WHERE.onPrivateNetwork ? WHERE.host : null)};
var ALSO = ${JSON.stringify(WHERE.alternates)};
(function () {
  if (!CANON || ALSO.indexOf(location.hostname) < 0) return;
  var box = document.getElementById("elsewhere");
  var url = location.protocol + "//" + CANON + (location.port ? ":" + location.port : "") + location.pathname;
  box.firstElementChild.innerHTML =
    "<strong>You are at a different address than usual.</strong> The Mac answers to " +
    "several names and a browser treats each one as a different place, so a sitting " +
    "begun elsewhere will look untouched here. Open <a href=\\"" + url + "\\"><code>" +
    CANON + "</code></a> instead and everything will be where you left it.";
  box.hidden = false;
})();

/* Which marks each part is holding, so the page can count its own progress. */
var PARTS = [].slice.call(document.querySelectorAll("a.sit.part")).map(function (el) {
  return { el: el, n: el.dataset.part, of: Number(el.dataset.of), ids: el.dataset.ids ? el.dataset.ids.split(" ") : [] };
});

/* Inlined verbatim from lib/answered.mjs — this is that function's own source text,
   not a restatement of it. The builder is the only thing that could put a second
   reading of the word "answered" on this page, and it declines to. */
${standingIds.toString()}

var TOTAL = ${shown};
var ALREADY = ${answered};

/* What was standing when this page was built, so the first paint is the same
   arithmetic as the live one rather than a blank slate that briefly claims no work
   has been done. Only marks that belong to a part on this page: the rest are
   answers from earlier deals, already subtracted from the totals above, and
   counting them again would take the remaining figure below zero. */
var SEEN = ${JSON.stringify([...new Set(parts.flatMap((p) => p.ids.filter((id) => standing.has(id))))])};

function paint(standing) {
  var done = 0;
  var here = null;
  PARTS.forEach(function (p) {
    var n = 0;
    for (var i = 0; i < p.ids.length; i += 1) if (standing.has(p.ids[i])) n += 1;
    done += n;
    p.el.querySelector(".bar i").style.width = (p.of ? Math.round((n / p.of) * 100) : 0) + "%";
    p.el.querySelector(".pc").textContent = n + " of " + p.of;
    p.el.classList.toggle("done", p.of > 0 && n >= p.of);
    p.el.classList.remove("here");
    // Where to carry on: the part somebody is in the middle of. A reader who has
    // started one wants to finish it before starting another, because a part left
    // half-done is the only place the re-deal cannot help them.
    if (!here && p.of > 0 && n > 0 && n < p.of) here = { p: p, n: n };
  });
  if (!here) {
    var fresh = PARTS.filter(function (p) { return p.of > 0 && !p.el.classList.contains("done"); })[0];
    if (fresh) here = { p: fresh, n: 0 };
  }
  if (here) {
    here.p.el.classList.add("here");
    var carry = document.getElementById("carry");
    carry.firstElementChild.innerHTML =
      "<strong>Carry on with sitting " + here.p.n + ".</strong> " +
      (here.n ? "You are " + here.n + " of " + here.p.of + " through it. " : "Nothing has been answered in it yet. ") +
      "<a href=\\"" + here.p.el.getAttribute("href") + "\\">Open it</a>.";
    carry.style.display = "block";
  }
  document.getElementById("left").textContent = (TOTAL - done).toLocaleString("en-US");
  var gone = ALREADY + done;
  document.getElementById("gone").textContent = gone.toLocaleString("en-US") + (gone === 1 ? " is" : " are") + " answered and gone.";
}

paint(new Set(SEEN));

/* And then the live figure, if there is anything listening. A page opened off the
   filesystem, or served by something that only hands out files, keeps the numbers
   above — which are the ones that were true when it was built. */
(function () {
  var S = window.HIFTH_SESSION;
  if (!S || !S.answers) return;
  S.answers("").then(function (got) {
    if (!got || !got.ok) return;
    paint(new Set(standingIds((got.banked || []).concat(got.log || []))));
  }).catch(function () {});
})();
</script>

</body>
</html>
`;

writeFileSync(OUT, html);
console.log(`  index → ${OUT}`);
console.log(`  ${bands.length} band sittings · ${parts.length} parts · ${num(shown)} of ${num(population)} marks left (${num(answered)} answered)`);
if (answeredPaths.length) console.log(`  progress read from ${answeredPaths.map((p) => p.replace(`${DIR}/`, "")).join(", ")} (${standing.size} standing)`);
else console.log(`  no answers on disk to read progress from — every part opens at nothing done`);
console.log(`  address baked in: ${WHERE.onPrivateNetwork ? WHERE.host : "none — the private network is not up"}`);
