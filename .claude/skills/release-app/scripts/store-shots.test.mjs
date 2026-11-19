import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { DEVICES, LOCALES, SCREENS, flatTop, plan, pngHeader, problems } from "./store-shots.mjs";
import { PITCH_ONLY_PANELS } from "../../walk-app/scripts/feature-links.mjs";

/*
 * The store refuses a screenshot of the wrong size, or one with a see-through layer, and says so
 * only after the upload. So the check reads each picture's header the way the store would.
 * These are made-up headers: a PNG's first bytes and the parts before its pixels, no pixels.
 */
const part = (type, data = Buffer.alloc(0)) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  return Buffer.concat([length, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
};
const png = (width, height, { colourType = 2, extra = [], pixels } = {}) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colourType;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    part("IHDR", ihdr),
    ...extra,
    part("IDAT", pixels ?? Buffer.from("tRNS pixels that happen to spell it")),
    part("IEND"),
  ]);
};

/**
 * A phone or tablet picture with real pixels in its top strip: one plain colour, with a dot
 * where the clock would be unless `clock` is false. Only the top 200 rows are written, since
 * the check reads no further; the rest of a real picture changes nothing here.
 */
const screen = (width, height, { clock = true, filters = [0] } = {}) => {
  const rows = [];
  let previous = Buffer.alloc(width * 3);
  for (let y = 0; y < 200; y++) {
    const row = Buffer.alloc(width * 3, 0xf1);
    if (clock && y === 40) row.fill(0x22, 90, 120);
    // The same pixels written with each of the PNG's ways of storing a row, in turn.
    const filter = filters[y % filters.length];
    const stored = Buffer.alloc(row.length);
    for (let i = 0; i < row.length; i++) {
      const left = i >= 3 ? row[i - 3] : 0;
      const up = previous[i];
      const upLeft = i >= 3 ? previous[i - 3] : 0;
      const guess = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      stored[i] = (row[i] - guess) & 0xff;
    }
    rows.push(Buffer.from([filter]), stored);
    previous = row;
  }
  return png(width, height, { pixels: deflateSync(Buffer.concat(rows)) });
};
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** A folder of pictures that are all right, as a map from file to bytes. */
const goodFolder = () => {
  const files = new Map();
  for (const { file, device } of plan()) {
    files.set(file, device.statusBar ? screen(...device.sizes[0]) : png(...device.sizes[0]));
  }
  return files;
};
const run = (files) =>
  problems("/shots", (p) => files.get(p.slice("/shots/".length)), () => [...files.keys()].map((f) => join("/shots", f)));

test("every device's first size is one Apple's store takes, and the Mac's is 16:10", () => {
  for (const d of DEVICES) assert.ok(d.sizes.length > 0, d.key);
  const mac = DEVICES.find((d) => d.key === "mac");
  for (const [w, h] of mac.sizes) assert.equal(w / h, 1.6, `${w}x${h}`);
  // The Mac app sizes its window so the page measures this many points, and the picture is of
  // the page, so at either pixel density it is one the store takes.
  const [w, h] = mac.window.split("x").map(Number);
  assert.ok(mac.sizes.some(([sw, sh]) => sw === w && sh === h));
  assert.ok(mac.sizes.some(([sw, sh]) => sw === 2 * w && sh === 2 * h));
});

test("the plan takes every screen on every device in English and Arabic, at most ten a set", () => {
  assert.deepEqual(LOCALES, ["en", "ar"]);
  assert.ok(SCREENS.length >= 1 && SCREENS.length <= 10);
  assert.equal(plan().length, LOCALES.length * DEVICES.length * SCREENS.length);
  assert.equal(new Set(plan().map((p) => p.file)).size, plan().length);
});

