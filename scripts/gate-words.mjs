#!/usr/bin/env node
/**
 * CI gate: the word-box shards are the ones `build-words.mjs` produced, and
 * every box in them lands on the ayah it claims.
 *
 * `build-words.mjs` reads 378 MB of a second mus'haf print to write 2.2 MB of
 * geometry. Nothing in CI can afford to re-run it, and nothing should have to:
 * `packages/etl/data/pages/word-boxes.pin.json` carries a SHA-256 of every
 * shard the recipe wrote, so a hand-edited shard fails here without anyone
 * downloading the corpus to find out. That is the same division of labour
 * `gate:pages` runs on — the producer verifies its inputs when it runs, the
 * gate verifies its outputs on every run, offline.
 *
 * But a hash only proves the bytes did not change. The claim these shards make
 * is geometric: box `[x, y, w, h]` is where that word sits *on our page SVG*,
 * after a fitted transform from a different print's frame. So this gate also
 * re-measures, from the two committed files and nothing else:
 *
 *   LEXICAL   a word's box centre is inside its own ayah's tap polygon.
 *             86,965 of them; the tolerance is zero. This is not aspirational
 *             — it is the measured state of the corpus, and it is how the one
 *             polygon that was wrong got found (see below).
 *   MARK      a pause mark's box, dropped straight down by at most MARK_DROP,
 *             meets its own ayah's polygon. 4,486 of them; 33 need any drop at
 *             all and the largest needs 2.9. Marks get their own rule because
 *             they are superscripts: «ۖ» is set above the line, and the line's
 *             polygon starts at the line. Flagging them in the shard instead of
 *             dropping them is what lets the other 86,965 be held to zero
 *             slack — a single rule loose enough for a superscript would be
 *             loose enough to miss a word on the wrong line.
 *   PAIRING   every ayah in a shard has a polygon on that page, and every
 *             polygon on that page has words in the shard. Both directions,
 *             because a shard that quietly lost an ayah and a page that gained
 *             one are different bugs with the same symptom: a word you cannot
 *             select.
 *
 * The LEXICAL check is not decoration. It ran once over all 604 pages and
 * returned exactly one failure — p577 75:5's first word, which our print gave
 * to 75:4 — a defect `gate:pages` cannot see, because that ink *is* covered,
 * just by the wrong ayah. It is now the twenty-second entry in
 * `vendor-pages.mjs`'s POLYGON_REPAIRS. There is deliberately no allow-list
 * here, for the same reason there is none there.
 *
 * This gate reads the polygons with its own parser (`rings` below) rather than
 * importing `ringsOf` from `packages/etl/scripts/lib/mushaf-frame.mjs`, which
 * is the parser the shards were *built* with. That is the point. A gate that
 * shares its producer's parser can only ever confirm the producer's opinion of
 * where a polygon is; the earlier `L`/`l` bug in that very lib surfaced because
 * two independent implementations disagreed. The second implementation is the
 * feature, not the duplication.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PIN_FILE = join(REPO, "packages", "etl", "data", "pages", "word-boxes.pin.json");
const WORDS_DIR = join(REPO, "apps", "web", "public", "assets", "words", "hafs-kfqc");
const PAGES_DIR = join(REPO, "apps", "web", "public", "assets", "pages", "hafs-kfqc");

/**
 * How far a pause mark may be dropped before it must meet its own polygon.
 * Measured, not chosen: of 4,486 marks, 4,453 already meet it and the worst of
 * the remaining 33 needs 2.9 units. Four leaves headroom over that and is still
 * a ninth of the print's 36-unit line pitch, so it cannot reach the line below
 * and turn a misplaced mark into a passing one.
 */
const MARK_DROP = 4;

const failures = [];
const fail = (msg) => failures.push(msg);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/* --------------------------------------------------------------- the parser */

/**
 * The rings of an ayah polygon `d`, as closed point lists. svgo writes these at
 * floatPrecision 1 in the compact absolute/relative mix — `M5 294.2h15.2v36H5Z`
 * then `m180.3 36H340…` — so relative commands, the implicit-lineto tail of an
 * `M`, and the `Z`-resets-the-pen rule all have to be right. Curves are not
 * understood on purpose: a tap polygon that stopped being a point list would
 * make every containment answer below a guess, and a wrong answer that looks
 * confident is worse than a gate that stops.
 */
