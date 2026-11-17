import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The Mac app is built in Debug only: there is no Mac store build yet (launch
// item 8). `CONFIG=Release` changes the iPad simulator build, and was once
// quietly ignored on the Mac, so a reviewer-style walk of the Mac with
// CONFIG=Release looked at the Debug build while saying it was the store one.
// Now the Mac picture and probe refuse it, by name, before building anything.
const root = fileURLToPath(new URL("..", import.meta.url));
const REFUSAL = /Mac app is built in Debug only/;

for (const target of ["app-shot", "app-probe"]) {
  test(`${target} on the Mac refuses CONFIG=Release before building anything`, () => {
    const r = spawnSync("make", ["-s", "-C", root, target, "TARGET=mac", "CONFIG=Release"], {
      encoding: "utf8",
      timeout: 60_000,
    });
    const said = r.stdout + r.stderr;
    assert.notEqual(r.status, 0, said);
    assert.match(said, REFUSAL);
    assert.doesNotMatch(said, /xcodebuild|xcodegen|Generating project/, "it built before refusing");
  });
}

// Asked with `make -n`, which prints the plan and runs none of it, so the
// guard's own words show; what matters is that it compares Debug with Debug
// (and so passes) and that the Mac build comes after it.
test("the Mac picture and probe still build the Debug app when CONFIG is left alone", () => {
  for (const target of ["app-shot", "app-probe"]) {
    const r = spawnSync("make", ["-n", "-C", root, target, "TARGET=mac"], { encoding: "utf8" });
    const said = r.stdout + r.stderr;
    const guard = said.indexOf('test "Debug" = Debug');
    const build = said.search(/app-build-mac|Hifth-macOS/);
    assert.ok(guard >= 0, `${target}: the guard is gone or no longer passes Debug\n${said}`);
    assert.ok(build > guard, `${target} no longer builds the Mac app after the guard\n${said}`);
  }
});
