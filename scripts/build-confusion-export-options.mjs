#!/usr/bin/env node
/**
 * Draws the options for `confusion-map-export`: whether a reader can copy their
 * private confusion map off the phone, and by which of two means.
 *
 * One output, not two. The other options pages here keep a checked-in copy and a
 * published copy apart because they reach the mus'haf through a relative URL the
 * publishing host would block. This page carries no mus'haf artwork at all — it draws
 * the backup-and-restore UI and a preview of the backup file — so the two copies
 * would be byte-identical, and a second file would only be a second thing to keep in
 * step. Everything is inlined; there are no external references to block.
 *
 * The feature is not built, so there is no telemetry to extract — the evidence a
 * reader needs is the shape of the backup file and the size it works out to, and both
 * live in the committed data beside this script. The sample map carries verse
 * references only, never Qur'an text, so the rendered page holds zero Arabic
 * codepoints by construction; a guard at the end verifies that before writing.
 *
 * Registered in docs/decisions.json as the `builtBy` for confusion-map-export; the
 * reasons live in docs/decisions/confusion-map-export.md.
 *
 *   node scripts/build-confusion-export-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const DATA = join(ROOT, "docs/design/confusion-map-export.data.json");
const PAGE = join(ROOT, "docs/design/confusion-map-export.html");

const data = JSON.parse(readFileSync(DATA, "utf8"));

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// --------------------------------------------------------------- backup-file preview

/** The bytes a backup file would carry, drawn as pretty JSON a reader can read. */
function backupFilePreview(sample) {
  const map = {
    kind: "hifth-confusion-map",
    saved: "2026-08-29",
    seams: sample.seams.map((s) => ({
      from: s.from,
      to: s.to,
      kind: s.kind,
      state: s.state,
      count: s.count,
    })),
  };
  return JSON.stringify(map, null, 2);
}

function fileSizeLine(sample) {
  const bytes = sample.typicalSeamsPerYear * sample.bytesPerSeam;
  const kb = Math.round(bytes / 1024);
  return `About ${kb} KB for a year of revision — ${esc(sample.fileSizeComparison)}.`;
}

const STATE_LABEL = {
  "every-pass": "every pass",
  sometimes: "sometimes",
  retired: "used to",
  dismissed: "dismissed",
};

// --------------------------------------------------------------- per-option phone mock

function phoneMock(opt) {
  if (opt.mock === "on-device") {
    return `
      <div class="pscreen">
        <div class="pbar">Your confusion map</div>
        <div class="ppad">
          ${opt.mockSeams || seamRows(data.sample.seams.slice(0, 3))}
          <div class="lock">🔒 Stays on this phone. Nothing to send.</div>
          <div class="hint">Install to the home screen to make a silent wipe far less likely.</div>
        </div>
      </div>`;
  }
  if (opt.mock === "file") {
    return `
      <div class="pscreen">
        <div class="pbar">Back up your map</div>
        <div class="ppad">
          <button class="pbtn">⭳ Save a backup</button>
          <button class="pbtn ghost">⭱ Restore from a backup</button>
          <div class="filecard">
            <div class="fcname">📄 hifth-confusion-map.json</div>
            <div class="fcsize">${fileSizeLine(data.sample)}</div>
          </div>
          <div class="hint">The file goes only where you put it — your downloads, your own cloud drive, a memory stick.</div>
        </div>
      </div>`;
  }
  // cloud
  return `
      <div class="pscreen">
        <div class="pbar">Sync</div>
        <div class="ppad">
          <div class="toggle"><span class="tlabel">Keep my map in iCloud</span><span class="tsw on">on</span></div>
          <div class="cloudline">☁ Copied automatically · on all your devices</div>
          <div class="gate">Needs the phone app — not available this year.</div>
          <div class="hint">Your map lives on the cloud provider's servers all the time, not only when you choose.</div>
        </div>
      </div>`;
}

