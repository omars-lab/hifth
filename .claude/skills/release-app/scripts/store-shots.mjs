#!/usr/bin/env node
// The store's screenshots (docs/design/app-store-launch.md ㉛): which pictures
// to take, on which simulator or window, and a check that each one is a size
// Apple's store takes.
//
//   node store-shots.mjs plan          one line per picture, for make app-store-shots
//   node store-shots.mjs check DIR     fail unless every PNG under DIR is a size the
//                                      store takes for its device, with no see-through
//                                      layer, and every planned picture is there
//
// Apple's sizes, from its screenshot specifications page (read 2026-11-17):
// https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
// The store takes PNG or JPEG, one to ten per size, and refuses a picture with
// a see-through layer. Each set below is the largest Apple lists for its
// device, which the store shrinks for the smaller ones.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The devices the store shows pictures for. `simulator` is the simulator the
 * picture is taken on; the Mac has none, and opens its window at `window`
 * points instead (16:10, as the store asks).
 */
export const DEVICES = [
  { key: "iphone-6.9", target: "ipad", simulator: "iPhone 17 Pro Max", sizes: [[1320, 2868], [1290, 2796], [1260, 2736]] },
  { key: "iphone-6.3", target: "ipad", simulator: "iPhone 17", sizes: [[1206, 2622], [1179, 2556]] },
  { key: "ipad-13", target: "ipad", simulator: "iPad Pro 13-inch (M5)", sizes: [[2064, 2752], [2048, 2732]] },
  { key: "mac", target: "mac", window: "1280x800", sizes: [[2560, 1600], [2880, 1800], [1280, 800], [1440, 900]] },
];

/** The screens shown, in the order the store lists them. Public build only. */
export const SCREENS = [
  { name: "01-page", route: "/hafs-kfqc/p7", shows: "a page of the mus'haf, as it opens" },
  { name: "02-lookalikes", route: "/hafs-kfqc/2:48?open=lookalikes", shows: "the verses that read like this one" },
  { name: "03-roots", route: "/hafs-kfqc/2:48?open=roots", shows: "the roots of a verse's words" },
  { name: "04-key", route: "/hafs-kfqc/p7?open=key", shows: "the tajweed colouring and its key" },
];

export const LOCALES = ["en", "ar"];

/** Every picture to take, with where it goes under the output folder. */
export function plan() {
  const out = [];
  for (const locale of LOCALES) {
    for (const device of DEVICES) {
      for (const screen of SCREENS) {
        out.push({ locale, device, screen, file: `${locale}/${device.key}/${screen.name}.png` });
      }
    }
  }
  return out;
}

/** The width, height and whether it can be see-through, read from a PNG's header. */
export function pngHeader(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 26 || !signature.every((b, i) => bytes[i] === b)) return null;
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colourType = bytes[25];
  // 4 is grey with a see-through layer, 6 is colour with one. A tRNS part
  // also makes a picture see-through, whatever its colour type; it must come
  // before the first IDAT (the pixels), so the parts are read up to there.
  let seeThrough = colourType === 4 || colourType === 6;
  for (let at = 8; at + 8 <= bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString("latin1", at + 4, at + 8);
    if (type === "tRNS") seeThrough = true;
    if (type === "IDAT" || type === "IEND") break;
    at += 12 + length;
  }
  return { width, height, seeThrough };
}

/** What is wrong with the pictures in a folder, one line each; empty when nothing is. */
export function problems(dir, read = (p) => readFileSync(p), list = listPngs) {
  const found = new Set(list(dir).map((p) => relative(dir, p)));
  const out = [];
  for (const { file, device } of plan()) {
    if (!found.has(file)) {
      out.push(`${file}: missing`);
      continue;
    }
    found.delete(file);
    const header = pngHeader(read(join(dir, file)));
    if (!header) {
      out.push(`${file}: not a PNG`);
      continue;
    }
    const { width, height, seeThrough } = header;
    if (!device.sizes.some(([w, h]) => w === width && h === height)) {
      const want = device.sizes.map(([w, h]) => `${w}x${h}`).join(", ");
      out.push(`${file}: ${width}x${height}, but the store takes ${want} for ${device.key}`);
    }
    if (seeThrough) out.push(`${file}: has a see-through layer, which the store refuses`);
  }
  for (const extra of found) out.push(`${extra}: not in the plan, so it would be uploaded by mistake`);
  return out;
}

function listPngs(dir) {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listPngs(p));
    else if (e.name.endsWith(".png")) out.push(p);
  }
  return out;
}

function main(argv) {
  const [command, dir] = argv;
  if (command === "plan") {
    // locale, target, simulator or "-", window or "-", route, file
    for (const { locale, device, screen, file } of plan()) {
      console.log([locale, device.target, device.simulator ?? "-", device.window ?? "-", screen.route, file].join("\t"));
    }
    return 0;
  }
  if (command === "check" && dir) {
    const wrong = problems(dir);
    for (const line of wrong) console.log(`  ✗ ${line}`);
    if (wrong.length) return 1;
    console.log(`  ✓ ${plan().length} pictures, each a size the store takes, none see-through`);
    return 0;
  }
  console.error("usage: store-shots.mjs plan | check DIR");
  return 2;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
