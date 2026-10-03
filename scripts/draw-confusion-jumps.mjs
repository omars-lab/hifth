// Draws the pictures in docs/design/confusion-jumps.md on a real page of the
// mus'haf (page 9, the vendored print the app ships), at phone size.
//
//   node scripts/draw-confusion-jumps.mjs
//
// Needs rsvg-convert (brew install librsvg). Every position comes from the
// page's own word boxes and verse outlines (apps/web/public/assets), so the
// marks land where the app would put them. Nothing here is app code: it is a
// sketch, thrown away once a rough build replaces it.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const here = join(repo, "docs/design/confusion-jumps");
const pageSvg = readFileSync(join(repo, "apps/web/public/assets/pages/hafs-kfqc/9.svg"), "utf8");
const page = pageSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");

const INK = "#26201a";
const PAPER = "#f4efe6";
const ACCENT = "#1f6f66"; // the note dot's colour
const DANGER = "#a23b2c"; // the mistake tool's colour: a jump is a kind of mistake
const PX = 2.3; // pixels per page unit: a 345-unit page is ~400 CSS px on a phone, drawn at 2x

// From the page's own data (page 9).
// 2:58 ends on the line y 80.4–116.4; its outline starts at x 79.4 and its last word at x 103.6,
// so the verse number sits in that gap. The note dot is drawn at 80% across, 20% down (the
// upper shoulder) — the same rule the app uses.
const v58 = { x: 79.4, y: 80.4, h: 36, wordsLeft: 103.6 };
const v59 = { x: 83.9, y: 154.3, h: 36, wordsLeft: 106.7 };
const dotOf = (v) => ({ x: v.x + (v.wordsLeft - v.x) * 0.8, y: v.y + v.h * 0.2 });
const lowOf = (v) => ({ x: v.x + (v.wordsLeft - v.x) * 0.8, y: v.y + v.h * 0.8 });
// The seam: the word in 2:58 the reader's tongue left from (word 15 on line 2).
const seam = { x: 161.8, y: 70.5 };
// The first pause mark after the seam, inside 2:58 (word 22, a small sign above line 3).
const pause58 = { x: 253.8, y: 79.3, w: 5.3, h: 6.6 };
// Where 2:59 begins: its first word, just left of 2:58's number.
const start59 = { x: 78.9, y: 80.8 };

