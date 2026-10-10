// `make app-probe` asks the page inside the real app one more question, written
// in JavaScript. A question with a dollar sign in it (a pattern that ends a
// match, `/^Close$/`) lost the sign and what followed it on the way through
// make, so the page was asked something else and answered with an error; one
// with a single quote broke the shell line. A dry run shows the question as the
// app would get it: whole, either typed in place or read from a file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dry = (...vars) =>
  execFileSync("make", ["-n", "-s", "-C", root, "-f", "native/Makefile.native", ...vars], { encoding: "utf8" });

for (const target of ["mac", "ipad"]) {
  test(`a ${target} probe keeps a dollar sign in its question`, () => {
    const out = dry("app-probe", `TARGET=${target}`, 'EVAL=/^Close$/.test("Close")');
    assert.match(out, /\/\^Close\$\/\.test\("Close"\)/);
  });

  test(`a ${target} probe can read its question from a file`, () => {
    const out = dry("app-probe", `TARGET=${target}`, "EVALFILE=/tmp/made-up/question.js");
    assert.match(out, /HIFTH_PROBE_EVAL="\$\(cat '\/tmp\/made-up\/question\.js'\)"/);
  });
}