function rings(d, where) {
  const out = [];
  let x = 0,
    y = 0,
    startX = 0,
    startY = 0,
    ring = null;
  const close = () => {
    if (ring && ring.length > 2) out.push(ring);
    ring = null;
  };
  for (const tok of d.match(/[A-Za-z][^A-Za-z]*/g) ?? []) {
    const cmd = tok[0];
    const rel = cmd === cmd.toLowerCase();
    const nums = (tok.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    switch (cmd.toUpperCase()) {
      case "M": {
        close();
        x = rel ? x + nums[0] : nums[0];
        y = rel ? y + nums[1] : nums[1];
        startX = x;
        startY = y;
        ring = [[x, y]];
        // Extra coordinate pairs after an M are implicit linetos.
        for (let i = 2; i + 1 < nums.length; i += 2) {
          x = rel ? x + nums[i] : nums[i];
          y = rel ? y + nums[i + 1] : nums[i + 1];
          ring.push([x, y]);
        }
        break;
      }
      case "L":
        for (let i = 0; i + 1 < nums.length; i += 2) {
          x = rel ? x + nums[i] : nums[i];
          y = rel ? y + nums[i + 1] : nums[i + 1];
          ring?.push([x, y]);
        }
        break;
      case "H":
        for (const v of nums) ring?.push([(x = rel ? x + v : v), y]);
        break;
      case "V":
        for (const v of nums) ring?.push([x, (y = rel ? y + v : v)]);
        break;
      case "Z":
        close();
        x = startX;
        y = startY;
        break;
      default:
        fail(`${where}: tap polygon uses "${cmd}" — only straight-line commands are understood`);
        return [];
    }
  }
  close();
  return out;
}

/**
 * Crossing number, counting a point on the boundary as inside. Ayah polygons
 * abut edge to edge — one line's rect ends exactly where the next begins — so a
 * rule that excluded the boundary would drop a word onto no ayah at all.
 */
function inside(polys, px, py) {
  const EPS = 1e-9;
  for (const ring of polys) {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      // On the segment? Cross product ~0 and within the bounding box of it.
      const cross = (xj - xi) * (py - yi) - (yj - yi) * (px - xi);
      if (
        Math.abs(cross) <= EPS * (1 + Math.abs(xj - xi) + Math.abs(yj - yi)) &&
        px >= Math.min(xi, xj) - EPS &&
        px <= Math.max(xi, xj) + EPS &&
        py >= Math.min(yi, yj) - EPS &&
        py <= Math.max(yi, yj) + EPS
      ) {
        return true;
      }
      // Ray to +x: does this edge straddle py, and is the crossing to our right?
      if (yi > py !== yj > py && px < xi + ((py - yi) / (yj - yi)) * (xj - xi)) hit = !hit;
    }
    if (hit) return true;
  }
  return false;
}

/* ------------------------------------------------------------------- checks */

if (!existsSync(PIN_FILE)) {
  console.error(
    "FAIL gate:words — no word-boxes pin. Run `pnpm --filter @hifth/etl build:words`.",
  );
  process.exit(1);
}
const pin = JSON.parse(readFileSync(PIN_FILE, "utf8"));

if (!existsSync(WORDS_DIR)) {
  console.error(
    `FAIL gate:words — ${WORDS_DIR} does not exist, but the pin lists ${pin.pages.length} shard(s).`,
  );
  process.exit(1);
}

const onDisk = readdirSync(WORDS_DIR).sort();
const shards = onDisk.filter((f) => /^\d+\.json$/.test(f));
const stray = onDisk.filter((f) => !shards.includes(f));
if (stray.length) {
  fail(`${stray.length} file(s) in the word directory are not shards: ${stray.join(", ")}`);
}
if (shards.length !== pin.pages.length) {
  fail(`the pin lists ${pin.pages.length} shard(s); ${shards.length} are committed`);
}

let words = 0;
let marks = 0;
let dropped = 0; // marks that needed any drop at all
let worstDrop = 0;

