// The app pictures can be taken in either interface language, so a walk of the
// Mac or iPad app covers the Arabic one too. A dry run shows what `make` would
// launch, which is all this needs: the language reaches the app as its own
// launch setting, and leaving it out launches as before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dry = (...vars) =>
  execFileSync("make", ["-n", "-s", "-C", root, "-f", "native/Makefile.native", ...vars], { encoding: "utf8" });

for (const target of ["mac", "ipad"]) {
  test(`a ${target} picture with LOCALE=ar launches the app in Arabic`, () => {
    const out = dry("app-shot", `TARGET=${target}`, "ROUTE=/hafs-kfqc/p45", "LOCALE=ar");
    assert.match(out, /-AppleLanguages '\(ar\)'/);
  });

  test(`a ${target} picture without LOCALE leaves the language alone`, () => {
    const out = dry("app-shot", `TARGET=${target}`, "ROUTE=/hafs-kfqc/p45");
    assert.doesNotMatch(out, /AppleLanguages/);
  });
}

test("the Arabic picture is named apart from the English one", () => {
  const out = dry("app-shot", "TARGET=mac", "ROUTE=/hafs-kfqc/p45", "LOCALE=ar");
  assert.match(out, /mac-hafs-kfqc_p45-ar\.png/);
});

test("an iPad walk with LOCALE=ar walks in Arabic", () => {
  const out = dry("app-walk", "ROUTES=/hafs-kfqc/p45", "LOCALE=ar");
  assert.match(out, /TEST_RUNNER_WALK_LOCALE='ar'/);
});
