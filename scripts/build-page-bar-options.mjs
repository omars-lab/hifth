#!/usr/bin/env node
/**
 * Draws the options for the two page-bar decisions — `juz-detents` (does a juz
 * marker on the bar pull a released drag onto it?) and `boundary-juz` (when a
 * juz begins partway down a page, which juz does the bar say that page is in?)
 * — on the bar at the two widths it is really used at, from committed data only.
 *
 * Everything on the page is derived, not typed in:
 *
 *   - the 30 juz opening pages come from `apps/web/public/assets/manifest.json`
 *     (`ayahPages`, the page of every ayah in the vendored print) and the juz
 *     table in `@hifth/core` — the same two the app reads;
 *   - which openings fall partway down a page, and how many ayat of each juz
 *     that page carries, is counted from the same array;
 *   - the bar's geometry (thumb, detent, handle, button and padding sizes) is
 *     read out of `PageSlider.module.css` and `tokens.css`, so a change to the
 *     real bar changes the drawing, and "how many pixels is one page" is a
 *     number this script computed from those, not one somebody remembered;
 *   - the surah names are the app's own romanised list in `format.ts`.
 *
 * One output, `docs/design/page-bar-options.html`, inline throughout (the
 * publishing host blocks every external URL, and the vendored page SVGs are
 * not needed here — the bar is chrome, not print). The page carries no Arabic
 * codepoints: the app's English mode is what is drawn, and the script refuses
 * to write if any slip in.
 *
 * Registered in docs/decisions.json as `builtBy` for both rows; the reasons
 * live in docs/decisions/page-bar.md.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./code-pointers.mjs";

const MANIFEST = join(ROOT, "apps/web/public/assets/manifest.json");
const CORE = join(ROOT, "packages/core/dist/index.js");
const SLIDER_CSS = join(ROOT, "apps/web/src/components/PageSlider.module.css");
const TOKENS_CSS = join(ROOT, "apps/web/src/styles/tokens.css");
const FORMAT_TS = join(ROOT, "apps/web/src/format.ts");
const PAGE = join(ROOT, "docs/design/page-bar-options.html");

// ------------------------------------------------------------------- the data

const { JUZ_STARTS, AYAH_COUNTS } = await import(CORE);
// The felt/seen options, as the real interchangeable components they are: the
// same compiled functions the app and the unit tests use, inlined into the live
// section below via .toString() so the reader decides by doing, not by reading.
const {
  resolveMarkOnly,
  resolvePullNearby,
  resolveTapButton,
  labelBeginsHere,
  labelRunning,
  labelBoth,
} = await import(CORE);
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const ayahPages = manifest.ayahPages;
const TOTAL = Math.max(...ayahPages);

const globalIndex = (surah, ayah) => {
  let n = 0;
  for (let i = 0; i < surah - 1; i++) n += AYAH_COUNTS[i];
  return n + ayah - 1;
};

/** One row per juz: where it opens, and what else that page carries. */
const JUZ = JUZ_STARTS.map(([surah, ayah], i) => {
  const g = globalIndex(surah, ayah);
  const page = ayahPages[g];
  let before = 0;
  for (let k = g - 1; k >= 0 && ayahPages[k] === page; k--) before++;
  let own = 0;
  for (let k = g; k < ayahPages.length && ayahPages[k] === page; k++) own++;
  return { juz: i + 1, page, surah, ayah, before, own, midPage: before > 0 };
});
const BOUNDARY = JUZ.filter((j) => j.midPage);

const SURAH_NAMES_EN = (() => {
  const src = readFileSync(FORMAT_TS, "utf8");
  const m = src.match(/SURAH_NAMES_EN[^=]*=\s*\[([\s\S]*?)\];/);
  if (!m) die("could not read SURAH_NAMES_EN out of format.ts");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
})();

// --------------------------------------------------------------- the geometry

const cssNumber = (css, re, what) => {
  const m = css.match(re);
  if (!m) die(`could not read ${what}`);
  return Number(m[1]);
};
const sliderCss = readFileSync(SLIDER_CSS, "utf8");
const tokensCss = readFileSync(TOKENS_CSS, "utf8");
const token = (name) => {
  const m = tokensCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) die(`no token --${name}`);
  return m[1].trim();
};
const rem = (v) =>
  v.endsWith("rem") ? Number(v.slice(0, -3)) * 16 : Number(v.replace("px", ""));

const G = {
  thumb: cssNumber(sliderCss, /--thumb:\s*(\d+)px/, "--thumb"),
  controlsMax: rem(
    sliderCss.match(/--controls-max:\s*([^;]+);/)?.[1] ?? die("--controls-max"),
  ),
  detentW: cssNumber(
    sliderCss,
    /\.juz\s*\{[^}]*inline-size:\s*(\d+)px/,
    ".juz inline-size",
  ),
  detentH: cssNumber(
    sliderCss,
    /\.juz\s*\{[^}]*block-size:\s*(\d+)px/,
    ".juz block-size",
  ),
  runH: cssNumber(
    sliderCss,
    /\.run\s*\{[^}]*block-size:\s*(\d+)px/,
    ".run block-size",
  ),
  handle: cssNumber(
    sliderCss,
    /\.handle\s*\{[^}]*inline-size:\s*(\d+)px/,
    ".handle inline-size",
  ),
  touch: rem(token("touch-min")),
  pad: rem(token("space-3")),
  gap: rem(token("space-2")),
};
const C = {
  paper: token("paper"),
  raised: token("paper-raised"),
  ink: token("ink"),
  inkSoft: token("ink-soft"),
  hairline: token("hairline"),
  accent: token("accent"),
  accentStrong: token("accent-strong"),
  accentTint: token("accent-tint"),
};

