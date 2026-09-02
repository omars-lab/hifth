#!/usr/bin/env node
/**
 * Render docs/design/notes-export-options.html — the options for keeping a
 * reader's own notes durable and getting a batch of them off the phone, drawn
 * on real anchors from a real page so the decision record
 * `docs/decisions/notes-export.md` argues about a picture a reader can open.
 *
 * This is the export-and-persistence sibling of the confusion-map-export
 * decision: same phone-only / a-file / cloud spine, but for the reader-authored
 * notes the mistake-marking decision would keep, and it draws two things that
 * decision did not — an email as a channel, and what a *batch* of notes looks
 * like when it is legible without shipping the Qur'an.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json            the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/7.svg    the leaf the anchors sit on
 *   apps/web/public/assets/words/hafs-kfqc/7.json   the shipped word boxes
 *   apps/web/src/styles/tokens.css                  the app's sizes and colours
 *
 * ── No reader's text, and no Qur'an ─────────────────────────────────────────
 * A note's label is drawn as a short bar, never words; the print is outlined
 * paths with zero Arabic codepoints; a batch is drawn as verse references,
 * kinds and thumbnails, never scripture. The writer refuses if the output
 * carries an Arabic codepoint or a <text> element with Arabic in it.
 *
 *   node scripts/build-notes-export-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const MANIFEST = join(ROOT, "apps/web/public/assets/manifest.json");
const PAGES = join(ROOT, "apps/web/public/assets/pages/hafs-kfqc");
const WORDS = join(ROOT, "apps/web/public/assets/words/hafs-kfqc/7.json");
const TOKENS_CSS = join(ROOT, "apps/web/src/styles/tokens.css");
const OUT = join(ROOT, "docs/design/notes-export-options.html");

const die = (msg) => { console.error(`build-notes-export-options: ${msg}`); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PAGE = 7;
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [, , VBW, VBH] = manifest.viewBox.split(/\s+/).map(Number);
if (!(VBW > 0 && VBH > 0)) die("manifest viewBox");

const rawSvg = readFileSync(join(PAGES, `${PAGE}.svg`), "utf8");
if (/[\u0600-\u06FF]/.test(rawSvg)) die(`page ${PAGE} carries Arabic codepoints`);
if (/<text\b/.test(rawSvg)) die(`page ${PAGE} carries <text>`);
const leafInner = rawSvg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// The batch: three real notes, on three real verses of page 7, one of each kind.
const wordShard = JSON.parse(readFileSync(WORDS, "utf8"));
const boxOf = (ref, i = 0) => {
  const e = wordShard.words?.[ref] ?? die(`no word boxes for ${ref}`);
  const [x, y, w, h] = e.boxes[i];
  return { x, y, w, h };
};
const NOTES = [
  { ref: "2:38", kind: "correction", anchor: "a word", box: boxOf("2:38", 0) },
  { ref: "2:44", kind: "comment", anchor: "a word", box: boxOf("2:44", 0) },
  { ref: "2:48", kind: "dev", anchor: "a word", box: boxOf("2:48", 0) },
];

// ── Tokens ───────────────────────────────────────────────────────────────────
const tokensCss = readFileSync(TOKENS_CSS, "utf8");
const token = (name) => tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? die(`token --${name}`);
const px = (v) => (v.endsWith("rem") ? Number(v.slice(0, -3)) * 16 : v.endsWith("px") ? Number(v.slice(0, -2)) : die(`unit ${v}`));
const T = {
  space2: px(token("space-2")), space3: px(token("space-3")), space4: px(token("space-4")), space5: px(token("space-5")),
  textXs: token("text-xs"), textSm: token("text-sm"), textMd: token("text-md"),
  radiusLg: token("radius-lg"), radiusMd: token("radius-md"), radiusPill: token("radius-pill"),
  paper: token("paper"), paperRaised: token("paper-raised"), paperSunk: token("paper-sunk"),
  ink: token("ink"), inkSoft: token("ink-soft"), inkFaint: token("ink-faint"), hairline: token("hairline"),
  accentStrong: token("accent-strong"), shadow2: token("shadow-2"), fontLatin: token("font-latin"),
};

const PHONE = { w: 390, h: 844 };

// A tight thumbnail of one anchor box, at a fixed swatch size, outlined-paths only.
const thumb = (b, kind, size = 58) => {
  const p = 16;
  const sub = { x: Math.max(0, b.x - p), y: Math.max(0, b.y - p), w: b.w + 2 * p, h: b.h + 2 * p };
  const h = Math.round((size * sub.h) / sub.w);
  return `<svg class="thumb" viewBox="${sub.x} ${sub.y} ${sub.w} ${sub.h}" width="${size}" height="${h}" role="img" aria-label="anchor on page ${PAGE}"><use href="#p${PAGE}" width="${VBW}" height="${VBH}"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="1.5" fill="none" stroke="var(--k-${kind})" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`;
};

const KIND_LABEL = { comment: "comment", correction: "correction", dev: "to developers" };
const chip = (kind) => `<span class="chip k-${kind}"><span class="dot"></span>${KIND_LABEL[kind]}</span>`;
const bar = (w) => `<span class="bar" style="width:${w}"></span>`;

const phone = (body, caption, chrome) => `
  <figure class="frame phone">
    <div class="screen" style="width:${PHONE.w}px;height:${PHONE.h}px">
      <div class="phone-top">${chrome}</div>
      <div class="stage">${body}</div>
    </div>
    <figcaption>${caption}</figcaption>
  </figure>`;

// ── Q1 · where a batch can go ────────────────────────────────────────────────
const destRow = (icon, title, sub, state) =>
  `<div class="dest ${state}"><span class="dest-i">${icon}</span><div class="dest-t"><b>${title}</b><span>${sub}</span></div><span class="dest-go">${state === "off" ? "needs the phone app" : "→"}</span></div>`;
const q1 = phone(
  `<div class="export-scr">
     <div class="es-head">Your notes · <b>${NOTES.length} on this page</b></div>
     <div class="es-note">Kept in the phone's private storage. Nothing leaves unless you send it.</div>
     ${destRow("🔒", "Keep on the phone only", "Durable here; lost if the phone is", "on")}
     ${destRow("⬇︎", "Save a file", "A copy you keep and can re-import", "on")}
     ${destRow("✉︎", "Send an email", "A batch you mail to yourself or a teacher", "on")}
     ${destRow("☁︎", "Sync to the cloud", "Automatic backup", "off")}
   </div>`,
  `Where a batch of notes can go. A file and an email both take a deliberate tap; the cloud is greyed until there is a phone app to hold an account. "Keep on the phone" is the honest default — durable against a reload, but not against a lost phone.`,
  "Export your notes",
);

// ── Q2 · what a batch contains ───────────────────────────────────────────────
const listRow = (n, withThumb) => `
  <div class="lrow">
    ${withThumb ? thumb(n.box, n.kind) : ""}
    <div class="lr-t">
      <div class="lr-top"><span class="lr-ref">${n.ref}</span> ${chip(n.kind)}</div>
      <div class="lr-anchor">on ${n.anchor}</div>
      <div class="lr-label">${bar("86%")}${bar("60%")}</div>
    </div>
  </div>`;

const q2a = phone(
  `<div class="export-scr"><div class="es-head">Plain list</div>${NOTES.map((n) => listRow(n, false)).join("")}
     <div class="es-foot">Smallest and most private. To see <i>where</i> on the page, open the app.</div></div>`,
  `A · A plain list — the verse, the kind and your label, in words. No picture, so it says nothing on its own about where the note sits; the reader opens the app for that.`,
  "A file · plain list",
);
const q2b = phone(
  `<div class="export-scr"><div class="es-head">List with a picture of each spot</div>${NOTES.map((n) => listRow(n, true)).join("")}
     <div class="es-foot">Legible on its own — the outlined shape shows the spot, with no Qur'an text in the file.</div></div>`,
  `B · The same list, each note carrying a small picture of its spot — the outlined shape only, the way these design pages draw the print, so the file stays readable on its own and still ships no scripture.`,
  "A file · with thumbnails",
);
const q2c = phone(
  `<div class="export-scr"><div class="es-head">A portable annotation file</div>
     <pre class="anno">{
  "target": "page/${PAGE}#xywh=${Math.round(NOTES[0].box.x)},${Math.round(NOTES[0].box.y)},${Math.round(NOTES[0].box.w)},${Math.round(NOTES[0].box.h)}",
  "verse": "${NOTES[0].ref}",
  "kind": "correction",
  "label": "…"
}</pre>
     <div class="es-foot">The standard "this note is about this rectangle of this page" shape. Another tool could read it; a person mostly cannot.</div></div>`,
  `C · A portable file in the standard shape for "a note about this rectangle of this page" — the same selector the app already reached for elsewhere. The most interoperable, the least human-readable.`,
  "A file · annotation format",
);

// ── The options, as prose ────────────────────────────────────────────────────
const channels = [
  { id: "leave-a", key: "A", today: true, title: "Nothing leaves: durable on the phone only",
    gist: "Notes are kept in the phone's own private storage — durable against a reload or closing the app — and never copied off it.",
    takes: "The private-and-local stance the app already holds for everything it remembers.", gets: "The strongest privacy: a record of where a reader's memory slips cannot leak, because it never leaves the one phone.",
    costs: "The phone can still evict the storage after about a week of not opening the app, and a lost phone loses the lot. The owner has already named this cost for the confusion map." },
  { id: "leave-b", key: "B", title: "A file the reader saves and re-imports",
    gist: "A batch the reader downloads to keep, and can load back — the same means the owner leaned toward for the confusion map.",
    takes: "One deliberate export, off by default, plus a way to read the file back in.", gets: "A backup that survives a wiped phone, entirely in the reader's hands, touching no server.",
    costs: "The reader has to remember to do it and to keep the file safe; nothing reminds them, and a file forgotten is a backup that was never made." },
  { id: "leave-c", key: "C", title: "An email the reader sends",
    gist: "The batch composed into an email the reader sends — to themselves, or to a teacher who is helping them revise.",
    takes: "A composed message the reader chooses to send; the same deliberate tap as the file, aimed outward.", gets: "A backup and a way to show a teacher, with no new storage for the app to hold.",
    costs: "An email passes through a mail provider on its way — a bigger privacy step than a file that stays on the phone — so what it carries (Q2) matters most here, and it should never be the default." },
  { id: "leave-d", key: "D", title: "Automatic cloud sync",
    gist: "Every note copied to a cloud account as it is made, so a new phone picks up where the old one left off.",
    takes: "A server, an account, and the always-on copy the rest of the app avoids.", gets: "A backup with no reader effort, and the same notes on every device.",
    costs: "It needs a phone app and an account that do not exist yet, and it crosses the privacy line the app rests on. Blocked, and drawn for the edge of the space." },
];

const shapes = [
  { id: "shape-a", key: "A", title: "A plain list of references",
    gist: "Each note as its verse, its kind and the reader's label, in words. No picture.",
    takes: "Only what the note already is — a reference, a kind, a short label.", gets: "The smallest and most private export; nothing in it but text the reader wrote and a verse number.",
    costs: "It cannot show where on the page the note sits; the reader has to open the app to place it. For an email to a teacher, that is a real gap.", draw: () => q2a },
  { id: "shape-b", key: "B", title: "A list with a picture of each spot",
    gist: "The same list, each note carrying a small outlined picture of the exact spot — the way these design pages draw the print.",
    takes: "The page geometry the app already ships, rendered as a thumbnail per note.", gets: "A file that is legible on its own — a teacher can see the spot — while still shipping no Qur'an text, only outlined shapes.",
    costs: "A larger file, and a picture of the print travels with the note; the rule that the app ships no scripture has to be kept by the same guard these pages use.", draw: () => q2b },
  { id: "shape-c", key: "C", title: "A portable annotation file",
    gist: "The standard machine shape for “a note about this rectangle of this page”, which another tool could read.",
    takes: "The selector the app already reached for when it recorded which region a comparison covers.", gets: "The most interoperable export; a note could move to another reader's app, or a study tool, unchanged.",
    costs: "A person mostly cannot read it, so it answers the backup question but not the show-a-teacher one. It is a format for machines, offered alongside a readable one, not instead of it.", draw: () => q2c },
];

const optHtml = (o) => `
  <section class="opt${o.today ? " today" : ""}" id="${o.id}">
    <div class="opt-head"><span class="opt-key">${o.key}</span><h3>${esc(o.title)}</h3>${o.today ? `<span class="badge-today">today</span>` : ""}</div>
    <div class="opt-body">
      <p class="gist">${o.gist}</p>
      <dl><dt>takes</dt><dd>${o.takes}</dd><dt>gets</dt><dd>${o.gets}</dd><dt>costs</dt><dd>${o.costs}</dd></dl>
      ${o.draw ? `<div class="drawings">${o.draw()}</div>` : ""}
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>How does a batch of a reader's notes leave the phone?</title>
<style>
  :root{
    --bg:#f6f4ef; --panel:#fffdf9; --ink:#211d17; --ink-2:#6a6156; --line:#e3ddd1; --line-soft:#efeae0;
    --accent:#8a6d3b; --accent-soft:#f0e7d6; --lean:#3f6f5f; --lean-soft:#e2efe9;
    --k-comment:#4f6d8a; --k-correction:#b06d1f; --k-dev:#8a4f7d;
  }
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
    --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23; --line-soft:#2a261d;
    --accent:#c8a565; --accent-soft:#332a1a; --lean:#7fb59f; --lean-soft:#1e2b26;
    --k-comment:#8fb0cf; --k-correction:#d99a4e; --k-dev:#c690b8;
  }}
  :root[data-theme="dark"]{
    --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23; --line-soft:#2a261d;
    --accent:#c8a565; --accent-soft:#332a1a; --lean:#7fb59f; --lean-soft:#1e2b26;
    --k-comment:#8fb0cf; --k-correction:#d99a4e; --k-dev:#c690b8;
  }
  *{box-sizing:border-box}
  body{margin:0; background:var(--bg); color:var(--ink); font:16px/1.6 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; -webkit-font-smoothing:antialiased}
  .wrap{max-width:1000px; margin:0 auto; padding:3rem 1.4rem 4rem}
  .eyebrow{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; color:var(--accent); margin:0 0 .5rem}
  h1{font-size:2rem; line-height:1.2; margin:0 0 .8rem; text-wrap:balance}
  h2{font-size:1.35rem; margin:2.6rem 0 .6rem; text-wrap:balance}
  h2.q{font-size:1.7rem; margin-top:3.6rem; padding-top:2rem; border-top:1px solid var(--line)}
  p, li{max-width:68ch}
  .lede{font-size:1.12rem; color:var(--ink-2)}
  a{color:var(--lean)}
  dl.gloss{max-width:68ch; display:grid; grid-template-columns:auto 1fr; gap:.3rem 1rem}
  dl.gloss dt{font-weight:600} dl.gloss dd{margin:0}
  .options{display:flex; flex-direction:column; gap:1.4rem; margin-top:1rem}
  .opt{border:1px solid var(--line); border-radius:16px; background:var(--panel); overflow:hidden}
  .opt.today{border-color:var(--lean)}
  .opt-head{display:flex; align-items:center; gap:.7rem; padding:1rem 1.2rem .2rem}
  .opt-key{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-weight:700; color:#fff; background:var(--accent); width:1.7rem; height:1.7rem; border-radius:50%; display:grid; place-items:center; flex:none}
  .opt-head h3{margin:0; font-size:1.15rem}
  .badge-today{margin-left:auto; font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.66rem; letter-spacing:.08em; text-transform:uppercase; color:var(--lean); background:var(--lean-soft); border-radius:999px; padding:.28rem .6rem}
  .opt-body{padding:.6rem 1.2rem 1.4rem}
  .gist{margin:.2rem 0 .8rem}
  dl{margin:0 0 1rem; display:grid; grid-template-columns:auto 1fr; gap:.3rem .9rem; max-width:68ch}
  dt{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.72rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-2); padding-top:.2rem}
  dd{margin:0}
  .drawings{display:flex; flex-wrap:wrap; gap:1.6rem; align-items:flex-start; margin-top:1rem}
  figure.frame{margin:0; max-width:100%}
  figcaption{font-size:.86rem; color:var(--ink-2); max-width:${PHONE.w}px; margin-top:.6rem; line-height:1.45}
  .screen{position:relative; overflow:hidden; background:${T.paper}; border:1px solid var(--line); border-radius:22px; box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .phone-top{height:52px; display:flex; align-items:center; padding:0 ${T.space4}px; font:600 ${T.textSm}/1 ${T.fontLatin}; color:${T.inkSoft}; background:${T.paperRaised}; border-bottom:1px solid ${T.hairline}}
  .stage{position:relative; font-family:${T.fontLatin}; color:${T.ink}}
  .export-scr{padding:${T.space4}px ${T.space3}px; display:flex; flex-direction:column; gap:${T.space3}px}
  .es-head{font-size:${T.textMd}; font-weight:600}
  .es-note, .es-foot{font-size:${T.textXs}; color:${T.inkSoft}; line-height:1.4}
  .es-foot{border-top:1px solid ${T.hairline}; padding-top:${T.space2}px}

  .dest{display:flex; align-items:center; gap:${T.space3}px; padding:${T.space3}px; background:${T.paperRaised}; border:1px solid ${T.hairline}; border-radius:${T.radiusMd}}
  .dest.off{opacity:.5; border-style:dashed}
  .dest-i{font-size:18px; width:24px; text-align:center}
  .dest-t{flex:1; display:flex; flex-direction:column} .dest-t b{font-size:${T.textSm}} .dest-t span{font-size:${T.textXs}; color:${T.inkSoft}}
  .dest-go{font-size:${T.textXs}; color:${T.accentStrong}; font-family:ui-monospace,monospace; white-space:nowrap}
  .dest.off .dest-go{color:${T.inkFaint}}

  .lrow{display:flex; gap:${T.space3}px; align-items:flex-start; padding:${T.space2}px 0; border-bottom:1px solid ${T.hairline}}
  .thumb{flex:none; border:1px solid ${T.hairline}; border-radius:6px; background:${T.paper}}
  .lr-t{flex:1; display:flex; flex-direction:column; gap:3px}
  .lr-top{display:flex; align-items:center; gap:${T.space2}px}
  .lr-ref{font-family:ui-monospace,monospace; font-size:${T.textSm}; font-weight:600}
  .lr-anchor{font-size:${T.textXs}; color:${T.inkSoft}}
  .lr-label{display:flex; flex-direction:column; gap:4px; margin-top:2px}
  .bar{display:block; height:7px; border-radius:4px; background:${T.inkSoft}; opacity:.26}
  .chip{display:inline-flex; align-items:center; gap:5px; font-size:${T.textXs}; border:1px solid; border-radius:${T.radiusPill}; padding:2px 8px}
  .chip .dot{width:7px; height:7px; border-radius:50%}
  .chip.k-comment{color:var(--k-comment); border-color:var(--k-comment)} .chip.k-comment .dot{background:var(--k-comment)}
  .chip.k-correction{color:var(--k-correction); border-color:var(--k-correction)} .chip.k-correction .dot{background:var(--k-correction)}
  .chip.k-dev{color:var(--k-dev); border-color:var(--k-dev)} .chip.k-dev .dot{background:var(--k-dev)}
  pre.anno{margin:0; padding:${T.space3}px; background:${T.paperSunk}; border:1px solid ${T.hairline}; border-radius:${T.radiusMd}; font:12px/1.5 "SF Mono",ui-monospace,Menlo,monospace; color:${T.ink}; overflow-x:auto; white-space:pre}

  .aside{border-left:3px solid var(--accent); padding:.2rem 0 .2rem 1rem; color:var(--ink-2); margin:1rem 0}
  footer{margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); font-size:.85rem; color:var(--ink-2)}
  .num{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.9em}
  .defs{position:absolute; width:0; height:0; overflow:hidden}
</style>
</head>
<body>
<svg class="defs" aria-hidden="true"><symbol id="p${PAGE}" viewBox="0 0 ${VBW} ${VBH}">${leafInner}</symbol></svg>
<div class="wrap">
  <p class="eyebrow">Hifth · a decision, drawn</p>
  <h1>A reader's notes: how do they survive, and how does a batch of them leave the phone?</h1>
  <p class="lede">Two questions. The pictures below draw three real notes on three verses of page 7 — the note's label as a short bar, its spot as an outlined shape. There is no reader's text and no Qur'an in this page, and none in any export it draws.</p>

  <h2>A few words, defined once</h2>
  <dl class="gloss">
    <dt>A note</dt><dd>What the mistake-marking decision would let a reader keep: a short label pinned to a spot on a page, coloured by kind — a comment, a correction, or a note to the developers.</dd>
    <dt>A batch</dt><dd>All of a reader's notes at once, across pages and verses — what an export or a backup would carry, as opposed to one note.</dd>
    <dt>Durable storage</dt><dd>The phone's own private store that survives closing the app and reloading. It is not a backup: the phone's system can still clear it, and a lost phone takes it.</dd>
    <dt>On the phone only</dt><dd>The app keeps everything in that private store and sends nothing anywhere. This is how everything the app remembers works today.</dd>
    <dt>Provenance / annotation shape</dt><dd>The standard, machine-readable way to record “this note is about this rectangle of this page”, which the app already reached for once.</dd>
  </dl>

  <h2>Why is this being asked now?</h2>
  <p>If the app ever lets a reader keep their own notes, those notes are the first thing it would remember that is <em>expensive</em> to lose — the distilled product of months of revision. The owner has already asked, for the sibling confusion map, that such a record be durable enough to survive clearing the phone's browser data, "with the option of backing up to a downloaded file and re-uploading," and one day a cloud copy. The desktop triage asked the same of marks and comments, and added a channel the map's decision did not draw: an <em>email</em>. Sending a record of where your memory of the Qur'an fails is a bigger privacy step than saving a file, so it is drawn here rather than assumed.</p>

  <h2>What happens if nobody decides?</h2>
  <p>If notes are kept at all, they sit in the phone's durable storage and go nowhere. That works — but the phone can clear that storage after about a week of not opening the app, and a lost phone loses everything. Nothing else is blocked behind this: notes can be made and used with no export at all. Every week it stays open is a week a reader could lose the lot, which is the same cost the confusion map's export decision already names.</p>

  <h2>What have we already decided that touches this?</h2>
  <ul>
    <li><b>Whether a reader keeps notes at all is itself still open.</b> The mistake-marking decision draws that question and its kinds. This one only matters if a note layer is added, and it inherits the kinds from there — a comment, a correction, a note to the developers.</li>
    <li><b>The confusion map's own export is an open decision with the same spine.</b> Keep it on the phone, a file the reader saves, or a cloud switch — the owner leaned toward the file. This page is the sibling for reader-authored notes; it adds the email channel and the question of what a batch <em>contains</em>, which the map (verse references only) never had to answer.</li>
    <li><b>Nothing leaves unless it is in the reader's interest, and under their control.</b> The stance the app is sharpening from a flat “nothing leaves the phone”. A file and an email both pass that test only as a deliberate, off-by-default act.</li>
    <li><b>A private record stays private by construction.</b> The revision record's privacy is a gate, not a good intention. An export path is exactly the “one convenient import away” that gate exists to refuse, so it is built as a deliberate door, never a reflex.</li>
    <li><b>The app ships no Qur'an text.</b> Every shipped file is checked for it. An export that carries a picture of the print carries outlined shapes only, kept honest by the same guard these design pages use.</li>
    <li><b>A note is about a rectangle of a page.</b> The app already reached for the standard annotation shape to record which region a comparison covers. A machine-readable export is that same shape.</li>
  </ul>

  <h2 class="q" id="how-does-a-batch-leave-the-phone">How does a batch of notes leave the phone, if at all?</h2>
  <p>From the private default to the automatic copy the rest of the app avoids. A file and an email are both a deliberate tap; what separates them is that an email travels through a mail provider, which is why the next question matters most for it.</p>
  <div class="drawings">${q1}</div>
  <div class="options">
    ${channels.map(optHtml).join("\n    ")}
  </div>

  <h2 class="q" id="what-does-a-batch-contain">What does a batch contain, so it is legible without shipping the Qur'an?</h2>
  <p>This is the question the confusion map never had to answer, because it only ever carried verse references. A reader's note points at a <em>spot</em>, so an export has to say where the spot is without putting the print's words in the file. Three ways, each drawn as the reader would see it before sending.</p>
  <div class="options">
    ${shapes.map(optHtml).join("\n    ")}
  </div>

  <h2>What do people outside this project do?</h2>
  <p><b>A fresh external scan was not done for this page.</b> Note-taking and habit apps almost universally offer a way out — a file at the least, cloud sync at the most — which is evidence a way out is expected, not that any one is right. The closer reference, how apps that hold a record of religious practice specifically handle export and who a batch is shown to, is the relevant prior art and is owed a proper look before this is settled; the confusion map's own record flags the same gap.</p>

  <h2>What else could be considered, and why is it not here?</h2>
  <ul>
    <li><b>Printing the batch.</b> A paper list for a teacher. A print stylesheet over option B, really, not a separate destination — left off until the readable file exists to print.</li>
    <li><b>Sending straight to a teacher's account.</b> A share between two people's apps, which is a different decision about identity and consent, not a reader backing up their own record.</li>
    <li><b>One combined export with the confusion map.</b> Tempting, since both are private reader records — but the map is auto-recorded and these are authored, and merging their decisions would hide that difference. Kept as siblings that link, not one page.</li>
    <li><b>An always-on local backup to a second file.</b> Belt-and-braces durability with no reader effort; a refinement of A once the phone-only tier is chosen, not a separate answer.</li>
  </ul>

  <h2>What would change the answer?</h2>
  <ul>
    <li>The confusion map's export decision landing on a file — this one would follow it for consistency, and the format question (Q2) would carry straight over.</li>
    <li>A reader saying they revise with a teacher, which weighs toward the email channel and the readable, thumbnailed shape over the plain list.</li>
    <li>A phone app with accounts arriving, which is what unblocks the cloud option.</li>
    <li>The offline store being taught to keep authored text durably, which every option above assumes and none of them builds.</li>
  </ul>

  <h2>What is this not settling?</h2>
  <ul>
    <li>Whether a reader keeps notes at all. That is the mistake-marking decision; this one is conditional on it.</li>
    <li>How the confusion map exports. Its own open decision — this page only borrows its spine and says where it differs.</li>
    <li>Exactly how long the phone keeps a note before eviction, or the file's name and extension. Tuning, not the decision.</li>
    <li>Any sharing between two people. Every option here is a reader moving their <em>own</em> record; showing it to someone else is a separate question.</li>
  </ul>

  <h2>So what is being decided?</h2>
  <p>Two things. First, how a batch of a reader's notes leaves the phone: not at all (A), a file they save and re-import (B), an email they send (C), or automatic cloud sync (D, blocked). Second, only if a batch leaves: what it contains so it is legible without shipping the Qur'an — a plain list of references (A), a list with an outlined picture of each spot (B), or a portable annotation file (C). The email channel and the contents question are what this decision adds over the confusion map's, which it otherwise follows.</p>

  <footer>Rebuilt by <span class="num">scripts/build-notes-export-options.mjs</span> from page ${PAGE}'s shipped word boxes and the app's design tokens, on three real notes across verses ${NOTES.map((n) => n.ref).join(", ")}. The record is <span class="num">docs/decisions/notes-export.md</span>; its sibling is <span class="num">docs/decisions/confusion-map-export.md</span>.</footer>
</div>
</body>
</html>
`;

const arabic = html.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
if (arabic) die(`refusing to write: the page carries ${arabic.length} Arabic codepoint(s)`);
if (/<text\b[^>]*>[^<]*[\u0600-\u06FF]/.test(html)) die("refusing to write: a <text> element carries Arabic");
writeFileSync(OUT, html);
console.log(`wrote ${OUT.replace(ROOT, "")} (${(html.length / 1024).toFixed(0)} KB) — ${NOTES.length} notes across ${NOTES.map((n) => n.ref).join("/")}; channels phone/file/email/cloud, shapes list/thumbnails/annotation`);
