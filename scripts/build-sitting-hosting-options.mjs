#!/usr/bin/env node
/**
 * Draws the options for `sitting-hosting`: where the by-eye sittings should live,
 * and where an answer should land the moment somebody gives it.
 *
 * Split in two, for the reason the `decide` skill gives. The evidence for this
 * decision is a build product and a running log — sixteen built sittings and every
 * answer given so far — and neither is committed, nor should be: one is twenty
 * megabytes of cropped page artwork and the other is a person's work-in-progress on
 * whichever machine served them. So:
 *
 *   node scripts/build-sitting-hosting-options.mjs --extract   reads out/, writes the findings
 *   node scripts/build-sitting-hosting-options.mjs             renders from committed bytes only
 *
 * The extract writes a few kilobytes of counts and one real card into
 * `docs/design/sitting-hosting.data.json`, which IS committed, so the page rebuilds
 * on a fresh clone and every number on it can be traced to the run that produced it.
 *
 * One output, not two. The other options pages here write a checked-in copy and a
 * published copy because they reach the mus'haf through a relative URL that the
 * publishing host's policy would block — this page carries its one specimen inline,
 * so the two copies would be byte-identical and a second file would only be a second
 * thing to keep in step.
 *
 * The specimen is outlined paths and no lettering, which is not an aesthetic choice:
 * the vendored print is outlines, this repo ships no Qur'an text, and the fields on a
 * card that DO carry Arabic — the word a mark sits in, the letters under it — are
 * dropped by the extract rather than filtered later.
 *
 * Registered in docs/decisions.json as the `builtBy` for sitting-hosting; the reasons
 * live in docs/decisions/sitting-hosting.md.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const OUT_DIR = join(ROOT, "packages/etl/out");
const DATA = join(ROOT, "docs/design/sitting-hosting.data.json");
const PAGE = join(ROOT, "docs/design/sitting-hosting.html");

// ------------------------------------------------------------------- extract

/**
 * Read the sittings and the answer log, and keep only what an argument needs.
 *
 * Everything here is a count except one card, and the card is here because a reader
 * deciding where a sitting should live has to be able to see what one question looks
 * like. "Sixteen sittings of a hundred and six" is not a picture of anything.
 */
function extract() {
  if (!existsSync(OUT_DIR)) die(`nothing built — ${rel(OUT_DIR)} is not here`);

  const parts = [];
  for (const name of readdirSync(OUT_DIR).filter((n) => n.endsWith(".html"))) {
    const file = join(OUT_DIR, name);
    const text = readFileSync(file, "utf8");
    const head = /^const HEAD = (\{.*\});$/m.exec(text);
    if (!head) continue;
    const parsed = JSON.parse(head[1]);
    if (parsed.built !== "mark-report" || !parsed.part) continue;
    parts.push({ name, bytes: statSync(file).size, head: parsed, text });
  }
  if (!parts.length) die("no built sittings to measure");

  const deal = parts[0].head;
  const bytes = parts.map((p) => p.bytes).sort((a, b) => a - b);

  // One card, from the first part, chosen by position rather than by anything about
  // it — picking the prettiest specimen is how an options page starts arguing.
  const cards = JSON.parse(/^const CARDS = (\[.*\]);$/m.exec(parts[0].text)[1]);
  const c = cards[0];
  const card = { id: c.id, page: c.page, line: c.line, name: c.name, box: c.box, at: c.at, vb: c.vb, svg: c.svg };

  const log = join(OUT_DIR, "mark-answers.jsonl");
  let answers = null;
  if (existsSync(log)) {
    const lines = readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
    const kinds = {};
    const marks = new Set();
    let first = null;
    let last = null;
    let bytesTotal = 0;
    for (const raw of lines) {
      bytesTotal += raw.length + 1;
      const rec = JSON.parse(raw);
      const p = rec.payload || rec;
      if (p.kind) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
      if (p.id) marks.add(p.id);
      if (rec.t) {
        first = first || rec.t;
        last = rec.t;
      }
    }
    answers = {
      statements: lines.length,
      marks: marks.size,
      kinds,
      first,
      last,
      bytesPerStatement: Math.round(bytesTotal / lines.length),
    };
  }

  const data = {
    $comment:
      "Measured findings behind the sitting-hosting options page. Written by scripts/build-sitting-hosting-options.mjs --extract, which reads build products and a running answer log that are deliberately not committed. Hand-editing this would make the page lie about its own evidence.",
    measured: new Date().toISOString().slice(0, 10),
    deal: {
      parts: parts.length,
      pool: deal.pool,
      population: deal.population,
      alreadyAnswered: deal.alreadyAnswered,
      perPart: deal.shown,
      seed: deal.seed,
    },
    bytes: {
      total: bytes.reduce((n, b) => n + b, 0),
      min: bytes[0],
      max: bytes[bytes.length - 1],
      median: bytes[Math.floor(bytes.length / 2)],
      limit: 16 * 1024 * 1024,
    },
    answers,
    card,
  };
  writeFileSync(DATA, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`wrote ${rel(DATA)} — ${data.deal.parts} sittings, ${answers ? answers.statements : 0} statements`);
}