for (const row of pin.pages) {
  const page = row.page;
  const where = `page ${page}`;
  const shardFile = join(WORDS_DIR, `${page}.json`);
  const pageFile = join(PAGES_DIR, `${page}.svg`);

  if (!existsSync(shardFile)) {
    fail(`${where}: shard missing`);
    continue;
  }
  const raw = readFileSync(shardFile);
  if (sha256(raw) !== row.sha256) {
    fail(`${where}: shard does not match the pin — it was edited, or build:words was not re-run`);
    continue;
  }
  if (!existsSync(pageFile)) {
    fail(`${where}: shard is committed but the page SVG it measures is not`);
    continue;
  }

  const shard = JSON.parse(raw.toString("utf8"));
  if (shard.page !== page) fail(`${where}: shard says page ${shard.page}`);

  const svg = readFileSync(pageFile, "utf8");
  const vb = (svg.match(/viewBox="([^"]+)"/) ?? [])[1]?.split(/\s+/).map(Number);
  if (!vb || vb.length !== 4) {
    fail(`${where}: page SVG has no readable viewBox`);
    continue;
  }

  // Ayah polygons, keyed the way the shard keys them.
  const polys = new Map();
  for (const m of svg.matchAll(/<path\b[^>]*\bclass="ayahPolygon"[^>]*>/g)) {
    const number = Number((m[0].match(/\bnumber="(\d+)"/) ?? [])[1]);
    const d = (m[0].match(/\sd="([^"]*)"/) ?? [])[1];
    if (!number || !d) {
      fail(`${where}: an ayahPolygon carries no number or no geometry`);
      continue;
    }
    const key = `${Math.floor(number / 1000)}:${number % 1000}`;
    if (polys.has(key)) fail(`${where}: two polygons claim ${key}`);
    polys.set(key, rings(d, `${where} ${key}`));
  }

  const keys = Object.keys(shard.words);
  for (const key of keys) if (!polys.has(key)) fail(`${where}: ${key} has boxes but no polygon`);
  for (const key of polys.keys()) {
    if (!(key in shard.words)) fail(`${where}: ${key} has a polygon but no boxes`);
  }

  let pageWords = 0;
  for (const key of keys) {
    const entry = shard.words[key];
    const { from, boxes } = entry;
    const markSet = new Set(entry.marks ?? []);
    if (!Number.isInteger(from) || from < 1) fail(`${where} ${key}: from is ${from}`);
    if (!Array.isArray(boxes) || boxes.length === 0) fail(`${where} ${key}: no boxes`);
    const last = from + boxes.length - 1;
    for (const idx of markSet) {
      if (idx < from || idx > last) fail(`${where} ${key}: mark ${idx} is outside ${from}..${last}`);
    }
    const ring = polys.get(key) ?? [];

    boxes.forEach((box, i) => {
      const idx = from + i;
      const at = `${where} ${key}#${idx}`;
      if (!Array.isArray(box) || box.length !== 4 || box.some((v) => !Number.isFinite(v))) {
        fail(`${at}: box is not four finite numbers`);
        return;
      }
      const [x, y, w, h] = box;
      pageWords++;
      if (w <= 0 || h <= 0) fail(`${at}: box has no area`);
      if (x < vb[0] || y < vb[1] || x + w > vb[0] + vb[2] || y + h > vb[1] + vb[3]) {
        fail(`${at}: box falls outside the page's ${vb.join(" ")} viewBox`);
        return;
      }
      const cx = x + w / 2;
      if (markSet.has(idx)) {
        marks++;
        if (inside(ring, cx, y + h)) return;
        let met = null;
        for (let k = 1; k <= MARK_DROP * 10; k++) {
          if (inside(ring, cx, y + h + k / 10)) {
            met = k / 10;
            break;
          }
        }
        if (met === null) {
          fail(`${at}: pause mark does not meet ${key} within ${MARK_DROP} units below its box`);
        } else {
          dropped++;
          worstDrop = Math.max(worstDrop, met);
        }
      } else {
        words++;
        if (!inside(ring, cx, y + h / 2)) {
          const owner = [...polys].find(([, r]) => inside(r, cx, y + h / 2))?.[0] ?? "no ayah";
          fail(`${at}: word centre lands on ${owner}, not ${key}`);
        }
      }
    });
  }

  if (row.words !== pageWords) fail(`${where}: pin says ${row.words} words, the shard holds ${pageWords}`);
  if (row.ayahs !== keys.length) fail(`${where}: pin says ${row.ayahs} ayahs, the shard holds ${keys.length}`);
}

if (failures.length) {
  console.error(`FAIL gate:words — ${failures.length} problem(s):`);
  for (const f of failures.slice(0, 40)) console.error(`  ${f}`);
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  process.exit(1);
}

console.log(
  `gate:words — ${pin.pages.length} shard(s) match ${pin.source.repo}@${pin.source.commit.slice(0, 8)}; ` +
    `${words} word boxes land inside their own ayah, and all ${marks} pause marks meet theirs ` +
    `(${dropped} needed a drop, worst ${worstDrop.toFixed(1)} of ${MARK_DROP})`,
);
