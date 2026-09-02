#!/usr/bin/env node
/**
 * Render docs/design/bookmark-fold-options.html — the options for a bookmark a
 * reader drops by tapping the book's fold, drawn on a real page at phone size so
 * the decision record `docs/decisions/bookmark-fold.md` argues about a picture a
 * reader can open rather than a paragraph.
 *
 * Two questions:
 *   1. Is a bookmark one ribbon that moves, or many the reader drops and lifts?
 *   2. Where is a bookmark kept, so tapping the fold still means something next
 *      week — the address bar, the phone's private store, or the store plus a
 *      way to carry it off?
 * The ribbon itself — hung from the head of the page, dropping downward — is the
 * owner's own description, drawn as a small filmstrip so the motion is shown,
 * not argued.
 *
 * ── What it reads (committed bytes only) ────────────────────────────────────
 *   apps/web/public/assets/manifest.json            the print's viewBox
 *   apps/web/public/assets/pages/hafs-kfqc/7.svg    the leaf the ribbon sits on
 *   apps/web/src/styles/tokens.css                  the app's sizes and colours
 *
 * ── No Qur'an ───────────────────────────────────────────────────────────────
 * The print is outlined paths with zero Arabic codepoints; the ribbons are CSS
 * over the leaf, never text. The writer refuses if the output carries an Arabic
 * codepoint or a <text> element.
 *
 *   node scripts/build-bookmark-fold-options.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const MANIFEST = join(ROOT, "apps/web/public/assets/manifest.json");
const PAGES = join(ROOT, "apps/web/public/assets/pages/hafs-kfqc");
const TOKENS_CSS = join(ROOT, "apps/web/src/styles/tokens.css");
const OUT = join(ROOT, "docs/design/bookmark-fold-options.html");

const die = (msg) => { console.error(`build-bookmark-fold-options: ${msg}`); process.exit(1); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PAGE = 7;
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const [, , VBW, VBH] = manifest.viewBox.split(/\s+/).map(Number);
if (!(VBW > 0 && VBH > 0)) die("manifest viewBox");

const rawSvg = readFileSync(join(PAGES, `${PAGE}.svg`), "utf8");
if (/[\u0600-\u06FF]/.test(rawSvg)) die(`page ${PAGE} carries Arabic codepoints`);
if (/<text\b/.test(rawSvg)) die(`page ${PAGE} carries <text>`);
const leafInner = rawSvg.replace(/^[\s\S]*?<svg\b[^>]*>/, "").replace(/<\/svg>\s*$/, "");

// ── Tokens ───────────────────────────────────────────────────────────────────
const tokensCss = readFileSync(TOKENS_CSS, "utf8");
const token = (name) => tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? die(`token --${name}`);
const px = (v) => (v.endsWith("rem") ? Number(v.slice(0, -3)) * 16 : v.endsWith("px") ? Number(v.slice(0, -2)) : die(`unit ${v}`));
const T = {
  space2: px(token("space-2")), space3: px(token("space-3")), space4: px(token("space-4")),
  textXs: token("text-xs"), textSm: token("text-sm"), textMd: token("text-md"),
  radiusMd: token("radius-md"), radiusPill: token("radius-pill"),
  paper: token("paper"), paperRaised: token("paper-raised"),
  ink: token("ink"), inkSoft: token("ink-soft"), inkFaint: token("ink-faint"), hairline: token("hairline"),
  accentStrong: token("accent-strong"), fontLatin: token("font-latin"),
};

const PHONE = { w: 340, h: 588 };
const LEAF_H = Math.round((PHONE.w * VBH) / VBW);

// The leaf, rendered to fill the phone width, as a non-interactive backdrop.
const leaf = () =>
  `<svg class="leaf" viewBox="0 0 ${VBW} ${VBH}" width="${PHONE.w}" height="${LEAF_H}" role="img" aria-label="a page of the mus'haf"><use href="#p${PAGE}" width="${VBW}" height="${VBH}"/></svg>`;

// A ribbon hung from the head of the page at horizontal position `left` (px from
// the phone's left edge), dropping to `len` px, with a swallowtail foot.
const ribbon = (left, { len = 132, tone = "one", label = "", num = "" } = {}) => `
  <div class="ribbon r-${tone}" style="left:${left}px;height:${len}px" role="img" aria-label="bookmark ribbon${num ? ` on page ${num}` : ""}">
    ${num ? `<span class="rib-num">${num}</span>` : ""}
    ${label ? `<span class="rib-tag">${label}</span>` : ""}
  </div>`;

const foldHint = () => `<div class="fold-hint" aria-hidden="true"><span class="fh-line"></span><span class="fh-label">tap the fold</span></div>`;

const phone = (body, caption, chrome, { tall = false } = {}) => `
  <figure class="frame phone">
    <div class="screen" style="width:${PHONE.w}px;height:${tall ? PHONE.h + 40 : PHONE.h}px">
      <div class="phone-top">${chrome}</div>
      <div class="stage">${leaf()}${body}</div>
    </div>
    <figcaption>${caption}</figcaption>
  </figure>`;

// ── Q1 · one ribbon, or many ─────────────────────────────────────────────────
const q1a = phone(
  `${ribbon(268, { tone: "one", num: "7" })}${foldHint()}`,
  `A · One ribbon. There is always exactly one — tapping the fold moves it to the page in front of you, the way a single sewn ribbon marks where you stopped. Nothing to name, nothing to manage.`,
  "One place",
);
const q1b = phone(
  `${ribbon(96, { tone: "many", num: "7" })}${ribbon(176, { tone: "many-2", len: 108, num: "22" })}${ribbon(256, { tone: "many-3", len: 150, num: "58" })}
   <div class="shelf">4 saved places</div>${foldHint()}`,
  `B · Many ribbons. Tapping the fold drops one on this page; tapping again lifts it. Several coexist, a shelf of places you return to — a passage you are memorising, a sūrah you revise on Fridays.`,
  "A shelf of places",
);
const q1c = phone(
  `${ribbon(268, { tone: "here", num: "7", label: "here" })}${ribbon(120, { tone: "many", len: 116, num: "31" })}${ribbon(196, { tone: "many-2", len: 96, num: "44" })}
   <div class="shelf">here + 2 saved</div>${foldHint()}`,
  `C · Both. One ribbon follows you on its own — where you are right now — and beside it sit the ones you dropped by hand. The automatic “here” answers resume-reading; the manual ones answer saving a place on purpose.`,
  "Here, plus saved",
);

// ── The ribbon's arrival, as a filmstrip ─────────────────────────────────────
const DROP_W = Math.round(PHONE.w * 0.62);
const dropFrame = (len, note) => `
  <div class="dropcol">
    <div class="dropstage">${leaf()}<div class="ribbon r-one drop" style="left:${Math.round(DROP_W * 0.58)}px;height:${len}px"></div></div>
    <span class="dropcap">${note}</span>
  </div>`;
const filmstrip = `
  <div class="film">
    ${dropFrame(10, "fold tapped")}
    ${dropFrame(70, "ribbon unrolls")}
    ${dropFrame(132, "settles, page held")}
  </div>`;

// ── Q2 · where a bookmark is kept ────────────────────────────────────────────
const keptScreen = (rows) => `<div class="kept">${rows}</div>`;
const keptRow = (icon, title, sub, state) =>
  `<div class="krow ${state}"><span class="ki">${icon}</span><div class="kt"><b>${title}</b><span>${sub}</span></div></div>`;

const q2a = phone(
  `${ribbon(268, { tone: "one", num: "7" })}
   <div class="url-bar"><span class="url-ic">🔗</span><span class="url-txt">…/hifth#p7</span><span class="url-share">share</span></div>`,
  `A · In the address. A bookmark is the link in the address bar — the same place the app keeps your spot today. You can send it to yourself or a friend, but close the tab without keeping the link and it is gone. It survives nothing on its own.`,
  "A link you keep",
);
const q2b = phone(
  `${ribbon(268, { tone: "one", num: "7" })}
   ${keptScreen(keptRow("🔖", "Kept on this phone", "Beside your revision record", "on") + keptRow("↻", "Survives closing the app", "Back next time you open it", "on") + keptRow("⏳", "May be cleared if idle ~a week", "The phone can reclaim the space", "warn"))}`,
  `B · In the phone's private store, beside the revision record. It comes back when you reopen the app, touches no server, and is seen by no one. Its one weakness is the phone's own housekeeping: after about a week unopened, the phone may reclaim the space — the same fragility the revision calendar already admits.`,
  "Kept on this phone",
);
const q2c = phone(
  `${ribbon(268, { tone: "one", num: "7" })}
   ${keptScreen(keptRow("🔖", "Kept on this phone", "Durable across reloads", "on") + keptRow("⬇︎", "Carried off in a batch", "A file you save, with your notes", "on") + keptRow("☁︎", "One day, synced", "When there is a phone app to hold it", "off"))}`,
  `C · The private store, plus a way to carry it off. The same durable place as B, but a bookmark rides along in the same batch your notes leave in — a file you keep, or one day a sync. This is not a new decision so much as bookmarks joining the export question already open for notes and the confusion map.`,
  "Kept, and portable",
);

// ── Options, as prose ────────────────────────────────────────────────────────
const models = [
  { id: "model-a", key: "A", title: "One ribbon that moves",
    gist: "Exactly one bookmark, ever. Tapping the fold moves it to the page in front of you.",
    takes: "The smallest possible model — a single page reference the fold overwrites.",
    gets: "Nothing to name, nothing to manage, no way to accumulate clutter. It answers the one question most readers have: where did I stop?",
    costs: "It cannot hold two places at once. A reader memorising one passage while revising another has to choose which the ribbon marks." },
  { id: "model-b", key: "B", title: "Many ribbons you drop and lift",
    gist: "Tapping the fold drops a bookmark on this page; tapping again lifts it. Several coexist.",
    takes: "A small collection the reader adds to and removes from, and somewhere to see the collection.",
    gets: "A shelf of places to return to — the passages of an active revision, each a tap away. This is what most digital reading apps mean by a bookmark.",
    costs: "It needs a place to manage the collection (the future activity calendar is where clearing them is already planned), and with no “current place” it does not by itself answer resume-reading." },
  { id: "model-c", key: "C", title: "One that follows you, plus ones you place",
    gist: "An automatic “here” ribbon that moves on its own, alongside the manual ones the reader drops.",
    takes: "Both of the above: a moving current-place marker and a managed collection, told apart by colour.",
    gets: "Resume-reading and saved places at once, each answered by the mechanism suited to it — the app already records where you have been, so “here” is nearly free.",
    costs: "Two kinds of ribbon on one page is more to explain, and the reader has to learn that one moves by itself and the others do not." },
];

const stores = [
  { id: "store-a", key: "A", title: "In the address", today: true,
    gist: "A bookmark is the link in the address bar — where the app keeps your spot today.",
    takes: "Nothing new: the reading position already lives in the address.",
    gets: "Shareable by construction — a bookmark is a link you can send to yourself or a friend.",
    costs: "It survives nothing on its own. Close the tab without keeping the link and the bookmark is gone; this is exactly why the app forgets your page on a cold open today." },
  { id: "store-b", key: "B", title: "In the phone's private store", lean: true,
    gist: "Kept on the phone beside the revision record, seen by no one, back when you reopen the app.",
    takes: "A durable place on the phone, next to the record the calendar already reads.",
    gets: "The bookmark comes back across reloads and closing the app, touches no server, and stays private.",
    costs: "The phone can reclaim the space after about a week unopened — the same fragility the revision calendar admits and handles by owning up to the gap, not by pretending there is none." },
  { id: "store-c", key: "C", title: "Kept, and carried off in a batch",
    gist: "The durable store of B, plus a bookmark riding along when the reader's notes leave the phone.",
    takes: "The private store, and a seat in the export batch the notes and confusion-map decisions are already drawing.",
    gets: "A bookmark that survives a lost phone, restored from the same file the notes are, with no separate machinery.",
    costs: "It inherits the open export question wholesale — nothing to settle here until that one lands, so this is really B with a promise, not a third independent answer." },
];

const optHtml = (o) => `
  <section class="opt${o.today ? " today" : ""}${o.lean ? " lean" : ""}" id="${o.id}">
    <div class="opt-head"><span class="opt-key">${o.key}</span><h3>${esc(o.title)}</h3>${o.today ? `<span class="badge b-today">today</span>` : ""}${o.lean ? `<span class="badge b-lean">the honest default</span>` : ""}</div>
    <div class="opt-body">
      <p class="gist">${o.gist}</p>
      <dl><dt>takes</dt><dd>${o.takes}</dd><dt>gets</dt><dd>${o.gets}</dd><dt>costs</dt><dd>${o.costs}</dd></dl>
    </div>
  </section>`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>A bookmark you drop by tapping the fold: one ribbon or many, and where is it kept?</title>
<style>
  :root{
    --bg:#f6f4ef; --panel:#fffdf9; --ink:#211d17; --ink-2:#6a6156; --line:#e3ddd1;
    --accent:#8a6d3b; --lean:#3f6f5f; --lean-soft:#e2efe9; --warn:#a8641c;
    --rib-one:#b23a3a; --rib-here:#3f6f5f; --rib-2:#5a6ea8; --rib-3:#8a6d3b;
  }
  @media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
    --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
    --accent:#c8a565; --lean:#7fb59f; --lean-soft:#1e2b26; --warn:#d99a4e;
    --rib-one:#d05a5a; --rib-here:#7fb59f; --rib-2:#8fa0d0; --rib-3:#c8a565;
  }}
  :root[data-theme="dark"]{
    --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
    --accent:#c8a565; --lean:#7fb59f; --lean-soft:#1e2b26; --warn:#d99a4e;
    --rib-one:#d05a5a; --rib-here:#7fb59f; --rib-2:#8fa0d0; --rib-3:#c8a565;
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
  .opt.today{border-color:var(--accent)} .opt.lean{border-color:var(--lean)}
  .opt-head{display:flex; align-items:center; gap:.7rem; padding:1rem 1.2rem .2rem; flex-wrap:wrap}
  .opt-key{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-weight:700; color:#fff; background:var(--accent); width:1.7rem; height:1.7rem; border-radius:50%; display:grid; place-items:center; flex:none}
  .opt-head h3{margin:0; font-size:1.15rem}
  .badge{margin-left:auto; font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.66rem; letter-spacing:.08em; text-transform:uppercase; border-radius:999px; padding:.28rem .6rem}
  .b-today{color:var(--accent); background:color-mix(in srgb, var(--accent) 15%, transparent)}
  .b-lean{color:var(--lean); background:var(--lean-soft)}
  .opt-body{padding:.6rem 1.2rem 1.4rem}
  .gist{margin:.2rem 0 .8rem}
  dl{margin:0; display:grid; grid-template-columns:auto 1fr; gap:.3rem .9rem; max-width:68ch}
  dt{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.72rem; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-2); padding-top:.2rem}
  dd{margin:0}
  .drawings{display:flex; flex-wrap:wrap; gap:1.6rem; align-items:flex-start; margin-top:1.2rem}
  figure.frame{margin:0; max-width:100%}
  figcaption{font-size:.86rem; color:var(--ink-2); max-width:${PHONE.w}px; margin-top:.6rem; line-height:1.45}
  .screen{position:relative; overflow:hidden; background:${T.paper}; border:1px solid var(--line); border-radius:22px; box-shadow:0 10px 30px rgba(0,0,0,.12)}
  .phone-top{height:44px; display:flex; align-items:center; padding:0 ${T.space4}px; font:600 ${T.textSm}/1 ${T.fontLatin}; color:${T.inkSoft}; background:${T.paperRaised}; border-bottom:1px solid ${T.hairline}}
  .stage{position:relative; font-family:${T.fontLatin}; color:${T.ink}}
  .leaf{display:block; width:100%; height:auto}

  .ribbon{position:absolute; top:-2px; width:26px; border-radius:0 0 3px 3px; box-shadow:2px 2px 5px rgba(0,0,0,.18); display:flex; flex-direction:column; align-items:center; padding-top:6px;
          clip-path:polygon(0 0,100% 0,100% 100%,50% 84%,0 100%)}
  .ribbon.r-one{background:var(--rib-one)} .ribbon.r-here{background:var(--rib-here)}
  .ribbon.r-many{background:var(--rib-one)} .ribbon.r-many-2{background:var(--rib-2)} .ribbon.r-many-3{background:var(--rib-3)}
  .rib-num{color:#fff; font:700 11px/1 ${T.fontLatin}; opacity:.95}
  .rib-tag{position:absolute; top:5px; color:#fff; font:600 8px/1 ${T.fontLatin}; letter-spacing:.04em; writing-mode:vertical-rl; transform:rotate(180deg); margin-top:16px; text-transform:uppercase; opacity:.9}
  .shelf{position:absolute; left:8px; bottom:8px; font:600 ${T.textXs}/1 ${T.fontLatin}; color:${T.ink}; background:${T.paperRaised}; border:1px solid ${T.hairline}; border-radius:${T.radiusPill}; padding:5px 10px}
  .fold-hint{position:absolute; left:50%; top:0; bottom:0; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; pointer-events:none}
  .fh-line{flex:1; width:0; border-left:1px dashed color-mix(in srgb, var(--accent) 55%, transparent)}
  .fh-label{position:absolute; bottom:12px; font:600 ${T.textXs}/1 ${T.fontLatin}; color:var(--accent); background:${T.paperRaised}; border:1px solid ${T.hairline}; border-radius:${T.radiusPill}; padding:4px 9px; white-space:nowrap}

  .url-bar{position:absolute; left:8px; right:8px; bottom:10px; display:flex; align-items:center; gap:7px; background:${T.paperRaised}; border:1px solid ${T.hairline}; border-radius:${T.radiusPill}; padding:7px 10px}
  .url-ic{font-size:12px} .url-txt{flex:1; font:12px/1 ui-monospace,monospace; color:${T.inkSoft}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
  .url-share{font:600 ${T.textXs}/1 ${T.fontLatin}; color:${T.accentStrong}}
  .kept{position:absolute; left:8px; right:8px; bottom:10px; display:flex; flex-direction:column; gap:6px}
  .krow{display:flex; align-items:center; gap:9px; background:${T.paperRaised}; border:1px solid ${T.hairline}; border-radius:${T.radiusMd}; padding:7px 9px}
  .krow.warn{border-color:color-mix(in srgb, var(--warn) 55%, ${T.hairline})}
  .krow.off{opacity:.5; border-style:dashed}
  .ki{font-size:14px; width:18px; text-align:center}
  .kt{display:flex; flex-direction:column} .kt b{font:600 ${T.textSm}/1.2 ${T.fontLatin}} .kt span{font:${T.textXs}/1.3 ${T.fontLatin}; color:${T.inkSoft}}
  .krow.warn .ki{color:var(--warn)}

  .film{display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-start; margin-top:1rem}
  .dropcol{display:flex; flex-direction:column; align-items:center; gap:.5rem}
  .dropstage{position:relative; width:${Math.round(PHONE.w * 0.62)}px; overflow:hidden; border:1px solid var(--line); border-radius:12px; background:${T.paper}}
  .dropstage .leaf{width:${Math.round(PHONE.w * 0.62)}px; height:auto}
  .dropstage .ribbon{width:20px}
  .dropcap{font:${T.textXs}/1.2 ${T.fontLatin}; color:var(--ink-2)}

  footer{margin-top:3rem; padding-top:1rem; border-top:1px solid var(--line); font-size:.85rem; color:var(--ink-2)}
  .num{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.9em}
  .defs{position:absolute; width:0; height:0; overflow:hidden}
</style>
</head>
<body>
<svg class="defs" aria-hidden="true"><symbol id="p${PAGE}" viewBox="0 0 ${VBW} ${VBH}">${leafInner}</symbol></svg>
<div class="wrap">
  <p class="eyebrow">Hifth · a decision, drawn</p>
  <h1>A bookmark you drop by tapping the fold — is it one ribbon or many, and where is it kept?</h1>
  <p class="lede">The pictures below draw the ribbon on a real page of the mus'haf at phone size. There is no Qur'an text in this page — the print is outlined shapes, and the ribbons are drawn over them. Two questions: what a bookmark <em>is</em>, and where it <em>lives</em> so tapping the fold still means something a week later.</p>

  <h2>A few words, defined once</h2>
  <dl class="gloss">
    <dt>The fold</dt><dd>The crease down the middle of the open book, between the two facing pages. Tapping it is the gesture that drops the bookmark — near the reader's thumb, and belonging to neither page more than the other.</dd>
    <dt>A ribbon</dt><dd>The bookmark itself, drawn like the sewn ribbon of a printed mus'haf: a strip that hangs from the head of the page and drops downward to mark it.</dd>
    <dt>The revision record</dt><dd>What the app already keeps privately on the phone: a log of the pages you have opened, which a calendar reads. A bookmark would sit beside it.</dd>
    <dt>Resume-reading</dt><dd>Coming back and being returned to where you last were, with no effort. Different from saving a place on purpose.</dd>
    <dt>The address</dt><dd>The link in the browser's address bar. It is where the app keeps your current page today, and it is lost when you close the tab without keeping the link.</dd>
  </dl>

  <h2>Why is this being asked now?</h2>
  <p>The book has no way to mark a place. A reader who finds the passage they are memorising, closes the app, and comes back is not returned to it — the app remembers your page only in the address bar, and a fresh open with no link starts at the beginning. A bookmark dropped at the fold is the natural fix, and the owner has asked for it specifically: a ribbon you drop by tapping the fold, animating downward, with every bookmark action written to the calendar. Two things have to be decided before it can be built — what a bookmark is, and where it is kept.</p>

  <h2>What happens if nobody decides?</h2>
  <p>The reader keeps losing their place. It is not fatal — the address bar can be bookmarked in the browser, and a determined reader keeps a link — but it asks the reader to do the app's job, and it is the plainest gap a hafiz meets on the second day of use. Nothing large is blocked behind it; the activity calendar's bookmark-management corner is, since there is nothing to manage until this exists.</p>

  <h2>What does the app do today, and what is it costing?</h2>
  <p>There are <strong>no bookmarks at all</strong>. Your current page is written only into the address, so it survives a reload of the same tab but not a cold open — reopen the app fresh and you land on the default page, not your last one. The one durable, private thing the app keeps is the revision record — the log of pages you have opened — and even that is honest that the phone may clear it after about a week unopened. So the status quo is not “a weak bookmark”; it is none, on top of a reading position that itself does not persist. The fold, meanwhile, already exists as a brief page-turn animation — but it is not something you can tap, so the gesture is new.</p>

  <h2>What do people outside this project do?</h2>
  <p>The strongest reference is the object itself: a printed mus'haf often carries one to three sewn ribbons, and a reader moves them by hand. That is real evidence about readers — it says a small number of movable places is the familiar shape, and that “move the one ribbon” is a gesture people already know — but it does not transfer whole, because a phone has no thickness for a ribbon to sit in and no cost to holding fifty. <strong>A fresh scan of how other digital Qur'an apps handle bookmarks was not done for this page.</strong> The general pattern in reading apps — many named bookmarks, managed in a list — is worth a proper look before this is settled, and is owed the same honest note the sibling decisions carry.</p>

  <h2>What have we already decided that touches this?</h2>
  <ul>
    <li><b>A private record stays private by construction, and lives on the phone.</b> A bookmark is a reader's record like the confusion map and the notes, so it inherits the same stance — kept on the phone, nothing leaving by reflex — and the same iOS fragility the revision calendar already owns up to.</li>
    <li><b>How a batch of reader records leaves the phone is open.</b> The <a href="#">notes-export</a> and confusion-map decisions draw the file-or-cloud question; a bookmark is small enough to ride along rather than start its own, which is the whole of the third storage option below.</li>
    <li><b>The fold belongs to the open book, not to one leaf.</b> The page-turn work already established that the crease crosses the spine and is owned by the book, which is exactly the element a tap-target would attach to — the gesture has a home already.</li>
    <li><b>A marker points at a place on a page.</b> The pin-marker decision settled how a marker sits on the page; a ribbon is a coarser marker — a whole page, not a spot — and should not contradict how markers already read.</li>
    <li><b>The app ships no Qur'an text.</b> This page draws the print as outlined shapes and the ribbon as colour over them, kept honest by the same guard the other design pages use.</li>
  </ul>

  <h2 class="q" id="is-a-bookmark-one-ribbon-that-moves-or-many-the-reader-drops-and-lifts">Is a bookmark one ribbon that moves, or many the reader drops and lifts?</h2>
  <p>This is the fork everything else hangs on — the storage shape, the gesture's meaning, whether there is anything to “manage” later. Each option is drawn on the same real page; the dashed line marks the fold the reader taps.</p>
  <div class="drawings">${q1a}${q1b}${q1c}</div>
  <p>However it is answered, the ribbon arrives the way the owner described it — unrolling downward from the head of the page and settling. Drawn small, on the real leaf, so the motion is shown rather than promised:</p>
  ${filmstrip}
  <div class="options">${models.map(optHtml).join("\n")}</div>

  <h2 class="q" id="where-is-a-bookmark-kept-so-tapping-the-fold-still-means-something-next-week">Where is a bookmark kept, so tapping the fold still means something next week?</h2>
  <p>A bookmark the reader trusts has to be there when they come back. Today's answer — the address bar — is drawn first because it is the honest baseline, and it is the one that does not survive being closed.</p>
  <div class="drawings">${q2a}${q2b}${q2c}</div>
  <div class="options">${stores.map(optHtml).join("\n")}</div>

  <h2>What else could we consider, and why is it not here?</h2>
  <ul>
    <li><b>A different gesture than tapping the fold.</b> A long-press on the page, a button in the bar. Left off because the fold is what the owner asked for and what a printed ribbon teaches — this page decides what the fold's tap <em>does</em>, not whether the fold is the gesture.</li>
    <li><b>Naming or colouring bookmarks by hand.</b> A refinement of the many-ribbons model, not a separate answer; it belongs to the management corner in the activity calendar, once there is a collection to name.</li>
    <li><b>Auto-bookmarking every page you open.</b> The revision record already does exactly that, privately. A bookmark is the reader saying “this one on purpose”, which is the opposite of automatic — folding them together would lose that distinction.</li>
    <li><b>A bookmark that marks a verse, not a page.</b> Finer than the fold gesture can express — you tap the crease between two whole pages, not a line — and closer to the pin-marker decision's territory than to this one.</li>
  </ul>

  <h2>What would change the answer?</h2>
  <ul>
    <li>A reader saying they keep several places at once — a memorising passage and a revision sūrah — which weighs the model toward many ribbons or both.</li>
    <li>The notes-export decision landing, which decides for free whether a bookmark can be carried off the phone (the third storage option).</li>
    <li>The reading position itself being taught to persist on the phone, which every bookmark option quietly assumes and none of them builds — do that first and “one ribbon that moves” becomes nearly free.</li>
    <li>A fresh look at how other Qur'an apps handle bookmarks, which the record admits was not done.</li>
  </ul>

  <h2>What is this not settling?</h2>
  <ul>
    <li>The exact motion of the drop — its speed, its easing, whether it bounces. The filmstrip shows the shape; the tuning is not the decision.</li>
    <li>Whether the reading position persists. That is a prerequisite this assumes, and its own smaller decision.</li>
    <li>How bookmarks are managed — cleared, named, sorted. That lives in the activity calendar, and only matters if the many-ribbons or both model wins.</li>
    <li>How a bookmark leaves the phone, if it does. That is the open export question, borrowed here, not answered.</li>
  </ul>

  <h2>So what is being decided?</h2>
  <p>Two things. First, what a bookmark is: one ribbon that moves when you tap the fold, many you drop and lift, or one automatic “here” alongside many manual ones. Second, where it is kept so it survives you closing the app: in the address (today's answer, which does not survive), in the phone's private store beside the revision record (durable, privately, with the phone's week-idle housekeeping the only weakness), or in that store plus a seat in the batch the notes already leave in. The gesture — a tap at the fold, a ribbon dropping downward — is the owner's, and is drawn, not chosen.</p>

  <footer>Rebuilt by <span class="num">scripts/build-bookmark-fold-options.mjs</span> from page ${PAGE}'s outlined print and the app's design tokens. The record is <span class="num">docs/decisions/bookmark-fold.md</span>; its storage siblings are <span class="num">docs/decisions/notes-export.md</span> and <span class="num">docs/decisions/confusion-map-export.md</span>.</footer>
</div>
</body>
</html>
`;

const arabic = html.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g);
if (arabic) die(`refusing to write: the page carries ${arabic.length} Arabic codepoint(s)`);
if (/<text\b[^>]*>[^<]*[\u0600-\u06FF]/.test(html)) die("refusing to write: a <text> element carries Arabic");
writeFileSync(OUT, html);
console.log(`wrote ${OUT.replace(ROOT, "")} (${(html.length / 1024).toFixed(0)} KB) — page ${PAGE}; models one/many/both, stores address/phone/portable`);