/** The track the thumb travels, at a given bar width. */
function trackAt(width) {
  const inner = Math.min(width, G.controlsMax) - 2 * G.pad;
  const track = inner - 2 * G.touch - 2 * G.gap;
  const travel = track - G.thumb;
  return { track, travel, perPage: travel / (TOTAL - 1) };
}
const DESKTOP = 1280;
const PHONE = 390;

// ---------------------------------------------------------------- the drawing

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fx = (n) => Number(n.toFixed(2));

/**
 * Draw the bar as SVG at `width` px, the thumb on `page`, and optionally the
 * scrub bubble with the given lines. Direction is RTL, as the real bar is: page
 * 1 at the right edge. Detent colour can be overridden per juz (the magnet's
 * reach, a pressed marker).
 */
function bar({ width, page, bubble, hot = new Set(), reach = null, label }) {
  const { track, travel } = trackAt(width);
  const barW = Math.min(width, G.controlsMax);
  const left = (width - barW) / 2 + G.pad + G.touch + G.gap;
  const cy = 110;
  const xOf = (p) =>
    left + track - ((p - 1) / (TOTAL - 1)) * travel - G.thumb / 2;
  const parts = [];
  parts.push(
    `<rect x="0" y="${cy - 40}" width="${width}" height="80" fill="${C.raised}"/>`,
  );
  parts.push(
    `<line x1="0" x2="${width}" y1="${cy - 40}" y2="${cy - 40}" stroke="${C.hairline}"/>`,
  );
  // the edge buttons
  for (const [x, glyph] of [
    [left - G.gap - G.touch, "▸"],
    [left + track + G.gap, "◂"],
  ]) {
    parts.push(
      `<text x="${x + G.touch / 2}" y="${cy + 6}" text-anchor="middle" font-size="16" fill="${C.inkSoft}">${glyph}</text>`,
    );
  }
  // the magnet's reach, drawn first so everything sits on it
  if (reach) {
    for (const j of JUZ) {
      const a = xOf(Math.min(TOTAL, j.page + reach));
      const b = xOf(Math.max(1, j.page - reach));
      parts.push(
        `<rect x="${fx(a)}" y="${cy - 12}" width="${fx(b - a)}" height="24" fill="${C.accentTint}"/>`,
      );
    }
  }
  // the inventory run — the whole print is here, so one run
  parts.push(
    `<rect x="${fx(xOf(TOTAL))}" y="${cy - G.runH / 2}" width="${fx(travel)}" height="${G.runH}" rx="1" fill="${C.inkSoft}" opacity="0.55"/>`,
  );
  // the 30 detents
  for (const j of JUZ) {
    const x = xOf(j.page) - G.detentW / 2;
    const fill = hot.has(j.juz) ? C.accentStrong : C.accent;
    const w = hot.has(j.juz) ? G.detentW + 2 : G.detentW;
    parts.push(
      `<rect x="${fx(x - (w - G.detentW) / 2)}" y="${cy - G.detentH / 2}" width="${w}" height="${G.detentH}" rx="1" fill="${fill}"/>`,
    );
  }
  // the handle: the page icon from the bar, scaled to its real size
  const hx = xOf(page) - G.handle / 2;
  const s = G.handle / 24;
  parts.push(
    `<g transform="translate(${fx(hx)} ${cy - G.handle / 2}) scale(${fx(s)})" fill="${C.raised}" stroke="${C.accentStrong}" stroke-width="1.5" stroke-linejoin="round">` +
      `<path d="M7.5 2.5H14L18 6.5V19.5A1.5 1.5 0 0 1 16.5 21H7.5A1.5 1.5 0 0 1 6 19.5V4A1.5 1.5 0 0 1 7.5 2.5Z"/>` +
      `<path d="M13.75 2.75V6A1 1 0 0 0 14.75 7H18" fill="none"/></g>`,
  );
  // the bubble
  if (bubble) {
    const lines = bubble.filter(Boolean);
    const w = Math.max(...lines.map((l) => l.length)) * 7.2 + 24;
    const h = 14 + lines.length * 17;
    const bx = Math.min(Math.max(xOf(page) - w / 2, 4), width - w - 4);
    const by = cy - 40 - 8 - h;
    parts.push(
      `<rect x="${fx(bx)}" y="${by}" width="${fx(w)}" height="${h}" rx="6" fill="${C.ink}"/>`,
    );
    lines.forEach((l, i) => {
      const size = i === 0 ? 13 : 11;
      const op = i === 0 ? 1 : 0.9;
      parts.push(
        `<text x="${fx(bx + w / 2)}" y="${by + 18 + i * 17}" text-anchor="middle" font-size="${size}" font-family="ui-sans-serif, system-ui, sans-serif" fill="${C.paper}" opacity="${op}">${esc(l)}</text>`,
      );
    });
  }
  const cap = label ? `<figcaption>${label}</figcaption>` : "";
  return `<figure class="bar"><svg viewBox="0 0 ${width} 160" width="${width}" role="img" aria-label="${esc(label ?? "the page bar")}">${parts.join("")}</svg>${cap}</figure>`;
}