/** A wavy line from a to b, a few hand-drawn waves, ending in an arrowhead. */
function squiggle(a, b, { waves = 3, amp = 2.4, width = 1.3, color = DANGER, head = 3.4 } = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const pts = [];
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // The waves fade out over the last fifth so the head points true.
    const fade = t > 0.8 ? (1 - t) / 0.2 : 1;
    const w = Math.sin(t * waves * 2 * Math.PI) * amp * fade * (0.85 + 0.15 * Math.sin(t * 7.3));
    pts.push([a.x + dx * t + nx * w, a.y + dy * t + ny * w]);
  }
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  const hx = b.x;
  const hy = b.y;
  const h1 = [hx - ux * head + nx * head * 0.6, hy - uy * head + ny * head * 0.6];
  const h2 = [hx - ux * head - nx * head * 0.6, hy - uy * head - ny * head * 0.6];
  return (
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>` +
    `<path d="M${h1[0].toFixed(2)} ${h1[1].toFixed(2)}L${hx} ${hy}L${h2[0].toFixed(2)} ${h2[1].toFixed(2)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

/** The tiny squiggle glyph used inside the end-of-verse icon (centred on 0,0, ~6 wide). */
function glyph(cx, cy, s = 1, color = "#fff") {
  const a = { x: cx + 3 * s, y: cy };
  const b = { x: cx - 3 * s, y: cy };
  return squiggle(a, b, { waves: 1.5, amp: 0.9 * s, width: 0.75 * s, color, head: 1.5 * s });
}

/** The end-of-verse jump icon: a small red pill, the squiggle glyph, and a count. */
function jumpIcon(cx, cy, count) {
  const w = count ? 15 : 9;
  const left = cx - w / 2;
  let s = `<rect x="${left}" y="${cy - 4.2}" width="${w}" height="8.4" rx="4.2" fill="${DANGER}" stroke="#fff" stroke-width="0.8"/>`;
  s += glyph(count ? cx + 2.6 : cx, cy, 0.9);
  if (count) s += `<text x="${cx - 3.6}" y="${cy + 2.3}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="6.5" fill="#fff">${count}</text>`;
  return s;
}

/** The note dot as the app draws it today. */
function noteDot(cx, cy, count) {
  if (!count) return `<circle cx="${cx}" cy="${cy}" r="3.2" fill="${ACCENT}" stroke="#fff" stroke-width="0.8"/>`;
  return (
    `<circle cx="${cx}" cy="${cy}" r="5" fill="${ACCENT}" stroke="#fff" stroke-width="0.8"/>` +
    `<text x="${cx}" y="${cy + 2.3}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="600" font-size="6.5" fill="#fff">${count}</text>`
  );
}

/** A small label chip at the arrow's head, naming where the reader went. */
function chip(x, y, text) {
  const w = text.length * 3.7 + 6;
  return (
    `<rect x="${x - w}" y="${y - 5}" width="${w}" height="10" rx="2.5" fill="${PAPER}" stroke="${DANGER}" stroke-width="0.8" opacity="0.96"/>` +
    `<text x="${x - w / 2}" y="${y + 2.4}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="6.5" fill="${DANGER}">${text}</text>`
  );
}

function caption(x, y, text, color = INK, size = 7.5) {
  return `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="600" fill="${color}">${text}</text>`;
}

/** One panel: a crop of the page with overlays, plus a caption band above it. */
function panel({ crop, overlay, title }) {
  const [x, y, w, h] = crop;
  const band = 14;
  return {
    w,
    h: h + band,
    body:
      `<rect x="0" y="0" width="${w}" height="${h + band}" fill="#fff"/>` +
      caption(4, 10, title) +
      `<svg x="0" y="${band}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${PAPER}"/>${page}${overlay}</svg>`,
  };
}

/** Lay panels side by side (or one per row) and write the PNG. */
function render(name, panels, { columns = panels.length } = {}) {
  const gap = 6;
  const colW = Math.max(...panels.map((p) => p.w));
  const rowH = Math.max(...panels.map((p) => p.h));
  const rows = Math.ceil(panels.length / columns);
  const W = columns * colW + (columns - 1) * gap;
  const H = rows * rowH + (rows - 1) * gap;
  let body = "";
  panels.forEach((p, i) => {
    const cx = (i % columns) * (colW + gap);
    const cy = Math.floor(i / columns) * (rowH + gap);
    body += `<g transform="translate(${cx} ${cy})">${p.body}</g>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:ayah="https://quranpedia.net" viewBox="0 0 ${W} ${H}" width="${W * PX}" height="${H * PX}"><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`;
  const svgPath = join(tmpdir(), `confusion-jumps-${name}.svg`);
  writeFileSync(svgPath, svg);
  execFileSync("rsvg-convert", ["-w", String(Math.round(W * PX)), svgPath, "-o", join(here, `${name}.png`)]);
  console.log(`wrote ${name}.png (${Math.round(W * PX)}x${Math.round(H * PX)})`);
}

const d58 = dotOf(v58);
const l58 = lowOf(v58);
const l59 = lowOf(v59);

// 1. The arrow and the end-of-verse icon, on the top of page 9.
const arrowHead = { x: 112, y: 76 };
render("arrow", [
  panel({
    crop: [0, 0, 345, 200],
    title: "Drawn: a wavy arrow from where you left 2:58, and its count by the verse number",
    overlay:
      squiggle({ x: seam.x, y: seam.y + 3 }, arrowHead) +
      chip(arrowHead.x - 3, arrowHead.y, "7:161") +
      jumpIcon(l58.x, l58.y, 2) +
      jumpIcon(l59.x, l59.y, 1),
  }),
]);

// 2. Sharing the verse number with the note dot: three ways, at the same size.
const near58 = [40, 58, 150, 70];
render(
  "sharing",
  [
    panel({ crop: near58, title: "A. Two marks, two shoulders", overlay: noteDot(d58.x, d58.y) + jumpIcon(l58.x, l58.y, 2) }),
    panel({
      crop: near58,
      title: "B. One badge for both",
      overlay:
        `<rect x="${d58.x - 9}" y="${d58.y - 4.2}" width="20" height="8.4" rx="4.2" fill="${INK}" stroke="#fff" stroke-width="0.8"/>` +
        `<circle cx="${d58.x - 5}" cy="${d58.y}" r="2.2" fill="${ACCENT}"/>` +
        glyph(d58.x + 4.5, d58.y, 0.8),
    }),
    panel({ crop: near58, title: "C. The jump icon only", overlay: jumpIcon(d58.x, d58.y, 2) }),
  ],
  { columns: 3 },
);

// 3. Where "the next wasl" could put a second icon.
render(
  "wasl",
  [
    panel({
      crop: [0, 0, 345, 125],
      title: "A. At the next pause sign after where you left (inside 2:58)",
      overlay:
        squiggle({ x: seam.x, y: seam.y + 3 }, arrowHead, { color: DANGER }) +
        `<circle cx="${pause58.x + pause58.w / 2}" cy="${pause58.y + pause58.h / 2}" r="5.5" fill="none" stroke="${DANGER}" stroke-width="0.8" stroke-dasharray="1.5 1.2"/>` +
        jumpIcon(pause58.x - 8, pause58.y + 2, 2) +
        jumpIcon(l58.x, l58.y, 2),
    }),
    panel({
      crop: [0, 0, 345, 125],
      title: "B. Where you join into the next verse (start of 2:59)",
      overlay: squiggle({ x: seam.x, y: seam.y + 3 }, arrowHead) + jumpIcon(start59.x - 6, start59.y + 6, 2) + jumpIcon(l58.x, l58.y, 2),
    }),
  ],
  { columns: 1 },
);
