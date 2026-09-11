/**
 * shape-verse-letters.mjs — turn verse 2:38 into TRUE per-letter shapes.
 *
 * The harakah picker used to slice one merged outline with straight up-and-down
 * cuts, which cannot separate cursive letters whose ink overlaps sideways (a
 * ya's tail sweeps back under the ta before it). This shapes the verse from its
 * own Unicode Qur'an font (Amiri Quran, OFL) so every letter and every mark is
 * its OWN outline — inking one while the rest go invisible is then pixel-clean,
 * no matter how the strokes overlap.
 *
 * Held-copy: the font and the verse text are build-time inputs kept in the
 * gitignored cache and NEVER shipped. What this writes is outlined <path> shapes
 * and ASCII names only — it asserts zero Arabic codepoints before writing.
 *
 *   inputs  (gitignored cache):
 *     packages/etl/data/shaped/.cache/AmiriQuran-Regular.ttf   the font
 *     packages/etl/data/shaped/.cache/verse-2-38.json          the word text
 *   output  (committed, copy-safe):
 *     docs/design/data/harakah-shaped-2-38.json
 */
import * as fontkit from "fontkit";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FONT = join(ROOT, "packages/etl/data/shaped/.cache/AmiriQuran-Regular.ttf");
const TEXT = join(ROOT, "packages/etl/data/shaped/.cache/verse-2-38.json");
const OUT = join(ROOT, "docs/design/data/harakah-shaped-2-38.json");

const die = (m) => { console.error(`shape-verse-letters: ${m}`); process.exit(1); };

// Same transliterations the ligature extract uses, so names line up across data.
const LETTER_NAME = {
  0x0621: "hamza", 0x0622: "alif madda", 0x0623: "alif hamza", 0x0624: "waw hamza",
  0x0625: "alif hamza", 0x0626: "ya hamza", 0x0627: "alif", 0x0628: "ba",
  0x0629: "ta marbuta", 0x062a: "ta", 0x062b: "tha", 0x062c: "jeem", 0x062d: "hha",
  0x062e: "kha", 0x062f: "dal", 0x0630: "dhal", 0x0631: "ra", 0x0632: "zay",
  0x0633: "seen", 0x0634: "sheen", 0x0635: "saad", 0x0636: "daad", 0x0637: "taa",
  0x0638: "dhaa", 0x0639: "ayn", 0x063a: "ghayn", 0x0641: "fa", 0x0642: "qaf",
  0x0643: "kaf", 0x0644: "lam", 0x0645: "meem", 0x0646: "noon", 0x0647: "ha",
  0x0648: "waw", 0x0649: "alif maqsura", 0x064a: "ya", 0x0671: "alif wasla",
};
const MARK_NAME = {
  0x064b: "fathatan", 0x064c: "dammatan", 0x064d: "kasratan", 0x064e: "fatha",
  0x064f: "damma", 0x0650: "kasra", 0x0651: "shadda", 0x0652: "sukun",
  0x0653: "madda", 0x0670: "dagger alif", 0x06d6: "small waqf", 0x06d7: "small waqf",
  0x06d8: "small waqf", 0x06d9: "small waqf", 0x06da: "small waqf", 0x06db: "small waqf",
  0x06dc: "small seen", 0x06df: "small high rounded zero", 0x06e0: "small high upright zero",
  0x06e2: "small meem", 0x06e5: "small waw", 0x06e6: "small ya", 0x06e8: "small noon",
  0x06ea: "empty centre", 0x06eb: "small high ayn", 0x06ec: "small high rounded", 0x06ed: "small low meem",
};
const isMarkCp = (cp) => cp in MARK_NAME;
const nameFor = (cp) => LETTER_NAME[cp] || MARK_NAME[cp] || "letter";

const font = fontkit.openSync(FONT);
const upm = font.unitsPerEm;
const { words } = JSON.parse(readFileSync(TEXT, "utf8"));

// Round path numbers so the committed JSON stays small and stable.
const r = (n) => Math.round(n * 100) / 100;

/** Shape one word; return positioned letters[] and marks[] with y-down SVG paths. */
function shapeWord(text) {
  const run = font.layout(text);
  const letters = [];
  const marks = [];
  let penX = 0;
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i];
    const cp = (g.codePoints && g.codePoints[0]) || 0;
    // Place the glyph: flip y (font is y-up, SVG y-down), then translate to pen.
    const gx = penX + pos.xOffset;
    const gy = pos.yOffset;
    const p = g.path.scale(1, -1).translate(gx, -gy);
    const d = p.toSVG();
    const bb = p.bbox; // after transform, in the word's y-down coordinates
    if (d && d.length) {
      const rec = {
        name: nameFor(cp),
        d,
        bb: [r(bb.minX), r(bb.minY), r(bb.maxX), r(bb.maxY)],
      };
      (isMarkCp(cp) ? marks : letters).push(rec);
    }
    penX += pos.xAdvance;
  });
  return { letters, marks, advance: r(penX) };
}

const shaped = words.map((text, wi) => {
  const { letters, marks, advance } = shapeWord(text);
  return { wi, letters, marks, advance };
});

// Union bounding box across the whole verse, so the page can frame it.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const w of shaped) for (const s of [...w.letters, ...w.marks]) {
  minX = Math.min(minX, s.bb[0]); minY = Math.min(minY, s.bb[1]);
  maxX = Math.max(maxX, s.bb[2]); maxY = Math.max(maxY, s.bb[3]);
}

const out = {
  key: "2:38",
  source: "Amiri Quran (OFL), shaped with fontkit; build-time input, not shipped",
  note: "Per-letter and per-mark outlines. Each shape is independent, so isolating one is bleed-free.",
  upm,
  bbox: [r(minX), r(minY), r(maxX), r(maxY)],
  words: shaped,
};

const json = JSON.stringify(out);
if (/[؀-ۿ]/.test(json)) die("REFUSING to write: output carries Arabic codepoints (held-copy breach)");
if (/<text/.test(json)) die("REFUSING to write: output carries <text> elements (held-copy breach)");

writeFileSync(OUT, JSON.stringify(out, null, 0));
const nL = shaped.reduce((a, w) => a + w.letters.length, 0);
const nM = shaped.reduce((a, w) => a + w.marks.length, 0);
console.log(`shape-verse-letters: wrote ${OUT} — ${shaped.length} words, ${nL} letters, ${nM} marks, upm ${upm}`);