/** The boundary page as a small schematic: 15 lines, the juz line drawn where the ayat say it falls. */
function boundaryPage(j) {
  const total = j.before + j.own;
  const split = j.before / total;
  const lines = 15;
  const h = 150;
  const parts = [];
  parts.push(
    `<rect x="0" y="0" width="100" height="${h}" rx="3" fill="${C.paper}" stroke="${C.hairline}"/>`,
  );
  for (let i = 0; i < lines; i++) {
    const y = 8 + i * ((h - 16) / (lines - 1));
    const frac = i / (lines - 1);
    const col = frac < split ? C.inkSoft : C.accent;
    parts.push(
      `<line x1="10" x2="90" y1="${fx(y)}" y2="${fx(y)}" stroke="${col}" stroke-width="2" opacity="0.7"/>`,
    );
  }
  const yb = 8 + split * (h - 16);
  parts.push(
    `<line x1="4" x2="96" y1="${fx(yb)}" y2="${fx(yb)}" stroke="${C.accentStrong}" stroke-width="1.5" stroke-dasharray="3 2"/>`,
  );
  return `<svg viewBox="0 0 100 ${h}" width="100" height="${h}" role="img" aria-label="page ${j.page}: juz ${j.juz - 1} above the dashed line, juz ${j.juz} below">${parts.join("")}</svg>`;
}

// ------------------------------------------------------------------ the page

