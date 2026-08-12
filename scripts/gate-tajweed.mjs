#!/usr/bin/env node
/**
 * CI gate: the tajweed shards and the vocabulary that interprets them agree.
 *
 * The shards used to be keyed by the seven families Hifth paints, so a shard was
 * self-describing: a key was either a colour or it was nothing, and TypeScript
 * said which. They are now keyed by the *source's* eighteen rule ids, and which
 * colour each one paints is a separate shipped file — `tajweed/rules.json`. That
 * bought the app the ability to tell an ikhfa from an iqlab, and it introduced a
 * failure this repo had no way to notice:
 *
 *   a shard key with no vocabulary entry paints NOTHING, silently, for as long
 *   as it ships.
 *
 * Not an error, not a blank page, not a console warning — `marksForAyah` drops
 * an id it cannot place, because the alternative (painting an unknown rule some
 * default colour) is worse. The symptom is that a rule stops appearing, on every
 * page, and the only witness is a hafiz who noticed the ghunnah went quiet.
 * A rebuild with a stale `rules.json`, a half-copied deploy, or a source refresh
 * that adds a rule and a mapping that does not, all land there.
 *
 * So this reads the shipped bytes — all 114 shards and the vocabulary beside
 * them — and checks the two directions of the same claim: every id the shards
 * use is described, and every id the vocabulary describes is used. Plus the two
 * ends the vocabulary is bolted to: the family it names must be one core paints,
 * and the family core paints must have a colour to paint it with.
 *
 * Read from the built assets rather than from the ETL's table on purpose. The
 * table being right is not the question — the question is whether the files a
 * browser will fetch agree with each other, which is a fact about
 * `apps/web/public/assets` and nothing else. A gate that read `build-tajweed.mjs`
 * would pass on a tree whose shards were built before the table changed.
 *
 * Run: `pnpm gate:tajweed` (also in `pnpm gates`, `make ci` and CI).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ASSETS = join(ROOT, "apps", "web", "public", "assets", "skins");
const SKINS_TS = join(ROOT, "packages", "core", "src", "skins.ts");
const TOKENS = join(ROOT, "apps", "web", "src", "styles", "tokens.css");

const problems = [];

// ── What core paints ─────────────────────────────────────────────────────────
//
// Parsed out of the TypeScript source, like `gate:quran-meta` does, so the gate
// fails on the commit that introduces the drift rather than on whatever `dist/`
// happens to hold.
const skinsSrc = readFileSync(SKINS_TS, "utf8");
const families = [...skinsSrc.matchAll(/^\s*\{ id: "([a-z-]+)", label:/gm)].map((m) => m[1]);
if (families.length === 0) {
  console.error(
    "gate:tajweed — FAIL: could not read TAJWEED_RULES out of packages/core/src/skins.ts. " +
      "If the registry's shape changed, this gate's parser has to change with it.",
  );
  process.exit(1);
}

// ── Every family has a colour ────────────────────────────────────────────────
const tokens = readFileSync(TOKENS, "utf8");
for (const family of families) {
  if (!tokens.includes(`--tj-${family}:`)) {
    problems.push(
      `core paints the family "${family}" but tokens.css declares no --tj-${family} — ` +
        `the wash and the outline would fall back to whatever the cascade offers.`,
    );
  }
  if (!tokens.includes(`--tj-dash-${family}:`)) {
    problems.push(
      `the family "${family}" has no --tj-dash-${family} dash pattern. Colour is never ` +
        `the only carrier here (WCAG 1.4.1); a family with a hue and no dash is one a ` +
        `colour-blind reader cannot separate from its neighbour.`,
    );
  }
}

// ── Every shipped edition ────────────────────────────────────────────────────
const editions = existsSync(ASSETS)
  ? readdirSync(ASSETS, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(ASSETS, e.name, "tajweed")))
      .map((e) => e.name)
  : [];

if (editions.length === 0) {
  console.error(
    "gate:tajweed — FAIL: no edition under apps/web/public/assets/skins/ ships a tajweed " +
      "tree. Run `pnpm --filter @hifth/etl build:tajweed`; the shards are committed.",
  );
  process.exit(1);
}

const report = [];

for (const edition of editions) {
  const dir = join(ASSETS, edition, "tajweed");
  const vocabPath = join(dir, "rules.json");

  if (!existsSync(vocabPath)) {
    problems.push(
      `${edition}: the shards ship without rules.json, so nothing can interpret them — ` +
        `every ayah in this edition would render plain under the tajweed skin.`,
    );
    continue;
  }

  let vocab;
  try {
    vocab = JSON.parse(readFileSync(vocabPath, "utf8"));
  } catch (err) {
    problems.push(`${edition}: rules.json is not valid JSON (${err.message}).`);
    continue;
  }

  if (typeof vocab?.source !== "string" || vocab.source.length === 0) {
    problems.push(
      `${edition}: rules.json carries no "source". It is what the colophon credits — ` +
        `an unattributed vocabulary is a licence problem before it is a data one.`,
    );
  }
  if (!Array.isArray(vocab?.rules) || vocab.rules.length === 0) {
    problems.push(`${edition}: rules.json declares no rules.`);
    continue;
  }

  const declared = new Map();
  for (const entry of vocab.rules) {
    if (typeof entry?.id !== "string" || typeof entry?.family !== "string") {
      problems.push(`${edition}: rules.json has an entry that is not {id, family}.`);
      continue;
    }
    if (declared.has(entry.id)) {
      problems.push(
        `${edition}: rules.json names "${entry.id}" twice, with families ` +
          `"${declared.get(entry.id)}" and "${entry.family}". One of them is being ignored.`,
      );
    }
    if (!families.includes(entry.family)) {
      problems.push(
        `${edition}: rules.json maps "${entry.id}" onto the family "${entry.family}", ` +
          `which core does not paint. Known families: ${families.join(", ")}.`,
      );
    }
    declared.set(entry.id, entry.family);
  }

  // ── The two directions ─────────────────────────────────────────────────────
  const used = new Map(); // rule id → how many ayahs use it
  let shards = 0;
  let ayahs = 0;

  for (const name of readdirSync(dir)) {
    if (!/^\d+\.json$/.test(name)) continue;
    shards += 1;
    let shard;
    try {
      shard = JSON.parse(readFileSync(join(dir, name), "utf8"));
    } catch (err) {
      problems.push(`${edition}/${name}: not valid JSON (${err.message}).`);
      continue;
    }
    for (const [ayah, entry] of Object.entries(shard)) {
      ayahs += 1;
      for (const [id, spans] of Object.entries(entry)) {
        used.set(id, (used.get(id) ?? 0) + 1);
        if (!Array.isArray(spans) || spans.length === 0 || spans.length % 2 !== 0) {
          problems.push(
            `${edition}/${name} ayah ${ayah}: "${id}" is not a non-empty flat list of ` +
              `[start, end] pairs.`,
          );
        }
      }
    }
  }

  const orphans = [...used.keys()].filter((id) => !declared.has(id)).sort();
  if (orphans.length > 0) {
    problems.push(
      `${edition}: the shards use ${orphans.length} rule id(s) rules.json does not ` +
        `describe — ${orphans.join(", ")}. Every span under those ids paints nothing, ` +
        `on every page, without an error. Rebuild the shards and the vocabulary together.`,
    );
  }

  const unused = [...declared.keys()].filter((id) => !used.has(id)).sort();
  if (unused.length > 0) {
    problems.push(
      `${edition}: rules.json describes ${unused.length} rule id(s) no shard uses — ` +
        `${unused.join(", ")}. Either the shards are stale or the source stopped ` +
        `emitting a rule, and both are worth knowing before a reader finds out.`,
    );
  }

  // A family core paints, with a colour and a dash and a legend row, that no
  // rule in this edition's vocabulary ever reaches. Not fatal in principle — a
  // future source might be coarser — but today it means a colour nobody can see.
  const reachable = new Set(declared.values());
  for (const family of families) {
    if (!reachable.has(family)) {
      problems.push(
        `${edition}: no rule paints as "${family}", so that colour and its legend row ` +
          `are unreachable in this edition.`,
      );
    }
  }

  report.push(
    `${edition}: ${declared.size} rule ids → ${reachable.size} families, ` +
      `${ayahs} marked ayahs across ${shards} shards`,
  );
}

if (problems.length > 0) {
  console.error("gate:tajweed — FAIL:");
  for (const p of problems) console.error("  -", p);
  process.exit(1);
}

for (const line of report) console.log("  ", line);
console.log(`gate:tajweed — OK (${editions.length} edition(s), ${families.length} families)`);
