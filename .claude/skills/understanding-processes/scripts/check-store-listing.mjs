#!/usr/bin/env node
// Do the words drafted for Apple's store forms still fit Apple's limits, and
// still agree with the app? Reads the listing page (docs/design/store-listing.md),
// where each box Apple asks for sits under a `<!-- field: <name> -->` line, and
// checks each one. Prints one line per field with its length and Apple's limit,
// then any problem, and exits 1 when there is one.
//
//   node .claude/skills/understanding-processes/scripts/check-store-listing.mjs
//   make app-store-listing                       the same, from the repo root
//   --file <path>                                check another listing page (tests)
//   --root <dir>                                 read the app's files from there (tests)
//
// It prints lengths and field names only, never a field's words, so its output
// can go anywhere.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
const root = resolve(flag("--root") ?? fileURLToPath(new URL("../../../../", import.meta.url)));
const file = resolve(flag("--file") ?? join(root, "docs/design/store-listing.md"));

// Apple's limits, in characters (App Store Connect's app information and
// version pages, read 2026-11-17).
const LIMITS = {
  name: 30,
  subtitle: 30,
  keywords: 100,
  "promotional-text": 170,
  description: 4000,
  "review-notes": 4000,
  "privacy-answer": undefined,
};

/** Each `<!-- field: x -->` line, and the text block or quote right after it. */
export function readFields(page) {
  const fields = {};
  const lines = page.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^<!-- field: ([\w-]+) -->$/);
    if (!marker) continue;
    let j = i + 1;
    const body = [];
    if (lines[j]?.startsWith("```")) {
      for (j++; j < lines.length && !lines[j].startsWith("```"); j++) body.push(lines[j]);
    } else {
      for (; j < lines.length && lines[j].startsWith(">"); j++) body.push(lines[j].replace(/^> ?/, ""));
    }
    fields[marker[1]] = body.join("\n").trim();
  }
  return fields;
}

const read = (path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : "");
/** The value after a key in an Apple settings file, as its raw XML. */
const plistValue = (xml, key) => xml.match(new RegExp(`<key>${key}</key>\\s*(<[^>]+/>|<[^>]+>[^<]*</[^>]+>)`))?.[1] ?? "";
const words = (text) => text.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);

export function check(page) {
  const fields = readFields(page);
  const problems = [];
  const lines = [];

  for (const [name, limit] of Object.entries(LIMITS)) {
    const text = fields[name];
    if (text === undefined || text === "") {
      problems.push(`${name}: missing (no "<!-- field: ${name} -->" line with text after it)`);
      continue;
    }
    const length = [...text].length;
    lines.push(limit ? `${name}: ${length} of ${limit}` : `${name}: set`);
    if (limit && length > limit) problems.push(`${name}: ${length} characters, ${length - limit} over Apple's ${limit}`);
    if (/[—–]/.test(text)) problems.push(`${name}: has a long dash; the house style uses none`);
    if (/study\s+qur'?an/i.test(text)) problems.push(`${name}: names a book the public listing must not name`);
  }

  const ios = read("native/Hifth/Resources/Info-iOS.plist");
  const mac = read("native/Hifth/Resources/Info-macOS.plist");

  // The store name is the name under the icon.
  if (fields.name) {
    for (const [label, xml] of [["iPad and iPhone", ios], ["Mac", mac]]) {
      if (plistValue(xml, "CFBundleDisplayName") !== `<string>${fields.name}</string>`) {
        problems.push(`name: differs from the ${label} app's display name`);
      }
    }
  }

  // Keywords: Apple already searches the name and subtitle, so a keyword that
  // repeats one of their words spends characters on nothing.
  if (fields.keywords) {
    const list = fields.keywords.split(",").map((k) => k.trim().toLowerCase());
    if (list.some((k) => k === "")) problems.push("keywords: an empty keyword (two commas together, or one at the end)");
    if (new Set(list).size !== list.length) problems.push("keywords: a keyword is listed twice");
    const taken = new Set(words(`${fields.name ?? ""} ${fields.subtitle ?? ""}`));
    const repeats = list.filter((k) => words(k).some((w) => taken.has(w))).length;
    if (repeats) problems.push(`keywords: ${repeats} keyword(s) repeat a word already in the name or subtitle`);
  }

  // "Data Not Collected" must agree with the app's privacy file.
  if (fields["privacy-answer"]) {
    const privacy = read("native/Hifth/Resources/PrivacyInfo.xcprivacy");
    if (fields["privacy-answer"] === "Data Not Collected") {
      if (plistValue(privacy, "NSPrivacyTracking") !== "<false/>") problems.push("privacy-answer: the privacy file says the app tracks");
      if (plistValue(privacy, "NSPrivacyCollectedDataTypes") !== "<array/>") problems.push("privacy-answer: the privacy file lists collected data");
    } else if (plistValue(privacy, "NSPrivacyCollectedDataTypes") === "<array/>") {
      problems.push("privacy-answer: declares collected data, but the privacy file lists none");
    }
  }

  // The export answer lives in both settings files, so Apple does not ask at each upload.
  for (const [label, xml] of [["iPad and iPhone", ios], ["Mac", mac]]) {
    if (plistValue(xml, "ITSAppUsesNonExemptEncryption") !== "<false/>") {
      problems.push(`export answer: the ${label} settings do not say the app uses only exempt encryption`);
    }
  }

  // The first category on the page is the one the Mac app's settings carry.
  const category = page.match(/\*\*Category:\*\* (\w+) first/)?.[1];
  if (!category) problems.push('category: no "**Category:** <name> first" line');
  else if (plistValue(mac, "LSApplicationCategoryType") !== `<string>public.app-category.${category.toLowerCase()}</string>`) {
    problems.push("category: differs from the Mac app's category");
  }

  // Every hifth.app page the listing gives Apple is in the site's files.
  for (const [, path] of page.matchAll(/https:\/\/hifth\.app\/([\w/-]+\.html)/g)) {
    if (!existsSync(join(root, "apps/landing", path))) problems.push(`addresses: hifth.app/${path} is not in the site's files`);
  }

  // The review notes name the report button by the words the app shows.
  if (fields["review-notes"]) {
    const button = JSON.parse(read("apps/web/src/messages/en.json") || "{}").reportOpen;
    if (!button || !fields["review-notes"].includes(button)) problems.push("review-notes: does not name the report button by the app's own words");
  }

  return { lines, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(file)) {
    console.log(`no listing page at ${file}`);
    process.exit(1);
  }
  const { lines, problems } = check(readFileSync(file, "utf8"));
  for (const line of lines) console.log(line);
  for (const problem of problems) console.log(`problem: ${problem}`);
  console.log(problems.length ? `${problems.length} problem(s)` : "the listing fits Apple's limits and agrees with the app");
  process.exit(problems.length ? 1 : 0);
}
