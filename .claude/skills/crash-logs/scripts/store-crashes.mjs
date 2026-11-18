#!/usr/bin/env node
// What Apple's server has collected about the app stopping, for the crash-logs skill (launch item 17).
//
//   list [--since <ISO time>] [--builds N]
//
// Two kinds, because Apple keeps two:
//   - crashes from test builds (TestFlight): one line each, with when, the build, the device and
//     its system version. Store builds' crashes never reach Apple's server for us; those come in
//     a reader's problem report instead (DeviceReports.swift).
//   - freezes, slow launches and heavy storage writes, grouped by where in the code they happen,
//     for the newest few builds, store builds included.
//
// A test crash also carries the tester's own comment and email. This command never asks Apple
// for them: each request names the fields it wants, and the comment and email are not among
// them. It prints one `ev=` line per item and `ev=done` with the counts, and keeps the list in
// .store/crashes/ (git ignores it). The key is the upload one (ASC_KEY_ID, App Manager access,
// which can read test builds; the reviews key's access cannot), loaded by the make target;
// nothing prints it or the ids.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { appId, client, credentials } from "../../../../scripts/lib/app-store-connect.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
export const DATA_DIR = join(REPO, ".store", "crashes");

/** The only fields asked for. A tester's comment and email are left out on purpose. */
export const CRASH_FIELDS = ["createdDate", "deviceModel", "osVersion", "appPlatform", "build"];
const SIGNATURE_FIELDS = ["diagnosticType", "signature", "weight"];
const KINDS = { HANGS: "froze", LAUNCHES: "slow to open", DISK_WRITES: "wrote too much to storage" };

/** A value cut to the characters a log line can hold safely, at most `limit` long. */
const plain = (value, limit) =>
  String(value ?? "")
    .replace(/[^\w.,+:<>()\-/ ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, limit) || "none";

/** Apple's list of test crashes, made into one plain record each, newest first. */
export function toCrashes({ data, included }, since = "") {
  const builds = new Map(included.filter((x) => x.type === "builds").map((b) => [b.id, b.attributes?.version ?? ""]));
  return data
    .filter((c) => c?.type === "betaFeedbackCrashSubmissions")
    .map((c) => {
      const a = c.attributes ?? {};
      return {
        id: c.id,
        date: a.createdDate ?? "",
        build: builds.get(c.relationships?.build?.data?.id) ?? "",
        device: a.deviceModel ?? "",
        os: a.osVersion ?? "",
        platform: a.appPlatform ?? "",
      };
    })
    .filter((c) => !since || c.date >= since)
    .sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
}

/** One build's grouped freezes, slow launches and storage writes, heaviest first. */
export function toSignatures({ data }, build) {
  return data
    .filter((s) => s?.type === "diagnosticSignatures")
    .map((s) => ({ build, type: s.attributes?.diagnosticType ?? "", weight: Number(s.attributes?.weight ?? 0), signature: s.attributes?.signature ?? "" }))
    .sort((x, y) => y.weight - x.weight);
}

export async function run(argv, { env = process.env, dir = DATA_DIR, fetch, readKey, out = console.log } = {}) {
  const [command, ...rest] = argv;
  const flag = (name, fallback) => {
    const at = rest.indexOf(name);
    return at >= 0 && rest[at + 1] ? rest[at + 1] : fallback;
  };
  if (command !== "list") {
    out("usage: store-crashes.mjs list [--since <ISO time>] [--builds N]");
    return 2;
  }
  const since = flag("--since", "");
  const buildCount = Math.max(1, Math.min(20, Number(flag("--builds", "3")) || 3));
  const api = client(credentials(env, { idName: "ASC_KEY_ID", readKey }), { fetch });
  const app = await appId(api);

  const crashes = toCrashes(
    await api.get(
      `/v1/apps/${app}/betaFeedbackCrashSubmissions?limit=200&sort=-createdDate&include=build` +
        `&fields[betaFeedbackCrashSubmissions]=${CRASH_FIELDS.join(",")}&fields[builds]=version`,
    ),
    since,
  );
  for (const c of crashes)
    out(`ev=test_crash date=${plain(c.date, 25)} build=${plain(c.build, 12)} device=${plain(c.device, 24)} os=${plain(c.os, 12)} platform=${plain(c.platform, 10)}`);

  const { data: builds } = await api.get(`/v1/builds?filter[app]=${app}&sort=-uploadedDate&limit=${buildCount}&fields[builds]=version,uploadedDate`);
  const signatures = [];
  for (const b of builds.slice(0, buildCount)) {
    const version = b.attributes?.version ?? "";
    signatures.push(...toSignatures(await api.get(`/v1/builds/${b.id}/diagnosticSignatures?fields[diagnosticSignatures]=${SIGNATURE_FIELDS.join(",")}`), version));
  }
  for (const s of signatures)
    out(`ev=signature build=${plain(s.build, 12)} kind=${plain(KINDS[s.type] ?? s.type, 28)} weight=${s.weight.toFixed(2)} where="${plain(s.signature, 120)}"`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "crashes.json"), JSON.stringify({ crashes, signatures }, null, 2) + "\n");
  out(`ev=done test_crashes=${crashes.length} signatures=${signatures.length} builds=${builds.length}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`store-crashes: ${err.message}`);
      process.exit(1);
    },
  );
}
