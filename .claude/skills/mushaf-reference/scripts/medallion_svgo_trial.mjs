// Item 45 trial: run one page through the copy step's svgo settings, read from the pin.
// Usage: node medallion_svgo_trial.mjs <etl package dir> <pin.json> <in.svg> <out.svg> [floatPrecision]
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [etlDir, pinPath, inPath, outPath, precision] = process.argv.slice(2);
const require = createRequire(join(etlDir, "package.json"));
const { optimize } = require("svgo");
const pin = JSON.parse(readFileSync(pinPath, "utf8"));
const overrides = {};
for (const name of pin.svgo.disabled) overrides[name] = false;
const config = {
  multipass: pin.svgo.multipass,
  floatPrecision: precision ? Number(precision) : pin.svgo.floatPrecision,
  plugins: [{ name: "preset-default", params: { overrides } }],
};
const raw = readFileSync(inPath, "utf8");
const out = optimize(raw, config).data + "\n";
writeFileSync(outPath, out);
const numerals = (out.match(/ayah:x=/g) || []).length;
const tinted = (out.match(/#bfe8c1/gi) || []).length;
console.log(`ev=svgo precision=${config.floatPrecision} bytes_in=${raw.length} bytes_out=${out.length} numerals_with_position=${numerals} tinted_paths=${tinted}`);
