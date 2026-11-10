#!/usr/bin/env node
// Prints the hardware id of a connected device, given its name, the id Apple's
// device tool prints, or the hardware id itself. The signing profile lists iPads
// by hardware id, so the install uses this to check the profile lists the
// plugged-in iPad (profile-lasts.sh's second argument).
//
//   device-udid.mjs --device <name or id>
//
// Exit 0 and the id on standard output · 1 no such device, or the list failed.
// HIFTH_DEVICECTL swaps Apple's device tool for a stand-in (the tests use one).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const device = args.includes("--device") ? args[args.indexOf("--device") + 1] : "";
if (!device) {
  console.error("usage: device-udid.mjs --device <name or id>");
  process.exit(2);
}

const dir = mkdtempSync(join(tmpdir(), "hifth-devices-"));
const file = join(dir, "devices.json");
const tool = process.env.HIFTH_DEVICECTL;
const listArgs = ["list", "devices", "--json-output", file, "-q"];
const r = spawnSync(tool || "xcrun", tool ? listArgs : ["devicectl", ...listArgs], { encoding: "utf8", timeout: 60_000 });
let devices = [];
try {
  devices = JSON.parse(readFileSync(file, "utf8")).result?.devices ?? [];
} catch {
  console.error(`could not list the connected devices: ${(r.stderr || r.error?.message || "").trim()}`);
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const found = devices.find(
  (d) => d.deviceProperties?.name === device || d.identifier === device || d.hardwareProperties?.udid === device,
);
if (!found?.hardwareProperties?.udid) {
  console.error(`no device called "${device}" is connected. Names: ${devices.map((d) => d.deviceProperties?.name).join(", ") || "none"}`);
  process.exit(1);
}
console.log(found.hardwareProperties.udid);
