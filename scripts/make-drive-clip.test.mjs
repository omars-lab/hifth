// `make drive` takes a picture of the running app. The driver behind it can
// shoot only one part of the screen, which is how a design page gets a picture
// of one panel and nothing of the mus'haf behind it. The make target dropped
// that setting, so the picture came back whole. A dry run shows what `make`
// would launch, which is all this needs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dry = (...vars) => execFileSync("make", ["-n", "-s", "-C", root, "drive", ...vars], { encoding: "utf8" });

test("CLIP reaches the driver as its clip setting", () => {
  assert.match(dry("CLIP=0,135,390,476"), /--clip '0,135,390,476'/);
});

test("without CLIP the driver shoots the whole screen", () => {
  assert.doesNotMatch(dry(), /--clip/);
});