const rel = (p) => p.replace(ROOT, "").replace(/^\//, "");
function die(msg) {
  console.error(`build-sitting-hosting-options — ${msg}`);
  process.exit(1);
}

// -------------------------------------------------------------------- render

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (x) => x.toLocaleString("en-US");
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const kb = (b) => `${Math.round(b / 1024)} KB`;

/**
 * The specimen, at the size a reader actually meets it.
 *
 * Not to scale of the print — to scale of the *card*, which is what is being decided
 * about. The rectangle the sitting asks about is drawn over the ink exactly as the
 * page draws it, in the same four colours that are never re-themed, because a reader
 * judging "is this worth sixteen hours" is judging this rectangle and not a diagram.
 */
function specimen(card) {
  const [vx, vy, vw, vh] = card.vb;
  const [bx, by, bw, bh] = card.at;
  return `<svg class="card" viewBox="${vx} ${vy} ${vw} ${vh}" role="img" aria-label="One question from a sitting: a mark on a printed line, with the rectangle the app draws around it.">
      ${card.svg}
      <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="none" stroke="#c2410c" stroke-width="0.35" stroke-dasharray="1.2 0.8" vector-effect="non-scaling-stroke"/>
    </svg>`;
}

/**
 * An option, drawn as the route an answer takes.
 *
 * The thing being decided is not what the reader looks at — every option shows the
 * same card — it is what happens in the seconds after they answer. So each option is
 * drawn as that journey, with the steps that can fail marked, and the honest failure
 * written under it rather than argued around.
 */
function route(o) {
  const steps = o.route
    .map(
      (s) => `<li class="step ${s.risk ? "risk" : ""}">
          <span class="where">${esc(s.where)}</span>
          <span class="what">${esc(s.what)}</span>
        </li>`,
    )
    .join("\n        ");
  return `<section class="option" id="option-${o.id}">
      <header>
        <span class="tag">${o.id}</span>
        <h3>${esc(o.label)}</h3>
      </header>
      <p class="lede">${o.lede}</p>
      <ol class="route">
        ${steps}
      </ol>
      <dl class="ledger">
        <div><dt>What it takes</dt><dd>${o.takes}</dd></div>
        <div><dt>What it gets</dt><dd>${o.gets}</dd></div>
        <div><dt>What it costs</dt><dd class="cost">${o.costs}</dd></div>
      </dl>
    </section>`;
}

function render(d) {
  const a = d.answers;
  const perMark = a ? (a.statements / a.marks).toFixed(1) : "—";
  const hours = Math.round(d.deal.pool / 106);

  const OPTIONS = [
    {
      id: "A",
      label: "Leave it as it is — one laptop hands out the sittings over a private network",
      lede: `The reader opens a sitting by its address on the household's private network. Every answer is posted back the instant it is given and appended to a file on that laptop, one line per statement — ${a ? n(a.statements) : "—"} lines so far.`,
      route: [
        { where: "The reader's phone", what: "Opens the sitting by its address on the private network" },
        { where: "The laptop", what: "Hands over the page and a one-off pass to post back with", risk: true },
        { where: "The reader's finger", what: "Answers; the page posts it immediately" },
        { where: "The laptop", what: "Appends one line and flushes it before replying" },
        { where: "The repository", what: "A settling run turns the lines into one row per mark" },
      ],
      takes: "The laptop awake and on the network, and the reader on the same network. Nothing installed on either.",
      gets: `Every answer is banked the moment it is given, so a closed laptop or a killed terminal costs at most one statement. The count of what is left falls as the reader works. Rebuilding what nobody has sat is live immediately — the laptop re-reads the files per request.`,
      costs:
        "It is one machine, awake, on one network. Restarting it mints a fresh pass and every page a reader already has open quietly stops banking — the answers keep appearing to send and stop arriving. And the reader must be somewhere that network reaches, which is the constraint this whole question is about.",
    },
    {
      id: "B",
      label: "Publish each sitting as a page, and hand the answers over at the end",
      lede: `Each sitting is already one self-contained file — ${mb(d.bytes.median)} in the middle of the sixteen, against a ${mb(d.bytes.limit)} ceiling — so it can be published as a page and opened from a link, anywhere, with nothing running at home.`,
      route: [
        { where: "The reader's phone", what: "Opens a link. No network to be on, no machine to be awake" },
        { where: "The reader's finger", what: "Answers; the page keeps it in that browser's own store", risk: true },
        { where: "The same browser", what: "Holds every answer until the reader reaches the end", risk: true },
        { where: "The reader", what: "Presses hand over, and moves the file back by hand", risk: true },
        { where: "The repository", what: "A settling run turns the file into one row per mark" },
      ],
      takes: "Nothing running anywhere. One link per sitting, and a way to get the finished file back.",
      gets: "The sitting can be done from any device in any place, and nobody has to keep a machine awake for it. Sixteen links is the whole of the hosting.",
      costs:
        "This is what was in place before the laptop was taught to receive, and it cost a reader an evening twice over. A browser's store belongs to one address: the same machine reached two ways is two memories of the same sitting, and neither can see the other. Nothing is banked until the end, so a cleared browser loses the hour. The count of what is left cannot fall until a file comes back.",
    },
    {
      id: "C",
      label: "Publish each sitting as a page, and let it bank each answer to a hosted table",
      lede: `The same published page, but each answer is written straight to a hosted table through the reader's own connection to it — no laptop in the path, and nothing waiting for the end of the sitting.`,
      route: [
        { where: "The reader's phone", what: "Opens a link. No network to be on, no machine to be awake" },
        { where: "The reader's finger", what: "Answers; the page writes it to the table at once" },
        { where: "The hosted table", what: `Holds it. ${a ? `${n(a.statements)} statements so far, about ${a.bytesPerStatement} bytes each` : "One row per statement"}`, risk: true },
        { where: "Someone at a keyboard", what: "Pulls the rows back down into the same running log", risk: true },
        { where: "The repository", what: "A settling run turns the log into one row per mark" },
      ],
      takes:
        "A table to write to, a shape agreed for what a statement looks like, and a step that pulls the rows back — none of which exists yet. The reader must have the connection to that table set up on the account they read with.",
      gets:
        "Everything the first option gets — answers banked as they are given, at most one statement ever at risk — with none of what it costs. Any device, any place, no machine awake at home.",
      costs:
        "The answers now live on somebody else's host, and a sitting is a scarce person's judgement about a printed page. A page that asks for that connection cannot be handed to just anybody — it is granted by the reader, per reader. It is the only option here that is not already working, and the one whose failure mode nobody has met yet.",
    },
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Where should the sittings live?</title>
<style>
  :root {
    --ink: #1b1a17;
    --ink-soft: #56524a;
    --ink-faint: #8a8479;
    --paper: #faf8f3;
    --raised: #ffffff;
    --rule: #e2ddd1;
    --accent: #9a3412;
    --accent-soft: #fdf1e7;
    --warn: #8a5a00;
    --measure: 34rem;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ink: #ece7dd;
      --ink-soft: #a9a296;
      --ink-faint: #746d62;
      --paper: #171614;
      --raised: #201e1b;
      --rule: #33302b;
      --accent: #e2823f;
      --accent-soft: #2a1d13;
      --warn: #d9a441;
    }
  }
  :root[data-theme="dark"] {
    --ink: #ece7dd;
    --ink-soft: #a9a296;
    --ink-faint: #746d62;
    --paper: #171614;
    --raised: #201e1b;
    --rule: #33302b;
    --accent: #e2823f;
    --accent-soft: #2a1d13;
    --warn: #d9a441;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font: 16px/1.62 ui-serif, Georgia, "Times New Roman", serif;
    -webkit-text-size-adjust: 100%;
  }
  main { max-width: 52rem; margin: 0 auto; padding: clamp(1.5rem, 5vw, 4rem) clamp(1.1rem, 4vw, 2.5rem) 6rem; }
  h1 {
    font-size: clamp(1.9rem, 5.5vw, 2.9rem);
    line-height: 1.1;
    margin: 0 0 .6rem;
    text-wrap: balance;
    letter-spacing: -.015em;
  }
  .standfirst { font-size: 1.12rem; color: var(--ink-soft); max-width: var(--measure); margin: 0 0 1rem; }
  .stamp { font: 500 .76rem/1.4 ui-sans-serif, system-ui, sans-serif; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-faint); }
  h2 {
    font-size: clamp(1.18rem, 3vw, 1.45rem);
    line-height: 1.25;
    margin: 3.4rem 0 .9rem;
    text-wrap: balance;
    padding-top: 1.4rem;
    border-top: 1px solid var(--rule);
  }
  h3 { font-size: 1.1rem; margin: 0; line-height: 1.3; text-wrap: balance; }
  p, li { max-width: var(--measure); }
  p { margin: 0 0 1rem; }
  a { color: var(--accent); }
  strong { font-weight: 600; }
  em { font-style: italic; }

  .glossary { background: var(--raised); border: 1px solid var(--rule); border-radius: .5rem; padding: 1rem 1.2rem; margin: 1.6rem 0 0; }
  .glossary dl { margin: 0; display: grid; gap: .5rem; }
  .glossary dt { font-weight: 600; font-size: .95rem; }
  .glossary dd { margin: 0 0 0 0; color: var(--ink-soft); font-size: .95rem; }

  figure { margin: 1.4rem 0; }
  /* The specimen is a page of the mus'haf, and a printed page is not re-themed.
     These four names are the page's own everywhere else on this document and they
     flip with the reader's theme; inside the card they are pinned to the values the
     sitting itself uses, because the ink and the paper arrive already coloured by
     those names and a dark theme would otherwise print black on black. That is not
     hypothetical — it is the defect this instrument was already fixed for once. */
  .card {
    --paper: #fdfcf9;
    --ink: #231f20;
    width: 100%;
    max-width: 22rem;
    height: auto;
    display: block;
    background: #fdfcf9;
    border: 1px solid var(--rule);
    border-radius: .4rem;
  }
  figcaption { font-size: .88rem; color: var(--ink-soft); margin-top: .55rem; max-width: var(--measure); }

  .figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: .8rem; margin: 1.5rem 0; }
  .fig { background: var(--raised); border: 1px solid var(--rule); border-radius: .5rem; padding: .85rem .95rem; }
  .fig b { display: block; font: 600 1.55rem/1.1 ui-sans-serif, system-ui, sans-serif; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
  .fig span { display: block; font-size: .84rem; color: var(--ink-soft); margin-top: .25rem; }

  .option { background: var(--raised); border: 1px solid var(--rule); border-radius: .6rem; padding: 1.3rem 1.4rem; margin: 1.4rem 0; }
  .option header { display: flex; gap: .8rem; align-items: baseline; margin-bottom: .6rem; }
  .tag {
    flex: none;
    font: 600 .8rem/1 ui-sans-serif, system-ui, sans-serif;
    color: var(--accent);
    background: var(--accent-soft);
    border-radius: .3rem;
    padding: .35rem .5rem;
  }
  .lede { color: var(--ink-soft); margin: 0 0 1rem; }

  ol.route { list-style: none; margin: 0 0 1.1rem; padding: 0; display: grid; gap: 0; }
  .step { display: grid; grid-template-columns: 10.5rem 1fr; gap: .8rem; padding: .5rem 0 .5rem 1.1rem; border-left: 2px solid var(--rule); position: relative; max-width: none; }
  .step::before { content: ""; position: absolute; left: -5px; top: 1.05rem; width: 8px; height: 8px; border-radius: 50%; background: var(--rule); }
  .step.risk { border-left-color: var(--warn); }
  .step.risk::before { background: var(--warn); }
  .where { font: 600 .84rem/1.5 ui-sans-serif, system-ui, sans-serif; color: var(--ink-faint); }
  .what { font-size: .95rem; }
  @media (max-width: 34rem) { .step { grid-template-columns: 1fr; gap: .1rem; } }

  .ledger { margin: 0; display: grid; gap: .7rem; border-top: 1px solid var(--rule); padding-top: .9rem; }
  .ledger div { display: grid; grid-template-columns: 8.5rem 1fr; gap: .8rem; }
  .ledger dt { font: 600 .84rem/1.6 ui-sans-serif, system-ui, sans-serif; color: var(--ink-faint); }
  .ledger dd { margin: 0; font-size: .95rem; }
  .ledger .cost { color: var(--ink); }
  @media (max-width: 34rem) { .ledger div { grid-template-columns: 1fr; gap: .1rem; } }

  .plain { border-left: 3px solid var(--accent); padding: .1rem 0 .1rem 1rem; margin: 1.4rem 0; }
  .plain p:last-child { margin-bottom: 0; }

  ul.reasons { padding-left: 1.1rem; }
  ul.reasons li { margin-bottom: .55rem; }

  footer { margin-top: 4rem; padding-top: 1.2rem; border-top: 1px solid var(--rule); font-size: .85rem; color: var(--ink-faint); }
</style>
</head>
<body>
<main>
  <p class="stamp">A decision this project has not made</p>
  <h1>Where should the sittings live?</h1>
  <p class="standfirst">
    ${n(d.deal.pool)} marks are waiting to be looked at by a person, in ${d.deal.parts} sittings of about
    ${d.deal.perPart} — roughly ${hours} hours of somebody's attention. Today every one of those hours needs a
    particular laptop to be awake, in a particular house. This asks whether it should.
  </p>

  <div class="glossary">
    <dl>
      <dt>Mark</dt>
      <dd>One of the small signs printed above or below a letter — a fatha, a sukun, a madd — that tell a reader how the word is said.</dd>
      <dt>Sitting</dt>
      <dd>One session's worth of questions: about a hundred marks, each drawn on the real printed page, each asking whether the rectangle the app puts around it is in the right place.</dd>
      <dt>Answer</dt>
      <dd>What a reader says about one mark — that it looks right, that the rectangle is the wrong shape, that it is in the wrong place and here is where it should be, or that the print itself is odd here.</dd>
    </dl>
  </div>

  <h2>What is one of these questions, actually?</h2>
  <p>
    This, at about the size it appears on a phone. The printed ink is the mus'haf's own; the dashed rectangle is
    what the app has decided the mark occupies. The reader is asked whether that rectangle is right, and can move
    it, resize it, or say the print itself is unusual here.
  </p>
  <figure>
    ${specimen(d.card)}
    <figcaption>
      One card from the first of the ${d.deal.parts} sittings — a ${esc(d.card.name)} on page ${d.card.page},
      line ${d.card.line}. There are ${n(d.deal.pool)} more.
    </figcaption>
  </figure>

  <h2>Why is this being asked now?</h2>
  <p>
    Because the work is about to get long. ${n(d.deal.alreadyAnswered)} marks have been looked at, over two days,
    on a laptop in the same room as the reader. ${n(d.deal.pool)} are left, and asking for another ${hours} hours
    of the same arrangement means asking somebody to be in one place, with one machine running, every time they
    have twenty spare minutes.
  </p>
  <p>
    Nothing is broken. The arrangement works and has been made steadily harder to get wrong. The question is
    whether it will still be the right arrangement across the next ${hours} hours, or whether it is quietly the
    reason those hours do not happen.
  </p>

  <h2>What happens if nobody decides?</h2>
  <p>
    The sittings carry on exactly as they are, and the cost is real but small: they happen when the reader and the
    laptop are in the same house, and not otherwise. Nothing else is waiting behind this. No feature is blocked,
    no other question depends on it, and the answers already given are not at risk either way.
  </p>
  <p>
    <strong>So this can stay open, and saying so is part of the answer.</strong> If the remaining hours are going
    to happen at a desk at home anyway, the honest choice is the first option and no work at all.
  </p>

  <h2>What does it cost today, measured?</h2>
  <div class="figures">
    <div class="fig"><b>${n(d.deal.pool)}</b><span>marks still to be looked at</span></div>
    <div class="fig"><b>${d.deal.parts}</b><span>sittings, about ${d.deal.perPart} each</span></div>
    <div class="fig"><b>${n(d.deal.alreadyAnswered)}</b><span>looked at so far</span></div>
    ${a ? `<div class="fig"><b>${n(a.statements)}</b><span>things said about them</span></div>` : ""}
    ${a ? `<div class="fig"><b>${perMark}</b><span>said per mark, on average</span></div>` : ""}
    <div class="fig"><b>${mb(d.bytes.median)}</b><span>one sitting, as a single file</span></div>
  </div>
  <p>
    Two of those numbers matter more than the rest. <strong>${a ? perMark : "Several"} statements per mark</strong>
    is what a reader actually does: they nudge a rectangle a step, look, nudge it again, and each nudge is a
    separate thing said. Anything that banks answers one at a time is doing it several times a mark, not once.
  </p>
  <p>
    And <strong>${mb(d.bytes.median)}</strong> is the whole of a sitting — the questions, the printed ink around
    each one, and the page that asks them, in one file that needs nothing else to work. That is what makes the
    other two options possible at all: they are ${mb(d.bytes.min)} to ${mb(d.bytes.max)} apiece against a
    ${mb(d.bytes.limit)} ceiling, so publishing one is not a technical question.
  </p>
  ${
    a
      ? `<p>
    What has been said so far, by kind: ${Object.entries(a.kinds)
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `<strong>${n(v)}</strong> ${esc(k.replace(/-/g, " "))}`)
      .join(" · ")}. Measured over the answers given between ${esc(a.first.slice(0, 10))} and ${esc(a.last.slice(0, 10))}.
  </p>`
      : ""
  }

  <h2>What do other people do about this?</h2>
  <div class="plain">
    <p>
      <strong>Nobody looked, this time.</strong> The comparable question — how projects that ask many people to
      judge many pictures get those judgements home safely — has a large and well-worn literature behind it, in
      crowd-judged science, in map correction, and in the tools built for labelling images. None of it was
      consulted before this page was written, and the page is worse for it.
    </p>
    <p>
      What is worth looking up specifically, if this is going to be decided rather than left: how those tools
      handle a judgement given while the device is offline, and whether they bank each judgement as it is given
      or in batches. That single detail is what separates the three options below, and somebody has certainly
      measured it.
    </p>
  </div>

  <h2>What have we already decided that this has to live inside?</h2>
  <ul class="reasons">
    <li>
      <strong>The sittings exist to answer one open question</strong> — how the app should line up what it draws
      against the printed page. Everything here is in service of that, and if that question were settled tomorrow
      this one would evaporate.
    </li>
    <li>
      <strong>What a reader does inside the app never leaves their device.</strong> That is settled, and it is
      about the app. A sitting is not the app: it is a maintainer's instrument, shown to a handful of people who
      know what they are agreeing to. But the same instinct should be brought to it deliberately rather than
      forgotten, and the third option is the one that has to answer for it.
    </li>
    <li>
      <strong>An answer already given is never at risk.</strong> Whatever is chosen, the ${a ? n(a.statements) : ""}
      statements already banked stay where they are, in a file that is only ever appended to.
    </li>
  </ul>

  <h2>What are the options?</h2>
  <p>
    Each one is drawn as the journey a single answer takes, from the reader's finger to a line checked into the
    project. The amber steps are the ones that can fail. Every option shows the reader the same card — what is
    being decided is what happens in the seconds after they touch it.
  </p>
  ${OPTIONS.map(route).join("\n  ")}

  <h2>What else could be considered, and why is it not here?</h2>
  <ul class="reasons">
    <li>
      <strong>Publish the page, and have it post back to the laptop.</strong> The obvious middle, and it cannot
      work: a published page is served under a policy that blocks it from reaching any other host at all. It
      would not fail loudly — it would simply never arrive.
    </li>
    <li>
      <strong>Put the sittings on the open web with a small service behind them.</strong> A bill, an account, and
      a thing to keep running, for an instrument that will be used by one or two people for perhaps
      ${hours} hours in total. This project ships static files on purpose.
    </li>
    <li>
      <strong>Send the sitting as a file and get it back as a file.</strong> This already works, and it is what
      the second option becomes when nobody publishes anything. It is not listed separately because the only
      difference is whether the reader receives a link or an attachment, and everything that matters after that
      point is identical.
    </li>
  </ul>

  <h2>What would change the answer?</h2>
  <ul class="reasons">
    <li>
      <strong>A sitting done away from home.</strong> If the reader tries and cannot, the first option has been
      measured rather than assumed, and this stops being hypothetical.
    </li>
    <li>
      <strong>The remaining hours not happening.</strong> If ${n(d.deal.pool)} is still ${n(d.deal.pool)} in a
      month, the arrangement is the suspect, whatever anybody thinks of it in principle.
    </li>
    <li>
      <strong>A second reader.</strong> Every option here assumes one person answering. Two people make the
      first option awkward and the third one obvious, because two readers on one laptop's network is not an
      arrangement anybody would choose.
    </li>
    <li>
      <strong>The placement question being settled.</strong> If it is answered on the evidence already in hand,
      the remaining marks stop being urgent and this can be closed unmade.
    </li>
  </ul>

  <h2>What is this not settling?</h2>
  <ul class="reasons">
    <li>
      <strong>Whether the rectangles are right.</strong> That is the question the sittings exist to answer, and
      it has its own page.
    </li>
    <li>
      <strong>What a hosted table would actually hold.</strong> The third option describes a shape that does not
      exist. Choosing it is choosing to design it, not choosing a design.
    </li>
    <li>
      <strong>Anything about the app itself.</strong> No option here changes a single thing a reader of the
      mus'haf would see. This is about the instrument, not the thing it is measuring.
    </li>
  </ul>

  <footer>
    <p>
      Every number on this page was counted out of the sittings and the answers themselves on
      ${esc(d.measured)}, and can be recounted. Nothing here is transcribed and nothing is a mock-up: the ink in
      the specimen is the printed page's own.
    </p>
  </footer>
</main>
</body>
</html>
`;
}

// ----------------------------------------------------------------------- run

if (process.argv.includes("--extract")) {
  extract();
} else {
  if (!existsSync(DATA)) die(`no findings to render — run with --extract first (needs ${rel(OUT_DIR)})`);
  const data = JSON.parse(readFileSync(DATA, "utf8"));
  const html = render(data);
  if (/[؀-ۿ]/.test(html)) die("the page carries Arabic codepoints; the specimen should be outlines only");
  writeFileSync(PAGE, html);
  console.log(`wrote ${rel(PAGE)} — ${kb(Buffer.byteLength(html))}, measured ${data.measured}`);
}