function seamRows(seams) {
  return seams
    .map(
      (s) => `
          <div class="seamrow">
            <span class="sref">${esc(s.from)} → ${esc(s.to)}</span>
            <span class="sstate ${esc(s.state)}">${esc(STATE_LABEL[s.state] || s.state)}</span>
          </div>`
    )
    .join("");
}

// --------------------------------------------------------------- option cards

function optionCard(opt) {
  return `
    <article class="opt${opt.recommended ? " lean" : ""}">
      <div class="opt-head">
        <span class="opt-key">${esc(opt.key)}</span>
        <h3>${esc(opt.name)}</h3>
        ${opt.recommended ? `<span class="badge">the owner's lean</span>` : ""}
      </div>
      <div class="opt-body">
        <div class="phone">${phoneMock(opt)}</div>
        <div class="opt-prose">
          <p class="gist">${esc(opt.gist)}</p>
          <dl>
            <dt>Takes</dt><dd>${esc(opt.takes)}</dd>
            <dt>Gets</dt><dd>${esc(opt.gets)}</dd>
            <dt>Costs</dt><dd>${esc(opt.costs)}</dd>
          </dl>
        </div>
      </div>
    </article>`;
}

// --------------------------------------------------------------- the page

function render() {
  const options = data.options.map(optionCard).join("\n");
  const changes = data.changesTheAnswer.map((c) => `<li>${esc(c)}</li>`).join("\n");
  const preview = esc(backupFilePreview(data.sample));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Copy your confusion map off the phone?</title>
<style>
  :root{
    --bg:#f6f4ef; --panel:#fffdf9; --ink:#211d17; --ink-2:#6a6156; --line:#e3ddd1;
    --line-soft:#efeae0; --accent:#8a6d3b; --accent-soft:#f0e7d6;
    --lean:#3f6f5f; --lean-soft:#e2efe9; --warn:#a4552e; --clay:#a4552e; --amber:#b98a34;
    --teal:#3f6f5f; --code-bg:#f2eee6;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
      --line-soft:#2a261d; --accent:#c8a565; --accent-soft:#332a1a;
      --lean:#7fb59f; --lean-soft:#1e2b26; --warn:#d78a5f; --clay:#d78a5f; --amber:#d8b263;
      --teal:#7fb59f; --code-bg:#26221a;
    }
  }
  :root[data-theme="dark"]{
    --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
    --line-soft:#2a261d; --accent:#c8a565; --accent-soft:#332a1a;
    --lean:#7fb59f; --lean-soft:#1e2b26; --warn:#d78a5f; --clay:#d78a5f; --amber:#d8b263;
    --teal:#7fb59f; --code-bg:#26221a;
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:var(--bg); color:var(--ink);
    font:16px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap{max-width:960px; margin:0 auto; padding:3rem 1.4rem 4rem}
  .mono{font-family:"SF Mono",ui-monospace,"JetBrains Mono",Menlo,Consolas,monospace}
  .eyebrow{
    font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.72rem;
    letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin:0 0 .5rem;
  }
  h1{font-size:2rem; line-height:1.2; margin:0 0 .8rem; text-wrap:balance; letter-spacing:-.01em}
  h2{font-size:1.35rem; margin:2.6rem 0 .6rem; text-wrap:balance}
  .lede{font-size:1.12rem; color:var(--ink-2); max-width:60ch; margin:0 0 .4rem}
  .status{
    display:inline-block; margin-top:1rem; font-family:"SF Mono",ui-monospace,Menlo,monospace;
    font-size:.72rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-2);
    border:1px solid var(--line); border-radius:999px; padding:.3rem .8rem;
  }
  .col{max-width:64ch}
  .qa{margin:1.4rem 0}
  .qa h2{margin-bottom:.3rem}
  .qa p{margin:.4rem 0; max-width:64ch}
  .options{margin-top:1rem; display:flex; flex-direction:column; gap:1.4rem}
  .opt{border:1px solid var(--line); border-radius:16px; background:var(--panel); overflow:hidden}
  .opt.lean{border-color:var(--lean); box-shadow:0 0 0 1px var(--lean)}
  .opt-head{display:flex; align-items:center; gap:.7rem; padding:1rem 1.2rem .2rem}
  .opt-key{
    font-family:"SF Mono",ui-monospace,Menlo,monospace; font-weight:700; font-size:.95rem;
    color:#fff; background:var(--accent); width:1.7rem; height:1.7rem; border-radius:50%;
    display:grid; place-items:center; flex:none;
  }
  .opt.lean .opt-key{background:var(--lean)}
  .opt-head h3{margin:0; font-size:1.15rem}
  .badge{
    margin-left:auto; font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.66rem;
    letter-spacing:.08em; text-transform:uppercase; color:var(--lean);
    background:var(--lean-soft); border-radius:999px; padding:.28rem .6rem; white-space:nowrap;
  }
  .opt-body{display:flex; gap:1.4rem; padding:1rem 1.2rem 1.4rem; flex-wrap:wrap}
  .opt-prose{flex:1 1 300px; min-width:min(100%,300px)}
  .gist{margin:.2rem 0 .8rem}
  dl{margin:0; display:grid; grid-template-columns:auto 1fr; gap:.3rem .9rem}
  dt{
    font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.68rem; letter-spacing:.08em;
    text-transform:uppercase; color:var(--ink-2); padding-top:.15rem;
  }
  dd{margin:0}
  /* phone mock */
  .phone{flex:0 0 auto; width:230px; max-width:100%}
  .pscreen{
    border:1px solid var(--line); border-radius:22px; overflow:hidden; background:var(--bg);
    box-shadow:0 10px 30px rgba(0,0,0,.08);
  }
  .pbar{
    background:var(--accent-soft); color:var(--accent); font-size:.8rem; font-weight:600;
    padding:.6rem .9rem; border-bottom:1px solid var(--line-soft);
  }
  .ppad{padding:.9rem; display:flex; flex-direction:column; gap:.55rem}
  .seamrow{
    display:flex; justify-content:space-between; align-items:center; gap:.5rem;
    font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.78rem;
    padding:.4rem .55rem; border:1px solid var(--line-soft); border-radius:8px; background:var(--panel);
  }
  .sstate{font-size:.64rem; letter-spacing:.04em; padding:.12rem .45rem; border-radius:999px; white-space:nowrap}
  .sstate.every-pass{color:#fff; background:var(--clay)}
  .sstate.sometimes{color:var(--ink); background:var(--amber)}
  .sstate.retired{color:var(--teal); background:var(--lean-soft); border:1px solid var(--teal)}
  .lock{font-size:.82rem; color:var(--ink-2); padding:.3rem .1rem}
  .hint{font-size:.74rem; color:var(--ink-2); line-height:1.45}
  .pbtn{
    appearance:none; border:none; border-radius:10px; padding:.6rem .8rem; font:inherit;
    font-size:.82rem; font-weight:600; color:#fff; background:var(--accent); cursor:default; text-align:center;
  }
  .pbtn.ghost{background:transparent; color:var(--accent); border:1px solid var(--accent)}
  .filecard{border:1px dashed var(--line); border-radius:10px; padding:.6rem .7rem; background:var(--panel)}
  .fcname{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.76rem; margin-bottom:.2rem}
  .fcsize{font-size:.72rem; color:var(--ink-2)}
  .toggle{display:flex; justify-content:space-between; align-items:center; padding:.4rem .1rem}
  .tlabel{font-size:.84rem}
  .tsw{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.66rem; text-transform:uppercase; letter-spacing:.06em; padding:.2rem .5rem; border-radius:999px; background:var(--line-soft); color:var(--ink-2)}
  .tsw.on{background:var(--lean); color:#fff}
  .cloudline{font-size:.78rem; color:var(--ink-2)}
  .gate{font-size:.74rem; color:var(--warn); font-weight:600}
  /* file preview */
  .preview{
    margin:1rem 0 0; background:var(--code-bg); border:1px solid var(--line); border-radius:12px;
    padding:1rem 1.1rem; overflow-x:auto;
  }
  .preview pre{margin:0; font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.82rem; line-height:1.5}
  .caption{font-size:.82rem; color:var(--ink-2); margin:.5rem 0 0}
  ul.changes{max-width:64ch; padding-left:1.1rem}
  ul.changes li{margin:.4rem 0}
  .foot{margin-top:3rem; padding-top:1.2rem; border-top:1px solid var(--line); font-size:.82rem; color:var(--ink-2); max-width:64ch}
  @media (max-width:560px){ .opt-body{flex-direction:column} .phone{width:100%; max-width:260px} }
</style>
</head>
<body>
<main class="wrap">
  <p class="eyebrow">A decision, still open</p>
  <h1>Should a reader be able to copy their confusion map off the phone?</h1>
  <p class="lede">The confusion map is the private record of exactly where one reader's memory slips from a verse onto a similar-sounding one — built up, slip by slip, over months. Today it lives on the phone and nowhere else. Should there be a way to copy it off, and if so, how?</p>
  <span class="status">Open · nobody has chosen yet</span>

  <section class="qa">
    <h2>Why is this being asked now?</h2>
    <p class="col">Reviewing the feature, the app's owner asked that the map survive clearing the phone's browser data, "with the option of backing up to a downloaded file and re-uploading" — and, one day, saved to the cloud. Answering that sharpened the app's own rule. The rule had been read as <em>nothing leaves the phone</em>; the truer form is <em>nothing leaves unless it is in the reader's interest, and under their control</em>. So the question is not whether to break a promise — it is which ways of copying the map off actually serve the reader, and at what cost to them.</p>
  </section>

  <section class="qa">
    <h2>What happens if nobody decides?</h2>
    <p class="col">The map stays on the phone only. That works — but the phone can wipe it silently: on one common phone, a web app left unopened for about a week can have its stored data cleared with no warning and no way back. The map is months of a reader's work, and losing it silently is the exact harm the feature exists to avoid. Nothing else is blocked behind this, so it can wait — but every week it waits is a week a map could vanish.</p>
  </section>

  <section class="qa">
    <h2>What does the map look like, and how big is it?</h2>
    <p class="col">Small. The map stores where each slip goes and how it is doing — references and a few words, never the verses themselves. A backup file is plain text a reader could open and read:</p>
    <div class="preview"><pre>${preview}</pre></div>
    <p class="caption">An illustrative slice — a real map grows to dozens of these over a year. ${fileSizeLine(data.sample)}</p>
  </section>

  <h2>The options</h2>
  <p class="col">Each drawn at phone size, showing what the reader would actually see and do.</p>
  <div class="options">
    ${options}
  </div>

  <section class="qa">
    <h2>What would change the answer?</h2>
    <ul class="changes">
      ${changes}
    </ul>
  </section>

  <section class="qa">
    <h2>What is this not settling?</h2>
    <p class="col">It is not settling whether a teacher could ever see a student's map — that is sending the map to another person, a larger question that deserves its own page. It is not settling the shape of the backup file, whether it is locked with a password, or what it is called — those are the building of the file option, once chosen. And it fixes the cloud option's timing no more precisely than "not this year," because that timing belongs to a different, still-unanswered question about the phone app.</p>
  </section>

  <p class="foot">This page is drawn from committed data and can be rebuilt from scratch; the reasons behind it, in full, live in the project's decision record for this question. Nothing here is chosen — it is put in front of a person so they can choose.</p>
</main>
</body>
</html>
`;
}

// --------------------------------------------------------------- write, with a guard

const html = render();

// This repo ships no Qur'an text. The page is built to carry none; verify before writing.
const arabic = html.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g);
if (arabic) {
  console.error(`refusing to write — page carries ${arabic.length} Arabic codepoint(s): ${[...new Set(arabic)].join(" ")}`);
  process.exit(1);
}

writeFileSync(PAGE, html);
console.log(`wrote ${PAGE.replace(ROOT + "/", "")} (${(html.length / 1024).toFixed(1)} KB, 0 Arabic codepoints)`);
