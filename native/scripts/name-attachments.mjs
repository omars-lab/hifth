#!/usr/bin/env node
/*
 * Give the pictures `xcresulttool export attachments` writes the names the
 * test gave them. They come out named by random ids, with the real name only
 * in manifest.json, and XCTest adds `_0_<id>` to that.
 *
 *   node native/scripts/name-attachments.mjs native/shots/walk
 */
import { readFileSync, renameSync } from "node:fs";
import { join } from "node:path";

/** `side-1-hafs-kfqc_p45_0_<id>.png` → `side-1-hafs-kfqc_p45.png` */
export function plainName(suggested) {
  return suggested.replace(/_\d+_[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}(\.\w+)$/i, "$1");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error("usage: name-attachments.mjs <folder from xcresulttool export attachments>");
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  for (const test of manifest) {
    for (const a of test.attachments ?? []) {
      const name = plainName(a.suggestedHumanReadableName);
      renameSync(join(dir, a.exportedFileName), join(dir, name));
      console.log(join(dir, name));
    }
  }
}
