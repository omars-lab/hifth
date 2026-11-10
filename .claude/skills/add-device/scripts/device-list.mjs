#!/usr/bin/env node
// Lists the devices our signing profiles carry, what kind each is, and how many
// slots of each kind Apple has left this year, at most.
//
// Apple lets a developer account register 100 devices of each kind (iPhone,
// iPad, Apple Watch, Mac, Apple TV, Apple Vision Pro) per membership year. A
// device removed during the year still holds its slot until the year ends, so
// the count here is an upper bound: it sees only what the profiles carry today.
//
// Sources, both on this laptop, no Apple sign-in needed:
//   - the signing profiles Xcode downloaded (they list every registered device
//     of their platform), in ~/Library/Developer/Xcode/UserData/Provisioning Profiles
//   - Apple's device tool, for the name and kind of each device this Mac has seen.
//
//   device-list.mjs           a table; ids shortened to their last 6 characters
//   device-list.mjs --csv     one row per device with the full id (keep it off the repo)
//
// HIFTH_PROFILES_DIR and HIFTH_DEVICECTL swap in stand-ins (the tests use them).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const LIMIT = 100;
const KINDS = { iPhone: "iPhone", iPad: "iPad", appleWatch: "Apple Watch", mac: "Mac", appleTV: "Apple TV", appleVision: "Apple Vision Pro" };
const csv = process.argv.includes("--csv");
const profilesDir = process.env.HIFTH_PROFILES_DIR || join(homedir(), "Library/Developer/Xcode/UserData/Provisioning Profiles");

// A profile on disk is signed; `security cms -D` unwraps it. A plain plist (the
// tests' stand-ins) is read as it is.
function readProfile(file) {
  const raw = readFileSync(file);
  const text = raw.subarray(0, 5).toString() === "<?xml"
    ? raw.toString()
    : spawnSync("security", ["cms", "-D", "-i", file], { encoding: "utf8" }).stdout;
  if (!text) return null;
  // Only the device list: the whole profile holds dates and binary data, which
  // JSON cannot carry, so plutil refuses to convert it in one go.
  const devices = spawnSync("plutil", ["-extract", "ProvisionedDevices", "json", "-o", "-", "-"], { input: text, encoding: "utf8" });
  try {
    return { ProvisionedDevices: JSON.parse(devices.stdout) };
  } catch {
    return { ProvisionedDevices: [] }; // a profile for the App Store lists no devices
  }
}

const profiles = (existsSync(profilesDir) ? readdirSync(profilesDir) : [])
  .filter((f) => /\.(mobileprovision|provisionprofile)$/.test(f))
  .map((f) => readProfile(join(profilesDir, f)))
  .filter(Boolean);

// Devices this Mac has seen, by hardware id.
const seen = new Map();
{
  const dir = mkdtempSync(join(tmpdir(), "hifth-devices-"));
  const file = join(dir, "devices.json");
  const tool = process.env.HIFTH_DEVICECTL;
  const a = ["list", "devices", "--json-output", file, "-q"];
  spawnSync(tool || "xcrun", tool ? a : ["devicectl", ...a], { encoding: "utf8", timeout: 60_000 });
  try {
    for (const d of JSON.parse(readFileSync(file, "utf8")).result?.devices ?? []) {
      const h = d.hardwareProperties ?? {};
      if (h.udid) seen.set(h.udid, { name: d.deviceProperties?.name ?? "", kind: KINDS[h.deviceType] ?? h.deviceType ?? "", model: h.marketingName ?? "" });
    }
  } catch {
    // No device tool, or it failed: every device shows as not seen.
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Each registered device once, with how many profiles carry it.
const rows = new Map();
for (const p of profiles) {
  for (const id of p.ProvisionedDevices ?? []) {
    const row = rows.get(id) ?? { id, profiles: 0, ...(seen.get(id) ?? { name: "not seen by this Mac", kind: "not known", model: "" }) };
    row.profiles += 1;
    rows.set(id, row);
  }
}
const list = [...rows.values()].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

if (csv) {
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replaceAll('"', '""')}"` : String(v));
  console.log("kind,name,model,hardware_id,profiles");
  for (const r of list) console.log([r.kind, r.name, r.model, r.id, r.profiles].map(cell).join(","));
  process.exit(0);
}

if (profiles.length === 0) {
  console.log(`No signing profiles in ${profilesDir}, so no registered devices to list.`);
  console.log("Xcode downloads one the first time it builds for a real device (make app-device-install).");
  process.exit(0);
}

console.log(`Devices on this laptop's ${profiles.length} signing profile(s):`);
const w = Math.max(...list.map((r) => r.kind.length), 4);
const n = Math.max(...list.map((r) => r.name.length), 4);
for (const r of list) console.log(`  ${r.kind.padEnd(w)}  ${r.name.padEnd(n)}  ${r.model ? r.model.padEnd(24) : "".padEnd(24)}  …${r.id.slice(-6)}`);

const used = (kind) => list.filter((r) => r.kind === kind).length;
console.log("");
console.log(`Slots left this year, at most (Apple allows ${LIMIT} of each kind):`);
console.log("  " + Object.values(KINDS).map((k) => `${k} ${LIMIT - used(k)}`).join(" · "));
const unknown = used("not known");
if (unknown) console.log(`  ${unknown} device(s) this Mac has not seen; each holds a slot of its own kind.`);
console.log("  Devices removed this year still hold their slot, and this cannot see those.");
