// Which ways up the iPhone and iPad app may be held (native/Hifth/Resources/Info-iOS.plist).
//
// Found 2026-11-14 walking the pitch build on the iPhone simulator on its side: the
// phone stayed upright, because the app's settings let an iPhone be held upright
// only. The web app has a layout for a phone on its side, and a hafiz reading a
// long verse or a note turns the phone, so the phone may turn too. Upside down
// stays off on the phone (Apple's own apps do not turn that way on an iPhone).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plist = readFileSync(resolve(root, "native/Hifth/Resources/Info-iOS.plist"), "utf8");

const ways = (key) => {
  const at = plist.indexOf(`<key>${key}</key>`);
  assert.ok(at >= 0, `${key} is in the app's settings`);
  const list = plist.slice(at).match(/<array>([\s\S]*?)<\/array>/);
  assert.ok(list, `${key} is followed by a list`);
  return [...list[1].matchAll(/<string>(\w+)<\/string>/g)].map((m) => m[1]);
};

test("an iPhone may be held upright or on either side, but not upside down", () => {
  const phone = ways("UISupportedInterfaceOrientations");
  assert.deepEqual(
    [...phone].sort(),
    ["UIInterfaceOrientationLandscapeLeft", "UIInterfaceOrientationLandscapeRight", "UIInterfaceOrientationPortrait"],
  );
});

test("an iPad may be held every way up", () => {
  const ipad = ways("UISupportedInterfaceOrientations~ipad");
  assert.equal(ipad.length, 4);
});
