#!/usr/bin/env node
/**
 * Run the copy step's verse-number ring swap on a few pages, into a folder of your choosing,
 * without touching the app's pages or the pin. Use it to look at a mode before switching it on.
 *
 *   node .claude/skills/mushaf-reference/scripts/ring_swap_pages.mjs \
 *     --mode complex --shape <medallion.json> --pages 1,2,7,176,177,300,604 \
 *     [--precision 1] --out <scratch folder>
 *
 * --shape is the Complex's medallion ({d, fill}, drawn round 0,0), needed for --mode complex;
 * plain uses the pin's own ring. --precision overrides svgo's rounding (the pin says 1).
 * It reads the upstream cache (packages/etl/data/pages/.cache), so run vendor-pages --fetch
 * once first. The pages it writes show scripture: keep them out of the repo.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const ETL = join(REPO, "packages", "etl");
const { optimize } = createRequire(join(ETL, "package.json"))("svgo");
const { swapRings } = await import(join(ETL, "scripts", "lib", "verse-rings.mjs"));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const mode = arg("mode");
const out = arg("out");
const pages = (arg("pages") ?? "").split(",").filter(Boolean).map(Number);
if (!mode || !out || !pages.length) {
  console.error("usage: ring_swap_pages.mjs --mode complex|plain [--shape f.json] --pages 1,7 [--precision 1] --out dir");
  process.exit(2);
}

const pin = JSON.parse(readFileSync(join(ETL, "data", "pages", "quran-svg.pin.json"), "utf8"));
const rings = { ...pin.rings, mode };
if (mode === "complex") rings.complex = JSON.parse(readFileSync(arg("shape"), "utf8"));
const overrides = Object.fromEntries(pin.svgo.disabled.map((n) => [n, false]));
const config = {
  multipass: pin.svgo.multipass,
  floatPrecision: Number(arg("precision", pin.svgo.floatPrecision)),
  plugins: [{ name: "preset-default", params: { overrides } }],
};

mkdirSync(out, { recursive: true });
for (const page of pages) {
  const raw = readFileSync(join(ETL, "data", "pages", ".cache", "svg", `${String(page).padStart(3, "0")}.svg`), "utf8");
  const swapped = swapRings(raw, page, rings);
  const svg = optimize(swapped.svg, config).data + "\n";
  writeFileSync(join(out, `${page}.svg`), svg);
  console.log(`ev=page page=${page} found=${swapped.found} twins=${swapped.twins} placed=${swapped.placed} bytes=${svg.length}`);
}