function render() {
  const d = trackAt(DESKTOP);
  const p = trackAt(PHONE);
  const j4 = JUZ[3];
  const name = (s) => SURAH_NAMES_EN[s - 1];
  const releaseAt = j4.page - 2;
  const fingerPx = 26; // a fingertip's contact patch, ~7 mm at 96 dpi
  const fingerPagesPhone = Math.round(fingerPx / p.perPage);
  const fingerPagesDesktop = Math.round(fingerPx / d.perPage);
  const reach = 3;

  // -------------------------------------------------- the live, felt options
  // Everything the in-page script needs, derived — not typed in.
  const liveData = {
    total: TOTAL,
    radius: reach,
    startPage: releaseAt,
    juzStarts: JUZ.map((j) => j.page),
  };

  const liveDetents = `
  <div class="live" id="live-detents">
    <h3>Try it &mdash; let go near a marker</h3>
    <p class="hint">Drag the page handle and let go. Switch the rule and feel the difference: <b>A</b> leaves you exactly where your thumb is; <b>B</b> pulls you onto the nearest juz when you release within ${reach} pages of it, and tells you before you let go; <b>C</b> leaves the drag alone but makes each marker a button you can tap. This is the real code &mdash; the rule you pick here is the one that would ship.</p>
    <div class="seg" role="group" aria-label="What a marker does">
      <button data-rule="A" aria-pressed="true">A &middot; marker only marks</button>
      <button data-rule="B" aria-pressed="false">B &middot; marker pulls</button>
      <button data-rule="C" aria-pressed="false">C &middot; marker is a button</button>
    </div>
    <div class="stage" id="detent-stage" aria-hidden="true">
      <div class="reach" id="detent-reach"></div>
      <div class="track"></div>
    </div>
    <p class="readout" id="detent-readout"></p>
  </div>`;

  const boundCards = BOUNDARY.map(
    (j) =>
      `<div class="bcard" data-running="${j.juz - 1}" data-begins="${j.juz}">${boundaryPage(j)}<div class="blabel"></div><div class="bpage">Page ${j.page} &middot; ${esc(name(j.surah))}</div></div>`,
  ).join("");

  const liveBoundary = `
  <div class="live" id="live-boundary">
    <h3>Try it &mdash; switch the rule, watch the four pages</h3>
    <p class="hint">These are the four pages where a juz begins partway down. Switch the rule and watch each page's label: <b>A</b> names the juz that opens on the page; <b>B</b> names the juz already running onto it; <b>C</b> shows both. This is the real code &mdash; the rule you pick is the one the bar would print.</p>
    <div class="seg" role="group" aria-label="Which juz a boundary page wears">
      <button data-brule="A" aria-pressed="true">A &middot; begins here</button>
      <button data-brule="B" aria-pressed="false">B &middot; already running</button>
      <button data-brule="C" aria-pressed="false">C &middot; both</button>
    </div>
    <div class="boundset" id="boundset">${boundCards}</div>
  </div>`;

  const liveScript = `<script>
(function(){
  var LIVE = ${JSON.stringify(liveData)};
  ${resolveMarkOnly.toString()}
  ${resolvePullNearby.toString()}
  ${resolveTapButton.toString()}
  ${labelBeginsHere.toString()}
  ${labelRunning.toString()}
  ${labelBoth.toString()}
  var DETENTS = { A:{resolve:resolveMarkOnly}, B:{resolve:resolvePullNearby}, C:{resolve:resolveTapButton} };
  var RULES = { A:labelBeginsHere, B:labelRunning, C:labelBoth };
  var JS = LIVE.juzStarts, TOTAL = LIVE.total, RADIUS = LIVE.radius;
  var ARR = '\\u2192', DOT = '\\u00b7';
  function juzAt(p){ var j=1; for(var i=0;i<JS.length;i++){ if(JS[i]<=p) j=i+1; } return j; }
  var stage=document.getElementById('detent-stage');
  if(stage){
    var reachEl=document.getElementById('detent-reach');
    var readout=document.getElementById('detent-readout');
    var rule='A', page=LIVE.startPage, dragging=false;
    var PAD=20;
    function geom(){ var w=stage.clientWidth; return {right:w-PAD, travel:(w-PAD)-PAD}; }
    function xForPage(p){ var g=geom(); return g.right-((p-1)/(TOTAL-1))*g.travel; }
    function pageForX(x){ var g=geom(); var f=(g.right-x)/g.travel; if(f<0)f=0; if(f>1)f=1; return 1+Math.round(f*(TOTAL-1)); }
    var marks=JS.map(function(pg,i){ var m=document.createElement('div'); m.className='mark'; m.setAttribute('title','Juz '+(i+1)+', page '+pg); stage.appendChild(m); m.addEventListener('click', function(){ if(rule!=='C')return; settleTo(pg, 'Tapped juz '+(i+1)+' '+ARR+' opens at page '+pg+'.'); }); return m; });
    var handle=document.createElement('div'); handle.className='handle'; handle.setAttribute('role','slider'); handle.setAttribute('tabindex','0'); handle.setAttribute('aria-label','Page handle'); stage.appendChild(handle);
    var bubble=document.createElement('div'); bubble.className='bubble'; stage.appendChild(bubble);
    function nearestInReach(p){ var best=-1,bd=1e9,bj=-1; for(var i=0;i<JS.length;i++){ var d=Math.abs(JS[i]-p); if(d<=RADIUS && d<bd){bd=d;best=JS[i];bj=i+1;} } return best<0?null:{page:best,juz:bj}; }
    function place(preview){
      for(var i=0;i<marks.length;i++){ var m=marks[i]; m.style.left=xForPage(JS[i])+'px'; m.classList.toggle('tappable', rule==='C'); m.style.pointerEvents = rule==='C' ? 'auto':'none'; m.classList.remove('hot'); }
      handle.style.left=xForPage(page)+'px';
      bubble.style.left=xForPage(page)+'px';
      handle.setAttribute('aria-valuenow', page);
      var text='Page '+page+' '+DOT+' Juz '+juzAt(page);
      reachEl.style.display='none';
      if(rule==='B'){ var near=nearestInReach(page); if(near){ var a=xForPage(Math.min(TOTAL,near.page+RADIUS)); var b=xForPage(Math.max(1,near.page-RADIUS)); reachEl.style.left=Math.min(a,b)+'px'; reachEl.style.width=Math.abs(b-a)+'px'; reachEl.style.display='block'; marks[near.juz-1].classList.add('hot'); if(preview) text=ARR+' Juz '+near.juz+' begins on page '+near.page; } }
      bubble.textContent=text;
    }
    function settleTo(target, msg){ handle.classList.add('settle'); page=target; place(false); if(msg) readout.textContent=msg; setTimeout(function(){ handle.classList.remove('settle'); }, 240); }
    function onDown(e){ dragging=true; handle.classList.remove('settle'); if(handle.setPointerCapture){ try{ handle.setPointerCapture(e.pointerId); }catch(_){} } e.preventDefault(); }
    function onMove(e){ if(!dragging)return; var r=stage.getBoundingClientRect(); page=pageForX(e.clientX-r.left); place(true); }
    function onUp(){ if(!dragging)return; dragging=false; var asked=page; var landing=DETENTS[rule].resolve(asked,{total:TOTAL,radius:RADIUS,juzStarts:JS}); if(landing.pulled){ settleTo(landing.page, 'Released at page '+asked+' '+ARR+' pulled onto page '+landing.page+', where juz '+landing.juz+' begins.'); } else { page=landing.page; place(false); readout.textContent='Released at page '+asked+' '+ARR+' stayed on page '+landing.page+'.'; } }
    handle.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    handle.addEventListener('keydown', function(e){ var d=0; if(e.key==='ArrowLeft')d=1; else if(e.key==='ArrowRight')d=-1; else return; e.preventDefault(); page=Math.max(1,Math.min(TOTAL,page+d)); place(false); });
    var segBtns=[].slice.call(document.querySelectorAll('#live-detents .seg button'));
    segBtns.forEach(function(btn){ btn.addEventListener('click', function(){ rule=btn.getAttribute('data-rule'); segBtns.forEach(function(b){ b.setAttribute('aria-pressed', b===btn?'true':'false'); }); readout.textContent = rule==='C' ? 'Tap a marker to open its juz; a drag still lands under your thumb.' : ''; place(false); }); });
    window.addEventListener('resize', function(){ place(false); });
    place(false);
  }
  var brule='A';
  var bcards=[].slice.call(document.querySelectorAll('#boundset .bcard'));
  function paintB(){ bcards.forEach(function(c){ var ctx={beginsHere:Number(c.getAttribute('data-begins')), running:Number(c.getAttribute('data-running'))}; var lab=RULES[brule](ctx); c.querySelector('.blabel').textContent='Juz '+lab.text; }); }
  var bsegs=[].slice.call(document.querySelectorAll('#live-boundary .seg button'));
  bsegs.forEach(function(btn){ btn.addEventListener('click', function(){ brule=btn.getAttribute('data-brule'); bsegs.forEach(function(b){ b.setAttribute('aria-pressed', b===btn?'true':'false'); }); paintB(); }); });
  paintB();
})();
</` + `script>`;

  const q1Options = [
    {
      key: "A",
      title: "A marker only marks",
      today: true,
      gist: `What the bar does now. Letting go lands on the page under the thumb — ${releaseAt}, two before juz ${j4.juz} — and the marker is a landmark you steer by, not a thing that catches you.`,
      takes: "Nothing.",
      gets: "Every page is reachable by drag, and a release means exactly where the thumb is.",
      costs: `You cannot reach a juz opening by dragging: a page is ${fx(d.perPage)} px wide on a laptop and ${fx(p.perPage)} px on a phone, so the drag ends somewhere within a fingertip — about ${fingerPagesDesktop} pages either way on a laptop, ${fingerPagesPhone} on a phone. Three other roads land exactly (below).`,
      draw: (w) =>
        bar({
          width: w,
          page: releaseAt,
          bubble: [
            `Page ${releaseAt} of ${TOTAL}`,
            `Juz ${j4.juz - 1} · ${name(3)}`,
          ],
          label: `Released at page ${releaseAt}, two before juz ${j4.juz}: lands on ${releaseAt}`,
        }),
    },
    {
      key: "B",
      title: "A marker pulls, a few pages either side",
      gist: `Let go within ${reach} pages of a marker and the bar lands on the juz's first page instead, and the bubble says so before you let go — the same sentence it already uses when a page is not in this build.`,
      takes: `A reach in pages, and the bubble's existing "nearest page" line reused for "juz ${j4.juz} begins on page ${j4.page}".`,
      gets: `A juz opening becomes reachable by drag, at the size a finger can actually hit.`,
      costs: `${2 * reach} pages around each of 30 markers — ${30 * (2 * reach)} pages, ${Math.round((30 * 2 * reach * 100) / TOTAL)}% of the book — cannot be landed on by drag; the arrows still reach them. On a phone the reach is ${fx(2 * reach * p.perPage)} px wide, a tenth of the thumb, so on a phone it is closer to "the marker wins whenever you are near it".`,
      draw: (w) =>
        bar({
          width: w,
          page: releaseAt,
          reach,
          hot: new Set([j4.juz]),
          bubble: [
            `Page ${releaseAt} of ${TOTAL}`,
            `Juz ${j4.juz} · ${name(j4.surah)}`,
            `Nearest juz · Page ${j4.page}`,
          ],
          label: `Released at page ${releaseAt}: pulled onto page ${j4.page}, and told so first`,
        }),
    },
    {
      key: "C",
      title: "A marker is a button; the drag is unchanged",
      gist: "Tap or click a marker and the book opens at that juz, with the announcement the wheel already makes. A drag released beside a marker still lands where the thumb is.",
      takes:
        "Thirty small buttons on the rail, each named, and the marker's hit area widened to the touch minimum — which on a phone overlaps its neighbours' drag space.",
      gets: "An exact road to a juz that is visible on the bar, without changing what a release means.",
      costs: `A ${G.detentW} px mark with a ${G.touch} px hit area, thirty times, on a track where a page is ${fx(p.perPage)} px: thirty touch targets want ${30 * G.touch} px of a ${fx(p.track)} px phone track, ${((30 * G.touch) / p.track).toFixed(1)} times what there is, so on a phone every drag starts on a button. The bar already has a keyboard road and the map already has a cell per juz.`,
      draw: (w) =>
        bar({
          width: w,
          page: j4.page,
          hot: new Set([j4.juz]),
          bubble: [`Juz ${j4.juz} · page ${j4.page}`],
          label: `Marker ${j4.juz} pressed: the book opens at page ${j4.page}`,
        }),
    },
  ];

  const b62 = BOUNDARY[0];
  const q2Options = [
    {
      key: "A",
      title: "The juz that begins on it",
      today: "in the bar",
      gist: `The bar's answer today: page ${b62.page} is "juz ${b62.juz}", because juz ${b62.juz} opens there and that is what its marker marks. The page carries ${b62.before} ayah of juz ${b62.juz - 1} and ${b62.own} of juz ${b62.juz}.`,
      takes:
        "Nothing in the bar. One line elsewhere, to make the pack shelf and the wheel's edge message agree with it.",
      gets: "The marker, the bubble and the juz jump all name the same page the same way.",
      costs: `On page ${BOUNDARY[2].page} the bar would say "juz ${BOUNDARY[2].juz}" for a page that is ${BOUNDARY[2].before} ayat of juz ${BOUNDARY[2].juz - 1} and ${BOUNDARY[2].own} of juz ${BOUNDARY[2].juz}.`,
      bubble: (j) => [
        `Page ${j.page} of ${TOTAL}`,
        `Juz ${j.juz} · ${name(j.surah)}`,
      ],
    },
    {
      key: "B",
      title: "The juz that was already running",
      today: "in the pack shelf",
      gist: `The other answer the app gives today: page ${b62.page} is "juz ${b62.juz - 1}", the lowest juz with any ayah on it, which is how the offline-pack offer and the wheel's "no juz that way" message read it.`,
      takes:
        "One line in the bar, and the marker for a mid-page juz then sits on a page the bubble calls the previous juz.",
      gets: "Whatever is at the top of the page is what the page is called — the reader opening it meets that juz first.",
      costs: `The marker and the bubble disagree on four pages: the tick says "juz ${b62.juz} starts here" and the line under the thumb says "juz ${b62.juz - 1}".`,
      bubble: (j) => [
        `Page ${j.page} of ${TOTAL}`,
        `Juz ${j.juz - 1} · ${name(j.surah)}`,
      ],
    },
    {
      key: "C",
      title: "Both, on those four pages",
      gist: `Say what is true: "juz ${b62.juz - 1} → ${b62.juz}" on a page that carries the seam, and one juz everywhere else.`,
      takes:
        "A second way of writing the line, in both languages, for four pages of 604.",
      gets: "No page is misnamed, and the seam is visible from the bar without opening the page.",
      costs:
        "A wider bubble on four pages, and the pack shelf and wheel still need to pick one of the two for their own sentences.",
      bubble: (j) => [
        `Page ${j.page} of ${TOTAL}`,
        `Juz ${j.juz - 1} → ${j.juz} · ${name(j.surah)}`,
      ],
    },
  ];

  const opt = (o, drawings) => `
    <section class="opt${o.today ? " today" : ""}">
      <div class="opt-head"><span class="opt-key">${o.key}</span><h3>${esc(o.title)}</h3>${o.today ? `<span class="badge">today${typeof o.today === "string" ? ", " + esc(o.today) : ""}</span>` : ""}</div>
      <div class="opt-body">
        <p class="gist">${esc(o.gist)}</p>
        <dl><dt>takes</dt><dd>${esc(o.takes)}</dd><dt>gets</dt><dd>${esc(o.gets)}</dd><dt>costs</dt><dd>${esc(o.costs)}</dd></dl>
        ${drawings}
      </div>
    </section>`;

  const boundaryTable = `
    <table>
      <thead><tr><th>Juz</th><th>Begins</th><th>On page</th><th>Ayat of the juz before</th><th>Ayat of this juz</th><th>The page</th></tr></thead>
      <tbody>${BOUNDARY.map(
        (j) =>
          `<tr><td>${j.juz}</td><td>${esc(name(j.surah))} ${j.surah}:${j.ayah}</td><td>${j.page}</td><td>${j.before}</td><td>${j.own}</td><td>${boundaryPage(j)}</td></tr>`,
      ).join("")}</tbody>
    </table>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Two questions about the page bar</title>
<style>
  :root{
    --bg:#f6f4ef; --panel:#fffdf9; --ink:#211d17; --ink-2:#6a6156; --line:#e3ddd1;
    --line-soft:#efeae0; --accent:#8a6d3b; --accent-soft:#f0e7d6; --lean:#3f6f5f; --lean-soft:#e2efe9;
  }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
      --line-soft:#2a261d; --accent:#c8a565; --accent-soft:#332a1a; --lean:#7fb59f; --lean-soft:#1e2b26;
    }
  }
  :root[data-theme="dark"]{
    --bg:#17150f; --panel:#201d16; --ink:#efe9dd; --ink-2:#a79c8a; --line:#332e23;
    --line-soft:#2a261d; --accent:#c8a565; --accent-soft:#332a1a; --lean:#7fb59f; --lean-soft:#1e2b26;
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
  dl.gloss{max-width:68ch; display:grid; grid-template-columns:auto 1fr; gap:.3rem 1rem}
  dl.gloss dt{font-weight:600}
  dl.gloss dd{margin:0}
  .options{display:flex; flex-direction:column; gap:1.4rem; margin-top:1rem}
  .opt{border:1px solid var(--line); border-radius:16px; background:var(--panel); overflow:hidden}
  .opt-head{display:flex; align-items:center; gap:.7rem; padding:1rem 1.2rem .2rem}
  .opt-key{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-weight:700; color:#fff; background:var(--accent); width:1.7rem; height:1.7rem; border-radius:50%; display:grid; place-items:center; flex:none}
  .opt-head h3{margin:0; font-size:1.15rem}
  .badge{margin-left:auto; font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.66rem; letter-spacing:.08em; text-transform:uppercase; color:var(--lean); background:var(--lean-soft); border-radius:999px; padding:.28rem .6rem; white-space:nowrap}
  .opt-body{padding:.6rem 1.2rem 1.4rem}
  .gist{margin:.2rem 0 .8rem}
  dl{margin:0 0 1rem; display:grid; grid-template-columns:auto 1fr; gap:.3rem .9rem; max-width:68ch}
  dt{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2); padding-top:.15rem}
  dd{margin:0}
  figure.bar{margin:1rem 0 0; overflow-x:auto}
  figure.bar svg{display:block; max-width:100%; height:auto; border:1px solid var(--line-soft); border-radius:8px}
  figcaption{font-size:.82rem; color:var(--ink-2); margin:.4rem 0 0}
  .phones{display:flex; gap:1.2rem; flex-wrap:wrap; align-items:flex-start}
  .phones figure.bar{margin-top:1rem}
  table{border-collapse:collapse; margin:1rem 0; font-size:.92rem}
  th,td{border-bottom:1px solid var(--line); padding:.5rem .8rem; text-align:left; vertical-align:middle}
  th{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.68rem; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-2)}
  .num{font-family:"SF Mono",ui-monospace,Menlo,monospace; font-size:.88rem}
  .foot{margin-top:3rem; padding-top:1.2rem; border-top:1px solid var(--line); font-size:.82rem; color:var(--ink-2); max-width:68ch}

  /* the live sections — the felt/seen options mounted as real, draggable code */
  .live{border:1px solid var(--line); border-radius:16px; background:var(--panel); padding:1.2rem 1.3rem 1.5rem; margin-top:1.4rem}
  .live > h3{margin:.1rem 0 .3rem; font-size:1.15rem}
  .live .hint{font-size:.94rem; color:var(--ink-2); margin:.2rem 0 1rem; max-width:68ch}
  .live .hint b{color:var(--ink); font-weight:600}
  .seg{display:inline-flex; flex-wrap:wrap; border:1px solid var(--line); border-radius:999px; overflow:hidden; margin-bottom:1rem}
  .seg button{appearance:none; border:0; background:transparent; color:var(--ink-2); font:inherit; font-size:.9rem; padding:.45rem 1rem; cursor:pointer; border-inline-start:1px solid var(--line)}
  .seg button:first-child{border-inline-start:0}
  .seg button[aria-pressed="true"]{background:var(--accent); color:#fff}
  .stage{position:relative; height:118px; user-select:none; touch-action:none}
  .track{position:absolute; left:20px; right:20px; top:70px; height:6px; border-radius:3px; background:var(--ink-2); opacity:.45}
  .reach{position:absolute; top:60px; height:26px; border-radius:4px; background:var(--accent-soft); pointer-events:none; display:none}
  .mark{position:absolute; top:60px; width:3px; height:26px; border-radius:1px; background:var(--accent); transform:translateX(-50%)}
  .mark.tappable{cursor:pointer; width:7px; border-radius:2px}
  .mark.tappable:hover{background:var(--lean)}
  .mark.hot{background:var(--lean); box-shadow:0 0 0 3px var(--lean-soft)}
  .handle{position:absolute; top:55px; width:30px; height:36px; margin-left:-15px; border-radius:7px; background:var(--panel); border:1.5px solid var(--accent); box-shadow:0 1px 3px rgba(0,0,0,.18); cursor:grab; touch-action:none}
  .handle:active{cursor:grabbing}
  .handle:focus-visible{outline:2px solid var(--lean); outline-offset:2px}
  .handle.settle{transition:left .2s cubic-bezier(.2,.9,.3,1)}
  .bubble{position:absolute; top:6px; transform:translateX(-50%); background:var(--ink); color:var(--panel); border-radius:6px; padding:.32rem .6rem; font-size:.82rem; white-space:nowrap; pointer-events:none}
  .readout{font-size:.92rem; color:var(--ink-2); margin-top:.5rem; min-height:1.35em}
  .boundset{display:flex; gap:1rem; flex-wrap:wrap; margin-top:.4rem}
  .bcard{border:1px solid var(--line-soft); border-radius:12px; padding:.8rem; text-align:center; background:var(--bg)}
  .bcard .blabel{margin-top:.55rem; background:var(--ink); color:var(--panel); border-radius:6px; padding:.3rem .55rem; font-size:.82rem; display:inline-block}
  .bcard .bpage{font-size:.76rem; color:var(--ink-2); margin-top:.35rem}
  @media (prefers-reduced-motion: reduce){ .handle.settle{transition:none} }
</style>
</head>
<body>
<main class="wrap">
  <p class="eyebrow">Two decisions, still open</p>
  <h1>Two questions about the page bar</h1>
  <p class="lede">The bar along the bottom of the app is how a reader scrubs through the whole printed book. It grew thirty green marks, one where each juz begins, and a bubble that names the juz and the surah under the thumb while you drag. Two things about those marks were built one way without anyone choosing, and this page draws the choices at the size the bar is really used &mdash; and lets you <em>try</em> each one, live, running the same code that would ship, so the choice is made by hand rather than imagined.</p>

  <h2>A few words, defined once</h2>
  <dl class="gloss">
    <dt>Juz</dt><dd>One of the thirty roughly equal parts the book is divided into for reading it over a month. A juz begins at a fixed verse, not at a page.</dd>
    <dt>Marker</dt><dd>The short green tick on the bar at the page a juz begins on. Thirty of them.</dd>
    <dt>The bubble</dt><dd>The dark label that floats above the thumb while you drag: the page number, then the juz and surah of that page, then — if the page is not in this build — the nearest page that is.</dd>
    <dt>Landmark, magnet</dt><dd>A landmark is something you steer by; a magnet is something that catches you. The first question is which of these a marker is.</dd>
  </dl>

  <h2>How wide is a page on the bar?</h2>
  <p>The bar spans all ${TOTAL} pages of the print. Read off the app's own stylesheet, the thumb travels:</p>
  <table>
    <thead><tr><th>Window</th><th>Track</th><th>One page</th><th>Pages under a fingertip (${fingerPx} px)</th></tr></thead>
    <tbody>
      <tr><td>Laptop, ${DESKTOP} px wide (the bar is held to ${G.controlsMax} px)</td><td class="num">${fx(d.track)} px</td><td class="num">${fx(d.perPage)} px</td><td class="num">about ${fingerPagesDesktop}</td></tr>
      <tr><td>Phone, ${PHONE} px wide</td><td class="num">${fx(p.track)} px</td><td class="num">${fx(p.perPage)} px</td><td class="num">about ${fingerPagesPhone}</td></tr>
    </tbody>
  </table>
  <p>So a drag cannot be aimed at one page on either device, and on a phone it cannot be aimed at one juz's neighbourhood either. That number is most of the argument on this page.</p>

  <h2 class="q">1 · When a reader lets go near a marker, should the bar pull the page onto it?</h2>
  <p>Today it does not. The markers are drawn under the thumb and cannot be touched; a release lands on the page the thumb is over, and the bubble says which. There are three exact roads to a juz that do not involve the bar: on a laptop, the wheel with Shift held jumps a juz; the revision map has a cell per juz that opens it; and the jump box takes "juz 9". The question is whether the drag should be a fourth.</p>
  <p>Each option is drawn at the laptop width and the phone width, released at page ${releaseAt} — two pages before juz ${j4.juz} begins on page ${j4.page}.</p>
  <div class="options">
    ${q1Options.map((o) => opt(o, `<div class="phones">${o.draw(DESKTOP)}${o.draw(PHONE)}</div>`)).join("")}
  </div>

  ${liveDetents}

  <h2>What would change this answer?</h2>
  <ul>
    <li>A reader saying they reach for the bar to get to a juz and miss. Nobody has yet; the bar is a week old.</li>
    <li>The phone. Everything above is arithmetic on a ${PHONE} px window; a hafiz's thumb on a real one is the measurement.</li>
    <li>The map growing a hizb layer would make the bar's markers the coarse one twice over, and a magnet on thirty marks is a different thing from a magnet on sixty.</li>
  </ul>

  <h2 class="q">2 · When a juz begins partway down a page, which juz is that page in?</h2>
  <p>Twenty-six of the thirty juz begin at the top of a page. Four begin partway down one, so that page carries the end of one juz and the start of the next:</p>
  ${boundaryTable}
  <p>The app answers this two ways today. The bar's bubble says the page is the juz that <em>begins</em> on it, because that is the juz whose marker sits on that page. The offline-pack shelf and the wheel's "no juz that way" message say it is the juz that was <em>already running</em>, the lowest juz with any verse on the page. On ${TOTAL - BOUNDARY.length} pages the two agree; on these ${BOUNDARY.length} they do not.</p>
  <p>Each option is drawn as the bubble over page ${b62.page}, which carries ${b62.before} verse of juz ${b62.juz - 1} and ${b62.own} of juz ${b62.juz}.</p>
  <div class="options">
    ${q2Options.map((o) => opt(o, bar({ width: DESKTOP, page: b62.page, bubble: o.bubble(b62), label: `Page ${b62.page} under the thumb` }))).join("")}
  </div>

  ${liveBoundary}

  <h2>What would change this answer?</h2>
  <ul>
    <li>What the printed mus'haf itself says. The Madani print names the juz in the running head of every page, and on these four pages it must have picked one; the owner has a physical copy, and nobody has yet turned to page ${b62.page} and looked. Whatever it says is the convention a hafiz already carries.</li>
    <li>A hizb layer. Hizb boundaries fall mid-page far more often than juz ones, and an answer that is a special case for four pages will not survive sixty.</li>
  </ul>

  <h2>What is this page not settling?</h2>
  <ul>
    <li>Whether the bar should show hizb marks at all. That is a bigger question, and the map answers it first.</li>
    <li>What a marker looks like. The tick's size and colour were chosen so the thirty read apart from the inventory rail, not for this.</li>
    <li>Which page a juz jump lands on. It lands on the page the juz begins on, and this page takes that as given.</li>
  </ul>

  <p class="foot">Built from the vendored print's page-of-every-verse table, the juz table, and the bar's own stylesheet; every number above is recomputed when the page is rebuilt. Nothing on it is scripture — the bar is chrome, and it is drawn in the app's English mode.</p>
  ${liveScript}
</main>
</body>
</html>
`;
}

function die(msg) {
  console.error(`build-page-bar-options: ${msg}`);
  process.exit(1);
}

const html = render();
const arabic = html.match(
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
);
if (arabic)
  die(
    `refusing to write: the page carries ${arabic.length} Arabic codepoint(s)`,
  );
writeFileSync(PAGE, html);
console.log(
  `page-bar-options — ${JUZ.length} markers, ${BOUNDARY.length} mid-page openings (pages ${BOUNDARY.map((j) => j.page).join(", ")}) → ${PAGE.replace(ROOT, "")} (${(html.length / 1024).toFixed(0)} KB)`,
);
