#!/usr/bin/env node
// How many people download and update Hifth, from Apple's daily sales reports (launch item 33).
//
//   pull [--days N]      fetch each day's report not already kept, back N days (default 30),
//                        into .store/numbers/ (git ignores it)
//   summary [--days N]   first downloads, updates and downloads again, by device and country
//
// Apple makes a day's report the next morning, Pacific time, and keeps daily reports for a
// year. A day with nothing to report answers "not found", which is kept as an empty day so it
// is not asked for again. The key is the hifth-reviews one (ASC_REVIEWS_KEY_ID), and the
// reports are filed under the account's vendor number (ASC_VENDOR_NUMBER); both are loaded by
// the make target and nothing prints either.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { appId, client, credentials } from "../../../../scripts/lib/app-store-connect.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
export const DATA_DIR = join(REPO, ".store", "numbers");
const DAY_MS = 24 * 60 * 60 * 1000;
/** Apple keeps daily reports for 365 days. */
const MAX_DAYS = 365;

/**
 * What each product type code means, from Apple's table (App Store Connect Help, "Product type
 * identifiers"). 3T and F3 are not in that table but Apple's forum gives them for iPad-only and
 * Mac downloads again, so they are counted the same way.
 */
export const KINDS = {
  first: ["1", "1F", "1T", "F1"],
  update: ["7", "7F", "7T", "F7"],
  again: ["3", "3F", "3T", "F3"],
};
const kindOf = (code) => Object.keys(KINDS).find((k) => KINDS[k].includes(code)) ?? "other";
const DEVICE = { Desktop: "Mac" };

/** The days to ask for: yesterday back `days` days, oldest first, as YYYY-MM-DD in UTC. */
export function daysBack(now, days) {
  const n = Math.min(Math.max(1, days), MAX_DAYS);
  const out = [];
  for (let i = n; i >= 1; i--) out.push(new Date(now - i * DAY_MS).toISOString().slice(0, 10));
  return out;
}

/** One report's rows for this app, as plain records. */
export function rowsFor(tsv, app) {
  const [head, ...lines] = tsv.split(/\r?\n/).filter((l) => l.trim());
  if (!head) return [];
  const cols = head.split("\t");
  const at = (name) => cols.indexOf(name);
  const i = {
    code: at("Product Type Identifier"),
    units: at("Units"),
    country: at("Country Code"),
    device: at("Device"),
    app: at("Apple Identifier"),
  };
  if (Object.values(i).some((x) => x < 0)) throw new Error("a sales report came back without the columns this reads; Apple may have changed its form");
  return lines
    .map((l) => l.split("\t"))
    .filter((c) => c[i.app] === String(app))
    .map((c) => ({
      kind: kindOf(c[i.code]),
      units: Number(c[i.units]) || 0,
      country: c[i.country] || "?",
      device: DEVICE[c[i.device]] ?? (c[i.device] || "?"),
    }));
}

/** The lines `summary` prints: counts only. */
export function summarize(rows, { from, to, days, kept }) {
  const sum = (pick) => rows.filter(pick).reduce((n, r) => n + r.units, 0);
  const by = (field, kind) => {
    const m = new Map();
    for (const r of rows.filter((x) => x.kind === kind)) m.set(r[field], (m.get(r[field]) ?? 0) + r.units);
    return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  };
  const list = (pairs, n) => (pairs.length ? pairs.slice(0, n).map(([k, v]) => `${k} ${v}`).join(", ") : "none");
  const lines = [
    `${from} to ${to}: ${kept} of ${days} days' reports kept`,
    `first downloads ${sum((r) => r.kind === "first")}, updates ${sum((r) => r.kind === "update")}, downloads again ${sum((r) => r.kind === "again")}`,
    `first downloads by device: ${list(by("device", "first"), 10)}`,
    `first downloads by country, top 10: ${list(by("country", "first"), 10)}`,
  ];
  const other = sum((r) => r.kind === "other");
  if (other) lines.push(`${other} units of a kind this does not sort (an in-app purchase or a new code from Apple)`);
  return lines;
}

const opt = (argv, name, fallback) => {
  const at = argv.indexOf(name);
  if (at < 0) return fallback;
  const n = Number(argv[at + 1]);
  if (!Number.isInteger(n) || n < 1) throw new Error(`${name} takes a whole number of days`);
  return n;
};

export async function run(argv, { env = process.env, dir = DATA_DIR, now = Date.now(), fetch, readKey, out = console.log } = {}) {
  const [command, ...rest] = argv;
  const days = opt(rest, "--days", 30);
  const dayFile = (d) => join(dir, "daily", `${d}.tsv`);
  const appFile = join(dir, "app.json");

  switch (command) {
    case "pull": {
      const vendor = env.ASC_VENDOR_NUMBER ?? "";
      if (!/^\d+$/.test(vendor))
        throw new Error("ASC_VENDOR_NUMBER is not loaded; it is the number at the top of Payments and Financial Reports in App Store Connect; save it with make env-set NAME=ASC_VENDOR_NUMBER");
      const store = client(credentials(env, { idName: "ASC_REVIEWS_KEY_ID", readKey }), { fetch });
      const app = await appId(store);
      mkdirSync(join(dir, "daily"), { recursive: true });
      writeFileSync(appFile, JSON.stringify({ app }) + "\n");
      let fetched = 0;
      let empty = 0;
      for (const d of daysBack(now, days)) {
        if (existsSync(dayFile(d))) continue;
        const q = new URLSearchParams({
          "filter[frequency]": "DAILY",
          "filter[reportType]": "SALES",
          "filter[reportSubType]": "SUMMARY",
          "filter[version]": "1_1",
          "filter[vendorNumber]": vendor,
          "filter[reportDate]": d,
        });
        const gz = await store.report(`/v1/salesReports?${q}`);
        // Yesterday's report may not be made yet; leave that day to ask again next time.
        if (!gz && d === daysBack(now, 1)[0]) continue;
        writeFileSync(dayFile(d), gz ? gunzipSync(gz) : "");
        if (gz) fetched++;
        else empty++;
      }
      out(`fetched ${fetched} days' reports and ${empty} days with nothing to report; the rest were already kept`);
      return 0;
    }
    case "summary": {
      if (!existsSync(appFile)) throw new Error("nothing kept yet; run pull first");
      const { app } = JSON.parse(readFileSync(appFile, "utf8"));
      const want = daysBack(now, days);
      const have = new Set(existsSync(join(dir, "daily")) ? readdirSync(join(dir, "daily")) : []);
      const kept = want.filter((d) => have.has(`${d}.tsv`));
      const rows = kept.flatMap((d) => rowsFor(readFileSync(dayFile(d), "utf8"), app));
      for (const line of summarize(rows, { from: want[0], to: want.at(-1), days: want.length, kept: kept.length })) out(line);
      return 0;
    }
    default:
      out("usage: store-numbers.mjs pull [--days N] | summary [--days N]");
      return 2;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`store-numbers: ${err.message}`);
      process.exit(1);
    },
  );
}