test("the screens are of the public build: no panel the public build lacks is opened", () => {
  assert.ok(PITCH_ONLY_PANELS.length > 0);
  for (const s of SCREENS) {
    const open = new URLSearchParams(s.route.split("?")[1] ?? "").get("open");
    assert.ok(!PITCH_ONLY_PANELS.includes(open), `${s.name} opens ${open}, which only the pitch build has`);
  }
});

test("a folder of right-sized, solid pictures passes", () => {
  assert.deepEqual(run(goodFolder()), []);
});

test("a picture of the wrong size is named, with the sizes the store takes", () => {
  const files = goodFolder();
  files.set("en/iphone-6.9/01-page.png", screen(1206, 2622));
  const [line, ...rest] = run(files);
  assert.equal(rest.length, 0);
  assert.match(line, /^en\/iphone-6\.9\/01-page\.png: 1206x2622, but the store takes 1320x2868/);
});

test("a picture with a see-through layer is refused, by colour type or by a tRNS part", () => {
  const files = goodFolder();
  files.set("ar/mac/02-lookalikes.png", png(2560, 1600, { colourType: 6 }));
  files.set("ar/mac/03-roots.png", png(2560, 1600, { colourType: 3, extra: [part("PLTE", Buffer.alloc(3)), part("tRNS", Buffer.alloc(1))] }));
  const lines = run(files);
  assert.equal(lines.length, 2);
  for (const line of lines) assert.match(line, /see-through/);
});

test("the letters tRNS inside the pixels do not count as a see-through layer", () => {
  assert.equal(pngHeader(png(10, 10)).seeThrough, false);
});

/*
 * The app's own picture of its page leaves a plain strip where the phone's clock and battery
 * sit (launch item 44), and the store shows that strip as a fault. So a phone or tablet picture
 * whose top strip is one flat colour is refused; the whole-screen picture has the clock in it.
 */
test("the iPhones and the iPad each name the height of the strip the clock sits in; the Mac has none", () => {
  for (const d of DEVICES) {
    if (d.target === "mac") assert.equal(d.statusBar, undefined, d.key);
    else assert.ok(d.statusBar > 0 && d.statusBar <= 200, d.key);
  }
});

test("a phone picture whose top strip is one flat colour is refused, and says how to take it", () => {
  const files = goodFolder();
  files.set("ar/iphone-6.3/04-key.png", screen(1206, 2622, { clock: false }));
  const [line, ...rest] = run(files);
  assert.equal(rest.length, 0);
  assert.match(line, /^ar\/iphone-6\.3\/04-key\.png: the top \d+ rows are one flat colour/);
  assert.match(line, /WHOLE_SCREEN=1/);
});

test("the strip is read right whichever way each row of pixels is stored", () => {
  const filters = [0, 1, 2, 3, 4];
  assert.equal(flatTop(screen(64, 64, { clock: false, filters }), 150), true);
  assert.equal(flatTop(screen(64, 64, { clock: true, filters }), 150), false);
  // The dot sits on row 40, so a strip that stops above it is flat.
  assert.equal(flatTop(screen(64, 64, { clock: true, filters }), 40), true);
});

test("a picture whose pixels cannot be read is named, not passed", () => {
  const files = goodFolder();
  files.set("en/ipad-13/03-roots.png", png(2064, 2752));
  const [line, ...rest] = run(files);
  assert.equal(rest.length, 0);
  assert.match(line, /^en\/ipad-13\/03-roots\.png: its pixels could not be read/);
});

test("a missing picture, a file that is not a PNG and a picture not in the plan are each named", () => {
  const files = goodFolder();
  files.delete("en/mac/04-key.png");
  files.set("en/ipad-13/01-page.png", Buffer.from("not a picture"));
  files.set("en/ipad-13/05-extra.png", png(2064, 2752));
  assert.deepEqual(run(files).sort(), [
    "en/ipad-13/01-page.png: not a PNG",
    "en/ipad-13/05-extra.png: not in the plan, so it would be uploaded by mistake",
    "en/mac/04-key.png: missing",
  ]);
});
